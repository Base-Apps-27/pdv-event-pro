import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Rate Limiter (InMemory)
const rateLimiter = new Map();

Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    // SEC-3 (2026-03-02): Dual-layer rate limiting.
    // Layer 1: In-memory (fast, but resets on cold start ~60s on Deno Deploy).
    // Layer 2: Entity-based (persistent, survives cold starts).
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxAttempts = 5;

    // Layer 1: In-memory quick check
    if (!rateLimiter.has(clientIp)) rateLimiter.set(clientIp, []);
    const attempts = rateLimiter.get(clientIp).filter(t => now - t < windowMs);
    if (attempts.length >= maxAttempts) {
        return Response.json({ error: 'Too many requests' }, { status: 429, headers: corsHeaders });
    }
    attempts.push(now);
    rateLimiter.set(clientIp, attempts);

    // CTO-5 (2026-03-02): Hoist idempotencyKey to function scope so catch block
    // can access it for cleanup even if req.json() throws.
    // Previously, idempotencyKey was declared inside try block via destructuring,
    // making it unreachable in the catch block's cleanup logic.
    let idempotencyKey;

    try {
        const base44 = createClientFromRequest(req);
        
        // ── PAYLOAD SIZE GUARD (2026-03-03: parity with submitArtsSegment) ──
        // Prevents blob injection. Speaker submissions are text + URLs, 100KB is generous.
        const rawBody = await req.text();
        const MAX_BODY_SIZE = 100_000; // 100KB
        if (rawBody.length > MAX_BODY_SIZE) {
            console.warn(`[SpeakerSubmission] Payload too large: ${rawBody.length} bytes from ${clientIp}`);
            return Response.json({ error: 'Payload too large' }, { status: 413, headers: corsHeaders });
        }
        const body = JSON.parse(rawBody);

        const { segment_id, content, title, presentation_url, notes_url, content_is_slides_only, device_info } = body;
        idempotencyKey = body.idempotencyKey;

        // ── HONEYPOT CHECK (2026-02-28) ──
        // Hidden "website" field that humans never fill. Bots get fake success.
        if (body.website) {
            console.warn(`[SpeakerSubmission] Honeypot triggered from ${clientIp}`);
            return Response.json({ success: true }, { headers: corsHeaders });
        }

        // ── URL FIELD VALIDATION (2026-03-03: parity with submitArtsSegment SEC-6) ──
        // Only http/https schemes allowed. Blocks javascript:, data:, file: injection.
        const URL_FIELDS_TO_CHECK = { presentation_url, notes_url };
        for (const [fieldName, val] of Object.entries(URL_FIELDS_TO_CHECK)) {
            if (val) {
                const urls = Array.isArray(val) ? val : val.split(',').map(u => u.trim()).filter(Boolean);
                for (const u of urls) {
                    if (typeof u === 'string' && u.trim() !== '') {
                        const trimmed = u.trim().toLowerCase();
                        if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
                            return Response.json(
                                { error: `Invalid URL in field "${fieldName}". Only http/https URLs are allowed.` },
                                { status: 400, headers: corsHeaders }
                            );
                        }
                    }
                }
            }
        }

        // Layer 2: Entity-based persistent rate limit (SEC-3, 2026-03-02).
        // Scoped to the specific segment being submitted to — prevents global false positives.
        // FIX (2026-03-02): Originally queried ALL speaker submissions globally, causing
        // false rate-limit hits when multiple users submitted to different segments simultaneously.
        const twoMinAgo = new Date(Date.now() - 120000).toISOString();
        const recentForSegment = await base44.asServiceRole.entities.PublicFormIdempotency.filter(
            { form_type: 'speaker_submission', site_id: segment_id, created_date: { $gte: twoMinAgo } },
            '-created_date', 20
        );
        if (recentForSegment.length >= 5) {
            console.warn(`[SpeakerSubmission] Entity rate limit hit: ${recentForSegment.length} submissions for segment ${segment_id} in 2min`);
            return Response.json({ error: 'Too many requests. Please wait.' }, { status: 429, headers: corsHeaders });
        }

        // Validate Input First
        if (!segment_id) {
            return Response.json({ error: "Missing segment_id" }, { status: 400, headers: corsHeaders });
        }
        if (!content_is_slides_only && (!content || !content.trim())) {
            return Response.json({ error: "Content is required" }, { status: 400, headers: corsHeaders });
        }

        // Idempotency Check
        if (idempotencyKey) {
            const existing = await base44.asServiceRole.entities.PublicFormIdempotency
                .filter({ idempotency_key: idempotencyKey });
            
            if (existing.length > 0) {
                const record = existing[0];
                if (record.status === 'succeeded') {
                    return Response.json(record.response_payload, { headers: corsHeaders });
                }
                if (record.status === 'processing') {
                    return Response.json({ message: 'Processing' }, { status: 202, headers: corsHeaders });
                }
            }

            // Create idempotency record
            await base44.asServiceRole.entities.PublicFormIdempotency.create({
                idempotency_key: idempotencyKey,
                form_type: 'speaker_submission',
                status: 'processing',
                site_id: segment_id
            });
        }

        // Verify segment exists and is correct type (DECISION-007: validation before write)
        const segment = await base44.asServiceRole.entities.Segment.get(segment_id);
        if (!segment) {
            return Response.json({ error: "Segment not found" }, { status: 404, headers: corsHeaders });
        }
        
        // Validate segment is message-type (Plenaria, Predica, Mensaje, Message)
        const VALID_TYPES = ['plenaria', 'predica', 'mensaje', 'message'];
        const segmentType = (segment.segment_type || '').toLowerCase();
        if (!VALID_TYPES.includes(segmentType)) {
            console.warn(`[SpeakerSubmission] Rejected: segment ${segment_id} is type "${segment.segment_type}", not a message type`);
            return Response.json({ error: "This segment does not accept speaker submissions" }, { status: 403, headers: corsHeaders });
        }

        // 1. Create Version Record (Source of Truth)
        // Audit trail + processing trigger: SpeakerSubmissionVersion.create triggers
        // processNewSubmissionVersion automation for verse parsing + LLM.
        try {
            await base44.asServiceRole.entities.SpeakerSubmissionVersion.create({
                segment_id: segment_id,
                content: content,
                presentation_url: Array.isArray(presentation_url) ? presentation_url : (presentation_url ? [presentation_url] : []),
                notes_url: Array.isArray(notes_url) ? notes_url : (notes_url ? [notes_url] : []),
                content_is_slides_only: !!content_is_slides_only,
                submitted_at: new Date().toISOString(),
                source: 'public_form',
                processing_status: 'pending',
                // 2026-03-01: Browser/device metadata for audit trail
                ...(device_info ? { device_info } : {}),
            });
        } catch (verErr) {
            console.error("Failed to save submission version:", verErr);
            throw new Error("Failed to save submission");
        }

        // 2. Set Segment Status to Pending (Immediate Feedback for Admin)
        // We do this lightweight update so the admin sees "Pending" immediately, 
        // even if the automation takes a few seconds to process and mark it "Processed".
        // We DO NOT parse content here.
        const segmentUpdates = {
            submission_status: 'pending',
            // DO NOT SAVE RAW CONTENT TO SEGMENT. Only parsed data lives on the segment.
            // Raw content is archived in SpeakerSubmissionVersion only.
            presentation_url: Array.isArray(presentation_url) ? presentation_url : (presentation_url ? [presentation_url] : []),
            notes_url: Array.isArray(notes_url) ? notes_url : (notes_url ? [notes_url] : []),
            content_is_slides_only: !!content_is_slides_only
        };
        if (title && title.trim() !== '') {
            segmentUpdates.message_title = title;
        }

        await base44.asServiceRole.entities.Segment.update(segment_id, segmentUpdates);

        const responsePayload = { success: true };

        // Update idempotency to succeeded
        if (idempotencyKey) {
            const existing = await base44.asServiceRole.entities.PublicFormIdempotency.filter({ idempotency_key: idempotencyKey });
            if (existing.length) {
                await base44.asServiceRole.entities.PublicFormIdempotency.update(existing[0].id, {
                    status: 'succeeded',
                    response_payload: responsePayload
                });
            }
        }

        return Response.json(responsePayload, { headers: corsHeaders });

    } catch (error) {
        // Hardening: Ensure we don't leave idempotency keys stuck in 'processing' on failure
        if (idempotencyKey) {
            try {
                const existing = await base44.asServiceRole.entities.PublicFormIdempotency.filter({ idempotency_key: idempotencyKey });
                if (existing.length) {
                    await base44.asServiceRole.entities.PublicFormIdempotency.update(existing[0].id, { status: 'failed' });
                }
            } catch (cleanupErr) {
                console.error("Failed to cleanup idempotency:", cleanupErr);
            }
        }
        return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }
});
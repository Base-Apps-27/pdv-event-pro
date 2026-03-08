import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// SUBMIT-ONLY endpoint for weekly service speaker submissions.
// No parsing or processing happens here. Raw content is stored in SpeakerSubmissionVersion,
// Segment is marked submission_status='pending' for admin visibility.
// Processing is handled asynchronously by processNewSubmissionVersion (entity automation
// on SpeakerSubmissionVersion create). Safety net: processPendingSubmissions (scheduled).

// Rate Limiter
const rateLimiter = new Map();

Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    // SEC-3/4 (2026-03-02): Dual-layer rate limiting.
    // Layer 1: In-memory (fast, resets on cold start).
    // Layer 2: Entity-based (persistent, see below after base44 init).
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    if (!rateLimiter.has(clientIp)) rateLimiter.set(clientIp, []);
    const attempts = rateLimiter.get(clientIp).filter(t => now - t < 60000);
    if (attempts.length >= 5) return Response.json({ error: 'Too many requests' }, { status: 429, headers: corsHeaders });
    attempts.push(now);
    rateLimiter.set(clientIp, attempts);

    try {
        const base44 = createClientFromRequest(req);

        // ── PAYLOAD SIZE GUARD (2026-03-03: parity with submitArtsSegment) ──
        // Prevents blob injection. Weekly submissions are text + URLs, 100KB is generous.
        const rawBody = await req.text();
        const MAX_BODY_SIZE = 100_000; // 100KB
        if (rawBody.length > MAX_BODY_SIZE) {
            console.warn(`[WeeklySubmission] Payload too large: ${rawBody.length} bytes from ${clientIp}`);
            return Response.json({ error: 'Payload too large' }, { status: 413, headers: corsHeaders });
        }
        const body = JSON.parse(rawBody);

        const { segment_id, content, title, presentation_url, notes_url, content_is_slides_only, idempotencyKey, device_info } = body;
        // Dynamic mirror targets: array of composite IDs to also receive this submission
        // Backward compat: legacy apply_to_both_services boolean still works
        const mirror_target_ids = body.mirror_target_ids || [];
        const apply_to_both_services = body.apply_to_both_services || false;

        // ── HONEYPOT CHECK (2026-02-28) ──
        // Hidden "website" field that humans never fill. Bots get fake success.
        if (body.website) {
            console.warn(`[WeeklySubmission] Honeypot triggered from ${clientIp}`);
            return Response.json({ success: true }, { headers: corsHeaders });
        }

        // ── URL FIELD VALIDATION (2026-03-03: parity with submitArtsSegment SEC-6) ──
        // Only http/https schemes allowed. Blocks javascript:, data:, file: injection.
        const URL_FIELDS_TO_CHECK = { presentation_url, notes_url };
        for (const [fieldName, val] of Object.entries(URL_FIELDS_TO_CHECK)) {
            if (val && typeof val === 'string' && val.trim() !== '') {
                const trimmed = val.trim().toLowerCase();
                if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
                    return Response.json(
                        { error: `Invalid URL in field "${fieldName}". Only http/https URLs are allowed.` },
                        { status: 400, headers: corsHeaders }
                    );
                }
            }
        }

        // Layer 2: Entity-based persistent rate limit (SEC-3/4, 2026-03-02).
        // FIX (2026-03-02): Scoped to segment_id (site_id field) to prevent global false positives.
        // Originally queried ALL weekly submissions globally — 10 different users submitting
        // to 10 different segments in 2 min would trigger the limit for everyone.
        const twoMinAgo = new Date(Date.now() - 120000).toISOString();
        const recentForSegment = await base44.asServiceRole.entities.PublicFormIdempotency.filter(
            { form_type: 'weekly_service_submission', site_id: segment_id, created_date: { $gte: twoMinAgo } },
            '-created_date', 20
        );
        if (recentForSegment.length >= 5) {
            console.warn(`[WeeklySubmission] Entity rate limit hit: ${recentForSegment.length} submissions for ${segment_id} in 2min`);
            return Response.json({ error: 'Too many requests. Please wait.' }, { status: 429, headers: corsHeaders });
        }

        if (!segment_id) {
            return Response.json({ error: "Missing required fields: segment_id" }, { status: 400, headers: corsHeaders });
        }
        // Slides-only mode allows empty content (presentation URL replaces verse text)
        if (!content_is_slides_only && !content) {
            return Response.json({ error: "Missing content (required unless slides-only mode)" }, { status: 400, headers: corsHeaders });
        }

        // Idempotency Check
        if (idempotencyKey) {
            const existing = await base44.asServiceRole.entities.PublicFormIdempotency.filter({ idempotency_key: idempotencyKey });
            if (existing.length > 0 && existing[0].status === 'succeeded') {
                return Response.json(existing[0].response_payload, { headers: corsHeaders });
            }
            if (existing.length === 0) {
                await base44.asServiceRole.entities.PublicFormIdempotency.create({
                    idempotency_key: idempotencyKey,
                    form_type: 'weekly_service_submission',
                    status: 'processing',
                    site_id: segment_id
                });
            }
        }

        // Validate composite ID format
        if (!segment_id.startsWith('weekly_service|')) {
            return Response.json({ error: "Invalid ID format for this endpoint" }, { status: 400, headers: corsHeaders });
        }

        const parts = segment_id.split('|');
        if (parts.length < 5) return Response.json({ error: "Invalid composite ID" }, { status: 400, headers: corsHeaders });
        
        const [_, serviceId, timeSlot, segmentIdxStr, type] = parts;
        const segmentIdx = parseInt(segmentIdxStr);

        // Resolve Segment entity via Session
        const PLENARIA_TYPES = ['plenaria', 'message', 'predica', 'mensaje'];
        const allSessionsForService = await base44.asServiceRole.entities.Session.filter({ service_id: serviceId });
        const targetSession = allSessionsForService.find(s => s.name === timeSlot);
        if (!targetSession) {
            return Response.json({ error: "Session not found for this time slot" }, { status: 404, headers: corsHeaders });
        }

        const segs = await base44.asServiceRole.entities.Segment.filter({ session_id: targetSession.id }, 'order');
        const candidate = segs[segmentIdx];
        const targetSegmentEntity = (candidate && PLENARIA_TYPES.includes((candidate.segment_type || '').toLowerCase()))
            ? candidate
            : segs.find(s => PLENARIA_TYPES.includes((s.segment_type || '').toLowerCase())) || null;

        if (!targetSegmentEntity) {
            return Response.json({ error: "No message-type segment found" }, { status: 404, headers: corsHeaders });
        }

        const segType = (targetSegmentEntity.segment_type || '').toLowerCase();
        if (!PLENARIA_TYPES.includes(segType)) {
            return Response.json({ error: "Invalid segment type. Only messages accept submissions." }, { status: 400, headers: corsHeaders });
        }

        // SUBMISSION ONLY — no inline processing.
        // SpeakerSubmissionVersion create triggers processNewSubmissionVersion automation.

        let parsedData = { type: 'empty', sections: [] };
        let scriptureReferences = '';

        let projectionNotes = targetSegmentEntity.projection_notes || "";

        // Mark for pending processing, no inline LLM
        console.log("[SUBMIT] Marking submission as pending — async processing will follow");

        const commonFields = {
            // Mark as pending — processNewSubmissionVersion will process asynchronously
            parsed_verse_data: parsedData,
            submission_status: 'pending',
            scripture_references: scriptureReferences,
            presentation_url: presentation_url || "",
            notes_url: notes_url || "",
            content_is_slides_only: !!content_is_slides_only,
            projection_notes: projectionNotes,
            ...(title?.trim() ? { message_title: title.trim() } : {}),
        };

        // Build effective mirror list (dynamic from form checkboxes + legacy backward compat)
        const effectiveMirrors = [...mirror_target_ids];
        if (apply_to_both_services && timeSlot === '9:30am' && effectiveMirrors.length === 0) {
            effectiveMirrors.push(segment_id.replace('|9:30am|', '|11:30am|'));
        }

        // Write pending status to Segment entity
        console.log(`[SUBMIT] Writing to Segment entity (${targetSegmentEntity.id})`);
        await base44.asServiceRole.entities.Segment.update(targetSegmentEntity.id, commonFields);
        console.log("[SUBMIT] Segment entity updated");

        // ── MIRROR UPDATES ──
        // Track resolved entity IDs so we can pass them to SpeakerSubmissionVersion
        // and the processor won't need to re-resolve from composite IDs.
        const mirrorResolvedIds = new Map(); // mirrorCompositeId → resolved entity ID
        for (const mirrorId of effectiveMirrors) {
            const mirrorParts = mirrorId.split('|');
            if (mirrorParts.length < 5) {
                console.warn(`[SUBMIT] Invalid mirror ID: ${mirrorId}`);
                continue;
            }
            const [, mirrorSvcId, mirrorSlotName, mirrorIdxStr] = mirrorParts;
            if (mirrorSvcId !== serviceId) {
                console.warn(`[SUBMIT] Cross-service mirror not supported: ${mirrorSlotName}`);
                continue;
            }

            try {
                const mirrorSession = allSessionsForService.find(s => s.name === mirrorSlotName);
                if (!mirrorSession) {
                    console.warn(`[SUBMIT] Mirror session not found: ${mirrorSlotName}`);
                    continue;
                }
                const mirrorSegs = await base44.asServiceRole.entities.Segment.filter({ session_id: mirrorSession.id }, 'order');
                const mirrorIdx = parseInt(mirrorIdxStr);
                const mirrorTarget = mirrorSegs[mirrorIdx] || mirrorSegs.find(s => PLENARIA_TYPES.includes((s.segment_type || '').toLowerCase()));
                if (mirrorTarget) {
                    mirrorResolvedIds.set(mirrorId, String(mirrorTarget.id));
                    await base44.asServiceRole.entities.Segment.update(mirrorTarget.id, { ...commonFields, projection_notes: mirrorTarget.projection_notes || "" });
                    console.log(`[SUBMIT] Mirror entity updated: ${mirrorSlotName}`);
                } else {
                    console.warn(`[SUBMIT] No message-type segment found in mirror session: ${mirrorSlotName}`);
                }
            } catch (err) {
                console.warn(`[SUBMIT] Mirror update failed for ${mirrorSlotName}: ${err.message}`);
            }
        }

        // Create Version Record for audit trail — marked as pending.
        // Entity automation on SpeakerSubmissionVersion.create triggers
        // processNewSubmissionVersion for verse parsing + LLM, then marks as 'processed'.
        // Audit trail — primary submission
        console.log("[SUBMIT] Creating audit trail record (marked pending)...");
        await base44.asServiceRole.entities.SpeakerSubmissionVersion.create({
            segment_id: segment_id,
            // Pass already-resolved entity ID so processor skips re-resolution
            // (saves 3 queries: Session.filter + Segment.filter + find-by-type)
            resolved_segment_entity_id: String(targetSegmentEntity.id),
            content: content,
            title: title || "",
            presentation_url: presentation_url || "",
            notes_url: notes_url || "",
            content_is_slides_only: !!content_is_slides_only,
            parsed_data_snapshot: parsedData,
            submitted_at: new Date().toISOString(),
            source: 'weekly_service_form',
            processing_status: 'pending',
            // Browser/device metadata for audit trail
            ...(device_info ? { device_info } : {}),
        });

        // Audit trail — mirrored submissions (dynamic)
        // FIX (2026-03-08): Always create audit records even when entity resolution failed.
        // Without a SpeakerSubmissionVersion record, processNewSubmissionVersion and
        // processPendingSubmissions can never retry the mirror — the submission is silently lost.
        // The processor can resolve from the composite ID as a fallback.
        for (const mirrorId of effectiveMirrors) {
            const resolvedMirrorEntityId = mirrorResolvedIds.get(mirrorId);
            if (!resolvedMirrorEntityId) {
                console.warn(`[SUBMIT] Mirror entity unresolved: ${mirrorId} — creating audit record anyway for async resolution`);
            } else {
                console.log(`[SUBMIT] Creating audit trail for mirrored submission: ${mirrorId} (entity ${resolvedMirrorEntityId})`);
            }
            await base44.asServiceRole.entities.SpeakerSubmissionVersion.create({
                segment_id: mirrorId,
                // Pass resolved ID when available; processor falls back to composite resolution otherwise
                ...(resolvedMirrorEntityId ? { resolved_segment_entity_id: resolvedMirrorEntityId } : {}),
                content: content,
                title: title || "",
                presentation_url: presentation_url || "",
                notes_url: notes_url || "",
                content_is_slides_only: !!content_is_slides_only,
                parsed_data_snapshot: parsedData,
                submitted_at: new Date().toISOString(),
                source: 'weekly_service_form_mirror',
                processing_status: 'pending',
                // Same device_info for mirrored audit records
                ...(device_info ? { device_info } : {}),
            });
        }
        console.log("[SUBMIT] Audit record(s) created (pending async processing)");

        // Cache refresh happens after async processing completes
        // (via processNewSubmissionVersion entity automation)

        // Success
        const responsePayload = { success: true };
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
        console.error("[SUBMIT_ERROR]", error.message);
        return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }
});
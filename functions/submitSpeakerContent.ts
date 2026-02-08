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

    // Rate Limiting
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxAttempts = 5;

    if (!rateLimiter.has(clientIp)) {
        rateLimiter.set(clientIp, []);
    }
    const attempts = rateLimiter.get(clientIp).filter(t => now - t < windowMs);
    if (attempts.length >= maxAttempts) {
        return Response.json({ error: 'Too many requests' }, { status: 429, headers: corsHeaders });
    }
    attempts.push(now);
    rateLimiter.set(clientIp, attempts);

    try {
        const base44 = createClientFromRequest(req);
        
        const { segment_id, content, presentation_url, content_is_slides_only, idempotencyKey } = await req.json();

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

        // Verify segment exists
        const segment = await base44.asServiceRole.entities.Segment.get(segment_id);
        if (!segment) {
             if (idempotencyKey) {
                const existing = await base44.asServiceRole.entities.PublicFormIdempotency.filter({ idempotency_key: idempotencyKey });
                if (existing.length) await base44.asServiceRole.entities.PublicFormIdempotency.update(existing[0].id, { status: 'failed' });
             }
             return Response.json({ error: "Segment not found" }, { status: 404, headers: corsHeaders });
        }

        // 1. Create Version Record (Source of Truth)
        // This is the ONLY data write in this function to ensure speed and reliability.
        // The 'create' event on this entity will trigger the 'processNewSubmissionVersion' automation
        // which handles parsing and updating the actual Segment.
        try {
            await base44.asServiceRole.entities.SpeakerSubmissionVersion.create({
                segment_id: segment_id,
                content: content,
                presentation_url: presentation_url || "",
                content_is_slides_only: !!content_is_slides_only,
                submitted_at: new Date().toISOString(),
                source: 'public_form',
                processing_status: 'pending' 
            });
        } catch (verErr) {
            console.error("Failed to save submission version:", verErr);
            throw new Error("Failed to save submission");
        }

        // 2. Set Segment Status to Pending (Immediate Feedback for Admin)
        // We do this lightweight update so the admin sees "Pending" immediately, 
        // even if the automation takes a few seconds to process and mark it "Processed".
        // We DO NOT parse content here.
        await base44.asServiceRole.entities.Segment.update(segment_id, {
            submission_status: 'pending',
            // We temporarily update content here too so admins can see raw text if they open it before processing finishes
            submitted_content: content,
            presentation_url: presentation_url || "",
            content_is_slides_only: !!content_is_slides_only
        });

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
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
        
        const { segment_id, content, idempotencyKey } = await req.json();

        if (!segment_id || !content) {
            return Response.json({ error: "Missing segment_id or content" }, { status: 400, headers: corsHeaders });
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

        // Verify segment exists (and is Plenaria)
        const segment = await base44.asServiceRole.entities.Segment.get(segment_id);
        
        if (!segment) {
             // Mark idempotency failed if key used
             if (idempotencyKey) {
                const existing = await base44.asServiceRole.entities.PublicFormIdempotency.filter({ idempotency_key: idempotencyKey });
                if (existing.length) await base44.asServiceRole.entities.PublicFormIdempotency.update(existing[0].id, { status: 'failed' });
             }
             return Response.json({ error: "Segment not found" }, { status: 404, headers: corsHeaders });
        }

        // Update segment
        // Set submission_status to 'pending'
        await base44.asServiceRole.entities.Segment.update(segment_id, {
            submitted_content: content,
            submission_status: 'pending'
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
        return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

    // Rate Limiting
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    if (!rateLimiter.has(clientIp)) rateLimiter.set(clientIp, []);
    const attempts = rateLimiter.get(clientIp).filter(t => now - t < 60000);
    if (attempts.length >= 5) return Response.json({ error: 'Too many requests' }, { status: 429, headers: corsHeaders });
    attempts.push(now);
    rateLimiter.set(clientIp, attempts);

    try {
        const base44 = createClientFromRequest(req);
        const { segment_id, content, title, idempotencyKey } = await req.json();

        if (!segment_id || !content) {
            return Response.json({ error: "Missing required fields" }, { status: 400, headers: corsHeaders });
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

        // Check if ID is composite: weekly_service|{serviceId}|{timeSlot}|{segmentIdx}|message
        if (!segment_id.startsWith('weekly_service|')) {
            return Response.json({ error: "Invalid ID format for this endpoint" }, { status: 400, headers: corsHeaders });
        }

        const parts = segment_id.split('|');
        if (parts.length < 5) return Response.json({ error: "Invalid composite ID" }, { status: 400, headers: corsHeaders });
        
        const [_, serviceId, timeSlot, segmentIdxStr, type] = parts;
        const segmentIdx = parseInt(segmentIdxStr);

        // Fetch Service
        const service = await base44.asServiceRole.entities.Service.get(serviceId);
        if (!service) return Response.json({ error: "Service not found" }, { status: 404, headers: corsHeaders });

        const segment = service[timeSlot]?.[segmentIdx];
        
        // Strict Validation
        if (!segment) return Response.json({ error: "Segment not found in service" }, { status: 404, headers: corsHeaders });
        const segType = (segment.type || "").toLowerCase();
        const allowedTypes = ['message', 'plenaria', 'predica', 'mensaje'];
        
        if (!allowedTypes.includes(segType)) {
            return Response.json({ error: "Invalid segment type. Only messages accept submissions." }, { status: 400, headers: corsHeaders });
        }

        // Create Version Record
        await base44.asServiceRole.entities.SpeakerSubmissionVersion.create({
            segment_id: segment_id, // Store composite ID
            content: content,
            submitted_at: new Date().toISOString(),
            source: 'weekly_service_form',
            processing_status: 'pending'
        });

        // Update Service Entity (Read-Modify-Write)
        const currentArray = [...(service[timeSlot] || [])];
        if (currentArray[segmentIdx]) {
            const updatedSegment = {
                ...currentArray[segmentIdx],
                submitted_content: content,
                submission_status: 'pending'
            };

            // Update title if provided and not empty
            if (title && title.trim().length > 0) {
                updatedSegment.title = title.trim();
            }
            
            currentArray[segmentIdx] = updatedSegment;
            
            await base44.asServiceRole.entities.Service.update(serviceId, {
                [timeSlot]: currentArray
            });
        }

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
        return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }
});
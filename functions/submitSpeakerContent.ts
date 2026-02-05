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

        // Validate Input First
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

        // Verify segment exists (Handle both UUID and Composite ID)
        let isWeeklyService = false;
        let serviceId, timeSlot, segmentIndex;
        let segmentTitleSnapshot = "";
        let segmentPresenterSnapshot = "";

        if (segment_id.startsWith('service|')) {
            // Composite ID: service|{service_id}|{slot}|{index}
            isWeeklyService = true;
            const parts = segment_id.split('|');
            if (parts.length < 4) {
                return Response.json({ error: "Invalid service ID format" }, { status: 400, headers: corsHeaders });
            }
            serviceId = parts[1];
            timeSlot = parts[2];
            segmentIndex = parseInt(parts[3]);

            const service = await base44.asServiceRole.entities.Service.get(serviceId);
            if (!service) {
                return Response.json({ error: "Service not found" }, { status: 404, headers: corsHeaders });
            }
            
            const segment = service[timeSlot]?.[segmentIndex];
            if (!segment) {
                return Response.json({ error: "Segment not found in service" }, { status: 404, headers: corsHeaders });
            }

            // Snapshot metadata for Smart Relinking
            segmentTitleSnapshot = segment.title || segment.data?.title || "";
            segmentPresenterSnapshot = segment.data?.preacher || segment.data?.presenter || "";

        } else {
            // Standard Event Segment
            const segment = await base44.asServiceRole.entities.Segment.get(segment_id);
            if (!segment) {
                 if (idempotencyKey) {
                    const existing = await base44.asServiceRole.entities.PublicFormIdempotency.filter({ idempotency_key: idempotencyKey });
                    if (existing.length) await base44.asServiceRole.entities.PublicFormIdempotency.update(existing[0].id, { status: 'failed' });
                 }
                 return Response.json({ error: "Segment not found" }, { status: 404, headers: corsHeaders });
            }
            segmentTitleSnapshot = segment.title || "";
            segmentPresenterSnapshot = segment.presenter || "";
        }

        // 1. Create Version Record (Source of Truth)
        try {
            await base44.asServiceRole.entities.SpeakerSubmissionVersion.create({
                segment_id: segment_id,
                content: content,
                submitted_at: new Date().toISOString(),
                source: 'public_form',
                processing_status: 'pending',
                // Store metadata for hardening against reordering
                parsed_data_snapshot: { 
                    _meta: {
                        target_title: segmentTitleSnapshot,
                        target_presenter: segmentPresenterSnapshot
                    }
                }
            });
        } catch (verErr) {
            console.error("Failed to save submission version:", verErr);
            throw new Error("Failed to save submission");
        }

        // 2. Set Segment Status to Pending (Immediate Feedback for Admin)
        if (isWeeklyService) {
            // For Weekly Services, we must READ-MODIFY-WRITE the whole service document.
            // This is the quick update to show "Pending".
            const service = await base44.asServiceRole.entities.Service.get(serviceId);
            if (service && service[timeSlot] && service[timeSlot][segmentIndex]) {
                const segments = [...service[timeSlot]];
                
                // Safety check: Ensure we are updating the right segment by title/presenter snapshot
                // If the index was shifted in the last 100ms, we might hit the wrong one.
                // But for this initial "Pending" flag, strict locking isn't as critical as the final data write.
                // We will rely on the index here for speed, and let the Automation do the heavy "Smart Relink" check.
                
                segments[segmentIndex] = {
                    ...segments[segmentIndex],
                    data: {
                        ...segments[segmentIndex].data,
                        submission_status: 'pending',
                        submitted_content: content
                    }
                };
                
                await base44.asServiceRole.entities.Service.update(serviceId, {
                    [timeSlot]: segments
                });
            }
        } else {
            // Standard Event Segment Update
            await base44.asServiceRole.entities.Segment.update(segment_id, {
                submission_status: 'pending',
                submitted_content: content 
            });
        }

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
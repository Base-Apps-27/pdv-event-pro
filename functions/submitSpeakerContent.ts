import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Public endpoint to receive content.
        const { segment_id, content } = await req.json();

        if (!segment_id || !content) {
            return Response.json({ error: "Missing segment_id or content" }, { status: 400 });
        }

        // Verify segment exists (and is Plenaria)
        const segment = await base44.asServiceRole.entities.Segment.get(segment_id);
        
        if (!segment) {
            return Response.json({ error: "Segment not found" }, { status: 404 });
        }

        // Update segment
        // Set submission_status to 'pending'
        await base44.asServiceRole.entities.Segment.update(segment_id, {
            submitted_content: content,
            submission_status: 'pending'
        });

        return Response.json({ success: true });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});
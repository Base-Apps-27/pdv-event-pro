/**
 * generateCascadeProposal
 * 
 * DECISION: Live Director Architecture (2026-02-11)
 * 
 * Backend function that generates cascade timing proposals for the Live Director.
 * Called when a director finalizes a held segment and needs to reconcile downstream timing.
 * 
 * Uses InvokeLLM to generate intelligent rebalancing options, with a client-side
 * fallback "shift all" option always available without this call.
 * 
 * Input payload:
 * - session_id: string — the session being directed
 * - finalized_segment_id: string — the segment that just had its hold finalized
 * - actual_end_time: string — the actual end time (HH:MM) of the finalized segment
 * - remaining_segments: array — segments after the finalized one that need restacking
 *   Each: { id, title, segment_type, planned_start_time, planned_end_time, duration_min, live_status }
 * - session_planned_end_time: string — the session's planned end time (HH:MM)
 * - next_major_break_end_time: string — hard limit (session end + max 15 min into next major break) (HH:MM)
 * - cumulative_drift_min: number — current cumulative drift in minutes
 * - time_bank_min: number — current banked time in minutes (from early finishes)
 * - reconciled_segments: array — phantom segments already reconciled by director
 *   Each: { id, title, disposition: 'skip' | 'shift' | 'keep_compressed' }
 * 
 * Output:
 * - options: array of cascade proposals
 *   Each: { label, label_es, description, description_es, segments: [{id, new_start, new_end, new_duration, delta_min}], projected_session_end, exceeds_hard_limit: boolean, recovery_min }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const {
      session_id,
      finalized_segment_id,
      actual_end_time,
      remaining_segments,
      session_planned_end_time,
      next_major_break_end_time,
      cumulative_drift_min,
      time_bank_min,
      reconciled_segments,
    } = payload;

    // Validate required fields
    if (!session_id || !actual_end_time || !remaining_segments || !session_planned_end_time) {
      return Response.json({ error: 'Missing required fields: session_id, actual_end_time, remaining_segments, session_planned_end_time' }, { status: 400 });
    }

    // Filter out skipped segments — they don't participate in restacking
    const activeSegments = remaining_segments.filter(s => {
      const reconciled = reconciled_segments?.find(r => r.id === s.id);
      return !reconciled || reconciled.disposition !== 'skip';
    });

    // Build the flexibility context for the prompt
    // Import not possible in Deno backend; inline the scores
    const FLEX_SCORES = {
      Alabanza: 4, Bienvenida: 5, Ofrenda: 5, Plenaria: 2, Video: 0,
      Anuncio: 7, Dinámica: 6, Break: 10, TechOnly: 8, Oración: 4,
      Especial: 3, Cierre: 5, MC: 7, Ministración: 3, Receso: 10,
      Almuerzo: 8, Artes: 1, Breakout: 1, Panel: 3,
    };

    const segmentContext = activeSegments.map(s => {
      const flex = FLEX_SCORES[s.segment_type] || 5;
      const maxCompress = Math.floor((flex / 10) * s.duration_min);
      return `- ${s.title} (${s.segment_type}, ${s.duration_min}min, planned ${s.planned_start_time}-${s.planned_end_time}, flex=${flex}/10, max_compress=${maxCompress}min)`;
    }).join('\n');

    const reconciledContext = reconciled_segments?.length > 0
      ? reconciled_segments.map(r => `- ${r.title}: ${r.disposition}`).join('\n')
      : 'None';

    const netDrift = cumulative_drift_min - (time_bank_min || 0);

    const prompt = `You are a live event timing assistant. A segment has overrun and the director needs cascade options to rebalance the schedule.

CONTEXT:
- Current time (segment just ended): ${actual_end_time}
- Session planned end: ${session_planned_end_time}
- Hard limit (absolute latest): ${next_major_break_end_time || session_planned_end_time}
- Cumulative drift: +${cumulative_drift_min} min behind schedule
- Time banked from early finishes: ${time_bank_min || 0} min
- Net drift to recover: ${netDrift} min

RECONCILED SEGMENTS (director already decided):
${reconciledContext}

REMAINING ACTIVE SEGMENTS (in order, need new times starting from ${actual_end_time}):
${segmentContext}

RULES:
1. All segments must start from ${actual_end_time} or later, in order
2. Flexibility score 0 = cannot compress at all, 10 = can eliminate entirely
3. max_compress = (flex/10) * duration — never compress more than this
4. Session SHOULD end by ${session_planned_end_time}. Hard limit is ${next_major_break_end_time || session_planned_end_time}.
5. If recovery is mathematically impossible, say so honestly and show the least-bad option.
6. Generate exactly 3 options with different strategies.

Generate 3 cascade options. For each:
- Give it a short descriptive label (English) and label_es (Spanish)
- Brief description (English) and description_es (Spanish) explaining the strategy
- List each segment with: id, new_start_time (HH:MM), new_end_time (HH:MM), new_duration_min, delta_min (negative = shortened, 0 = unchanged, positive = extended)
- projected_session_end (HH:MM)
- exceeds_hard_limit (boolean)
- recovery_min (how many minutes recovered vs simple shift-all)

Strategy guidelines:
- Option 1: "Compress Breaks First" — take time from highest-flex segments (breaks, tech, MC, announcements)
- Option 2: "Distribute Evenly" — spread compression across all segments proportionally to their flexibility
- Option 3: "Smart Rebalance" — AI-determined optimal mix that minimizes impact on content-heavy segments while hitting session end time`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          options: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                label_es: { type: "string" },
                description: { type: "string" },
                description_es: { type: "string" },
                segments: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      new_start_time: { type: "string" },
                      new_end_time: { type: "string" },
                      new_duration_min: { type: "number" },
                      delta_min: { type: "number" }
                    }
                  }
                },
                projected_session_end: { type: "string" },
                exceeds_hard_limit: { type: "boolean" },
                recovery_min: { type: "number" }
              }
            }
          }
        }
      }
    });

    return Response.json({
      success: true,
      options: result.options || [],
      context: {
        actual_end_time,
        cumulative_drift_min,
        time_bank_min,
        net_drift_min: netDrift,
        session_planned_end_time,
        hard_limit: next_major_break_end_time || session_planned_end_time,
        active_segments_count: activeSegments.length,
        skipped_segments_count: (reconciled_segments || []).filter(r => r.disposition === 'skip').length,
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
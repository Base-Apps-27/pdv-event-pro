import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Shared utility function for backend modules.
 * Called via base44.functions.invoke('buildProgramSnapshot', { program, isEvent, dataEnv })
 */

// Retry wrapper for rate-limit resilience
async function withRetry(fn, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err?.status || err?.response?.status || 0;
      if (status === 429 && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
}

function groupBy(arr, keyFn) {
  const map = {};
  for (const item of arr) {
    const key = keyFn(item);
    if (!key) continue;
    if (!map[key]) map[key] = [];
    map[key].push(item);
  }
  return map;
}

function sortSessionsChronologically(sessions) {
  return [...sessions].sort((a, b) => {
    const aDate = a?.date || '';
    const bDate = b?.date || '';
    if (aDate !== bDate) {
      if (!aDate) return 1;
      if (!bDate) return -1;
      return aDate.localeCompare(bDate);
    }
    const aTime = a?.planned_start_time || '';
    const bTime = b?.planned_start_time || '';
    if (aTime !== bTime) {
      if (!aTime) return 1;
      if (!bTime) return -1;
      return aTime.localeCompare(bTime);
    }
    const aOrder = Number.isFinite(a?.order) ? a.order : Infinity;
    const bOrder = Number.isFinite(b?.order) ? b.order : Infinity;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (a?.name || '').localeCompare(b?.name || '');
  });
}

function computeSegmentTimes(segments, sessions) {
  if (!segments || segments.length === 0) return segments;

  const sessionMap = {};
  (sessions || []).forEach(s => { sessionMap[s.id] = s; });

  const segsBySession = {};
  segments.forEach(seg => {
    const sid = seg.session_id || '_none';
    if (!segsBySession[sid]) segsBySession[sid] = [];
    segsBySession[sid].push(seg);
  });

  Object.values(segsBySession).forEach(arr =>
    arr.sort((a, b) => (a.order || 0) - (b.order || 0))
  );

  const computedTimes = {};
  Object.entries(segsBySession).forEach(([sid, segs]) => {
    const session = sessionMap[sid] || {};
    const baseTime = session.planned_start_time || null;
    let curH = 0, curM = 0;
    if (baseTime) {
      const [h, m] = baseTime.split(':').map(Number);
      curH = h; curM = m;
    }

    segs.forEach(seg => {
      let segStart = seg.start_time || null;
      if (!segStart && baseTime) {
        segStart = `${String(curH).padStart(2, '0')}:${String(curM).padStart(2, '0')}`;
      }
      if (seg.start_time) {
        const [h, m] = seg.start_time.split(':').map(Number);
        curH = h; curM = m;
      }

      const dur = seg.duration_min || 0;
      const d = new Date(2000, 0, 1, curH, curM + dur);
      curH = d.getHours(); curM = d.getMinutes();

      let segEnd = seg.end_time || null;
      if (!segEnd && baseTime) {
        segEnd = `${String(curH).padStart(2, '0')}:${String(curM).padStart(2, '0')}`;
      }

      computedTimes[seg.id] = { start_time: segStart, end_time: segEnd };
    });
  });

  return segments.map(seg => {
    const times = computedTimes[seg.id];
    if (!times) return seg;
    return {
      ...seg,
      start_time: seg.start_time || times.start_time || null,
      end_time: seg.end_time || times.end_time || null,
    };
  });
}

function resolveChildrenAsSubAssignments(children) {
  if (!children || children.length === 0) return [];
  return children
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map(child => ({
      label: child.title || 'Sub-assignment',
      presenter: child.presenter || '',
      duration_min: child.duration_min || 5,
      segment_type: child.segment_type || 'Ministración',
    }));
}

function injectInterSessionBreak(segments, firstSessionId, secondSessionId, recesoNotes) {
  const firstSegs = segments.filter(s => s.session_id === firstSessionId).sort((a, b) => (a.order || 0) - (b.order || 0));
  const secondSegs = segments.filter(s => s.session_id === secondSessionId).sort((a, b) => (a.order || 0) - (b.order || 0));

  if (firstSegs.length === 0 || secondSegs.length === 0) return;

  const lastSeg = firstSegs[firstSegs.length - 1];
  const firstNextSeg = secondSegs[0];
  if (!lastSeg.end_time || !firstNextSeg.start_time || lastSeg.end_time >= firstNextSeg.start_time) return;

  const [endH, endM] = lastSeg.end_time.split(':').map(Number);
  const [startH, startM] = firstNextSeg.start_time.split(':').map(Number);
  const diffMin = (startH * 60 + startM) - (endH * 60 + endM);
  if (diffMin <= 0) return;

  const breakSegment = {
    id: 'generated-break-inter-service',
    start_time: lastSeg.end_time,
    end_time: firstNextSeg.start_time,
    duration_min: diffMin,
    title: 'Receso',
    segment_type: 'Receso',
    session_id: 'slot-break',
    description: recesoNotes || "",
    actions: [
      { id: 'break-reset', label: 'STAGE RESET', department: 'Stage & Decor', timing: 'after_start', offset_min: 0, order: 1 },
      { id: 'break-sound', label: 'AUDIO CHECK', department: 'Sound', timing: 'after_start', offset_min: 10, order: 2 },
    ],
  };

  const insertIdx = segments.findIndex(s => s.session_id === secondSessionId);
  if (insertIdx !== -1) {
    segments.splice(insertIdx, 0, breakSegment);
  } else {
    segments.push(breakSegment);
  }
}

function injectPreSessionActions(segments, sessions, preSessionDetails) {
  if (!sessions.length || !preSessionDetails.length) return;

  const detailsBySession = {};
  preSessionDetails.forEach(d => detailsBySession[d.session_id] = d);

  const segmentsBySession = groupBy(segments, seg => seg.session_id);

  Object.keys(segmentsBySession).forEach(sid => {
    const sessSegs = segmentsBySession[sid];
    sessSegs.sort((a, b) => (a.order || 0) - (b.order || 0));
    const firstSeg = sessSegs[0];
    const details = detailsBySession[sid];
    if (!firstSeg || !details) return;

    const getOffset = (segStart, targetTime) => {
      if (!segStart || !targetTime) return 0;
      const [h1, m1] = segStart.split(':').map(Number);
      const [h2, m2] = targetTime.split(':').map(Number);
      return (h1 * 60 + m1) - (h2 * 60 + m2);
    };

    const newActions = [];
    if (details.registration_desk_open_time) {
      newActions.push({ id: `pre-reg-${details.id}`, label: 'REGISTRATION OPEN', department: 'Hospitality', timing: 'before_start', offset_min: getOffset(firstSeg.start_time, details.registration_desk_open_time), order: -100 });
    }
    if (details.library_open_time) {
      newActions.push({ id: `pre-lib-${details.id}`, label: 'LIBRARY OPEN', department: 'Hospitality', timing: 'before_start', offset_min: getOffset(firstSeg.start_time, details.library_open_time), order: -99 });
    }
    if (details.facility_notes) {
      newActions.push({ id: `pre-fac-${details.id}`, label: 'FACILITY INSTRUCTIONS', department: 'Admin', timing: 'before_start', offset_min: 60, notes: details.facility_notes, order: -98 });
    }
    if (details.general_notes) {
      newActions.push({ id: `pre-gen-${details.id}`, label: 'GENERAL NOTES', department: 'Coordinador', timing: 'before_start', offset_min: 30, notes: details.general_notes, order: -97 });
    }

    if (newActions.length > 0) {
      if (!firstSeg.actions) firstSeg.actions = [];
      firstSeg.actions = [...firstSeg.actions, ...newActions];
    }
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { targetProgram, isEvent, dataEnv = 'prod' } = body;

    if (!targetProgram) {
      return Response.json({ error: "No target program provided" }, { status: 400 });
    }

    let segments = [];
    let sessions = [];
    let rooms = [];
    let eventDays = [];
    let preSessionDetails = [];
    let liveAdjustments = [];
    let streamBlocks = [];

    rooms = await withRetry(() => base44.asServiceRole.entities.Room.list(undefined, undefined, undefined, dataEnv));

    if (isEvent) {
      if (targetProgram.status !== 'confirmed' && targetProgram.status !== 'in_progress') {
        return Response.json({ program: { ...targetProgram, _isEvent: true }, sessions: [], segments: [], rooms, eventDays: [], preSessionDetails: [], liveAdjustments: [], streamBlocks: [] });
      }

      const [eventDaysResult, sessionsResult] = await Promise.all([
        withRetry(() => base44.asServiceRole.entities.EventDay.filter({ event_id: targetProgram.id }, undefined, undefined, undefined, dataEnv)),
        withRetry(() => base44.asServiceRole.entities.Session.filter({ event_id: targetProgram.id }, undefined, undefined, undefined, dataEnv)),
      ]);

      eventDays = eventDaysResult;
      sessions = sortSessionsChronologically(sessionsResult);

      if (sessions.length > 0) {
        const sessionIds = sessions.map(s => s.id);
        const BATCH = 10;
        let allSegments = [];
        let allPreSessionDetails = [];
        let allStreamBlocks = [];

        for (let i = 0; i < sessionIds.length; i += BATCH) {
          const batch = sessionIds.slice(i, i + BATCH);
          const batchResults = await Promise.all(batch.map(sid =>
            Promise.all([
              withRetry(() => base44.asServiceRole.entities.Segment.filter({ session_id: sid }, 'order', undefined, undefined, dataEnv)),
              withRetry(() => base44.asServiceRole.entities.PreSessionDetails.filter({ session_id: sid }, undefined, undefined, undefined, dataEnv)),
              withRetry(() => base44.asServiceRole.entities.StreamBlock.filter({ session_id: sid }, 'order', undefined, undefined, dataEnv)),
            ])
          ));
          for (const [segs, details, blocks] of batchResults) {
            allSegments.push(...segs);
            allPreSessionDetails.push(...details);
            allStreamBlocks.push(...blocks);
          }
        }

        preSessionDetails = allPreSessionDetails;
        streamBlocks = allStreamBlocks;

        const orderMap = new Map(sessions.map((s, i) => [s.id, i]));
        const sessionDateMap = new Map(sessions.map(s => [s.id, s.date]));

        const childByParent = groupBy(
          allSegments.filter(s => s.parent_segment_id),
          s => s.parent_segment_id
        );

        segments = allSegments
          .filter(seg => seg.show_in_general !== false && !seg.parent_segment_id)
          .map(seg => ({
            ...seg,
            date: sessionDateMap.get(seg.session_id) || null,
            _resolved_sub_assignments: resolveChildrenAsSubAssignments(childByParent[seg.id]),
          }))
          .sort((a, b) => {
            const aIdx = orderMap.get(a.session_id) ?? 999;
            const bIdx = orderMap.get(b.session_id) ?? 999;
            if (aIdx !== bIdx) return aIdx - bIdx;
            return (a.order || 0) - (b.order || 0);
          });

        segments = computeSegmentTimes(segments, sessions);

        if (segments.length > 0) {
          const segmentIds = segments.map(s => s.id).filter(Boolean);
          const allActions = [];
          for (let i = 0; i < segmentIds.length; i += BATCH) {
            const batch = segmentIds.slice(i, i + BATCH);
            const batchResults = await Promise.all(
              batch.map(segId => withRetry(() => base44.asServiceRole.entities.SegmentAction.filter({ segment_id: segId }, undefined, undefined, undefined, dataEnv)))
            );
            allActions.push(...batchResults.flat());
          }

          const actionsBySegment = groupBy(allActions, a => a.segment_id);
          segments = segments.map(s => {
            const linked = actionsBySegment[s.id] || [];
            const embedded = s.segment_actions || [];
            return { ...s, actions: [...embedded, ...linked].sort((a, b) => (a.order || 0) - (b.order || 0)) };
          });
        }
      }

      injectPreSessionActions(segments, sessions, preSessionDetails);

      return Response.json({
        event: targetProgram,
        program: { ...targetProgram, _isEvent: true },
        sessions,
        segments,
        rooms,
        eventDays,
        preSessionDetails,
        liveAdjustments: [],
        streamBlocks,
      });

    } else {
      liveAdjustments = await withRetry(() =>
        base44.asServiceRole.entities.LiveTimeAdjustment.filter({
          service_id: targetProgram.id,
          date: targetProgram.date,
        }, undefined, undefined, undefined, dataEnv)
      );

      const directSessions = await withRetry(() =>
        base44.asServiceRole.entities.Session.filter({ service_id: targetProgram.id }, undefined, undefined, undefined, dataEnv)
      );
      
      if (directSessions.length > 0) {
        sessions = sortSessionsChronologically(directSessions);
        const sessionIds = sessions.map(s => s.id);

        const BATCH = 10;
        let allSegs = [];
        let allPreSessionDetails = [];
        let allStreamBlocks = [];

        for (let i = 0; i < sessionIds.length; i += BATCH) {
          const batch = sessionIds.slice(i, i + BATCH);
          const batchResults = await Promise.all(batch.map(sid =>
            Promise.all([
              withRetry(() => base44.asServiceRole.entities.Segment.filter({ session_id: sid }, 'order', undefined, undefined, dataEnv)),
              withRetry(() => base44.asServiceRole.entities.PreSessionDetails.filter({ session_id: sid }, undefined, undefined, undefined, dataEnv)),
              withRetry(() => base44.asServiceRole.entities.StreamBlock.filter({ session_id: sid }, 'order', undefined, undefined, dataEnv)),
            ])
          ));
          for (const [segs, details, blocks] of batchResults) {
            allSegs.push(...segs);
            allPreSessionDetails.push(...details);
            allStreamBlocks.push(...blocks);
          }
        }

        streamBlocks = allStreamBlocks;
        preSessionDetails = allPreSessionDetails;

        if (allSegs.length > 0) {
          const svcChildByParent = groupBy(
            allSegs.filter(s => s.parent_segment_id),
            s => s.parent_segment_id
          );

          const sessionsMap = new Map(sessions.map((s, i) => [s.id, i]));
          segments = allSegs
            .filter(s => s.show_in_general !== false && !s.parent_segment_id)
            .map(seg => ({
              ...seg,
              _resolved_sub_assignments: resolveChildrenAsSubAssignments(svcChildByParent[seg.id]),
            }))
            .sort((a, b) => {
              const aIdx = sessionsMap.get(a.session_id) ?? 999;
              const bIdx = sessionsMap.get(b.session_id) ?? 999;
              if (aIdx !== bIdx) return aIdx - bIdx;
              return (a.order || 0) - (b.order || 0);
            });

          segments = computeSegmentTimes(segments, sessions);

          if (segments.length > 0) {
            const segmentIds = segments.map(s => s.id).filter(Boolean);
            const allActions = [];
            for (let i = 0; i < segmentIds.length; i += BATCH) {
              const batch = segmentIds.slice(i, i + BATCH);
              const batchResults = await Promise.all(
                batch.map(segId => withRetry(() => base44.asServiceRole.entities.SegmentAction.filter({ segment_id: segId }, undefined, undefined, undefined, dataEnv)))
              );
              allActions.push(...batchResults.flat());
            }

            const actionsBySegment = groupBy(allActions, a => a.segment_id);
            segments = segments.map(s => {
              const linked = actionsBySegment[s.id] || [];
              const embedded = s.segment_actions || [];
              return { ...s, actions: [...embedded, ...linked].sort((a, b) => (a.order || 0) - (b.order || 0)) };
            });
          }

          if (sessions.length >= 2) {
            const firstSlotName = sessions[0]?.name || "9:30am";
            const recesoNotes = targetProgram.receso_notes?.[firstSlotName] 
              || (targetProgram.receso_notes ? Object.values(targetProgram.receso_notes)[0] : "") 
              || "";
            injectInterSessionBreak(segments, sessions[0].id, sessions[1].id, recesoNotes);
          }

          injectPreSessionActions(segments, sessions, preSessionDetails);
        }
      }

      return Response.json({
        event: null,
        program: { ...targetProgram, _isEvent: false },
        sessions,
        segments,
        rooms,
        eventDays: [],
        preSessionDetails,
        liveAdjustments,
        streamBlocks,
      });
    }

  } catch (error) {
    console.error("Error in buildProgramSnapshot:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
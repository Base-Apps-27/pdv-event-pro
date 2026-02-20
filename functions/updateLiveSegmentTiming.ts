import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Live Director Timing Control Backend
 * 
 * DECISION: Live Director Architecture (2026-02-11)
 * 
 * Features:
 * - Single-user ownership: Only one person can be Live Director at a time
 * - Takeover mechanism with notification to previous director
 * - Action logging for undo functionality
 * - Undo last action capability
 * - Hold/Finalize flow for overrun reconciliation
 * - Cascade application from AI proposals
 * 
 * Actions:
 * - toggle_live_adjustment: Enable/disable live mode (requires confirmation on frontend)
 * - mark_ended_manual: Set segment end time and auto-start next
 * - set_time: Manually set a time field on a segment
 * - takeover: Take control from another Live Director
 * - undo_last: Undo the most recent action
 * - release_control: Release Live Director control without disabling
 * - place_hold: Place a hold on a segment (freezes downstream)
 * - finalize_hold: Finalize held segment with actual end, apply reconciliation + cascade
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
  }

  const base44 = createClientFromRequest(req);
  const { sessionId, segmentId, action, value, field, confirmTakeover, actual_end_time, reconciled_segments, cascade_option } = await req.json();

  try {
    const user = await base44.auth.me();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // Permission check: require admin role or 'manage_live_timing' permission
    const isAdmin = user.role === 'admin';
    const hasManagePermission = Array.isArray(user.custom_permissions) && user.custom_permissions.includes('manage_live_timing');
    if (!isAdmin && !hasManagePermission) {
      return new Response(JSON.stringify({ error: 'Forbidden: manage_live_timing required' }), { status: 403 });
    }

    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Missing sessionId' }), { status: 400 });
    }

    // Helper: Add minutes to HH:MM string
    const addMinutes = (timeStr, minutes) => {
      if (!timeStr) return null;
      const [h, m] = timeStr.split(':').map(Number);
      const date = new Date();
      date.setHours(h, m + minutes, 0, 0);
      const newH = String(date.getHours()).padStart(2, '0');
      const newM = String(date.getMinutes()).padStart(2, '0');
      return `${newH}:${newM}`;
    };

    // Helper: Get difference in minutes between two HH:MM strings
    const getDiffMinutes = (startStr, endStr) => {
      if (!startStr || !endStr) return 0;
      const [h1, m1] = startStr.split(':').map(Number);
      const [h2, m2] = endStr.split(':').map(Number);
      const d1 = new Date(); d1.setHours(h1, m1, 0, 0);
      const d2 = new Date(); d2.setHours(h2, m2, 0, 0);
      return Math.round((d2 - d1) / 60000);
    };

    // Helper: Log an action for undo capability
    const logAction = async (actionType, segmentId, previousState, newState, notes = null) => {
      await base44.asServiceRole.entities.LiveDirectorActionLog.create({
        session_id: sessionId,
        segment_id: segmentId || null,
        action_type: actionType,
        performed_by_user_id: user.id,
        performed_by_user_name: user.full_name || user.email,
        previous_state: previousState,
        new_state: newState,
        is_undone: false,
        notes: notes
      });
    };

    // Helper: Check if user is the current Live Director
    const checkOwnership = (session) => {
      if (!session.live_adjustment_enabled) return { isOwner: false, blocked: false };
      if (!session.live_director_user_id) return { isOwner: true, blocked: false }; // No one claimed it yet
      if (session.live_director_user_id === user.id) return { isOwner: true, blocked: false };
      return { 
        isOwner: false, 
        blocked: true, 
        currentDirector: {
          userId: session.live_director_user_id,
          userName: session.live_director_user_name,
          startedAt: session.live_director_started_at
        }
      };
    };

    // ============================================================
    // ACTION: toggle_live_adjustment
    // Enable/disable live mode. When enabling, claim ownership.
    // ============================================================
    if (action === 'toggle_live_adjustment') {
      const enabled = !!value;
      const [session] = await base44.asServiceRole.entities.Session.filter({ id: sessionId });
      
      if (enabled) {
        // Check if someone else is already the Live Director
        const ownership = checkOwnership(session);
        if (ownership.blocked && !confirmTakeover) {
          return new Response(JSON.stringify({ 
            error: 'blocked', 
            currentDirector: ownership.currentDirector,
            requiresConfirmation: true
          }), { status: 409 });
        }

        // Capture previous state for logging
        const previousState = {
          live_adjustment_enabled: session.live_adjustment_enabled,
          live_director_user_id: session.live_director_user_id,
          live_director_user_name: session.live_director_user_name
        };

        // Enable and claim ownership
        await base44.asServiceRole.entities.Session.update(sessionId, {
          live_adjustment_enabled: true,
          live_director_user_id: user.id,
          live_director_user_name: user.full_name || user.email,
          live_director_started_at: new Date().toISOString(),
          last_live_adjustment_time: new Date().toISOString()
        });

        await logAction('toggle_live_mode', null, previousState, {
          live_adjustment_enabled: true,
          live_director_user_id: user.id,
          live_director_user_name: user.full_name || user.email
        });

        return new Response(JSON.stringify({ 
          success: true, 
          enabled: true,
          director: { userId: user.id, userName: user.full_name || user.email }
        }), { status: 200 });

      } else {
        // ================================================================
        // DISABLING LIVE MODE
        // ================================================================
        // DECISION (2026-02-11): Preserve completed work, abort in-progress.
        //
        // Completed segments (have both actual_start_time AND actual_end_time,
        // or have finalized hold status) keep their timing data — that work
        // was confirmed by the director and is part of the audit trail.
        //
        // In-progress holds (live_hold_status === 'held' but NOT 'finalized')
        // are aborted: hold status is cleared so the segment returns to its
        // pre-hold state. The segment keeps its actual_start_time (it was
        // genuinely started) but the hold metadata is removed.
        //
        // Segments that only have actual_start_time but no actual_end_time
        // (i.e. the "currently active" segment at deactivation) keep their
        // actual_start_time — they truly did start at that time.
        // ================================================================

        const segments = await base44.asServiceRole.entities.Segment.filter({ session_id: sessionId }, 'order');

        // Snapshot for undo/audit
        const previousSegmentStates = segments.map(seg => ({
          id: seg.id,
          actual_start_time: seg.actual_start_time,
          actual_end_time: seg.actual_end_time,
          is_live_adjusted: seg.is_live_adjusted,
          live_hold_status: seg.live_hold_status,
          live_hold_placed_at: seg.live_hold_placed_at,
          live_hold_placed_by: seg.live_hold_placed_by,
          live_status: seg.live_status,
          timing_source: seg.timing_source
        }));

        const previousState = {
          live_adjustment_enabled: session.live_adjustment_enabled,
          live_director_user_id: session.live_director_user_id,
          live_director_user_name: session.live_director_user_name,
          segments: previousSegmentStates
        };

        // Categorize segments and build update operations
        const abortedHolds = [];
        const preservedSegments = [];
        const updateOps = [];

        for (const seg of segments) {
          const isCompleted = seg.actual_start_time && seg.actual_end_time;
          const isFinalizedHold = seg.live_hold_status === 'finalized';
          const isInProgressHold = seg.live_hold_status === 'held' && !isFinalizedHold;

          if (isInProgressHold) {
            // ABORT: Clear hold metadata. Keep actual_start_time (it really started).
            abortedHolds.push(seg.id);
            updateOps.push(
              base44.asServiceRole.entities.Segment.update(seg.id, {
                live_hold_status: null,
                live_hold_placed_at: null,
                live_hold_placed_by: null
              })
            );
          } else if (isCompleted || isFinalizedHold) {
            // PRESERVE: This segment's timing is confirmed director work.
            preservedSegments.push(seg.id);
            // No update needed — keep everything as-is.
          }
          // Pending segments (no actual times) need no changes either.
        }

        await Promise.all(updateOps);

        // Update session: release director ownership, disable live mode
        await base44.asServiceRole.entities.Session.update(sessionId, {
          live_adjustment_enabled: false,
          live_director_user_id: null,
          live_director_user_name: null,
          live_director_started_at: null,
          last_live_adjustment_time: new Date().toISOString()
        });

        await logAction('toggle_live_mode', null, previousState, {
          live_adjustment_enabled: false,
          aborted_holds: abortedHolds,
          preserved_segments: preservedSegments,
          segments_reset: false
        }, abortedHolds.length > 0 
          ? `Aborted ${abortedHolds.length} in-progress hold(s); preserved ${preservedSegments.length} completed segment(s)` 
          : `Preserved ${preservedSegments.length} completed segment(s)`
        );

        return new Response(JSON.stringify({ 
          success: true, 
          enabled: false,
          abortedHolds: abortedHolds.length,
          preservedSegments: preservedSegments.length
        }), { status: 200 });
      }
    }

    // ============================================================
    // ACTION: takeover
    // Take control from another Live Director
    // ============================================================
    if (action === 'takeover') {
      const [session] = await base44.asServiceRole.entities.Session.filter({ id: sessionId });
      
      if (!session.live_adjustment_enabled) {
        return new Response(JSON.stringify({ error: 'Live mode is not enabled' }), { status: 400 });
      }

      const previousDirector = {
        userId: session.live_director_user_id,
        userName: session.live_director_user_name
      };

      // Update ownership
      await base44.asServiceRole.entities.Session.update(sessionId, {
        live_director_user_id: user.id,
        live_director_user_name: user.full_name || user.email,
        live_director_started_at: new Date().toISOString(),
        last_live_adjustment_time: new Date().toISOString()
      });

      await logAction('takeover', null, previousDirector, {
        live_director_user_id: user.id,
        live_director_user_name: user.full_name || user.email
      }, `Takeover from ${previousDirector.userName}`);

      // H-BUG-2 FIX (2026-02-20): Send takeover notification scoped to EITHER event_id OR session_id.
      // Previously only sent when event_id existed, silently skipping service-based sessions.
      if (previousDirector.userId) {
        try {
          const eventId = session.event_id;
          const serviceId = session.service_id;
          // Build message payload — scope to event_id if present, otherwise session_id
          const msgPayload = {
            author_name: 'Sistema',
            author_email: 'system@pdv.app',
            content: `⚠️ ${user.full_name || user.email} ha tomado el control de Live Director.`,
            message_type: 'text',
            is_pinned: false
          };
          if (eventId) {
            msgPayload.event_id = eventId;
          } else if (serviceId) {
            // For service-based sessions, use session_id as the scoping field
            // LiveOperationsChat must filter by session_id for these messages
            msgPayload.session_id = sessionId;
          }
          // Only create the message if we have a valid scope
          if (eventId || serviceId) {
            await base44.asServiceRole.entities.LiveOperationsMessage.create(msgPayload);
          }
        } catch (e) {
          // Non-critical, continue even if notification fails
          console.error('Failed to send takeover notification:', e);
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        previousDirector,
        newDirector: { userId: user.id, userName: user.full_name || user.email }
      }), { status: 200 });
    }

    // ============================================================
    // ACTION: release_control
    // Release Live Director control without disabling live mode
    // ============================================================
    if (action === 'release_control') {
      const [session] = await base44.asServiceRole.entities.Session.filter({ id: sessionId });
      
      if (session.live_director_user_id !== user.id) {
        return new Response(JSON.stringify({ error: 'You are not the current Live Director' }), { status: 403 });
      }

      await base44.asServiceRole.entities.Session.update(sessionId, {
        live_director_user_id: null,
        live_director_user_name: null,
        live_director_started_at: null,
        last_live_adjustment_time: new Date().toISOString()
      });

      return new Response(JSON.stringify({ success: true, released: true }), { status: 200 });
    }

    // ============================================================
    // ACTION: undo_last
    // Undo the most recent action
    // ============================================================
    if (action === 'undo_last') {
      const [session] = await base44.asServiceRole.entities.Session.filter({ id: sessionId });
      
      // Verify ownership
      const ownership = checkOwnership(session);
      if (ownership.blocked) {
        return new Response(JSON.stringify({ 
          error: 'blocked', 
          currentDirector: ownership.currentDirector 
        }), { status: 409 });
      }

      // Find the most recent non-undone action (excluding toggles and takeovers)
      const logs = await base44.asServiceRole.entities.LiveDirectorActionLog.filter({ 
        session_id: sessionId,
        is_undone: false
      }, '-created_date');

      // Filter to undoable actions (mark_ended, set_time)
      const undoableLog = logs.find(l => ['mark_ended', 'set_time'].includes(l.action_type));

      if (!undoableLog) {
        return new Response(JSON.stringify({ error: 'No action to undo' }), { status: 404 });
      }

      // Restore previous state
      const prevState = undoableLog.previous_state;

      if (undoableLog.action_type === 'mark_ended' && undoableLog.segment_id) {
        // Restore segment and potentially next segment
        if (prevState.segment) {
          await base44.asServiceRole.entities.Segment.update(undoableLog.segment_id, {
            actual_start_time: prevState.segment.actual_start_time,
            actual_end_time: prevState.segment.actual_end_time,
            is_live_adjusted: prevState.segment.is_live_adjusted ?? false
          });
        }
        if (prevState.nextSegment && prevState.nextSegment.id) {
          await base44.asServiceRole.entities.Segment.update(prevState.nextSegment.id, {
            actual_start_time: prevState.nextSegment.actual_start_time,
            is_live_adjusted: prevState.nextSegment.is_live_adjusted ?? false
          });
        }
      } else if (undoableLog.action_type === 'set_time' && undoableLog.segment_id) {
        // Restore single segment field
        const field = prevState.field;
        const prevValue = prevState.previousValue;
        
        await base44.asServiceRole.entities.Segment.update(undoableLog.segment_id, {
          [field]: prevValue,
          is_live_adjusted: prevValue !== null
        });
      }

      // Mark the action as undone
      await base44.asServiceRole.entities.LiveDirectorActionLog.update(undoableLog.id, {
        is_undone: true,
        undone_at: new Date().toISOString(),
        undone_by_user_id: user.id
      });

      await base44.asServiceRole.entities.Session.update(sessionId, {
        last_live_adjustment_time: new Date().toISOString()
      });

      return new Response(JSON.stringify({ 
        success: true, 
        undoneAction: undoableLog.action_type,
        segmentId: undoableLog.segment_id
      }), { status: 200 });
    }

    // ============================================================
    // For all other actions, verify ownership first
    // ============================================================
    const [session] = await base44.asServiceRole.entities.Session.filter({ id: sessionId });
    const ownership = checkOwnership(session);
    
    if (ownership.blocked) {
      return new Response(JSON.stringify({ 
        error: 'blocked', 
        currentDirector: ownership.currentDirector 
      }), { status: 409 });
    }

    // ============================================================
    // ACTION: mark_ended_manual
    // Sets segment's actual_end_time to NOW, and auto-sets next segment's actual_start_time to NOW.
    // ============================================================
    if (action === 'mark_ended_manual') {
      if (!session || !session.live_adjustment_enabled) {
        return new Response(JSON.stringify({ error: 'Live adjustment not enabled for this session' }), { status: 400 });
      }

      let segments = await base44.asServiceRole.entities.Segment.filter({ session_id: sessionId }, 'order');
      segments = segments.sort((a, b) => (a.order || 0) - (b.order || 0));

      const targetIndex = segments.findIndex(s => s.id === segmentId);
      if (targetIndex === -1) {
        return new Response(JSON.stringify({ error: 'Segment not found' }), { status: 404 });
      }

      const targetSegment = segments[targetIndex];
      const nextSegment = targetIndex + 1 < segments.length ? segments[targetIndex + 1] : null;
      const now = new Date();
      const currentHHMM = value || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      // Capture previous state for undo
      const previousState = {
        segment: {
          actual_start_time: targetSegment.actual_start_time,
          actual_end_time: targetSegment.actual_end_time,
          is_live_adjusted: targetSegment.is_live_adjusted
        },
        nextSegment: nextSegment ? {
          id: nextSegment.id,
          actual_start_time: nextSegment.actual_start_time,
          is_live_adjusted: nextSegment.is_live_adjusted
        } : null
      };

      // Update current segment with end time
      await base44.asServiceRole.entities.Segment.update(targetSegment.id, {
        actual_end_time: currentHHMM,
        is_live_adjusted: true,
        actual_start_time: targetSegment.actual_start_time || targetSegment.start_time
      });

      // Auto-set next segment's start time to NOW (single cascade)
      if (nextSegment) {
        await base44.asServiceRole.entities.Segment.update(nextSegment.id, {
          actual_start_time: currentHHMM,
          is_live_adjusted: true
        });
      }

      await base44.asServiceRole.entities.Session.update(sessionId, {
        last_live_adjustment_time: new Date().toISOString()
      });

      await logAction('mark_ended', segmentId, previousState, {
        segment: { actual_end_time: currentHHMM },
        nextSegment: nextSegment ? { actual_start_time: currentHHMM } : null
      });

      // EXPLICIT CACHE REFRESH: Since Segment entity automation is disabled
      // (to prevent fan-out storms), we explicitly trigger ONE cache rebuild
      // after the batch completes. This is the single point of cache refresh
      // for all Live Director segment mutations.
      try {
        await base44.asServiceRole.functions.invoke('refreshActiveProgram', {
          trigger: 'live_director_mark_ended',
          changedEntityType: 'Segment',
          changedEntityId: segmentId
        });
      } catch (cacheErr) {
        // Non-critical: cache will self-heal via 2-min poll. Log but don't fail.
        console.error('[updateLiveSegmentTiming] Cache refresh failed (non-critical):', cacheErr.message);
      }

      return new Response(JSON.stringify({ success: true, endedAt: currentHHMM }), { status: 200 });
    }

    // ============================================================
    // ACTION: set_time
    // Manually set a single field (actual_start_time or actual_end_time) on a segment.
    // ============================================================
    if (action === 'set_time') {
      if (!session || !session.live_adjustment_enabled) {
        return new Response(JSON.stringify({ error: 'Live adjustment not enabled for this session' }), { status: 400 });
      }

      if (!field || !['actual_start_time', 'actual_end_time'].includes(field)) {
        return new Response(JSON.stringify({ error: 'set_time requires valid field parameter (actual_start_time or actual_end_time)' }), { status: 400 });
      }

      if (!segmentId) {
        return new Response(JSON.stringify({ error: 'set_time requires segmentId' }), { status: 400 });
      }

      // Get current segment state for undo
      const [currentSegment] = await base44.asServiceRole.entities.Segment.filter({ id: segmentId });
      const previousValue = currentSegment ? currentSegment[field] : null;

      // Update the single field on the segment
      await base44.asServiceRole.entities.Segment.update(segmentId, {
        [field]: value,
        is_live_adjusted: true
      });

      await base44.asServiceRole.entities.Session.update(sessionId, {
        last_live_adjustment_time: new Date().toISOString()
      });

      await logAction('set_time', segmentId, { field, previousValue }, { field, newValue: value });

      // EXPLICIT CACHE REFRESH (see mark_ended_manual for rationale)
      try {
        await base44.asServiceRole.functions.invoke('refreshActiveProgram', {
          trigger: 'live_director_set_time',
          changedEntityType: 'Segment',
          changedEntityId: segmentId
        });
      } catch (cacheErr) {
        console.error('[updateLiveSegmentTiming] Cache refresh failed (non-critical):', cacheErr.message);
      }

      return new Response(JSON.stringify({ success: true, field, value }), { status: 200 });
    }

    // ============================================================
    // LEGACY ACTIONS: mark_ended, adjust_start
    // DEPRECATED (2026-02-15 audit): These caused unbounded fan-out
    // (N segment updates → N entity automations → N×144 API calls).
    // Superseded by mark_ended_manual. Return error directing to new action.
    // Decision: "Remove legacy cascade to prevent fan-out storms"
    // ============================================================
    if (action === 'mark_ended' || action === 'adjust_start') {
      return new Response(JSON.stringify({ 
        error: 'Deprecated: Use mark_ended_manual or set_time instead',
        migration: 'Legacy cascade actions removed 2026-02-15 to prevent API fan-out storms'
      }), { status: 400 });
    }

    // ============================================================
    // ACTION: place_hold
    // Place a hold on a segment - freezes downstream advancement
    // ============================================================
    if (action === 'place_hold') {
      if (!session || !session.live_adjustment_enabled) {
        return new Response(JSON.stringify({ error: 'Live adjustment not enabled for this session' }), { status: 400 });
      }

      if (!segmentId) {
        return new Response(JSON.stringify({ error: 'place_hold requires segmentId' }), { status: 400 });
      }

      const [segment] = await base44.asServiceRole.entities.Segment.filter({ id: segmentId });
      if (!segment) {
        return new Response(JSON.stringify({ error: 'Segment not found' }), { status: 404 });
      }

      // Verify segment is currently active (has start but no end)
      if (!segment.actual_start_time || segment.actual_end_time) {
        return new Response(JSON.stringify({ error: 'Can only place hold on active segment' }), { status: 400 });
      }

      // Check if another segment is already held
      const heldSegments = await base44.asServiceRole.entities.Segment.filter({ 
        session_id: sessionId, 
        live_hold_status: 'held' 
      });
      if (heldSegments.length > 0) {
        return new Response(JSON.stringify({ 
          error: 'Another segment is already held', 
          heldSegmentId: heldSegments[0].id 
        }), { status: 400 });
      }

      const previousState = {
        live_hold_status: segment.live_hold_status,
        live_hold_placed_at: segment.live_hold_placed_at,
        live_hold_placed_by: segment.live_hold_placed_by
      };

      await base44.asServiceRole.entities.Segment.update(segmentId, {
        live_hold_status: 'held',
        live_hold_placed_at: new Date().toISOString(),
        live_hold_placed_by: user.id
      });

      await base44.asServiceRole.entities.Session.update(sessionId, {
        last_live_adjustment_time: new Date().toISOString()
      });

      await logAction('place_hold', segmentId, previousState, {
        live_hold_status: 'held',
        live_hold_placed_by: user.id
      });

      return new Response(JSON.stringify({ success: true, held: true }), { status: 200 });
    }

    // ============================================================
    // ACTION: finalize_hold
    // Finalize held segment with actual end time, apply reconciliation + cascade
    // ============================================================
    if (action === 'finalize_hold') {
      if (!session || !session.live_adjustment_enabled) {
        return new Response(JSON.stringify({ error: 'Live adjustment not enabled for this session' }), { status: 400 });
      }

      if (!segmentId) {
        return new Response(JSON.stringify({ error: 'finalize_hold requires segmentId' }), { status: 400 });
      }

      if (!actual_end_time || !actual_end_time.match(/^\d{2}:\d{2}$/)) {
        return new Response(JSON.stringify({ error: 'finalize_hold requires actual_end_time in HH:MM format' }), { status: 400 });
      }

      const [segment] = await base44.asServiceRole.entities.Segment.filter({ id: segmentId });
      if (!segment) {
        return new Response(JSON.stringify({ error: 'Segment not found' }), { status: 404 });
      }

      if (segment.live_hold_status !== 'held') {
        return new Response(JSON.stringify({ error: 'Segment is not currently held' }), { status: 400 });
      }

      // Calculate drift
      const plannedEnd = segment.end_time;
      const [ph, pm] = (plannedEnd || '00:00').split(':').map(Number);
      const [ah, am] = actual_end_time.split(':').map(Number);
      const drift = (ah * 60 + am) - (ph * 60 + pm);

      const previousState = {
        segment: {
          actual_end_time: segment.actual_end_time,
          live_hold_status: segment.live_hold_status,
          timing_source: segment.timing_source
        }
      };

      // Finalize the held segment
      await base44.asServiceRole.entities.Segment.update(segmentId, {
        actual_end_time: actual_end_time,
        live_hold_status: 'finalized',
        timing_source: 'director',
        is_live_adjusted: true
      });

      // Process reconciled segments (skip/shift)
      if (reconciled_segments && Array.isArray(reconciled_segments)) {
        for (const rec of reconciled_segments) {
          if (rec.disposition === 'skip') {
            await base44.asServiceRole.entities.Segment.update(rec.id, {
              live_status: 'skipped',
              timing_source: 'director'
            });
          } else if (rec.disposition === 'shift') {
            await base44.asServiceRole.entities.Segment.update(rec.id, {
              live_status: 'shifted',
              timing_source: 'director'
            });
          }
        }
      }

      // Apply cascade option
      let cascadeApplied = [];
      if (cascade_option && cascade_option.segments && Array.isArray(cascade_option.segments)) {
        for (const seg of cascade_option.segments) {
          await base44.asServiceRole.entities.Segment.update(seg.id, {
            actual_start_time: seg.new_start_time,
            actual_end_time: seg.new_end_time,
            is_live_adjusted: true,
            timing_source: 'director'
          });
          cascadeApplied.push(seg.id);
        }
      }

      await base44.asServiceRole.entities.Session.update(sessionId, {
        last_live_adjustment_time: new Date().toISOString()
      });

      await logAction('finalize_hold', segmentId, previousState, {
        actual_end_time,
        reconciled_count: reconciled_segments?.length || 0,
        cascade_label: cascade_option?.label,
        cascade_segments_affected: cascadeApplied,
        cumulative_drift_min: drift
      }, `Finalized with ${drift}m drift`);

      // EXPLICIT CACHE REFRESH after finalize_hold + cascade completes
      try {
        await base44.asServiceRole.functions.invoke('refreshActiveProgram', {
          trigger: 'live_director_finalize_hold',
          changedEntityType: 'Segment',
          changedEntityId: segmentId
        });
      } catch (cacheErr) {
        console.error('[updateLiveSegmentTiming] Cache refresh failed (non-critical):', cacheErr.message);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        finalized: true,
        drift,
        cascadeApplied: cascadeApplied.length
      }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
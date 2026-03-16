/**
 * checkUpcomingNotifications — Scheduled Push Notification Engine (v1.0)
 *
 * DECISION (2026-03-13): Replaces the broken browser-mounted NotificationTrigger
 * that caused midnight spam by firing on global Segment.subscribe() events.
 *
 * Architecture:
 *   - Runs every 5 minutes via scheduled automation
 *   - Checks today's sessions for start times within lead windows
 *   - Checks today's segment actions for upcoming timing
 *   - Uses a simple dedup mechanism (notification_sent_key on Session entity)
 *     to prevent repeat sends
 *   - Only sends during reasonable hours (6 AM – 11 PM ET)
 *
 * Notification types:
 *   1. session_starting — "{Event Name} — {Session Name} @ {Time}"
 *      Sent 15 minutes before session planned_start_time
 *   2. action_upcoming — "{Action Label} — {Segment Title} @ {Time}"
 *      Sent 10 minutes before computed action time
 *
 * PushEngage broadcast to all subscribers. Rich, self-explanatory content.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ─── Time Helpers (America/New_York) ─────────────────────────────
function getNowET() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

function getTodayStrET() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}

function parseHHMM(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return { hours: h, minutes: m, totalMinutes: h * 60 + m };
}

function formatTime12h(timeStr) {
  const parsed = parseHHMM(timeStr);
  if (!parsed) return timeStr || '';
  const { hours, minutes } = parsed;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  return `${h12}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

// ─── PushEngage Broadcast ────────────────────────────────────────
// FIX (2026-03-16): Header was 'api_key' (lowercase/underscore) — PushEngage
// requires 'Api-Key' (PascalCase/hyphen) per their official API docs.
// Wrong header caused PushEngage to fall back to generic site-name notifications
// instead of rendering the rich title/body we send.
async function broadcastPush(title, body, url) {
  const apiKey = Deno.env.get('PUSHENGAGE_API_KEY');
  if (!apiKey) {
    console.error('[NOTIF_ENGINE] PUSHENGAGE_API_KEY not set');
    return false;
  }

  const formBody = new URLSearchParams({
    notification_title: title,
    notification_message: body,
    notification_url: url || 'https://pdveventpro.com',
  }).toString();

  const res = await fetch('https://api.pushengage.com/apiv1/notifications', {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formBody,
  });

  const data = await res.json();
  console.log(`[NOTIF_ENGINE] PushEngage response: ${JSON.stringify(data)}`);
  return res.ok;
}


Deno.serve(async (req) => {
  // ═══ KILL SWITCH REMOVED (2026-03-16) ═══════════════════════════
  // Root causes identified and fixed:
  //   1. service-worker.js now uses importScripts(PE SDK) — PE owns push rendering
  //   2. PushEngageLoader registers /service-worker.js before PE SDK loads
  //   3. useNotificationPermissionPrompt re-enabled (was no-op)
  //   4. broadcastPush header fixed: 'Api-Key' (was 'api_key')
  // Rich notifications end-to-end should now work. Re-enabling engine.
  try {
    const base44 = createClientFromRequest(req);

    // ─── TIME GATE: Only send between 6 AM and 11 PM ET ──────────
    const nowET = getNowET();
    const currentHour = nowET.getHours();
    if (currentHour < 6 || currentHour >= 23) {
      console.log(`[NOTIF_ENGINE] Outside notification hours (${currentHour}h ET). Skipping.`);
      return Response.json({ skipped: true, reason: 'outside_hours', hour: currentHour });
    }

    const todayStr = getTodayStrET();
    const nowTotalMin = nowET.getHours() * 60 + nowET.getMinutes();
    console.log(`[NOTIF_ENGINE] Running at ${todayStr} ${nowET.getHours()}:${String(nowET.getMinutes()).padStart(2, '0')} ET (${nowTotalMin} min)`);

    // Lead times in minutes
    const SESSION_LEAD_MIN = 15;
    const ACTION_LEAD_MIN = 10;
    // Tolerance window: ± 3 minutes (since we run every 5 min)
    const TOLERANCE_MIN = 3;

    const sent = [];

    // ─── STEP 1: Find today's events ─────────────────────────────
    const allEvents = await base44.asServiceRole.entities.Event.list('-start_date');
    const todayEvents = allEvents.filter(e => {
      if (e.status === 'archived' || e.status === 'template') return false;
      if (!e.start_date) return false;
      return todayStr >= e.start_date && todayStr <= (e.end_date || e.start_date);
    });

    // ─── STEP 2: Find today's sessions (event + service) ─────────
    // Event sessions
    const eventIds = todayEvents.map(e => e.id);
    let todaySessions = [];

    for (const eventId of eventIds) {
      const sessions = await base44.asServiceRole.entities.Session.filter({
        event_id: eventId,
        date: todayStr,
      });
      todaySessions.push(...sessions.map(s => ({
        ...s,
        _eventName: todayEvents.find(e => e.id === eventId)?.name || '',
        _isEvent: true,
      })));
    }

    // Service sessions (today's weekly services)
    const todayServices = await base44.asServiceRole.entities.Service.filter({ date: todayStr });
    const activeServices = todayServices.filter(s => s.status === 'active');
    for (const service of activeServices) {
      const sessions = await base44.asServiceRole.entities.Session.filter({
        service_id: service.id,
      });
      todaySessions.push(...sessions.map(s => ({
        ...s,
        _eventName: service.name || '',
        _isEvent: false,
      })));
    }

    console.log(`[NOTIF_ENGINE] Found ${todaySessions.length} sessions today (${todayEvents.length} events, ${activeServices.length} services)`);

    // ─── STEP 3: Session "starting soon" notifications ───────────
    for (const session of todaySessions) {
      const startTime = parseHHMM(session.planned_start_time);
      if (!startTime) continue;

      const leadTarget = startTime.totalMinutes - SESSION_LEAD_MIN;
      const diff = leadTarget - nowTotalMin;

      // Within tolerance window?
      if (Math.abs(diff) <= TOLERANCE_MIN) {
        // Dedup: check if we already sent for this session today
        const dedupKey = `notif_session_${todayStr}`;
        if (session[dedupKey]) {
          console.log(`[NOTIF_ENGINE] Already sent session notification for ${session.name} (${session.id})`);
          continue;
        }

        const title = session._eventName || session.name;
        const body = `${session.name} — ${formatTime12h(session.planned_start_time)}`;

        console.log(`[NOTIF_ENGINE] Sending session_starting: "${title}" / "${body}"`);
        const ok = await broadcastPush(title, body);

        if (ok) {
          // Mark as sent on the session entity to prevent re-send
          await base44.asServiceRole.entities.Session.update(session.id, {
            [dedupKey]: new Date().toISOString(),
          });
          sent.push({ type: 'session_starting', session: session.name, title, body });
        }
      }
    }

    // ─── STEP 4: Action "upcoming" notifications ─────────────────
    // Fetch all segments for today's sessions
    const sessionIds = todaySessions.map(s => s.id);
    let allSegments = [];
    // Batch by session (no bulk filter by array available)
    for (const sid of sessionIds) {
      const segs = await base44.asServiceRole.entities.Segment.filter({ session_id: sid });
      allSegments.push(...segs);
    }

    for (const segment of allSegments) {
      const actions = segment.segment_actions || [];
      if (actions.length === 0) continue;

      const segStart = parseHHMM(segment.start_time);
      if (!segStart) continue;

      const session = todaySessions.find(s => s.id === segment.session_id);

      for (const action of actions) {
        if (!action.label) continue;

        // Compute action time
        let actionTotalMin = null;
        const offset = action.offset_min || 0;

        if (action.timing === 'before_start') {
          actionTotalMin = segStart.totalMinutes - offset;
        } else if (action.timing === 'after_start') {
          actionTotalMin = segStart.totalMinutes + offset;
        } else if (action.timing === 'absolute' && action.absolute_time) {
          const abs = parseHHMM(action.absolute_time);
          if (abs) actionTotalMin = abs.totalMinutes;
        } else {
          continue; // Skip before_end etc for now
        }

        if (actionTotalMin === null) continue;

        const leadTarget = actionTotalMin - ACTION_LEAD_MIN;
        const diff = leadTarget - nowTotalMin;

        if (Math.abs(diff) <= TOLERANCE_MIN) {
          // Dedup key based on segment + action label + date
          const dedupKey = `notif_action_${action.label.replace(/\s/g, '_')}_${todayStr}`;
          // We can't easily store per-action dedup on segment (would need array),
          // so we use the segment's custom field approach
          if (segment[dedupKey]) {
            continue;
          }

          // Format the action time for display
          const actionTimeStr = actionTotalMin !== null
            ? `${Math.floor(actionTotalMin / 60)}:${String(actionTotalMin % 60).padStart(2, '0')}`
            : '';

          const title = `⚠ ${action.label}`;
          const dept = action.department ? `[${action.department}] ` : '';
          const body = `${dept}${segment.title} — ${formatTime12h(actionTimeStr)}`;

          console.log(`[NOTIF_ENGINE] Sending action_upcoming: "${title}" / "${body}"`);
          const ok = await broadcastPush(title, body);

          if (ok) {
            await base44.asServiceRole.entities.Segment.update(segment.id, {
              [dedupKey]: new Date().toISOString(),
            });
            sent.push({ type: 'action_upcoming', action: action.label, segment: segment.title, title, body });
          }
        }
      }
    }

    console.log(`[NOTIF_ENGINE] Done. Sent ${sent.length} notifications.`);
    return Response.json({ success: true, sent, todaySessions: todaySessions.length });

  } catch (error) {
    console.error('[NOTIF_ENGINE] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
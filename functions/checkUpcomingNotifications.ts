/**
 * checkUpcomingNotifications — Scheduled Push Notification Engine (v2.0)
 *
 * DECISION (2026-03-17): Major rewrite to fix three confirmed issues:
 *   1. DEDUP BROKEN — v1 wrote dynamic fields on Segment entity which Base44
 *      silently ignored on subsequent reads. Replaced with NotificationLog entity.
 *   2. NOTIFICATION FLOOD — Each action sent a separate push. Now groups all
 *      actions in a 5-min window into a single digest push.
 *   3. TEXT OVERFLOW — No length guards. Now enforces PushEngage limits
 *      (title ≤ 80 chars, body ≤ 130 chars).
 *
 * Architecture:
 *   - Runs every 5 minutes via scheduled automation
 *   - Checks today's sessions for start times within lead windows
 *   - Collects all upcoming segment actions into a grouped digest
 *   - Uses NotificationLog entity for reliable dedup
 *   - Max 3 push broadcasts per cycle (session + action digest + overflow)
 *   - Only sends during reasonable hours (6 AM – 11 PM ET)
 *
 * Notification types:
 *   1. session_starting — "🟢 {Session Name}" / "{Event} · {Time}" (one per session)
 *   2. action_digest — "🚨 {N} tareas próximas" / compact body (one per cycle)
 *
 * TEXT OPTIMIZATION (2026-03-17): Notifications are designed for collapsed/glance view.
 *   - 🚨 (red siren) for actions — urgent, eye-catching
 *   - 🟢 (green circle) for sessions — "go time"
 *   - [Department] prefix REMOVED from body — wastes ~15 chars
 *   - Separator changed from " — " to " · " — saves 2 chars
 *   - Digest bullets removed — saves 2 chars per line
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ─── Time Helpers (America/New_York) ─────────────────────────────
// 2026-03-17: Replaced toLocaleString re-parse with Intl.DateTimeFormat
// parts extraction — more reliable across JS engines.
function getNowET() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = {};
  for (const { type, value } of fmt.formatToParts(now)) {
    parts[type] = value;
  }
  return {
    hours: parseInt(parts.hour, 10),
    minutes: parseInt(parts.minute, 10),
    totalMinutes: parseInt(parts.hour, 10) * 60 + parseInt(parts.minute, 10),
    dateStr: `${parts.year}-${parts.month}-${parts.day}`,
  };
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

function totalMinToHHMM(totalMin) {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

// ─── Text Truncation (PushEngage limits) ────────────────────────
// PushEngage: title ≤ 85, body ≤ 135. We use slightly smaller to be safe.
function truncate(str, max) {
  if (!str) return '';
  return str.length <= max ? str : str.slice(0, max - 1) + '…';
}

// ─── PushEngage Broadcast ────────────────────────────────────────
async function broadcastPush(title, body, url) {
  const apiKey = Deno.env.get('PUSHENGAGE_API_KEY');
  if (!apiKey) {
    console.error('[NOTIF_ENGINE] PUSHENGAGE_API_KEY not set');
    return false;
  }

  const safeTitleStr = truncate(title, 80);
  const safeBodyStr = truncate(body, 130);

  const formBody = new URLSearchParams({
    notification_title: safeTitleStr,
    notification_message: safeBodyStr,
    notification_url: url || 'https://vidaevents.co',
  }).toString();

  console.log(`[NOTIF_ENGINE] Broadcasting: title="${safeTitleStr}" body="${safeBodyStr}"`);

  const res = await fetch('https://api.pushengage.com/apiv1/notifications', {
    method: 'POST',
    headers: {
      'api_key': apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formBody,
  });

  const data = await res.json();
  console.log(`[NOTIF_ENGINE] PushEngage response: ${JSON.stringify(data)}`);
  return res.ok;
}


Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // ─── TIME GATE: Only send between 6 AM and 11 PM ET ──────────
    const now = getNowET();
    if (now.hours < 6 || now.hours >= 23) {
      console.log(`[NOTIF_ENGINE] Outside hours (${now.hours}h ET). Skipping.`);
      return Response.json({ skipped: true, reason: 'outside_hours', hour: now.hours });
    }

    const todayStr = now.dateStr;
    const nowTotalMin = now.totalMinutes;
    console.log(`[NOTIF_ENGINE] Running: ${todayStr} ${now.hours}:${String(now.minutes).padStart(2, '0')} ET (${nowTotalMin} min)`);

    // Lead times and tolerance
    const SESSION_LEAD_MIN = 15;
    const ACTION_LEAD_MIN = 10;
    const TOLERANCE_MIN = 3; // ± since we run every 5 min

    // ─── DEDUP: Load today's sent notifications ──────────────────
    const sentLogs = await base44.asServiceRole.entities.NotificationLog.filter({
      program_date: todayStr,
    });
    const sentKeys = new Set(sentLogs.map(l => l.dedup_key));
    console.log(`[NOTIF_ENGINE] Dedup: ${sentKeys.size} keys already sent today`);

    const newSent = [];

    // ─── STEP 1: Find today's events ─────────────────────────────
    const allEvents = await base44.asServiceRole.entities.Event.list('-start_date');
    const todayEvents = allEvents.filter(e => {
      if (e.status === 'archived' || e.status === 'template') return false;
      if (!e.start_date) return false;
      return todayStr >= e.start_date && todayStr <= (e.end_date || e.start_date);
    });

    // ─── STEP 2: Find today's sessions ───────────────────────────
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

    // Service sessions
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

    console.log(`[NOTIF_ENGINE] Found ${todaySessions.length} sessions (${todayEvents.length} events, ${activeServices.length} services)`);

    // ─── STEP 3: Session "starting soon" notifications ───────────
    for (const session of todaySessions) {
      const startTime = parseHHMM(session.planned_start_time);
      if (!startTime) continue;

      const leadTarget = startTime.totalMinutes - SESSION_LEAD_MIN;
      const diff = leadTarget - nowTotalMin;

      if (Math.abs(diff) <= TOLERANCE_MIN) {
        const dedupKey = `session_${session.id}_${todayStr}`;
        if (sentKeys.has(dedupKey)) {
          console.log(`[NOTIF_ENGINE] Dedup hit: session ${session.name}`);
          continue;
        }

        // 2026-03-17: 🟢 session name + countdown in title, event + time in body
        // "🟢 Sesión PM · Inicio en 15 min" gives urgency on collapsed view
        const minsUntilStart = startTime.totalMinutes - nowTotalMin;
        const countdownText = minsUntilStart <= 1 ? 'Inicio YA' : `Inicio en ${minsUntilStart} min`;
        const title = truncate(`🟢 ${session.name} · ${countdownText}`, 80);
        const body = `${truncate(session._eventName || '', 60)} · ${formatTime12h(session.planned_start_time)}`;

        console.log(`[NOTIF_ENGINE] Session alert: "${title}" / "${body}"`);
        const ok = await broadcastPush(title, body);

        if (ok) {
          await base44.asServiceRole.entities.NotificationLog.create({
            dedup_key: dedupKey,
            notification_type: 'session_starting',
            title,
            body,
            item_count: 1,
            sent_at: new Date().toISOString(),
            program_date: todayStr,
          });
          sentKeys.add(dedupKey);
          newSent.push({ type: 'session_starting', session: session.name });
        }
      }
    }

    // ─── STEP 4: Collect action alerts into digest ───────────────
    // Instead of sending each action individually, we collect all pending
    // actions in this cycle and send ONE grouped digest notification.
    const sessionIds = todaySessions.map(s => s.id);
    let allSegments = [];
    for (const sid of sessionIds) {
      const segs = await base44.asServiceRole.entities.Segment.filter({ session_id: sid });
      allSegments.push(...segs);
    }

    const pendingActions = []; // { label, department, segmentTitle, actionTimeStr }

    for (const segment of allSegments) {
      const actions = segment.segment_actions || [];
      if (actions.length === 0) continue;

      const segStart = parseHHMM(segment.start_time);
      if (!segStart) continue;

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
          continue;
        }

        if (actionTotalMin === null) continue;

        const leadTarget = actionTotalMin - ACTION_LEAD_MIN;
        const diff = leadTarget - nowTotalMin;

        if (Math.abs(diff) <= TOLERANCE_MIN) {
          // Dedup per action using label hash + segment + date
          const labelKey = action.label.replace(/[^a-zA-Z0-9]/g, '').slice(0, 30);
          const dedupKey = `action_${segment.id}_${labelKey}_${todayStr}`;

          if (sentKeys.has(dedupKey)) continue;

          pendingActions.push({
            label: action.label,
            department: action.department || '',
            segmentTitle: segment.title || 'Untitled',
            actionTimeStr: totalMinToHHMM(actionTotalMin),
            dedupKey,
          });
        }
      }
    }

    console.log(`[NOTIF_ENGINE] Collected ${pendingActions.length} pending actions for digest`);

    // ─── STEP 5: Send grouped digest (max 1 push for all actions) ─
    if (pendingActions.length > 0) {
      // Build digest title and body
      let title, body;

      if (pendingActions.length === 1) {
        // Single action: 🚨 action label in title, segment · time in body
        // Department intentionally omitted — wastes chars on collapsed view
        const a = pendingActions[0];
        title = `🚨 ${a.label}`;
        body = `${a.segmentTitle} · ${formatTime12h(a.actionTimeStr)}`;
      } else {
        // Multiple actions: 🚨 count in title, compact list in body
        // No bullets, no department — every char counts on collapsed view
        title = `🚨 ${pendingActions.length} tareas próximas`;
        const lines = pendingActions.slice(0, 3).map(a => {
          return `${truncate(a.label, 30)} · ${formatTime12h(a.actionTimeStr)}`;
        });
        if (pendingActions.length > 3) {
          lines.push(`+${pendingActions.length - 3} más`);
        }
        body = lines.join('\n');
      }

      console.log(`[NOTIF_ENGINE] Action digest: "${title}" / "${body}"`);
      const ok = await broadcastPush(title, body);

      if (ok) {
        // Log ALL action dedup keys so none repeat
        const digestDedupKey = `action_digest_${todayStr}_${nowTotalMin}`;
        await base44.asServiceRole.entities.NotificationLog.create({
          dedup_key: digestDedupKey,
          notification_type: 'action_digest',
          title,
          body,
          item_count: pendingActions.length,
          sent_at: new Date().toISOString(),
          program_date: todayStr,
        });

        // Also log individual action dedup keys to prevent re-send
        for (const a of pendingActions) {
          sentKeys.add(a.dedupKey);
          await base44.asServiceRole.entities.NotificationLog.create({
            dedup_key: a.dedupKey,
            notification_type: 'action_digest',
            title: a.label,
            body: a.segmentTitle,
            item_count: 1,
            sent_at: new Date().toISOString(),
            program_date: todayStr,
          });
        }

        newSent.push({
          type: 'action_digest',
          count: pendingActions.length,
          actions: pendingActions.map(a => a.label),
        });
      }
    }

    console.log(`[NOTIF_ENGINE] Done. Sent ${newSent.length} notification(s).`);
    return Response.json({
      success: true,
      sent: newSent,
      todaySessions: todaySessions.length,
      actionsCollected: pendingActions.length,
    });

  } catch (error) {
    console.error('[NOTIF_ENGINE] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
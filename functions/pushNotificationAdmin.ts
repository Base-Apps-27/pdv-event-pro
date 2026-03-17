/**
 * pushNotificationAdmin — Admin-only proxy for PushEngage REST API
 *
 * 2026-03-17: Created for the Push Notifications admin page.
 * Proxies three PushEngage API endpoints:
 *   1. GET notifications (history with stats)
 *   2. GET analytics/summary (subscriber counts, views, clicks)
 *   3. POST notifications (send custom broadcast)
 *
 * All actions are admin-only. The API key never leaves the server.
 *
 * PE API header: 'api_key' (lowercase/underscore) per official docs.
 * See Decision: "PushEngage rich notifications confirmed working" (2026-03-17).
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const PE_BASE = 'https://api.pushengage.com/apiv1';

// PE title max 85 chars, message max 135 chars (per PE API docs)
const TITLE_MAX = 85;
const MESSAGE_MAX = 135;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const apiKey = Deno.env.get('PUSHENGAGE_API_KEY');
    if (!apiKey) {
      return Response.json({ error: 'PUSHENGAGE_API_KEY not set' }, { status: 500 });
    }

    const payload = await req.json();
    const { action } = payload;

    // ─── Action: list — Fetch sent notification history ──────────
    if (action === 'list') {
      const { limit = 20, offset = 0 } = payload;
      const params = new URLSearchParams({
        status: 'sent',
        limit: String(limit),
        offset: String(offset),
      });

      const res = await fetch(`${PE_BASE}/notifications?${params}`, {
        headers: { 'api_key': apiKey },
      });
      const data = await res.json();
      return Response.json(data);
    }

    // ─── Action: analytics — Fetch summary analytics ─────────────
    if (action === 'analytics') {
      const { from, to } = payload;
      if (!from || !to) {
        return Response.json({ error: 'from and to dates required (YYYY-MM-DD)' }, { status: 400 });
      }
      const params = new URLSearchParams({ from, to, group_by: 'day' });

      const res = await fetch(`${PE_BASE}/analytics/summary?${params}`, {
        headers: { 'api_key': apiKey, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      return Response.json(data);
    }

    // ─── Action: send — Send custom broadcast ────────────────────
    if (action === 'send') {
      const { title, message } = payload;

      if (!title || !message) {
        return Response.json({ error: 'title and message are required' }, { status: 400 });
      }
      if (title.length > TITLE_MAX) {
        return Response.json({ error: `Title exceeds ${TITLE_MAX} characters` }, { status: 400 });
      }
      if (message.length > MESSAGE_MAX) {
        return Response.json({ error: `Message exceeds ${MESSAGE_MAX} characters` }, { status: 400 });
      }

      const formBody = new URLSearchParams({
        notification_title: title,
        notification_message: message,
        notification_url: 'https://pdveventpro.com',
      }).toString();

      console.log(`[PUSH_ADMIN] ${user.email} sending broadcast: "${title}" / "${message}"`);

      const res = await fetch(`${PE_BASE}/notifications`, {
        method: 'POST',
        headers: {
          'api_key': apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formBody,
      });

      const data = await res.json();
      console.log(`[PUSH_ADMIN] PE response: ${JSON.stringify(data)}`);

      return Response.json({
        success: data.success,
        notification_id: data.notification_id,
        sent_by: user.email,
        sent_at: new Date().toISOString(),
      });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });

  } catch (error) {
    console.error('[PUSH_ADMIN] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
/**
 * testPushBroadcast — One-shot test to verify PushEngage rich notifications.
 * 
 * 2026-03-16: Created to verify the Api-Key header fix.
 * Root cause: broadcastPush used 'api_key' (wrong) instead of 'Api-Key' (correct).
 * This function sends a single test notification and returns the PushEngage response.
 * 
 * Admin-only. Delete after verification.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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

    const title = '🔔 Test Rich Notification';
    const body = 'If you see this title and body, the fix works!';
    const url = 'https://pdveventpro.com';

    const formBody = new URLSearchParams({
      notification_title: title,
      notification_message: body,
      notification_url: url,
    }).toString();

    console.log(`[TEST_PUSH] Sending with Api-Key header...`);

    const res = await fetch('https://api.pushengage.com/apiv1/notifications', {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody,
    });

    const data = await res.json();
    console.log(`[TEST_PUSH] Response status: ${res.status}`);
    console.log(`[TEST_PUSH] Response body: ${JSON.stringify(data)}`);

    return Response.json({
      push_status: res.status,
      push_response: data,
      sent: { title, body, url },
    });

  } catch (error) {
    console.error('[TEST_PUSH] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
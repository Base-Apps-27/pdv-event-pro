/**
 * generateVAPIDKeys
 *
 * One-time utility to generate VAPID key pair for Web Push.
 * Uses web-push library to ensure keys are in the correct format.
 *
 * Usage:
 * 1. Call this function once (admin only)
 * 2. Copy the PUBLIC_KEY and PRIVATE_KEY from the response
 * 3. Set them in Settings -> Environment Variables:
 *    - VAPID_PUBLIC_KEY = (public key)
 *    - VAPID_PRIVATE_KEY = (private key)
 *    - VAPID_SUBJECT = mailto:admin@pdvevent.local
 * 4. Update the hardcoded publicKeyB64 in src/Layout.jsx to match VAPID_PUBLIC_KEY
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import webpush from 'npm:web-push@3.6.7';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Generate VAPID keys via web-push (correct format for sendNotification)
    const vapidKeys = webpush.generateVAPIDKeys();

    const output = {
      success: true,
      keys: {
        public: vapidKeys.publicKey,
        private: vapidKeys.privateKey,
        subject: 'mailto:admin@pdvevent.local',
      },
      instructions: [
        '1. Copy the keys above',
        '2. Go to Settings -> Environment Variables',
        '3. Set VAPID_PUBLIC_KEY = ' + vapidKeys.publicKey,
        '4. Set VAPID_PRIVATE_KEY = ' + vapidKeys.privateKey,
        '5. Set VAPID_SUBJECT = mailto:admin@pdvevent.local',
        '6. Update publicKeyB64 in src/Layout.jsx to match VAPID_PUBLIC_KEY',
        '7. Redeploy the app',
      ],
    };

    // SEC: Only log public key; private key is returned in JSON response (admin-gated)
    console.log('VAPID keys generated successfully');

    return Response.json(output);
  } catch (error) {
    console.error('[VAPID_ERROR]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

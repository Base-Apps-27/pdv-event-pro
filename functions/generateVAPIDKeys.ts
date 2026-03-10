/**
 * generateVAPIDKeys
 * 
 * One-time utility to generate VAPID key pair for Web Push.
 * 
 * Usage:
 * 1. Call this function once
 * 2. Copy the logged PUBLIC_KEY and PRIVATE_KEY
 * 3. Set them in Settings → Environment Variables
 * 4. Delete this function after keys are set
 * 
 * 2026-03-10: VAPID key generation for Web Push notifications
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Helper: Convert ArrayBuffer to base64url
function bufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only admins can generate keys
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Generate ECDSA P-256 key pair
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true, // exportable
      ['sign', 'verify']
    );

    // Export keys in raw format
    const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
    const privateKeyRaw = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

    // Convert to base64url
    const publicKeyB64 = bufferToBase64Url(publicKeyRaw);
    const privateKeyB64 = bufferToBase64Url(privateKeyRaw);

    const output = {
      success: true,
      keys: {
        public: publicKeyB64,
        private: privateKeyB64,
        subject: 'mailto:admin@pdvevent.local',
      },
      instructions: [
        '1. Copy the keys below',
        '2. Go to Settings → Environment Variables',
        '3. Create three new secrets:',
        '   - VAPID_PUBLIC_KEY = (public key)',
        '   - VAPID_PRIVATE_KEY = (private key)',
        '   - VAPID_SUBJECT = mailto:admin@pdvevent.local',
        '4. Delete this function after keys are saved',
        '5. Redeploy the app',
      ],
    };

    // Log to console (visible in function logs)
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║           VAPID KEYS GENERATED — SAVE IMMEDIATELY          ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('PUBLIC KEY (share with frontend):');
    console.log(publicKeyB64);
    console.log('');
    console.log('PRIVATE KEY (backend only — NEVER expose):');
    console.log(privateKeyB64);
    console.log('');
    console.log('SUBJECT:');
    console.log('mailto:admin@pdvevent.local');
    console.log('');
    console.log('INSTRUCTIONS:');
    output.instructions.forEach(line => console.log(line));
    console.log('');

    return Response.json(output);
  } catch (error) {
    console.error('[VAPID_ERROR]', error);
    return Response.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
});
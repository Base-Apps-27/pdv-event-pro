/**
 * uploadToDrive.js — Google Drive overflow upload for files >50MB.
 *
 * Decision (2026-03-06): Google Drive as overflow storage for large files.
 * Uses the googledrive app connector (drive.file scope).
 * Folder structure: PDV-Uploads / {eventName}-{year} /
 *
 * Architecture (2026-03-06 v2 — stall fix):
 *   Two-action design to avoid base64-in-JSON browser stalls:
 *
 *   action: "init"
 *     → Creates folder hierarchy on Drive
 *     → Initiates a resumable upload session via Google Drive API
 *     → Returns { uploadUrl } — the frontend PUTs raw bytes to this URL directly
 *
 *   action: "finalize"
 *     → Receives { driveFileId }
 *     → Sets "anyone with link" permission
 *     → Returns { url, driveFileId, fileName }
 *
 * Auth: Requires authenticated user (any role).
 * Connector: googledrive (app builder's account via OAuth).
 */

// 2026-04-12: SDK bumped from 0.8.20 → 0.8.25 for consistency across all backend functions.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const DRIVE_API = 'https://www.googleapis.com/';

/**
 * Find or create a folder by name under a parent folder.
 */
async function findOrCreateFolder(token, name, parentId) {
  let q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) q += ` and '${parentId}' in parents`;

  const res = await fetch(
    `${DRIVE_API}drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (data.files?.length > 0) return data.files[0].id;

  const meta = { name, mimeType: 'application/vnd.google-apps.folder' };
  if (parentId) meta.parents = [parentId];
  const cr = await fetch(`${DRIVE_API}drive/v3/files?fields=id`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(meta),
  });
  return (await cr.json()).id;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');

    // ─── INIT: create folder + resumable upload session ───
    if (action === 'init') {
      const { fileName, mimeType, fileSize, eventName, year } = body;
      if (!fileName) return Response.json({ error: 'Missing fileName' }, { status: 400 });

      const rootId = await findOrCreateFolder(accessToken, 'PDV-Uploads', null);
      const sub = (eventName && year) ? `${eventName}-${year}` : `General-${new Date().getFullYear()}`;
      const folderId = await findOrCreateFolder(accessToken, sub, rootId);

      const initRes = await fetch(`${DRIVE_API}upload/drive/v3/files?uploadType=resumable`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': mimeType || 'application/octet-stream',
          ...(fileSize ? { 'X-Upload-Content-Length': String(fileSize) } : {}),
        },
        body: JSON.stringify({ name: fileName, parents: [folderId] }),
      });

      if (!initRes.ok) {
        const t = await initRes.text();
        console.error('[uploadToDrive:init] error', initRes.status, t);
        return Response.json({ error: `Drive init failed: ${initRes.status}` }, { status: 502 });
      }

      const uploadUrl = initRes.headers.get('Location');
      console.log(`[uploadToDrive:init] session for ${fileName} (folder: ${sub})`);
      return Response.json({ uploadUrl });
    }

    // ─── FINALIZE: set public permission + return share URL ───
    if (action === 'finalize') {
      const { driveFileId, fileName } = body;
      if (!driveFileId) return Response.json({ error: 'Missing driveFileId' }, { status: 400 });

      await fetch(`${DRIVE_API}drive/v3/files/${driveFileId}/permissions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'reader', type: 'anyone' }),
      });

      const fr = await fetch(
        `${DRIVE_API}drive/v3/files/${driveFileId}?fields=webViewLink,name`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const fd = await fr.json();
      const url = fd.webViewLink || `https://drive.google.com/file/d/${driveFileId}/view?usp=sharing`;
      console.log(`[uploadToDrive:finalize] ${fileName || fd.name} → ${url}`);
      return Response.json({ url, driveFileId, fileName: fileName || fd.name });
    }

    return Response.json({ error: 'Unknown action. Use "init" or "finalize".' }, { status: 400 });
  } catch (error) {
    console.error('[uploadToDrive] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
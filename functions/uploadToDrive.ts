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
 *     → Returns { uploadUrl } — a resumable upload URI the frontend PUTs bytes to directly
 *
 *   action: "finalize"
 *     → Receives { driveFileId }
 *     → Sets "anyone with link" permission
 *     → Returns { url, driveFileId, fileName }
 *
 * Why: Reading a 200MB+ file into a base64 string freezes the browser tab.
 * The resumable upload lets the browser stream raw bytes directly to Google,
 * with real XMLHttpRequest progress events.
 *
 * Auth: Requires authenticated user (any role — public form users also upload).
 * Connector: googledrive (app builder's account via OAuth).
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const DRIVE_API = 'https://www.googleapis.com/';

/**
 * Find or create a folder by name under a parent folder.
 * Returns the folder ID.
 */
async function findOrCreateFolder(accessToken, folderName, parentId = null) {
  let q = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) q += ` and '${parentId}' in parents`;

  const searchRes = await fetch(
    `${DRIVE_API}drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  const metadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) metadata.parents = [parentId];

  const createRes = await fetch(`${DRIVE_API}drive/v3/files?fields=id`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });
  const createData = await createRes.json();
  return createData.id;
}

/**
 * Set "anyone with the link" can view on a file.
 */
async function makePublicViewable(accessToken, fileId) {
  await fetch(`${DRIVE_API}drive/v3/files/${fileId}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      role: 'reader',
      type: 'anyone',
    }),
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Auth check — any authenticated user can upload
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    // Get Google Drive access token via app connector
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');

    // ─── ACTION: INIT ───
    // Creates folder hierarchy and returns a resumable upload URL.
    // The frontend will PUT raw bytes directly to this URL.
    if (action === 'init') {
      const { fileName, mimeType, eventName, year, fileSize } = body;

      if (!fileName) {
        return Response.json({ error: 'Missing fileName' }, { status: 400 });
      }

      // Create folder hierarchy: PDV-Uploads / {EventName}-{Year}
      const rootFolderId = await findOrCreateFolder(accessToken, 'PDV-Uploads');
      const subFolderName = eventName && year
        ? `${eventName}-${year}`
        : `General-${new Date().getFullYear()}`;
      const subFolderId = await findOrCreateFolder(accessToken, subFolderName, rootFolderId);

      // Initiate resumable upload session
      // https://developers.google.com/drive/api/guides/manage-uploads#resumable
      const metadata = {
        name: fileName,
        parents: [subFolderId],
      };

      const initRes = await fetch(
        `${DRIVE_API}upload/drive/v3/files?uploadType=resumable`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': mimeType || 'application/octet-stream',
            ...(fileSize ? { 'X-Upload-Content-Length': String(fileSize) } : {}),
          },
          body: JSON.stringify(metadata),
        }
      );

      if (!initRes.ok) {
        const errText = await initRes.text();
        console.error('[uploadToDrive:init] Drive API error:', initRes.status, errText);
        return Response.json({ error: `Drive init failed: ${initRes.status}` }, { status: 502 });
      }

      // The resumable URI is in the Location header
      const uploadUrl = initRes.headers.get('Location');
      if (!uploadUrl) {
        console.error('[uploadToDrive:init] No Location header in resumable init response');
        return Response.json({ error: 'Drive did not return upload URL' }, { status: 502 });
      }

      console.log(`[uploadToDrive:init] Resumable session created for ${fileName} (folder: ${subFolderName})`);

      return Response.json({ uploadUrl, accessToken });
    }

    // ─── ACTION: FINALIZE ───
    // After frontend has uploaded bytes directly to Drive, call this to set permissions + get share URL.
    if (action === 'finalize') {
      const { driveFileId, fileName } = body;

      if (!driveFileId) {
        return Response.json({ error: 'Missing driveFileId' }, { status: 400 });
      }

      // Make file publicly viewable via link
      await makePublicViewable(accessToken, driveFileId);

      // Get shareable URL
      const fileRes = await fetch(
        `${DRIVE_API}drive/v3/files/${driveFileId}?fields=webViewLink,name`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const fileData = await fileRes.json();
      const shareableUrl = fileData.webViewLink || `https://drive.google.com/file/d/${driveFileId}/view?usp=sharing`;

      console.log(`[uploadToDrive:finalize] ${fileName || fileData.name} → ${shareableUrl}`);

      return Response.json({
        url: shareableUrl,
        driveFileId,
        fileName: fileName || fileData.name,
      });
    }

    // ─── LEGACY: base64 path (kept for backward compat, not recommended for large files) ───
    const { fileBase64, fileName, mimeType, eventName, year } = body;
    if (!fileBase64 || !fileName) {
      return Response.json({ error: 'Missing action or fileBase64+fileName' }, { status: 400 });
    }

    // Decode base64 to binary
    const binaryStr = atob(fileBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const rootFolderId = await findOrCreateFolder(accessToken, 'PDV-Uploads');
    const subFolderName = eventName && year
      ? `${eventName}-${year}`
      : `General-${new Date().getFullYear()}`;
    const subFolderId = await findOrCreateFolder(accessToken, subFolderName, rootFolderId);

    const metadata = { name: fileName, parents: [subFolderId] };
    const boundary = '---PDVUploadBoundary';
    const fileContentType = mimeType || 'application/octet-stream';
    const encoder = new TextEncoder();
    const pre = encoder.encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${fileContentType}\r\n\r\n`
    );
    const post = encoder.encode(`\r\n--${boundary}--`);
    const multipartBody = new Uint8Array(pre.length + bytes.length + post.length);
    multipartBody.set(pre, 0);
    multipartBody.set(bytes, pre.length);
    multipartBody.set(post, pre.length + bytes.length);

    const uploadRes = await fetch(
      `${DRIVE_API}upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,size`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error('[uploadToDrive] Drive API error:', uploadRes.status, errText);
      return Response.json({ error: `Drive upload failed: ${uploadRes.status}` }, { status: 502 });
    }

    const uploadData = await uploadRes.json();
    await makePublicViewable(accessToken, uploadData.id);

    const fileRes = await fetch(
      `${DRIVE_API}drive/v3/files/${uploadData.id}?fields=webViewLink,webContentLink`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const fileData = await fileRes.json();
    const shareableUrl = fileData.webViewLink || `https://drive.google.com/file/d/${uploadData.id}/view?usp=sharing`;

    console.log(`[uploadToDrive:legacy] ${fileName} → ${shareableUrl} (folder: ${subFolderName})`);

    return Response.json({
      url: shareableUrl,
      driveFileId: uploadData.id,
      fileName: uploadData.name,
    });
  } catch (error) {
    console.error('[uploadToDrive] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
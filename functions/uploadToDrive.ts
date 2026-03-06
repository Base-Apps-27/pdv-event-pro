/**
 * uploadToDrive.js — Google Drive overflow upload for files >50MB.
 *
 * Decision (2026-03-06): Google Drive as overflow storage for large files.
 * Uses the googledrive app connector (drive.file scope).
 * Folder structure: PDV-Uploads / {eventName}-{year} /
 *
 * Flow:
 *   1. Frontend sends file as multipart/form-data + eventName + year as query-like params in JSON
 *   2. This function uploads to Google Drive under an organized folder
 *   3. Sets file permission to "anyone with link can view"
 *   4. Returns the shareable webViewLink
 *
 * Auth: Requires authenticated user (any role — public form users also upload).
 * Connector: googledrive (app builder's account via OAuth).
 *
 * IMPORTANT: The file comes as raw bytes in the request body because Base44
 * functions receive the payload from base44.functions.invoke(). We accept
 * { file, fileName, eventName, year } where file is a base64-encoded string.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const DRIVE_API = 'https://www.googleapis.com/';

/**
 * Find or create a folder by name under a parent folder.
 * Returns the folder ID.
 */
async function findOrCreateFolder(accessToken, folderName, parentId = null) {
  // Search for existing folder
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

  // Create folder
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

    // Parse payload — expecting { fileBase64, fileName, mimeType, eventName, year }
    const body = await req.json();
    const { fileBase64, fileName, mimeType, eventName, year } = body;

    if (!fileBase64 || !fileName) {
      return Response.json({ error: 'Missing fileBase64 or fileName' }, { status: 400 });
    }

    // Get Google Drive access token via app connector
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');

    // Decode base64 to binary
    const binaryStr = atob(fileBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Create folder hierarchy: PDV-Uploads / {EventName}-{Year}
    const rootFolderId = await findOrCreateFolder(accessToken, 'PDV-Uploads');
    const subFolderName = eventName && year
      ? `${eventName}-${year}`
      : `General-${new Date().getFullYear()}`;
    const subFolderId = await findOrCreateFolder(accessToken, subFolderName, rootFolderId);

    // Upload file using multipart upload
    const metadata = {
      name: fileName,
      parents: [subFolderId],
    };

    const boundary = '---PDVUploadBoundary';
    const metadataPart = JSON.stringify(metadata);
    const fileContentType = mimeType || 'application/octet-stream';

    // Build multipart body manually
    const encoder = new TextEncoder();
    const pre = encoder.encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataPart}\r\n--${boundary}\r\nContent-Type: ${fileContentType}\r\n\r\n`
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

    // Make file publicly viewable via link
    await makePublicViewable(accessToken, uploadData.id);

    // Fetch the updated file to get the webViewLink (not always returned on upload)
    const fileRes = await fetch(
      `${DRIVE_API}drive/v3/files/${uploadData.id}?fields=webViewLink,webContentLink`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const fileData = await fileRes.json();

    const shareableUrl = fileData.webViewLink || `https://drive.google.com/file/d/${uploadData.id}/view?usp=sharing`;

    console.log(`[uploadToDrive] Success: ${fileName} → ${shareableUrl} (folder: ${subFolderName})`);

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
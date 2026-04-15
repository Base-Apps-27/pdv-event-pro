/**
 * fixNullAppRoles — One-time migration (2026-04-15)
 * 
 * CONTEXT: ~30 users have null/undefined app_role after the deny-by-default
 * permission change. They lost access because permissions.js requires a valid
 * app_role to resolve any permissions.
 *
 * BEHAVIOR: Queries all User records, filters those with null/empty app_role,
 * sets them to 'EventDayViewer' (lowest access tier that restores visibility).
 *
 * SAFETY: 
 *   - Only admin can invoke (auth check)
 *   - Only touches users where app_role is null/undefined/empty
 *   - Does NOT overwrite any existing role
 *   - Idempotent: running twice is safe (no-op on second run)
 *
 * CLEANUP: Remove this function after confirming all users are fixed.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Fetch all users via service role (admin can't list all via user-scoped)
    const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 200);

    // Filter users with null/undefined/empty app_role
    const needsFix = allUsers.filter(u => !u.app_role);

    if (needsFix.length === 0) {
      console.log('[fixNullAppRoles] No users with null app_role found. Migration complete or already done.');
      return Response.json({ fixed: 0, message: 'No users need fixing' });
    }

    console.log(`[fixNullAppRoles] Found ${needsFix.length} users with null app_role. Fixing...`);

    // Update each user to EventDayViewer
    let fixedCount = 0;
    for (const u of needsFix) {
      await base44.asServiceRole.entities.User.update(u.id, { app_role: 'EventDayViewer' });
      console.log(`[fixNullAppRoles] Fixed user: ${u.email} (id: ${u.id})`);
      fixedCount++;
    }

    console.log(`[fixNullAppRoles] Migration complete. Fixed ${fixedCount} users.`);
    return Response.json({ fixed: fixedCount, emails: needsFix.map(u => u.email) });
  } catch (error) {
    console.error('[fixNullAppRoles] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
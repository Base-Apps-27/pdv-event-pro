/**
 * sendChatNotification
 * 
 * Sends notifications for live chat messages.
 * 
 * For @Director pings (isDirectorPing=true):
 * - Finds the active Live Director for the context (event session)
 * - Sends email notification to the director
 * - Returns success status
 * 
 * For regular messages:
 * - Returns notification payload for browser Notification API
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// H-SEC-5 FIX (2026-02-20): Escape HTML to prevent injection in email body.
// senderName, contextName, messagePreview are user-controlled strings.
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      contextType, 
      contextId, 
      contextName, 
      messageId,
      senderName, 
      messagePreview, 
      isDirectorPing 
    } = await req.json();

    // For @Director pings, find and notify the active Live Director
    if (isDirectorPing && contextType === 'event') {
      // Find sessions for this event with an active Live Director
      const sessions = await base44.asServiceRole.entities.Session.filter({
        event_id: contextId,
        live_adjustment_enabled: true
      });

      const activeDirectorSessions = sessions.filter(s => s.live_director_user_id);
      
      if (activeDirectorSessions.length > 0) {
        // Get the first active director's email
        const directorUserId = activeDirectorSessions[0].live_director_user_id;
        const directorName = activeDirectorSessions[0].live_director_user_name || 'Director';
        
        // Find the user's email
        const users = await base44.asServiceRole.entities.User.filter({ id: directorUserId });
        const directorUser = users?.[0];
        
        if (directorUser?.email) {
          // Send email notification to the director
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: directorUser.email,
            subject: `🚨 @Director Ping - ${contextName || 'Event'}`,
            body: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(90deg, #DC2626 0%, #EF4444 100%); padding: 20px; border-radius: 8px 8px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 20px;">🚨 Priority @Director Ping</h1>
                </div>
                <div style="background: #FEF2F2; padding: 20px; border: 1px solid #FECACA; border-top: none; border-radius: 0 0 8px 8px;">
                  <p style="color: #991B1B; margin: 0 0 10px 0;"><strong>From:</strong> ${escapeHtml(senderName)}</p>
                  <p style="color: #991B1B; margin: 0 0 10px 0;"><strong>Context:</strong> ${escapeHtml(contextName) || 'Event'}</p>
                  <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #FECACA; margin-top: 15px;">
                    <p style="color: #1F2937; margin: 0;">${escapeHtml(messagePreview)}</p>
                  </div>
                  <p style="color: #6B7280; font-size: 12px; margin-top: 15px;">
                    This is a priority ping from the Live Operations Chat. Please check the Director Console.
                  </p>
                </div>
              </div>
            `
          });

          console.log(`Director ping email sent to ${directorUser.email} for event ${contextId}`);
        }
      }

      return Response.json({ 
        success: true, 
        directorNotified: activeDirectorSessions.length > 0,
        sessionsChecked: sessions.length
      });
    }

    // 2026-03-13: PushEngage broadcast for EVERY chat message REMOVED.
    // Root cause: every single chat message was broadcasting to ALL PushEngage
    // subscribers, causing notification spam for non-participants.
    // Chat notifications now use browser Notification API only (local, per-tab).
    // The LiveOperationsChat component already handles browser Notification via
    // showBrowserNotification() when a new message arrives via subscription.

    // Return payload for local browser Notification API
    const notificationPayload = {
      title: `💬 ${contextName || (contextType === 'event' ? 'Evento' : 'Servicio')}`,
      body: `${senderName}: ${messagePreview}`,
      tag: `live-chat-${contextId}`,
    };
    return Response.json({ success: true, notification: notificationPayload });

  } catch (error) {
    console.error('sendChatNotification error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
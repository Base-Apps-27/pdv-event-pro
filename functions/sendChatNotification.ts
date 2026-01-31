/**
 * sendChatNotification
 * 
 * Sends browser push notification data for live chat messages.
 * Called when a new message is created in LiveOperationsChat.
 * 
 * This function returns notification payload that the frontend
 * uses with the browser Notification API.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { context_type, context_id, context_name, sender_name, message, image_url } = await req.json();

    // Build notification payload
    const notificationPayload = {
      title: `💬 ${context_name || (context_type === 'event' ? 'Evento' : 'Servicio')}`,
      body: image_url 
        ? `${sender_name}: 📷 Imagen` 
        : `${sender_name}: ${message?.substring(0, 100)}${message?.length > 100 ? '...' : ''}`,
      icon: '/favicon.ico',
      tag: `live-chat-${context_id}`,
      renotify: true,
      data: {
        context_type,
        context_id,
        url: `/PublicProgramView?context=${context_type}&id=${context_id}`
      }
    };

    return Response.json({ 
      success: true, 
      notification: notificationPayload 
    });

  } catch (error) {
    console.error('sendChatNotification error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
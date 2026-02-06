import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, X, Send, Loader2, ImagePlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { hasPermission } from "@/components/utils/permissions";
import LiveChatMessage from "./LiveChatMessage";
import LiveChatPinnedSection from "./LiveChatPinnedSection";

/**
 * LiveOperationsChat Component
 * 
 * Floating chat panel for real-time team coordination during live events/services.
 * - Appears as FAB (floating action button) in bottom-right
 * - Opens overlay panel on click
 * - Scoped to current event or service+date
 * - Auto-archives: Events 24h after end_date, Services at midnight
 * 
 * @param {Object} currentUser - Current authenticated user
 * @param {string} contextType - 'event' or 'service'
 * @param {string} contextId - ID of the event or service
 * @param {string} contextDate - Date for archival (event end_date or service date)
 * @param {string} contextName - Display name of current context
 */
export default function LiveOperationsChat({
  currentUser,
  contextType,
  contextId,
  contextDate,
  contextName,
  // Controlled props
  isOpen: controlledIsOpen,
  onToggle: onControlledToggle,
  hideTrigger = false,
  onUnreadCountChange
}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  
  // Use controlled state if provided, otherwise internal
  const isControlled = typeof controlledIsOpen !== 'undefined';
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;
  const toggleOpen = () => {
    if (isControlled && onControlledToggle) {
      onControlledToggle(!isOpen);
    } else {
      setInternalIsOpen(!isOpen);
    }
  };

  const [messageText, setMessageText] = useState("");
  // CRITICAL: lastSeenMessageId drives the unread count.
  // Initialized to a sentinel value "LOADING" so that unreadCount returns 0
  // until we have actually hydrated the persisted value from the user profile.
  // This prevents the flash-of-all-unread bug on every page load.
  const LOADING_SENTINEL = "__LOADING__";
  const [lastSeenMessageId, setLastSeenMessageId] = useState(() => {
    const key = `${contextType}:${contextId}`;
    const persisted = currentUser?.chat_last_seen?.[key];
    // If currentUser is available synchronously, use persisted value (or null = truly no history).
    // If currentUser is not yet loaded, use sentinel to suppress false unread counts.
    return currentUser ? (persisted || null) : LOADING_SENTINEL;
  });
  const [isUploading, setIsUploading] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState('default');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();
  
  // Unique key for this chat context (used in chat_last_seen object)
  const chatContextKey = `${contextType}:${contextId}`;

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(perm => setNotificationPermission(perm));
      }
    }
  }, []);

  // Sync persisted last seen message ID from user profile when user data arrives or context changes.
  // This covers the case where currentUser loads asynchronously after mount.
  useEffect(() => {
    if (currentUser && chatContextKey) {
      const storedLastSeen = currentUser.chat_last_seen?.[chatContextKey];
      // Replace sentinel or update with persisted value.
      // If no persisted value exists (new user, new context), set null — this means
      // all existing messages will show as unread, which is correct first-time behavior.
      setLastSeenMessageId(storedLastSeen || null);
    }
  }, [currentUser, chatContextKey]);

  // Check if user can access chat
  // CRITICAL: Must check permission BEFORE any hooks that depend on contextId
  // to prevent unauthorized users from seeing/using the chat
  // hasPermission returns false for null/undefined user, so this is safe
  const canViewChat = hasPermission(currentUser, 'view_live_chat');
  const canPin = hasPermission(currentUser, 'manage_live_timing'); // Admins/managers can pin

  // Don't render anything if:
  // 1. User is not loaded yet (currentUser is null/undefined)
  // 2. User doesn't have view_live_chat permission
  // 3. No context ID provided
  // This check happens before any data fetching to prevent unauthorized access
  if (!currentUser || !canViewChat || !contextId) {
    return null;
  }

  // Fetch messages for current context
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['liveChat', contextType, contextId],
    queryFn: async () => {
      const result = await base44.entities.LiveOperationsMessage.filter({
        context_type: contextType,
        context_id: contextId,
        is_archived: false
      }, 'created_date');
      return result || [];
    },
    refetchInterval: 3000, // Poll every 3 seconds
    enabled: !!contextId
  });

  // Subscribe to real-time updates + browser notifications
  useEffect(() => {
    if (!contextId) return;

    const unsubscribe = base44.entities.LiveOperationsMessage.subscribe((event) => {
      if (event.data.context_type === contextType && event.data.context_id === contextId) {
        queryClient.invalidateQueries(['liveChat', contextType, contextId]);
        
        // Show browser notification if panel is closed and message is from someone else
        if (!isOpen && event.type === 'create' && event.data.created_by !== currentUser?.email) {
          showBrowserNotification(event.data);
        }
      }
    });

    return unsubscribe;
  }, [contextType, contextId, queryClient, isOpen, currentUser?.email]);

  // Browser notification helper
  // Uses created_by_name (full_name) when available, falls back to email extraction for older messages
  const showBrowserNotification = (msgData) => {
    if (notificationPermission !== 'granted' || !('Notification' in window)) return;
    
    // Prefer stored full_name, fallback to email extraction for backwards compatibility
    let displayName = msgData.created_by_name;
    if (!displayName && msgData.created_by) {
      const senderEmail = msgData.created_by;
      const senderName = senderEmail.split('@')[0].replace(/[._]/g, ' ').split(' ')[0];
      displayName = senderName.charAt(0).toUpperCase() + senderName.slice(1);
    }
    displayName = displayName || 'Usuario';
    
    const notification = new Notification(
      `💬 ${contextName || (contextType === 'event' ? 'Evento' : 'Servicio')}`,
      {
        body: msgData.image_url 
          ? `${displayName}: 📷 Imagen` 
          : `${displayName}: ${msgData.message?.substring(0, 80)}${msgData.message?.length > 80 ? '...' : ''}`,
        icon: '/favicon.ico',
        tag: `live-chat-${contextId}`,
        renotify: true
      }
    );
    
    notification.onclick = () => {
      window.focus();
      // Use controlled toggle if available, otherwise internal
      if (isControlled && onControlledToggle) {
        onControlledToggle(true);
      } else {
        setInternalIsOpen(true);
      }
      notification.close();
    };
  };

  // Scroll to bottom when messages change (if panel is open)
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Persist last seen message ID when opening panel (marks all as read)
  // Also updates whenever new messages arrive while panel is open
  const persistTimeoutRef = useRef(null);
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      const latestMessageId = messages[messages.length - 1]?.id;
      if (latestMessageId && latestMessageId !== lastSeenMessageId) {
        // Update local state immediately for responsive UI
        setLastSeenMessageId(latestMessageId);
        
        // Debounce persistence to avoid rapid updates when messages stream in
        if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
        persistTimeoutRef.current = setTimeout(() => {
          const updatedChatLastSeen = {
            ...(currentUser?.chat_last_seen || {}),
            [chatContextKey]: latestMessageId
          };
          base44.auth.updateMe({ chat_last_seen: updatedChatLastSeen }).catch(err => {
            console.error('Failed to persist chat_last_seen:', err);
          });
        }, 500);
      }
    }
    
    return () => {
      if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    };
  }, [isOpen, messages, lastSeenMessageId, chatContextKey, currentUser?.chat_last_seen]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Calculate unread count based on persisted last seen message ID.
  // CRITICAL: Only counts messages from OTHER users that arrived AFTER the last-seen marker.
  // Returns 0 while the persisted marker is still loading (LOADING_SENTINEL) to prevent
  // a flash of "all messages unread" on every page load.
  const unreadCount = React.useMemo(() => {
    // Panel open = everything is "read"
    if (isOpen) return 0;
    
    // Still loading persisted marker — suppress badge to avoid false positive
    if (lastSeenMessageId === LOADING_SENTINEL) return 0;
    
    const otherUsersMessages = messages.filter(m => m.created_by !== currentUser?.email);
    
    if (!lastSeenMessageId) {
      // No last seen = genuinely first time viewing this chat.
      // All messages from others are unread. This is correct for new users.
      return otherUsersMessages.length;
    }
    
    // Find the index of the last seen message in the full messages array
    const lastSeenIndex = messages.findIndex(m => m.id === lastSeenMessageId);
    if (lastSeenIndex === -1) {
      // Last seen message not found (possibly deleted/archived).
      // Fallback: compare created_date of last-seen vs messages.
      // Since we can't compare by date without the original record, treat as 0
      // to avoid showing incorrect counts. User will see correct count after
      // opening and closing the panel once (which re-persists the marker).
      return 0;
    }
    
    // Count messages from OTHER users that came AFTER the last seen message
    const messagesAfterLastSeen = messages.slice(lastSeenIndex + 1);
    const unreadFromOthers = messagesAfterLastSeen.filter(m => m.created_by !== currentUser?.email);
    return unreadFromOthers.length;
  }, [messages, lastSeenMessageId, isOpen, currentUser?.email]);

  // Report unread count changes to parent
  useEffect(() => {
    if (onUnreadCountChange) {
      onUnreadCountChange(unreadCount);
    }
  }, [unreadCount, onUnreadCountChange]);

  // Separate pinned and regular messages
  const pinnedMessages = messages.filter(m => m.is_pinned);
  const regularMessages = messages.filter(m => !m.is_pinned);

  // Send message mutation (supports text and/or image)
  // Stores user's full_name for display (denormalized for performance)
  const sendMessageMutation = useMutation({
    mutationFn: async ({ text, imageUrl }) => {
      return await base44.entities.LiveOperationsMessage.create({
        context_type: contextType,
        context_id: contextId,
        context_date: contextDate,
        message: text?.trim() || "",
        image_url: imageUrl || null,
        created_by_name: currentUser?.display_name || currentUser?.full_name || null,
        is_pinned: false,
        is_archived: false,
        reactions: []
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['liveChat', contextType, contextId]);
      setMessageText("");
    }
  });

  // Reaction mutation
  // Stores user's full_name with reaction for display
  const toggleReactionMutation = useMutation({
    mutationFn: async ({ messageId, reactionType, currentReactions }) => {
      const reactions = currentReactions || [];
      const existingIndex = reactions.findIndex(
        r => r.user_email === currentUser?.email && r.reaction_type === reactionType
      );
      
      let newReactions;
      if (existingIndex >= 0) {
        // Remove existing reaction
        newReactions = reactions.filter((_, i) => i !== existingIndex);
      } else {
        // Add new reaction (remove any other reaction from same user first)
        newReactions = reactions.filter(r => r.user_email !== currentUser?.email);
        newReactions.push({
          user_email: currentUser?.email,
          user_name: currentUser?.display_name || currentUser?.full_name || null,
          reaction_type: reactionType,
          timestamp: new Date().toISOString()
        });
      }
      
      return await base44.entities.LiveOperationsMessage.update(messageId, {
        reactions: newReactions
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['liveChat', contextType, contextId]);
    }
  });

  // Image upload handler
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Solo se permiten imágenes');
      return;
    }
    
    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen debe ser menor a 5MB');
      return;
    }
    
    setIsUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      // Send message with image
      await sendMessageMutation.mutateAsync({ text: messageText, imageUrl: file_url });
    } catch (error) {
      console.error('Image upload failed:', error);
      alert('Error al subir imagen');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Toggle pin mutation
  const togglePinMutation = useMutation({
    mutationFn: async (msg) => {
      const newPinned = !msg.is_pinned;
      return await base44.entities.LiveOperationsMessage.update(msg.id, {
        is_pinned: newPinned,
        pinned_by: newPinned ? currentUser.email : null,
        pinned_at: newPinned ? new Date().toISOString() : null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['liveChat', contextType, contextId]);
    }
  });

  const handleSend = () => {
    if (!messageText.trim()) return;
    sendMessageMutation.mutate({ text: messageText, imageUrl: null });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Action Button - Only rendered if hideTrigger is false */}
      {!hideTrigger && (
        <button
          onClick={toggleOpen}
          style={{ background: isOpen ? '#374151' : 'linear-gradient(90deg, #1F8A70 0%, #8DC63F 50%, #D7DF23 100%)' }}
          className="fixed bottom-20 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105"
          title={isOpen ? 'Cerrar chat' : 'Abrir chat de operaciones'}
        >
          {isOpen ? (
            <X className="w-6 h-6 text-white" />
          ) : (
            <>
              <MessageCircle className="w-6 h-6 text-white" />
              {unreadCount > 0 && (
                <span 
                  style={{ backgroundColor: '#EF4444' }}
                  className="absolute -top-1 -right-1 h-5 min-w-5 px-1.5 rounded-full text-white text-xs font-bold flex items-center justify-center"
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </>
          )}
        </button>
      )}

      {/* Chat Panel Overlay - Glass Control Deck aesthetic matching StickyOpsDeck */}
      {isOpen && (
        <div 
          className={`fixed right-2 sm:right-6 z-50 w-[380px] max-w-[calc(100vw-16px)] h-[520px] max-h-[calc(100vh-140px)] rounded-2xl shadow-[0_20px_80px_-8px_rgba(0,0,0,0.45),0_8px_30px_-4px_rgba(0,0,0,0.25)] border border-white/60 ring-1 ring-black/15 flex flex-col overflow-hidden transition-all duration-300 bg-slate-100/95 backdrop-blur-xl ${
            hideTrigger ? 'bottom-[70px]' : 'bottom-36'
          }`}
        >
          {/* Header - Slate shelf matching OpsDeck label shelf */}
          <div className="px-4 py-3.5 bg-slate-200/90 backdrop-blur-md border-b border-slate-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-white border-2 border-slate-200 flex items-center justify-center text-pdv-teal shadow-sm">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-base tracking-wide truncate text-slate-900">
                    Chat en Vivo
                  </h3>
                  <p className="text-xs truncate font-medium text-slate-500">
                    {contextName || (contextType === 'event' ? 'Evento' : 'Servicio')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-600 text-xs font-bold px-2.5 py-1 rounded-lg bg-white border border-slate-200 shadow-sm tabular-nums">
                  {messages.length}
                </span>
                <button
                  onClick={() => toggleOpen()}
                  className="w-8 h-8 rounded-full hover:bg-slate-300 flex items-center justify-center transition-colors text-slate-500 hover:text-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Pinned Messages Section */}
          <LiveChatPinnedSection
            pinnedMessages={pinnedMessages}
            canUnpin={canPin}
            onUnpin={(msg) => togglePinMutation.mutate(msg)}
          />

          {/* Messages Area - Frosted glass background matching OpsDeck expanded list */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50/90">
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : regularMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <div className="w-16 h-16 rounded-2xl bg-white border-2 border-slate-200 flex items-center justify-center mb-3 shadow-sm">
                  <MessageCircle className="w-8 h-8 text-slate-400" />
                </div>
                <p className="font-bold text-slate-600">Sin mensajes aún</p>
                <p className="text-sm mt-1 text-slate-400">Inicia la conversación del equipo</p>
              </div>
            ) : (
              <>
                {regularMessages.map((msg) => (
                  <LiveChatMessage
                    key={msg.id}
                    message={msg}
                    currentUserEmail={currentUser?.email}
                    canPin={canPin}
                    onTogglePin={(m) => togglePinMutation.mutate(m)}
                    onToggleReaction={(reactionType) => toggleReactionMutation.mutate({
                      messageId: msg.id,
                      reactionType,
                      currentReactions: msg.reactions
                    })}
                  />
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input Area - Matching OpsDeck bar aesthetic */}
          <div className="border-t border-slate-200 px-4 py-3 bg-slate-100/95 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              {/* Image upload button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || sendMessageMutation.isLoading}
                className="h-10 w-10 p-0 rounded-full flex items-center justify-center text-slate-500 bg-white border-2 border-slate-200 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50 shrink-0 shadow-sm"
                title="Subir imagen"
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ImagePlus className="w-5 h-5" />
                )}
              </button>
              <Input
                ref={inputRef}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Escribe un mensaje..."
                className="flex-1 text-sm h-10 rounded-full border-2 border-slate-200 bg-white px-4 focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300"
                disabled={sendMessageMutation.isLoading || isUploading}
              />
              <button
                onClick={handleSend}
                disabled={!messageText.trim() || sendMessageMutation.isLoading || isUploading}
                className="h-10 w-10 p-0 rounded-full shadow-sm flex items-center justify-center text-white bg-pdv-teal border-2 border-pdv-teal hover:brightness-110 disabled:opacity-50 shrink-0"
              >
                {sendMessageMutation.isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-[10px] mt-2 text-center text-slate-400">
              {contextType === 'event' 
                ? 'Se archiva 24h después del evento' 
                : 'Se archiva a medianoche'}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
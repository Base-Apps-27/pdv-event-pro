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
  const [lastSeenMessageId, setLastSeenMessageId] = useState(null); // Persisted last seen message ID
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

  // Load persisted last seen message ID from user profile on mount/context change
  useEffect(() => {
    if (currentUser?.chat_last_seen && chatContextKey) {
      const storedLastSeen = currentUser.chat_last_seen[chatContextKey];
      if (storedLastSeen) {
        setLastSeenMessageId(storedLastSeen);
      } else {
        setLastSeenMessageId(null);
      }
    }
  }, [currentUser?.chat_last_seen, chatContextKey]);

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
      setIsOpen(true);
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

  // Calculate unread count based on persisted last seen message ID
  // Only counts messages from OTHER users (excludes current user's own messages)
  const unreadCount = React.useMemo(() => {
    if (isOpen) return 0; // Panel open = everything is "read"
    
    const otherUsersMessages = messages.filter(m => m.created_by !== currentUser?.email);
    
    if (!lastSeenMessageId) {
      // No last seen = all messages from others are unread
      return otherUsersMessages.length;
    }
    
    // Find the index of the last seen message in the full messages array
    const lastSeenIndex = messages.findIndex(m => m.id === lastSeenMessageId);
    if (lastSeenIndex === -1) {
      // Last seen message not found (possibly deleted/archived) = treat all from others as unread
      return otherUsersMessages.length;
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

      {/* Chat Panel Overlay - Adjusted positioning if trigger is hidden (docked to bottom bar) */}
      {isOpen && (
        <div 
          style={{ backgroundColor: '#FFFFFF' }}
          className={`fixed right-2 sm:right-6 z-50 w-[380px] max-w-[calc(100vw-16px)] h-[520px] max-h-[calc(100vh-140px)] rounded-2xl shadow-2xl border border-gray-300 flex flex-col overflow-hidden transition-all duration-300 ${
            hideTrigger ? 'bottom-[70px]' : 'bottom-36'
          }`}
        >
          {/* Header - hardcoded gradient */}
          <div 
            style={{ background: 'linear-gradient(to right, #1F8A70, #8DC63F)' }}
            className="px-4 py-3.5 text-white"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div 
                  style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                >
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-base tracking-wide truncate">
                    Chat en Vivo
                  </h3>
                  <p style={{ color: 'rgba(255,255,255,0.9)' }} className="text-xs truncate font-medium">
                    {contextName || (contextType === 'event' ? 'Evento' : 'Servicio')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span 
                  style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}
                  className="text-white text-xs font-semibold px-2 py-0.5 rounded-md"
                >
                  {messages.length}
                </span>
                <button
                  onClick={() => setIsOpen(false)}
                  style={{ backgroundColor: 'transparent' }}
                  className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
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

          {/* Messages Area - hardcoded gradient background */}
          <div 
            style={{ background: 'linear-gradient(to bottom, #F9FAFB, #F3F4F6)' }}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
          >
            {isLoading ? (
              <div className="flex items-center justify-center h-full" style={{ color: '#9CA3AF' }}>
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : regularMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full" style={{ color: '#6B7280' }}>
                <div 
                  style={{ backgroundColor: '#E5E7EB' }}
                  className="w-16 h-16 rounded-full flex items-center justify-center mb-3"
                >
                  <MessageCircle className="w-8 h-8" style={{ color: '#9CA3AF' }} />
                </div>
                <p className="font-semibold" style={{ color: '#4B5563' }}>Sin mensajes aún</p>
                <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>Inicia la conversación del equipo</p>
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

          {/* Input Area - hardcoded background */}
          <div 
            style={{ backgroundColor: '#FFFFFF', borderTopColor: '#E5E7EB' }}
            className="border-t-2 px-4 py-3"
          >
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
                style={{ backgroundColor: '#F3F4F6' }}
                className="h-10 w-10 p-0 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 disabled:opacity-50 shrink-0"
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
                style={{ backgroundColor: '#FFFFFF' }}
                className="flex-1 text-sm h-10 rounded-full border-gray-300 px-4 focus:ring-2 focus:ring-pdv-teal focus:border-transparent"
                disabled={sendMessageMutation.isLoading || isUploading}
              />
              <button
                onClick={handleSend}
                disabled={!messageText.trim() || sendMessageMutation.isLoading || isUploading}
                style={{ backgroundColor: '#1F8A70' }}
                className="h-10 w-10 p-0 rounded-full shadow-md flex items-center justify-center text-white disabled:opacity-50 shrink-0"
              >
                {sendMessageMutation.isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-[10px] mt-2 text-center" style={{ color: '#9CA3AF' }}>
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
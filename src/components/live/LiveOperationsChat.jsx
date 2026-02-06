import React, { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, X, Send, Loader2, ImagePlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { hasPermission } from "@/components/utils/permissions";
import LiveChatMessage from "./LiveChatMessage";
import LiveChatPinnedSection from "./LiveChatPinnedSection";
import NewMessagesPill from "./NewMessagesPill";
import TypingIndicator from "./TypingIndicator";

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
  // PRIMARY source: localStorage (instant, survives refresh, always up-to-date).
  // SECONDARY source: currentUser.chat_last_seen (backup, may be stale after refresh
  // because base44.auth.me() can return a cached user object that doesn't reflect
  // the latest updateMe() calls).
  const LOCAL_STORAGE_PREFIX = "chat_last_seen:";
  // CRITICAL: useState initializer runs only on FIRST mount. If contextId changes
  // (e.g. user switches services), we need the useEffect below to re-sync.
  const [lastSeenMessageId, setLastSeenMessageId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState('default');
  // OPTIMISTIC UI: Local array of messages that haven't been confirmed by server yet.
  // Each has a temporary client-side `_optimisticId` and `_isOptimistic: true`.
  const [optimisticMessages, setOptimisticMessages] = useState([]);
  // SMART SCROLL: Track whether user has scrolled up to read history.
  // If true, we don't auto-scroll on new messages — show pill instead.
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);
  const [newMessagesBelowCount, setNewMessagesBelowCount] = useState(0);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
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

  // HYDRATE lastSeenMessageId on mount AND whenever context changes.
  // Priority: localStorage (primary) > user profile (fallback for cross-device).
  // Runs on every chatContextKey change to handle context switches correctly.
  useEffect(() => {
    const lsKey = `${LOCAL_STORAGE_PREFIX}${chatContextKey}`;
    const fromLS = localStorage.getItem(lsKey);
    console.log('[ChatHydrate] key:', lsKey, 'localStorage:', fromLS, 'profile:', currentUser?.chat_last_seen?.[chatContextKey]);
    if (fromLS) {
      setLastSeenMessageId(fromLS);
      return;
    }
    // Fallback: user profile (may be stale but better than null for cross-device)
    if (currentUser?.chat_last_seen?.[chatContextKey]) {
      const profileValue = currentUser.chat_last_seen[chatContextKey];
      setLastSeenMessageId(profileValue);
      localStorage.setItem(lsKey, profileValue); // cache for future
    } else {
      setLastSeenMessageId(null);
    }
  }, [chatContextKey, currentUser]);

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

  // Fetch messages for current context.
  // Polling at 15s as a FALLBACK — primary updates come from the real-time subscription.
  // This prevents the double-fetch storm of 3s polling + subscription invalidation.
  const { data: serverMessages = [], isLoading } = useQuery({
    queryKey: ['liveChat', contextType, contextId],
    queryFn: async () => {
      const result = await base44.entities.LiveOperationsMessage.filter({
        context_type: contextType,
        context_id: contextId,
        is_archived: false
      }, 'created_date');
      return result || [];
    },
    refetchInterval: 15000, // Fallback poll every 15s — subscription handles real-time
    enabled: !!contextId
  });

  // MERGE server messages with optimistic messages.
  // Remove optimistic messages once their server counterpart appears (matched by message text + created_by).
  const messages = React.useMemo(() => {
    if (optimisticMessages.length === 0) return serverMessages;
    
    // Filter out optimistic messages that are now confirmed on server
    const pendingOptimistic = optimisticMessages.filter(opt => {
      // If server has a message from the same user with same text created after the optimistic was sent, remove it
      return !serverMessages.some(
        sm => sm.created_by === currentUser?.email && sm.message === opt.message && sm.image_url === opt.image_url
      );
    });
    
    // Update optimistic state if some were confirmed (avoid infinite loop by checking length)
    if (pendingOptimistic.length !== optimisticMessages.length) {
      // Schedule state update for next tick to avoid updating during render
      setTimeout(() => setOptimisticMessages(pendingOptimistic), 0);
    }
    
    return [...serverMessages, ...pendingOptimistic];
  }, [serverMessages, optimisticMessages, currentUser?.email]);

  // Subscribe to real-time updates + browser notifications.
  // Subscription is the PRIMARY update mechanism; polling is fallback.
  useEffect(() => {
    if (!contextId) return;

    const unsubscribe = base44.entities.LiveOperationsMessage.subscribe((event) => {
      if (event.data?.context_type === contextType && event.data?.context_id === contextId) {
        // Only invalidate for events relevant to this chat context
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

  // SMART SCROLL: Detect if user has scrolled up in the messages container.
  // If near bottom (<80px from end), auto-scroll on new messages.
  // If scrolled up, show "new messages" pill instead of yanking scroll position.
  const handleMessagesScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 80;
    setIsUserScrolledUp(!isNearBottom);
    if (isNearBottom) setNewMessagesBelowCount(0);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    setIsUserScrolledUp(false);
    setNewMessagesBelowCount(0);
  }, []);

  // Auto-scroll to bottom when messages change, but ONLY if user is near bottom.
  // If user scrolled up to read history, increment the "new messages below" counter instead.
  const prevMessageCountRef = useRef(messages.length);
  useEffect(() => {
    if (!isOpen) return;
    
    const newCount = messages.length;
    const added = newCount - prevMessageCountRef.current;
    prevMessageCountRef.current = newCount;
    
    if (added > 0 && isUserScrolledUp) {
      // User is reading history — don't yank scroll, just increment pill counter
      setNewMessagesBelowCount(prev => prev + added);
    } else if (!isUserScrolledUp && messagesEndRef.current) {
      // User is at bottom — auto-scroll as expected
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isOpen, isUserScrolledUp]);

  // When panel first opens, always scroll to bottom
  useEffect(() => {
    if (isOpen) {
      setIsUserScrolledUp(false);
      setNewMessagesBelowCount(0);
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
        }
      }, 50);
    }
  }, [isOpen]);

  // Persist last seen message ID when opening panel (marks all as read)
  // Also updates whenever new messages arrive while panel is open.
  // PRIMARY: localStorage (instant, synchronous, survives refresh).
  // SECONDARY: user profile via updateMe (debounced backup for cross-device sync).
  const persistTimeoutRef = useRef(null);
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      // Filter out optimistic messages AND typing beacons — only persist real message IDs
      const confirmedMessages = messages.filter(m => !m._isOptimistic && m.message !== '__typing__');
      if (confirmedMessages.length === 0) return;
      
      const latestMessageId = confirmedMessages[confirmedMessages.length - 1]?.id;
      if (latestMessageId && latestMessageId !== lastSeenMessageId) {
        // 1. Update React state immediately
        setLastSeenMessageId(latestMessageId);
        
        // 2. Write to localStorage SYNCHRONOUSLY — this is the primary persistence
        //    that survives page refresh and is read on next mount.
        const lsKey = `${LOCAL_STORAGE_PREFIX}${chatContextKey}`;
        localStorage.setItem(lsKey, latestMessageId);
        
        // 3. Debounce user profile write as backup (for cross-device sync)
        if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
        persistTimeoutRef.current = setTimeout(() => {
          const updatedChatLastSeen = {
            ...(currentUser?.chat_last_seen || {}),
            [chatContextKey]: latestMessageId
          };
          base44.auth.updateMe({ chat_last_seen: updatedChatLastSeen }).catch(err => {
            console.error('Failed to persist chat_last_seen to profile:', err);
          });
        }, 2000); // Longer debounce — localStorage handles immediate persistence
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
  // localStorage is the primary source for lastSeenMessageId, so it's available synchronously
  // on mount — no loading sentinel needed.
  const unreadCount = React.useMemo(() => {
    // Panel open = everything is "read"
    if (isOpen) return 0;
    
    // Filter out typing beacons and optimistic messages from count
    const countableMessages = messages.filter(m => m.message !== '__typing__' && !m._isOptimistic);
    const otherUsersMessages = countableMessages.filter(m => m.created_by !== currentUser?.email);
    
    if (!lastSeenMessageId) {
      // No last seen = genuinely first time viewing this chat.
      // All messages from others are unread. This is correct for new users.
      console.log('[ChatUnread] No lastSeenMessageId, otherUsersMessages:', otherUsersMessages.length);
      return otherUsersMessages.length;
    }
    
    // Find the index of the last seen message in the countable messages array
    const lastSeenIndex = countableMessages.findIndex(m => m.id === lastSeenMessageId);
    if (lastSeenIndex === -1) {
      // Last seen message not found (possibly deleted/archived).
      // Treat as 0 to avoid showing incorrect counts.
      console.log('[ChatUnread] lastSeenMessageId not found in messages:', lastSeenMessageId, 'total messages:', countableMessages.length, 'message IDs:', countableMessages.map(m => m.id));
      return 0;
    }
    
    // Count messages from OTHER users that came AFTER the last seen message
    const messagesAfterLastSeen = countableMessages.slice(lastSeenIndex + 1);
    const unreadFromOthers = messagesAfterLastSeen.filter(m => m.created_by !== currentUser?.email);
    console.log('[ChatUnread] lastSeenId:', lastSeenMessageId, 'index:', lastSeenIndex, 'total:', countableMessages.length, 'unread:', unreadFromOthers.length);
    return unreadFromOthers.length;
  }, [messages, lastSeenMessageId, isOpen, currentUser?.email]);

  // Report unread count changes to parent
  useEffect(() => {
    if (onUnreadCountChange) {
      onUnreadCountChange(unreadCount);
    }
  }, [unreadCount, onUnreadCountChange]);

  // Separate pinned, regular, and filter out typing beacons from display
  const pinnedMessages = messages.filter(m => m.is_pinned && m.message !== '__typing__');
  const regularMessages = messages.filter(m => !m.is_pinned && m.message !== '__typing__');

  // ─── TYPING INDICATOR ─────────────────────────────────────────────
  // Uses a dedicated "typing beacon" record per chat context.
  // Updated via polling every 3s while user is actively typing.
  // Stale entries (>8s) are filtered out on the display side.
  const typingBeaconIdRef = useRef(null); // cache the beacon record ID
  const typingIntervalRef = useRef(null);
  const lastTypingBroadcastRef = useRef(0);
  const [remoteTypingUsers, setRemoteTypingUsers] = useState([]);

  // Fetch/create typing beacon record for this context.
  // We use a special LiveOperationsMessage record with message="__typing__" as sentinel.
  const { data: typingBeacon } = useQuery({
    queryKey: ['liveChat', 'typingBeacon', contextType, contextId],
    queryFn: async () => {
      const results = await base44.entities.LiveOperationsMessage.filter({
        context_type: contextType,
        context_id: contextId,
        message: '__typing__',
        is_archived: false
      });
      if (results && results.length > 0) {
        typingBeaconIdRef.current = results[0].id;
        return results[0];
      }
      // Create beacon record (one per context)
      const beacon = await base44.entities.LiveOperationsMessage.create({
        context_type: contextType,
        context_id: contextId,
        context_date: contextDate,
        message: '__typing__',
        is_archived: false,
        is_pinned: false,
        typing_users: [],
        reactions: []
      });
      typingBeaconIdRef.current = beacon.id;
      return beacon;
    },
    enabled: !!contextId && isOpen,
    staleTime: 60000, // beacon is long-lived, only need to fetch once
  });

  // Subscribe to typing beacon updates for real-time typing indicators
  useEffect(() => {
    if (!contextId || !isOpen) return;
    
    const unsubTyping = base44.entities.LiveOperationsMessage.subscribe((event) => {
      if (event.data?.message === '__typing__' &&
          event.data?.context_type === contextType &&
          event.data?.context_id === contextId) {
        setRemoteTypingUsers(event.data.typing_users || []);
      }
    });

    return () => {
      unsubTyping();
      // Clear own typing when panel closes
      if (typingBeaconIdRef.current) {
        clearTypingSelf();
      }
    };
  }, [contextId, isOpen, contextType]);

  // Broadcast typing status: add/refresh own entry in the beacon's typing_users array
  const broadcastTyping = useCallback(async () => {
    const now = Date.now();
    // Throttle: don't broadcast more than once per 2.5s
    if (now - lastTypingBroadcastRef.current < 2500) return;
    lastTypingBroadcastRef.current = now;

    if (!typingBeaconIdRef.current) return;
    const currentTyping = remoteTypingUsers.filter(u => u.email !== currentUser?.email);
    const updated = [
      ...currentTyping.filter(u => now - new Date(u.timestamp).getTime() < 8000), // prune stale
      { email: currentUser?.email, name: currentUser?.display_name || currentUser?.full_name || '', timestamp: new Date().toISOString() }
    ];
    base44.entities.LiveOperationsMessage.update(typingBeaconIdRef.current, {
      typing_users: updated
    }).catch(() => {}); // fire and forget
  }, [remoteTypingUsers, currentUser]);

  // Remove self from typing beacon
  const clearTypingSelf = useCallback(async () => {
    if (!typingBeaconIdRef.current) return;
    const cleaned = remoteTypingUsers.filter(u => u.email !== currentUser?.email);
    base44.entities.LiveOperationsMessage.update(typingBeaconIdRef.current, {
      typing_users: cleaned
    }).catch(() => {});
  }, [remoteTypingUsers, currentUser]);

  // Auto-clear typing indicator 4s after last keystroke
  const typingClearTimeoutRef = useRef(null);
  const handleTypingInput = useCallback((e) => {
    setMessageText(e.target.value);
    broadcastTyping();
    // Reset the "stop typing" timer
    if (typingClearTimeoutRef.current) clearTimeout(typingClearTimeoutRef.current);
    typingClearTimeoutRef.current = setTimeout(() => {
      clearTypingSelf();
    }, 4000);
  }, [broadcastTyping, clearTypingSelf]);

  // Cleanup typing timers on unmount
  useEffect(() => {
    return () => {
      if (typingClearTimeoutRef.current) clearTimeout(typingClearTimeoutRef.current);
    };
  }, []);

  // ─── EDIT MUTATION ─────────────────────────────────────────────────
  // Preserves original_message on first edit for audit trail.
  // Sets edited_at timestamp and "(editado)" indicator in UI.
  const editMessageMutation = useMutation({
    mutationFn: async ({ msg, newText }) => {
      const updatePayload = {
        message: newText,
        edited_at: new Date().toISOString()
      };
      // Only preserve original on FIRST edit
      if (!msg.original_message) {
        updatePayload.original_message = msg.message;
      }
      return await base44.entities.LiveOperationsMessage.update(msg.id, updatePayload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['liveChat', contextType, contextId]);
    }
  });

  // SOFT-DELETE mutation: Sets is_archived=true + deleted_by/deleted_at for audit trail.
  // Reuses is_archived so the existing filter (is_archived: false) automatically hides it.
  const deleteMessageMutation = useMutation({
    mutationFn: async (msg) => {
      return await base44.entities.LiveOperationsMessage.update(msg.id, {
        is_archived: true,
        deleted_by: currentUser.email,
        deleted_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['liveChat', contextType, contextId]);
    }
  });

  // Send message mutation with OPTIMISTIC UI.
  // Message appears instantly in the local list, then is confirmed/removed when server responds.
  const sendMessageMutation = useMutation({
    mutationFn: async ({ text, imageUrl, _optimisticId }) => {
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
    onSuccess: (data, variables) => {
      // Remove the optimistic message — server data will appear via query invalidation
      setOptimisticMessages(prev => prev.filter(m => m._optimisticId !== variables._optimisticId));
      queryClient.invalidateQueries(['liveChat', contextType, contextId]);
      setMessageText("");
    },
    onError: (error, variables) => {
      // Remove failed optimistic message so user sees it disappeared (they can resend)
      console.error('Failed to send message:', error);
      setOptimisticMessages(prev => prev.filter(m => m._optimisticId !== variables._optimisticId));
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
    const text = messageText;
    const optimisticId = `opt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    
    // OPTIMISTIC: Insert a local placeholder message immediately
    const optimisticMsg = {
      _optimisticId: optimisticId,
      _isOptimistic: true,
      id: optimisticId,
      message: text.trim(),
      image_url: null,
      created_by: currentUser?.email,
      created_by_name: currentUser?.display_name || currentUser?.full_name || null,
      created_date: new Date().toISOString(),
      is_pinned: false,
      reactions: []
    };
    setOptimisticMessages(prev => [...prev, optimisticMsg]);
    setMessageText(""); // Clear input immediately for responsiveness
    
    // Clear typing indicator since we just sent
    clearTypingSelf();
    if (typingClearTimeoutRef.current) clearTimeout(typingClearTimeoutRef.current);
    
    // Scroll to bottom since user just sent a message
    setIsUserScrolledUp(false);
    setNewMessagesBelowCount(0);
    setTimeout(() => {
      if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }, 50);
    
    // Fire server mutation
    sendMessageMutation.mutate({ text, imageUrl: null, _optimisticId: optimisticId });
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
                  {regularMessages.length + pinnedMessages.length}
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
          <div 
            ref={messagesContainerRef}
            onScroll={handleMessagesScroll}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50/90 relative"
          >
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
                    isOptimistic={!!msg._isOptimistic}
                    onTogglePin={(m) => togglePinMutation.mutate(m)}
                    onToggleReaction={(reactionType) => toggleReactionMutation.mutate({
                      messageId: msg.id,
                      reactionType,
                      currentReactions: msg.reactions
                    })}
                    onEdit={(m, newText) => {
                      editMessageMutation.mutate({ msg: m, newText });
                    }}
                    onDelete={(m) => {
                      if (window.confirm('¿Eliminar este mensaje?')) {
                        deleteMessageMutation.mutate(m);
                      }
                    }}
                  />
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
            {/* "New messages" pill — shown when user scrolled up and new messages arrive below */}
            <NewMessagesPill count={newMessagesBelowCount} onClick={scrollToBottom} />
          </div>

          {/* Typing Indicator - above input */}
          <TypingIndicator typingUsers={remoteTypingUsers} currentUserEmail={currentUser?.email} />

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
                onChange={handleTypingInput}
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
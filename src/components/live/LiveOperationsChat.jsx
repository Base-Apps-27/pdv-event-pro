import React, { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, X, Send, Loader2, ImagePlus, Radio } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { hasPermission } from "@/components/utils/permissions";
import LiveChatMessage from "./LiveChatMessage";
import LiveChatPinnedSection from "./LiveChatPinnedSection";
import NewMessagesPill from "./NewMessagesPill";
import TypingIndicator from "./TypingIndicator";
import { safeGetItem, safeSetItem } from "@/components/utils/safeLocalStorage";
import { toast } from "sonner";

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
  const [isDirectorPing, setIsDirectorPing] = useState(false);
  // ═══════════════════════════════════════════════════════════════════════
  // READ MARKER SYSTEM — Single durable read marker per chat context.
  //
  // Three-state value for lastSeenMessageId:
  //   undefined = NOT YET HYDRATED (suppress badge entirely)
  //   null      = HYDRATED, genuinely first-time viewer (no stored marker)
  //   string    = HYDRATED, normal read marker (message ID)
  //
  // Persistence chain (in priority order):
  //   1. localStorage (instant, synchronous — primary for same-device)
  //   2. User entity data.chat_last_seen (durable — cross-device fallback)
  //   3. auth.me() chat_last_seen (stale cache — last resort)
  //
  // CRITICAL: base44.entities.User.filter() returns the RAW entity where custom
  // attributes live inside a `data` wrapper (e.g. data.chat_last_seen).
  // base44.auth.me() flattens them to top-level (chat_last_seen).
  // We must check BOTH paths during hydration.
  // ═══════════════════════════════════════════════════════════════════════
  const LOCAL_STORAGE_PREFIX = "chat_last_seen:";
  // undefined = not hydrated yet. This is intentional — see three-state doc above.
  const [lastSeenMessageId, setLastSeenMessageId] = useState(undefined);
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

  // ─── HYDRATE lastSeenMessageId ─────────────────────────────────────
  // Runs on mount AND whenever chatContextKey changes (user switches context).
  // Sets the three-state value: undefined → string | null.
  //
  // CONTEXT CHANGE RESET: When chatContextKey changes, we must reset to undefined
  // (not hydrated) so the badge is suppressed while we fetch the new context's marker.
  // The effect below will then resolve it to string | null.
  const prevChatContextKeyRef = useRef(chatContextKey);
  if (prevChatContextKeyRef.current !== chatContextKey) {
    prevChatContextKeyRef.current = chatContextKey;
    setLastSeenMessageId(undefined); // Reset to "not hydrated" for new context
  }

  // Priority: localStorage (instant) > User entity DB read (durable) > auth.me() (stale fallback)
  useEffect(() => {
    const lsKey = `${LOCAL_STORAGE_PREFIX}${chatContextKey}`;
    const fromLS = safeGetItem(lsKey);
    
    if (fromLS) {
      // localStorage hit — instant, no async needed
      setLastSeenMessageId(fromLS);
      return; // hydration complete (value is a string)
    }
    
    // localStorage miss (cache cleared / new device) — must fetch from DB.
    if (!currentUser?.email) {
      // No user = genuinely unknown. Mark as first-time viewer.
      setLastSeenMessageId(null);
      return;
    }
    
    // Async DB fetch — lastSeenMessageId stays `undefined` (suppresses badge) until resolved.
    let cancelled = false;
    (async () => {
      try {
        const users = await base44.entities.User.filter({ email: currentUser.email });
        if (cancelled) return;
        const freshUser = users?.[0];
        // RAW entity path: data.chat_last_seen (how base44 stores custom User attrs)
        // Flattened path: chat_last_seen (just in case platform behavior changes)
        const profileValue = freshUser?.data?.chat_last_seen?.[chatContextKey] 
                          || freshUser?.chat_last_seen?.[chatContextKey]
                          || null;
        if (profileValue) {
          setLastSeenMessageId(profileValue);
          safeSetItem(lsKey, profileValue); // re-cache for future
        } else {
          // DB has no marker either → genuine first-time viewer
          setLastSeenMessageId(null);
        }
      } catch (err) {
        // User.filter() failed (permissions issue on non-admin users).
        // Fall back to auth.me() flattened data (may be stale but better than nothing).
        if (cancelled) return;
        const fallback = currentUser?.chat_last_seen?.[chatContextKey];
        if (fallback) {
          setLastSeenMessageId(fallback);
          safeSetItem(lsKey, fallback);
        } else {
          setLastSeenMessageId(null);
        }
      }
    })();
    
    return () => { cancelled = true; };
  }, [chatContextKey, currentUser?.email]);

  // Check if user can access chat
  // NOTE: These permission checks are used to guard rendering at the END (JSX return).
  // They must NOT cause an early return here because React hooks below must always execute
  // in the same order on every render (Rules of Hooks).
  const canViewChat = hasPermission(currentUser, 'view_live_chat');
  const canPin = hasPermission(currentUser, 'manage_live_timing'); // Admins/managers can pin
  const shouldRender = !!(currentUser && canViewChat && contextId);

  // Fetch messages for current context.
  // Polling at 15s as a FALLBACK — primary updates come from the real-time subscription.
  // This prevents the double-fetch storm of 3s polling + subscription invalidation.
  const { data: serverMessages = [], isLoading } = useQuery({
    queryKey: ['liveChat', contextType, contextId],
    queryFn: async () => {
      // 2026-04-15: Soft-deleted messages (deleted_at set) must never appear
      // in the regular message list. We filter is_archived:false (existing)
      // and also exclude any with deleted_at set, as a defense-in-depth measure
      // in case is_archived was not flipped during soft-delete.
      const result = await base44.entities.LiveOperationsMessage.filter({
        context_type: contextType,
        context_id: contextId,
        is_archived: false
      }, 'created_date');
      // Client-side filter: exclude soft-deleted messages that may have
      // deleted_at set but is_archived not yet flipped (race condition defense)
      return (result || []).filter(m => !m.deleted_at);
    },
    refetchInterval: 15000, // Fallback poll every 15s — subscription handles real-time
    enabled: shouldRender
  });

  // MERGE server messages with optimistic messages.
  // Remove optimistic messages once their server counterpart appears (matched by message text + created_by).
  // CRITICAL: The cleanup of confirmed optimistic messages is done via useEffect (not inside useMemo)
  // to avoid the setState-during-render anti-pattern which caused re-render storms and perceived lag.
  const messages = React.useMemo(() => {
    if (optimisticMessages.length === 0) return serverMessages;
    
    const pendingOptimistic = optimisticMessages.filter(opt => {
      return !serverMessages.some(
        sm => sm.created_by === currentUser?.email && sm.message === opt.message && sm.image_url === opt.image_url
      );
    });
    
    return [...serverMessages, ...pendingOptimistic];
  }, [serverMessages, optimisticMessages, currentUser?.email]);

  // Cleanup confirmed optimistic messages in a separate effect (not during render).
  useEffect(() => {
    if (optimisticMessages.length === 0) return;
    const pendingOptimistic = optimisticMessages.filter(opt => {
      return !serverMessages.some(
        sm => sm.created_by === currentUser?.email && sm.message === opt.message && sm.image_url === opt.image_url
      );
    });
    if (pendingOptimistic.length !== optimisticMessages.length) {
      setOptimisticMessages(pendingOptimistic);
    }
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

  // ─── PERSIST READ MARKER ────────────────────────────────────────────
  // Triggers:
  //   1. Chat panel becomes visible (marks all as read)
  //   2. New messages arrive while panel is open (scroll-to-bottom auto-marks)
  //   3. First-time viewer opens chat (auto-marks latest as read → clean slate)
  //
  // Writes to:
  //   1. React state (immediate)
  //   2. localStorage (synchronous, primary same-device persistence)
  //   3. User entity via updateMe (debounced, cross-device durability)
  const persistTimeoutRef = useRef(null);
  
  const persistReadMarker = useCallback((messageId) => {
    if (!messageId || messageId === lastSeenMessageId) return;
    
    // 1. React state — immediate
    setLastSeenMessageId(messageId);
    
    // 2. localStorage — synchronous, survives refresh
    const lsKey = `${LOCAL_STORAGE_PREFIX}${chatContextKey}`;
    safeSetItem(lsKey, messageId);
    
    // 3. User entity — debounced for cross-device sync
    if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    persistTimeoutRef.current = setTimeout(() => {
      const updatedChatLastSeen = {
        ...(currentUser?.chat_last_seen || {}),
        [chatContextKey]: messageId
      };
      base44.auth.updateMe({ chat_last_seen: updatedChatLastSeen }).catch(err => {
        console.error('Failed to persist chat_last_seen to profile:', err);
      });
    }, 2000);
  }, [lastSeenMessageId, chatContextKey, currentUser?.chat_last_seen]);

  useEffect(() => {
    if (!isOpen) return;
    
    // Get latest confirmed (non-optimistic, non-typing) message ID
    const confirmedMessages = messages.filter(m => !m._isOptimistic && m.message !== '__typing__');
    if (confirmedMessages.length === 0) return;
    const latestMessageId = confirmedMessages[confirmedMessages.length - 1]?.id;
    if (!latestMessageId) return;
    
    // FIRST-TIME VIEWER: lastSeenMessageId === null means hydration completed
    // with no stored marker. On first open, set marker to latest → clean slate.
    // NORMAL: update marker if new messages arrived while panel is open.
    if (lastSeenMessageId === null || latestMessageId !== lastSeenMessageId) {
      persistReadMarker(latestMessageId);
    }
    
    return () => {
      if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    };
  }, [isOpen, messages, lastSeenMessageId, persistReadMarker]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // ─── BACKUP PERSIST ON VISIBILITY CHANGE / UNMOUNT ────────────────
  // If user switches tabs or closes browser while chat is open, flush
  // the current read marker to localStorage (synchronous, reliable).
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && isOpen && lastSeenMessageId && typeof lastSeenMessageId === 'string') {
        const lsKey = `${LOCAL_STORAGE_PREFIX}${chatContextKey}`;
        safeSetItem(lsKey, lastSeenMessageId);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Unmount flush
      if (isOpen && lastSeenMessageId && typeof lastSeenMessageId === 'string') {
        const lsKey = `${LOCAL_STORAGE_PREFIX}${chatContextKey}`;
        safeSetItem(lsKey, lastSeenMessageId);
      }
    };
  }, [isOpen, lastSeenMessageId, chatContextKey]);

  // ─── UNREAD COUNT (three-state aware) ──────────────────────────────
  // Uses the three-state lastSeenMessageId:
  //   undefined → NOT HYDRATED → badge hidden (return 0)
  //   null      → FIRST-TIME VIEWER → badge hidden (return 0, mark on first open)
  //   string    → NORMAL → count messages after the marker from other users
  //
  // PRODUCT DECISION: First-time viewers see a clean slate (0 unread).
  // They are NOT shown "everything since the beginning."
  // On first open, the marker is set to the latest message ID and persisted.

  const unreadCount = React.useMemo(() => {
    if (isOpen) return 0;
    
    // undefined = still hydrating → suppress badge entirely
    if (lastSeenMessageId === undefined) return 0;
    
    // null = first-time viewer (confirmed after hydration) → clean slate
    if (lastSeenMessageId === null) return 0;
    
    // string = normal read marker → count messages after it
    const countableMessages = messages.filter(m => m.message !== '__typing__' && !m._isOptimistic);
    
    const lastSeenIndex = countableMessages.findIndex(m => m.id === lastSeenMessageId);
    if (lastSeenIndex === -1) {
      // Last seen message not found (deleted/archived) → safe default
      return 0;
    }
    
    const messagesAfterLastSeen = countableMessages.slice(lastSeenIndex + 1);
    return messagesAfterLastSeen.filter(m => m.created_by !== currentUser?.email).length;
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

  // 2026-04-15: Broadcast typing status with 10s TTL pruning.
  // Stale entries from crashed/disconnected clients are automatically removed
  // every time any user broadcasts, preventing ghost indicators.
  const TYPING_TTL_MS = 10000; // 10 seconds — matches TypingIndicator filter
  const broadcastTyping = useCallback(async () => {
    const now = Date.now();
    // Throttle: don't broadcast more than once per 2.5s
    if (now - lastTypingBroadcastRef.current < 2500) return;
    lastTypingBroadcastRef.current = now;

    if (!typingBeaconIdRef.current) return;
    const currentTyping = remoteTypingUsers.filter(u => u.email !== currentUser?.email);
    const updated = [
      ...currentTyping.filter(u => now - new Date(u.timestamp).getTime() < TYPING_TTL_MS), // prune stale (10s)
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

  // 2026-04-15: Auto-clear typing indicator 8s after last keystroke.
  // Increased from 4s to 8s to reduce flicker during slow typing, while still
  // clearing well before the 10s TTL so the indicator disappears promptly.
  const typingClearTimeoutRef = useRef(null);
  const handleTypingInput = useCallback((e) => {
    setMessageText(e.target.value);
    broadcastTyping();
    // Reset the "stop typing" timer — 8s inactivity clears self
    if (typingClearTimeoutRef.current) clearTimeout(typingClearTimeoutRef.current);
    typingClearTimeoutRef.current = setTimeout(() => {
      clearTypingSelf();
    }, 8000);
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
  // CRITICAL FIX: On success, directly inject the server response into the query cache
  // instead of invalidating (which triggers a full refetch and causes 8-10s perceived lag).
  const sendMessageMutation = useMutation({
    mutationFn: async ({ text, imageUrl, _optimisticId, directorPing }) => {
      const newMessage = await base44.entities.LiveOperationsMessage.create({
        context_type: contextType,
        context_id: contextId,
        context_date: contextDate,
        message: text?.trim() || "",
        image_url: imageUrl || null,
        created_by_name: currentUser?.display_name || currentUser?.full_name || null,
        is_pinned: false,
        is_archived: false,
        is_director_ping: directorPing || false,
        reactions: []
      });
      
      // Always broadcast via PushEngage so team members on other devices get notified.
      // Director pings additionally send an email to the active Live Director.
      try {
        await base44.functions.invoke('sendChatNotification', {
          contextType,
          contextId,
          contextName,
          messageId: newMessage.id,
          senderName: currentUser?.display_name || currentUser?.full_name || currentUser?.email,
          messagePreview: text?.substring(0, 100) || '[Image]',
          isDirectorPing: directorPing || false
        });
      } catch (err) {
        console.error('Failed to send chat notification:', err);
        // Don't fail the message send if notification fails
      }
      
      return newMessage;
    },
    onSuccess: (serverMsg, variables) => {
      // Remove the optimistic message
      setOptimisticMessages(prev => prev.filter(m => m._optimisticId !== variables._optimisticId));
      // Directly append the confirmed message to the cache — avoids a full refetch round-trip.
      queryClient.setQueryData(['liveChat', contextType, contextId], (old) => {
        if (!old || !Array.isArray(old)) return [serverMsg];
        // Avoid duplicates if subscription already added it
        if (old.some(m => m.id === serverMsg.id)) return old;
        return [...old, serverMsg];
      });
      setMessageText("");
      setIsDirectorPing(false); // Reset director ping toggle
    },
    onError: (error, variables) => {
      console.error('Failed to send message:', error);
      setOptimisticMessages(prev => prev.filter(m => m._optimisticId !== variables._optimisticId));
    }
  });

  // 2026-04-15: Reaction mutation with retry-on-conflict pattern.
  // When two users react simultaneously, both read the same reactions array,
  // both append, and the last writer overwrites the first. The retry pattern
  // re-reads the entity after a failed save and retries once.
  const toggleReactionMutation = useMutation({
    mutationFn: async ({ messageId, reactionType }) => {
      const MAX_RETRIES = 1;
      
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        // Always read fresh reactions from server (not stale local copy)
        const freshMessages = await base44.entities.LiveOperationsMessage.filter({ id: messageId });
        const freshMsg = freshMessages?.[0];
        if (!freshMsg) return;
        
        const reactions = freshMsg.reactions || [];
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
        
        try {
          return await base44.entities.LiveOperationsMessage.update(messageId, {
            reactions: newReactions
          });
        } catch (err) {
          if (attempt < MAX_RETRIES) {
            // Conflict — retry with fresh data
            console.warn('Reaction conflict, retrying...', err);
            continue;
          }
          throw err; // Exhausted retries
        }
      }
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
      toast.warning('Solo se permiten imágenes');
      return;
    }
    
    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.warning('La imagen debe ser menor a 5MB');
      return;
    }
    
    setIsUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      // Send message with image
      await sendMessageMutation.mutateAsync({ text: messageText, imageUrl: file_url });
    } catch (error) {
      console.error('Image upload failed:', error);
      toast.error('Error al subir imagen');
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
    const directorPing = isDirectorPing;
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
      is_director_ping: directorPing,
      reactions: []
    };
    setOptimisticMessages(prev => [...prev, optimisticMsg]);
    setMessageText(""); // Clear input immediately for responsiveness
    setIsDirectorPing(false); // Reset toggle
    
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
    sendMessageMutation.mutate({ text, imageUrl: null, _optimisticId: optimisticId, directorPing });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // GUARD: After all hooks have run, check if we should render.
  // This is placed here (after all hooks) to comply with Rules of Hooks.
  if (!shouldRender) {
    return null;
  }

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
                      reactionType
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
            {/* Director Ping Toggle */}
            {isDirectorPing && (
              <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-red-50 border border-red-200 rounded-lg">
                <Radio className="w-4 h-4 text-red-600 animate-pulse" />
                <span className="text-xs font-semibold text-red-700">@Director Priority — Will notify active Live Director</span>
                <button 
                  onClick={() => setIsDirectorPing(false)}
                  className="ml-auto text-red-500 hover:text-red-700 text-xs font-medium"
                >
                  Cancel
                </button>
              </div>
            )}
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
              {/* @Director ping button */}
              <button
                onClick={() => setIsDirectorPing(!isDirectorPing)}
                disabled={isUploading || sendMessageMutation.isLoading}
                className={`h-10 w-10 p-0 rounded-full flex items-center justify-center shrink-0 transition-all ${
                  isDirectorPing 
                    ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' 
                    : 'text-slate-500 bg-white border-2 border-slate-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200'
                } disabled:opacity-50`}
                title="@Director — Priority ping to Live Director"
              >
                <Radio className="w-5 h-5" />
              </button>
              <Input
                ref={inputRef}
                value={messageText}
                onChange={handleTypingInput}
                onKeyPress={handleKeyPress}
                placeholder={isDirectorPing ? "@Director: urgent message..." : "Escribe un mensaje..."}
                className={`flex-1 text-sm h-10 rounded-full border-2 bg-white px-4 focus:ring-2 ${
                  isDirectorPing 
                    ? 'border-red-300 focus:ring-red-300 focus:border-red-300 placeholder:text-red-400' 
                    : 'border-slate-200 focus:ring-indigo-300 focus:border-indigo-300'
                }`}
                disabled={sendMessageMutation.isLoading || isUploading}
              />
              <button
                onClick={handleSend}
                disabled={!messageText.trim() || sendMessageMutation.isLoading || isUploading}
                className={`h-10 w-10 p-0 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 ${
                  messageText.trim() 
                    ? 'text-white border-0 scale-110 shadow-lg shadow-teal-500/30' 
                    : 'text-slate-400 bg-slate-200 border-2 border-slate-200 shadow-sm'
                } disabled:opacity-50`}
                style={messageText.trim() ? { background: 'linear-gradient(135deg, #1F8A70 0%, #4DC15F 100%)' } : {}}
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
import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  contextName
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [lastSeenCount, setLastSeenCount] = useState(0);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const queryClient = useQueryClient();

  // Check if user can access chat
  const canViewChat = hasPermission(currentUser, 'view_live_chat');
  const canPin = hasPermission(currentUser, 'manage_live_timing'); // Admins/managers can pin

  // Don't render anything if user doesn't have permission
  if (!canViewChat || !contextId) return null;

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

  // Subscribe to real-time updates
  useEffect(() => {
    if (!contextId) return;

    const unsubscribe = base44.entities.LiveOperationsMessage.subscribe((event) => {
      if (event.data.context_type === contextType && event.data.context_id === contextId) {
        queryClient.invalidateQueries(['liveChat', contextType, contextId]);
      }
    });

    return unsubscribe;
  }, [contextType, contextId, queryClient]);

  // Scroll to bottom when messages change (if panel is open)
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Update last seen count when opening panel
  useEffect(() => {
    if (isOpen) {
      setLastSeenCount(messages.length);
    }
  }, [isOpen, messages.length]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Calculate unread count
  const unreadCount = messages.length - lastSeenCount;

  // Separate pinned and regular messages
  const pinnedMessages = messages.filter(m => m.is_pinned);
  const regularMessages = messages.filter(m => !m.is_pinned);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (text) => {
      return await base44.entities.LiveOperationsMessage.create({
        context_type: contextType,
        context_id: contextId,
        context_date: contextDate,
        message: text.trim(),
        is_pinned: false,
        is_archived: false
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['liveChat', contextType, contextId]);
      setMessageText("");
    }
  });

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
    sendMessageMutation.mutate(messageText);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 ${
          isOpen ? 'bg-gray-700' : 'bg-pdv-teal'
        }`}
        title={isOpen ? 'Cerrar chat' : 'Abrir chat de operaciones'}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <>
            <MessageCircle className="w-6 h-6 text-white" />
            {unreadCount > 0 && (
              <Badge 
                className="absolute -top-1 -right-1 h-5 min-w-5 px-1.5 bg-red-500 text-white text-xs font-bold"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </>
        )}
      </button>

      {/* Chat Panel Overlay */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-32px)] h-[520px] max-h-[calc(100vh-120px)] bg-white rounded-2xl shadow-2xl border border-gray-300 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-pdv-teal to-pdv-green px-4 py-3.5 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-base tracking-wide truncate">
                    Chat en Vivo
                  </h3>
                  <p className="text-xs text-white/90 truncate font-medium">
                    {contextName || (contextType === 'event' ? 'Evento' : 'Servicio')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-white/25 text-white text-xs font-semibold px-2 py-0.5">
                  {messages.length}
                </Badge>
                <button
                  onClick={() => setIsOpen(false)}
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

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gradient-to-b from-gray-50 to-gray-100">
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : regularMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mb-3">
                  <MessageCircle className="w-8 h-8 text-gray-400" />
                </div>
                <p className="font-semibold text-gray-600">Sin mensajes aún</p>
                <p className="text-sm text-gray-400 mt-1">Inicia la conversación del equipo</p>
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
                  />
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t-2 border-gray-200 bg-white px-4 py-3">
            <div className="flex items-center gap-3">
              <Input
                ref={inputRef}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Escribe un mensaje..."
                className="flex-1 text-sm h-10 rounded-full border-gray-300 px-4 focus:ring-2 focus:ring-pdv-teal focus:border-transparent"
                disabled={sendMessageMutation.isLoading}
              />
              <Button
                onClick={handleSend}
                disabled={!messageText.trim() || sendMessageMutation.isLoading}
                size="sm"
                className="h-10 w-10 p-0 bg-pdv-teal hover:bg-pdv-teal/90 rounded-full shadow-md"
              >
                {sendMessageMutation.isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-[10px] text-gray-400 mt-2 text-center">
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
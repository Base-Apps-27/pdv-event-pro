import React from "react";
import { Pin, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * LiveChatPinnedSection Component
 * 
 * Displays pinned messages at the top of the Live Operations Chat.
 * Pinned messages persist until manually unpinned.
 * 
 * @param {Array} pinnedMessages - Array of pinned message objects
 * @param {boolean} canUnpin - Whether current user can unpin messages
 * @param {Function} onUnpin - Handler for unpin action
 */
export default function LiveChatPinnedSection({
  pinnedMessages = [],
  canUnpin = false,
  onUnpin
}) {
  if (pinnedMessages.length === 0) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-3 py-2">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Pin className="w-3.5 h-3.5 text-amber-600" />
        <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
          Mensajes Fijados ({pinnedMessages.length})
        </span>
      </div>
      
      <div className="space-y-1.5 max-h-32 overflow-y-auto">
        {pinnedMessages.map((msg) => {
          // Extract sender name
          const senderName = msg.created_by 
            ? msg.created_by.split('@')[0].charAt(0).toUpperCase() + msg.created_by.split('@')[0].slice(1)
            : 'Usuario';

          return (
            <div
              key={msg.id}
              className="flex items-start justify-between gap-2 bg-white rounded-lg px-2.5 py-1.5 border border-amber-200 text-sm"
            >
              <div className="flex-1 min-w-0">
                <span className="font-medium text-amber-800">{senderName}: </span>
                <span className="text-gray-700">{msg.message}</span>
              </div>
              
              {canUnpin && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onUnpin(msg)}
                  className="h-5 w-5 p-0 text-gray-400 hover:text-red-500 shrink-0"
                  title="Desfijar"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
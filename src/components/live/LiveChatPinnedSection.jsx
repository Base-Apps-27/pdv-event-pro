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
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b-2 border-amber-300 px-3 py-2.5">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
          <Pin className="w-3 h-3 text-white" />
        </div>
        <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">
          Fijados ({pinnedMessages.length})
        </span>
      </div>
      
      <div className="space-y-2 max-h-28 overflow-y-auto">
        {pinnedMessages.map((msg) => {
          // Extract sender name - handle emails with dots/underscores
          const emailPrefix = msg.created_by ? msg.created_by.split('@')[0] : '';
          const cleanName = emailPrefix.replace(/[._]/g, ' ').split(' ')[0];
          const senderName = cleanName ? cleanName.charAt(0).toUpperCase() + cleanName.slice(1) : 'Usuario';

          return (
            <div
              key={msg.id}
              className="flex items-start gap-2 bg-white rounded-xl px-3 py-2 border border-amber-200 shadow-sm"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs font-bold text-amber-700">{senderName}</span>
                </div>
                <p className="text-sm text-gray-800 leading-snug whitespace-pre-wrap break-words">
                  {msg.message}
                </p>
              </div>
              
              {canUnpin && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onUnpin(msg)}
                  className="h-6 w-6 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full shrink-0"
                  title="Desfijar"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
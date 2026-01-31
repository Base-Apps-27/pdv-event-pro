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
    <div 
      style={{ 
        background: 'linear-gradient(to right, #FFFBEB, #FFF7ED)', 
        borderBottomColor: '#FCD34D',
        borderBottomWidth: '2px'
      }}
      className="px-3 py-2.5"
    >
      <div className="flex items-center gap-2 mb-2">
        <div 
          style={{ backgroundColor: '#F59E0B' }}
          className="w-5 h-5 rounded-full flex items-center justify-center"
        >
          <Pin className="w-3 h-3 text-white" />
        </div>
        <span style={{ color: '#92400E' }} className="text-xs font-bold uppercase tracking-wide">
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
              style={{ backgroundColor: '#FFFFFF', borderColor: '#FDE68A' }}
              className="flex items-start gap-2 rounded-xl px-3 py-2 border shadow-sm"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span style={{ color: '#B45309' }} className="text-xs font-bold">{senderName}</span>
                </div>
                <p style={{ color: '#1F2937' }} className="text-sm leading-snug whitespace-pre-wrap break-words">
                  {msg.message}
                </p>
              </div>
              
              {canUnpin && (
                <button
                  onClick={() => onUnpin(msg)}
                  style={{ color: '#9CA3AF' }}
                  className="h-6 w-6 p-0 rounded-full shrink-0 flex items-center justify-center hover:text-red-500 hover:bg-red-50"
                  title="Desfijar"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
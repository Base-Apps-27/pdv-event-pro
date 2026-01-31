import React from "react";
import { Pin, PinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTimestampToEST } from "@/components/utils/timeFormat";

/**
 * LiveChatMessage Component
 * 
 * Renders a single chat message in the Live Operations Chat.
 * Supports pinning/unpinning by users with permission.
 * 
 * @param {Object} message - The message object from LiveOperationsMessage entity
 * @param {string} currentUserEmail - Current user's email for "me" styling
 * @param {boolean} canPin - Whether current user can pin/unpin messages
 * @param {Function} onTogglePin - Handler for pin/unpin action
 */
export default function LiveChatMessage({
  message,
  currentUserEmail,
  canPin = false,
  onTogglePin
}) {
  const isOwnMessage = message.created_by === currentUserEmail;
  
  // Extract first name or email prefix for display
  const senderName = (() => {
    if (message.created_by) {
      const emailPrefix = message.created_by.split('@')[0];
      // Clean up and capitalize - handle names with dots/underscores
      const cleaned = emailPrefix.replace(/[._]/g, ' ').split(' ')[0];
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    return 'Usuario';
  })();

  // Get initials for avatar
  const initials = senderName.substring(0, 2).toUpperCase();

  // Format timestamp - show just time portion
  const timeDisplay = formatTimestampToEST(message.created_date);
  // Extract just the time (e.g., "3:45 PM")
  const shortTime = timeDisplay ? timeDisplay.split(' ').slice(0, 2).join(' ') : '';

  return (
    <div className={`flex gap-2 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'} group`}>
      {/* Avatar - hardcoded gradient */}
      {!isOwnMessage && (
        <div 
          style={{ background: 'linear-gradient(to bottom right, #3B82F6, #9333EA)' }}
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm"
        >
          {initials}
        </div>
      )}
      
      <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} max-w-[75%]`}>
        {/* Sender name and time header */}
        {!isOwnMessage && (
          <div className="flex items-center gap-2 mb-1 px-1">
            <span className="text-xs font-semibold" style={{ color: '#374151' }}>{senderName}</span>
            <span className="text-[10px]" style={{ color: '#9CA3AF' }}>{shortTime}</span>
          </div>
        )}
        
        <div className="relative">
          {/* Message bubble - hardcoded colors */}
          <div
            style={{
              backgroundColor: isOwnMessage ? '#1F8A70' : '#FFFFFF',
              color: isOwnMessage ? '#FFFFFF' : '#1F2937',
              border: isOwnMessage ? 'none' : '1px solid #E5E7EB',
              boxShadow: message.is_pinned ? '0 0 0 2px #FBBF24, 0 0 0 4px white' : '0 1px 2px rgba(0,0,0,0.05)'
            }}
            className={`px-3.5 py-2.5 text-sm leading-relaxed ${
              isOwnMessage ? 'rounded-2xl rounded-br-sm' : 'rounded-2xl rounded-bl-sm'
            }`}
          >
            <p className="whitespace-pre-wrap break-words">{message.message}</p>
          </div>
          
          {/* Pin button (appears on hover for users with permission) */}
          {canPin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onTogglePin(message)}
              style={{ color: message.is_pinned ? '#F59E0B' : '#9CA3AF' }}
              className={`absolute ${isOwnMessage ? '-left-7' : '-right-7'} top-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:text-amber-500`}
              title={message.is_pinned ? 'Desfijar mensaje' : 'Fijar mensaje'}
            >
              {message.is_pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
            </Button>
          )}
        </div>
        
        {/* Timestamp for own messages */}
        {isOwnMessage && (
          <span className="text-[10px] mt-1 mr-1" style={{ color: '#9CA3AF' }}>
            {shortTime}
          </span>
        )}
      </div>
    </div>
  );
}
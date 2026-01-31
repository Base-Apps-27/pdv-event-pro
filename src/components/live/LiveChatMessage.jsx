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
      // Capitalize first letter
      return emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
    }
    return 'Usuario';
  })();

  // Format timestamp
  const timeDisplay = formatTimestampToEST(message.created_date);

  return (
    <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} group`}>
      {/* Sender name (only for others' messages) */}
      {!isOwnMessage && (
        <span className="text-xs text-gray-500 mb-0.5 ml-1">{senderName}</span>
      )}
      
      <div className={`relative max-w-[85%] ${isOwnMessage ? 'order-1' : ''}`}>
        {/* Message bubble */}
        <div
          className={`px-3 py-2 rounded-2xl text-sm ${
            isOwnMessage
              ? 'bg-pdv-teal text-white rounded-br-md'
              : 'bg-gray-100 text-gray-900 rounded-bl-md'
          } ${message.is_pinned ? 'ring-2 ring-amber-400' : ''}`}
        >
          {message.message}
        </div>
        
        {/* Pin button (appears on hover for users with permission) */}
        {canPin && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onTogglePin(message)}
            className={`absolute -right-8 top-0 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity ${
              message.is_pinned ? 'text-amber-500' : 'text-gray-400 hover:text-amber-500'
            }`}
            title={message.is_pinned ? 'Desfijar mensaje' : 'Fijar mensaje'}
          >
            {message.is_pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
          </Button>
        )}
      </div>
      
      {/* Timestamp */}
      <span className={`text-[10px] text-gray-400 mt-0.5 ${isOwnMessage ? 'mr-1' : 'ml-1'}`}>
        {timeDisplay}
      </span>
    </div>
  );
}
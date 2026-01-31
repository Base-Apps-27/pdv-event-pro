import React, { useState } from "react";
import { Pin, PinOff, ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTimestampToEST } from "@/components/utils/timeFormat";

/**
 * LiveChatMessage Component
 * 
 * Renders a single chat message in the Live Operations Chat.
 * Supports pinning/unpinning, reactions (thumbs up/down), and images.
 * 
 * @param {Object} message - The message object from LiveOperationsMessage entity
 * @param {string} currentUserEmail - Current user's email for "me" styling
 * @param {boolean} canPin - Whether current user can pin/unpin messages
 * @param {Function} onTogglePin - Handler for pin/unpin action
 * @param {Function} onToggleReaction - Handler for reaction toggle (thumbs_up/thumbs_down)
 */
export default function LiveChatMessage({
  message,
  currentUserEmail,
  canPin = false,
  onTogglePin,
  onToggleReaction
}) {
  const [showReactors, setShowReactors] = useState(null); // 'thumbs_up' or 'thumbs_down' or null
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

  // Reaction counts and user's own reactions
  const reactions = message.reactions || [];
  const thumbsUpCount = reactions.filter(r => r.reaction_type === 'thumbs_up').length;
  const thumbsDownCount = reactions.filter(r => r.reaction_type === 'thumbs_down').length;
  const userThumbsUp = reactions.some(r => r.user_email === currentUserEmail && r.reaction_type === 'thumbs_up');
  const userThumbsDown = reactions.some(r => r.user_email === currentUserEmail && r.reaction_type === 'thumbs_down');

  // Get reactor names for tooltip
  const getReactorNames = (reactionType) => {
    return reactions
      .filter(r => r.reaction_type === reactionType)
      .map(r => {
        const email = r.user_email || '';
        const name = email.split('@')[0].replace(/[._]/g, ' ').split(' ')[0];
        return name.charAt(0).toUpperCase() + name.slice(1);
      });
  };

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
            {/* Image attachment */}
            {message.image_url && (
              <a href={message.image_url} target="_blank" rel="noopener noreferrer" className="block mb-2">
                <img 
                  src={message.image_url} 
                  alt="Imagen adjunta" 
                  className="max-w-full rounded-lg max-h-48 object-cover"
                  style={{ border: isOwnMessage ? '1px solid rgba(255,255,255,0.3)' : '1px solid #E5E7EB' }}
                />
              </a>
            )}
            {/* Message text */}
            {message.message && (
              <p className="whitespace-pre-wrap break-words">{message.message}</p>
            )}
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

          {/* Reactions row */}
          <div className={`flex items-center gap-1 mt-1 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
            {/* Thumbs up */}
            <button
              onClick={() => onToggleReaction && onToggleReaction('thumbs_up')}
              onMouseEnter={() => thumbsUpCount > 0 && setShowReactors('thumbs_up')}
              onMouseLeave={() => setShowReactors(null)}
              style={{ 
                backgroundColor: userThumbsUp ? '#DCFCE7' : 'transparent',
                color: userThumbsUp ? '#16A34A' : '#9CA3AF'
              }}
              className="h-6 px-1.5 rounded-full flex items-center gap-0.5 hover:bg-gray-100 transition-colors text-xs relative"
              title="👍"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
              {thumbsUpCount > 0 && <span className="font-medium">{thumbsUpCount}</span>}
              {/* Reactor tooltip */}
              {showReactors === 'thumbs_up' && thumbsUpCount > 0 && (
                <div 
                  style={{ backgroundColor: '#1F2937' }}
                  className="absolute bottom-full mb-1 left-0 px-2 py-1 rounded text-[10px] text-white whitespace-nowrap z-10"
                >
                  {getReactorNames('thumbs_up').join(', ')}
                </div>
              )}
            </button>
            {/* Thumbs down */}
            <button
              onClick={() => onToggleReaction && onToggleReaction('thumbs_down')}
              onMouseEnter={() => thumbsDownCount > 0 && setShowReactors('thumbs_down')}
              onMouseLeave={() => setShowReactors(null)}
              style={{ 
                backgroundColor: userThumbsDown ? '#FEE2E2' : 'transparent',
                color: userThumbsDown ? '#DC2626' : '#9CA3AF'
              }}
              className="h-6 px-1.5 rounded-full flex items-center gap-0.5 hover:bg-gray-100 transition-colors text-xs relative"
              title="👎"
            >
              <ThumbsDown className="w-3.5 h-3.5" />
              {thumbsDownCount > 0 && <span className="font-medium">{thumbsDownCount}</span>}
              {/* Reactor tooltip */}
              {showReactors === 'thumbs_down' && thumbsDownCount > 0 && (
                <div 
                  style={{ backgroundColor: '#1F2937' }}
                  className="absolute bottom-full mb-1 left-0 px-2 py-1 rounded text-[10px] text-white whitespace-nowrap z-10"
                >
                  {getReactorNames('thumbs_down').join(', ')}
                </div>
              )}
            </button>
          </div>
        </div>
        
        {/* Timestamp for own messages - includes sender name */}
        {isOwnMessage && (
          <span className="text-[10px] mt-1 mr-1" style={{ color: '#9CA3AF' }}>
            {senderName} · {shortTime}
          </span>
        )}
      </div>
    </div>
  );
}
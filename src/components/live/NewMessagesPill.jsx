import React from "react";
import { ChevronDown } from "lucide-react";

/**
 * NewMessagesPill
 * 
 * Floating pill shown when user has scrolled up in chat and new messages arrive.
 * Clicking it scrolls to the bottom. Industry-standard pattern (Slack, Teams, etc.)
 * 
 * @param {number} count - Number of new messages below the fold
 * @param {Function} onClick - Scroll-to-bottom handler
 */
export default function NewMessagesPill({ count = 0, onClick }) {
  if (count <= 0) return null;

  return (
    <button
      onClick={onClick}
      className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-lg transition-all hover:scale-105 active:scale-95"
      style={{ 
        backgroundColor: '#1F8A70', 
        color: 'white',
        boxShadow: '0 4px 12px rgba(31, 138, 112, 0.4)'
      }}
    >
      <ChevronDown className="w-3.5 h-3.5" />
      <span className="text-xs font-bold">
        {count} {count === 1 ? 'nuevo' : 'nuevos'}
      </span>
    </button>
  );
}
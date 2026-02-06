import React from "react";

/**
 * TypingIndicator
 * 
 * Displays a subtle "X is typing..." or "X, Y are typing..." indicator
 * above the input area. Industry-standard pattern (Slack, Teams, Discord).
 * 
 * Filters out the current user and stale entries (>8s old).
 * 
 * @param {Array} typingUsers - Array of {email, name, timestamp}
 * @param {string} currentUserEmail - Current user's email (excluded from display)
 */
export default function TypingIndicator({ typingUsers = [], currentUserEmail }) {
  // Filter out current user and stale entries (older than 8 seconds)
  const now = Date.now();
  const active = typingUsers.filter(u => {
    if (u.email === currentUserEmail) return false;
    const ts = new Date(u.timestamp).getTime();
    return now - ts < 8000; // 8s staleness threshold
  });

  if (active.length === 0) return null;

  // Build display string: "Alex está escribiendo..." or "Alex, Maria están escribiendo..."
  const names = active.map(u => {
    if (u.name) return u.name.split(' ')[0]; // First name only
    return u.email?.split('@')[0] || 'Alguien';
  });

  let text;
  if (names.length === 1) {
    text = `${names[0]} está escribiendo`;
  } else if (names.length === 2) {
    text = `${names[0]} y ${names[1]} están escribiendo`;
  } else {
    text = `${names.length} personas están escribiendo`;
  }

  return (
    <div className="flex items-center gap-2 px-4 py-1" style={{ minHeight: '20px' }}>
      {/* Animated dots */}
      <div className="flex items-center gap-0.5">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-slate-400"
            style={{
              animation: 'typing-bounce 1.4s infinite ease-in-out',
              animationDelay: `${i * 0.2}s`
            }}
          />
        ))}
      </div>
      <span className="text-[11px] text-slate-400 italic truncate">
        {text}...
      </span>
      {/* Inline keyframes for the bouncing dots */}
      <style>{`
        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-3px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
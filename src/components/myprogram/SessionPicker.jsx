/**
 * SessionPicker — MyProgram Step 8
 * 
 * Horizontal scroll pills for selecting session/time-slot.
 * Auto-detects current/next session. Manual override allowed.
 * 
 * Decision: "MyProgram: session picker uses horizontal scroll for 4+ sessions"
 */
import React from 'react';

export default function SessionPicker({ sessions, value, onChange }) {
  if (!sessions || sessions.length <= 1) return null;

  return (
    <div className="w-full overflow-x-auto scrollbar-none -mx-1 px-1">
      <div className="flex gap-2.5 pb-1 min-w-max">
        {sessions.map((session) => {
          const isActive = value === session.id;
          return (
            <button
              key={session.id}
              onClick={() => onChange(session.id)}
              className={`
                px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all min-h-[44px]
                ${isActive
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-400'}
              `}
            >
              {session.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
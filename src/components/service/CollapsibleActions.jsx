import React, { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";

/**
 * CollapsibleActions — 2026-03-01
 * 
 * Renders PREP and DURANTE actions as a single collapsed summary row
 * ("3 PREP • 2 DURANTE") that expands to show individual action cards on tap.
 * Replaces the old always-visible stacked cards that consumed too much vertical space.
 * 
 * Auto-expands when `isCurrent` is true so the active segment's actions are visible.
 * 
 * Surfaces: PublicProgramSegment (services + events live view)
 */
export default function CollapsibleActions({
  prepActions = [],
  duringActions = [],
  calculateActionTime,
  alwaysExpanded = false,
  isCurrent = false
}) {
  // Auto-expand for the current segment so operators see actions immediately
  const [open, setOpen] = useState(isCurrent);

  const prepCount = prepActions.length;
  const duringCount = duringActions.length;

  return (
    <div>
      {/* Summary row — tap to expand/collapse */}
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs font-bold transition-colors ${
          open
            ? 'bg-slate-100 border-slate-300 text-slate-700'
            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
        }`}
      >
        {open
          ? <ChevronDown className="w-3.5 h-3.5 shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        }
        <div className="flex items-center gap-1.5 flex-wrap">
          {prepCount > 0 && (
            <span className="bg-amber-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
              {prepCount} PREP
            </span>
          )}
          {prepCount > 0 && duringCount > 0 && (
            <span className="text-slate-400">•</span>
          )}
          {duringCount > 0 && (
            <span className="bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
              {duringCount} DURANTE
            </span>
          )}
        </div>
      </button>

      {/* Expanded action list */}
      {open && (
        <div className="mt-1.5 space-y-1">
          {/* Prep actions */}
          {prepActions.map((action, idx) => {
            const actionTime = calculateActionTime(action);
            return (
              <div key={`prep-${idx}`} className={`rounded px-2.5 py-1.5 text-xs ${
                alwaysExpanded
                  ? 'bg-amber-50 border border-amber-200'
                  : 'bg-amber-100 border border-amber-300'
              }`}>
                <div className="flex items-start gap-1.5">
                  <span className="bg-amber-400 text-white text-[10px] font-bold px-1 py-0.5 rounded shrink-0 leading-tight">⚠ PREP</span>
                  <div className="flex-1 min-w-0">
                    <span className={`block leading-snug ${alwaysExpanded ? 'text-amber-800' : 'font-semibold text-amber-900'}`}>
                      {!alwaysExpanded && action.department && `[${action.department}] `}
                      {String(action.label || '').replace(/^\s*\[[^\]]+\]\s*/, '')}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {actionTime && (
                        <span className={`text-[10px] font-mono font-semibold text-amber-700 px-1 py-0.5 rounded ${
                          alwaysExpanded ? 'bg-amber-100' : 'bg-amber-200'
                        }`}>@ {actionTime}</span>
                      )}
                      {action.notes && <span className="text-amber-700 text-[10px]">— {action.notes}</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* During actions */}
          {duringActions.map((action, idx) => {
            const actionTime = calculateActionTime(action);
            return (
              <div key={`during-${idx}`} className={`rounded px-2.5 py-1.5 text-xs ${
                alwaysExpanded
                  ? 'bg-blue-50 border border-blue-200'
                  : 'bg-blue-100 border border-blue-300'
              }`}>
                <div className="flex items-start gap-1.5">
                  <span className="bg-blue-500 text-white text-[10px] font-bold px-1 py-0.5 rounded shrink-0 leading-tight">▶ DURANTE</span>
                  <div className="flex-1 min-w-0">
                    <span className={`block leading-snug ${alwaysExpanded ? 'text-blue-800' : 'font-semibold text-blue-900'}`}>
                      {!alwaysExpanded && action.department && `[${action.department}] `}
                      {String(action.label || '').replace(/^\s*\[[^\]]+\]\s*/, '')}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {actionTime && (
                        <span className={`text-[10px] font-mono font-semibold text-blue-700 px-1 py-0.5 rounded ${
                          alwaysExpanded ? 'bg-blue-100' : 'bg-blue-200'
                        }`}>@ {actionTime}</span>
                      )}
                      {action.notes && <span className="text-blue-700 text-[10px]">— {action.notes}</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
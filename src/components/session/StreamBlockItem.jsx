import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, Edit, Trash2, Link as LinkIcon, Radio, PowerOff, Plus, AlertTriangle, ArrowRight } from "lucide-react";
import { resolveBlockTime } from "@/components/utils/streamTiming";
import { formatTimeToEST } from "@/components/utils/timeFormat";

export default function StreamBlockItem({ block, index, total, segments, sessionDate, onEdit, onDelete, onMove, readOnly = false, isCurrent = false }) {
  // Resolve timing on the fly
  const { startTime, endTime, isOrphaned } = resolveBlockTime(block, segments, sessionDate);

  const formatTime = (date) => {
    if (!date) return "--:--";
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York'
    });
  };

  const blockTypeConfig = {
    link: { icon: LinkIcon, color: "bg-blue-100 text-blue-700 border-blue-200", label: "Link" },
    insert: { icon: Plus, color: "bg-green-100 text-green-700 border-green-200", label: "Insert" },
    replace: { icon: Radio, color: "bg-orange-100 text-orange-700 border-orange-200", label: "Replace" },
    offline: { icon: PowerOff, color: "bg-gray-100 text-gray-700 border-gray-200", label: "Offline" },
  };

  const config = blockTypeConfig[block.block_type] || blockTypeConfig.link;
  const Icon = config.icon;

  // Find anchor segment for display
  const anchorSegment = segments.find(s => s.id === block.anchor_segment_id);

  return (
    <div className={`
      relative flex items-center gap-3 p-3 rounded-lg border transition-all
      ${isOrphaned ? 'border-red-300 bg-red-50' : isCurrent ? 'bg-blue-50 border-blue-500 shadow-md ring-1 ring-blue-500' : 'bg-white border-gray-200 hover:shadow-sm'}
    `}>
      {/* Reorder Controls (Arrow System) */}
      {!readOnly && (
        <div className="flex flex-col gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMove(index, 'up')}
            disabled={index === 0}
            className="h-5 w-6 p-0 hover:bg-blue-100 text-slate-400 hover:text-blue-600"
          >
            <ChevronUp className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMove(index, 'down')}
            disabled={index === total - 1}
            className="h-5 w-6 p-0 hover:bg-blue-100 text-slate-400 hover:text-blue-600"
          >
            <ChevronDown className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Time Column */}
      <div className="flex flex-col items-end min-w-[70px]">
        <div className="font-mono text-sm font-semibold text-slate-900">
          {formatTime(startTime)}
        </div>
        <div className="text-xs text-slate-400 font-mono">
          {formatTime(endTime)}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className={`${config.color} gap-1 px-1.5 py-0`}>
            <Icon className="w-3 h-3" />
            <span className="uppercase text-[10px] font-bold">{config.label}</span>
          </Badge>
          
          {/* Anchor Indicator */}
          {anchorSegment && (
            <div className="flex items-center text-[10px] text-slate-400 bg-slate-50 px-1.5 rounded border border-slate-100">
              <span className="mr-1">Anchor:</span>
              <span className="font-medium text-slate-600 truncate max-w-[100px]">{anchorSegment.title}</span>
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">{block.offset_min > 0 ? `+${block.offset_min}` : block.offset_min}m</Badge>
            </div>
          )}
          
          {isOrphaned && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="w-3 h-3" /> Orphaned
            </Badge>
          )}
        </div>

        <h4 className="font-semibold text-slate-900 text-sm truncate">{block.title}</h4>
        
        <div className="flex items-center gap-3 mt-1">
          {block.presenter && (
            <div className="text-xs text-slate-600 flex items-center gap-1">
              <span className="font-medium">Presenter:</span> {block.presenter}
            </div>
          )}
          {block.stream_actions?.length > 0 && (
            <Badge variant="outline" className="text-[10px] h-4 bg-slate-50 text-slate-500 border-slate-200">
              {block.stream_actions.length} cues
            </Badge>
          )}
        </div>
      </div>

      {/* Actions */}
      {!readOnly && (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => onEdit(block)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600">
            <Edit className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onDelete(block)}
            className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
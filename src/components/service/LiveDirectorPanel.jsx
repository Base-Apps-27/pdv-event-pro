import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Radio, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp,
  Edit2,
  Check,
  X
} from "lucide-react";
import { useLanguage } from "@/components/utils/i18n";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

/**
 * LiveDirectorPanel - Manual Live Timing Control for Events
 * 
 * Features:
 * - Toggle live mode on/off
 * - Table view of all segments with planned vs actual times
 * - "Mark Ended" stamps actual_end_time = NOW and sets next segment's actual_start_time = NOW
 * - Inline time editing for manual adjustments
 * - Visual indicators for overruns/gaps
 * 
 * Design Decision: No auto-cascade beyond "Mark Ended" setting next start.
 * User manually adjusts subsequent segments as needed.
 */

// Helper: Get current time as HH:MM
const getNowHHMM = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

// Helper: Parse HH:MM to minutes since midnight
const parseTime = (timeStr) => {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

// Helper: Calculate diff in minutes (positive = late/over, negative = early/under)
const getTimeDiff = (planned, actual) => {
  const p = parseTime(planned);
  const a = parseTime(actual);
  if (p === null || a === null) return null;
  return a - p;
};

// Helper: Format diff for display
const formatDiff = (diff) => {
  if (diff === null) return '';
  if (diff === 0) return 'On time';
  const sign = diff > 0 ? '+' : '';
  return `${sign}${diff}m`;
};

// Single segment row component
function SegmentRow({ 
  segment, 
  index, 
  isCurrentSegment,
  isPastSegment,
  onMarkEnded, 
  onUpdateTime,
  isLoading,
  t 
}) {
  const [editingField, setEditingField] = useState(null); // 'start' | 'end' | null
  const [editValue, setEditValue] = useState('');

  const plannedStart = segment.start_time;
  const plannedEnd = segment.end_time;
  const actualStart = segment.actual_start_time;
  const actualEnd = segment.actual_end_time;

  const startDiff = getTimeDiff(plannedStart, actualStart);
  const endDiff = getTimeDiff(plannedEnd, actualEnd);

  // Status determination
  let status = 'pending'; // not yet started
  if (actualEnd) {
    status = 'completed';
  } else if (actualStart) {
    status = 'in_progress';
  }

  const handleStartEdit = (field, currentValue) => {
    setEditingField(field);
    setEditValue(currentValue || '');
  };

  const handleSaveEdit = async () => {
    if (!editValue.match(/^\d{2}:\d{2}$/)) {
      toast.error('Invalid time format (use HH:MM)');
      return;
    }
    
    const field = editingField === 'start' ? 'actual_start_time' : 'actual_end_time';
    await onUpdateTime(segment.id, field, editValue);
    setEditingField(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  // Determine row styling based on status
  const rowClasses = `
    border-b border-slate-700 transition-colors
    ${isCurrentSegment ? 'bg-amber-900/30 border-l-4 border-l-amber-500' : ''}
    ${isPastSegment && !isCurrentSegment ? 'opacity-60' : ''}
    ${status === 'completed' ? 'bg-green-900/10' : ''}
  `;

  return (
    <tr className={rowClasses}>
      {/* Status indicator */}
      <td className="px-3 py-2 w-10">
        {status === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
        {status === 'in_progress' && <Radio className="w-4 h-4 text-amber-500 animate-pulse" />}
        {status === 'pending' && <Clock className="w-4 h-4 text-slate-500" />}
      </td>

      {/* Segment name */}
      <td className="px-3 py-2 font-medium">
        <div className="flex items-center gap-2">
          <span className="text-slate-300">{segment.title}</span>
          {segment.segment_type && (
            <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
              {segment.segment_type}
            </Badge>
          )}
        </div>
        {segment.presenter && (
          <div className="text-xs text-slate-500">{segment.presenter}</div>
        )}
      </td>

      {/* Planned times */}
      <td className="px-3 py-2 text-center text-slate-400 text-sm font-mono">
        {plannedStart}
      </td>
      <td className="px-3 py-2 text-center text-slate-400 text-sm font-mono">
        {plannedEnd}
      </td>

      {/* Actual start - editable */}
      <td className="px-3 py-2 text-center">
        {editingField === 'start' ? (
          <div className="flex items-center gap-1 justify-center">
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-20 h-7 text-center text-sm bg-slate-800 border-slate-600"
              placeholder="HH:MM"
              autoFocus
            />
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSaveEdit} disabled={isLoading}>
              <Check className="w-3 h-3 text-green-500" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCancelEdit}>
              <X className="w-3 h-3 text-red-500" />
            </Button>
          </div>
        ) : (
          <div 
            className="flex items-center gap-1 justify-center cursor-pointer hover:bg-slate-800 rounded px-2 py-1 group"
            onClick={() => handleStartEdit('start', actualStart)}
          >
            <span className={`font-mono text-sm ${actualStart ? 'text-white' : 'text-slate-600'}`}>
              {actualStart || '—'}
            </span>
            <Edit2 className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100" />
            {startDiff !== null && startDiff !== 0 && (
              <span className={`text-xs ml-1 ${startDiff > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {formatDiff(startDiff)}
              </span>
            )}
          </div>
        )}
      </td>

      {/* Actual end - editable */}
      <td className="px-3 py-2 text-center">
        {editingField === 'end' ? (
          <div className="flex items-center gap-1 justify-center">
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-20 h-7 text-center text-sm bg-slate-800 border-slate-600"
              placeholder="HH:MM"
              autoFocus
            />
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSaveEdit} disabled={isLoading}>
              <Check className="w-3 h-3 text-green-500" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCancelEdit}>
              <X className="w-3 h-3 text-red-500" />
            </Button>
          </div>
        ) : (
          <div 
            className="flex items-center gap-1 justify-center cursor-pointer hover:bg-slate-800 rounded px-2 py-1 group"
            onClick={() => handleStartEdit('end', actualEnd)}
          >
            <span className={`font-mono text-sm ${actualEnd ? 'text-white' : 'text-slate-600'}`}>
              {actualEnd || '—'}
            </span>
            <Edit2 className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100" />
            {endDiff !== null && endDiff !== 0 && (
              <span className={`text-xs ml-1 ${endDiff > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {formatDiff(endDiff)}
              </span>
            )}
          </div>
        )}
      </td>

      {/* Actions */}
      <td className="px-3 py-2 text-right">
        {status === 'in_progress' && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onMarkEnded(segment)}
            disabled={isLoading}
            className="text-xs"
          >
            {t('live.mark_ended')}
          </Button>
        )}
        {status === 'pending' && !actualStart && index === 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onUpdateTime(segment.id, 'actual_start_time', getNowHHMM())}
            disabled={isLoading}
            className="text-xs border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            Start Now
          </Button>
        )}
      </td>
    </tr>
  );
}

export default function LiveDirectorPanel({ session, segments, refetchData }) {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  if (!session) return null;

  // Sort segments by order
  const sortedSegments = useMemo(() => {
    return [...(segments || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [segments]);

  // Determine current segment (has actual_start but no actual_end)
  const currentSegmentIndex = sortedSegments.findIndex(
    s => s.actual_start_time && !s.actual_end_time
  );

  const handleToggle = async (checked) => {
    setIsLoading(true);
    try {
      await base44.functions.invoke('updateLiveSegmentTiming', {
        sessionId: session.id,
        action: 'toggle_live_adjustment',
        value: checked
      });
      toast.success(checked ? t('live.enabled') : t('live.disabled'));
      refetchData();
    } catch (err) {
      console.error(err);
      toast.error(t('error.generic'));
    } finally {
      setIsLoading(false);
    }
  };

  // Mark segment as ended and auto-set next segment's start to NOW
  const handleMarkEnded = async (segment) => {
    setIsLoading(true);
    try {
      const nowHHMM = getNowHHMM();
      
      await base44.functions.invoke('updateLiveSegmentTiming', {
        sessionId: session.id,
        segmentId: segment.id,
        action: 'mark_ended_manual',
        value: nowHHMM
      });
      
      toast.success(`${segment.title} ended at ${nowHHMM}`);
      refetchData();
    } catch (err) {
      console.error(err);
      toast.error(t('error.generic'));
    } finally {
      setIsLoading(false);
    }
  };

  // Manual time update for a single segment (no cascade)
  const handleUpdateTime = async (segmentId, field, value) => {
    setIsLoading(true);
    try {
      await base44.functions.invoke('updateLiveSegmentTiming', {
        sessionId: session.id,
        segmentId: segmentId,
        action: 'set_time',
        field: field,
        value: value
      });
      
      toast.success(t('live.time_updated') || 'Time updated');
      refetchData();
    } catch (err) {
      console.error(err);
      toast.error(t('error.generic'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-slate-900 text-white border-none shadow-xl mb-6">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Switch 
                id="live-mode" 
                checked={session.live_adjustment_enabled || false}
                onCheckedChange={handleToggle}
                disabled={isLoading}
                className="data-[state=checked]:bg-red-600"
              />
              <Label htmlFor="live-mode" className="font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                {t('live.admin_mode') || 'Live Director'}
                {session.live_adjustment_enabled && (
                  <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                )}
              </Label>
            </div>
            
            {session.live_adjustment_enabled && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Clock className="w-3 h-3" />
                <span>Now: {getNowHHMM()}</span>
              </div>
            )}
          </div>

          {session.live_adjustment_enabled && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-slate-400 hover:text-white"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </CardHeader>

      {session.live_adjustment_enabled && isExpanded && (
        <CardContent className="pt-2">
          {/* Help text */}
          <div className="mb-3 p-2 bg-slate-800 rounded text-xs text-slate-400 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-300">{t('live.manual_mode') || 'Manual Mode'}:</strong>{' '}
              {t('live.manual_instructions') || 'Click any time to edit. "Mark Ended" sets end time to NOW and starts the next segment.'}
            </div>
          </div>

          {/* Segments table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
                  <th className="px-3 py-2 w-10"></th>
                  <th className="px-3 py-2 text-left">{t('live.segment') || 'Segment'}</th>
                  <th className="px-3 py-2 text-center" colSpan={2}>
                    {t('live.planned') || 'Planned'}
                  </th>
                  <th className="px-3 py-2 text-center" colSpan={2}>
                    {t('live.actual') || 'Actual'}
                  </th>
                  <th className="px-3 py-2 w-28"></th>
                </tr>
                <tr className="border-b border-slate-800 text-slate-500 text-xs">
                  <th></th>
                  <th></th>
                  <th className="px-3 py-1 text-center">{t('live.start') || 'Start'}</th>
                  <th className="px-3 py-1 text-center">{t('live.end') || 'End'}</th>
                  <th className="px-3 py-1 text-center">{t('live.start') || 'Start'}</th>
                  <th className="px-3 py-1 text-center">{t('live.end') || 'End'}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedSegments.map((segment, index) => (
                  <SegmentRow
                    key={segment.id}
                    segment={segment}
                    index={index}
                    isCurrentSegment={index === currentSegmentIndex}
                    isPastSegment={currentSegmentIndex > -1 && index < currentSegmentIndex}
                    onMarkEnded={handleMarkEnded}
                    onUpdateTime={handleUpdateTime}
                    isLoading={isLoading}
                    t={t}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
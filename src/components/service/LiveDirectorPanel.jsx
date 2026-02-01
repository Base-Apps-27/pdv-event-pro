import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Radio, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp,
  Edit2,
  Check,
  X,
  Undo2,
  UserCheck,
  Shield
} from "lucide-react";
import { useLanguage } from "@/components/utils/i18n";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

/**
 * LiveDirectorPanel - Manual Live Timing Control for Events
 * 
 * Features:
 * - Single-user ownership: Only one person can be Live Director at a time
 * - Confirmation dialogs before critical actions
 * - Takeover mechanism with notification
 * - Undo last action capability
 * - Table view of all segments with planned vs actual times
 * - "Mark Ended" stamps actual_end_time = NOW and sets next segment's actual_start_time = NOW
 * - Inline time editing for manual adjustments
 * - Visual indicators for overruns/gaps
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

// Mobile segment card component for responsive display
function MobileSegmentCard({ 
  segment, 
  index, 
  isCurrentSegment,
  isPastSegment,
  onMarkEnded, 
  onUpdateTime,
  isLoading,
  isBlocked,
  t,
  language 
}) {
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');

  const plannedStart = segment.start_time;
  const plannedEnd = segment.end_time;
  const actualStart = segment.actual_start_time;
  const actualEnd = segment.actual_end_time;

  const startDiff = getTimeDiff(plannedStart, actualStart);
  const endDiff = getTimeDiff(plannedEnd, actualEnd);

  let status = 'pending';
  if (actualEnd) status = 'completed';
  else if (actualStart) status = 'in_progress';

  const handleSaveEdit = async () => {
    if (!editValue.match(/^\d{2}:\d{2}$/)) {
      toast.error('HH:MM');
      return;
    }
    const field = editingField === 'start' ? 'actual_start_time' : 'actual_end_time';
    await onUpdateTime(segment.id, field, editValue);
    setEditingField(null);
    setEditValue('');
  };

  const cardClasses = `
    p-3 rounded-lg border transition-colors
    ${isCurrentSegment ? 'bg-amber-900/40 border-amber-500' : 'bg-slate-800 border-slate-700'}
    ${isPastSegment && !isCurrentSegment ? 'opacity-50' : ''}
    ${status === 'completed' ? 'bg-green-900/20 border-green-700' : ''}
  `;

  return (
    <div className={cardClasses}>
      {/* Header: Status + Title */}
      <div className="flex items-center gap-2 mb-2">
        {status === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}
        {status === 'in_progress' && <Radio className="w-4 h-4 text-amber-500 animate-pulse flex-shrink-0" />}
        {status === 'pending' && <Clock className="w-4 h-4 text-slate-500 flex-shrink-0" />}
        <span className="font-medium text-sm text-slate-200 truncate flex-1">{segment.title}</span>
        {segment.segment_type && (
          <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400 px-1.5 py-0">
            {segment.segment_type}
          </Badge>
        )}
      </div>

      {/* Times Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {/* Planned */}
        <div className="bg-slate-900/50 rounded p-2">
          <div className="text-slate-500 mb-1">{language === 'es' ? 'Planif.' : 'Planned'}</div>
          <div className="font-mono text-slate-400">{plannedStart || '—'} - {plannedEnd || '—'}</div>
        </div>

        {/* Actual */}
        <div className="bg-slate-900/50 rounded p-2">
          <div className="text-slate-500 mb-1">{language === 'es' ? 'Actual' : 'Actual'}</div>
          {editingField ? (
            <div className="flex items-center gap-1">
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-16 h-6 text-center text-xs bg-slate-800 border-slate-600 px-1"
                placeholder="HH:MM"
                autoFocus
              />
              <Button size="icon" variant="ghost" className="h-5 w-5" onClick={handleSaveEdit} disabled={isLoading}>
                <Check className="w-3 h-3 text-green-500" />
              </Button>
              <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setEditingField(null)}>
                <X className="w-3 h-3 text-red-500" />
              </Button>
            </div>
          ) : (
            <div 
              className={`font-mono ${!isBlocked ? 'cursor-pointer' : ''}`}
              onClick={() => !isBlocked && setEditingField('start') && setEditValue(actualStart || '')}
            >
              <span className={actualStart ? 'text-white' : 'text-slate-600'}>{actualStart || '—'}</span>
              {startDiff !== null && startDiff !== 0 && (
                <span className={`ml-1 ${startDiff > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {formatDiff(startDiff)}
                </span>
              )}
              <span className="text-slate-600"> - </span>
              <span className={actualEnd ? 'text-white' : 'text-slate-600'}>{actualEnd || '—'}</span>
              {endDiff !== null && endDiff !== 0 && (
                <span className={`ml-1 ${endDiff > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {formatDiff(endDiff)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Button */}
      {!isBlocked && status === 'in_progress' && (
        <Button
          variant="destructive"
          size="sm"
          onClick={() => onMarkEnded(segment)}
          disabled={isLoading}
          className="w-full mt-2 text-xs h-8"
        >
          {t('live.mark_ended')}
        </Button>
      )}
      {!isBlocked && status === 'pending' && !actualStart && index === 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onUpdateTime(segment.id, 'actual_start_time', getNowHHMM())}
          disabled={isLoading}
          className="w-full mt-2 text-xs h-8 border-slate-600 text-slate-300"
        >
          {language === 'es' ? 'Iniciar Ahora' : 'Start Now'}
        </Button>
      )}
    </div>
  );
}

// Single segment row component
function SegmentRow({ 
  segment, 
  index, 
  isCurrentSegment,
  isPastSegment,
  onMarkEnded, 
  onUpdateTime,
  isLoading,
  isBlocked,
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
    if (isBlocked) return;
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
            className={`flex items-center gap-1 justify-center rounded px-2 py-1 group ${isBlocked ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-slate-800'}`}
            onClick={() => handleStartEdit('start', actualStart)}
          >
            <span className={`font-mono text-sm ${actualStart ? 'text-white' : 'text-slate-600'}`}>
              {actualStart || '—'}
            </span>
            {!isBlocked && <Edit2 className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100" />}
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
            className={`flex items-center gap-1 justify-center rounded px-2 py-1 group ${isBlocked ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-slate-800'}`}
            onClick={() => handleStartEdit('end', actualEnd)}
          >
            <span className={`font-mono text-sm ${actualEnd ? 'text-white' : 'text-slate-600'}`}>
              {actualEnd || '—'}
            </span>
            {!isBlocked && <Edit2 className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100" />}
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
        {!isBlocked && status === 'in_progress' && (
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
        {!isBlocked && status === 'pending' && !actualStart && index === 0 && (
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

export default function LiveDirectorPanel({ session, segments, refetchData, currentUser }) {
  const { t, language } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Dialog states
  const [showEnableConfirm, setShowEnableConfirm] = useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [showTakeoverConfirm, setShowTakeoverConfirm] = useState(false);
  const [blockedByDirector, setBlockedByDirector] = useState(null);

  if (!session) return null;

  // Check if current user is the Live Director
  const isCurrentDirector = session.live_director_user_id === currentUser?.id;
  const isBlocked = session.live_adjustment_enabled && 
                    session.live_director_user_id && 
                    session.live_director_user_id !== currentUser?.id;
  
  // If live mode is active and user is NOT the director, show blocked-only view
  if (isBlocked) {
    return (
      <Card className="bg-slate-900 text-white border-none shadow-xl mb-6">
        <CardHeader className="pb-4 px-3 sm:px-6">
          <div className="p-3 sm:p-4 bg-amber-900/50 rounded-lg">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
              <div className="flex items-start sm:items-center gap-3">
                <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" />
                <div>
                  <p className="text-sm sm:text-base font-bold text-amber-200">
                    {language === 'es' ? 'Live Director Activo:' : 'Live Director Active:'}{' '}
                    <span className="text-white">{session.live_director_user_name}</span>
                  </p>
                  <p className="text-xs sm:text-sm text-amber-300/80 mt-1">
                    {language === 'es' 
                      ? 'Debes tomar el control para hacer cambios.' 
                      : 'You must take over to make changes.'}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBlockedByDirector({
                    userId: session.live_director_user_id,
                    userName: session.live_director_user_name
                  });
                  setShowTakeoverConfirm(true);
                }}
                disabled={isLoading}
                className="border-amber-500 text-amber-200 hover:bg-amber-800 w-full sm:w-auto"
              >
                <UserCheck className="w-4 h-4 mr-2" />
                {language === 'es' ? 'Tomar Control' : 'Take Over'}
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Takeover Confirmation Dialog */}
        <AlertDialog open={showTakeoverConfirm} onOpenChange={setShowTakeoverConfirm}>
          <AlertDialogContent className="bg-slate-900 text-white border-slate-700">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-amber-500" />
                {language === 'es' ? 'Tomar Control de Live Director' : 'Take Over Live Director Control'}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-slate-400">
                {language === 'es' 
                  ? `${blockedByDirector?.userName || 'Otro usuario'} es actualmente el Live Director. Si tomas el control, se les notificará que ya no tienen acceso para hacer cambios.`
                  : `${blockedByDirector?.userName || 'Another user'} is currently the Live Director. If you take over, they will be notified that they no longer have control to make changes.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-slate-800 text-white border-slate-600 hover:bg-slate-700">
                {language === 'es' ? 'Cancelar' : 'Cancel'}
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={async () => {
                  setShowTakeoverConfirm(false);
                  setIsLoading(true);
                  try {
                    await base44.functions.invoke('updateLiveSegmentTiming', {
                      sessionId: session.id,
                      action: 'takeover'
                    });
                    toast.success(language === 'es' 
                      ? `Has tomado el control de Live Director` 
                      : `You have taken over Live Director control`);
                    refetchData();
                  } catch (err) {
                    console.error(err);
                    toast.error(t('error.generic'));
                  } finally {
                    setIsLoading(false);
                    setBlockedByDirector(null);
                  }
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {language === 'es' ? 'Confirmar Toma de Control' : 'Confirm Takeover'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    );
  }

  // Sort segments by order
  const sortedSegments = useMemo(() => {
    return [...(segments || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [segments]);

  // Determine current segment (has actual_start but no actual_end)
  const currentSegmentIndex = sortedSegments.findIndex(
    s => s.actual_start_time && !s.actual_end_time
  );

  const handleToggle = async (checked) => {
    if (checked) {
      // Show enable confirmation
      setShowEnableConfirm(true);
    } else {
      // Show disable confirmation
      setShowDisableConfirm(true);
    }
  };

  const confirmEnable = async () => {
    setShowEnableConfirm(false);
    setIsLoading(true);
    try {
      const response = await base44.functions.invoke('updateLiveSegmentTiming', {
        sessionId: session.id,
        action: 'toggle_live_adjustment',
        value: true
      });

      if (response.data?.error === 'blocked') {
        // Someone else is the Live Director
        setBlockedByDirector(response.data.currentDirector);
        setShowTakeoverConfirm(true);
      } else {
        toast.success(t('live.enabled'));
        refetchData();
      }
    } catch (err) {
      console.error(err);
      // Check if it's a 409 conflict (blocked)
      if (err.response?.status === 409) {
        const data = err.response.data;
        setBlockedByDirector(data.currentDirector);
        setShowTakeoverConfirm(true);
      } else {
        toast.error(t('error.generic'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDisable = async () => {
    setShowDisableConfirm(false);
    setIsLoading(true);
    try {
      await base44.functions.invoke('updateLiveSegmentTiming', {
        sessionId: session.id,
        action: 'toggle_live_adjustment',
        value: false
      });
      toast.success(t('live.disabled'));
      refetchData();
    } catch (err) {
      console.error(err);
      toast.error(t('error.generic'));
    } finally {
      setIsLoading(false);
    }
  };

  const confirmTakeover = async () => {
    setShowTakeoverConfirm(false);
    setIsLoading(true);
    try {
      await base44.functions.invoke('updateLiveSegmentTiming', {
        sessionId: session.id,
        action: 'takeover'
      });
      toast.success(language === 'es' 
        ? `Has tomado el control de Live Director` 
        : `You have taken over Live Director control`);
      refetchData();
    } catch (err) {
      console.error(err);
      toast.error(t('error.generic'));
    } finally {
      setIsLoading(false);
      setBlockedByDirector(null);
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
      if (err.response?.status === 409) {
        // Blocked by another user
        const data = err.response.data;
        setBlockedByDirector(data.currentDirector);
        toast.error(language === 'es' 
          ? `Bloqueado: ${data.currentDirector?.userName} es el Live Director actual`
          : `Blocked: ${data.currentDirector?.userName} is the current Live Director`);
      } else {
        toast.error(t('error.generic'));
      }
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
      if (err.response?.status === 409) {
        const data = err.response.data;
        setBlockedByDirector(data.currentDirector);
        toast.error(language === 'es' 
          ? `Bloqueado: ${data.currentDirector?.userName} es el Live Director actual`
          : `Blocked: ${data.currentDirector?.userName} is the current Live Director`);
      } else {
        toast.error(t('error.generic'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Undo last action
  const handleUndo = async () => {
    setIsLoading(true);
    try {
      const response = await base44.functions.invoke('updateLiveSegmentTiming', {
        sessionId: session.id,
        action: 'undo_last'
      });
      
      if (response.data?.error === 'No action to undo') {
        toast.info(language === 'es' ? 'No hay acciones para deshacer' : 'No actions to undo');
      } else {
        toast.success(language === 'es' ? 'Acción deshecha' : 'Action undone');
        refetchData();
      }
    } catch (err) {
      console.error(err);
      if (err.response?.data?.error === 'No action to undo') {
        toast.info(language === 'es' ? 'No hay acciones para deshacer' : 'No actions to undo');
      } else {
        toast.error(t('error.generic'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Card className="bg-slate-900 text-white border-none shadow-xl mb-6">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Switch 
                  id="live-mode" 
                  checked={session.live_adjustment_enabled || false}
                  onCheckedChange={handleToggle}
                  disabled={isLoading || isBlocked}
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

            <div className="flex items-center gap-2">
              {/* Undo button */}
              {session.live_adjustment_enabled && isCurrentDirector && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUndo}
                  disabled={isLoading}
                  className="text-slate-400 hover:text-white border-slate-600 hover:border-slate-500"
                  title={language === 'es' ? 'Deshacer última acción' : 'Undo last action'}
                >
                  <Undo2 className="w-4 h-4" />
                </Button>
              )}

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
          </div>



          {/* Current Director indicator */}
          {session.live_adjustment_enabled && isCurrentDirector && (
            <div className="mt-2 flex items-center gap-2 text-xs text-green-400">
              <UserCheck className="w-4 h-4" />
              <span>{language === 'es' ? 'Eres el Live Director activo' : 'You are the active Live Director'}</span>
            </div>
          )}
        </CardHeader>

        {session.live_adjustment_enabled && isExpanded && (
          <CardContent className="pt-2 px-2 sm:px-6">
            {/* Help text - hidden on mobile to save space */}
            <div className="hidden sm:flex mb-3 p-2 bg-slate-800 rounded text-xs text-slate-400 items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-300">{t('live.manual_mode') || 'Manual Mode'}:</strong>{' '}
                {t('live.manual_instructions') || 'Click any time to edit. "Mark Ended" sets end time to NOW and starts the next segment.'}
              </div>
            </div>

            {/* Mobile: Card-based segment list */}
            <div className="sm:hidden space-y-2">
              {sortedSegments.map((segment, index) => (
                <MobileSegmentCard
                  key={segment.id}
                  segment={segment}
                  index={index}
                  isCurrentSegment={index === currentSegmentIndex}
                  isPastSegment={currentSegmentIndex > -1 && index < currentSegmentIndex}
                  onMarkEnded={handleMarkEnded}
                  onUpdateTime={handleUpdateTime}
                  isLoading={isLoading}
                  isBlocked={isBlocked}
                  t={t}
                  language={language}
                />
              ))}
            </div>

            {/* Desktop: Segments table */}
            <div className="hidden sm:block overflow-x-auto">
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
                      isBlocked={isBlocked}
                      t={t}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Enable Confirmation Dialog */}
      <AlertDialog open={showEnableConfirm} onOpenChange={setShowEnableConfirm}>
        <AlertDialogContent className="bg-slate-900 text-white border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              {language === 'es' ? 'Activar Modo Live Director' : 'Enable Live Director Mode'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {language === 'es' 
                ? 'Esto te dará control exclusivo sobre los tiempos en vivo de esta sesión. Los cambios sobrescribirán los tiempos planificados y serán visibles para todos los usuarios.'
                : 'This will give you exclusive control over live timing for this session. Changes will override planned times and be visible to all users.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 text-white border-slate-600 hover:bg-slate-700">
              {language === 'es' ? 'Cancelar' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmEnable}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {language === 'es' ? 'Activar Live Director' : 'Enable Live Director'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Disable Confirmation Dialog */}
      <AlertDialog open={showDisableConfirm} onOpenChange={setShowDisableConfirm}>
        <AlertDialogContent className="bg-slate-900 text-white border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              {language === 'es' ? 'Desactivar Modo Live Director' : 'Disable Live Director Mode'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {language === 'es' 
                ? '¡Advertencia! Esto reiniciará TODOS los tiempos actuales a los valores planificados originales. Esta acción no se puede deshacer fácilmente.'
                : 'Warning! This will reset ALL actual times back to the original planned values. This action cannot be easily undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 text-white border-slate-600 hover:bg-slate-700">
              {language === 'es' ? 'Cancelar' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDisable}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {language === 'es' ? 'Desactivar y Reiniciar' : 'Disable & Reset'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Takeover Confirmation Dialog */}
      <AlertDialog open={showTakeoverConfirm} onOpenChange={setShowTakeoverConfirm}>
        <AlertDialogContent className="bg-slate-900 text-white border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-amber-500" />
              {language === 'es' ? 'Tomar Control de Live Director' : 'Take Over Live Director Control'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {language === 'es' 
                ? `${blockedByDirector?.userName || 'Otro usuario'} es actualmente el Live Director. Si tomas el control, se les notificará que ya no tienen acceso para hacer cambios.`
                : `${blockedByDirector?.userName || 'Another user'} is currently the Live Director. If you take over, they will be notified that they no longer have control to make changes.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 text-white border-slate-600 hover:bg-slate-700">
              {language === 'es' ? 'Cancelar' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmTakeover}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {language === 'es' ? 'Confirmar Toma de Control' : 'Confirm Takeover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
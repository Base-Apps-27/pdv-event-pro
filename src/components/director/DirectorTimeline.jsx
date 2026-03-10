import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  CheckCircle2, 
  Radio, 
  Clock, 
  Hand,
  Play,
  Square,
  Edit2,
  Check,
  X,
  SkipForward,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { getSegmentFlexibility, isRigidSegment } from '@/components/utils/segmentFlexibility';

/**
 * DirectorTimeline - Main segment list for Director Console
 * Shows all segments with planned/actual times and action buttons
 */
export default function DirectorTimeline({
  segments,
  session,
  currentTime,
  currentUser,
  activeSegmentIndex,
  isCurrentDirector,
  isLocked,
  heldSegment,
  onRefetch,
  language
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [editingSegmentId, setEditingSegmentId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  
  const getNowHHMM = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };
  
  const handleStartSegment = async (segment) => {
    if (!isCurrentDirector) return;
    setIsLoading(true);
    try {
      await base44.functions.invoke('updateLiveSegmentTiming', {
        sessionId: session.id,
        segmentId: segment.id,
        action: 'set_time',
        field: 'actual_start_time',
        value: getNowHHMM()
      });
      toast.success(language === 'es' ? 'Segmento iniciado' : 'Segment started');
      onRefetch();
    } catch (err) {
      console.error(err);
      toast.error(language === 'es' ? 'Error al iniciar' : 'Failed to start');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleMarkEnded = async (segment) => {
    if (!isCurrentDirector) return;
    setIsLoading(true);
    try {
      await base44.functions.invoke('updateLiveSegmentTiming', {
        sessionId: session.id,
        segmentId: segment.id,
        action: 'mark_ended_manual',
        value: getNowHHMM()
      });
      toast.success(`${segment.title} ${language === 'es' ? 'terminado' : 'ended'}`);
      onRefetch();
    } catch (err) {
      console.error(err);
      toast.error(language === 'es' ? 'Error al marcar' : 'Failed to mark');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handlePlaceHold = async (segment) => {
    if (!isCurrentDirector) return;
    setIsLoading(true);
    try {
      await base44.functions.invoke('updateLiveSegmentTiming', {
        sessionId: session.id,
        segmentId: segment.id,
        action: 'place_hold'
      });
      toast.success(language === 'es' ? 'Hold colocado' : 'Hold placed');
      onRefetch();
    } catch (err) {
      console.error(err);
      toast.error(language === 'es' ? 'Error al colocar hold' : 'Failed to place hold');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSaveEdit = async () => {
    if (!editValue.match(/^\d{2}:\d{2}$/)) {
      toast.error('HH:MM format required');
      return;
    }
    setIsLoading(true);
    try {
      await base44.functions.invoke('updateLiveSegmentTiming', {
        sessionId: session.id,
        segmentId: editingSegmentId,
        action: 'set_time',
        field: editingField,
        value: editValue
      });
      toast.success(language === 'es' ? 'Tiempo actualizado' : 'Time updated');
      onRefetch();
    } catch (err) {
      console.error(err);
      toast.error(language === 'es' ? 'Error al actualizar' : 'Failed to update');
    } finally {
      setIsLoading(false);
      setEditingSegmentId(null);
      setEditingField(null);
      setEditValue('');
    }
  };
  
  const startEdit = (segmentId, field, currentValue) => {
    if (!isCurrentDirector || isLocked) return;
    setEditingSegmentId(segmentId);
    setEditingField(field);
    setEditValue(currentValue || '');
  };
  
  const cancelEdit = () => {
    setEditingSegmentId(null);
    setEditingField(null);
    setEditValue('');
  };
  
  // Determine segment status
  const getStatus = (segment, index) => {
    if (segment.live_status === 'skipped') return 'skipped';
    if (segment.live_hold_status === 'held') return 'held';
    if (segment.actual_end_time) return 'completed';
    if (segment.actual_start_time && !segment.actual_end_time) return 'active';
    return 'pending';
  };
  
  // Calculate time diff
  const getTimeDiff = (planned, actual) => {
    if (!planned || !actual) return null;
    const [ph, pm] = planned.split(':').map(Number);
    const [ah, am] = actual.split(':').map(Number);
    return (ah * 60 + am) - (ph * 60 + pm);
  };
  
  const formatDiff = (diff) => {
    if (diff === null || diff === 0) return null;
    const sign = diff > 0 ? '+' : '';
    return `${sign}${diff}m`;
  };
  
  const isDownstreamFrozen = heldSegment !== null;
  
  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-lg flex items-center justify-between">
          <span>{language === 'es' ? 'Línea de Tiempo' : 'Timeline'}</span>
          {isDownstreamFrozen && (
            <Badge className="bg-amber-600 text-white">
              <Hand className="w-3 h-3 mr-1" />
              {language === 'es' ? 'Downstream Congelado' : 'Downstream Frozen'}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* Desktop Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                <th className="px-4 py-3 w-10"></th>
                <th className="px-4 py-3 text-left">{language === 'es' ? 'Segmento' : 'Segment'}</th>
                <th className="px-4 py-3 text-center">{language === 'es' ? 'Plan Inicio' : 'Plan Start'}</th>
                <th className="px-4 py-3 text-center">{language === 'es' ? 'Plan Fin' : 'Plan End'}</th>
                <th className="px-4 py-3 text-center">{language === 'es' ? 'Actual Inicio' : 'Actual Start'}</th>
                <th className="px-4 py-3 text-center">{language === 'es' ? 'Actual Fin' : 'Actual End'}</th>
                <th className="px-4 py-3 text-center">{language === 'es' ? 'Flex' : 'Flex'}</th>
                <th className="px-4 py-3 w-36"></th>
              </tr>
            </thead>
            <tbody>
              {segments.map((segment, index) => {
                const status = getStatus(segment, index);
                const flex = getSegmentFlexibility(segment.segment_type);
                const rigid = isRigidSegment(segment.segment_type);
                const startDiff = getTimeDiff(segment.start_time, segment.actual_start_time);
                const endDiff = getTimeDiff(segment.end_time, segment.actual_end_time);
                const isEditing = editingSegmentId === segment.id;
                
                // Row styling
                let rowClass = 'border-b border-slate-800 transition-colors';
                if (status === 'active') rowClass += ' bg-amber-900/30 border-l-4 border-l-amber-500';
                else if (status === 'held') rowClass += ' bg-teal-900/30 border-l-4 border-l-teal-500';
                else if (status === 'completed') rowClass += ' bg-green-900/10';
                else if (status === 'skipped') rowClass += ' opacity-40 line-through';
                else if (isDownstreamFrozen && status === 'pending') rowClass += ' opacity-50';
                
                return (
                  <tr key={segment.id} className={rowClass}>
                    {/* Status icon */}
                    <td className="px-4 py-3">
                      {status === 'completed' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                      {status === 'active' && <Radio className="w-5 h-5 text-amber-500 animate-pulse" />}
                      {status === 'held' && <Hand className="w-5 h-5 text-teal-500" />}
                      {status === 'skipped' && <SkipForward className="w-5 h-5 text-slate-500" />}
                      {status === 'pending' && <Clock className="w-5 h-5 text-slate-600" />}
                    </td>
                    
                    {/* Segment info with order position */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-slate-700 text-white text-xs font-semibold">{index + 1}/{segments.length}</Badge>
                        <span className="text-white font-medium">{segment.title}</span>
                        {segment.segment_type && (
                          <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                            {segment.segment_type}
                          </Badge>
                        )}
                        {segment.timing_source === 'director' && (
                          <Badge className="bg-blue-600 text-white text-[10px]">DIR</Badge>
                        )}
                      </div>
                      {segment.presenter && (
                        <div className="text-xs text-slate-500 mt-0.5">{segment.presenter}</div>
                      )}
                    </td>
                    
                    {/* Planned times */}
                    <td className="px-4 py-3 text-center font-mono text-slate-400">
                      {segment.start_time || '—'}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-slate-400">
                      {segment.end_time || '—'}
                    </td>
                    
                    {/* Actual start - editable */}
                    <td className="px-4 py-3 text-center">
                      {isEditing && editingField === 'actual_start_time' ? (
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
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEdit}>
                            <X className="w-3 h-3 text-red-500" />
                          </Button>
                        </div>
                      ) : (
                        <div 
                          className={`flex items-center gap-1 justify-center rounded px-2 py-1 group ${isCurrentDirector && !isLocked ? 'cursor-pointer hover:bg-slate-800' : ''}`}
                          onClick={() => isCurrentDirector && !isLocked && startEdit(segment.id, 'actual_start_time', segment.actual_start_time)}
                        >
                          <span className={`font-mono ${segment.actual_start_time ? 'text-white' : 'text-slate-600'}`}>
                            {segment.actual_start_time || '—'}
                          </span>
                          {isCurrentDirector && !isLocked && <Edit2 className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100" />}
                          {startDiff !== null && (
                            <span className={`text-xs ml-1 ${startDiff > 0 ? 'text-red-400' : 'text-green-400'}`}>
                              {formatDiff(startDiff)}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    
                    {/* Actual end - editable */}
                    <td className="px-4 py-3 text-center">
                      {isEditing && editingField === 'actual_end_time' ? (
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
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEdit}>
                            <X className="w-3 h-3 text-red-500" />
                          </Button>
                        </div>
                      ) : (
                        <div 
                          className={`flex items-center gap-1 justify-center rounded px-2 py-1 group ${isCurrentDirector && !isLocked ? 'cursor-pointer hover:bg-slate-800' : ''}`}
                          onClick={() => isCurrentDirector && !isLocked && startEdit(segment.id, 'actual_end_time', segment.actual_end_time)}
                        >
                          <span className={`font-mono ${segment.actual_end_time ? 'text-white' : 'text-slate-600'}`}>
                            {segment.actual_end_time || '—'}
                          </span>
                          {isCurrentDirector && !isLocked && <Edit2 className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100" />}
                          {endDiff !== null && (
                            <span className={`text-xs ml-1 ${endDiff > 0 ? 'text-red-400' : 'text-green-400'}`}>
                              {formatDiff(endDiff)}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    
                    {/* Flexibility label */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className={`text-xs font-semibold ${rigid ? 'text-red-500' : flex.score >= 8 ? 'text-green-600' : 'text-slate-500'}`}>
                          {rigid ? 'Sin flexibilidad' : flex.score >= 8 ? 'Muy flexible' : 'Algo flexible'}
                        </span>
                        {rigid && <AlertTriangle className="w-3 h-3 text-red-500" />}
                      </div>
                    </td>
                    
                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      {isCurrentDirector && !isLocked && status === 'pending' && !isDownstreamFrozen && index === activeSegmentIndex + 1 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStartSegment(segment)}
                          disabled={isLoading}
                          className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
                        >
                          <Play className="w-3 h-3 mr-1" />
                          {language === 'es' ? 'Iniciar' : 'Start'}
                        </Button>
                      )}
                      
                      {isCurrentDirector && !isLocked && status === 'active' && !heldSegment && (
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePlaceHold(segment)}
                            disabled={isLoading}
                            className="border-teal-700 text-teal-400 hover:bg-teal-900/30 text-xs"
                          >
                            <Hand className="w-3 h-3 mr-1" />
                            Hold
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleMarkEnded(segment)}
                            disabled={isLoading}
                            className="text-xs"
                          >
                            <Square className="w-3 h-3 mr-1" />
                            {language === 'es' ? 'Fin' : 'End'}
                          </Button>
                        </div>
                      )}
                      
                      {status === 'held' && (
                        <Badge className="bg-teal-600 text-white hover:bg-teal-700">
                          <Hand className="w-3 h-3 mr-1" />
                          {language === 'es' ? 'En Hold' : 'On Hold'}
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* Mobile Cards */}
        <div className="sm:hidden space-y-2 p-3">
          {segments.map((segment, index) => {
            const status = getStatus(segment, index);
            const flex = getSegmentFlexibility(segment.segment_type);
            const rigid = isRigidSegment(segment.segment_type);
            
            let cardClass = 'p-3 rounded-lg border transition-colors ';
            if (status === 'active') cardClass += 'bg-amber-900/40 border-amber-500';
            else if (status === 'held') cardClass += 'bg-teal-900/40 border-teal-500';
            else if (status === 'completed') cardClass += 'bg-green-900/20 border-green-700';
            else if (status === 'skipped') cardClass += 'opacity-40 bg-slate-800 border-slate-700';
            else cardClass += 'bg-slate-800 border-slate-700';
            
            return (
              <div key={segment.id} className={cardClass}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {status === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                    {status === 'active' && <Radio className="w-4 h-4 text-amber-500 animate-pulse" />}
                    {status === 'held' && <Hand className="w-4 h-4 text-teal-500" />}
                    {status === 'pending' && <Clock className="w-4 h-4 text-slate-500" />}
                    <Badge className="bg-slate-600 text-white text-[10px] font-semibold">{index + 1}/{segments.length}</Badge>
                    <span className="text-sm font-medium text-white">{segment.title}</span>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${rigid ? 'border-red-600 text-red-500' : 'border-slate-600 text-slate-500'}`}>
                   {rigid ? 'Sin flexibilidad' : flex.score >= 8 ? 'Muy flexible' : 'Algo flexible'}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                  <div className="bg-slate-900/50 rounded p-2">
                    <div className="text-slate-500 mb-1">{language === 'es' ? 'Plan' : 'Plan'}</div>
                    <div className="font-mono text-slate-400">{segment.start_time || '—'} - {segment.end_time || '—'}</div>
                  </div>
                  <div className="bg-slate-900/50 rounded p-2">
                    <div className="text-slate-500 mb-1">{language === 'es' ? 'Actual' : 'Actual'}</div>
                    <div className="font-mono text-white">
                      {segment.actual_start_time || '—'} - {segment.actual_end_time || '—'}
                    </div>
                  </div>
                </div>
                
                {/* Mobile actions */}
                {isCurrentDirector && !isLocked && status === 'active' && !heldSegment && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePlaceHold(segment)}
                      disabled={isLoading}
                      className="flex-1 border-teal-700 text-teal-400 hover:bg-teal-900/30 text-xs"
                    >
                      <Hand className="w-3 h-3 mr-1" /> Hold
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleMarkEnded(segment)}
                      disabled={isLoading}
                      className="flex-1 text-xs"
                    >
                      <Square className="w-3 h-3 mr-1" /> {language === 'es' ? 'Fin' : 'End'}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
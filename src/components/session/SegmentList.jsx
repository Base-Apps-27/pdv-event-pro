import React, { useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Music, MessageSquare, Languages, ListOrdered, Circle, Users, AlertTriangle, Bookmark, Copy, Clock, ChevronUp, ChevronDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatTimeToEST } from "@/components/utils/timeFormat";
import { getSegmentData } from "@/components/utils/segmentDataUtils";
import { logDelete, logReorder } from "@/components/utils/editActionLogger";

export default function SegmentList({ segments, sessionId, onEdit, onEditPreSession, user }) {
  const queryClient = useQueryClient();

  const { data: allActions = [] } = useQuery({
    queryKey: ['segmentActions'],
    queryFn: () => base44.entities.SegmentAction.list(),
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => base44.entities.Room.list(),
  });

  const { data: preSessionDetails = [] } = useQuery({
    queryKey: ['preSessionDetails', sessionId],
    queryFn: () => base44.entities.PreSessionDetails.filter({ session_id: sessionId }),
    enabled: !!sessionId,
  });

  const getRoomName = (roomId) => {
    const room = rooms.find(r => r.id === roomId);
    return room ? room.name : "";
  };

  const deleteMutation = useMutation({
    mutationFn: async (segmentToDelete) => {
      await base44.entities.Segment.delete(segmentToDelete.id);
      await logDelete('Segment', segmentToDelete, sessionId, user);
    },
    onSuccess: () => {
      // CRITICAL: Invalidate ALL segment queries (parent uses eventId, child uses sessionId)
      queryClient.invalidateQueries({ queryKey: ['segments'] });
      queryClient.invalidateQueries(['editActionLogs']);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ segmentId, newOrder }) => {
      return base44.entities.Segment.update(segmentId, { order: newOrder });
    },
    onSuccess: () => {
      // CRITICAL: Invalidate ALL segment queries (parent uses eventId, child uses sessionId)
      queryClient.invalidateQueries({ queryKey: ['segments'] });
    },
  });

  // One-time normalization: if orders are missing/duplicated, renumber sequentially
  const normalizedOnce = React.useRef(false);
  React.useEffect(() => {
    if (normalizedOnce.current || !segments || segments.length === 0) return;
    const orders = segments.map(s => Number(s.order) || 0);
    const hasDup = new Set(orders).size !== segments.length;
    const hasZero = orders.some(o => o === 0);
    if (hasDup || hasZero) {
      Promise.all(
        segments.map((s, i) => reorderMutation.mutateAsync({ segmentId: s.id, newOrder: i + 1 }))
      ).then(() => { normalizedOnce.current = true; }).catch(() => {});
    }
  }, [segments]);

  const handleMoveSegment = async (index, direction) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= segments.length) return;

    // Build a new order sequence by moving the element, then renumber 1..n
    const newList = [...segments];
    const [moved] = newList.splice(index, 1);
    newList.splice(targetIndex, 0, moved);

    // Log the reorder for the moved segment
    const movedSegment = segments[index];
    const oldOrder = movedSegment.order || index + 1;
    const newOrder = targetIndex + 1;
    
    await Promise.all(
      newList.map((s, i) => reorderMutation.mutateAsync({ segmentId: s.id, newOrder: i + 1 }))
    );
    
    // Log after successful reorder
    await logReorder('Segment', movedSegment.id, oldOrder, newOrder, sessionId, user, movedSegment.title);
    queryClient.invalidateQueries(['editActionLogs']);
  };

  const getSegmentActions = (segmentId) => {
    return allActions.filter(action => action.segment_id === segmentId);
  };

  const colorSchemes = {
    worship: "bg-purple-100 text-purple-800 border-purple-200",
    preach: "bg-orange-100 text-orange-800 border-orange-200",
    break: "bg-gray-100 text-gray-800 border-gray-200",
    tech: "bg-blue-100 text-blue-800 border-blue-200",
    special: "bg-pink-100 text-pink-800 border-pink-200",
    default: "bg-slate-100 text-slate-700 border-slate-200"
  };

  // Convert HH:MM to minutes since midnight for proper comparison
  const timeToMinutes = (timeStr) => {
    if (!timeStr) return null;
    const [hours, minutes] = String(timeStr).split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return null;
    return hours * 60 + minutes;
  };

  const checkTimingIssues = (segment, index) => {
    const issues = [];
    
    if (!segment.start_time || !segment.end_time) return issues;
    
    const segStartMin = timeToMinutes(segment.start_time);
    const segEndMin = timeToMinutes(segment.end_time);
    if (segStartMin === null || segEndMin === null) return issues;
    
    // Check if out of order with previous segment (immediate predecessor only)
    if (index > 0) {
      const prevSegment = segments[index - 1];
      const prevEndMin = timeToMinutes(prevSegment.end_time);
      if (prevEndMin !== null && segStartMin < prevEndMin) {
        issues.push({
          type: 'out-of-order',
          message: `Inicia antes del fin del segmento anterior (${formatTimeToEST(prevSegment.end_time)})`
        });
      }
    }
    
    // Check overlaps only with previous segments (not future ones)
    for (let i = 0; i < index; i++) {
      const prevSegment = segments[i];
      const prevStartMin = timeToMinutes(prevSegment.start_time);
      const prevEndMin = timeToMinutes(prevSegment.end_time);
      if (prevStartMin === null || prevEndMin === null) continue;
      
      // Check for overlap with previous segment using numeric comparison
      if ((segStartMin >= prevStartMin && segStartMin < prevEndMin) ||
          (segEndMin > prevStartMin && segEndMin <= prevEndMin) ||
          (segStartMin <= prevStartMin && segEndMin >= prevEndMin)) {
        issues.push({
          type: 'overlap',
          message: `Se solapa con "${prevSegment.title}" (${formatTimeToEST(prevSegment.start_time)} - ${formatTimeToEST(prevSegment.end_time)})`
        });
      }
    }
    
    return issues;
  };

  const preSession = preSessionDetails.length > 0 ? preSessionDetails[0] : null;

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="w-12">#</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Título / Responsable</TableHead>
              <TableHead className="w-32">Contenido</TableHead>
              <TableHead className="w-24">Sala</TableHead>
              <TableHead className="w-20 text-center">Notas</TableHead>
              <TableHead className="w-24">Inicio</TableHead>
              <TableHead className="w-20">Dur.</TableHead>
              <TableHead className="w-12">Prep</TableHead>
              <TableHead className="w-32">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
                <TableRow className={`${preSession ? 'bg-blue-50 hover:bg-blue-100' : 'bg-gray-50 hover:bg-gray-100'} border-l-4 ${preSession ? 'border-blue-500' : 'border-gray-300'}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${preSession ? 'text-blue-700' : 'text-gray-400'}`}>0</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${preSession ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-gray-100 text-gray-600 border-gray-200'} border text-xs whitespace-nowrap`}>
                      Pre-Sesión
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className={`font-semibold ${preSession ? 'text-slate-900' : 'text-gray-400'} flex items-center gap-2`}>
                        {preSession ? 'Preparación Pre-Sesión' : 'Pre-Sesión (vacío)'}
                        {preSession?.origin === 'template' && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="outline" className="h-5 px-1 bg-blue-50 text-blue-600 border-blue-200 text-[10px]">
                                  <Bookmark className="w-3 h-3 mr-1" />
                                  Plantilla
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Detalles desde plantilla</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      {preSession && (
                        <div className="text-xs text-slate-600 mt-0.5">
                          {preSession.music_profile_id && `Música: ${preSession.music_profile_id}`}
                          {preSession.music_profile_id && preSession.slide_pack_id && " • "}
                          {preSession.slide_pack_id && `Slides: ${preSession.slide_pack_id}`}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {preSession && (preSession.registration_desk_open_time || preSession.library_open_time) && (
                      <div className="flex flex-wrap gap-1 text-xs text-slate-600">
                        <span>Horarios apertura</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-slate-600">-</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-center">
                      {preSession && (preSession.facility_notes || preSession.general_notes) && (
                        <Circle className="w-2 h-2 fill-blue-500 text-blue-500" title="Notas disponibles" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {preSession?.registration_desk_open_time ? formatTimeToEST(preSession.registration_desk_open_time) : '-'}
                  </TableCell>
                  <TableCell className="text-sm">-</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => onEditPreSession && onEditPreSession()}>
                      <Edit className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
                {segments.map((segment, index) => {
            const getData = (field) => getSegmentData(segment, field);
            const actionCount = getSegmentActions(segment.id).length;
            const hasProjectionNotes = !!getData('projection_notes');
            const hasSoundNotes = !!getData('sound_notes');
            const hasUshersNotes = !!getData('ushers_notes');
            const timingIssues = checkTimingIssues(segment, index);

            return (
              <TableRow key={segment.id} className="hover:bg-slate-50">
                <TableCell>
                  <div className="flex items-center gap-1">
                    <div className="flex flex-col">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMoveSegment(index, 'up')}
                        disabled={index === 0}
                        className="h-4 w-5 p-0 hover:bg-blue-100"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMoveSegment(index, 'down')}
                        disabled={index === segments.length - 1}
                        className="h-4 w-5 p-0 hover:bg-blue-100"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                    </div>
                    <span className="font-medium text-sm">{index + 1}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <Badge className={`${colorSchemes[segment.color_code || 'default']} border text-xs whitespace-nowrap`}>
                      {segment.segment_type}
                    </Badge>
                    {segment.segment_type === "Breakout" && segment.breakout_rooms && (
                      <Badge variant="outline" className="text-xs gap-1 bg-amber-50 border-amber-300">
                        <Users className="w-3 h-3" />
                        {segment.breakout_rooms.length} salas
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-semibold text-slate-900">{segment.title}</div>
                      {segment.origin === 'template' && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="h-5 px-1 bg-blue-50 text-blue-600 border-blue-200 text-[10px]">
                                <Bookmark className="w-3 h-3 mr-1" />
                                Plantilla
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Desde plantilla</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {segment.origin === 'duplicate' && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="h-5 px-1 bg-amber-50 text-amber-600 border-amber-200 text-[10px]">
                                <Copy className="w-3 h-3 mr-1" />
                                Copia
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Duplicado</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    {getData('presenter') && (
                      <div className="text-xs text-slate-600 mt-0.5">
                        {segment.segment_type === "Alabanza" ? "Líder: " : segment.segment_type === "Plenaria" ? "Predicador: " : ['Break', 'Receso', 'Almuerzo'].includes(segment.segment_type) ? "Encargado: " : ""}
                        {getData('presenter')}
                      </div>
                    )}
                    {/* Break type visual badge */}
                    {['Receso', 'Almuerzo'].includes(segment.segment_type) && (
                      <div className={`inline-flex items-center gap-1 text-xs mt-1 px-1.5 py-0.5 rounded ${segment.segment_type === 'Almuerzo' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-700'}`}>
                        <span>{segment.segment_type === 'Almuerzo' ? '🍽️' : '☕'}</span>
                        <span className="font-semibold">{segment.duration_min}m</span>
                      </div>
                    )}
                    {segment.segment_type === "Plenaria" && getData('message_title') && (
                      <div className="text-xs text-blue-600 mt-0.5 italic">{getData('message_title')}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {segment.segment_type === "Alabanza" && getData('number_of_songs') > 0 && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <Music className="w-3 h-3" />
                        {getData('number_of_songs')}
                      </Badge>
                    )}
                    {segment.segment_type === "Plenaria" && getData('message_title') && (
                      <Badge variant="outline" className="text-xs gap-1" title={getData('message_title')}>
                        <MessageSquare className="w-3 h-3" />
                        Mensaje
                      </Badge>
                    )}
                    {getData('requires_translation') && (
                      <Badge variant="outline" className="text-xs gap-1 bg-purple-50">
                        <Languages className="w-3 h-3" />
                      </Badge>
                    )}
                    {actionCount > 0 && (
                      <Badge variant="outline" className="text-xs gap-1 bg-blue-50">
                        <ListOrdered className="w-3 h-3" />
                        {actionCount}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-xs text-slate-600">
                    {segment.room_id ? getRoomName(segment.room_id) : "-"}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-center">
                    {hasProjectionNotes && (
                      <Circle className="w-2 h-2 fill-purple-500 text-purple-500" title="Notas de Proyección" />
                    )}
                    {hasSoundNotes && (
                      <Circle className="w-2 h-2 fill-red-500 text-red-500" title="Notas de Sonido" />
                    )}
                    {hasUshersNotes && (
                      <Circle className="w-2 h-2 fill-green-500 text-green-500" title="Notas de Ujieres" />
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  <div className="flex items-center gap-1">
                    {timingIssues.length > 0 && (
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" title={timingIssues.map(i => i.message).join('\n')} />
                    )}
                    <div>
                      <div>{segment.start_time ? formatTimeToEST(segment.start_time) : "-"}</div>
                      {segment.stage_call_time && (
                        <div className="text-xs text-blue-600">↓ {formatTimeToEST(segment.stage_call_time)}</div>
                      )}
                    </div>
                  </div>
                  {timingIssues.length > 0 && (
                    <div className="text-xs text-red-600 mt-1">
                      {timingIssues.map((issue, idx) => (
                        <div key={idx} className="truncate" title={issue.message}>
                          {issue.type === 'overlap' ? '⚠️ Solapa' : '⚠️ Fuera de orden'}
                        </div>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm">{segment.duration_min ? `${segment.duration_min}m` : "-"}</TableCell>
                <TableCell className="text-center">
                {segment.prep_instructions && (
                  <Circle className="w-2 h-2 fill-amber-500 text-amber-500 mx-auto" title={segment.prep_instructions} />
                )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onEdit(segment)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        if (confirm('¿Eliminar este segmento?')) {
                          deleteMutation.mutate(segment);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {/* Pre-Session Card */}
        <div className={`p-4 rounded-lg border-l-4 ${preSession ? 'bg-blue-50 border-blue-500' : 'bg-gray-50 border-gray-300'}`}>
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <Badge className={`${preSession ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-gray-100 text-gray-600 border-gray-200'} border text-xs mb-2`}>
                Pre-Sesión
              </Badge>
              <h4 className={`font-semibold text-sm ${preSession ? 'text-slate-900' : 'text-gray-400'}`}>
                {preSession ? 'Preparación Pre-Sesión' : 'Pre-Sesión (vacío)'}
              </h4>
              {preSession && (
                <p className="text-xs text-slate-600 mt-1">
                  {preSession.registration_desk_open_time ? `Apertura: ${formatTimeToEST(preSession.registration_desk_open_time)}` : ''}
                </p>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => onEditPreSession && onEditPreSession()}>
              <Edit className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Segment Cards */}
        <div className="space-y-3">
          {segments.map((segment, index) => {
            const getData = (field) => getSegmentData(segment, field);
            const actionCount = getSegmentActions(segment.id).length;
            const hasProjectionNotes = !!getData('projection_notes');
            const hasSoundNotes = !!getData('sound_notes');
            const hasUshersNotes = !!getData('ushers_notes');
            const timingIssues = checkTimingIssues(segment, index);

            return (
              <div key={segment.id} className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="flex gap-2">
                  <div className="flex flex-col gap-0.5 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMoveSegment(index, 'up')}
                      disabled={index === 0}
                      className="h-5 w-6 p-0 hover:bg-blue-100"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMoveSegment(index, 'down')}
                      disabled={index === segments.length - 1}
                      className="h-5 w-6 p-0 hover:bg-blue-100"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </div>
                          
                          {/* Left Column - Main Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-slate-600 text-sm">#{index + 1}</span>
                              <Badge className={`${colorSchemes[segment.color_code || 'default']} border text-xs`}>
                                {segment.segment_type}
                              </Badge>
                              {segment.segment_type === "Breakout" && segment.breakout_rooms && (
                                <Badge variant="outline" className="text-xs gap-1 bg-amber-50 border-amber-300">
                                  <Users className="w-3 h-3" />
                                  {segment.breakout_rooms.length}
                                </Badge>
                              )}
                            </div>
                            <h4 className="font-semibold text-sm text-slate-900 line-clamp-1">{segment.title}</h4>
                            {getData('presenter') && (
                              <p className="text-xs text-slate-600 mt-0.5 line-clamp-1">
                                {segment.segment_type === "Alabanza" ? "L: " : segment.segment_type === "Plenaria" ? "P: " : ['Break', 'Receso', 'Almuerzo'].includes(segment.segment_type) ? "Enc: " : ""}
                                {getData('presenter')}
                              </p>
                            )}
                            {/* Break type visual badge - mobile */}
                            {['Receso', 'Almuerzo'].includes(segment.segment_type) && (
                              <div className={`inline-flex items-center gap-1 text-xs mt-1 px-1.5 py-0.5 rounded ${segment.segment_type === 'Almuerzo' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-700'}`}>
                                <span>{segment.segment_type === 'Almuerzo' ? '🍽️' : '☕'}</span>
                                <span className="font-semibold">{segment.duration_min}m</span>
                              </div>
                            )}
                            {segment.segment_type === "Plenaria" && getData('message_title') && (
                              <p className="text-xs text-blue-600 mt-0.5 italic line-clamp-1">{getData('message_title')}</p>
                            )}
                            
                            {/* Content Badges */}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {segment.segment_type === "Alabanza" && getData('number_of_songs') > 0 && (
                                <Badge variant="outline" className="text-xs gap-1">
                                  <Music className="w-3 h-3" />
                                  {getData('number_of_songs')}
                                </Badge>
                              )}
                              {getData('requires_translation') && (
                                <Badge variant="outline" className="text-xs gap-1 bg-purple-50">
                                  <Languages className="w-3 h-3" />
                                </Badge>
                              )}
                              {actionCount > 0 && (
                                <Badge variant="outline" className="text-xs gap-1 bg-blue-50">
                                  <ListOrdered className="w-3 h-3" />
                                  {actionCount}
                                </Badge>
                              )}
                              {(hasProjectionNotes || hasSoundNotes || hasUshersNotes) && (
                                <Badge variant="outline" className="text-xs gap-1">
                                  <MessageSquare className="w-3 h-3" />
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Right Column - Time & Actions */}
                          <div className="flex flex-col items-end justify-between gap-2 min-w-[80px]">
                            <div className="text-right">
                              <div className="flex items-center gap-1 justify-end font-mono text-sm font-semibold text-slate-900">
                                {timingIssues.length > 0 && (
                                  <AlertTriangle className="w-3 h-3 text-red-500" />
                                )}
                                {segment.start_time ? formatTimeToEST(segment.start_time) : "-"}
                              </div>
                              {segment.duration_min && (
                                <div className="text-xs text-slate-500 mt-0.5">
                                  • {segment.duration_min}min
                                </div>
                              )}
                              {segment.end_time && (
                                <div className="text-xs text-slate-400 font-mono">
                                  → {formatTimeToEST(segment.end_time)}
                                </div>
                              )}
                              {segment.stage_call_time && (
                                <div className="text-xs text-blue-600 font-mono mt-0.5">
                                  ↓ {formatTimeToEST(segment.stage_call_time)}
                                </div>
                              )}
                              {segment.room_id && (
                                <div className="text-xs text-slate-500 mt-1">
                                  {getRoomName(segment.room_id)}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex gap-1">
                              <Button variant="outline" size="sm" onClick={() => onEdit(segment)} className="h-7 px-2">
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => {
                                  if (confirm('¿Eliminar este segmento?')) {
                                    deleteMutation.mutate(segment);
                                  }
                                }}
                                className="h-7 px-2"
                              >
                                <Trash2 className="w-3 h-3 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                );
              })}
            </div>
      </div>
    </>
  );
}
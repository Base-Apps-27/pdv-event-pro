import React from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, GripVertical, Music, MessageSquare, Languages, ListOrdered, Circle, Users, AlertTriangle, Bookmark, Copy, Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatTimeToEST } from "@/components/utils/timeFormat";

export default function SegmentList({ segments, sessionId, onEdit, onEditPreSession }) {
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
    mutationFn: (id) => base44.entities.Segment.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['segments', sessionId]);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ segmentId, newOrder }) => {
      return base44.entities.Segment.update(segmentId, { order: newOrder });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['segments', sessionId]);
    },
  });

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    
    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;
    
    if (sourceIndex === destIndex) return;

    const reorderedSegments = Array.from(segments);
    const [movedSegment] = reorderedSegments.splice(sourceIndex, 1);
    reorderedSegments.splice(destIndex, 0, movedSegment);

    // Update orders only - don't recalculate times
    const updates = reorderedSegments.map((seg, index) => ({
      segmentId: seg.id,
      newOrder: index + 1
    }));

    await Promise.all(updates.map(update => reorderMutation.mutateAsync(update)));
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

  const checkTimingIssues = (segment, index) => {
    const issues = [];
    
    if (!segment.start_time || !segment.end_time) return issues;
    
    // Check if out of order with previous segment
    if (index > 0) {
      const prevSegment = segments[index - 1];
      if (prevSegment.end_time && segment.start_time < prevSegment.end_time) {
        issues.push({
          type: 'out-of-order',
          message: `Inicia antes del fin del segmento anterior (${formatTimeToEST(prevSegment.end_time)})`
        });
      }
    }
    
    // Check overlaps only with previous segments (not future ones)
    for (let i = 0; i < index; i++) {
      const prevSegment = segments[i];
      if (!prevSegment.start_time || !prevSegment.end_time) continue;
      
      const segStart = segment.start_time;
      const segEnd = segment.end_time;
      const prevStart = prevSegment.start_time;
      const prevEnd = prevSegment.end_time;
      
      // Check for overlap with previous segment
      if ((segStart >= prevStart && segStart < prevEnd) ||
          (segEnd > prevStart && segEnd <= prevEnd) ||
          (segStart <= prevStart && segEnd >= prevEnd)) {
        issues.push({
          type: 'overlap',
          message: `Se solapa con "${prevSegment.title}" (${formatTimeToEST(prevStart)} - ${formatTimeToEST(prevEnd)})`
        });
      }
    }
    
    return issues;
  };

  const preSession = preSessionDetails.length > 0 ? preSessionDetails[0] : null;

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
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
              <TableHead className="w-24">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <Droppable droppableId="segments">
            {(provided) => (
              <TableBody ref={provided.innerRef} {...provided.droppableProps}>
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
            const actionCount = getSegmentActions(segment.id).length;
            const hasProjectionNotes = !!segment.projection_notes;
            const hasSoundNotes = !!segment.sound_notes;
            const hasUshersNotes = !!segment.ushers_notes;
            const timingIssues = checkTimingIssues(segment, index);

            return (
              <Draggable key={segment.id} draggableId={segment.id} index={index}>
                {(provided, snapshot) => (
                  <TableRow 
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={`hover:bg-slate-50 ${snapshot.isDragging ? 'bg-blue-50' : ''}`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2" {...provided.dragHandleProps}>
                        <GripVertical className="w-4 h-4 text-slate-400 cursor-grab active:cursor-grabbing" />
                        <span className="font-medium">{segment.order}</span>
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
                    {segment.presenter && (
                      <div className="text-xs text-slate-600 mt-0.5">
                        {segment.segment_type === "Alabanza" ? "Líder: " : segment.segment_type === "Plenaria" ? "Predicador: " : ""}
                        {segment.presenter}
                      </div>
                    )}
                    {segment.segment_type === "Plenaria" && segment.message_title && (
                      <div className="text-xs text-blue-600 mt-0.5 italic">{segment.message_title}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {segment.segment_type === "Alabanza" && segment.number_of_songs > 0 && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <Music className="w-3 h-3" />
                        {segment.number_of_songs}
                      </Badge>
                    )}
                    {segment.segment_type === "Plenaria" && segment.message_title && (
                      <Badge variant="outline" className="text-xs gap-1" title={segment.message_title}>
                        <MessageSquare className="w-3 h-3" />
                        Mensaje
                      </Badge>
                    )}
                    {segment.requires_translation && (
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
                          deleteMutation.mutate(segment.id);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
                  </TableRow>
                )}
              </Draggable>
            );
          })}
          {provided.placeholder}
              </TableBody>
            )}
          </Droppable>
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
        <Droppable droppableId="segments-mobile">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
              {segments.map((segment, index) => {
                const actionCount = getSegmentActions(segment.id).length;
                const hasProjectionNotes = !!segment.projection_notes;
                const hasSoundNotes = !!segment.sound_notes;
                const hasUshersNotes = !!segment.ushers_notes;
                const timingIssues = checkTimingIssues(segment, index);

                return (
                  <Draggable key={segment.id} draggableId={segment.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`p-4 bg-white rounded-lg border border-gray-200 ${snapshot.isDragging ? 'shadow-lg' : 'shadow-sm'}`}
                      >
                        <div className="flex items-start gap-3">
                          <div {...provided.dragHandleProps} className="pt-1">
                            <GripVertical className="w-5 h-5 text-slate-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            {/* Header */}
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="font-bold text-slate-600 text-sm">#{segment.order}</span>
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
                                <h4 className="font-semibold text-sm text-slate-900 truncate">{segment.title}</h4>
                                {segment.presenter && (
                                  <p className="text-xs text-slate-600 mt-0.5 truncate">
                                    {segment.segment_type === "Alabanza" ? "Líder: " : segment.segment_type === "Plenaria" ? "Predicador: " : ""}
                                    {segment.presenter}
                                  </p>
                                )}
                                {segment.segment_type === "Plenaria" && segment.message_title && (
                                  <p className="text-xs text-blue-600 mt-0.5 italic truncate">{segment.message_title}</p>
                                )}
                              </div>
                            </div>

                            {/* Time & Duration */}
                            <div className="flex items-center gap-3 text-xs text-slate-600 mb-2">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span className="font-mono">{segment.start_time ? formatTimeToEST(segment.start_time) : "-"}</span>
                              </div>
                              {segment.duration_min && (
                                <span className="text-slate-500">• {segment.duration_min}min</span>
                              )}
                              {timingIssues.length > 0 && (
                                <AlertTriangle className="w-4 h-4 text-red-500" title={timingIssues.map(i => i.message).join('\n')} />
                              )}
                            </div>

                            {/* Content Badges */}
                            <div className="flex flex-wrap gap-1 mb-3">
                              {segment.segment_type === "Alabanza" && segment.number_of_songs > 0 && (
                                <Badge variant="outline" className="text-xs gap-1">
                                  <Music className="w-3 h-3" />
                                  {segment.number_of_songs}
                                </Badge>
                              )}
                              {segment.requires_translation && (
                                <Badge variant="outline" className="text-xs gap-1 bg-purple-50">
                                  <Languages className="w-3 h-3" />
                                  Trad.
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
                                  Notas
                                </Badge>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 pt-2 border-t border-gray-100">
                              <Button variant="outline" size="sm" onClick={() => onEdit(segment)} className="flex-1 h-8 text-xs">
                                <Edit className="w-3 h-3 mr-1" />
                                Editar
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => {
                                  if (confirm('¿Eliminar este segmento?')) {
                                    deleteMutation.mutate(segment.id);
                                  }
                                }}
                                className="h-8 px-2"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </div>
    </DragDropContext>
  );
}
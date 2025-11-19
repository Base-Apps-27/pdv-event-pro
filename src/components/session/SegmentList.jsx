import React from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, GripVertical, Music, MessageSquare, Languages, ListOrdered, Circle, Users, AlertTriangle } from "lucide-react";
import { formatTimeToEST } from "@/components/utils/timeFormat";

export default function SegmentList({ segments, sessionId, onEdit }) {
  const queryClient = useQueryClient();

  const { data: allActions = [] } = useQuery({
    queryKey: ['segmentActions'],
    queryFn: () => base44.entities.SegmentAction.list(),
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => base44.entities.Room.list(),
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

  const recalculateTimesMutation = useMutation({
    mutationFn: async (reorderedSegments) => {
      // Recalculate times based on new order
      for (let i = 0; i < reorderedSegments.length; i++) {
        const segment = reorderedSegments[i];
        const previousSegment = i > 0 ? reorderedSegments[i - 1] : null;

        let newStartTime = segment.start_time;
        if (previousSegment && previousSegment.end_time) {
          newStartTime = previousSegment.end_time;
        }

        // Calculate new end time
        let newEndTime = segment.end_time;
        if (newStartTime && segment.duration_min) {
          const [hours, minutes] = newStartTime.split(':').map(Number);
          const startMinutes = hours * 60 + minutes;
          const endMinutes = startMinutes + segment.duration_min;
          const endHours = Math.floor(endMinutes / 60) % 24;
          const endMins = endMinutes % 60;
          newEndTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
        }

        await base44.entities.Segment.update(segment.id, {
          ...segment,
          start_time: newStartTime,
          end_time: newEndTime
        });
      }
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

    // Update orders
    const updates = reorderedSegments.map((seg, index) => ({
      segmentId: seg.id,
      newOrder: index + 1
    }));

    await Promise.all(updates.map(update => reorderMutation.mutateAsync(update)));
    
    // Recalculate times after reordering
    await recalculateTimesMutation.mutateAsync(reorderedSegments);
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
    
    // Check overlaps with all other segments
    segments.forEach((otherSegment, otherIndex) => {
      if (otherIndex === index || !otherSegment.start_time || !otherSegment.end_time) return;
      
      const segStart = segment.start_time;
      const segEnd = segment.end_time;
      const otherStart = otherSegment.start_time;
      const otherEnd = otherSegment.end_time;
      
      // Check for overlap
      if ((segStart >= otherStart && segStart < otherEnd) ||
          (segEnd > otherStart && segEnd <= otherEnd) ||
          (segStart <= otherStart && segEnd >= otherEnd)) {
        issues.push({
          type: 'overlap',
          message: `Se solapa con "${otherSegment.title}" (${formatTimeToEST(otherStart)} - ${formatTimeToEST(otherEnd)})`
        });
      }
    });
    
    return issues;
  };

  if (segments.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">No hay segmentos. Agrega el primero para comenzar.</p>
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto">
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
              <TableHead className="w-24">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <Droppable droppableId="segments">
            {(provided) => (
              <TableBody ref={provided.innerRef} {...provided.droppableProps}>
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
                    <div className="font-semibold text-slate-900">{segment.title}</div>
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
    </DragDropContext>
  );
}
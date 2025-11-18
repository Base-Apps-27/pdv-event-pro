import React from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, GripVertical, Music, MessageSquare, Languages, ListOrdered, Circle } from "lucide-react";
import { formatTimeToEST } from "@/components/utils/timeFormat";

export default function SegmentList({ segments, sessionId, onEdit }) {
  const queryClient = useQueryClient();

  const { data: allActions = [] } = useQuery({
    queryKey: ['segmentActions'],
    queryFn: () => base44.entities.SegmentAction.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Segment.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['segments', sessionId]);
    },
  });

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

  if (segments.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">No hay segmentos. Agrega el primero para comenzar.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="w-12">#</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Título / Responsable</TableHead>
            <TableHead className="w-32">Contenido</TableHead>
            <TableHead className="w-20 text-center">Notas</TableHead>
            <TableHead className="w-24">Inicio</TableHead>
            <TableHead className="w-20">Dur.</TableHead>
            <TableHead className="w-24">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {segments.map((segment) => {
            const actionCount = getSegmentActions(segment.id).length;
            const hasProjectionNotes = !!segment.projection_notes;
            const hasSoundNotes = !!segment.sound_notes;
            const hasUshersNotes = !!segment.ushers_notes;

            return (
              <TableRow key={segment.id} className="hover:bg-slate-50">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-slate-400" />
                    <span className="font-medium">{segment.order}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={`${colorSchemes[segment.color_code || 'default']} border text-xs whitespace-nowrap`}>
                    {segment.segment_type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-semibold text-slate-900">{segment.title}</div>
                    {segment.presenter && (
                      <div className="text-sm text-slate-600 mt-0.5">{segment.presenter}</div>
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
                  <div>{segment.start_time ? formatTimeToEST(segment.start_time) : "-"}</div>
                  {segment.stage_call_time && (
                    <div className="text-xs text-blue-600">↓ {formatTimeToEST(segment.stage_call_time)}</div>
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
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
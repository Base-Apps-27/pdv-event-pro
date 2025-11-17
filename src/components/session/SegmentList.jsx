import React from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, GripVertical } from "lucide-react";

export default function SegmentList({ segments, sessionId, onEdit }) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Segment.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['segments', sessionId]);
    },
  });

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
            <TableHead>Título</TableHead>
            <TableHead>Responsable</TableHead>
            <TableHead>Inicio</TableHead>
            <TableHead>Duración</TableHead>
            <TableHead>Fin</TableHead>
            <TableHead>Llamado</TableHead>
            <TableHead className="w-24">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {segments.map((segment) => (
            <TableRow key={segment.id} className="hover:bg-slate-50">
              <TableCell>
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-slate-400" />
                  {segment.order}
                </div>
              </TableCell>
              <TableCell>
                <Badge className={`${colorSchemes[segment.color_code || 'default']} border text-xs`}>
                  {segment.segment_type}
                </Badge>
              </TableCell>
              <TableCell className="font-medium">{segment.title}</TableCell>
              <TableCell className="text-slate-600">{segment.speaker_or_team || "-"}</TableCell>
              <TableCell className="font-mono text-sm">{segment.start_time || "-"}</TableCell>
              <TableCell>{segment.duration_min ? `${segment.duration_min} min` : "-"}</TableCell>
              <TableCell className="font-mono text-sm">{segment.end_time || "-"}</TableCell>
              <TableCell className="font-mono text-sm text-blue-600">{segment.stage_call_time || "-"}</TableCell>
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
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
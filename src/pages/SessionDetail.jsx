import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SegmentList from "../components/session/SegmentList.jsx";
import SegmentFormTwoColumn from "../components/session/SegmentFormTwoColumn.jsx";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function SessionDetail() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('id');
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingSegment, setEditingSegment] = useState(null);

  const { data: session } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => base44.entities.Session.filter({ id: sessionId }).then(res => res[0]),
    enabled: !!sessionId,
  });

  const { data: segments = [] } = useQuery({
    queryKey: ['segments', sessionId],
    queryFn: () => base44.entities.Segment.filter({ session_id: sessionId }, 'order'),
    enabled: !!sessionId,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: () => base44.entities.SegmentTemplate.list(),
  });

  const recalculateTimesMutation = useMutation({
    mutationFn: async () => {
      if (segments.length === 0 || !segments[0].start_time) return;
      
      const updates = [];
      for (let i = 1; i < segments.length; i++) {
        const prevSegment = i === 1 ? segments[0] : segments[i - 1];
        if (prevSegment.end_time) {
          updates.push({
            id: segments[i].id,
            data: { start_time: prevSegment.end_time }
          });
        }
      }
      
      await Promise.all(updates.map(({ id, data }) => 
        base44.entities.Segment.update(id, data)
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['segments', sessionId]);
    },
  });

  const handleEdit = (segment) => {
    setEditingSegment(segment);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingSegment(null);
  };

  if (!session) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-600">Cargando sesión...</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{session.name}</h1>
          <p className="text-slate-600">{session.date} • {session.planned_start_time || "Sin hora"}</p>
        </div>
      </div>

      {segments.length > 0 && segments[0].start_time && (
        <Alert>
          <AlertDescription className="flex items-center justify-between">
            <span>Recalcular horarios automáticamente desde el primer segmento</span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => recalculateTimesMutation.mutate()}
              disabled={recalculateTimesMutation.isPending}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Recalcular Timeline
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Segmentos del Programa</CardTitle>
            <Button 
              onClick={() => { setEditingSegment(null); setShowForm(true); }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Segmento
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <SegmentList 
            segments={segments}
            sessionId={sessionId}
            onEdit={handleEdit}
          />
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-6xl h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle>{editingSegment ? 'Editar Segmento' : 'Nuevo Segmento'}</DialogTitle>
          </DialogHeader>
          <SegmentFormTwoColumn 
            session={session}
            segment={editingSegment}
            templates={templates}
            onClose={handleFormClose}
            sessionId={sessionId}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Clock, Users, Copy, Eraser, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import SegmentRow from "./SegmentRow";
import SegmentFormTwoColumn from "../session/SegmentFormTwoColumn";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function SessionColumn({ session, segments, onUpdateSegment, onRecalculate }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [editingSegment, setEditingSegment] = useState(null);
  const [showSegmentModal, setShowSegmentModal] = useState(false);
  const queryClient = useQueryClient();

  const sessionSegments = segments
    .filter(s => s.session_id === session.id)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  // Helper to clear people fields
  const clearPeopleMutation = useMutation({
    mutationFn: async () => {
      if(!confirm("¿Estás seguro de borrar todas las asignaciones de personas para esta sesión?")) return;
      
      // Clear session level people
      await base44.entities.Session.update(session.id, {
        admin_team: "", coordinators: "", sound_team: "", tech_team: "", 
        ushers_team: "", translation_team: "", hospitality_team: "", photography_team: "", worship_leader: ""
      });

      // Clear segment level people
      const updates = sessionSegments.map(seg => 
        base44.entities.Segment.update(seg.id, { presenter: "", translator_name: "", song_1_lead: "", song_2_lead: "", song_3_lead: "", song_4_lead: "", song_5_lead: "", song_6_lead: "" })
      );
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['sessions']);
      queryClient.invalidateQueries(['segments']);
    }
  });

  const handleEditSegment = (seg) => {
    setEditingSegment(seg);
    setShowSegmentModal(true);
  };

  const handleNewSegment = () => {
    setEditingSegment(null);
    setShowSegmentModal(true);
  };

  return (
    <div className="border rounded-lg bg-white shadow-sm mb-4 overflow-hidden">
      <div className="bg-gray-50 p-3 flex items-center justify-between border-b">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
          <div>
            <h3 className="font-bold text-sm md:text-base text-gray-900 flex items-center gap-2">
              {session.name}
              <Badge variant="outline" className="font-normal text-xs bg-white">
                <Clock className="w-3 h-3 mr-1" />
                {session.planned_start_time}
              </Badge>
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => clearPeopleMutation.mutate()}>
                <Eraser className="w-3 h-3 mr-1" />
                Limpiar Personas
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={handleNewSegment}>
                <Plus className="w-3 h-3 mr-1" />
                Segmento
            </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-0">
            {/* Compact People Summary / Quick Actions could go here */}
            
            {/* Segment List */}
            <div className="divide-y">
                {sessionSegments.map(seg => (
                    <SegmentRow 
                        key={seg.id} 
                        segment={seg} 
                        onUpdate={onUpdateSegment}
                        onEditDetails={() => handleEditSegment(seg)}
                    />
                ))}
            </div>
            {sessionSegments.length === 0 && (
                <div className="p-6 text-center text-gray-400 text-sm">No hay segmentos aún</div>
            )}
        </div>
      )}

      <Dialog open={showSegmentModal} onOpenChange={setShowSegmentModal}>
        <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-0">
            <DialogHeader className="px-6 pt-6 pb-2 border-b">
                <DialogTitle>Editar Segmento</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto">
                <SegmentFormTwoColumn 
                    session={session}
                    segment={editingSegment}
                    sessionId={session.id}
                    onClose={() => {
                        setShowSegmentModal(false);
                        onRecalculate(session.id); // Recalculate timeline after edit
                    }}
                />
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
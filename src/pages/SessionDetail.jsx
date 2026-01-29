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
import PreSessionDetailsForm from "../components/session/PreSessionDetailsForm.jsx";
import HospitalityTasksModal from "../components/session/HospitalityTasksModal.jsx";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function SessionDetail() {
  const navigate = useNavigate();

  React.useEffect(() => {
    const checkAuth = async () => {
      const isAuthenticated = await base44.auth.isAuthenticated();
      if (!isAuthenticated) {
        base44.auth.redirectToLogin();
      }
    };
    checkAuth();
  }, []);
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('id');
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingSegment, setEditingSegment] = useState(null);
  const [showPreSessionDetailsDialog, setShowPreSessionDetailsDialog] = useState(false);
  const [showHospitalityModal, setShowHospitalityModal] = useState(false);

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

  const { data: preSessionDetails = [] } = useQuery({
    queryKey: ['preSessionDetails', sessionId],
    queryFn: () => base44.entities.PreSessionDetails.filter({ session_id: sessionId }),
    enabled: !!sessionId,
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
      <div className="flex items-center gap-4 mb-4">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-900">{session.name}</h1>
          <p className="text-slate-600">{session.date} • {session.planned_start_time || "Sin hora"}</p>
        </div>
      </div>

      {/* Session Team Information */}
      {(session.admin_team || session.coordinators || session.worship_leader || session.sound_team || session.tech_team || session.ushers_team || session.translation_team || session.hospitality_team || session.photography_team) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Equipo y Personal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              {session.admin_team && (
                <div className="bg-orange-50 px-3 py-2 rounded border border-orange-200">
                  <span className="font-bold text-orange-700 block text-xs mb-1">ADMINISTRACIÓN</span>
                  <span className="text-slate-800">{session.admin_team}</span>
                </div>
              )}
              {session.coordinators && (
                <div className="bg-blue-50 px-3 py-2 rounded border border-blue-200">
                  <span className="font-bold text-blue-700 block text-xs mb-1">COORDINADORES</span>
                  <span className="text-slate-800">{session.coordinators}</span>
                </div>
              )}
              {session.worship_leader && (
                <div className="bg-purple-50 px-3 py-2 rounded border border-purple-200">
                  <span className="font-bold text-purple-700 block text-xs mb-1">LÍDER DE ALABANZA</span>
                  <span className="text-slate-800">{session.worship_leader}</span>
                </div>
              )}
              {session.sound_team && (
                <div className="bg-red-50 px-3 py-2 rounded border border-red-200">
                  <span className="font-bold text-red-700 block text-xs mb-1">SONIDO</span>
                  <span className="text-slate-800">{session.sound_team}</span>
                </div>
              )}
              {session.tech_team && (
                <div className="bg-indigo-50 px-3 py-2 rounded border border-indigo-200">
                  <span className="font-bold text-indigo-700 block text-xs mb-1">TÉCNICO</span>
                  <span className="text-slate-800">{session.tech_team}</span>
                </div>
              )}
              {session.ushers_team && (
                <div className="bg-green-50 px-3 py-2 rounded border border-green-200">
                  <span className="font-bold text-green-700 block text-xs mb-1">UJIERES</span>
                  <span className="text-slate-800">{session.ushers_team}</span>
                </div>
              )}
              {session.translation_team && (
                <div className="bg-pink-50 px-3 py-2 rounded border border-pink-200">
                  <span className="font-bold text-pink-700 block text-xs mb-1">TRADUCCIÓN</span>
                  <span className="text-slate-800">{session.translation_team}</span>
                </div>
              )}
              {session.hospitality_team && (
                <button 
                  onClick={() => setShowHospitalityModal(true)}
                  className="bg-yellow-50 px-3 py-2 rounded border border-yellow-200 hover:bg-yellow-100 transition-colors text-left cursor-pointer"
                >
                  <span className="font-bold text-yellow-700 block text-xs mb-1">HOSPITALIDAD</span>
                  <span className="text-slate-800">{session.hospitality_team}</span>
                </button>
              )}
              {session.photography_team && (
                <div className="bg-slate-50 px-3 py-2 rounded border border-slate-200">
                  <span className="font-bold text-slate-700 block text-xs mb-1">FOTOGRAFÍA</span>
                  <span className="text-slate-800">{session.photography_team}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
            onEditPreSession={() => setShowPreSessionDetailsDialog(true)}
          />
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-6xl h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-gray-100">
            <DialogTitle className="text-2xl font-bold text-gray-900 font-['Bebas_Neue'] tracking-wide uppercase">{editingSegment ? 'Editar Segmento' : 'Nuevo Segmento'}</DialogTitle>
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

      <Dialog open={showPreSessionDetailsDialog} onOpenChange={setShowPreSessionDetailsDialog}>
         <DialogContent className="max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
           <DialogHeader className="shrink-0 border-b border-gray-100 p-6 pb-4">
             <DialogTitle className="text-2xl font-bold text-gray-900 font['Bebas_Neue'] tracking-wide uppercase">Detalles Pre-Sesión</DialogTitle>
           </DialogHeader>
           <div className="flex-1 overflow-y-auto">
             <PreSessionDetailsForm
               sessionId={sessionId}
               preSessionDetails={preSessionDetails.length > 0 ? preSessionDetails[0] : null}
               onClose={() => setShowPreSessionDetailsDialog(false)}
             />
           </div>
         </DialogContent>
       </Dialog>

       <HospitalityTasksModal
         sessionId={sessionId}
         isOpen={showHospitalityModal}
         onClose={() => setShowHospitalityModal(false)}
       />
      </div>
      );
      }
import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Calendar, Layout, ArrowRight, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";

/**
 * AdminSubmissionGate
 * A wizard to help admins locate a specific segment (Weekly or Event) 
 * to manually add/process a message submission.
 * 
 * Flow:
 * 1. Select Type (Weekly vs Event)
 * 2. Select specific Instance (e.g. "Domingo 27" or "Congreso 2025")
 * 3. Select Segment (Plenaria/Message slots)
 * 4. Submit -> Returns segmentId to parent
 */
export default function AdminSubmissionGate({ isOpen, onClose, onSegmentSelected }) {
    const [step, setStep] = useState(1);
    const [type, setType] = useState('weekly'); // 'weekly' | 'event'
    const [selectedInstanceId, setSelectedInstanceId] = useState(null);
    const [selectedSegmentId, setSelectedSegmentId] = useState(null);

    // Reset state when opening
    React.useEffect(() => {
        if (isOpen) {
            setStep(1);
            setType('weekly');
            setSelectedInstanceId(null);
            setSelectedSegmentId(null);
        }
    }, [isOpen]);

    // ─── DATA FETCHING ──────────────────────────────────────────────

    // 1. Fetch Instances (Services or Events) based on type
    const { data: instances = [], isLoading: loadingInstances } = useQuery({
        queryKey: ['adminGateInstances', type],
        queryFn: async () => {
            if (type === 'weekly') {
                const today = new Date();
                const pastDate = new Date(today);
                pastDate.setDate(today.getDate() - 30); // Look back 30 days
                
                // Fetch active services
                return await base44.entities.Service.filter({
                    date: { $gte: pastDate.toISOString().split('T')[0] },
                    status: 'active'
                }, '-date', 50);
            } else {
                // Fetch active events
                return await base44.entities.Event.filter({
                    status: { $in: ['planning', 'confirmed', 'in_progress'] }
                }, '-start_date');
            }
        },
        enabled: isOpen && step === 2
    });

    // 2. Fetch Segments for selected instance
    const { data: segments = [], isLoading: loadingSegments } = useQuery({
        queryKey: ['adminGateSegments', type, selectedInstanceId],
        queryFn: async () => {
            if (!selectedInstanceId) return [];
            
            if (type === 'weekly') {
                // For Weekly, we need to handle both JSON-structure segments (old) and Entity segments (new)
                // BUT the goal here is to target segments that *can* store parsed_verse_data.
                // We'll prioritize Entity segments (Sessions) first, then fallback to checking the service object itself if needed.
                // SIMPLIFICATION: We will only query Segment entities for now, assuming migration to Sessions is robust.
                // If the service has no sessions, we might miss old-style services. 
                // Strategy: Query Sessions -> Segments.
                
                const sessions = await base44.entities.Session.filter({ service_id: selectedInstanceId });
                const allSegments = [];
                
                for (const session of sessions) {
                    const sessionSegs = await base44.entities.Segment.filter({ session_id: session.id }, 'order');
                    allSegments.push(...sessionSegs.map(s => ({
                        ...s,
                        displayName: `${session.name} - ${s.title}`
                    })));
                }

                // If no sessions found, it might be a pure JSON service (CustomServiceBuilder legacy)
                // But the mandate is to move forward. We'll show what we find.
                return allSegments.filter(s => 
                    s.segment_type === 'Plenaria' || 
                    s.title.toLowerCase().includes('mensaje') || 
                    s.title.toLowerCase().includes('predica') ||
                    (s.ui_fields || []).includes('verse')
                );

            } else {
                // Events
                const sessions = await base44.entities.Session.filter({ event_id: selectedInstanceId });
                const allSegments = [];
                for (const session of sessions) {
                    const sessionSegs = await base44.entities.Segment.filter({ session_id: session.id }, 'order');
                    allSegments.push(...sessionSegs.map(s => ({
                        ...s,
                        displayName: `${session.name} - ${s.title}`
                    })));
                }
                return allSegments.filter(s => 
                    s.segment_type === 'Plenaria' || 
                    s.title.toLowerCase().includes('mensaje') || 
                    s.title.toLowerCase().includes('predica') ||
                    (s.ui_fields || []).includes('verse')
                );
            }
        },
        enabled: isOpen && step === 3 && !!selectedInstanceId
    });

    // ─── HANDLERS ───────────────────────────────────────────────────

    const handleNext = () => {
        if (step === 1) setStep(2);
        else if (step === 2 && selectedInstanceId) setStep(3);
        else if (step === 3 && selectedSegmentId) {
            onSegmentSelected(selectedSegmentId);
            onClose();
        }
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
    };

    // ─── RENDERERS ──────────────────────────────────────────────────

    const renderStep1 = () => (
        <div className="space-y-4 py-4">
            <RadioGroup value={type} onValueChange={setType} className="grid grid-cols-2 gap-4">
                <div>
                    <RadioGroupItem value="weekly" id="weekly" className="peer sr-only" />
                    <Label
                        htmlFor="weekly"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-teal-500 peer-data-[state=checked]:text-teal-600 cursor-pointer h-full"
                    >
                        <Calendar className="mb-3 h-6 w-6" />
                        <span className="text-sm font-semibold">Servicio Semanal</span>
                    </Label>
                </div>
                <div>
                    <RadioGroupItem value="event" id="event" className="peer sr-only" />
                    <Label
                        htmlFor="event"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-teal-500 peer-data-[state=checked]:text-teal-600 cursor-pointer h-full"
                    >
                        <Layout className="mb-3 h-6 w-6" />
                        <span className="text-sm font-semibold">Evento Especial</span>
                    </Label>
                </div>
            </RadioGroup>
        </div>
    );

    const renderStep2 = () => (
        <div className="space-y-4 py-4">
            <Label>Selecciona {type === 'weekly' ? 'el Servicio' : 'el Evento'}</Label>
            {loadingInstances ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-teal-600" /></div>
            ) : instances.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded border border-dashed">
                    No se encontraron {type === 'weekly' ? 'servicios recientes' : 'eventos activos'}.
                </div>
            ) : (
                <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
                    <SelectTrigger>
                        <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                        {instances.map(inst => (
                            <SelectItem key={inst.id} value={inst.id}>
                                {type === 'weekly' 
                                    ? `${inst.name} (${format(new Date(inst.date), 'dd MMM', { locale: es })})`
                                    : `${inst.name} (${inst.year})`
                                }
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}
        </div>
    );

    const renderStep3 = () => (
        <div className="space-y-4 py-4">
            <Label>Selecciona el Segmento (Mensaje)</Label>
            {loadingSegments ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-teal-600" /></div>
            ) : segments.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded border border-dashed">
                    No se encontraron segmentos de mensaje en este {type === 'weekly' ? 'servicio' : 'evento'}.
                    <br/><span className="text-xs">Asegúrate de que existan segmentos de tipo "Plenaria" o con título "Mensaje".</span>
                </div>
            ) : (
                <RadioGroup value={selectedSegmentId} onValueChange={setSelectedSegmentId} className="space-y-2">
                    {segments.map(seg => (
                        <div key={seg.id} className="flex items-center space-x-2 border rounded p-3 hover:bg-gray-50">
                            <RadioGroupItem value={seg.id} id={seg.id} />
                            <Label htmlFor={seg.id} className="flex-1 cursor-pointer">
                                <div className="font-semibold">{seg.displayName}</div>
                                {seg.presenter && <div className="text-xs text-gray-500">Orador: {seg.presenter}</div>}
                            </Label>
                        </div>
                    ))}
                </RadioGroup>
            )}
        </div>
    );

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Procesar Nuevo Mensaje Manual</DialogTitle>
                    <DialogDescription>
                        Paso {step} de 3: {
                            step === 1 ? "Tipo de Programa" :
                            step === 2 ? "Selección de Fecha" :
                            "Selección de Segmento"
                        }
                    </DialogDescription>
                </DialogHeader>

                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}

                <DialogFooter className="flex justify-between sm:justify-between">
                    <Button variant="ghost" onClick={step === 1 ? onClose : handleBack}>
                        {step === 1 ? 'Cancelar' : 'Atrás'}
                    </Button>
                    <Button 
                        onClick={handleNext} 
                        disabled={
                            (step === 2 && !selectedInstanceId) || 
                            (step === 3 && !selectedSegmentId)
                        }
                        className="bg-teal-600 hover:bg-teal-700"
                    >
                        {step === 3 ? 'Comenzar Procesamiento' : 'Siguiente'}
                        {step !== 3 && <ArrowRight className="w-4 h-4 ml-2" />}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
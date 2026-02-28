import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, CheckCircle2, Sparkles, History, RotateCcw, Bug, Plus, Check } from "lucide-react";
import VerseParserDialog from "@/components/service/VerseParserDialog";
import SubmissionDiagnosticModal from "@/components/service/SubmissionDiagnosticModal";
import ParsedContentPreview from "@/components/service/ParsedContentPreview";
import AdminSubmissionGate from "@/components/message-processing/AdminSubmissionGate";
import MessageMaterialSection from "@/components/message-processing/MessageMaterialSection";
import { formatDateTimeET } from "@/components/utils/timeFormat";
import { normalizeName } from "@/components/utils/textNormalization";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// History Dialog Component (Preserved)
function SubmissionHistoryDialog({ open, onOpenChange, segment, onRestore }) {
    const { data: versions = [], isLoading } = useQuery({
        queryKey: ['submissionHistory', segment?.id],
        queryFn: async () => {
            if (!segment) return [];
            const res = await base44.entities.SpeakerSubmissionVersion.filter({ 
                segment_id: segment.id 
            });
            // Sort by submitted_at desc
            return res.sort((a, b) => new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0));
        },
        enabled: !!segment && open
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <History className="w-5 h-5 text-pdv-teal" />
                        Historial de Envíos
                    </DialogTitle>
                </DialogHeader>
                
                <div className="flex-1 overflow-y-auto pr-2 space-y-4 py-2">
                    {isLoading ? (
                        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-400" /></div>
                    ) : versions.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">No hay historial disponible.</p>
                    ) : (
                        versions.map((version) => (
                            <div key={version.id} className="border rounded-lg p-4 bg-gray-50 hover:bg-white hover:shadow-sm transition-all">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs font-mono">
                                            {formatDateTimeET(version.submitted_at)}
                                        </Badge>
                                        <span className="text-xs text-gray-500 uppercase">{version.source || 'public_form'}</span>
                                    </div>
                                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onRestore(version)}>
                                        <RotateCcw className="w-3 h-3" />
                                        Restaurar
                                    </Button>
                                </div>
                                <div className="text-xs font-mono text-gray-600 bg-white p-2 rounded border h-20 overflow-y-auto whitespace-pre-wrap">
                                    {version.content}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function MessageProcessingPage() {
    const queryClient = useQueryClient();
    const [selectedSegment, setSelectedSegment] = useState(null);
    const [isParserOpen, setIsParserOpen] = useState(false);
    
    // History State
    const [historySegment, setHistorySegment] = useState(null);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    // Custom content for restoration flow
    const [restoreContent, setRestoreContent] = useState(null);
    
    // Diagnostic State
    const [diagnosticSegmentId, setDiagnosticSegmentId] = useState(null);
    const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);

    // Gate State
    const [isGateOpen, setIsGateOpen] = useState(false);

    // Fetch ONLY pending and processed (Inbox model)
    const { data: segments = [], isLoading } = useQuery({
        queryKey: ['messagesToProcessInbox'],
        queryFn: async () => {
            const [pendingSeg, processedSeg] = await Promise.all([
                base44.entities.Segment.filter({ submission_status: 'pending' }),
                base44.entities.Segment.filter({ submission_status: 'processed' })
            ]);
            
            // Standardize structure
            // 2026-02-28: Added presentation_url, notes_url, content_is_slides_only
            // so they are visible in Message Processing cards.
            const all = [...pendingSeg, ...processedSeg].map(seg => ({
                id: seg.id,
                title: seg.title,
                presenter: seg.presenter,
                submitted_content: seg.submitted_content,
                parsed_verse_data: seg.parsed_verse_data,
                submission_status: seg.submission_status,
                updated_date: seg.updated_date,
                presentation_url: seg.presentation_url,
                notes_url: seg.notes_url,
                content_is_slides_only: seg.content_is_slides_only,
                message_title: seg.message_title,
            }));

            // Sort by most recently updated
            return all.sort((a, b) => new Date(b.updated_date || 0) - new Date(a.updated_date || 0));
        },
        refetchInterval: 5000
    });

    const pendingSegments = segments.filter(s => s.submission_status === 'pending');
    const processedSegments = segments.filter(s => s.submission_status === 'processed');

    const updateSegmentMutation = useMutation({
        mutationFn: async ({ segment, data }) => {
            await base44.entities.Segment.update(segment.id, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['messagesToProcessInbox']);
            setIsParserOpen(false);
            setSelectedSegment(null);
            setRestoreContent(null);
            toast.success("Mensaje procesado y guardado");
        }
    });

    const handleProcess = (segment, contentOverride = null) => {
        setSelectedSegment(segment);
        setRestoreContent(contentOverride);
        setIsParserOpen(true);
    };

    const handleRestore = (version) => {
        setIsHistoryOpen(false);
        handleProcess(historySegment, version.content);
        setHistorySegment(null);
    };

    const handleSaveParsed = (data) => {
        if (!selectedSegment) return;
        
        updateSegmentMutation.mutate({
            segment: selectedSegment,
            data: {
                submitted_content: restoreContent || selectedSegment.submitted_content || "",
                // Note: We are saving to entity. If old Service JSON structure is needed, it won't be updated here.
                // Assumption: Migration to Entity-based segments is primary.
                scripture_references: data.verse, 
                parsed_verse_data: data.parsed_data,
                submission_status: 'processed'
            }
        });
    };

    const handleGateSelection = async (segmentId) => {
        setIsGateOpen(false);
        try {
            const seg = await base44.entities.Segment.get(segmentId);
            if (seg) {
                handleProcess(seg);
            }
        } catch (err) {
            console.error("Error fetching segment from gate:", err);
            toast.error("No se pudo cargar el segmento seleccionado");
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 bg-gray-50/50 min-h-screen">
            <div className="flex justify-between items-center border-b border-gray-200 pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Procesamiento de Mensajes</h1>
                    <p className="text-gray-500 mt-1">Bandeja de entrada para contenido de oradores</p>
                </div>
                <Button 
                    onClick={() => setIsGateOpen(true)}
                    className="bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Procesar Nuevo Mensaje
                </Button>
            </div>

            <Tabs defaultValue="inbox" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-6">
                    <TabsTrigger value="inbox">
                        Bandeja de Entrada
                        <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-800 border-none">
                            {pendingSegments.length}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="history">
                        Historial
                        <Badge variant="secondary" className="ml-2 bg-gray-100 text-gray-800 border-none">
                            {processedSegments.length}
                        </Badge>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="inbox">
                    <MessageGrid 
                        segments={pendingSegments} 
                        isLoading={isLoading} 
                        onProcess={handleProcess}
                        onDiagnostic={(id) => { setDiagnosticSegmentId(id); setIsDiagnosticOpen(true); }}
                        onHistory={(seg) => { setHistorySegment(seg); setIsHistoryOpen(true); }}
                        onMaterialUpdated={() => queryClient.invalidateQueries(['messagesToProcessInbox'])}
                        emptyMessage="No hay mensajes pendientes de revisión."
                    />
                </TabsContent>
                
                <TabsContent value="history">
                    <MessageGrid 
                        segments={processedSegments} 
                        isLoading={isLoading} 
                        onProcess={handleProcess}
                        onDiagnostic={(id) => { setDiagnosticSegmentId(id); setIsDiagnosticOpen(true); }}
                        onHistory={(seg) => { setHistorySegment(seg); setIsHistoryOpen(true); }}
                        onMaterialUpdated={() => queryClient.invalidateQueries(['messagesToProcessInbox'])}
                        emptyMessage="No hay historial de mensajes procesados."
                    />
                </TabsContent>
            </Tabs>

            {/* Modals */}
            <AdminSubmissionGate 
                isOpen={isGateOpen}
                onClose={() => setIsGateOpen(false)}
                onSegmentSelected={handleGateSelection}
            />

            <SubmissionHistoryDialog 
                open={isHistoryOpen}
                onOpenChange={setIsHistoryOpen}
                segment={historySegment}
                onRestore={handleRestore}
            />

            <SubmissionDiagnosticModal
                open={isDiagnosticOpen}
                onOpenChange={setIsDiagnosticOpen}
                segmentId={diagnosticSegmentId}
            />

            {selectedSegment && (
                <VerseParserDialog
                    open={isParserOpen}
                    onOpenChange={setIsParserOpen}
                    initialText={restoreContent || selectedSegment.submitted_content || ""}
                    onSave={handleSaveParsed}
                    language="es"
                />
            )}
        </div>
    );
}

function MessageGrid({ segments, isLoading, onProcess, onDiagnostic, onHistory, emptyMessage, onMaterialUpdated }) {
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <Loader2 className="w-10 h-10 animate-spin mb-4 text-teal-600" />
                <p>Cargando mensajes...</p>
            </div>
        );
    }

    if (segments.length === 0) {
        return (
            <div className="text-center py-20 bg-white rounded-lg border border-dashed border-gray-300">
                <div className="text-gray-400 mb-2">
                    <CheckCircle2 className="w-12 h-12 mx-auto opacity-20" />
                </div>
                <p className="text-gray-500 font-medium">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {segments.map((segment) => {
                const isProcessed = segment.submission_status === 'processed';
                return (
                    <Card key={segment.id} className={`flex flex-col h-full border-t-4 hover:shadow-lg transition-all duration-200 ${
                        isProcessed ? 'border-t-green-500' : 'border-t-amber-500'
                    }`}>
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-start mb-2">
                                <Badge className={isProcessed ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-amber-100 text-amber-800 hover:bg-amber-200"}>
                                    {isProcessed ? 'Procesado' : 'Pendiente'}
                                </Badge>
                                <span className="text-xs text-gray-400 font-mono">
                                    {segment.updated_date ? format(new Date(segment.updated_date), 'd MMM HH:mm', { locale: es }) : ''}
                                </span>
                            </div>
                            <CardTitle className="text-lg leading-snug line-clamp-2 min-h-[3.5rem]">
                                {segment.title || 'Sin Título'}
                            </CardTitle>
                            <CardDescription className="line-clamp-1">
                                {normalizeName(segment.presenter || 'Orador no asignado')}
                            </CardDescription>
                        </CardHeader>
                        
                        <CardContent className="flex-1 flex flex-col justify-end space-y-4">
                            {/* Preview Snippet */}
                            <div className="bg-gray-50 rounded p-3 text-xs text-gray-600 min-h-[3rem] border border-gray-100 relative overflow-hidden">
                                {segment.submitted_content ? (
                                    <p className="line-clamp-3 italic">"{segment.submitted_content}"</p>
                                ) : segment.parsed_verse_data && segment.parsed_verse_data.type !== 'empty' ? (
                                    <div className="flex flex-col gap-1">
                                        <div className="font-semibold text-gray-700">Contenido Procesado:</div>
                                        <div className="line-clamp-2">
                                            {segment.parsed_verse_data.key_takeaways?.[0] || 'Ver detalles...'}
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-gray-400 text-center py-2">Sin contenido de texto</p>
                                )}
                            </div>

                            {/* Material section with upload/link support */}
                            <MessageMaterialSection segment={segment} onUpdated={onMaterialUpdated} />

                            <div className="flex gap-2 mt-auto">
                                <Button 
                                    onClick={() => onProcess(segment)} 
                                    className={`flex-1 ${isProcessed ? 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50' : 'bg-teal-600 hover:bg-teal-700 text-white'}`}
                                    variant={isProcessed ? "outline" : "default"}
                                >
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    {isProcessed ? 'Revisar' : 'Procesar'}
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => onDiagnostic(segment.id)}
                                    className="text-gray-400 hover:text-purple-600"
                                    title="Diagnóstico"
                                >
                                    <Bug className="w-4 h-4" />
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => onHistory(segment)}
                                    className="text-gray-400 hover:text-blue-600"
                                    title="Historial"
                                >
                                    <History className="w-4 h-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
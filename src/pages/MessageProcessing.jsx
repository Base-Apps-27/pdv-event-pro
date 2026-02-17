import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, CheckCircle2, Clock, AlertCircle, FileText, Sparkles, X, History, RotateCcw, Bug } from "lucide-react";
import VerseParserDialog from "@/components/service/VerseParserDialog";
import SubmissionDiagnosticModal from "@/components/service/SubmissionDiagnosticModal";
import { formatDateTimeET } from "@/components/utils/timeFormat";
import { normalizeName } from "@/components/utils/textNormalization";

// History Dialog Component
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

    // Fetch segments AND services with pending OR processed submissions
    const { data: segments = [], isLoading } = useQuery({
        queryKey: ['messagesToProcess'],
        queryFn: async () => {
            // Fetch Segments (Events)
            const [pendingSeg, processedSeg] = await Promise.all([
                base44.entities.Segment.filter({ submission_status: 'pending' }),
                base44.entities.Segment.filter({ submission_status: 'processed' })
            ]);
            const eventSegments = [...pendingSeg, ...processedSeg];

            // Fetch Services (Weekly)
            // Strategy: Get recent active services (last 30 days + future)
            const today = new Date();
            const lastMonth = new Date(today);
            lastMonth.setDate(today.getDate() - 30);
            const dateStr = lastMonth.toISOString().split('T')[0];
            
            const recentServices = await base44.entities.Service.filter({ 
                date: { $gte: dateStr },
                status: 'active'
            });

            // Extract segments from services — entity-first, JSON fallback
            const serviceSegments = [];
            const seenEntityIds = new Set();

            // Entity path: check for Segment entities linked to these services via Sessions
            for (const service of recentServices) {
                const sessions = await base44.entities.Session.filter({ service_id: service.id });
                if (sessions.length > 0) {
                    for (const session of sessions) {
                        const segs = await base44.entities.Segment.filter({ session_id: session.id }, 'order');
                        segs.forEach((seg, idx) => {
                            if (seg.submission_status === 'pending' || seg.submission_status === 'processed') {
                                seenEntityIds.add(service.id);
                                serviceSegments.push({
                                    id: seg.id,
                                    title: `${service.name || service.date} - ${session.name} - ${seg.title}`,
                                    presenter: seg.presenter,
                                    submitted_content: seg.submitted_content,
                                    submission_status: seg.submission_status,
                                    updated_date: seg.updated_date || service.updated_date,
                                    // Not a JSON service segment — use standard entity path
                                    isServiceSegment: false,
                                });
                            }
                        });
                    }
                }
            }

            // JSON fallback: for services without Session entities
            recentServices.forEach(service => {
                if (seenEntityIds.has(service.id)) return; // Already handled via entity path
                ['9:30am', '11:30am'].forEach(slot => {
                    if (service[slot]) {
                        service[slot].forEach((seg, idx) => {
                            if (seg.submission_status === 'pending' || seg.submission_status === 'processed') {
                                serviceSegments.push({
                                    id: `weekly_service|${service.id}|${slot}|${idx}|message`,
                                    title: `${service.name || service.date} - ${slot} - ${seg.title}`,
                                    presenter: seg.data?.presenter || seg.data?.preacher || seg.data?.leader,
                                    submitted_content: seg.submitted_content,
                                    submission_status: seg.submission_status,
                                    updated_date: service.updated_date,
                                    isServiceSegment: true,
                                    serviceId: service.id,
                                    timeSlot: slot,
                                    segmentIndex: idx
                                });
                            }
                        });
                    }
                });
            });

            // Combine and dedup
            const all = [...eventSegments, ...serviceSegments];
            return all.sort((a, b) => new Date(b.updated_date || 0) - new Date(a.updated_date || 0));
        },
        refetchInterval: 3000
    });

    const updateSegmentMutation = useMutation({
        mutationFn: async ({ segment, data }) => {
            if (segment.isServiceSegment) {
                // Handle Weekly Service Update (Read-Modify-Write)
                const service = await base44.entities.Service.get(segment.serviceId);
                if (!service) throw new Error("Service not found");
                
                const currentArray = [...service[segment.timeSlot]];
                const currentSegment = currentArray[segment.segmentIndex];
                
                // Merge updates
                // Map 'scripture_references' to 'data.verse' for services
                const updatedData = { ...currentSegment.data };
                if (data.scripture_references) {
                    updatedData.verse = data.scripture_references;
                }

                currentArray[segment.segmentIndex] = {
                    ...currentSegment,
                    ...data,
                    data: updatedData
                };

                await base44.entities.Service.update(segment.serviceId, {
                    [segment.timeSlot]: currentArray
                });
            } else {
                // Handle Standard Segment Update
                await base44.entities.Segment.update(segment.id, data);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['messagesToProcess']);
            setIsParserOpen(false);
            setSelectedSegment(null);
            setRestoreContent(null);
        }
    });

    const handleProcess = (segment, contentOverride = null) => {
        setSelectedSegment(segment);
        setRestoreContent(contentOverride); // If restoring, use this content
        setIsParserOpen(true);
    };

    const handleRestore = (version) => {
        setIsHistoryOpen(false);
        // Open parser with version content
        handleProcess(historySegment, version.content);
        setHistorySegment(null);
    };

    const handleSaveParsed = (data) => {
        if (!selectedSegment) return;
        
        updateSegmentMutation.mutate({
            segment: selectedSegment,
            data: {
                submitted_content: restoreContent || selectedSegment.submitted_content, // Update content if restoring
                scripture_references: data.verse,
                parsed_verse_data: data.parsed_data,
                submission_status: 'processed'
            }
        });
    };

    const handleIgnore = (segment) => {
        if (confirm("¿Estás seguro de ignorar esta sumisión?")) {
            updateSegmentMutation.mutate({
                segment: segment,
                data: { submission_status: 'ignored' }
            });
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Procesamiento de Mensajes</h1>
                    <p className="text-gray-500">Revisar y gestionar envíos de oradores</p>
                </div>
                <div className="flex gap-2">
                    <Badge variant="outline" className="px-3 py-1 text-base bg-amber-50 text-amber-700 border-amber-200">
                        {segments.filter(s => s.submission_status === 'pending').length} Pendientes
                    </Badge>
                    <Badge variant="outline" className="px-3 py-1 text-base bg-green-50 text-green-700 border-green-200">
                        {segments.filter(s => s.submission_status === 'processed').length} Procesados
                    </Badge>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
            ) : segments.length === 0 ? (
                <Card className="bg-gray-50 border-dashed border-2">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <CheckCircle2 className="w-12 h-12 text-green-500 mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900">¡Todo al día!</h3>
                        <p className="text-gray-500 max-w-sm mt-2">
                            No hay mensajes recientes.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {segments.map((segment) => {
                        const isProcessed = segment.submission_status === 'processed';
                        return (
                            <Card key={segment.id} className={`overflow-hidden hover:shadow-md transition-shadow ${isProcessed ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-amber-500'}`}>
                                <CardHeader className="bg-white border-b pb-3">
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge className={isProcessed ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-amber-100 text-amber-800 hover:bg-amber-200"}>
                                            {isProcessed ? 'Procesado' : 'Pendiente'}
                                        </Badge>
                                        <span className="text-xs text-gray-400 font-mono">
                                            {segment.updated_date ? formatDateTimeET(segment.updated_date) : ''}
                                        </span>
                                    </div>
                                    <CardTitle className="text-lg leading-tight mb-1">{segment.title}</CardTitle>
                                    <CardDescription className="flex items-center gap-2">
                                        <span className="font-medium text-gray-700">{normalizeName(segment.presenter || 'TBA')}</span>
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-4 space-y-4">
                                    <div className="bg-gray-50 rounded-md p-3 text-xs text-gray-600 font-mono h-32 overflow-hidden relative">
                                        {segment.submitted_content}
                                        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-gray-50 to-transparent" />
                                    </div>
                                    <div className="flex gap-2">
                                        <Button 
                                            onClick={() => handleProcess(segment)} 
                                            className={isProcessed ? "flex-1 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50" : "flex-1 bg-teal-600 hover:bg-teal-700"}
                                            variant={isProcessed ? "outline" : "default"}
                                        >
                                            <Sparkles className="w-4 h-4 mr-2" />
                                            {isProcessed ? 'Revisar' : 'Procesar'}
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="icon"
                                            onClick={() => { setDiagnosticSegmentId(segment.id); setIsDiagnosticOpen(true); }}
                                            className="text-gray-400 hover:text-purple-600"
                                            title="Diagnóstico de Envío"
                                        >
                                            <Bug className="w-4 h-4" />
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="icon"
                                            onClick={() => { setHistorySegment(segment); setIsHistoryOpen(true); }}
                                            className="text-gray-400 hover:text-blue-600"
                                            title="Historial de Versiones"
                                        >
                                            <History className="w-4 h-4" />
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="icon"
                                            onClick={() => handleIgnore(segment)}
                                            className="text-gray-400 hover:text-red-500"
                                            title="Ignorar"
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* History Dialog */}
            <SubmissionHistoryDialog 
                open={isHistoryOpen}
                onOpenChange={setIsHistoryOpen}
                segment={historySegment}
                onRestore={handleRestore}
            />

            {/* Diagnostic Modal */}
            <SubmissionDiagnosticModal
                open={isDiagnosticOpen}
                onOpenChange={setIsDiagnosticOpen}
                segmentId={diagnosticSegmentId}
            />

            {/* Reuse the VerseParserDialog */}
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
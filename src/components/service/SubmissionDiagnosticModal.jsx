import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, AlertCircle, CheckCircle2, Clock, Copy, ExternalLink } from "lucide-react";
import { formatDateTimeET } from "@/components/utils/timeFormat";

/**
 * SubmissionDiagnosticModal
 * 
 * Displays complete submission details including:
 * - SpeakerSubmissionVersion record(s)
 * - Related Service or Segment entity
 * - Processing history and errors
 * - Parsed verse data snapshot
 * 
 * Purpose: Help diagnose why submissions fail or how they were processed
 */
export default function SubmissionDiagnosticModal({ open, onOpenChange, segmentId }) {
    const [copiedId, setCopiedId] = useState(null);

    // Parse composite ID if present
    const isCompositeId = segmentId?.startsWith('weekly_service|');
    let serviceId = null, timeSlot = null, segmentIdx = null;
    
    if (isCompositeId) {
        const parts = segmentId.split('|');
        serviceId = parts[1];
        timeSlot = parts[2];
        segmentIdx = parseInt(parts[3]);
    }

    // Fetch submission versions
    const { data: submissionVersions = [], isLoading: loadingVersions } = useQuery({
        queryKey: ['submissionVersions', segmentId],
        queryFn: async () => {
            if (!segmentId) return [];
            const res = await base44.entities.SpeakerSubmissionVersion.filter({ 
                segment_id: segmentId 
            });
            return res.sort((a, b) => new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0));
        },
        enabled: !!segmentId && open
    });

    // Fetch Service (if composite ID)
    const { data: service, isLoading: loadingService } = useQuery({
        queryKey: ['serviceDetail', serviceId],
        queryFn: async () => {
            if (!serviceId) return null;
            return await base44.entities.Service.get(serviceId);
        },
        enabled: !!serviceId && open
    });

    // Fetch Segment (if event segment)
    const { data: segment, isLoading: loadingSegment } = useQuery({
        queryKey: ['segmentDetail', segmentId],
        queryFn: async () => {
            if (!segmentId || isCompositeId) return null;
            return await base44.entities.Segment.get(segmentId);
        },
        enabled: !!segmentId && !isCompositeId && open
    });

    const isLoading = loadingVersions || loadingService || loadingSegment;

    const copyToClipboard = (text, key) => {
        navigator.clipboard.writeText(text);
        setCopiedId(key);
        setTimeout(() => setCopiedId(null), 2000);
    };

    // Extract the actual segment from service array (if composite)
    const serviceSegment = service && timeSlot && segmentIdx !== null
        ? service[timeSlot]?.[segmentIdx]
        : null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ExternalLink className="w-5 h-5 text-pdv-teal" />
                        Diagnóstico de Envío
                    </DialogTitle>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                    </div>
                ) : (
                    <Tabs defaultValue="submission" className="flex-1 flex flex-col overflow-hidden">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="submission">Envío</TabsTrigger>
                            <TabsTrigger value="entity">Entidad</TabsTrigger>
                            <TabsTrigger value="parsing">Análisis</TabsTrigger>
                            <TabsTrigger value="history">Historial</TabsTrigger>
                        </TabsList>

                        <ScrollArea className="flex-1">
                            {/* SUBMISSION TAB */}
                            <TabsContent value="submission" className="p-4 space-y-4">
                                {submissionVersions.length === 0 ? (
                                    <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded text-amber-700">
                                        <AlertCircle className="w-5 h-5" />
                                        <span>No se encontraron versiones de envío</span>
                                    </div>
                                ) : (
                                    submissionVersions.map((version) => (
                                        <div key={version.id} className="border rounded-lg p-4 bg-gray-50 space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="text-sm font-mono text-gray-600">ID</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <code className="text-xs bg-white border rounded px-2 py-1 font-mono text-gray-700 break-all">
                                                            {version.id}
                                                        </code>
                                                        <button
                                                            onClick={() => copyToClipboard(version.id, `version-${version.id}`)}
                                                            className="text-gray-400 hover:text-gray-600"
                                                        >
                                                            <Copy className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <Badge className={
                                                    version.processing_status === 'processed' ? 'bg-green-100 text-green-800' :
                                                    version.processing_status === 'failed' ? 'bg-red-100 text-red-800' :
                                                    'bg-amber-100 text-amber-800'
                                                }>
                                                    {version.processing_status || 'pending'}
                                                </Badge>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <p className="text-gray-600 font-medium">Enviado</p>
                                                    <p className="text-gray-900 font-mono text-xs">
                                                        {formatDateTimeET(version.submitted_at)}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-600 font-medium">Fuente</p>
                                                    <p className="text-gray-900 font-mono text-xs">{version.source || 'public_form'}</p>
                                                </div>
                                            </div>

                                            {version.title && (
                                                <div>
                                                    <p className="text-sm text-gray-600 font-medium">Título</p>
                                                    <p className="text-gray-900 text-sm">{version.title}</p>
                                                </div>
                                            )}

                                            {/* Raw content hidden per policy: "Only the parsed data should ever be accessible" */}
                                            <div>
                                                <p className="text-sm text-gray-600 font-medium mb-2">Contenido Enviado</p>
                                                <div className="bg-gray-100 border border-gray-200 rounded p-3 text-xs text-gray-500 italic">
                                                    (Contenido original archivado y oculto. Solo datos procesados disponibles.)
                                                </div>
                                            </div>

                                            {version.processing_error && (
                                                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                                                    <p className="font-medium mb-1">Error de Procesamiento</p>
                                                    <p className="font-mono text-xs">{version.processing_error}</p>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </TabsContent>

                            {/* ENTITY TAB */}
                            <TabsContent value="entity" className="p-4 space-y-4">
                                {isCompositeId ? (
                                    <>
                                        <div className="border rounded-lg p-4 space-y-3 bg-blue-50 border-blue-200">
                                            <div className="flex items-center gap-2">
                                                <Badge className="bg-blue-100 text-blue-800">Composite ID</Badge>
                                                <span className="text-sm text-gray-600">Identifica un segmento de servicio semanal</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <p className="text-gray-600 font-medium">Service ID</p>
                                                    <code className="text-xs bg-white border rounded px-2 py-1 font-mono text-gray-700 block mt-1">
                                                        {serviceId}
                                                    </code>
                                                </div>
                                                <div>
                                                    <p className="text-gray-600 font-medium">Time Slot</p>
                                                    <p className="text-gray-900 text-xs mt-1">{timeSlot}</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-600 font-medium">Segment Index</p>
                                                    <p className="text-gray-900 text-xs mt-1">{segmentIdx}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {service ? (
                                            <div className="border rounded-lg p-4 space-y-3 bg-white">
                                                <div className="flex justify-between items-start">
                                                    <h4 className="font-semibold text-gray-900">Servicio</h4>
                                                    <Badge variant="outline">{service.status}</Badge>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                    <div>
                                                        <p className="text-gray-600 font-medium">Nombre</p>
                                                        <p className="text-gray-900">{service.name}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-gray-600 font-medium">Fecha</p>
                                                        <p className="text-gray-900">{service.date}</p>
                                                    </div>
                                                </div>

                                                {serviceSegment && (
                                                    <div className="border-t pt-3 mt-3">
                                                        <h5 className="font-medium text-gray-900 mb-3">Segmento en {timeSlot}[{segmentIdx}]</h5>
                                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                                            <div>
                                                                <p className="text-gray-600 font-medium">Tipo</p>
                                                                <p className="text-gray-900">{serviceSegment.type}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-gray-600 font-medium">Título</p>
                                                                <p className="text-gray-900">{serviceSegment.title}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-gray-600 font-medium">Estado Envío</p>
                                                                <Badge className="w-fit mt-1">
                                                                    {serviceSegment.submission_status || 'ignored'}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded text-red-700">
                                                <AlertCircle className="w-5 h-5" />
                                                <span>Servicio no encontrado: {serviceId}</span>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-2 p-4 bg-blue-50 border border-blue-200 rounded text-blue-700">
                                            <Badge className="bg-blue-100 text-blue-800">Event Segment</Badge>
                                            <span className="text-sm">Segmento de evento</span>
                                        </div>

                                        {segment ? (
                                            <div className="border rounded-lg p-4 space-y-3 bg-white">
                                                <div className="flex justify-between items-start">
                                                    <h4 className="font-semibold text-gray-900">{segment.title}</h4>
                                                    <Badge variant="outline">{segment.segment_type}</Badge>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                    <div>
                                                        <p className="text-gray-600 font-medium">Presentador</p>
                                                        <p className="text-gray-900">{segment.presenter || 'TBA'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-gray-600 font-medium">Estado Envío</p>
                                                        <Badge className="w-fit mt-1">
                                                            {segment.submission_status || 'ignored'}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded text-red-700">
                                                <AlertCircle className="w-5 h-5" />
                                                <span>Segmento no encontrado: {segmentId}</span>
                                            </div>
                                        )}
                                    </>
                                )}
                            </TabsContent>

                            {/* PARSING TAB */}
                            <TabsContent value="parsing" className="p-4 space-y-4">
                                {submissionVersions.map((version) => (
                                    <div key={version.id} className="border rounded-lg p-4 space-y-3 bg-gray-50">
                                        <div className="flex justify-between items-start">
                                            <p className="text-sm font-mono text-gray-600">
                                                {formatDateTimeET(version.submitted_at)}
                                            </p>
                                            <Badge className={
                                                version.processing_status === 'processed' ? 'bg-green-100 text-green-800' :
                                                'bg-gray-200 text-gray-800'
                                            }>
                                                {version.processing_status || 'pending'}
                                            </Badge>
                                        </div>

                                        {version.parsed_data_snapshot ? (
                                            <div className="bg-white border rounded p-3 text-xs font-mono text-gray-700 max-h-60 overflow-y-auto whitespace-pre-wrap">
                                                {JSON.stringify(version.parsed_data_snapshot, null, 2)}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-500 italic">Sin análisis disponible</p>
                                        )}
                                    </div>
                                ))}
                            </TabsContent>

                            {/* HISTORY TAB */}
                            <TabsContent value="history" className="p-4 space-y-4">
                                {submissionVersions.length === 0 ? (
                                    <p className="text-center text-gray-500 py-8">Sin historial</p>
                                ) : (
                                    <div className="space-y-3">
                                        {submissionVersions.map((version, idx) => (
                                            <div key={version.id} className="border rounded-lg p-3 bg-white hover:bg-gray-50 transition-colors text-sm">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                                                            v{submissionVersions.length - idx}
                                                        </span>
                                                        <span className="text-xs text-gray-500 font-mono">
                                                            {formatDateTimeET(version.submitted_at)}
                                                        </span>
                                                    </div>
                                                    <span className={`text-xs font-medium ${
                                                        version.processing_status === 'processed' ? 'text-green-700' :
                                                        version.processing_status === 'failed' ? 'text-red-700' :
                                                        'text-amber-700'
                                                    }`}>
                                                        {version.processing_status || 'pending'}
                                                    </span>
                                                </div>
                                                <p className="text-gray-700">{version.source || 'public_form'}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>
                        </ScrollArea>
                    </Tabs>
                )}
            </DialogContent>
        </Dialog>
    );
}
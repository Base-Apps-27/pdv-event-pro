import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CheckCircle2, Clock, AlertCircle, FileText, Sparkles, X } from "lucide-react";
import VerseParserDialog from "@/components/service/VerseParserDialog";
import { formatDateTimeET } from "@/components/utils/timeFormat";
import { normalizeName } from "@/components/utils/textNormalization";

export default function MessageProcessingPage() {
    const queryClient = useQueryClient();
    const [selectedSegment, setSelectedSegment] = useState(null);
    const [isParserOpen, setIsParserOpen] = useState(false);

    // Fetch segments with pending submissions
    const { data: pendingSegments = [], isLoading } = useQuery({
        queryKey: ['pendingMessages'],
        queryFn: async () => {
            // Need to filter manually as API might not support complex text search or specific enum filtering perfectly yet depending on backend
            // But 'submission_status' is an enum/string field so it should work.
            return await base44.entities.Segment.filter({
                submission_status: 'pending'
            });
        },
        refetchInterval: 10000
    });

    const updateSegmentMutation = useMutation({
        mutationFn: async ({ id, data }) => {
            await base44.entities.Segment.update(id, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['pendingMessages']);
            setIsParserOpen(false);
            setSelectedSegment(null);
        }
    });

    const handleProcess = (segment) => {
        setSelectedSegment(segment);
        setIsParserOpen(true);
    };

    const handleSaveParsed = (data) => {
        if (!selectedSegment) return;
        
        updateSegmentMutation.mutate({
            id: selectedSegment.id,
            data: {
                scripture_references: data.verse, // The formatted string
                parsed_verse_data: data.parsed_data,
                submission_status: 'processed'
            }
        });
    };

    const handleIgnore = (segment) => {
        if (confirm("¿Estás seguro de ignorar esta sumisión?")) {
            updateSegmentMutation.mutate({
                id: segment.id,
                data: { submission_status: 'ignored' }
            });
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Procesamiento de Mensajes</h1>
                    <p className="text-gray-500">Revisar y extraer versículos de mensajes enviados</p>
                </div>
                <Badge variant="outline" className="px-3 py-1 text-base">
                    {pendingSegments.length} Pendientes
                </Badge>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
            ) : pendingSegments.length === 0 ? (
                <Card className="bg-gray-50 border-dashed border-2">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <CheckCircle2 className="w-12 h-12 text-green-500 mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900">¡Todo al día!</h3>
                        <p className="text-gray-500 max-w-sm mt-2">
                            No hay mensajes pendientes de procesamiento.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {pendingSegments.map((segment) => (
                        <Card key={segment.id} className="overflow-hidden hover:shadow-md transition-shadow">
                            <CardHeader className="bg-white border-b pb-3">
                                <div className="flex justify-between items-start mb-2">
                                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200">Pendiente</Badge>
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
                                        className="flex-1 bg-teal-600 hover:bg-teal-700"
                                    >
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        Procesar
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
                    ))}
                </div>
            )}

            {/* Reuse the VerseParserDialog */}
            {selectedSegment && (
                <VerseParserDialog
                    open={isParserOpen}
                    onOpenChange={setIsParserOpen}
                    initialText={selectedSegment.submitted_content || ""}
                    onSave={handleSaveParsed}
                    language="es"
                />
            )}
        </div>
    );
}
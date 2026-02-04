import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Sparkles, Send, CheckCircle2, Loader2, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function SpeakerSubmissionPage() {
    const [selectedSegmentId, setSelectedSegmentId] = useState("");
    const [content, setContent] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // Get active event ID from URL or fetch latest
    // For now, let's just fetch options for the latest event via the backend function
    // The backend function 'getSpeakerOptions' handles fetching the relevant sessions.
    // If we want to target a specific event, we could pass ?event_id=...
    const urlParams = new URLSearchParams(window.location.search);
    const eventIdParam = urlParams.get('event_id');

    const { data: options = [], isLoading } = useQuery({
        queryKey: ['speakerOptions', eventIdParam],
        queryFn: async () => {
            // Using backend function to bypass auth requirements for public page
            const res = await base44.functions.invoke('getSpeakerOptions', { event_id: eventIdParam });
            return res.data.options || [];
        }
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedSegmentId || !content.trim()) return;

        setIsSubmitting(true);
        try {
            await base44.functions.invoke('submitSpeakerContent', {
                segment_id: selectedSegmentId,
                content: content
            });
            setIsSuccess(true);
            toast.success("Mensaje enviado correctamente");
        } catch (error) {
            console.error("Error submitting content:", error);
            toast.error("Error al enviar el mensaje. Intente nuevamente.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-md bg-white border-2 border-green-100 shadow-xl">
                    <CardContent className="pt-10 pb-10 flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
                            <CheckCircle2 className="w-8 h-8 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Mensaje Recibido!</h2>
                        <p className="text-gray-600 mb-8">
                            Gracias por enviar tu contenido. El equipo de producción procesará las referencias bíblicas automáticamente.
                        </p>
                        <Button 
                            onClick={() => {
                                setIsSuccess(false);
                                setContent("");
                                setSelectedSegmentId("");
                            }}
                            variant="outline"
                        >
                            Enviar otro mensaje
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-teal-800 to-teal-900 flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl bg-white shadow-2xl border-0">
                <CardHeader className="bg-gray-50 border-b pb-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-teal-600 rounded-lg flex items-center justify-center text-white">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <div>
                            <CardTitle className="text-xl text-teal-900">Entrega de Mensaje</CardTitle>
                            <CardDescription>Palabras de Vida • Equipo de Producción</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Selecciona tu Sesión</label>
                            {isLoading ? (
                                <div className="h-10 w-full bg-gray-100 rounded animate-pulse" />
                            ) : (
                                <Select value={selectedSegmentId} onValueChange={setSelectedSegmentId}>
                                    <SelectTrigger className="h-12 text-base">
                                        <SelectValue placeholder="Selecciona una plenaria..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {options.map((opt) => (
                                            <SelectItem key={opt.id} value={opt.id}>
                                                <span className="font-semibold">{opt.session_name}</span> 
                                                <span className="text-gray-500 mx-2">•</span>
                                                <span>{opt.speaker}</span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Contenido del Mensaje</label>
                            <p className="text-xs text-gray-500 mb-2">
                                Pega aquí tus notas o bosquejo. El sistema extraerá automáticamente los versículos bíblicos.
                            </p>
                            <Textarea 
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="Pega tu mensaje aquí..."
                                className="min-h-[300px] text-base font-mono p-4 bg-gray-50 focus:bg-white transition-colors"
                            />
                        </div>

                        <Button 
                            type="submit" 
                            className="w-full h-12 text-lg font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-lg transition-all hover:scale-[1.01]"
                            disabled={isSubmitting || !selectedSegmentId || !content.trim()}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                    Enviando...
                                </>
                            ) : (
                                <>
                                    <Send className="w-5 h-5 mr-2" />
                                    Enviar Mensaje
                                </>
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
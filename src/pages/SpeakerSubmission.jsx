import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Send, CheckCircle2, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function SpeakerSubmissionPage() {
    const [selectedSegmentId, setSelectedSegmentId] = useState("");
    const [content, setContent] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [idempotencyKey] = useState(() => crypto.randomUUID());

    const urlParams = new URLSearchParams(window.location.search);
    const eventIdParam = urlParams.get('event_id');

    const { data, isLoading, error } = useQuery({
        queryKey: ['speakerOptions', eventIdParam],
        queryFn: async () => {
            const res = await base44.functions.invoke('getPublicSpeakerOptions', { event_id: eventIdParam });
            if (res.data?.error) throw new Error(res.data.error);
            return res.data || { options: [], event_name: null };
        }
    });

    const options = data?.options || [];
    const eventName = data?.event_name || "Evento";

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedSegmentId || !content.trim()) return;

        setIsSubmitting(true);
        try {
            const res = await base44.functions.invoke('submitSpeakerContent', {
                segment_id: selectedSegmentId,
                content: content,
                idempotencyKey
            });
            
            if (res.data?.error) throw new Error(res.data.error);

            setIsSuccess(true);
            toast.success("Mensaje enviado correctamente");
        } catch (error) {
            console.error("Error submitting content:", error);
            toast.error(error.message || "Error al enviar el mensaje. Intente nuevamente.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#f9fafb] to-[#f3f4f6] flex items-center justify-center p-4 font-sans">
                <Card className="w-full max-w-md bg-white border-0 shadow-lg rounded-xl">
                    <CardContent className="pt-10 pb-10 flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-[#d1fae5] rounded-full flex items-center justify-center mb-6">
                            <CheckCircle2 className="w-8 h-8 text-[#059669]" />
                        </div>
                        <h2 className="text-2xl font-bold text-[#111827] mb-2 font-['Bebas_Neue'] tracking-wide">¡MENSAJE RECIBIDO!</h2>
                        <p className="text-[#6B7280] mb-8 font-medium">
                            Gracias por enviar tu contenido. El equipo de producción procesará las referencias bíblicas automáticamente.
                        </p>
                        <Button 
                            onClick={() => window.location.reload()}
                            variant="outline"
                            className="w-full border-[#E5E7EB] text-[#111827] hover:bg-[#F9FAFB]"
                        >
                            Enviar otro mensaje
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Light Mode / Bebas Neue Design System
    return (
        <div className="min-h-screen bg-gradient-to-br from-[#f9fafb] to-[#f3f4f6] flex items-center justify-center p-4 font-sans text-[#111827]">
             {/* Font Import in standard way isn't possible here without Helmet, but we rely on globals.css imports */}
             {/* Assuming Bebas Neue is imported in globals.css as per existing files */}
             
            <div className="w-full max-w-[600px] bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-6 md:p-8">
                
                {/* Header */}
                <div className="text-center mb-8 border-b-2 border-[#1F8A70] pb-6">
                    <h1 className="font-['Bebas_Neue'] text-4xl text-[#111827] mb-2 tracking-wide uppercase">Entrega de Mensaje</h1>
                    <p className="text-[#6B7280] text-sm font-medium uppercase tracking-wider">{eventName}</p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-800 p-4 rounded-lg mb-6 text-sm font-medium border border-red-100">
                        Error: {error.message}
                    </div>
                )}

                <form onSubmit={handleSubmit} className={error ? 'hidden' : ''}>
                    {/* Section 1 */}
                    <div className="mb-8 p-6 bg-[#F9FAFB] rounded-lg border-l-4 border-[#1F8A70]">
                        <h3 className="font-['Bebas_Neue'] text-xl text-[#1F8A70] mb-4 tracking-wide uppercase">Información de la Sesión</h3>
                        
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-[#6B7280] uppercase tracking-wider">
                                Selecciona tu Plenaria <span className="text-red-600">*</span>
                            </label>
                            {isLoading ? (
                                <div className="h-12 w-full bg-gray-200 rounded animate-pulse" />
                            ) : (
                                <Select value={selectedSegmentId} onValueChange={setSelectedSegmentId}>
                                    <SelectTrigger className="h-12 border-[#E5E7EB] focus:ring-[#1F8A70]">
                                        <SelectValue placeholder="Selecciona una opción..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {options.map((opt) => (
                                            <SelectItem key={opt.id} value={opt.id}>
                                                {opt.session_name} • {opt.speaker}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    </div>

                    {/* Section 2 */}
                    <div className="mb-8 p-6 bg-[#F9FAFB] rounded-lg border-l-4 border-[#1F8A70]">
                        <h3 className="font-['Bebas_Neue'] text-xl text-[#1F8A70] mb-4 tracking-wide uppercase">Contenido del Mensaje</h3>

                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-[#6B7280] uppercase tracking-wider">
                                Notas o Bosquejo <span className="text-red-600">*</span>
                            </label>
                            <Textarea 
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="Pega aquí tus notas. El sistema extraerá automáticamente los versículos bíblicos."
                                className="min-h-[150px] border-[#E5E7EB] focus:ring-[#1F8A70] resize-y"
                            />
                        </div>
                    </div>

                    {/* Submit */}
                    <Button 
                        type="submit" 
                        className="w-full h-12 text-base font-bold bg-gradient-to-r from-[#1F8A70] to-[#8DC63F] hover:shadow-lg hover:-translate-y-px transition-all uppercase tracking-wide"
                        disabled={isSubmitting || !selectedSegmentId || !content.trim()}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                Enviando...
                            </>
                        ) : (
                            <>
                                ENVIAR MENSAJE
                            </>
                        )}
                    </Button>
                </form>
            </div>
        </div>
    );
}
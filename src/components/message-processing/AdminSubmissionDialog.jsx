import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { base44 } from "@/api/base44Client";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

/**
 * 2026-03-09: AdminSubmissionDialog
 * Admin form to submit segment content as SpeakerSubmissionVersion.
 * Falls into normal background automation with staleness guard protection.
 * No immediate parsing—allows background cycle to handle processing.
 */
export default function AdminSubmissionDialog({ open, onOpenChange, segment, onSubmitSuccess }) {
    const [content, setContent] = useState("");

    // Reset content when dialog opens/closes
    useEffect(() => {
        if (open && segment) {
            setContent(segment.submitted_content || "");
        } else if (!open) {
            setContent("");
        }
    }, [open, segment]);

    // Mutation: submit as SpeakerSubmissionVersion
    const submitMutation = useMutation({
        mutationFn: async () => {
            if (!content.trim()) {
                throw new Error("El contenido no puede estar vacío");
            }
            
            // Create a new SpeakerSubmissionVersion record
            // Background automation will pick it up and process it
            // FIX (2026-03-10): Include resolved_segment_entity_id for consistency
            // with the speaker submission paths. Admin submissions always use the
            // actual entity ID (not composite), so both fields are the same.
            const version = await base44.entities.SpeakerSubmissionVersion.create({
                segment_id: String(segment.id),
                resolved_segment_entity_id: String(segment.id),
                content: content,
                processing_status: "pending",
                source: "admin_submission",
                submitted_at: new Date().toISOString(),
                device_info: {
                    user_agent: navigator.userAgent,
                    timestamp: new Date().toISOString(),
                    submission_source: "admin"
                }
            });

            return version;
        },
        onSuccess: () => {
            // Optimistic toast during submission
            toast.loading("Procesando contenido...", { id: 'admin-submit' });
            
            // Log analytics
            base44.analytics.track({
                eventName: 'admin_submitted_content',
                properties: { segment_id: segment?.id }
            });
            
            onOpenChange(false);
            onSubmitSuccess?.();
            
            // Dismiss loading toast after modal closes
            setTimeout(() => toast.dismiss('admin-submit'), 500);
        },
        onError: (error) => {
            toast.error(error.message || "Error al enviar contenido");
        }
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Enviar Contenido de Orador</DialogTitle>
                    <DialogDescription>
                        {segment?.title || segment?.message_title || 'Segmento'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-2">
                            Contenido / Notas del Orador
                        </label>
                        <Textarea
                            placeholder="Ingresa versículos, puntos clave, o notas que serán procesadas automáticamente..."
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="h-40 text-sm font-mono resize-none"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                            Este contenido será procesado automáticamente para extraer versículos y puntos clave.
                        </p>
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={submitMutation.isPending}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={() => submitMutation.mutate()}
                        disabled={submitMutation.isPending || !content.trim()}
                        className="gap-2"
                    >
                        {submitMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                        {submitMutation.isPending ? 'Enviando...' : 'Enviar'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
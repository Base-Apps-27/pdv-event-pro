import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Send, UploadCloud, FileText, ArrowRight, Sparkles, Loader2, CheckCircle2, AlertCircle, Calendar } from "lucide-react";
import ScheduleReview from "@/components/importer/ScheduleReview";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export default function ScheduleImporter() {
  const [step, setStep] = useState("upload"); // upload, processing, review, success, error
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [reviewData, setReviewData] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();
  const lastProcessedMessageIdRef = useRef(null);

  // Handle file selection
  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  // Step 1: Process File
  const handleProcessFile = async () => {
    if (!file) return;
    
    // Size check (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
        toast.error("El archivo es demasiado grande (Máx 10MB)");
        return;
    }

    setStep("processing");
    setIsLoading(true);
    setErrorMessage("");
    setProcessingStatus("Iniciando proceso...");

    try {
      // 1. Upload File
      setProcessingStatus("Subiendo archivo al servidor...");
      let fileUrl = null;
      try {
          const uploadRes = await base44.integrations.Core.UploadFile({ file });
          fileUrl = uploadRes.file_url;
      } catch (uploadError) {
          throw new Error(`Error al subir archivo: ${uploadError.message || 'Falló la subida'}`);
      }

      if (!fileUrl) throw new Error("No se recibió la URL del archivo.");

      // 2. Create Conversation
      setProcessingStatus("Conectando con el Asistente IA...");
      let conv = null;
      try {
          conv = await base44.agents.createConversation({
            agent_name: "schedule_importer",
            metadata: { name: `Import ${file.name}` }
          });
          setConversationId(conv.id);
      } catch (agentError) {
           throw new Error(`Error al iniciar agente: ${agentError.message || 'No responde'}`);
      }

      // 3. Send Message
      setProcessingStatus("Enviando imagen para análisis...");
      await base44.agents.addMessage(conv, {
        role: "user",
        content: "Extract data from this schedule file. Output ONLY the JSON proposal.",
        file_urls: [fileUrl]
      });
      
      setProcessingStatus("Esperando respuesta de la IA...");

    } catch (error) {
      console.error("Error detailed:", error);
      setErrorMessage(error.message || "Error desconocido");
      setStep("error");
      setIsLoading(false);
    }
  };

  // Poll for agent updates (Robust fallback for subscription issues)
  useEffect(() => {
    if (!conversationId || step !== "processing") return;

    let isMounted = true;
    const pollInterval = setInterval(async () => {
      if (!isMounted) return;
      
      try {
        const conversation = await base44.agents.getConversation(conversationId);
        const msgs = conversation?.messages || [];

        // Update status if last message is user (waiting for assistant)
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg?.role === 'user') {
             setProcessingStatus("La IA está pensando...");
        }

        if (lastMsg?.role === 'assistant' && lastMsg.content && lastMsg.content !== lastProcessedMessageIdRef.current) {
            // Parse JSON
            let jsonString = null;
            const codeBlockMatch = lastMsg.content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            
            if (codeBlockMatch && codeBlockMatch[1]) {
                jsonString = codeBlockMatch[1];
            } else {
                const rawMatch = lastMsg.content.match(/(\{[\s\S]*"type"\s*:\s*"schedule_proposal"[\s\S]*\})/);
                if (rawMatch && rawMatch[1]) jsonString = rawMatch[1];
            }

            if (jsonString) {
                try {
                    const parsed = JSON.parse(jsonString);
                    if (parsed.type === 'schedule_proposal') {
                        lastProcessedMessageIdRef.current = lastMsg.content;
                        setReviewData(parsed);
                        setStep("review");
                        toast.success("Datos extraídos correctamente");
                    }
                } catch (e) {
                    console.error("JSON Parse error", e);
                }
            }
        }
      } catch (err) {
        console.warn("Polling error:", err);
      }
    }, 2000); // Poll every 2 seconds

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [conversationId, step]);

  // Step 2: Handle Confirmation & DB Creation
  const handleConfirmImport = async (finalData) => {
    setIsLoading(true);
    setProcessingStatus("Guardando en base de datos...");
    
    try {
        let eventId = finalData.existingEventId;

        // 1. Create Event if needed
        if (finalData.mode === 'new') {
            const newEvent = await base44.entities.Event.create({
                name: finalData.event.name || "Evento Importado",
                date: finalData.event.date, // Assuming schema supports date directly or mapping to start_date
                start_date: finalData.event.date,
                end_date: finalData.event.date,
                year: new Date(finalData.event.date || Date.now()).getFullYear(),
                status: 'planning',
                origin: 'manual'
            });
            eventId = newEvent.id;
        }

        if (!eventId) throw new Error("No Event ID available");

        // 2. Create Session
        const newSession = await base44.entities.Session.create({
            event_id: eventId,
            name: finalData.session.name || "Sesión General",
            date: finalData.event.date,
            origin: 'manual',
            // Map teams
            admin_team: finalData.session.admin_team,
            tech_team: finalData.session.tech_team,
            sound_team: finalData.session.sound_team,
            ushers_team: finalData.session.ushers_team,
            coordinators: finalData.session.coordinators
        });

        // 3. Create Pre-Session Details
        if (finalData.pre_session?.registration_desk_open_time) {
            await base44.entities.PreSessionDetails.create({
                session_id: newSession.id,
                registration_desk_open_time: finalData.pre_session.registration_desk_open_time,
                origin: 'manual'
            });
        }

        // 4. Create Segments
        if (finalData.segments?.length > 0) {
             // Create segments sequentially to preserve order if needed, or parallel
             // Mapped to schema
             const segmentPromises = finalData.segments.map((seg, idx) => {
                return base44.entities.Segment.create({
                    session_id: newSession.id,
                    order: idx + 1,
                    title: seg.title || "Untitled Segment",
                    start_time: seg.time,
                    duration_min: seg.duration_min,
                    segment_type: seg.type,
                    presenter: seg.presenter,
                    notes: seg.notes,
                    
                    // Conditional fields
                    number_of_songs: seg.number_of_songs,
                    song_1_title: seg.song_1_title, song_1_lead: seg.song_1_lead,
                    song_2_title: seg.song_2_title, song_2_lead: seg.song_2_lead,
                    song_3_title: seg.song_3_title, song_3_lead: seg.song_3_lead,
                    
                    message_title: seg.message_title,
                    scripture_references: seg.scripture_references,
                    
                    origin: 'manual'
                });
             });
             
             await Promise.all(segmentPromises);
        }

        setStep("success");
        queryClient.invalidateQueries(['events']);
        toast.success("Importación completada exitosamente");

    } catch (error) {
        console.error("Import error:", error);
        toast.error("Error al guardar los datos: " + error.message);
        setIsLoading(false);
    }
  };

  const resetImporter = () => {
    setStep("upload");
    setFile(null);
    setReviewData(null);
    setConversationId(null);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-12 flex flex-col items-center">
      
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 font-['Bebas_Neue'] tracking-wide uppercase flex items-center justify-center gap-3">
          <Sparkles className="w-8 h-8 text-pdv-teal" />
          Importador Inteligente de Cronogramas
        </h1>
        <p className="text-gray-500 mt-2 max-w-2xl mx-auto">
          Transforma tus cronogramas en papel o PDF en eventos digitales estructurados en segundos.
        </p>
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <Card className="w-full max-w-2xl border-2 border-dashed border-gray-300 hover:border-pdv-teal transition-colors bg-white">
          <div 
            className="p-12 flex flex-col items-center justify-center cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
             <div className="h-20 w-20 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                <UploadCloud className="w-10 h-10 text-blue-500" />
             </div>
             <h3 className="text-xl font-bold text-gray-900 mb-2">Sube tu archivo aquí</h3>
             <p className="text-gray-500 mb-8 text-center">
               Arrastra y suelta o haz clic para seleccionar.<br/>
               Soporta imágenes (JPG, PNG) y documentos PDF.
             </p>
             
             <input 
               type="file" 
               ref={fileInputRef} 
               className="hidden" 
               accept="image/*,.pdf" 
               onChange={handleFileSelect}
             />

             {file ? (
               <div className="flex items-center gap-4 bg-blue-50 px-4 py-3 rounded-lg border border-blue-100 w-full max-w-md animate-in fade-in zoom-in duration-300">
                  <FileText className="w-6 h-6 text-blue-600" />
                  <div className="flex-1 truncate font-medium text-blue-900">{file.name}</div>
                  <Button size="sm" onClick={(e) => { e.stopPropagation(); handleProcessFile(); }} className="bg-blue-600 hover:bg-blue-700">
                    Procesar <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
               </div>
             ) : (
               <Button variant="outline" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                 Seleccionar Archivo
               </Button>
             )}
          </div>
        </Card>
      )}

      {/* Step 2: Processing */}
      {step === "processing" && (
        <Card className="w-full max-w-md p-8 text-center bg-white shadow-lg animate-in fade-in zoom-in duration-300">
            <div className="flex justify-center mb-6">
                <div className="relative">
                    <div className="h-20 w-20 rounded-full border-4 border-slate-100"></div>
                    <div className="absolute top-0 left-0 h-20 w-20 rounded-full border-4 border-pdv-teal border-t-transparent animate-spin"></div>
                    <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-pdv-teal animate-pulse" />
                </div>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Procesando Cronograma</h3>
            <p className="text-gray-500 animate-pulse">{processingStatus}</p>
        </Card>
      )}

      {/* Error State */}
      {step === "error" && (
        <Card className="w-full max-w-md p-8 text-center bg-white shadow-lg animate-in fade-in zoom-in duration-300 border-red-100">
            <div className="h-20 w-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Hubo un problema</h3>
            <p className="text-red-500 mb-6 text-sm bg-red-50 p-3 rounded-md font-mono">{errorMessage}</p>
            <Button onClick={() => setStep("upload")} variant="outline" className="w-full">
                Intentar de Nuevo
            </Button>
        </Card>
      )}

      {/* Step 3: Review */}
      {step === "review" && reviewData && (
        <div className="w-full max-w-5xl animate-in fade-in slide-in-from-bottom-8 duration-500">
            <ScheduleReview 
                data={reviewData} 
                onConfirm={handleConfirmImport} 
                onCancel={resetImporter}
            />
        </div>
      )}

      {/* Step 4: Success */}
      {step === "success" && (
        <Card className="w-full max-w-md p-8 text-center bg-white shadow-lg animate-in fade-in zoom-in duration-300">
            <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">¡Importación Exitosa!</h3>
            <p className="text-gray-500 mb-8">
                El evento y la sesión han sido creados correctamente en la base de datos.
            </p>
            <div className="flex flex-col gap-3">
                <Button onClick={resetImporter} className="w-full bg-gray-900 text-white">
                    Importar Otro
                </Button>
                <Button variant="outline" onClick={() => window.location.href = '/events'} className="w-full">
                    Ver en Eventos
                </Button>
            </div>
        </Card>
      )}
    </div>
  );
}
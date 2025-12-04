import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { UploadCloud, FileText, ArrowRight, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
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
  
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  // Handle file selection
  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  // Step 1: Process File (Stateless LLM Implementation)
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

      // 2. Invoke LLM Directly (Stateless - No Agents SDK which was causing crashes)
      setProcessingStatus("Analizando imagen con IA...");
      
      const schemaPrompt = `
You are the Schedule Import Specialist. Digitize church event schedules into structured JSON.

## DOCUMENT STRUCTURE
These schedules have:
1. **HEADER BAND**: Event name, session name (e.g. "SECCIÓN 4"), date, and SESSION-LEVEL team assignments (VIDEO, LUCES, SONIDO, COORDINADOR).
2. **GRID ROWS**: Each row is a SEGMENT with time, content, duration, and notes columns.

## EXTRACTION RULES

### SESSION-LEVEL DATA (from header)
Extract these team assignments to the session object:
- VIDEO/EQUIPO TÉCNICO → tech_team
- LUCES/LIGHTING → (include in tech_team or notes)
- SONIDO/AUDIO → sound_team
- COORDINADOR A CARGO → coordinators
- ADMIN → admin_team
- UJIERES → ushers_team

### SEGMENTS (each grid row = one segment)
**CRITICAL TIME FORMAT**: Always use 24-hour "HH:MM" format.
- 3:18 PM → "15:18"
- 7:00 PM → "19:00"
- 9:30 PM → "21:30"

**SEGMENT TYPES** (use exactly these values):
- "MC" or "Bienvenida" - For MC/host introductions
- "Plenaria" - For main messages/sermons/panels
- "Alabanza" - For worship/song sets
- "Artes" - For dance/drama presentations
- "Cierre" - For closing segments
- "Ofrenda" - For offering
- "Anuncio" - For announcements
- "Video" - For video playback
- "Break" - For breaks

### SEGMENT FIELD MAPPING

**For ALL segments**:
- time: "HH:MM" (24h format, e.g. "15:18")
- duration_min: number (e.g. 60)
- title: Main title of segment
- type: One of the types above
- presenter: Speaker/MC/Leader name
- requires_translation: true/false
- translator_name: "Name" if translated
- projection_notes: Instructions for projection team
- sound_notes: Instructions for sound team
- ushers_notes: Instructions for ushers

**For type="Plenaria"**:
- message_title: The sermon title in quotes (e.g. "A PESAR DE LO QUE CUESTE")
- If it's a PANEL, list panelists in description_details

**For type="Alabanza"**:
- number_of_songs: count of songs
- song_1_title, song_2_title, etc.: Individual song names
- song_1_lead, song_2_lead, etc.: Lead vocalist if shown

**For type="Artes"**:
- Include art_types: ["DANCE", "DRAMA", "VIDEO"] as applicable
- dance_song_title: Song name used
- dance_song_source: Artist/source

### SPECIAL INSTRUCTIONS
1. **MC intro segments**: When you see "MC presenta a..." before a Plenaria, that's a SEPARATE short segment (2-5 min).
2. **Worship cues**: "A&A sube 15 mins antes" = worship team starts 15 min before segment ends. Put in sound_notes.
3. **Usher cues**: "remover púlpito", "colocar sillas" = Put in ushers_notes.
4. **Stage call times**: The blue "Hora en escenario" column shows when team should arrive. Can be stored as stage_call_time or derived.

## SEGMENT_ACTIONS (CRITICAL FOR PREP TASKS)
Extract timed operational tasks into segment_actions array. These are instructions like:
- "A&A sube 15 mins antes de concluir" → Alabanza team prep action
- "MC entra 2 mins antes" → MC prep action  
- "Ujieres: colocar púlpito" → Ushers prep action

Each action needs:
- label: Short description
- department: "Admin" | "MC" | "Sound" | "Projection" | "Hospitality" | "Ujieres" | "Alabanza" | "Stage & Decor" | "Translation" | "Other"
- timing: "before_start" | "after_start" | "before_end" | "absolute"
- offset_min: Minutes from timing reference
- is_prep: true if prep task (before segment), false if in-segment cue
- is_required: true if mandatory
- notes: Additional details

## OUTPUT FORMAT
Return ONLY valid JSON (no markdown):

{
  "type": "schedule_proposal",
  "event": {
    "name": "ÚNICA 2025 - SOY ÚNICA",
    "date": "2025-03-15",
    "location": "Santuario"
  },
  "session": {
    "name": "Sección 4 - Sábado PM",
    "tech_team": "Rick Pineda (Video), Danny Sena (Luces)",
    "sound_team": "Jerry Xelo",
    "coordinators": "Rubén Fabeiro",
    "admin_team": "",
    "ushers_team": ""
  },
  "pre_session": {
    "registration_desk_open_time": "14:30"
  },
  "segments": [
    {
      "time": "15:18",
      "duration_min": 2,
      "title": "MC: Bienvenida & presenta P. Kenia Andújar",
      "type": "MC",
      "presenter": "Denise Honrado",
      "requires_translation": true,
      "translator_name": "Mariel Guzmán",
      "projection_notes": "Anuncios / Announcements",
      "segment_actions": []
    },
    {
      "time": "15:20",
      "duration_min": 60,
      "title": "Plenaria #5",
      "type": "Plenaria",
      "presenter": "P. Kenia Andújar",
      "message_title": "A PESAR DE LO QUE CUESTE",
      "requires_translation": true,
      "translator_name": "Mariel Guzmán",
      "projection_notes": "Mostrar imágenes del mensaje",
      "segment_actions": [
        {
          "label": "A&A sube",
          "department": "Alabanza",
          "timing": "before_end",
          "offset_min": 15,
          "is_prep": true,
          "is_required": true,
          "notes": "Equipo de adoración en posición para ministración"
        },
        {
          "label": "Remover púlpito",
          "department": "Ujieres",
          "timing": "before_end",
          "offset_min": 5,
          "is_prep": true,
          "is_required": true,
          "notes": "Remover púlpito con mesita; agua y kleenex"
        }
      ]
    },
    {
      "time": "18:35",
      "duration_min": 25,
      "title": "Ministración / Worship",
      "type": "Alabanza",
      "number_of_songs": 4,
      "song_1_title": "Who Else",
      "song_2_title": "Give Me Jesus",
      "song_3_title": "Nothing Else",
      "song_4_title": "Cristo Eres Tú",
      "segment_actions": []
    }
  ]
}
`;

      const llmResponse = await base44.integrations.Core.InvokeLLM({
        prompt: schemaPrompt,
        file_urls: [fileUrl],
        response_json_schema: {
            "type": "object",
            "properties": {
                "type": { "type": "string" },
                "event": { "type": "object" },
                "session": { "type": "object" },
                "pre_session": { "type": "object" },
                "segments": { 
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "time": { "type": "string" },
                            "duration_min": { "type": "number" },
                            "title": { "type": "string" },
                            "type": { "type": "string" },
                            "presenter": { "type": "string" },
                            "segment_actions": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "label": { "type": "string" },
                                        "department": { "type": "string" },
                                        "timing": { "type": "string" },
                                        "offset_min": { "type": "number" },
                                        "is_prep": { "type": "boolean" },
                                        "is_required": { "type": "boolean" },
                                        "notes": { "type": "string" }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "required": ["type", "event", "session", "segments"]
        }
      });

      setProcessingStatus("Procesando respuesta...");

      // 3. Parse Response
      let parsedData = null;
      
      // Handle case where InvokeLLM returns string or object
      if (typeof llmResponse === 'string') {
         try {
             parsedData = JSON.parse(llmResponse);
         } catch (e) {
             // Try to find JSON in the string if it's wrapped in text
             const jsonMatch = llmResponse.match(/(\{[\s\S]*\})/);
             if (jsonMatch) parsedData = JSON.parse(jsonMatch[1]);
         }
      } else if (typeof llmResponse === 'object') {
         parsedData = llmResponse;
      }

      if (!parsedData || parsedData.type !== 'schedule_proposal') {
         // Fallback: try to construct proposal from partial data
         if (parsedData && (parsedData.event || parsedData.segments)) {
            parsedData = { type: 'schedule_proposal', ...parsedData };
         } else {
            throw new Error("La IA no devolvió datos válidos.");
         }
      }

      setReviewData(parsedData);
      setStep("review");
      toast.success("Datos extraídos correctamente");

    } catch (error) {
      console.error("Error detailed:", error);
      setErrorMessage(error.message || "Error desconocido durante el análisis");
      setStep("error");
      setIsLoading(false);
    }
  };

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
                date: finalData.event.date, 
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
             const segmentPromises = finalData.segments.map((seg, idx) => {
                return base44.entities.Segment.create({
                     session_id: newSession.id,
                     order: idx + 1,
                     title: seg.title || "Untitled Segment",
                     start_time: seg.time,
                     duration_min: seg.duration_min,
                     segment_type: seg.type,
                     presenter: seg.presenter,
                     other_notes: seg.notes,

                     // Conditional fields
                     number_of_songs: seg.number_of_songs,
                     song_1_title: seg.song_1_title, song_1_lead: seg.song_1_lead,
                     song_2_title: seg.song_2_title, song_2_lead: seg.song_2_lead,
                     song_3_title: seg.song_3_title, song_3_lead: seg.song_3_lead,

                     message_title: seg.message_title,
                     scripture_references: seg.scripture_references,

                     // Translation
                     requires_translation: seg.requires_translation,
                     translator_name: seg.translator_name,

                     // Team notes
                     projection_notes: seg.projection_notes,
                     sound_notes: seg.sound_notes,
                     ushers_notes: seg.ushers_notes,

                     // Structured actions
                     segment_actions: seg.segment_actions || [],

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
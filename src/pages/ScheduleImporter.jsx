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
You are the BASE44 INGESTION MODEL for church event schedule digitization.

## YOUR JOB
1. Visually read the PDF/image (layout, colors, labels, times, table structure)
2. Understand the structure: Event → Session → Segments (including Breakouts) → SegmentActions
3. Map everything into the Base44 schema with COMPLETE extraction of all data
4. Preserve ALL operational detail, especially timed instructions
5. CRITICAL: Distinguish between time-specific actions vs general team notes

## EVENT-LEVEL EXTRACTION
From the header area (e.g. "PROGRAMA DETALLADO ÚNICA 2025 'SOY ÚNICA' – SÁBADO 15 DE MARZO"):
- event.name: Full event name (e.g. "Única 2025 - Soy Única")
- event.year: Extract year (e.g. 2025)
- event.location: Venue if shown
- event.date: Use format "YYYY-MM-DD"

## SESSION-LEVEL EXTRACTION
A Session is defined by day label, section label, or continuous time band.

### Session Core Fields
- name: From "SECCIÓN X / SESSION X" and sub-labels
- date: From header date (format "YYYY-MM-DD")

### Session Team Assignments (from colored header bar or rows)
Map these labels:
- VIDEO/EQUIPO TÉCNICO → tech_team
- LUCES/LIGHTING → tech_team (combine)
- SONIDO/AUDIO → sound_team
- COORDINADOR A CARGO → coordinators
- ADMIN → admin_team
- UJIERES → ushers_team
- TRADUCCIÓN → translation_team
- FOTOGRAFÍA/MEDIA → photography_team
- HOSPITALIDAD → hospitality_team

## SEGMENT EXTRACTION

### TIME FORMAT (CRITICAL)
Always use 24-hour "HH:MM" format:
- 3:18 PM → "15:18"
- 7:00 PM → "19:00"
- 9:30 PM → "21:30"

### BREAKOUT SESSIONS DETECTION (NEW - CRITICAL)
**IF a single time block contains 2+ message titles/topics with different presenters:**
- This is a BREAKOUT session (parallel tracks)
- Use segment_type: "Breakout"
- Parse each sub-topic into the breakout_rooms array

Example: If you see multiple topics under one time slot (like Topic A with Speaker 1, Topic B with Speaker 2, Topic C with Speaker 3 all at 10:00 AM), create a Breakout segment with breakout_rooms array containing each topic and speaker pair.

### SEGMENT TYPES (use exactly these values)
- "Alabanza" - Worship/song sets
- "Bienvenida" / "MC" - MC/host introductions
- "Plenaria" - Main messages/sermons/panels
- "Ofrenda" - Offering
- "Anuncio" - Announcements
- "Break" - Breaks/meals (set major_break=true for meals)
- "Artes" / "Especial" - Dance/drama/arts presentations
- "Video" - Video playback
- "Cierre" - Closing segments
- "Breakout" - **Parallel sessions/rooms (NEW)**

### SEGMENT FIELDS BY TYPE

**For ALL segments**:
- time: "HH:MM" (24h)
- duration_min: number
- title: Main title
- type: One of above types
- presenter: Speaker/MC/Leader name
- requires_translation: true/false
- translator_name: Name if translated
- translation_mode: "InPerson" or "RemoteBooth"
- projection_notes, sound_notes, ushers_notes, stage_decor_notes, other_notes

**For type="Plenaria"**:
- message_title: Sermon title
- scripture_references: Bible references
- description_details: For panels, list panelists here

**For type="Alabanza"**:
- number_of_songs: count (1-6)
- song_1_title through song_6_title
- song_1_lead through song_6_lead

**For type="Artes"**:
- art_types: array of ["DANCE", "DRAMA", "VIDEO", "OTHER"]
- drama_handheld_mics, drama_headset_mics
- drama_start_cue, drama_end_cue
- dance_song_title, dance_song_source

**For type="Video"**:
- has_video: true
- video_name, video_location, video_length_sec

**For type="Breakout" (NEW)**:
- breakout_rooms: array of objects with:
  - topic: string (breakout session title)
  - speakers: string (presenter names)
  - hosts: string (moderator/facilitator if different from speaker)
  - general_notes: string (any production notes)

## NOTES vs ACTIONS: CRITICAL DISTINCTION

### GENERAL TEAM NOTES (go to _notes fields, NOT segment_actions)
These are general instructions WITHOUT specific timing references:
- "UJIERES: Ensure doors are monitored"
- "PROYECCIÓN: Have backup slides ready"
- "SONIDO: Two handheld mics needed"
- "Stage setup: púlpito y mesita"

Map these to the appropriate note field:
- projection_notes
- sound_notes
- ushers_notes
- stage_decor_notes
- other_notes

### TIME-SPECIFIC ACTIONS (go to segment_actions array)
These have EXPLICIT timing references:
- "A&A sube 15 mins antes de concluir" ✓
- "MC entra 2 mins antes" ✓
- "Verificar video antes de iniciar" ✓
- "Remover púlpito 5 mins antes de terminar" ✓
- "Ujieres cierran puertas al comenzar" ✓

## SEGMENT_ACTIONS EXTRACTION (CRITICAL)

Extract ONLY timed operational instructions into segment_actions array.

### Action Schema
{
  "label": "Short description (e.g. 'A&A sube')",
  "department": "Admin" | "MC" | "Sound" | "Projection" | "Hospitality" | "Ujieres" | "Kids" | "Coordinador" | "Stage & Decor" | "Alabanza" | "Translation" | "Other",
  "timing": "before_start" | "after_start" | "before_end" | "absolute",
  "offset_min": number (minutes from timing reference),
  "is_prep": boolean (true if timing="before_start"),
  "notes": "Additional details"
}

### TIMING CLASSIFICATION (CRITICAL)
- timing="before_start" → This is a PREP action (shown in PREP section), set is_prep=true
- All other timings (after_start, before_end, absolute) → DURANTE action (shown during segment), set is_prep=false

### Mapping Text to Timing
- "X mins antes de comenzar/iniciar" → timing: "before_start", offset_min: X, is_prep: true
- "X mins antes de concluir/terminar" → timing: "before_end", offset_min: X, is_prep: false
- "al inicio/al comenzar" → timing: "after_start", offset_min: 0, is_prep: false
- "X mins después de iniciar" → timing: "after_start", offset_min: X, is_prep: false
- "al terminar/al finalizar" → timing: "before_end", offset_min: 0, is_prep: false
- Explicit clock time → timing: "absolute", is_prep: depends on context

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
    "ushers_team": "",
    "translation_team": "",
    "hospitality_team": "",
    "photography_team": ""
  },
  "pre_session": {
    "registration_desk_open_time": "14:30",
    "general_notes": ""
  },
  "segments": [
    {
      "time": "15:18",
      "duration_min": 2,
      "title": "MC: Bienvenida",
      "type": "MC",
      "presenter": "Denise Honrado",
      "requires_translation": true,
      "translator_name": "Mariel Guzmán",
      "projection_notes": "Anuncios slide",
      "sound_notes": "",
      "ushers_notes": "",
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
      "segment_actions": [
        {
          "label": "Verificar slides del mensaje",
          "department": "Projection",
          "timing": "before_start",
          "offset_min": 10,
          "notes": "Confirmar orden de slides con predicador"
        },
        {
          "label": "A&A sube",
          "department": "Alabanza",
          "timing": "before_end",
          "offset_min": 15,
          "notes": "Equipo de adoración en posición"
        },
        {
          "label": "Remover púlpito",
          "department": "Ujieres",
          "timing": "before_end",
          "offset_min": 5,
          "notes": "Remover púlpito con mesita"
        }
      ]
    },
    {
      "time": "18:35",
      "duration_min": 25,
      "title": "Ministración",
      "type": "Alabanza",
      "presenter": "Sofía Ramos",
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
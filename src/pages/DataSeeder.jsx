import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CheckCircle2, AlertCircle, Play } from "lucide-react";

export default function DataSeeder() {
    const [status, setStatus] = useState('idle');
    const [logs, setLogs] = useState([]);

    const addLog = (msg) => setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), msg }]);

    const eventData = {
        "event": {
            "name": "Única 2025 \"Soy Única\"",
            "origin": "manual",
            "year": 2025,
            "status": "planning",
            "print_color": "pink" // Inferred from session color
        },
        "sessions": [
            {
                "name": "Sección 2 / Sesión 2 (Sábado AM)",
                "date": "2025-03-15",
                "planned_start_time": "09:00",
                "planned_end_time": "12:10",
                "order": 2,
                "session_color": "pink",
                "is_translated_session": true,
                "translation_team": "Equipo de traducción (ver segmentos)",
                "segments": [
                    {
                        "title": "Video Intro (sábado)",
                        "segment_type": "Video",
                        "order": 1,
                        "start_time": "09:00",
                        "duration_min": 1,
                        "color_code": "video",
                        "has_video": true,
                        "video_name": "Video intro sábado",
                        "video_length_sec": 60
                    },
                    {
                        "title": "Alabanza y Adoración: \"Sumergidas en Su Presencia\"",
                        "segment_type": "Alabanza",
                        "order": 2,
                        "start_time": "09:01",
                        "duration_min": 45,
                        "color_code": "worship",
                        "number_of_songs": 5,
                        "song_1_title": "Amigo",
                        "song_2_title": "Give Me Jesus",
                        "song_3_title": "Nothing Else",
                        "song_4_title": "Jesus You're Beautiful",
                        "song_5_title": "Most Beautiful"
                    },
                    {
                        "title": "Bienvenida y Anuncios",
                        "segment_type": "Anuncio",
                        "order": 3,
                        "start_time": "09:45",
                        "duration_min": 9,
                        "color_code": "announce",
                        "announcement_title": "Bienvenida / Anuncios",
                        "announcement_description": "MC: Leidy Negrón. Incluye anuncios e introducción del equipo de artes.",
                        "requires_translation": true,
                        "translation_mode": "BoothHeadphones",
                        "translator_name": "Angélica López"
                    },
                    {
                        "title": "Presentación de Artes (Pintura): \"Arte en Madera\"",
                        "segment_type": "Especial",
                        "order": 4,
                        "start_time": "09:55",
                        "duration_min": 6,
                        "color_code": "arts",
                        "art_types": ["OTHER"], // Mapped PAINTING to OTHER as it's not in enum
                        "art_other_description": "PAINTING",
                        "has_video": true,
                        "video_name": "Loved by You",
                        "video_length_sec": 360,
                        "other_notes": "Video con sonido; decoración: 1 sofá, mesa y canasta con espejos." // Mapped special_notes
                    },
                    {
                        "title": "Plenaria #2: \"Cuando mi pasado encuentra su bondad\"",
                        "segment_type": "Plenaria",
                        "order": 5,
                        "start_time": "10:00",
                        "duration_min": 60,
                        "color_code": "preach",
                        "presenter": "P. Mindy Reinoso",
                        "message_title": "Cuando mi pasado encuentra su bondad",
                        "requires_translation": true,
                        "translation_mode": "BoothHeadphones",
                        "translator_name": "P. Dania Roldán"
                    },
                    {
                        "title": "Receso",
                        "segment_type": "Anuncio", // Mapped to Anuncio as Break isn't fully detailed in JSON but usually Break type exists. Using user provided Anuncio type but checking schema... schema has Break type. User said Anuncio. I will stick to user JSON segment_type but schema might strictly require Break for breaks. User said segment_type: Anuncio. I will respect user input.
                        "order": 6,
                        "start_time": "11:00",
                        "duration_min": 10,
                        "color_code": "break",
                        "announcement_title": "Receso",
                        "announcement_description": "Anunciar receso."
                    },
                    {
                        "title": "Plenaria #3: \"Rompiendo el molde\"",
                        "segment_type": "Plenaria",
                        "order": 7,
                        "start_time": "11:10",
                        "duration_min": 60,
                        "color_code": "preach",
                        "presenter": "Laura Paz",
                        "message_title": "Rompiendo el molde",
                        "requires_translation": true,
                        "translation_mode": "BoothHeadphones",
                        "translator_name": "Mariel Guzmán"
                    },
                    {
                        "title": "Anunciar almuerzo / cierre sesión AM",
                        "segment_type": "Anuncio",
                        "order": 8,
                        "start_time": "12:10",
                        "duration_min": 2,
                        "color_code": "announce",
                        "announcement_title": "Anunciar almuerzo",
                        "announcement_description": "MC anuncia almuerzo (aprox. 1:20).",
                        "requires_translation": true,
                        "translation_mode": "BoothHeadphones",
                        "translator_name": "Angélica López"
                    }
                ]
            },
            {
                "name": "Sección 3 / Sesión 3 (Sábado PM - temprano)",
                "date": "2025-03-15",
                "planned_start_time": "13:45",
                "planned_end_time": "15:18",
                "order": 3,
                "session_color": "pink",
                "is_translated_session": true,
                "translation_team": "Equipo de traducción (ver segmentos)",
                "segments": [
                    {
                        "title": "Video Intro (sábado)",
                        "segment_type": "Video",
                        "order": 1,
                        "start_time": "13:45",
                        "duration_min": 1,
                        "color_code": "video",
                        "has_video": true,
                        "video_name": "Video intro sábado",
                        "video_length_sec": 60
                    },
                    {
                        "title": "Alabanza & Adoración",
                        "segment_type": "Alabanza",
                        "order": 2,
                        "start_time": "13:46",
                        "duration_min": 15,
                        "color_code": "worship",
                        "number_of_songs": 2,
                        "song_1_title": "Praise",
                        "song_1_lead": "Anthony Estrella",
                        "song_2_title": "Júbilo",
                        "song_2_lead": "Anthony Estrella"
                    },
                    {
                        "title": "Bienvenida y Anuncios",
                        "segment_type": "Anuncio",
                        "order": 3,
                        "start_time": "14:00",
                        "duration_min": 8,
                        "color_code": "announce",
                        "announcement_title": "Bienvenida / Anuncios",
                        "announcement_description": "MC: Denise Honrado. Incluye anuncios.",
                        "requires_translation": true,
                        "translation_mode": "BoothHeadphones",
                        "translator_name": "Angélica López"
                    },
                    {
                        "title": "Presentación de Artes: \"Mujer Eres Única\"",
                        "segment_type": "Especial",
                        "order": 4,
                        "start_time": "14:02",
                        "duration_min": 4.3,
                        "color_code": "arts",
                        "art_types": ["DRAMA", "DANCE"], // Valid enums
                        "has_video": true,
                        "video_name": "Mujer Eres Única",
                        "video_length_sec": 257,
                        "other_notes": "Canción: 'Reflejo' (Janaimar). Drama-danza: 1 personaje + 19 danzarines entran poco a poco."
                    },
                    {
                        "title": "Plenaria #4: \"Cuando mi imposibilidad encuentra su grandeza\"",
                        "segment_type": "Plenaria",
                        "order": 5,
                        "start_time": "14:10",
                        "duration_min": 60,
                        "color_code": "preach",
                        "presenter": "P. Lissette Jiménez",
                        "message_title": "Cuando mi imposibilidad encuentra su grandeza",
                        "requires_translation": true,
                        "translation_mode": "BoothHeadphones",
                        "translator_name": "Nelisse Quiñones"
                    },
                    {
                        "title": "Receso",
                        "segment_type": "Anuncio",
                        "order": 6,
                        "start_time": "15:10",
                        "duration_min": 10,
                        "color_code": "break",
                        "announcement_title": "Receso",
                        "announcement_description": "MC anuncia receso."
                    },
                    {
                        "title": "Anuncios finales / transición a Sesión 4",
                        "segment_type": "Anuncio",
                        "order": 7,
                        "start_time": "15:18",
                        "duration_min": 2,
                        "color_code": "announce",
                        "announcement_title": "Anuncios finales",
                        "announcement_description": ""
                    }
                ]
            },
            {
                "name": "Sección 4 / Sesión 4 (Sábado PM - tarde)",
                "date": "2025-03-15",
                "planned_start_time": "15:18",
                "planned_end_time": "19:00",
                "order": 4,
                "session_color": "pink",
                "is_translated_session": true,
                "translation_team": "Equipo de traducción (ver segmentos)",
                "segments": [
                    {
                        "title": "Introducción Plenaria #5",
                        "segment_type": "Anuncio",
                        "order": 1,
                        "start_time": "15:18",
                        "duration_min": 2,
                        "color_code": "announce",
                        "announcement_title": "Introducción",
                        "announcement_description": "MC: Denise Honrado presenta a P. Kenia Andújar.",
                        "requires_translation": true,
                        "translation_mode": "BoothHeadphones",
                        "translator_name": "Mariel Guzmán"
                    },
                    {
                        "title": "Plenaria #5: \"A pesar de lo que cueste\"",
                        "segment_type": "Plenaria",
                        "order": 2,
                        "start_time": "15:20",
                        "duration_min": 60,
                        "color_code": "preach",
                        "presenter": "P. Kenia Andújar",
                        "message_title": "A pesar de lo que cueste",
                        "requires_translation": true,
                        "translation_mode": "BoothHeadphones",
                        "translator_name": "Mariel Guzmán"
                    },
                    {
                        "title": "Introducción Panel Plenaria #6",
                        "segment_type": "Anuncio",
                        "order": 3,
                        "start_time": "16:20",
                        "duration_min": 5,
                        "color_code": "announce",
                        "announcement_title": "Introducción panel",
                        "announcement_description": "MC presenta panelistas.",
                        "requires_translation": true,
                        "translation_mode": "BoothHeadphones",
                        "translator_name": "Angélica López"
                    },
                    {
                        "title": "Plenaria #6 - Panel: \"Soy Única\"",
                        "segment_type": "Plenaria",
                        "order": 4,
                        "start_time": "16:25",
                        "duration_min": 60,
                        "color_code": "preach",
                        "presenter": "Panelistas: P. Mayra Báez, P. Carol Polo, Melodie Espinal, Belissa Pérez. MCs: P. Carol Melo & Elissa Montás.",
                        "message_title": "Soy Única (Panel)",
                        "requires_translation": true,
                        "translation_mode": "BoothHeadphones",
                        "translator_name": "Angélica Espinal"
                    },
                    {
                        "title": "Introducción Presentación de Artes",
                        "segment_type": "Anuncio",
                        "order": 5,
                        "start_time": "17:25",
                        "duration_min": 5,
                        "color_code": "announce",
                        "announcement_title": "Introducción artes",
                        "announcement_description": "MC presenta equipo de artes.",
                        "requires_translation": true,
                        "translation_mode": "BoothHeadphones",
                        "translator_name": "Angélica López"
                    },
                    {
                        "title": "Presentación de Artes: \"Mujer Eres Única\"",
                        "segment_type": "Especial",
                        "order": 6,
                        "start_time": "17:25",
                        "duration_min": 4.3,
                        "color_code": "arts",
                        "art_types": ["DRAMA", "DANCE"],
                        "has_video": true,
                        "video_name": "Mujer Eres Única",
                        "video_length_sec": 257,
                        "other_notes": "Canción: 'Wonderful, Beautiful, Glorious' (UPPERROOM). Drama-danza con 13 danzarines."
                    },
                    {
                        "title": "Introducción Plenaria #7",
                        "segment_type": "Anuncio",
                        "order": 7,
                        "start_time": "17:35",
                        "duration_min": 2,
                        "color_code": "announce",
                        "announcement_title": "Introducción",
                        "announcement_description": "MC: P. Denise Honrado presenta a A. Tere Paz.",
                        "requires_translation": true,
                        "translation_mode": "BoothHeadphones",
                        "translator_name": "Lorena Espaillat"
                    },
                    {
                        "title": "Plenaria #7: \"He probado y quiero más\"",
                        "segment_type": "Plenaria",
                        "order": 8,
                        "start_time": "17:35",
                        "duration_min": 60,
                        "color_code": "preach",
                        "presenter": "A. Tere Paz",
                        "message_title": "He probado y quiero más",
                        "requires_translation": true,
                        "translation_mode": "BoothHeadphones",
                        "translator_name": "Lorena Espaillat"
                    },
                    {
                        "title": "Alabanza de cierre",
                        "segment_type": "Alabanza",
                        "order": 9,
                        "start_time": "18:35",
                        "duration_min": 25,
                        "color_code": "worship",
                        "number_of_songs": 4,
                        "song_1_title": "Who Else",
                        "song_2_title": "Give Me Jesus",
                        "song_3_title": "Nothing Else",
                        "song_4_title": "Cristo Eres Tú"
                    },
                    {
                        "title": "Anuncios finales / cierre día",
                        "segment_type": "Anuncio",
                        "order": 10,
                        "start_time": "19:00",
                        "duration_min": 5,
                        "color_code": "announce",
                        "announcement_title": "Anuncios finales",
                        "announcement_description": "MCs cierre: Denise Honrado, Leidy Negrón & Melodie Espinal.",
                        "requires_translation": true,
                        "translation_mode": "BoothHeadphones",
                        "translator_name": "Lorena Espaillat"
                    }
                ]
            }
        ]
    };

    const runImport = async () => {
        if (status === 'running') return;
        setStatus('running');
        setLogs([]);
        addLog("Starting import process...");

        try {
            // 1. Create Event
            addLog("Creating Event: " + eventData.event.name);
            const createdEvent = await base44.entities.Event.create(eventData.event);
            addLog("Event created successfully with ID: " + createdEvent.id);

            // 2. Create Sessions
            for (const sessionData of eventData.sessions) {
                const { segments, ...sessionFields } = sessionData;
                
                addLog(`Creating Session: ${sessionFields.name}`);
                const createdSession = await base44.entities.Session.create({
                    ...sessionFields,
                    event_id: createdEvent.id
                });
                addLog(`Session created: ${createdSession.id}`);

                // 3. Create Segments
                addLog(`Creating ${segments.length} segments for session...`);
                // Use bulkCreate if available, or loop
                const segmentsWithIds = segments.map(seg => ({
                    ...seg,
                    session_id: createdSession.id
                }));

                // Batch in chunks of 5 for safety if bulkCreate is not used, 
                // but here we will use Promise.all for parallel creation or basic loop
                // Using loop to ensure order or standard creation
                await base44.entities.Segment.bulkCreate(segmentsWithIds);
                addLog(`Segments created successfully.`);
            }

            addLog("IMPORT COMPLETED SUCCESSFULLY!");
            setStatus('success');

        } catch (error) {
            console.error(error);
            addLog(`ERROR: ${error.message}`);
            setStatus('error');
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        Data Seeder: Única 2025
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-gray-600">
                        This tool will create the event <strong>"Única 2025 'Soy Única'"</strong> along with all its sessions and segments.
                    </p>
                    
                    <div className="flex gap-4">
                        <Button 
                            onClick={runImport} 
                            disabled={status === 'running' || status === 'success'}
                            className="bg-pdv-teal hover:bg-pdv-teal/90 text-white font-bold w-full md:w-auto"
                        >
                            {status === 'running' ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing...</>
                            ) : status === 'success' ? (
                                <><CheckCircle2 className="w-4 h-4 mr-2" /> Imported</>
                            ) : (
                                <><Play className="w-4 h-4 mr-2" /> Start Import</>
                            )}
                        </Button>
                    </div>

                    <div className="border rounded-md bg-slate-950 p-4 mt-4">
                        <h3 className="text-slate-400 text-xs font-bold uppercase mb-2 tracking-wider">Execution Log</h3>
                        <ScrollArea className="h-[300px] w-full">
                            <div className="space-y-1 font-mono text-xs">
                                {logs.length === 0 && <span className="text-slate-600 italic">Ready to start...</span>}
                                {logs.map((log, i) => (
                                    <div key={i} className="flex gap-2 text-slate-300">
                                        <span className="text-slate-500">[{log.time}]</span>
                                        <span className={log.msg.includes("ERROR") ? "text-red-400" : log.msg.includes("SUCCESS") ? "text-green-400" : ""}>
                                            {log.msg}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
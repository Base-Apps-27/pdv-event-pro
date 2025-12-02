import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Download, FileJson, Info, Split, BookText, Play, Loader2, CheckCircle2, Database } from "lucide-react";
import { toast } from "sonner";

export default function SchemaGuide() {
  const [importStatus, setImportStatus] = useState('idle');

  // ---------------------------------------------------------------------------
  // DATA SEEDER LOGIC
  // ---------------------------------------------------------------------------
  const unicaEventData = {
    "event": {
        "name": "Única 2025 \"Soy Única\"",
        "origin": "manual",
        "year": 2025,
        "status": "planning",
        "print_color": "pink"
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
                    "title": "Alabanza y Adoración",
                    "segment_type": "Alabanza",
                    "order": 2,
                    "start_time": "09:01",
                    "duration_min": 45,
                    "color_code": "worship",
                    "number_of_songs": 5,
                    "song_1_title": "Amigo",
                    "song_2_title": "Give Me Jesus"
                },
                {
                    "title": "Bienvenida y Anuncios",
                    "segment_type": "Anuncio",
                    "order": 3,
                    "start_time": "09:45",
                    "duration_min": 9,
                    "color_code": "announce",
                    "announcement_title": "Bienvenida / Anuncios",
                    "announcement_description": "MC: Leidy Negrón.",
                    "requires_translation": true,
                    "translation_mode": "BoothHeadphones",
                    "translator_name": "Angélica López"
                },
                {
                    "title": "Presentación de Artes (Pintura)",
                    "segment_type": "Especial",
                    "order": 4,
                    "start_time": "09:55",
                    "duration_min": 6,
                    "color_code": "arts",
                    "art_types": ["OTHER"],
                    "art_other_description": "PAINTING",
                    "has_video": true,
                    "video_name": "Loved by You",
                    "video_length_sec": 360
                },
                {
                    "title": "Plenaria #2",
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
                }
            ]
        },
        {
            "name": "Sección 3 / Sesión 3 (Sábado PM)",
            "date": "2025-03-15",
            "planned_start_time": "13:45",
            "planned_end_time": "15:18",
            "order": 3,
            "session_color": "pink",
            "segments": [
                {
                    "title": "Alabanza & Adoración",
                    "segment_type": "Alabanza",
                    "start_time": "13:46",
                    "duration_min": 15,
                    "color_code": "worship"
                },
                {
                    "title": "Presentación de Artes: \"Mujer Eres Única\"",
                    "segment_type": "Especial",
                    "start_time": "14:02",
                    "duration_min": 5,
                    "color_code": "arts",
                    "art_types": ["DRAMA", "DANCE"]
                },
                {
                    "title": "Plenaria #4",
                    "segment_type": "Plenaria",
                    "start_time": "14:10",
                    "duration_min": 60,
                    "color_code": "preach",
                    "presenter": "P. Lissette Jiménez",
                    "message_title": "Cuando mi imposibilidad encuentra su grandeza"
                }
            ]
        }
    ]
  };

  const runImport = async () => {
    if (importStatus === 'running') return;
    setImportStatus('running');
    const toastId = toast.loading("Creating 'Única 2025' event structure...");

    try {
        // 1. Create Event
        const createdEvent = await base44.entities.Event.create(unicaEventData.event);
        
        // 2. Create Sessions & Segments
        for (const sessionData of unicaEventData.sessions) {
            const { segments, ...sessionFields } = sessionData;
            
            const createdSession = await base44.entities.Session.create({
                ...sessionFields,
                event_id: createdEvent.id
            });

            const segmentsWithIds = segments.map(seg => ({
                ...seg,
                session_id: createdSession.id
            }));

            await base44.entities.Segment.bulkCreate(segmentsWithIds);
        }

        setImportStatus('success');
        toast.dismiss(toastId);
        toast.success("Event 'Única 2025' created successfully!");
        
        // Reset status after 3 seconds
        setTimeout(() => setImportStatus('idle'), 3000);

    } catch (error) {
        console.error(error);
        setImportStatus('error');
        toast.dismiss(toastId);
        toast.error(`Import failed: ${error.message}`);
    }
  };

  // ---------------------------------------------------------------------------
  // EXAMPLE DATA
  // ---------------------------------------------------------------------------
  const fullSchemaExample = {
    "event": {
      "name": "Conferencia Global: Visión 2025",
      "origin": "manual",
      "year": 2025,
      "location": "Auditorio Principal",
      "start_date": "2025-10-15",
      "end_date": "2025-10-17",
      "description": "Capacitación intensiva.",
      "status": "confirmed",
      "print_color": "teal",
      "promote_in_announcements": true,
      "promotion_start_date": "2025-08-01",
      "promotion_end_date": "2025-10-14",
      "announcement_blurb": "Regístrate antes del 1 de Septiembre.",
      "promotion_targets": ["Domingo AM", "Líderes"]
    },
    "sessions": [
      {
        "name": "Sesión 1: Apertura",
        "date": "2025-10-15",
        "planned_start_time": "19:00",
        "planned_end_time": "21:00",
        "order": 1,
        "session_color": "blue",
        "is_translated_session": true,
        "translation_team": "Mesa 1 (ES->EN)",
        "segments": [
          {
            "title": "Adoración (Worship Example)",
            "segment_type": "Alabanza",
            "order": 1,
            "start_time": "19:10",
            "duration_min": 30,
            "color_code": "worship",
            "number_of_songs": 2,
            "music_profile_id": "uuid-music-profile",
            "song_1_title": "Gracia Sublime",
            "song_1_lead": "Marcos",
            "song_2_title": "En Tu Luz",
            "song_2_lead": "Elena"
          },
          {
            "title": "Mensaje (Preaching Example)",
            "segment_type": "Plenaria",
            "order": 2,
            "presenter": "Dr. Juan Pérez",
            "message_title": "Expandiendo el Reino",
            "scripture_references": "Habacuc 2:2-3",
            "start_time": "19:40",
            "duration_min": 45,
            "color_code": "preach",
            "requires_translation": true,
            "translation_mode": "BoothHeadphones",
            "translator_name": "Sarah J."
          },
          {
            "title": "Video Spot (Video Example)",
            "segment_type": "Video",
            "order": 3,
            "start_time": "20:25",
            "duration_min": 5,
            "has_video": true,
            "video_name": "Testimonio.mp4",
            "video_location": "/assets/videos/",
            "video_length_sec": 300
          },
          {
            "title": "Talleres (Breakout Example)",
            "segment_type": "Breakout",
            "order": 4,
            "start_time": "20:30",
            "duration_min": 30,
            "color_code": "break",
            "breakout_rooms": [
              {
                "room_id": "uuid-room-1",
                "topic": "Liderazgo",
                "hosts": "Pedro"
              },
              {
                "room_id": "uuid-room-2",
                "topic": "Finanzas",
                "speakers": "Maria"
              }
            ]
          },
          {
            "title": "Drama Special (Arts Example)",
            "segment_type": "Especial",
            "order": 5,
            "start_time": "21:00",
            "duration_min": 10,
            "art_types": ["DRAMA"],
            "drama_headset_mics": 2,
            "drama_start_cue": "Lights blackout",
            "drama_end_cue": "Fade to black"
          }
        ]
      }
    ]
  };

  const jsonString = JSON.stringify(fullSchemaExample, null, 2);
  const unicaJsonString = JSON.stringify(unicaEventData, null, 2);

  const markdownGuide = `# Event System Complete Reference Guide

## 1. System Hierarchy & Overview
The system is built on a strictly hierarchical model designed for event production and scheduling.

1.  **Event**: The container. Represents the entire conference, retreat, or recurring service instance.
2.  **Session**: A specific block of time. E.g., "Friday Night", "Saturday Morning", "Sunday Service". Events have multiple sessions.
3.  **Segment**: The atomic unit of a schedule. E.g., "Song 1", "Preaching", "Video", "Announcements". Sessions have ordered segments.

---

## 2. Entity Reference: Event
The root object.

### Essential Fields
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| \`name\` | string | YES | Internal name. |
| \`year\` | number | YES | e.g., 2025. |
| \`status\` | enum | YES | \`planning\`, \`confirmed\`, \`in_progress\`, \`completed\`, \`archived\`. |

### Metadata & Styling
- \`theme\`: Public-facing theme/slogan.
- \`location\`: General venue name.
- \`start_date\`, \`end_date\`: YYYY-MM-DD.
- \`print_color\`: Styling for PDF exports. Options: \`blue\`, \`green\`, \`pink\`, \`orange\`, \`yellow\`, \`purple\`, \`red\`, \`teal\`, \`charcoal\`.

### Conditional Logic: Announcements
If you want this event to appear in the "Upcoming Events" announcement loop:

**Trigger**: \`promote_in_announcements = true\`
**Required if Triggered**:
- \`promotion_start_date\` (Date to start showing)
- \`promotion_end_date\` (Date to stop showing)
- \`announcement_blurb\` (Short text for the slide)
- \`promotion_targets\` (Array of service types, e.g. ["Domingo AM"])

---

## 3. Entity Reference: Session
A block of time within an Event.

### Essential Fields
- \`name\`: Display name (e.g. "Sesión 1").
- \`date\`: YYYY-MM-DD.
- \`planned_start_time\`: HH:MM (24h).
- \`planned_end_time\`: HH:MM (24h).
- \`order\`: Number (sort order within event).

### Team Assignments (Strings)
Free text fields to assign teams for this specific block:
- \`admin_team\`, \`coordinators\`, \`sound_team\`, \`tech_team\`, \`ushers_team\`, \`translation_team\`, \`hospitality_team\`, \`photography_team\`.
- \`worship_leader\`: Name of the person leading worship.

### Styling
- \`session_color\`: Visual theme for UI/Print. Same options as Event print_color.

---

## 4. Entity Reference: Segment
The most complex entity with significant conditional logic based on \`segment_type\`.

### Universal Fields (All Types)
- \`title\`: Required. Display title.
- \`start_time\`: HH:MM.
- \`duration_min\`: Integer minutes.
- \`color_code\`: Visual cue. \`default\`, \`worship\` (blue), \`preach\` (purple), \`break\` (gray), \`tech\` (red), \`special\` (yellow).
- \`notes\`: Specific instructions per department:
  - \`projection_notes\`, \`sound_notes\`, \`ushers_notes\`, \`stage_decor_notes\`, \`translation_notes\`.

### Universal Logic: Translation
**Trigger**: \`requires_translation = true\`
**Required**:
- \`translation_mode\`: \`InPerson\` (stage) or \`BoothHeadphones\` (remote).
- \`translator_name\`: Name of translator.

### Universal Logic: Video
**Trigger**: \`has_video = true\` (Can apply to ANY type, e.g. a song with a video backing)
**Required**:
- \`video_name\`: File name.
- \`video_location\`: Path or link.
- \`video_length_sec\`: Duration in seconds.

---

## 5. Segment Types & Specific Fields

### Type: Alabanza (Worship)
Used for musical worship sets.
- \`number_of_songs\`: Integer (1-6).
- \`music_profile_id\`: Reference to music style profile.
- **Song Fields**:
  - \`song_1_title\`, \`song_1_lead\`
  - ... up to \`song_6_title\`, \`song_6_lead\`

### Type: Plenaria (Preaching)
Used for the main message.
- \`presenter\`: Speaker name.
- \`message_title\`: Sermon title.
- \`scripture_references\`: e.g. "John 3:16".

### Type: Breakout (Talleres)
Used for simultaneous tracks.
- \`breakout_rooms\`: Array of objects.
  \`\`\`json
  {
    "room_id": "uuid",
    "topic": "Title",
    "hosts": "Name",
    "speakers": "Name"
  }
  \`\`\`

### Type: Especial / Artes (Drama, Dance)
Used for special productions.
- \`art_types\`: Array of enums: \`['DRAMA', 'DANCE', 'VIDEO', 'OTHER']\`.
- \`drama_handheld_mics\`, \`drama_headset_mics\`: Counts.
- \`drama_start_cue\`, \`drama_end_cue\`: Technical cues.
- \`dance_song_title\`, \`dance_song_source\`: Backing track info.

### Type: Anuncio (Announcement)
Used for live spoken announcements.
- \`announcement_title\`: Headline.
- \`announcement_description\`: Script or bullet points.
- \`announcement_series_id\`: Optional link to series.

---

## 6. Full JSON Payload Example
\`\`\`json
${jsonString}
\`\`\`
`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(jsonString);
    toast.success("JSON Schema copied to clipboard");
  };

  const downloadJson = () => {
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "event_schema_examples.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Download started");
  };

  const downloadMarkdown = () => {
    const blob = new Blob([markdownGuide], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Base44_Event_Schema_Guide.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Documentation download started");
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold font-['Bebas_Neue'] uppercase">Data Injection Guide</h1>
          <p className="text-gray-500">Complete reference for Event, Session, and Segment data structures with variety examples.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={copyToClipboard} variant="outline" className="gap-2">
            <Copy className="w-4 h-4" />
            Copy JSON Only
          </Button>
          <Button onClick={downloadJson} variant="outline" className="gap-2">
            <FileJson className="w-4 h-4" />
            Download JSON
          </Button>
          <Button onClick={downloadMarkdown} className="gap-2 bg-pdv-teal hover:bg-pdv-teal/90 text-white">
            <BookText className="w-4 h-4" />
            Download Full Guide (MD)
          </Button>
        </div>
      </div>

      {/* Data Seeder Card */}
      <Card className="border-pdv-pink border-l-4 shadow-sm bg-gradient-to-r from-pink-50/50 to-white">
        <CardHeader>
            <CardTitle className="flex items-center gap-2 text-pdv-pink">
              <Database className="w-5 h-5" />
              Live Data Generator: "Única 2025"
            </CardTitle>
        </CardHeader>
        <CardContent>
            <div className="flex flex-col md:flex-row gap-6 items-center">
                <div className="flex-1 space-y-2">
                    <p className="text-sm text-gray-700">
                        Use this tool to automatically inject a comprehensive sample event into the database.
                        This will create the event <strong>"Única 2025"</strong> with 2 full sessions and mixed segment types (Worship, Preaching, Drama/Arts, Announcements).
                    </p>
                    <p className="text-xs text-gray-500 italic">
                        Great for testing new features or visualizing complex schedules without manual entry.
                    </p>
                </div>
                <div className="shrink-0">
                     <Button 
                        onClick={runImport} 
                        disabled={importStatus === 'running' || importStatus === 'success'}
                        className={`font-bold uppercase transition-all ${importStatus === 'success' ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-900 hover:bg-gray-800'} text-white`}
                    >
                        {importStatus === 'running' ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                        ) : importStatus === 'success' ? (
                            <><CheckCircle2 className="w-4 h-4 mr-2" /> Created Successfully</>
                        ) : (
                            <><Play className="w-4 h-4 mr-2" /> Generate "Única 2025"</>
                        )}
                    </Button>
                </div>
            </div>
            
            {/* Optional: Preview the Unica JSON */}
             <div className="mt-4 pt-4 border-t border-gray-100">
                 <details className="text-xs text-gray-400">
                    <summary className="cursor-pointer hover:text-gray-600 transition-colors">View Source Data (JSON)</summary>
                    <pre className="mt-2 p-2 bg-slate-50 rounded border text-[10px] overflow-x-auto max-h-40">
                        {unicaJsonString}
                    </pre>
                 </details>
             </div>

        </CardContent>
      </Card>

      {/* Full JSON Example */}
      <Card className="border-pdv-teal/20 shadow-md">
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileJson className="w-5 h-5 text-pdv-teal" />
              Master JSON Payload (Generic Reference)
            </CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-sm text-gray-500 mb-4">
              This generic example demonstrates a variety of <strong>Segment Types</strong> (Worship, Preaching, Video, Breakouts) to illustrate field requirements.
            </p>
            <ScrollArea className="h-[400px] w-full rounded-md border bg-gray-900 p-4">
                <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap leading-relaxed">
                  {jsonString}
                </pre>
            </ScrollArea>
        </CardContent>
      </Card>

      {/* Detailed Documentation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Event Logic */}
        <div className="lg:col-span-1 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        Event Logic
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="p-3 bg-slate-50 rounded border border-slate-100">
                        <h4 className="font-bold text-sm mb-1">Basic Fields</h4>
                        <p className="text-xs text-gray-600"><code>name</code>, <code>year</code>, <code>status</code> are always required.</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded border border-blue-100">
                        <h4 className="font-bold text-sm mb-1 text-blue-800">Announcements</h4>
                        <p className="text-xs text-blue-700 mb-2">
                            If <code>promote_in_announcements: true</code>, you must include:
                        </p>
                        <ul className="list-disc pl-4 text-xs text-blue-700 space-y-1">
                            <li><code>promotion_start_date</code></li>
                            <li><code>promotion_end_date</code></li>
                            <li><code>announcement_blurb</code></li>
                        </ul>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Split className="w-4 h-4" />
                        Segment Universal Logic
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="p-3 bg-slate-50 rounded border border-slate-100">
                        <h4 className="font-bold text-sm mb-1">Translation</h4>
                        <p className="text-xs text-gray-600 mb-1">
                            If <code>requires_translation: true</code>:
                        </p>
                        <ul className="list-disc pl-4 text-xs text-gray-600">
                            <li><code>translation_mode</code> (e.g. "BoothHeadphones")</li>
                            <li><code>translator_name</code></li>
                        </ul>
                    </div>
                    <div className="p-3 bg-slate-50 rounded border border-slate-100">
                        <h4 className="font-bold text-sm mb-1">Video Content</h4>
                        <p className="text-xs text-gray-600 mb-1">
                            If <code>has_video: true</code> (regardless of type):
                        </p>
                        <ul className="list-disc pl-4 text-xs text-gray-600">
                            <li><code>video_name</code></li>
                            <li><code>video_location</code></li>
                            <li><code>video_length_sec</code></li>
                        </ul>
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* Segment Types Variety */}
        <div className="lg:col-span-2">
            <Card className="h-full">
                <CardHeader>
                    <CardTitle>Segment Types & Varieties</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* Worship */}
                        <div className="border p-4 rounded-lg bg-slate-50/50">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-bold text-sm">Type: Alabanza (Worship)</h3>
                                <Badge variant="outline" className="text-xs">Song Set</Badge>
                            </div>
                            <p className="text-xs text-gray-500 mb-2">Used for worship blocks.</p>
                            <div className="bg-white p-2 rounded border text-xs font-mono text-gray-600">
                                "number_of_songs": 2,<br/>
                                "song_1_title": "Song Name",<br/>
                                "song_1_lead": "Singer Name"
                            </div>
                        </div>

                        {/* Preaching */}
                        <div className="border p-4 rounded-lg bg-slate-50/50">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-bold text-sm">Type: Plenaria (Preaching)</h3>
                                <Badge variant="outline" className="text-xs">Message</Badge>
                            </div>
                            <p className="text-xs text-gray-500 mb-2">Main teaching or keynote.</p>
                            <div className="bg-white p-2 rounded border text-xs font-mono text-gray-600">
                                "presenter": "Speaker Name",<br/>
                                "message_title": "Sermon Title",<br/>
                                "scripture_references": "John 3:16"
                            </div>
                        </div>

                        {/* Breakout */}
                        <div className="border p-4 rounded-lg bg-slate-50/50">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-bold text-sm">Type: Breakout (Talleres)</h3>
                                <Badge variant="outline" className="text-xs">Complex</Badge>
                            </div>
                            <p className="text-xs text-gray-500 mb-2">Multiple simultaneous rooms.</p>
                            <div className="bg-white p-2 rounded border text-xs font-mono text-gray-600">
                                "breakout_rooms": [<br/>
                                &nbsp;&nbsp;{"{ \"topic\": \"A\", \"hosts\": \"Name\" }"}<br/>
                                ]
                            </div>
                        </div>

                        {/* Video */}
                        <div className="border p-4 rounded-lg bg-slate-50/50">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-bold text-sm">Type: Video</h3>
                                <Badge variant="outline" className="text-xs">Media</Badge>
                            </div>
                            <p className="text-xs text-gray-500 mb-2">Dedicated video segment.</p>
                            <div className="bg-white p-2 rounded border text-xs font-mono text-gray-600">
                                "has_video": true,<br/>
                                "video_name": "File.mp4",<br/>
                                "video_length_sec": 120
                            </div>
                        </div>
                        
                        {/* Arts/Drama */}
                        <div className="border p-4 rounded-lg bg-slate-50/50">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-bold text-sm">Type: Especial (Arts)</h3>
                                <Badge variant="outline" className="text-xs">Production</Badge>
                            </div>
                            <p className="text-xs text-gray-500 mb-2">Drama, dance, or special items.</p>
                            <div className="bg-white p-2 rounded border text-xs font-mono text-gray-600">
                                "art_types": ["DRAMA", "DANCE"],<br/>
                                "drama_headset_mics": 2,<br/>
                                "drama_start_cue": "Cue info"
                            </div>
                        </div>

                        {/* Announcement */}
                        <div className="border p-4 rounded-lg bg-slate-50/50">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-bold text-sm">Type: Anuncio</h3>
                                <Badge variant="outline" className="text-xs">Script</Badge>
                            </div>
                            <p className="text-xs text-gray-500 mb-2">Live announcements.</p>
                            <div className="bg-white p-2 rounded border text-xs font-mono text-gray-600">
                                "announcement_title": "Welcome",<br/>
                                "announcement_description": "Script..."
                            </div>
                        </div>

                    </div>
                </CardContent>
            </Card>
        </div>

      </div>
    </div>
  );
}
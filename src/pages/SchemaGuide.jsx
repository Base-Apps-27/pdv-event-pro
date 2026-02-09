import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Download, FileJson, BookText, Sparkles, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

// ─── Complete AI Prompt Template ────────────────────────────────────────
const AI_PROMPT_TEMPLATE = `EVENT: [Event Name] — [Start Date] to [End Date]

SESSION: [Session Name] | [Date] | [Start Time]–[End Time] | Room: [Room Name] | Color: [green/blue/pink/orange/yellow/purple/red]
Teams: Sound=[Name], Lights=[Name], Video=[Name], Photography=[Name], Translation=[Name], Coordinators=[Name], Ushers=[Name], Hospitality=[Name], Worship Leader=[Name]

  1. [SegmentType]: "[Title]" | [Duration]min | Presenter: [Name] | Color: [worship/preach/break/tech/special/default]
     - Translation: [Yes/No] | Mode: [InPerson/RemoteBooth] | Translator: [Name]
     - Stage Call: [X]min before
     - Visibility: General=[Yes/No], Projection=[Yes/No], Sound=[Yes/No], Ushers=[Yes/No]
     - Notes: Projection=[...], Sound=[...], Ushers=[...], Stage & Decor=[...], Translation=[...]
     - Songs: [Song1] (Key: [X], Lead: [Name]), [Song2] (Key: [X], Lead: [Name])

  2. Plenaria: "[Title]" | [Duration]min | Presenter: [Name]
     - Message Title: "[Sermon Title]"
     - Scripture: [Book Chapter:Verse-Verse]
     - Presentation URL: [link to slides]
     - Notes URL: [link to speaker notes PDF]
     - Slides Only: [Yes/No]

  3. Panel: "[Topic]" | [Duration]min
     - Moderator: [Name]
     - Panelists: [Name1], [Name2], [Name3]

  4. Break: "[Title]" | [Duration]min | Major: [Yes/No]

  5. Artes: "[Title]" | [Duration]min
     - Types: [DANCE/DRAMA/VIDEO/OTHER]
     - Drama: Handheld Mics=[N], Headset Mics=[N], Start Cue="[cue]", End Cue="[cue]"
     - Drama Song 1: "[Title]" | Source: [URL] | Owner: [Name]
     - Drama Song 2: "[Title]" | Source: [URL] | Owner: [Name]
     - Drama Song 3: "[Title]" | Source: [URL] | Owner: [Name]
     - Dance: Handheld Mics=[N], Headset Mics=[N], Start Cue="[cue]", End Cue="[cue]"
     - Dance Song 1: "[Title]" | Source: [URL] | Owner: [Name]
     - Dance Song 2: "[Title]" | Source: [URL] | Owner: [Name]
     - Dance Song 3: "[Title]" | Source: [URL] | Owner: [Name]
     - Other Description: [text]
     - Run of Show URL: [link to PDF]

  6. Video: "[Video Name]" | [Duration]min
     - Location: [path/drive] | Owner: [Name] | URL: [link] | Length: [seconds]

  7. Anuncio: "[Title]" | [Duration]min | Presenter: [Name]
     - Description: [script or bullets]
     - Date: [YYYY-MM-DD] | Tone: [Energetic/Serious/Informative/etc.]

  8. Breakout: "[Title]" | [Duration]min
     - Room 1: Topic="[Topic]" | Hosts="[Name]" | Speakers="[Name]"
       Translation: [Yes/No] | Mode: [InPerson/RemoteBooth] | Translator: [Name]
       Notes: [general notes] | Other: [specific notes]
     - Room 2: ...

SESSION: [Next Session Name] | ...
  ...same pattern...`;

// ─── Real JSON Example from Juntos 2026 Conference ─────────────────────
const FULL_JSON_EXAMPLE = {
  "event": {
    "name": "Juntos",
    "origin": "manual",
    "theme": "Amor Que Sana",
    "year": 2026,
    "location": "Palabras de Vida Bronx",
    "start_date": "2026-02-06",
    "end_date": "2026-02-07",
    "description": "",
    "status": "confirmed",
    "print_color": "charcoal",
    "promote_in_announcements": false
  },
  "sessions": [
    {
      "name": "Viernes PM - SESIÓN I",
      "date": "2026-02-06",
      "planned_start_time": "19:30",
      "planned_end_time": "",
      "order": 1,
      "session_color": "blue",
      "is_translated_session": true,
      "default_stage_call_offset_min": 15,
      "location": "Palabras de Vida Bronx",
      "admin_team": "Isabel Gómez & Yassiel Santos",
      "coordinators": "Indiana A. & Luis A.",
      "sound_team": "Randy Gerónimo",
      "lights_team": "Danny M",
      "video_team": "Rick P",
      "tech_team": "Rick & Danny",
      "translation_team": "Jessica & Ana V.",
      "hospitality_team": "Mercedes García & Verla Solís",
      "photography_team": "Emily Vásquez",
      "worship_leader": "Anthony Estrella",
      "segments": [
        {
          "title": "Alabanza",
          "segment_type": "Alabanza",
          "order": 1,
          "start_time": "19:30",
          "duration_min": 30,
          "color_code": "worship",
          "presenter": "David & Thais Amaya",
          "number_of_songs": 3,
          "song_1_title": "Gloria Aleluya",
          "song_2_title": "Deseo Eterno",
          "song_3_title": "Cristo Eres Tu",
          "requires_translation": false,
          "segment_actions": [
            {
              "label": "Equipo debe estar listo para iniciar",
              "department": "Coordinador",
              "timing": "before_start",
              "offset_min": 2,
              "is_prep": true,
              "is_required": false
            }
          ]
        },
        {
          "title": "BIENVENIDA Y ANUNCIOS",
          "segment_type": "Anuncio",
          "order": 2,
          "start_time": "20:00",
          "duration_min": 5,
          "color_code": "default",
          "presenter": "P. Yajardo & Darling Garrido",
          "requires_translation": true,
          "translation_mode": "InPerson",
          "translator_name": "Jeremy Mateo",
          "projection_notes": "-Conferencia Juntos 2026: \"Amor Que Sana\"\n-Venta de Mercancía\n-Libros de P. Riqui Gell\n-QR CODE Programa",
          "sound_notes": "2 micrófonos",
          "ushers_notes": "No colocar púlpito y mesita ya que habrá una presentación de Artes",
          "segment_actions": [
            {
              "label": "MCs listos para salir",
              "department": "Coordinador",
              "timing": "before_start",
              "offset_min": 2,
              "is_prep": true,
              "is_required": false
            }
          ]
        },
        {
          "title": "OFRENDAS",
          "segment_type": "Ofrenda",
          "order": 3,
          "start_time": "20:05",
          "duration_min": 10,
          "color_code": "default",
          "presenter": "P. Yajardo Garrido",
          "requires_translation": true,
          "translation_mode": "InPerson",
          "translator_name": "Jeremy Mateo",
          "projection_notes": "QR code de MANERAS DE DAR",
          "ushers_notes": "Estar listos con canastas",
          "segment_actions": [
            {
              "label": "Tener las canastas listas",
              "department": "Ujieres",
              "timing": "before_start",
              "offset_min": 5,
              "is_prep": true,
              "is_required": false
            }
          ]
        },
        {
          "title": "PLENARIA #1",
          "segment_type": "Plenaria",
          "order": 4,
          "start_time": "20:15",
          "duration_min": 60,
          "color_code": "preach",
          "presenter": "Pastores Rafael & Maria Isabel Paz",
          "message_title": "\"CUANDO EL AMOR SANA\" - El Amor Que Restaura",
          "requires_translation": true,
          "translation_mode": "RemoteBooth",
          "projection_notes": "-Proyectar el nombre y título de la plenaria y conferencistas\n-Proyectar citas bíblicas",
          "sound_notes": "2 micrófonos para Pastores Paz",
          "stage_decor_notes": "Púlpito y mesita"
        },
        {
          "title": "MINISTRACIÓN",
          "segment_type": "Ministración",
          "order": 5,
          "start_time": "21:15",
          "duration_min": 15,
          "color_code": "worship",
          "presenter": "Pastores Rafael & Maria Isabel Paz"
        }
      ]
    },
    {
      "name": "Sábado AM - SESIÓN II",
      "date": "2026-02-07",
      "planned_start_time": "09:00",
      "planned_end_time": "13:00",
      "order": 2,
      "session_color": "green",
      "is_translated_session": true,
      "default_stage_call_offset_min": 15,
      "location": "Palabras de Vida Bronx",
      "admin_team": "Yassiel Santos",
      "coordinators": "Rita R & Jordan",
      "sound_team": "Jerry Xelo",
      "lights_team": "Danny M & Hector M",
      "video_team": "Rick P",
      "tech_team": "Rick & Danny",
      "translation_team": "Jessica & Ana V.",
      "hospitality_team": "Mercedes García & Verla Solís",
      "photography_team": "Alexis Polanco",
      "worship_leader": "Anthony Estrella",
      "segments": [
        {
          "title": "ALABANZA & ADORACIÓN",
          "segment_type": "Alabanza",
          "order": 1,
          "start_time": "09:00",
          "duration_min": 30,
          "color_code": "worship",
          "presenter": "Anthony y Lauren Estrella",
          "number_of_songs": 3,
          "song_1_title": "High Praise",
          "song_2_title": "Yo Te Amo",
          "song_3_title": "En Tu Presencia",
          "requires_translation": false,
          "segment_actions": [
            {
              "label": "Equipo de A&A listos para salir",
              "department": "Coordinador",
              "timing": "before_start",
              "offset_min": 2,
              "is_prep": true,
              "is_required": false
            }
          ]
        },
        {
          "title": "BIENVENIDA Y ANUNCIOS",
          "segment_type": "Bienvenida",
          "order": 2,
          "start_time": "09:30",
          "duration_min": 10,
          "color_code": "default",
          "presenter": "MC: Pastores Luis & Scarlet García (bilingüe)",
          "requires_translation": true,
          "translation_mode": "InPerson",
          "translator_name": "Melodie Espinal",
          "projection_notes": "-QR code PROGRAMA JUNTOS 2026\n-Venta de Mercancía\n-Libros de P. Riqui Gell\n-ÚNICA 2026 con QR code\n-Programa por sesiones sábado am\n\nMostrar imagen de pastores Riqui & Anamaria Gell cuando los Pastores García los estén presentando",
          "sound_notes": "2 mics",
          "ushers_notes": "Colocar púlpito y mesita",
          "segment_actions": [
            {
              "label": "Mcs deben estar listos para salir a la tarima",
              "department": "Coordinador",
              "timing": "before_start",
              "offset_min": 2,
              "is_prep": true,
              "is_required": false
            }
          ]
        },
        {
          "title": "PLENARIA #2",
          "segment_type": "Plenaria",
          "order": 3,
          "start_time": "09:40",
          "duration_min": 60,
          "color_code": "default",
          "presenter": "Pastores Riqui & Anamaria Gell",
          "message_title": "\"RESTAURANDO LO QUE ESTÁ ROTO: El Poder del Perdón\"",
          "requires_translation": true,
          "translation_mode": "RemoteBooth",
          "projection_notes": "-Proyectar el nombre y título de la plenaria y conferencistas\n-Proyectar citas bíblicas\n-Material para proyectar",
          "sound_notes": "Riqui & Anamaria Gell (2 mics)",
          "stage_decor_notes": "Púlpito y mesita (no sillas altas)"
        },
        {
          "title": "ALMUERZO",
          "segment_type": "Almuerzo",
          "order": 4,
          "start_time": "11:40",
          "duration_min": 60,
          "color_code": "break",
          "major_break": true
        }
      ]
    },
    {
      "name": "Sábado PM - SESIÓN III",
      "date": "2026-02-07",
      "planned_start_time": "14:15",
      "planned_end_time": "18:00",
      "order": 3,
      "session_color": "orange",
      "is_translated_session": true,
      "default_stage_call_offset_min": 15,
      "location": "Palabras de Vida Bronx",
      "admin_team": "Yassiel Santos",
      "coordinators": "Rita R & Sarai",
      "sound_team": "Kelbin Fabian",
      "lights_team": "Danny M & Hector M",
      "video_team": "Rick P.",
      "tech_team": "Rick & Danny",
      "translation_team": "Ana V. & Jessica",
      "photography_team": "Cristina Rosario",
      "worship_leader": "Anthony Estrella",
      "segments": [
        {
          "title": "SESIONES GRUPALES (I, II & III)",
          "segment_type": "Breakout",
          "order": 1,
          "start_time": "14:15",
          "duration_min": 50,
          "color_code": "default",
          "breakout_rooms": [
            {
              "topic": "\"SANANDO DESDE EL LIDERAZGO\" - Hombres",
              "hosts": "P. Yajardo Garrido",
              "speakers": "PASTORES RAFAEL & MARIA ISABEL PAZ",
              "general_notes": "Coord: RITA RODRÍGUEZ",
              "requires_translation": true,
              "translation_mode": "RemoteBooth",
              "translator_name": "Jeremy Mateo"
            },
            {
              "topic": "\"SANANDO DESDE LA TERNURA\" - Mujeres",
              "hosts": "P. Darling Garrido",
              "speakers": "PASTORES RIQUI & ANAMARIA GELL",
              "general_notes": "COORD.: SARAI MATEO",
              "requires_translation": true,
              "translation_mode": "RemoteBooth",
              "translator_name": "Ana V. Marcelo"
            },
            {
              "topic": "\"SANANDO DESDE EL PRINCIPIO\"",
              "hosts": "Pastores Luis & Scarlet García",
              "speakers": "Pastores Luis & Scarlet García",
              "general_notes": "COORD.: RITA RODRÍGUEZ",
              "requires_translation": true,
              "translation_mode": "InPerson",
              "translator_name": "Pastores García"
            }
          ],
          "segment_actions": [
            {
              "label": "Confirmar Musica de presentadores",
              "department": "Coordinador",
              "timing": "before_start",
              "offset_min": 5,
              "is_prep": true,
              "is_required": false
            },
            {
              "label": "MCs en las sesiones grupales",
              "department": "Coordinador",
              "timing": "before_start",
              "offset_min": 5,
              "is_prep": true,
              "is_required": false,
              "notes": "SANTUARIO: MC P. Darling Garrido/ ÁREA ABIERTA: MC P. Yajardo Garrido"
            }
          ]
        },
        {
          "title": "Importante: TODOS AL SANTUARIO",
          "segment_type": "Especial",
          "order": 2,
          "start_time": "15:05",
          "duration_min": 10,
          "color_code": "special",
          "presenter": "Santuario: P. Darling G | Nivel Infer: P. Yajardo G. | Cuarto 3: P. Luis G."
        },
        {
          "title": "Conversación del Corazón",
          "segment_type": "Dinámica",
          "order": 3,
          "start_time": "15:15",
          "duration_min": 15,
          "color_code": "default",
          "projection_notes": "Proyectar título \"Conversación del Corazón\"",
          "segment_actions": [
            {
              "label": "Pastores Gerónimo deben subir",
              "department": "Coordinador",
              "timing": "before_start",
              "offset_min": 3,
              "is_prep": true,
              "is_required": false,
              "notes": "Presentar plenaria #5"
            }
          ]
        }
      ]
    }
  ]
};

// ─── Section Components ─────────────────────────────────────────────────

function CollapsibleSection({ title, badge, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
          <span className="font-semibold text-sm">{title}</span>
        </div>
        {badge && <Badge variant="outline" className="text-xs">{badge}</Badge>}
      </button>
      {open && <div className="p-4 space-y-3 border-t">{children}</div>}
    </div>
  );
}

function FieldTable({ fields }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-slate-50">
            <th className="text-left p-2 border font-semibold">Campo / Field</th>
            <th className="text-left p-2 border font-semibold">Tipo / Type</th>
            <th className="text-left p-2 border font-semibold">Requerido</th>
            <th className="text-left p-2 border font-semibold">Descripción / Description</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
              <td className="p-2 border font-mono text-xs">{f.name}</td>
              <td className="p-2 border">{f.type}</td>
              <td className="p-2 border">{f.required ? "✅ Sí" : "—"}</td>
              <td className="p-2 border">{f.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EnumBadges({ label, values }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-gray-600">{label}:</p>
      <div className="flex flex-wrap gap-1">
        {values.map(v => (
          <Badge key={v} variant="outline" className="text-xs font-mono">{v}</Badge>
        ))}
      </div>
    </div>
  );
}

function ConditionalLogicBox({ trigger, triggerDesc, requiredFields, bgColor = "bg-blue-50", borderColor = "border-blue-200", textColor = "text-blue-800" }) {
  return (
    <div className={`p-3 rounded-lg border ${bgColor} ${borderColor}`}>
      <p className={`text-xs font-bold ${textColor} mb-1`}>
        SI / IF: <code className="bg-white/60 px-1 rounded">{trigger}</code>
      </p>
      <p className="text-xs text-gray-600 mb-2">{triggerDesc}</p>
      <p className="text-xs font-semibold mb-1">Entonces necesitas / Then you need:</p>
      <ul className="list-disc pl-4 text-xs text-gray-700 space-y-0.5">
        {requiredFields.map((f, i) => <li key={i}><code>{f}</code></li>)}
      </ul>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────

export default function SchemaGuide() {
  const jsonString = JSON.stringify(FULL_JSON_EXAMPLE, null, 2);

  const copyJson = () => {
    navigator.clipboard.writeText(jsonString);
    toast.success("JSON copiado / JSON copied");
  };

  const copyPromptTemplate = () => {
    navigator.clipboard.writeText(AI_PROMPT_TEMPLATE);
    toast.success("Plantilla copiada / Template copied");
  };

  const downloadJson = () => {
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pdv_event_schema_complete.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Descarga iniciada / Download started");
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
        <div className="space-y-2">
          <h1 className="text-4xl uppercase">Guía de Datos</h1>
          <p className="text-gray-500 text-sm max-w-2xl">
            Referencia completa del sistema de datos: Eventos, Sesiones, Segmentos. 
            Incluye todos los campos, valores permitidos, lógica condicional, y la plantilla para el AI Helper.
          </p>
          <p className="text-gray-500 text-sm max-w-2xl">
            Complete data reference: Events, Sessions, Segments. 
            All fields, valid values, conditional logic, and AI Helper prompt template.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={copyPromptTemplate} variant="outline" size="sm" className="gap-2">
            <Sparkles className="w-4 h-4" /> Copy AI Template
          </Button>
          <Button onClick={copyJson} variant="outline" size="sm" className="gap-2">
            <Copy className="w-4 h-4" /> Copy JSON
          </Button>
          <Button onClick={downloadJson} size="sm" className="gap-2" style={{ backgroundColor: '#1F8A70', color: '#fff' }}>
            <Download className="w-4 h-4" /> Download JSON
          </Button>
        </div>
      </div>

      <Tabs defaultValue="reference" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="reference">📋 Referencia</TabsTrigger>
          <TabsTrigger value="ai-prompt">🤖 AI Prompt</TabsTrigger>
          <TabsTrigger value="json">📦 JSON Example</TabsTrigger>
        </TabsList>

        {/* ═══════════ TAB 1: REFERENCE ═══════════ */}
        <TabsContent value="reference" className="space-y-6 mt-6">

          {/* ── Master Enums ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Valores Válidos / Valid Enums (Master Reference)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <EnumBadges
                label="Tipos de Segmento / Segment Types"
                values={["Alabanza","Bienvenida","Ofrenda","Plenaria","Video","Anuncio","Dinámica","Break","TechOnly","Oración","Especial","Cierre","MC","Ministración","Receso","Almuerzo","Artes","Breakout","Panel"]}
              />
              <EnumBadges
                label="Color de Segmento / Segment Color Code"
                values={["worship","preach","break","tech","special","default"]}
              />
              <EnumBadges
                label="Color de Sesión / Session Color"
                values={["green","blue","pink","orange","yellow","purple","red"]}
              />
              <EnumBadges
                label="Color de Impresión (Evento) / Print Color"
                values={["green","blue","pink","orange","yellow","purple","red","teal","charcoal"]}
              />
              <EnumBadges
                label="Estado de Evento / Event Status"
                values={["planning","confirmed","in_progress","completed","archived","template"]}
              />
              <EnumBadges
                label="Estado de Sesión / Session Status (via Event)"
                values={["planning","confirmed","in_progress","completed","archived"]}
              />
              <EnumBadges
                label="Modo de Traducción / Translation Mode"
                values={["InPerson","RemoteBooth"]}
              />
              <EnumBadges
                label="Tipos de Artes / Art Types"
                values={["DANCE","DRAMA","VIDEO","OTHER"]}
              />
            </CardContent>
          </Card>

          {/* ── EVENT ── */}
          <CollapsibleSection title="Evento / Event" badge="Raíz / Root" defaultOpen>
            <FieldTable fields={[
              { name: "name", type: "string", required: true, desc: "Nombre del evento. / Event name." },
              { name: "year", type: "integer", required: true, desc: "Año. / Year (e.g. 2025)." },
              { name: "status", type: "enum", required: true, desc: "planning, confirmed, in_progress, completed, archived, template." },
              { name: "slug", type: "string", required: false, desc: "URL slug (e.g. congreso-2025)." },
              { name: "theme", type: "string", required: false, desc: "Tema/lema público. / Public theme/slogan." },
              { name: "location", type: "string", required: false, desc: "Lugar general. / Venue name." },
              { name: "start_date", type: "date", required: false, desc: "YYYY-MM-DD. Fecha de inicio." },
              { name: "end_date", type: "date", required: false, desc: "YYYY-MM-DD. Fecha de fin." },
              { name: "description", type: "string", required: false, desc: "Descripción general. / General description." },
              { name: "print_color", type: "enum", required: false, desc: "Color para PDFs. green/blue/pink/orange/yellow/purple/red/teal/charcoal." },
            ]} />
            <ConditionalLogicBox
              trigger="promote_in_announcements = true"
              triggerDesc="Promover el evento en anuncios semanales. / Promote in weekly announcements."
              requiredFields={["promotion_start_date", "promotion_end_date", "announcement_blurb", "promotion_targets (array)"]}
            />
            <div className="text-xs text-gray-500 p-2 bg-slate-50 rounded">
              <strong>Campos opcionales de anuncios:</strong> <code>announcement_has_video</code> (boolean)
            </div>
          </CollapsibleSection>

          {/* ── SESSION ── */}
          <CollapsibleSection title="Sesión / Session" badge="Hija de Event" defaultOpen>
            <FieldTable fields={[
              { name: "name", type: "string", required: true, desc: "Nombre visible. / Display name (e.g. 'Sesión 1: Apertura')." },
              { name: "date", type: "date", required: true, desc: "YYYY-MM-DD." },
              { name: "planned_start_time", type: "HH:MM", required: true, desc: "Hora inicio 24h. / Start time 24h format." },
              { name: "planned_end_time", type: "HH:MM", required: false, desc: "Hora fin 24h. / End time 24h format." },
              { name: "order", type: "number", required: false, desc: "Orden dentro del evento. / Sort order." },
              { name: "session_color", type: "enum", required: false, desc: "green/blue/pink/orange/yellow/purple/red." },
              { name: "is_translated_session", type: "boolean", required: false, desc: "¿Requiere traducción general? / General translation flag." },
              { name: "default_stage_call_offset_min", type: "number", required: false, desc: "Default minutos antes para llamada. / Default stage call minutes (default: 15)." },
              { name: "location", type: "string", required: false, desc: "Lugar específico si difiere del evento." },
              { name: "notes", type: "string", required: false, desc: "Notas generales de sesión." },
              { name: "presenter", type: "string", required: false, desc: "Presentador principal de toda la sesión (opcional)." },
            ]} />
            <p className="text-xs font-semibold mt-2 mb-1">Equipos / Team Assignments (todos string, texto libre):</p>
            <div className="flex flex-wrap gap-1">
              {["admin_team","coordinators","sound_team","lights_team","video_team","tech_team","ushers_team","translation_team","hospitality_team","photography_team","worship_leader"].map(f =>
                <Badge key={f} variant="outline" className="text-xs font-mono">{f}</Badge>
              )}
            </div>
          </CollapsibleSection>

          {/* ── SEGMENT UNIVERSAL ── */}
          <CollapsibleSection title="Segmento: Campos Universales / Segment: Universal Fields" badge="Todos los tipos" defaultOpen>
            <FieldTable fields={[
              { name: "title", type: "string", required: true, desc: "Título del segmento. / Segment title." },
              { name: "segment_type", type: "enum", required: true, desc: "Ver lista de tipos arriba. / See segment types above." },
              { name: "order", type: "number", required: false, desc: "Orden dentro de la sesión. / Sort order in session." },
              { name: "start_time", type: "HH:MM", required: false, desc: "Hora de inicio 24h." },
              { name: "duration_min", type: "number", required: false, desc: "Duración en minutos." },
              { name: "presenter", type: "string", required: false, desc: "Persona a cargo de este momento." },
              { name: "color_code", type: "enum", required: false, desc: "worship/preach/break/tech/special/default." },
              { name: "stage_call_offset_min", type: "number", required: false, desc: "Minutos antes para llegada del equipo." },
              { name: "description_details", type: "string", required: false, desc: "Descripción detallada." },
              { name: "prep_instructions", type: "string", required: false, desc: "Instrucciones de preparación." },
              { name: "microphone_assignments", type: "string", required: false, desc: "Asignación de micrófonos." },
              { name: "other_notes", type: "string", required: false, desc: "Notas adicionales." },
            ]} />
            <p className="text-xs font-semibold mt-3 mb-1">Notas por Departamento / Department Notes:</p>
            <div className="flex flex-wrap gap-1">
              {["projection_notes","sound_notes","ushers_notes","translation_notes","stage_decor_notes"].map(f =>
                <Badge key={f} variant="outline" className="text-xs font-mono">{f}</Badge>
              )}
            </div>
            <p className="text-xs font-semibold mt-3 mb-1">Visibilidad / Visibility Flags (boolean, default: true):</p>
            <div className="flex flex-wrap gap-1">
              {["show_in_general","show_in_projection","show_in_sound","show_in_ushers"].map(f =>
                <Badge key={f} variant="outline" className="text-xs font-mono">{f}</Badge>
              )}
            </div>

            <div className="mt-4 space-y-3">
              <ConditionalLogicBox
                trigger="requires_translation = true"
                triggerDesc="Segmento requiere traducción. / Segment needs translation."
                requiredFields={["translation_mode (InPerson | RemoteBooth)", "translator_name"]}
              />
              <ConditionalLogicBox
                trigger="has_video = true"
                triggerDesc="Segmento incluye video (cualquier tipo). / Segment includes video (any type)."
                requiredFields={["video_name", "video_location", "video_length_sec"]}
                bgColor="bg-purple-50" borderColor="border-purple-200" textColor="text-purple-800"
              />
            </div>
            <div className="text-xs text-gray-500 p-2 bg-slate-50 rounded mt-3">
              <strong>Campos opcionales de video:</strong> <code>video_owner</code>, <code>video_url</code>
            </div>
          </CollapsibleSection>

          {/* ── SEGMENT TYPES ── */}
          <CollapsibleSection title="Alabanza / Worship" badge="Tipo de Segmento">
            <p className="text-xs text-gray-600 mb-2">Bloques de adoración musical. Soporta hasta 6 canciones. / Musical worship sets. Supports up to 6 songs.</p>
            <FieldTable fields={[
              { name: "number_of_songs", type: "number (1-6)", required: true, desc: "Cantidad de canciones en el set." },
              { name: "song_N_title", type: "string", required: false, desc: "Título de canción N (N=1 a 6)." },
              { name: "song_N_lead", type: "string", required: false, desc: "Vocalista principal de canción N." },
              { name: "song_N_key", type: "string", required: false, desc: "Clave musical de canción N (e.g. G, Am, Bb)." },
              { name: "music_profile_id", type: "ref", required: false, desc: "Referencia a perfil de música ambiental." },
            ]} />
            <div className="p-2 bg-amber-50 rounded border border-amber-200 mt-2 text-xs">
              <strong>Ejemplo:</strong> <code>song_1_title: "Gracia Sublime"</code>, <code>song_1_lead: "Marcos"</code>, <code>song_1_key: "G"</code>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Plenaria / Preaching" badge="Tipo de Segmento">
            <p className="text-xs text-gray-600 mb-2">Mensaje principal o enseñanza. / Main message or teaching.</p>
            <FieldTable fields={[
              { name: "message_title", type: "string", required: true, desc: "Título del mensaje. / Sermon title." },
              { name: "presenter", type: "string", required: false, desc: "Nombre del predicador." },
              { name: "scripture_references", type: "string", required: false, desc: "Citas bíblicas (e.g. 'Juan 3:16; Isaías 54:2')." },
              { name: "presentation_url", type: "string (URL)", required: false, desc: "Link a slides/presentación." },
              { name: "notes_url", type: "string (URL)", required: false, desc: "Link a notas del orador (PDF/Doc) para equipo de media." },
              { name: "content_is_slides_only", type: "boolean", required: false, desc: "Si true, las slides reemplazan los versículos." },
            ]} />
          </CollapsibleSection>

          <CollapsibleSection title="Panel" badge="Tipo de Segmento">
            <p className="text-xs text-gray-600 mb-2">Conversación moderada con panelistas. / Moderated panel discussion.</p>
            <FieldTable fields={[
              { name: "panel_moderators", type: "string", required: true, desc: "Nombre(s) del moderador." },
              { name: "panel_panelists", type: "string", required: false, desc: "Nombre(s) de los panelistas, separados por coma." },
            ]} />
          </CollapsibleSection>

          <CollapsibleSection title="Artes / Arts (Drama, Danza)" badge="Tipo de Segmento">
            <p className="text-xs text-gray-600 mb-2">Producciones especiales con drama, danza, video u otros. Cada tipo tiene sus propios campos. / Special productions. Each art type has its own fields.</p>
            <FieldTable fields={[
              { name: "art_types", type: "array of enum", required: true, desc: "['DANCE','DRAMA','VIDEO','OTHER']. Puede combinar múltiples." },
              { name: "art_other_description", type: "string", required: false, desc: "Descripción si art_types incluye OTHER." },
              { name: "arts_run_of_show_url", type: "string (URL)", required: false, desc: "Link al PDF de run of show de artes." },
            ]} />
            <p className="text-xs font-semibold mt-3 mb-1">Campos de Drama:</p>
            <FieldTable fields={[
              { name: "drama_handheld_mics", type: "number", required: false, desc: "Micrófonos de mano para drama." },
              { name: "drama_headset_mics", type: "number", required: false, desc: "Micrófonos de diadema para drama." },
              { name: "drama_start_cue", type: "string", required: false, desc: "Señal de inicio del drama." },
              { name: "drama_end_cue", type: "string", required: false, desc: "Señal de fin del drama." },
              { name: "drama_has_song", type: "boolean", required: false, desc: "¿Drama incluye canción?" },
              { name: "drama_song_title", type: "string", required: false, desc: "Canción 1 del drama." },
              { name: "drama_song_source", type: "string (URL)", required: false, desc: "Link a canción 1." },
              { name: "drama_song_owner", type: "string", required: false, desc: "Dueño de canción 1." },
              { name: "drama_song_2_title / _2_url / _2_owner", type: "string", required: false, desc: "Canción 2 del drama (misma estructura)." },
              { name: "drama_song_3_title / _3_url / _3_owner", type: "string", required: false, desc: "Canción 3 del drama." },
            ]} />
            <p className="text-xs font-semibold mt-3 mb-1">Campos de Danza / Dance Fields:</p>
            <FieldTable fields={[
              { name: "dance_handheld_mics", type: "number", required: false, desc: "Micrófonos de mano para danza." },
              { name: "dance_headset_mics", type: "number", required: false, desc: "Micrófonos de diadema para danza." },
              { name: "dance_start_cue", type: "string", required: false, desc: "Señal de inicio de danza." },
              { name: "dance_end_cue", type: "string", required: false, desc: "Señal de fin de danza." },
              { name: "dance_has_song", type: "boolean", required: false, desc: "¿Danza incluye canción?" },
              { name: "dance_song_title", type: "string", required: false, desc: "Canción 1 de danza." },
              { name: "dance_song_source", type: "string (URL)", required: false, desc: "Link a canción 1 de danza." },
              { name: "dance_song_owner", type: "string", required: false, desc: "Dueño de canción 1." },
              { name: "dance_song_2_title / _2_url / _2_owner", type: "string", required: false, desc: "Canción 2 de danza." },
              { name: "dance_song_3_title / _3_url / _3_owner", type: "string", required: false, desc: "Canción 3 de danza." },
            ]} />
          </CollapsibleSection>

          <CollapsibleSection title="Video" badge="Tipo de Segmento">
            <p className="text-xs text-gray-600 mb-2">Segmento dedicado a video. / Dedicated video segment. Nota: <code>has_video</code> también se puede usar en cualquier otro tipo.</p>
            <FieldTable fields={[
              { name: "video_name", type: "string", required: true, desc: "Nombre del archivo." },
              { name: "video_location", type: "string", required: false, desc: "Ruta o ubicación del archivo (flash drive, carpeta)." },
              { name: "video_owner", type: "string", required: false, desc: "Dueño o fuente del video." },
              { name: "video_length_sec", type: "number", required: false, desc: "Duración en segundos." },
              { name: "video_url", type: "string (URL)", required: false, desc: "Link directo al video." },
            ]} />
          </CollapsibleSection>

          <CollapsibleSection title="Anuncio / Announcement" badge="Tipo de Segmento">
            <FieldTable fields={[
              { name: "announcement_title", type: "string", required: true, desc: "Título del anuncio." },
              { name: "announcement_description", type: "string", required: false, desc: "Guión o puntos clave." },
              { name: "announcement_date", type: "date", required: false, desc: "Fecha relevante del anuncio (YYYY-MM-DD)." },
              { name: "announcement_tone", type: "string", required: false, desc: "Tono sugerido (Energetic, Serious, Informative, etc.)." },
              { name: "announcement_series_id", type: "ref", required: false, desc: "Referencia a serie de anuncios." },
            ]} />
          </CollapsibleSection>

          <CollapsibleSection title="Breakout (Talleres / Workshops)" badge="Tipo de Segmento">
            <p className="text-xs text-gray-600 mb-2">Sesiones simultáneas en múltiples salas. / Simultaneous sessions in multiple rooms.</p>
            <FieldTable fields={[
              { name: "breakout_rooms", type: "array of objects", required: true, desc: "Lista de salas con su configuración." },
            ]} />
            <p className="text-xs font-semibold mt-2 mb-1">Campos por sala / Per-room fields:</p>
            <FieldTable fields={[
              { name: "room_id", type: "ref", required: false, desc: "Referencia a Room." },
              { name: "topic", type: "string", required: false, desc: "Tema o título del taller." },
              { name: "hosts", type: "string", required: false, desc: "Anfitrión(es) / moderador(es)." },
              { name: "speakers", type: "string", required: false, desc: "Orador(es) / panelistas." },
              { name: "general_notes", type: "string", required: false, desc: "Notas generales de producción." },
              { name: "other_notes", type: "string", required: false, desc: "Instrucciones específicas." },
              { name: "requires_translation", type: "boolean", required: false, desc: "¿Esta sala requiere traducción?" },
              { name: "translation_mode", type: "enum", required: false, desc: "InPerson / RemoteBooth." },
              { name: "translator_name", type: "string", required: false, desc: "Traductor para esta sala." },
            ]} />
          </CollapsibleSection>

          <CollapsibleSection title="Break / Receso / Almuerzo" badge="Tipo de Segmento">
            <FieldTable fields={[
              { name: "major_break", type: "boolean", required: false, desc: "true = descanso mayor (almuerzo, cena). false = receso corto." },
            ]} />
          </CollapsibleSection>

          <CollapsibleSection title="Otros Tipos / Other Types" badge="Bienvenida, Ofrenda, MC, Oración, Cierre, Especial, Dinámica, TechOnly, Ministración">
            <p className="text-xs text-gray-600">
              Estos tipos solo usan los campos universales (title, presenter, duration_min, start_time, color_code, notas, translation, visibility flags). 
              No tienen campos adicionales específicos.
            </p>
            <p className="text-xs text-gray-600 mt-1">
              These types only use universal fields. No additional type-specific fields.
            </p>
          </CollapsibleSection>

          {/* Drift Warning */}
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="pt-4">
              <div className="flex gap-3 items-start">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 space-y-1">
                  <p className="font-bold">⚠ Advertencia de Sincronización / Sync Warning</p>
                  <p>
                    Esta guía es la fuente de verdad para la estructura de datos del sistema. 
                    Cualquier cambio a entidades (Event, Session, Segment), enums, o lógica condicional 
                    <strong> debe reflejarse aquí inmediatamente</strong>.
                  </p>
                  <p>
                    This guide is the source of truth for the system's data structure. 
                    Any changes to entities, enums, or conditional logic 
                    <strong> must be reflected here immediately</strong>.
                  </p>
                  <p className="font-mono bg-amber-100 p-1 rounded">Decision Log: GUIA-SYNC-001</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════ TAB 2: AI PROMPT ═══════════ */}
        <TabsContent value="ai-prompt" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="w-5 h-5" style={{ color: '#1F8A70' }} />
                Plantilla de Prompt para AI Helper / AI Helper Prompt Template
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Use esta plantilla para generar prompts detallados para el AI Helper del evento.
                Copie la plantilla, llene las variables entre <code>[corchetes]</code>, y péguela en el AI Helper.
              </p>
              <p className="text-sm text-gray-600">
                Use this template to generate detailed prompts for the Event AI Helper. 
                Copy the template, fill in the variables in <code>[brackets]</code>, and paste into the AI Helper.
              </p>

              <div className="space-y-3">
                <h3 className="text-sm font-bold">Consejos para Máxima Confiabilidad / Tips for Maximum Reliability:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { es: "Use los nombres exactos de tipo de segmento de la lista de enums", en: "Use exact segment type names from the enum list" },
                    { es: "Un bloque SESSION por sesión — los segmentos indentados se asocian automáticamente", en: "One SESSION block per session — indented segments associate automatically" },
                    { es: "Nombre personas consistentemente (siempre 'Pastor Juan', no 'Juan' luego 'Pr. Juan')", en: "Name people consistently ('Pastor Juan' everywhere, not mixed)" },
                    { es: "Horarios en formato 24h: 19:00 no 7pm", en: "Times in 24h format: 19:00 not 7pm" },
                    { es: "Para actualizaciones, diga 'Update Session [nombre exacto]'", en: "For updates, say 'Update Session [exact name]'" },
                    { es: "3-4 sesiones con ~8 segmentos cada una es lo ideal por prompt", en: "3-4 sessions with ~8 segments each is ideal per prompt" },
                  ].map((tip, i) => (
                    <div key={i} className="p-2 bg-slate-50 rounded border text-xs">
                      <p className="text-gray-700">🇪🇸 {tip.es}</p>
                      <p className="text-gray-500 mt-0.5">🇺🇸 {tip.en}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={copyPromptTemplate} variant="outline" size="sm" className="gap-2">
                  <Copy className="w-4 h-4" /> Copiar Plantilla / Copy Template
                </Button>
              </div>

              <ScrollArea className="h-[500px] w-full rounded-md border bg-gray-900 p-4">
                <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap leading-relaxed">
                  {AI_PROMPT_TEMPLATE}
                </pre>
              </ScrollArea>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
                <h4 className="text-sm font-bold text-blue-800">Variables Quick Reference / Referencia Rápida de Variables</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-blue-700">
                  <div><code>[Event Name]</code> — Nombre del evento</div>
                  <div><code>[Date]</code> — Formato YYYY-MM-DD</div>
                  <div><code>[Start Time]–[End Time]</code> — 24h HH:MM</div>
                  <div><code>[Room Name]</code> — Nombre de sala existente</div>
                  <div><code>[Session Name]</code> — Nombre visible de sesión</div>
                  <div><code>[SegmentType]</code> — De la lista de enums exactos</div>
                  <div><code>[Duration]min</code> — Número entero en minutos</div>
                  <div><code>[Name]</code> — Nombre completo consistente</div>
                  <div><code>[Yes/No]</code> — Valor booleano</div>
                  <div><code>[X]</code> — Clave musical (G, Am, Bb, etc.)</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════ TAB 3: JSON ═══════════ */}
        <TabsContent value="json" className="space-y-6 mt-6">
          <Card className="shadow-md" style={{ borderColor: 'rgba(31, 138, 112, 0.2)' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileJson className="w-5 h-5" style={{ color: '#1F8A70' }} />
                Ejemplo JSON Completo / Complete JSON Example
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-4">
                Este ejemplo incluye un evento completo con 2 sesiones y segmentos de todos los tipos principales:
                Alabanza (3 canciones con claves), Bienvenida con traducción InPerson, Plenaria con slides y notas,
                Artes (Drama+Danza con canciones y cues), Break, Panel, Video, Anuncio con tono, Cierre, Breakout con traducción por sala, y Almuerzo.
              </p>
              <div className="flex gap-2 mb-4">
                <Button onClick={copyJson} variant="outline" size="sm" className="gap-2">
                  <Copy className="w-4 h-4" /> Copy JSON
                </Button>
                <Button onClick={downloadJson} variant="outline" size="sm" className="gap-2">
                  <Download className="w-4 h-4" /> Download JSON
                </Button>
              </div>
              <ScrollArea className="h-[600px] w-full rounded-md border bg-gray-900 p-4">
                <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap leading-relaxed">
                  {jsonString}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
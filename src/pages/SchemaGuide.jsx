import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function SchemaGuide() {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold font-['Bebas_Neue'] uppercase">Data Injection Guide</h1>
        <p className="text-gray-500">Reference for developers and AI agents on how to structure Event data.</p>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>1. Event Entity (Root)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                    <h3 className="font-bold mb-2">Mandatory Fields</h3>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                        <li><code>name</code> (string)</li>
                        <li><code>year</code> (number, YYYY)</li>
                        <li><code>status</code> (enum: planning, confirmed, etc.)</li>
                    </ul>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                    <h3 className="font-bold mb-2">Conditional: Announcements</h3>
                    <p className="text-sm mb-2">If <code>promote_in_announcements: true</code>:</p>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                        <li><code>promotion_start_date</code> (YYYY-MM-DD)</li>
                        <li><code>promotion_end_date</code> (YYYY-MM-DD)</li>
                        <li><code>announcement_blurb</code> (string)</li>
                        <li><code>promotion_targets</code> (array of strings)</li>
                    </ul>
                </div>
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle>2. Segment Entity (Logic)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid gap-4">
                <div className="border p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold">Type: Alabanza (Worship)</h3>
                        <Badge>Complex</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">Requires song details.</p>
                    <code className="block bg-gray-900 text-white p-3 rounded text-xs overflow-x-auto">
                        {`{
  "segment_type": "Alabanza",
  "number_of_songs": 2,
  "music_profile_id": "uuid",
  "song_1_title": "Song A",
  "song_1_lead": "Leader A",
  "song_2_title": "Song B",
  "song_2_lead": "Leader B"
}`}
                    </code>
                </div>

                <div className="border p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold">Type: Plenaria (Preaching)</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">Focuses on speaker and content.</p>
                    <code className="block bg-gray-900 text-white p-3 rounded text-xs overflow-x-auto">
                        {`{
  "segment_type": "Plenaria",
  "presenter": "Dr. Smith",
  "message_title": "The Vision",
  "scripture_references": "John 3:16",
  "requires_translation": true
}`}
                    </code>
                </div>

                <div className="border p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold">Type: Breakout (Talleres)</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">Contains nested room configurations.</p>
                    <code className="block bg-gray-900 text-white p-3 rounded text-xs overflow-x-auto">
                        {`{
  "segment_type": "Breakout",
  "breakout_rooms": [
    { "room_id": "uuid", "topic": "Leadership", "hosts": "Alice" },
    { "room_id": "uuid", "topic": "Finance", "speakers": "Bob" }
  ]
}`}
                    </code>
                </div>
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle>3. Full JSON Payload Example</CardTitle>
        </CardHeader>
        <CardContent>
            <ScrollArea className="h-[500px] w-full rounded-md border bg-gray-900 p-4">
                <pre className="text-xs text-green-400 font-mono">
{`{
  "event": {
    "name": "Conferencia Global: Visión 2025",
    "origin": "manual",
    "field_origins": { "name": "manual", "theme": "manual" },
    "theme": "Expandiendo Horizontes",
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
          "order": 1,
          "segment_type": "Bienvenida",
          "title": "Bienvenida",
          "presenter": "Pastor Local",
          "start_time": "19:00",
          "duration_min": 10,
          "requires_translation": true,
          "translation_mode": "BoothHeadphones",
          "translator_name": "Sarah J."
        },
        {
          "order": 2,
          "segment_type": "Alabanza",
          "title": "Adoración",
          "start_time": "19:10",
          "duration_min": 30,
          "color_code": "worship",
          "number_of_songs": 2,
          "song_1_title": "Gracia Sublime",
          "song_1_lead": "Marcos",
          "song_2_title": "En Tu Luz",
          "song_2_lead": "Elena"
        },
        {
          "order": 3,
          "segment_type": "Plenaria",
          "title": "Mensaje: La Visión",
          "presenter": "Dr. Juan Pérez",
          "message_title": "Expandiendo el Reino",
          "scripture_references": "Habacuc 2:2-3",
          "start_time": "19:40",
          "duration_min": 45,
          "color_code": "preach"
        },
        {
          "order": 4,
          "segment_type": "Video",
          "title": "Video Testimonio",
          "start_time": "20:25",
          "duration_min": 5,
          "has_video": true,
          "video_name": "Testimonio.mp4",
          "video_location": "/assets/videos/"
        },
        {
          "order": 5,
          "segment_type": "Breakout",
          "title": "Talleres",
          "start_time": "20:30",
          "duration_min": 30,
          "color_code": "break",
          "breakout_rooms": [
            {
              "room_id": "room_123",
              "topic": "Liderazgo",
              "hosts": "Pedro"
            }
          ]
        }
      ]
    }
  ]
}`}
                </pre>
            </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
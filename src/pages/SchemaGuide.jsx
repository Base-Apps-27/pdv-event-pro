import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Download, FileJson } from "lucide-react";
import { toast } from "sonner";

export default function SchemaGuide() {
  const fullSchemaExample = {
    "event": {
      "name": "Event Name",
      "origin": "manual",
      "field_origins": {},
      "theme": "Event Theme",
      "year": 2025,
      "location": "Event Location",
      "start_date": "2025-01-01",
      "end_date": "2025-01-03",
      "description": "Event Description",
      "status": "planning",
      "print_color": "blue",
      "promote_in_announcements": true,
      "promotion_start_date": "2024-12-01",
      "promotion_end_date": "2025-01-01",
      "announcement_blurb": "Short blurb",
      "promotion_targets": ["Target 1", "Target 2"]
    },
    "sessions": [
      {
        "name": "Session Name",
        "date": "2025-01-01",
        "origin": "manual",
        "field_origins": {},
        "event_id": "uuid (optional if nested)",
        "service_id": "uuid (optional)",
        "event_day_id": "uuid (optional)",
        "room_id": "uuid (optional)",
        "planned_start_time": "09:00",
        "planned_end_time": "10:30",
        "default_stage_call_offset_min": 15,
        "location": "Session Location",
        "notes": "Session Notes",
        "order": 1,
        "presenter": "Session Presenter",
        "admin_team": "Admin Team Info",
        "coordinators": "Coordinators Info",
        "sound_team": "Sound Team Info",
        "tech_team": "Tech Team Info",
        "ushers_team": "Ushers Team Info",
        "translation_team": "Translation Team Info",
        "hospitality_team": "Hospitality Team Info",
        "photography_team": "Photo Team Info",
        "worship_leader": "Worship Leader Name",
        "session_color": "blue",
        "is_translated_session": true,
        "segments": [
          {
            "title": "Complete Segment Example (All Fields)",
            "segment_type": "Plenaria",
            "origin": "manual",
            "field_origins": {},
            "session_id": "uuid (optional if nested)",
            "service_id": "uuid (optional)",
            "order": 1,
            "presenter": "Segment Presenter",
            "description_details": "Detailed description",
            "prep_instructions": "Prep instructions",
            "start_time": "09:00",
            "duration_min": 15,
            "end_time": "09:15",
            "stage_call_offset_min": 10,
            "stage_call_time": "08:50",
            "projection_notes": "Projection notes",
            "sound_notes": "Sound notes",
            "ushers_notes": "Ushers notes",
            "translation_notes": "Translation notes",
            "stage_decor_notes": "Stage decor notes",
            "microphone_assignments": "Mic assignments",
            "other_notes": "Other notes",
            "show_in_general": true,
            "show_in_projection": true,
            "show_in_sound": true,
            "show_in_ushers": true,
            "color_code": "default",
            "message_title": "Message Title",
            "scripture_references": "Scripture Refs",
            "number_of_songs": 0,
            "song_1_title": "",
            "song_1_lead": "",
            "song_2_title": "",
            "song_2_lead": "",
            "song_3_title": "",
            "song_3_lead": "",
            "song_4_title": "",
            "song_4_lead": "",
            "song_5_title": "",
            "song_5_lead": "",
            "song_6_title": "",
            "song_6_lead": "",
            "slide_pack_id": "uuid",
            "countdown_asset_id": "uuid",
            "music_profile_id": "uuid",
            "requires_translation": false,
            "translation_mode": "InPerson",
            "translator_name": "",
            "major_break": false,
            "breakout_rooms": [
              {
                "room_id": "uuid",
                "hosts": "Hosts",
                "speakers": "Speakers",
                "topic": "Topic",
                "general_notes": "Notes",
                "other_notes": "Other Notes",
                "requires_translation": false,
                "translation_mode": "InPerson",
                "translator_name": ""
              }
            ],
            "room_id": "uuid",
            "has_video": false,
            "video_name": "",
            "video_location": "",
            "video_owner": "",
            "video_length_sec": 0,
            "art_types": [],
            "drama_handheld_mics": 0,
            "drama_headset_mics": 0,
            "drama_start_cue": "",
            "drama_end_cue": "",
            "drama_has_song": false,
            "drama_song_title": "",
            "drama_song_source": "",
            "drama_song_owner": "",
            "dance_has_song": false,
            "dance_song_title": "",
            "dance_song_source": "",
            "dance_song_owner": "",
            "dance_handheld_mics": 0,
            "dance_headset_mics": 0,
            "dance_start_cue": "",
            "dance_end_cue": "",
            "art_other_description": "",
            "announcement_title": "",
            "announcement_description": "",
            "announcement_date": "",
            "announcement_tone": "",
            "announcement_series_id": "uuid"
          }
        ]
      }
    ]
  };

  const jsonString = JSON.stringify(fullSchemaExample, null, 2);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(jsonString);
    toast.success("JSON Schema copied to clipboard");
  };

  const downloadJson = () => {
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "complete_event_schema.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Download started");
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold font-['Bebas_Neue'] uppercase">Data Injection Guide</h1>
          <p className="text-gray-500">Comprehensive reference for Event, Session, and Segment data structures.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={copyToClipboard} variant="outline" className="gap-2">
            <Copy className="w-4 h-4" />
            Copy JSON
          </Button>
          <Button onClick={downloadJson} className="gap-2 bg-pdv-teal hover:bg-pdv-teal/90 text-white">
            <Download className="w-4 h-4" />
            Download Schema
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileJson className="w-5 h-5 text-pdv-teal" />
              Complete Schema Reference (All Fields)
            </CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-sm text-gray-500 mb-4">
              This JSON object contains every possible field defined in the database schema for Events, Sessions, and Segments. 
              Use this as a master template for AI agents or manual data injection.
            </p>
            <ScrollArea className="h-[600px] w-full rounded-md border bg-gray-900 p-4">
                <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                  {jsonString}
                </pre>
            </ScrollArea>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
              <CardTitle>Entity Hierarchy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <h3 className="font-bold text-lg mb-1">1. Event</h3>
                  <p className="text-sm text-gray-600">Root container. Includes high-level details like name, dates, and promotion settings.</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 ml-6 relative before:absolute before:left-[-24px] before:top-[24px] before:w-[24px] before:h-[2px] before:bg-slate-300 before:content-['']">
                  <h3 className="font-bold text-lg mb-1">2. Session</h3>
                  <p className="text-sm text-gray-600">Time blocks within an event. Contains team assignments and specific schedules.</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 ml-12 relative before:absolute before:left-[-24px] before:top-[24px] before:w-[24px] before:h-[2px] before:bg-slate-300 before:content-['']">
                  <h3 className="font-bold text-lg mb-1">3. Segment</h3>
                  <p className="text-sm text-gray-600">Granular items (songs, preaching, videos). Contains the most logic and conditional fields.</p>
              </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
              <CardTitle>Key Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3 text-sm text-gray-600">
              <li className="flex gap-2">
                <Badge variant="outline">IDs</Badge>
                <span>When creating new nested structures, IDs are optional/auto-generated. When referencing existing entities, IDs are required.</span>
              </li>
              <li className="flex gap-2">
                <Badge variant="outline">Enums</Badge>
                <span>Fields like <code>segment_type</code>, <code>status</code>, and <code>color_code</code> accept specific string values only.</span>
              </li>
              <li className="flex gap-2">
                <Badge variant="outline">Dates</Badge>
                <span>Use <code>YYYY-MM-DD</code> for dates and <code>HH:MM</code> (24h) for times.</span>
              </li>
              <li className="flex gap-2">
                <Badge variant="outline">Logic</Badge>
                <span>Example: Setting <code>requires_translation: true</code> implies you should also provide <code>translation_mode</code> and <code>translator_name</code>.</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
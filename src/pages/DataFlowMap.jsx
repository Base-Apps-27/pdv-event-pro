import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, ArrowRight, Database, Eye, FileText, Save, Zap, AlertTriangle } from "lucide-react";

export default function DataFlowMap() {
  const [activeLayer, setActiveLayer] = useState("all");

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg border-2 border-gray-300 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 uppercase tracking-tight">
                Data Flow Architecture Map
              </h1>
              <p className="text-gray-600 mt-2">
                Visual reference: Editor → Entities → Displays (Live documentation)
              </p>
            </div>
            <Badge className="bg-red-500 text-white text-sm">
              PRODUCTION INCIDENT
            </Badge>
          </div>
        </div>

        {/* Architecture Status */}
        <Card className="border-2 border-green-500 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <Zap className="w-5 h-5" />
              ✅ Entity Separation Complete (Commit 94547bd)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-green-900 font-semibold">
              Granular per-field mutations replaced monolithic blob save pipeline
            </p>
            <div className="bg-white rounded p-3 text-sm font-mono">
              <p className="text-green-600">T+0.0s: User types → setServiceData (instant UI) ✓</p>
              <p className="text-blue-600">T+0.0s: mutateSegmentField(entityId, field, value)</p>
              <p className="text-purple-600">T+0.3s: Segment.update() fires (300ms debounce)</p>
              <p className="text-orange-600">T+0.4s: Entity automation → refreshActiveProgram</p>
              <p className="text-green-600">T+0.5s: Cache updated → displays refresh ✓</p>
            </div>
            <div className="space-y-2 mt-3">
              <Badge variant="outline" className="bg-green-100 border-green-300 text-green-700">
                components/service/weekly/useSegmentMutation.jsx
              </Badge>
              <Badge variant="outline" className="bg-blue-100 border-blue-300 text-blue-700">
                No blob save | No race window | Atomic writes
              </Badge>
              <Badge variant="outline" className="bg-purple-100 border-purple-300 text-purple-700">
                Service.subscribe = metadata only (line 648)
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Layer Tabs */}
        <Tabs value={activeLayer} onValueChange={setActiveLayer} className="space-y-4">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="all">Complete Flow</TabsTrigger>
            <TabsTrigger value="editor">Layer 1: Editor</TabsTrigger>
            <TabsTrigger value="backend">Layer 2: Backend</TabsTrigger>
            <TabsTrigger value="displays">Layer 3: Displays</TabsTrigger>
          </TabsList>

          {/* Complete Flow */}
          <TabsContent value="all" className="space-y-4">
            <FlowOverview />
          </TabsContent>

          {/* Layer 1: Editor */}
          <TabsContent value="editor" className="space-y-4">
            <EditorLayer />
          </TabsContent>

          {/* Layer 2: Backend */}
          <TabsContent value="backend" className="space-y-4">
            <BackendLayer />
          </TabsContent>

          {/* Layer 3: Displays */}
          <TabsContent value="displays" className="space-y-4">
            <DisplaysLayer />
          </TabsContent>
        </Tabs>

        {/* Field Mapping Reference */}
        <Card className="border-2 border-blue-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-500" />
              Field Mapping Reference
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FieldMappingTable />
          </CardContent>
        </Card>

        {/* Known Issues */}
        <Card className="border-2 border-orange-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              Known Issues & Fixes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <KnownIssues />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FlowOverview() {
  return (
    <div className="space-y-4">
      <Card className="border-2 border-green-500">
        <CardHeader className="bg-green-50">
          <CardTitle className="flex items-center gap-2">
            <Save className="w-5 h-5 text-green-600" />
            Layer 1: Editor → Entities (Per-Field Atomic)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <Badge className="bg-green-600">Input Component</Badge>
              <ArrowRight className="w-4 h-4 text-gray-400" />
              <Badge variant="outline">updateSegmentField()</Badge>
              <ArrowRight className="w-4 h-4 text-gray-400" />
              <Badge className="bg-purple-600">useSegmentMutation</Badge>
              <ArrowRight className="w-4 h-4 text-gray-400" />
              <Badge className="bg-blue-600">Segment.update()</Badge>
            </div>
            <p className="text-gray-700">
              Each input triggers TWO actions: (1) <code className="bg-gray-100 px-1 rounded">setServiceData</code> instant UI update, 
              (2) <code className="bg-gray-100 px-1 rounded">mutateSegmentField</code> 300ms debounced entity write.
            </p>
            <div className="bg-gray-50 p-3 rounded text-xs font-mono space-y-1">
              <p className="text-green-600">// WeeklyServiceInputs.jsx:72-82</p>
              <p>onChange = (e) ={'>'} {'{'}</p>
              <p className="ml-4">updateSegmentField(slot, idx, field, value)  // instant</p>
              <p className="ml-4">mutateSegmentField(entityId, field, value)   // 300ms</p>
              <p>{'}'}</p>
              <p className="text-blue-600 mt-2">// useSegmentMutation.jsx:129-138</p>
              <p>scheduleWrite(`seg:${'{'}{entityId}{'}'}:${'{'}{field}{'}'}`, () ={'>'}</p>
              <p className="ml-4">Segment.update(entityId, {'{'} [column]: value {'}'})</p>
              <p>)</p>
            </div>
            <Badge className="bg-green-100 border-green-300 text-green-700 mt-2">
              ✓ No bulk delete/recreate | No race window | Atomic per field
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <ArrowRight className="w-8 h-8 text-gray-400" />
      </div>

      <Card className="border-2 border-blue-500">
        <CardHeader className="bg-blue-50">
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-600" />
            Layer 2: Entities → Cache
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <Badge className="bg-blue-600">Entity Automations</Badge>
              <ArrowRight className="w-4 h-4 text-gray-400" />
              <Badge className="bg-purple-600">refreshActiveProgram</Badge>
              <ArrowRight className="w-4 h-4 text-gray-400" />
              <Badge variant="outline">ActiveProgramCache</Badge>
            </div>
            <p className="text-gray-700">
              Service/Session create/update triggers <code className="bg-gray-100 px-1 rounded">refreshActiveProgram</code> function.
              Reads entities, normalizes, writes to cache for fast display access.
            </p>
            <div className="bg-yellow-50 border border-yellow-300 p-3 rounded text-xs">
              ⚠️ Fan-out storm: Each save = ~4 refreshActiveProgram calls (1 Service + 2 Sessions + automations)
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <ArrowRight className="w-8 h-8 text-gray-400" />
      </div>

      <Card className="border-2 border-purple-500">
        <CardHeader className="bg-purple-50">
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-purple-600" />
            Layer 3: Cache → Displays
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="bg-white border-2 border-gray-300 rounded p-3">
              <h4 className="font-semibold mb-2">TV Display</h4>
              <Badge className="bg-green-500 text-white text-xs mb-2">✓ Normalized</Badge>
              <p className="text-xs text-gray-600">
                Uses normalizeProgram.js<br/>
                Coordinator actions with timing enum
              </p>
            </div>
            <div className="bg-white border-2 border-gray-300 rounded p-3">
              <h4 className="font-semibold mb-2">Live View</h4>
              <Badge className="bg-red-500 text-white text-xs mb-2">❌ Raw Data</Badge>
              <p className="text-xs text-gray-600">
                Direct from cache<br/>
                May misinterpret action times
              </p>
            </div>
            <div className="bg-white border-2 border-gray-300 rounded p-3">
              <h4 className="font-semibold mb-2">PDF</h4>
              <Badge className="bg-red-500 text-white text-xs mb-2">❌ Raw Data</Badge>
              <p className="text-xs text-gray-600">
                Direct from editor state<br/>
                Different time calculations
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EditorLayer() {
  return (
    <Card className="border-2 border-green-500">
      <CardHeader className="bg-green-50">
        <CardTitle>WeeklyServiceManager.jsx</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="bg-gray-50 p-4 rounded">
          <h3 className="font-semibold mb-2">State Structure</h3>
          <pre className="text-xs overflow-x-auto">
      {`const serviceData = {
      "9:30am": [
      {
      type: "worship",
      title: "Tiempo de Alabanza",
      duration: 15,
      fields: ["leader", "songs", "ministry_leader"],
      data: {
      leader: "Worship Leader Name",
      translator: "Translator Name",
      verse: "",
      ministry_leader: "Ministry Leader Name"
      },
      songs: [
      { title: "Song 1", lead: "Lead 1", key: "G" },
      { title: "Song 2", lead: "Lead 2", key: "C" }
      ],
      _entityId: "seg_abc123",  // ← Entity ID injected by loadWeeklyFromSessions
      _sessionId: "sess_xyz789"
      }
      ],
      "11:30am": [...],
      coordinators: { "9:30am": "Juan Perez", "11:30am": "..." },
      _sessionIds: { "9:30am": "sess_xyz789", "11:30am": "sess_def456" }
      }`}
        </pre>
        </div>

        <div className="bg-green-50 border border-green-300 p-4 rounded">
          <h3 className="font-semibold mb-2 text-green-700">✅ Current Architecture: Per-Field Mutations</h3>
          <div className="space-y-2 text-sm">
            <p><strong>1. User Input:</strong> updateSegmentField() → setServiceData() [instant UI]</p>
            <p><strong>2. Entity Write:</strong> mutateSegmentField(entityId, field, value)</p>
            <p><strong>3. Debounce (300ms):</strong> Per (entityId + field) key</p>
            <p><strong>4. Atomic Write:</strong> Segment.update(entityId, {'{column: value}'})</p>
            <p className="text-green-800 font-semibold mt-2">
              📦 File: components/service/weekly/useSegmentMutation.jsx (405 lines)
            </p>
            <p className="text-green-800">
              📦 Commit: 94547bd
            </p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-300 p-4 rounded">
          <h3 className="font-semibold mb-2 text-blue-700">Field Mapping</h3>
          <pre className="bg-white p-2 rounded text-xs mt-2 font-mono">
      {`// UI → Entity column (useSegmentMutation.jsx:41-70)
      leader     → Segment.presenter
      preacher   → Segment.presenter
      translator → Segment.translator_name
      verse      → Segment.scripture_references

      coordinators → Session.coordinators
      ujieres      → Session.ushers_team
      sound        → Session.sound_team`}
          </pre>
        </div>

        <div className="bg-yellow-50 border border-yellow-300 p-4 rounded">
          <h3 className="font-semibold mb-2 text-yellow-700">⚠️ Previous Architecture (Abandoned 2026-02-22)</h3>
          <div className="space-y-1 text-xs text-yellow-900">
            <p><strong>Old:</strong> 5s debounced blob save → syncWeeklyToSessions → bulk delete/recreate</p>
            <p><strong>Problem:</strong> Async window allowed race conditions, timer reset loop prevented saves</p>
            <p><strong>Replaced:</strong> Per-field atomic writes eliminate race window</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BackendLayer() {
  return (
    <div className="space-y-4">
      <Card className="border-2 border-blue-500">
        <CardHeader className="bg-blue-50">
          <CardTitle>weeklySessionSync.jsx</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <div className="text-sm">
            <h3 className="font-semibold mb-2">syncWeeklyToSessions() - Lines 165-299</h3>
            <p className="text-gray-700 mb-2">
              Transforms editor state into Session/Segment/PreSessionDetails entities
            </p>
          </div>
          <div className="bg-gray-50 p-3 rounded text-xs font-mono space-y-1">
            <p className="text-blue-600">FOR EACH slot ("9:30am", "11:30am"):</p>
            <p className="ml-4">1. Find/Create Session entity</p>
            <p className="ml-4">2. Update PreSessionDetails (pre-service notes)</p>
            <p className="ml-4">3. Build parent Segment entities (order, type, presenter, songs, actions)</p>
            <p className="ml-4">4. Build child Segment entities (Ministración sub-assignments)</p>
            <p className="ml-4">5. Bulk create new segments</p>
            <p className="ml-4">6. Delete old segments (create-before-delete pattern)</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-purple-500">
        <CardHeader className="bg-purple-50">
          <CardTitle>functions/refreshActiveProgram.js</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <div className="text-sm">
            <h3 className="font-semibold mb-2">Entity Automation Trigger</h3>
            <div className="flex gap-2 mb-3">
              <Badge variant="outline">Service create/update</Badge>
              <Badge variant="outline">Session create/update</Badge>
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded text-xs font-mono space-y-1">
            <p className="text-green-600">1. Detect active program (ET timezone)</p>
            <p className="text-green-600">2. Load Sessions for service</p>
            <p className="text-green-600">3. Load Segments for each session</p>
            <p className="ml-4 text-orange-600">→ Filter parent_segment_id: null (no children)</p>
            <p className="ml-4 text-orange-600">→ Filter show_in_general !== false</p>
            <p className="text-green-600">4. Load PreSessionDetails</p>
            <p className="text-green-600">5. Normalize songs (song_1_* → songs[] array)</p>
            <p className="text-green-600">6. Build program snapshot object</p>
            <p className="text-green-600">7. Write to ActiveProgramCache</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-300 p-2 rounded text-xs">
            ⚠️ <strong>Performance:</strong> ~4 calls per save due to Service + Session automations
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DisplaysLayer() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="border-2 border-green-500">
        <CardHeader className="bg-green-50">
          <CardTitle className="text-sm">TV Display (Countdown)</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-2 text-xs">
          <Badge className="bg-green-500 text-white">✓ Normalized Data</Badge>
          <div className="space-y-1">
            <p className="font-semibold">File:</p>
            <code className="bg-gray-100 p-1 rounded block">pages/PublicCountdownDisplay.jsx</code>
          </div>
          <div className="space-y-1">
            <p className="font-semibold">Data Source:</p>
            <p className="text-gray-600">useActiveProgramCache() → normalizeProgram()</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold">Fields Used:</p>
            <ul className="list-disc ml-4 text-gray-600">
              <li>segment.title</li>
              <li>segment.presenter</li>
              <li>segment.translator_name</li>
              <li>segment.actions[] (timing enum)</li>
            </ul>
          </div>
          <div className="bg-red-50 border border-red-300 p-2 rounded mt-2">
            <p className="font-semibold text-red-700">🐛 Issue:</p>
            <p className="text-red-900">Coordinator panel overflow (actions off-screen)</p>
            <p className="text-green-700 mt-1">Fix: Add max-h-[600px] overflow-y-auto</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-orange-500">
        <CardHeader className="bg-orange-50">
          <CardTitle className="text-sm">Live View (Program)</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-2 text-xs">
          <Badge className="bg-red-500 text-white">❌ Raw Entity Data</Badge>
          <div className="space-y-1">
            <p className="font-semibold">File:</p>
            <code className="bg-gray-100 p-1 rounded block">pages/PublicProgramView.jsx</code>
          </div>
          <div className="space-y-1">
            <p className="font-semibold">Data Source:</p>
            <p className="text-gray-600">ActiveProgramCache (no normalization)</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold">Fields Used:</p>
            <ul className="list-disc ml-4 text-gray-600">
              <li>segment.title</li>
              <li>segment.presenter</li>
              <li>segment.coordinator_notes</li>
              <li>segment.actions[] (may be legacy format)</li>
            </ul>
          </div>
          <div className="bg-orange-50 border border-orange-300 p-2 rounded mt-2">
            <p className="font-semibold text-orange-700">⚠️ Risk:</p>
            <p className="text-orange-900">Action times may be misinterpreted if timing field missing</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-orange-500">
        <CardHeader className="bg-orange-50">
          <CardTitle className="text-sm">PDF Generation</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-2 text-xs">
          <Badge className="bg-red-500 text-white">❌ Raw Editor Data</Badge>
          <div className="space-y-1">
            <p className="font-semibold">File:</p>
            <code className="bg-gray-100 p-1 rounded block">generateWeeklyProgramPDF.js</code>
          </div>
          <div className="space-y-1">
            <p className="font-semibold">Data Source:</p>
            <p className="text-gray-600">serviceData (editor state directly)</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold">Fields Used:</p>
            <ul className="list-disc ml-4 text-gray-600">
              <li>segment.type (weekly format)</li>
              <li>segment.data.leader</li>
              <li>segment.data.preacher</li>
              <li>segment.songs[] array</li>
            </ul>
          </div>
          <div className="bg-orange-50 border border-orange-300 p-2 rounded mt-2">
            <p className="font-semibold text-orange-700">⚠️ Risk:</p>
            <p className="text-orange-900">Different action time calculation logic</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FieldMappingTable() {
  const mappings = [
    { editor: 'serviceData["9:30am"][0].title', entity: 'Segment.title', display: 'segment.title' },
    { editor: 'serviceData["9:30am"][0].type', entity: 'Segment.segment_type', display: 'segment.segment_type', notes: 'Normalized (worship→Alabanza)' },
    { editor: 'serviceData["9:30am"][0].data.leader', entity: 'Segment.presenter', display: 'segment.presenter', notes: 'Worship only' },
    { editor: 'serviceData["9:30am"][0].data.preacher', entity: 'Segment.presenter', display: 'segment.presenter', notes: 'Message only' },
    { editor: 'serviceData["9:30am"][0].data.translator', entity: 'Segment.translator_name', display: 'segment.translator_name' },
    { editor: 'serviceData["9:30am"][0].songs[0].title', entity: 'Segment.song_1_title', display: 'segment.songs[0].title', notes: 'Flattened in entity, array in display' },
    { editor: 'serviceData["9:30am"][0].data.verse', entity: 'Segment.scripture_references', display: 'segment.scripture_references' },
    { editor: 'serviceData["9:30am"][0].actions[]', entity: 'Segment.segment_actions', display: 'segment.actions[]', notes: '❗ Must have timing enum' },
    { editor: 'serviceData.coordinators["9:30am"]', entity: 'Session.coordinators', display: 'session.coordinators' },
    { editor: 'serviceData.pre_service_notes["9:30am"]', entity: 'PreSessionDetails.general_notes', display: 'session.pre_service_notes' },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-gray-100">
          <tr>
            <th className="text-left p-2 font-semibold">Editor State</th>
            <th className="text-left p-2 font-semibold">Entity Field</th>
            <th className="text-left p-2 font-semibold">Display Field</th>
            <th className="text-left p-2 font-semibold">Notes</th>
          </tr>
        </thead>
        <tbody>
          {mappings.map((row, i) => (
            <tr key={i} className="border-t border-gray-200">
              <td className="p-2">
                <code className="bg-gray-100 px-1 rounded text-xs">{row.editor}</code>
              </td>
              <td className="p-2">
                <code className="bg-blue-50 px-1 rounded text-xs">{row.entity}</code>
              </td>
              <td className="p-2">
                <code className="bg-green-50 px-1 rounded text-xs">{row.display}</code>
              </td>
              <td className="p-2 text-gray-600">{row.notes || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KnownIssues() {
  const issues = [
    {
      id: 1,
      title: 'Save Loop (RESOLVED - Entity Separation)',
      location: 'WeeklyServiceManager.jsx (removed in 94547bd)',
      cause: 'OLD: Blob save pipeline created async race window',
      fix: 'DEPLOYED: Per-field atomic writes (useSegmentMutation)',
      status: 'resolved',
      priority: 'resolved'
    },
    {
      id: 2,
      title: 'TV Display Coordinator Panel Overflow',
      location: 'PublicCountdownDisplay.jsx:215-280',
      cause: 'No max-height on actions container',
      fix: 'Add max-h-[600px] overflow-y-auto to coordinator panel div',
      status: 'identified',
      priority: 'high'
    },
    {
      id: 3,
      title: 'Action Time Calculation Divergence',
      location: 'CoordinatorActionsDisplay, PDF generation',
      cause: 'Different timing logic in each consumer',
      fix: 'Centralize in normalizeProgram.js, wire to all displays',
      status: 'identified',
      priority: 'high'
    },
    {
      id: 4,
      title: 'Normalization Not Universal',
      location: 'PublicProgramView, PDF generation',
      cause: 'normalizeProgram.js only wired to PublicCountdownDisplay',
      fix: 'Wire normalization to all display consumers',
      status: 'identified',
      priority: 'medium'
    },
    {
      id: 5,
      title: 'Decision Log Stale Entry',
      location: 'Decision 699a8d80 (2026-02-22)',
      cause: 'Entry says "removed per-field push" but current code USES per-field',
      fix: 'Archive outdated Decision, update with Entity Separation Final (v3.0)',
      status: 'identified',
      priority: 'low'
    }
  ];

  return (
    <div className="space-y-3">
      {issues.map((issue) => (
        <div
          key={issue.id}
          className={`border-2 rounded p-3 ${
            issue.priority === 'critical' ? 'border-red-500 bg-red-50' :
            issue.priority === 'high' ? 'border-orange-500 bg-orange-50' :
            'border-yellow-500 bg-yellow-50'
          }`}
        >
          <div className="flex items-start justify-between mb-2">
            <h4 className="font-semibold text-sm">{issue.title}</h4>
            <Badge className={
              issue.priority === 'critical' ? 'bg-red-600' :
              issue.priority === 'high' ? 'bg-orange-600' :
              'bg-yellow-600'
            }>
              {issue.priority.toUpperCase()}
            </Badge>
          </div>
          <div className="space-y-1 text-xs">
            <p><strong>Location:</strong> <code className="bg-white px-1 rounded">{issue.location}</code></p>
            <p><strong>Cause:</strong> {issue.cause}</p>
            <p className="text-green-700"><strong>Fix:</strong> {issue.fix}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
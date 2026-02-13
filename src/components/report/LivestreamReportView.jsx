1: import React from 'react';
   2: import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
   3: import { Badge } from "@/components/ui/badge";
   4: import { Radio } from "lucide-react";
   5: import { resolveBlockTime } from "@/components/utils/streamTiming";
   6: 
   7: export default function LivestreamReportView({ eventSessions, getSessionSegments, selectedEvent }) {
   8:   // Fetch blocks via backend function if this were a separate page, 
   9:   // but since we are in Reports.jsx, we need the parent to pass blocks or fetch them here.
  10:   // Reports.jsx does NOT fetch stream blocks yet.
  11:   // So we'll display a placeholder or note that data fetching is required.
  12:   // Actually, I can use a useQuery here to fetch blocks for the selected event.
  13:   
  14:   // Wait, Reports.jsx updates earlier didn't include fetching stream blocks. 
  15:   // I should probably update Reports.jsx to fetch them or fetch them here.
  16:   // Let's assume Reports.jsx will be updated to pass them OR we fetch here.
  17:   // Let's fetch here for isolation.
  18:   
  19:   return (
  20:     <div className="space-y-8">
  21:       {eventSessions.filter(s => s.has_livestream).map(session => (
  22:         <Card key={session.id} className="break-inside-avoid">
  23:           <CardHeader className="pb-2 border-b">
  24:             <div className="flex justify-between items-center">
  25:               <CardTitle className="text-lg uppercase flex items-center gap-2">
  26:                 <Radio className="w-5 h-5 text-red-600" />
  27:                 {session.name} - Run of Show
  28:               </CardTitle>
  29:               <Badge variant="outline">{session.date}</Badge>
  30:             </div>
  31:           </CardHeader>
  32:           <CardContent className="pt-4">
  33:             <LivestreamSessionTable session={session} />
  34:           </CardContent>
  35:         </Card>
  36:       ))}
  37:       
  38:       {eventSessions.filter(s => s.has_livestream).length === 0 && (
  39:         <div className="text-center p-12 text-gray-500 italic">
  40:           No livestream sessions found for this event.
  41:         </div>
  42:       )}
  43:     </div>
  44:   );
  45: }
  46: 
  47: import { useQuery } from "@tanstack/react-query";
  48: import { base44 } from "@/api/base44Client";
  49: import { formatTimeToEST } from "@/components/utils/timeFormat";
  50: 
  51: function LivestreamSessionTable({ session }) {
  52:   const { data: blocks = [] } = useQuery({
  53:     queryKey: ['report-stream-blocks', session.id],
  54:     queryFn: () => base44.entities.StreamBlock.filter({ session_id: session.id }, 'order'),
  55:   });
  56: 
  57:   const { data: segments = [] } = useQuery({
  58:     queryKey: ['report-segments', session.id],
  59:     queryFn: () => base44.entities.Segment.filter({ session_id: session.id }, 'order'),
  60:   });
  61: 
  62:   if (blocks.length === 0) return <div className="text-sm text-gray-400">No blocks defined.</div>;
  63: 
  64:   return (
  65:     <table className="w-full text-sm border-collapse">
  66:       <thead>
  67:         <tr className="bg-gray-100 text-left">
  68:           <th className="p-2 border w-20">Time</th>
  69:           <th className="p-2 border w-24">Type</th>
  70:           <th className="p-2 border">Content</th>
  71:           <th className="p-2 border">Cues / Actions</th>
  72:           <th className="p-2 border">Tech Notes</th>
  73:         </tr>
  74:       </thead>
  75:       <tbody>
  76:         {blocks.map(block => {
  77:           const { startTime, endTime } = resolveBlockTime(block, segments, session.date);
  78:           const timeStr = startTime ? formatTimeToEST(startTime.toTimeString().substring(0, 5)) : '--:--';
  79:           
  80:           return (
  81:             <tr key={block.id} className="border-b">
  82:               <td className="p-2 border font-mono whitespace-nowrap">{timeStr}</td>
  83:               <td className="p-2 border">
  84:                 <Badge variant="outline" className="text-[10px] uppercase">{block.block_type}</Badge>
  85:               </td>
  86:               <td className="p-2 border">
  87:                 <div className="font-bold">{block.title}</div>
  88:                 {block.presenter && <div className="text-xs text-gray-600">{block.presenter}</div>}
  89:                 {block.description && <div className="text-xs mt-1 italic">{block.description}</div>}
  90:               </td>
  91:               <td className="p-2 border">
  92:                 {block.stream_actions?.map((action, i) => (
  93:                   <div key={i} className="text-xs mb-1">
  94:                     <span className="font-bold">▶ {action.label}</span>
  95:                     {action.notes && <span className="text-gray-500"> - {action.notes}</span>}
  96:                   </div>
  97:                 ))}
  98:               </td>
  99:               <td className="p-2 border text-xs text-blue-800 bg-blue-50/30">
 100:                 {block.stream_notes}
 101:               </td>
 102:             </tr>
 103:           );
 104:         })}
 105:       </tbody>
 106:     </table>
 107:   );
 108: }
 109:
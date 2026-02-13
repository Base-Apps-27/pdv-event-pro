import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Radio } from "lucide-react";
import { resolveBlockTime } from "@/components/utils/streamTiming";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { formatTimeToEST } from "@/components/utils/timeFormat";

export default function LivestreamReportView({ eventSessions, getSessionSegments, selectedEvent }) {
  // Fetch blocks via backend function if this were a separate page, 
  // but since we are in Reports.jsx, we need the parent to pass blocks or fetch them here.
  // Reports.jsx does NOT fetch stream blocks yet.
  // So we'll display a placeholder or note that data fetching is required.
  // Actually, I can use a useQuery here to fetch blocks for the selected event.
  
  return (
    <div className="space-y-8">
      {eventSessions.filter(s => s.has_livestream).map(session => (
        <Card key={session.id} className="break-inside-avoid">
          <CardHeader className="pb-2 border-b">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg uppercase flex items-center gap-2">
                <Radio className="w-5 h-5 text-red-600" />
                {session.name} - Run of Show
              </CardTitle>
              <Badge variant="outline">{session.date}</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <LivestreamSessionTable session={session} />
          </CardContent>
        </Card>
      ))}
      
      {eventSessions.filter(s => s.has_livestream).length === 0 && (
        <div className="text-center p-12 text-gray-500 italic">
          No livestream sessions found for this event.
        </div>
      )}
    </div>
  );
}

function LivestreamSessionTable({ session }) {
  const { data: blocks = [] } = useQuery({
    queryKey: ['report-stream-blocks', session.id],
    queryFn: () => base44.entities.StreamBlock.filter({ session_id: session.id }, 'order'),
  });

  const { data: segments = [] } = useQuery({
    queryKey: ['report-segments', session.id],
    queryFn: () => base44.entities.Segment.filter({ session_id: session.id }, 'order'),
  });

  if (blocks.length === 0) return <div className="text-sm text-gray-400">No blocks defined.</div>;

  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="bg-gray-100 text-left">
          <th className="p-2 border w-20">Time</th>
          <th className="p-2 border w-24">Type</th>
          <th className="p-2 border">Content</th>
          <th className="p-2 border">Cues / Actions</th>
          <th className="p-2 border">Tech Notes</th>
        </tr>
      </thead>
      <tbody>
        {blocks.map(block => {
          const { startTime, endTime } = resolveBlockTime(block, segments, session.date);
          const timeStr = startTime ? formatTimeToEST(startTime.toTimeString().substring(0, 5)) : '--:--';
          
          return (
            <tr key={block.id} className="border-b">
              <td className="p-2 border font-mono whitespace-nowrap">{timeStr}</td>
              <td className="p-2 border">
                <Badge variant="outline" className="text-[10px] uppercase">{block.block_type}</Badge>
              </td>
              <td className="p-2 border">
                <div className="font-bold">{block.title}</div>
                {block.presenter && <div className="text-xs text-gray-600">{block.presenter}</div>}
                {block.description && <div className="text-xs mt-1 italic">{block.description}</div>}
              </td>
              <td className="p-2 border">
                {block.stream_actions?.map((action, i) => (
                  <div key={i} className="text-xs mb-1">
                    <span className="font-bold">▶ {action.label}</span>
                    {action.notes && <span className="text-gray-500"> - {action.notes}</span>}
                  </div>
                ))}
              </td>
              <td className="p-2 border text-xs text-blue-800 bg-blue-50/30">
                {block.stream_notes}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatTimeToEST } from "@/components/utils/timeFormat";
import { ArrowDown } from "lucide-react";

export default function SegmentTimelinePreview({ segments, currentSegmentId }) {
  if (!segments || segments.length === 0) {
    return (
      <Card className="p-4 text-center text-sm text-gray-500">
        No hay segmentos en esta sesión
      </Card>
    );
  }

  const currentIndex = segments.findIndex(s => s.id === currentSegmentId);
  const displayedSegments = [];

  if (currentIndex > 0) {
    displayedSegments.push({ type: "prev", segment: segments[currentIndex - 1] });
  }

  displayedSegments.push({ type: "current", segment: segments[currentIndex] });

  if (currentIndex < segments.length - 1) {
    displayedSegments.push({ type: "next", segment: segments[currentIndex + 1] });
  }

  return (
    <Card className="p-4 shadow-lg sticky top-24 z-10 bg-white border">
      <h4 className="font-bold text-sm mb-3 text-slate-800">Contexto en Sesión</h4>
      <div className="space-y-2">
        {displayedSegments.map((item, idx) => (
          <div key={item.segment.id + "-" + idx} className="flex items-center gap-2">
            {item.type === "prev" && <ArrowDown className="w-4 h-4 text-gray-400 transform rotate-180" />}
            {item.type === "next" && <ArrowDown className="w-4 h-4 text-gray-400" />}
            {item.type === "current" && <div className="w-4 h-4" />}
            <CardContent
              className={`p-2 rounded-md border text-sm w-full ${
                item.type === "current"
                  ? "bg-pdv-green text-white border-pdv-green" 
                  : "bg-gray-50 text-gray-700 border-gray-200"
              }`}
            >
              <div className="font-semibold truncate">
                {item.segment.title}
              </div>
              {item.segment.start_time && item.segment.duration_min && (
                <div className="text-xs opacity-90">
                  {formatTimeToEST(item.segment.start_time)} ({item.segment.duration_min}m)
                </div>
              )}
            </CardContent>
          </div>
        ))}
      </div>
    </Card>
  );
}
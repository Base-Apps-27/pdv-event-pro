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
    <div className="sticky top-36 z-10 bg-white/95 backdrop-blur-sm border border-gray-200 rounded p-3">
      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Timeline</h4>
      <div className="space-y-1">
        {displayedSegments.map((item, idx) => (
          <div key={item.segment.id + "-" + idx} className="flex items-center gap-1.5">
            {item.type === "prev" && <ArrowDown className="w-3 h-3 text-gray-300 transform rotate-180" />}
            {item.type === "next" && <ArrowDown className="w-3 h-3 text-gray-300" />}
            {item.type === "current" && <div className="w-3 h-3 rounded-full bg-pdv-green flex-shrink-0" />}
            <div
              className={`px-2 py-1 rounded text-xs truncate ${
                item.type === "current"
                  ? "bg-pdv-green/10 text-pdv-green font-medium border border-pdv-green/30" 
                  : "text-gray-600"
              }`}
            >
              {item.segment.title}
              {item.segment.start_time && item.segment.duration_min && (
                <span className="ml-1 opacity-60">
                  {formatTimeToEST(item.segment.start_time)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
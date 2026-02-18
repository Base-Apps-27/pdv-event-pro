import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, ArrowRight } from "lucide-react";

const COUPLING_BADGE = {
  Loose: "bg-green-100 text-green-700",
  Medium: "bg-yellow-100 text-yellow-700",
  Tight: "bg-red-100 text-red-700",
};

export default function EdgeRow({ edge }) {
  const [expanded, setExpanded] = useState(false);
  const coupling = edge.coupling_level || "Medium";

  return (
    <div
      className="border-b border-gray-200 last:border-0 py-2 px-3 hover:bg-gray-50 cursor-pointer transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <code className="text-xs font-mono text-blue-700 font-bold">{edge.from_node_id}</code>
        <ArrowRight className="w-3 h-3 text-gray-400 shrink-0" />
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-bold">{edge.relationship_type}</Badge>
        <ArrowRight className="w-3 h-3 text-gray-400 shrink-0" />
        <code className="text-xs font-mono text-green-700 font-bold">{edge.to_node_id}</code>

        <div className="flex items-center gap-1 ml-auto">
          <Badge className={`text-[10px] px-1.5 py-0 ${COUPLING_BADGE[coupling]}`}>{coupling}</Badge>
          {edge.directionality !== "one-way" && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{edge.directionality}</Badge>
          )}
          {expanded ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="mt-2 pl-4 space-y-1.5 text-xs text-gray-600 border-l-2 border-gray-200 ml-2">
          <div className="font-mono text-[10px] text-gray-400">{edge.edge_id}</div>
          {edge.contract && (
            <div><span className="font-bold text-gray-500">Contract:</span> {edge.contract}</div>
          )}
          {edge.failure_mode && (
            <div><span className="font-bold text-red-500">Failure:</span> {edge.failure_mode}</div>
          )}
          {edge.backward_compatibility_notes && (
            <div><span className="font-bold text-amber-500">Compat:</span> {edge.backward_compatibility_notes}</div>
          )}
          {edge.protecting_tests?.length > 0 && (
            <div><span className="font-bold text-green-600">Tests:</span> {edge.protecting_tests.join(", ")}</div>
          )}
        </div>
      )}
    </div>
  );
}
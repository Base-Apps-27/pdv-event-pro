import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, FileCode, ArrowUpRight, ArrowDownLeft } from "lucide-react";

const TYPE_ICONS = {
  Entity: "🗄️", Page: "📄", Component: "🧩", Function: "⚡",
  Modal: "🪟", Integration: "🔌", Permission: "🔐", BackgroundJob: "⏱️",
  Webhook: "🪝", Report: "📊", Utility: "🔧", Event: "📅", Automation: "🤖"
};

const RISK_COLORS = {
  Critical: "border-l-red-600 bg-red-50/30",
  High: "border-l-orange-500 bg-orange-50/20",
  Medium: "border-l-yellow-500",
  Low: "border-l-green-500",
};

const RISK_BADGE = {
  Critical: "bg-red-600 text-white",
  High: "bg-orange-500 text-white",
  Medium: "bg-yellow-100 text-yellow-800",
  Low: "bg-green-100 text-green-800",
};

const COVERAGE_BADGE = {
  None: "bg-gray-100 text-gray-500",
  Partial: "bg-yellow-100 text-yellow-700",
  Good: "bg-blue-100 text-blue-700",
  Comprehensive: "bg-green-100 text-green-700",
};

export default function NodeCard({ node, outgoingEdges = [], incomingEdges = [] }) {
  const [expanded, setExpanded] = useState(false);

  const risk = node.risk_level || "Medium";
  const coverage = node.test_coverage || "None";

  return (
    <Card
      className={`border-l-4 ${RISK_COLORS[risk]} overflow-hidden transition-all cursor-pointer hover:shadow-md`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="p-3 sm:p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <span className="text-lg mt-0.5">{TYPE_ICONS[node.node_type] || "📦"}</span>
            <div className="min-w-0">
              <h4 className="font-bold text-sm text-gray-900 leading-tight">{node.node_name}</h4>
              <code className="text-[10px] text-gray-500 font-mono break-all">{node.node_id}</code>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          </div>
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <Badge className={`text-[10px] px-1.5 py-0 ${RISK_BADGE[risk]}`}>{risk}</Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{node.module}</Badge>
          <Badge className={`text-[10px] px-1.5 py-0 ${COVERAGE_BADGE[coverage]}`}>
            {coverage === "None" ? "No Tests" : coverage}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
            <ArrowUpRight className="w-2.5 h-2.5" />{outgoingEdges.length}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
            <ArrowDownLeft className="w-2.5 h-2.5" />{incomingEdges.length}
          </Badge>
          {node.status === "deprecated" && (
            <Badge className="text-[10px] px-1.5 py-0 bg-gray-400 text-white">Deprecated</Badge>
          )}
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-gray-200 space-y-2 text-xs text-gray-700">
            <div>
              <span className="font-bold text-gray-500 uppercase text-[10px]">Definition</span>
              <p className="mt-0.5">{node.definition}</p>
            </div>

            {node.file_path && (
              <div className="flex items-center gap-1 text-[11px] text-gray-500">
                <FileCode className="w-3 h-3" />
                <code className="font-mono">{node.file_path}</code>
              </div>
            )}

            {node.failure_impact && (
              <div>
                <span className="font-bold text-red-600 uppercase text-[10px]">Failure Impact</span>
                <p className="mt-0.5">{node.failure_impact}</p>
              </div>
            )}

            {node.change_notes && (
              <div>
                <span className="font-bold text-amber-600 uppercase text-[10px]">Gotchas</span>
                <p className="mt-0.5">{node.change_notes}</p>
              </div>
            )}

            {node.inputs?.length > 0 && (
              <div>
                <span className="font-bold text-gray-500 uppercase text-[10px]">Inputs</span>
                <ul className="mt-0.5 space-y-0.5">
                  {node.inputs.map((inp, i) => (
                    <li key={i} className="font-mono text-[11px]">
                      {inp.source} ({inp.data_type}){inp.required ? " *" : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {node.outputs?.length > 0 && (
              <div>
                <span className="font-bold text-gray-500 uppercase text-[10px]">Outputs</span>
                <ul className="mt-0.5 space-y-0.5">
                  {node.outputs.map((out, i) => (
                    <li key={i} className="font-mono text-[11px]">
                      → {out.destination} ({out.data_type}){out.condition ? ` [${out.condition}]` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Connected edges */}
            {(outgoingEdges.length > 0 || incomingEdges.length > 0) && (
              <div>
                <span className="font-bold text-gray-500 uppercase text-[10px]">Edges</span>
                <div className="mt-0.5 space-y-0.5">
                  {outgoingEdges.map(e => (
                    <div key={e.id} className="font-mono text-[11px]">
                      → <span className="text-blue-600">{e.relationship_type}</span> → {e.to_node_id}
                      {e.coupling_level && <span className="text-gray-400 ml-1">({e.coupling_level})</span>}
                    </div>
                  ))}
                  {incomingEdges.map(e => (
                    <div key={e.id} className="font-mono text-[11px]">
                      ← <span className="text-green-600">{e.relationship_type}</span> ← {e.from_node_id}
                      {e.coupling_level && <span className="text-gray-400 ml-1">({e.coupling_level})</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
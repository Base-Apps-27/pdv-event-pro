import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";

const RELATIONSHIP_ARROWS = {
  Reads: "-->|reads|",
  Writes: "-->|writes|",
  Calls: "-->|calls|",
  Triggers: "-->|triggers|",
  Renders: "-->|renders|",
  Requires: "-.->|requires|",
  Emits: "-->|emits|",
  Subscribes: "-.->|subscribes|",
  Validates: "-->|validates|",
  Authorizes: "-.->|authorizes|",
  NavigatesTo: "-->|nav|",
  SyncsTo: "<-->|sync|",
  Consumes: "-->|consumes|",
  Produces: "-->|produces|",
};

export default function MermaidDiagram({ nodes, edges }) {
  const [view, setView] = useState("full");

  const mermaidCode = useMemo(() => {
    let filteredNodes = nodes;
    let filteredEdges = edges;

    if (view === "critical") {
      const criticalIds = new Set(
        nodes.filter(n => n.risk_level === "Critical" || n.risk_level === "High").map(n => n.node_id)
      );
      filteredNodes = nodes.filter(n => criticalIds.has(n.node_id));
      filteredEdges = edges.filter(e => criticalIds.has(e.from_node_id) || criticalIds.has(e.to_node_id));
    }

    if (view === "service-pipeline") {
      const pipelineKeywords = ["Service", "Session", "Segment", "Program", "Live", "Sticky", "MyProgram", "Countdown", "Weekly"];
      const pipelineIds = new Set(
        nodes.filter(n => pipelineKeywords.some(kw => n.node_id.includes(kw) || n.node_name.includes(kw))).map(n => n.node_id)
      );
      filteredNodes = nodes.filter(n => pipelineIds.has(n.node_id));
      filteredEdges = edges.filter(e => pipelineIds.has(e.from_node_id) || pipelineIds.has(e.to_node_id));
    }

    const lines = ["graph TD"];

    // Style subgraphs by module
    const modules = new Map();
    filteredNodes.forEach(n => {
      if (!modules.has(n.module)) modules.set(n.module, []);
      modules.get(n.module).push(n);
    });

    modules.forEach((moduleNodes, moduleName) => {
      lines.push(`  subgraph ${moduleName.replace(/\s+/g, '_')}`);
      moduleNodes.forEach(n => {
        const safeId = n.node_id.replace(/[^a-zA-Z0-9_-]/g, '_');
        const shape = n.node_type === "Entity" ? `[(${n.node_name})]`
          : n.node_type === "Function" ? `{{${n.node_name}}}`
          : n.node_type === "Page" ? `[/${n.node_name}/]`
          : `[${n.node_name}]`;
        lines.push(`    ${safeId}${shape}`);
      });
      lines.push("  end");
    });

    // Edges
    filteredEdges.forEach(e => {
      const from = e.from_node_id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const to = e.to_node_id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const arrow = RELATIONSHIP_ARROWS[e.relationship_type] || "-->|???|";
      lines.push(`  ${from} ${arrow} ${to}`);
    });

    // Risk coloring
    const criticals = filteredNodes.filter(n => n.risk_level === "Critical");
    const highs = filteredNodes.filter(n => n.risk_level === "High");
    if (criticals.length > 0) {
      lines.push(`  style ${criticals.map(n => n.node_id.replace(/[^a-zA-Z0-9_-]/g, '_')).join(",")} fill:#fecaca,stroke:#dc2626`);
    }
    if (highs.length > 0) {
      lines.push(`  style ${highs.map(n => n.node_id.replace(/[^a-zA-Z0-9_-]/g, '_')).join(",")} fill:#fed7aa,stroke:#ea580c`);
    }

    return lines.join("\n");
  }, [nodes, edges, view]);

  const handleCopy = () => {
    navigator.clipboard.writeText(mermaidCode);
    toast.success("Mermaid code copied");
  };

  const handleDownload = () => {
    const blob = new Blob([mermaidCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dependency-graph-${view}.mmd`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={view} onValueChange={setView}>
          <SelectTrigger className="w-48 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="full">Full Graph</SelectItem>
            <SelectItem value="critical">Critical + High Only</SelectItem>
            <SelectItem value="service-pipeline">Service Pipeline</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
          <Copy className="w-3 h-3" /> Copy
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
          <Download className="w-3 h-3" /> .mmd
        </Button>
      </div>

      <pre className="bg-gray-900 text-green-300 p-4 rounded-lg text-xs font-mono overflow-x-auto max-h-[60vh] whitespace-pre-wrap">
        {mermaidCode}
      </pre>

      <p className="text-xs text-gray-500">
        Paste into <a href="https://mermaid.live" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">mermaid.live</a> to render the diagram visually.
      </p>
    </div>
  );
}
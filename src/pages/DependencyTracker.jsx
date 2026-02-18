/**
 * DependencyTracker — Constitution §5 Enforcement UI
 *
 * Read-only explorer for the directed dependency graph.
 * Gated to manage_users permission (admin-only).
 * Three tabs: Node Registry, Edge Registry, Diagrams.
 *
 * Decision: "Dependency Tracker: 2 entities + 1 admin UI for §5 compliance"
 */
import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, AlertTriangle, Network, GitBranch, FileCode } from "lucide-react";

import NodeCard from "@/components/dependency/NodeCard";
import EdgeRow from "@/components/dependency/EdgeRow";
import MermaidDiagram from "@/components/dependency/MermaidDiagram";

const NODE_TYPES = ["Entity", "Page", "Component", "Function", "Modal", "Integration", "Permission", "BackgroundJob", "Webhook", "Report", "Utility", "Event", "Automation"];
const MODULES = ["EventPro", "WeeklyServices", "LiveOps", "Announcements", "People", "Admin", "Platform", "Shared"];
const RISK_LEVELS = ["Critical", "High", "Medium", "Low"];

export default function DependencyTracker() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterModule, setFilterModule] = useState("all");
  const [filterRisk, setFilterRisk] = useState("all");
  const [edgeSearch, setEdgeSearch] = useState("");

  const { data: nodes = [], isLoading: nodesLoading } = useQuery({
    queryKey: ["dependencyNodes"],
    queryFn: () => base44.entities.DependencyNode.list("node_id"),
  });

  const { data: edges = [], isLoading: edgesLoading } = useQuery({
    queryKey: ["dependencyEdges"],
    queryFn: () => base44.entities.DependencyEdge.list("edge_id"),
  });

  // Build lookup maps
  const edgesByFrom = useMemo(() => {
    const map = new Map();
    edges.forEach(e => {
      if (!map.has(e.from_node_id)) map.set(e.from_node_id, []);
      map.get(e.from_node_id).push(e);
    });
    return map;
  }, [edges]);

  const edgesByTo = useMemo(() => {
    const map = new Map();
    edges.forEach(e => {
      if (!map.has(e.to_node_id)) map.set(e.to_node_id, []);
      map.get(e.to_node_id).push(e);
    });
    return map;
  }, [edges]);

  // Filter nodes
  const filteredNodes = useMemo(() => {
    return nodes.filter(n => {
      if (filterType !== "all" && n.node_type !== filterType) return false;
      if (filterModule !== "all" && n.module !== filterModule) return false;
      if (filterRisk !== "all" && n.risk_level !== filterRisk) return false;
      if (search) {
        const q = search.toLowerCase();
        return (n.node_id || "").toLowerCase().includes(q) ||
               (n.node_name || "").toLowerCase().includes(q) ||
               (n.definition || "").toLowerCase().includes(q) ||
               (n.file_path || "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [nodes, search, filterType, filterModule, filterRisk]);

  // Filter edges
  const filteredEdges = useMemo(() => {
    if (!edgeSearch) return edges;
    const q = edgeSearch.toLowerCase();
    return edges.filter(e =>
      (e.edge_id || "").toLowerCase().includes(q) ||
      (e.from_node_id || "").toLowerCase().includes(q) ||
      (e.to_node_id || "").toLowerCase().includes(q) ||
      (e.relationship_type || "").toLowerCase().includes(q)
    );
  }, [edges, edgeSearch]);

  // Stats
  const stats = useMemo(() => ({
    totalNodes: nodes.length,
    totalEdges: edges.length,
    critical: nodes.filter(n => n.risk_level === "Critical").length,
    high: nodes.filter(n => n.risk_level === "High").length,
    eventPro: nodes.filter(n => n.module === "EventPro").length,
    liveOps: nodes.filter(n => n.module === "LiveOps").length,
    noTests: nodes.filter(n => !n.test_coverage || n.test_coverage === "None").length,
  }), [nodes, edges]);

  const isLoading = nodesLoading || edgesLoading;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <Network className="w-6 h-6 text-pdv-teal" />
          <h1 className="text-2xl text-gray-900">Dependency Tracker</h1>
        </div>
        <p className="text-sm text-gray-500 mt-1">Constitution §5 — System artifact graph and relationship registry</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard label="Nodes" value={stats.totalNodes} icon={<FileCode className="w-4 h-4" />} />
        <StatCard label="Edges" value={stats.totalEdges} icon={<GitBranch className="w-4 h-4" />} />
        <StatCard label="Critical" value={stats.critical} className="text-red-600" />
        <StatCard label="High" value={stats.high} className="text-orange-600" />
        <StatCard label="EventPro" value={stats.eventPro} />
        <StatCard label="LiveOps" value={stats.liveOps} />
        <StatCard label="No Tests" value={stats.noTests} className="text-amber-600" />
      </div>

      {/* Critical paths alert */}
      {stats.critical > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-red-800">
            <strong>{stats.critical} critical-risk node{stats.critical !== 1 ? "s" : ""}</strong> in the graph.
            Changes to these require full impact analysis per Constitution §5.
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="nodes">
        <TabsList className="bg-gray-200">
          <TabsTrigger value="nodes">Node Registry ({filteredNodes.length})</TabsTrigger>
          <TabsTrigger value="edges">Edge Registry ({filteredEdges.length})</TabsTrigger>
          <TabsTrigger value="diagrams">Diagrams</TabsTrigger>
        </TabsList>

        {/* NODES TAB */}
        <TabsContent value="nodes" className="space-y-4 mt-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search nodes..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-36 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {NODE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterModule} onValueChange={setFilterModule}>
              <SelectTrigger className="w-40 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                {MODULES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterRisk} onValueChange={setFilterRisk}>
              <SelectTrigger className="w-32 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risk</SelectItem>
                {RISK_LEVELS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <p className="text-gray-500 text-center py-12">Loading graph...</p>
          ) : filteredNodes.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Network className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No nodes found. Start registering system artifacts.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredNodes.map(node => (
                <NodeCard
                  key={node.id}
                  node={node}
                  outgoingEdges={edgesByFrom.get(node.node_id) || []}
                  incomingEdges={edgesByTo.get(node.node_id) || []}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* EDGES TAB */}
        <TabsContent value="edges" className="space-y-4 mt-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search edges..."
              value={edgeSearch}
              onChange={e => setEdgeSearch(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>

          {isLoading ? (
            <p className="text-gray-500 text-center py-12">Loading edges...</p>
          ) : filteredEdges.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <GitBranch className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No edges found. Start connecting nodes.</p>
            </div>
          ) : (
            <Card className="bg-white overflow-hidden">
              <div className="divide-y divide-gray-100">
                {filteredEdges.map(edge => (
                  <EdgeRow key={edge.id} edge={edge} />
                ))}
              </div>
            </Card>
          )}
        </TabsContent>

        {/* DIAGRAMS TAB */}
        <TabsContent value="diagrams" className="mt-4">
          {isLoading ? (
            <p className="text-gray-500 text-center py-12">Loading graph data...</p>
          ) : nodes.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Network className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No nodes to diagram yet.</p>
            </div>
          ) : (
            <MermaidDiagram nodes={nodes} edges={edges} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value, icon, className = "" }) {
  return (
    <Card className="bg-white">
      <CardContent className="p-3 flex items-center gap-2">
        {icon && <span className="text-gray-400">{icon}</span>}
        <div>
          <div className={`text-lg font-bold leading-none ${className}`}>{value}</div>
          <div className="text-[10px] text-gray-500 uppercase font-bold mt-0.5">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
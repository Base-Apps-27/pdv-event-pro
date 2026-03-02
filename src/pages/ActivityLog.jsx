/**
 * ActivityLog.jsx
 * Universal immutable activity log for all platform actions.
 * 
 * Decision: UNIVERSAL_ACTIVITY_LOG (2026-02-19)
 * - Admin-only page
 * - Immutable display — no editing of log entries
 * - Filters: entity type, action type, user, date range, search
 * - Covers: Event, Session, Segment, EventDay, PreSessionDetails,
 *           Service, ServiceSchedule, StreamBlock, AnnouncementItem, AnnouncementSeries
 */

import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/components/utils/useCurrentUser";
import { hasPermission } from "@/components/utils/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Activity, Filter, User, Clock, Search, RefreshCw, ChevronDown, ChevronRight,
  Plus, Pencil, Trash2, ArrowUpDown, Shield
} from "lucide-react";
import { formatTimestampToEST } from "@/components/utils/timeFormat";
import { useLanguage } from "@/components/utils/i18n.jsx";

const ACTION_COLORS = {
  create: "bg-green-100 text-green-700 border-green-200",
  update: "bg-blue-100 text-blue-700 border-blue-200",
  delete: "bg-red-100 text-red-700 border-red-200",
  reorder: "bg-purple-100 text-purple-700 border-purple-200",
};

const ACTION_ICONS = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
  reorder: ArrowUpDown,
};

const ACTION_LABELS = {
  create: "Creado",
  update: "Actualizado",
  delete: "Eliminado",
  reorder: "Reordenado",
};

const ENTITY_LABELS = {
  Event: "Evento",
  Session: "Sesión",
  Segment: "Segmento",
  EventDay: "Día de Evento",
  PreSessionDetails: "Pre-Sesión",
  Service: "Servicio",
  ServiceSchedule: "Horario Recurrente",
  StreamBlock: "Bloque de Stream",
  AnnouncementItem: "Anuncio",
  AnnouncementSeries: "Serie de Anuncios",
};

const ENTITY_BADGE_COLORS = {
  Event: "bg-indigo-100 text-indigo-700",
  Session: "bg-sky-100 text-sky-700",
  Segment: "bg-teal-100 text-teal-700",
  EventDay: "bg-violet-100 text-violet-700",
  PreSessionDetails: "bg-gray-100 text-gray-700",
  Service: "bg-orange-100 text-orange-700",
  ServiceSchedule: "bg-yellow-100 text-yellow-700",
  StreamBlock: "bg-pink-100 text-pink-700",
  AnnouncementItem: "bg-emerald-100 text-emerald-700",
  AnnouncementSeries: "bg-lime-100 text-lime-700",
};

function FieldChanges({ fieldChanges }) {
  const [open, setOpen] = useState(false);
  if (!fieldChanges || Object.keys(fieldChanges).length === 0) return null;

  const count = Object.keys(fieldChanges).length;

  const formatVal = (v) => {
    if (v === null || v === undefined) return "—";
    if (typeof v === "boolean") return v ? "Sí" : "No";
    if (Array.isArray(v)) return `[${v.length} items]`;
    if (typeof v === "object") return JSON.stringify(v).slice(0, 60) + "…";
    const s = String(v);
    return s.length > 80 ? s.slice(0, 80) + "…" : s;
  };

  return (
    <div className="mt-1.5">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {count} campo{count !== 1 ? "s" : ""} modificado{count !== 1 ? "s" : ""}
      </button>
      {open && (
        <div className="mt-2 space-y-1 pl-4 border-l-2 border-slate-200">
          {Object.entries(fieldChanges).map(([field, change]) => (
            <div key={field} className="text-xs flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-slate-600 font-medium">{field}:</span>
              <span className="bg-red-50 text-red-600 line-through px-1 rounded">{formatVal(change.old_value)}</span>
              <span className="text-slate-400">→</span>
              <span className="bg-green-50 text-green-700 px-1 rounded">{formatVal(change.new_value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LogRow({ log }) {
  const ActionIcon = ACTION_ICONS[log.action_type] || Pencil;
  const actionColor = ACTION_COLORS[log.action_type] || ACTION_COLORS.update;
  const entityBadgeColor = ENTITY_BADGE_COLORS[log.entity_type] || "bg-gray-100 text-gray-700";

  const isUndo = log.description?.startsWith("[UNDO") || false;

  return (
    <div className={`flex gap-3 px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${isUndo ? "bg-amber-50" : ""}`}>
      {/* Action icon */}
      <div className="flex-shrink-0 mt-0.5">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center border ${actionColor}`}>
          <ActionIcon className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${entityBadgeColor}`}>
            {ENTITY_LABELS[log.entity_type] || log.entity_type}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded border ${actionColor}`}>
            {ACTION_LABELS[log.action_type] || log.action_type}
          </span>
          {isUndo && (
            <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded">
              UNDO
            </span>
          )}
          {log.undone && (
            <span className="text-xs bg-gray-100 text-gray-500 border px-2 py-0.5 rounded line-through">
              Deshecho
            </span>
          )}
        </div>

        <p className="text-sm text-slate-800 leading-snug">{log.description || "—"}</p>
        <FieldChanges fieldChanges={log.field_changes} />

        <div className="flex flex-wrap items-center gap-3 mt-1.5">
          {(log.user_name || log.user_email) && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <User className="w-3 h-3" />
              {log.user_name || log.user_email}
            </span>
          )}
          {log.created_date && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Clock className="w-3 h-3" />
              {formatTimestampToEST(log.created_date)}
            </span>
          )}
          {log.entity_id && (
            <span className="text-xs text-slate-300 font-mono truncate max-w-[140px]">
              {log.entity_id}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZE = 50;

export default function ActivityLog() {
  const { user, loading: userLoading } = useCurrentUser();
  const { t } = useLanguage();

  const [search, setSearch] = useState("");
  const [filterEntityType, setFilterEntityType] = useState("all");
  const [filterActionType, setFilterActionType] = useState("all");
  const [filterUser, setFilterUser] = useState("");
  const [page, setPage] = useState(0);

  const isAdmin = user && hasPermission(user, "manage_users");

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["activityLog", page],
    queryFn: () =>
      base44.entities.EditActionLog.list("-created_date", PAGE_SIZE * (page + 1)),
    enabled: !!user && isAdmin,
    staleTime: 30 * 1000,
  });

  const filtered = useMemo(() => {
    let result = logs;

    if (filterEntityType !== "all") {
      result = result.filter(l => l.entity_type === filterEntityType);
    }
    if (filterActionType !== "all") {
      result = result.filter(l => l.action_type === filterActionType);
    }
    if (filterUser) {
      const q = filterUser.toLowerCase();
      result = result.filter(
        l => l.user_name?.toLowerCase().includes(q) || l.user_email?.toLowerCase().includes(q)
      );
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        l =>
          l.description?.toLowerCase().includes(q) ||
          l.entity_type?.toLowerCase().includes(q) ||
          l.entity_id?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [logs, filterEntityType, filterActionType, filterUser, search]);

  if (userLoading) return null;

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
        <Shield className="w-12 h-12 text-slate-300" />
        <h2 className="text-xl font-semibold text-slate-600">Acceso Restringido</h2>
        <p className="text-slate-400 text-sm max-w-sm">
          Solo los administradores pueden ver el registro de actividad.
        </p>
      </div>
    );
  }

  const entityTypes = Object.keys(ENTITY_LABELS);

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Activity className="w-7 h-7 text-[#1F8A70]" />
            <h1 className="text-4xl font-bold uppercase tracking-wide">Registro de Actividad</h1>
          </div>
          <p className="text-slate-500 mt-1 text-sm">
            Registro inmutable de todas las acciones realizadas en la plataforma.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex-shrink-0 mt-1"
        >
          <RefreshCw className={`w-4 h-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar descripción o ID…"
                className="pl-8 h-8 text-sm"
              />
            </div>
            <Select value={filterEntityType} onValueChange={v => { setFilterEntityType(v); setPage(0); }}>
              <SelectTrigger className="w-44 h-8 text-sm">
                <SelectValue placeholder="Tipo de entidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {entityTypes.map(e => (
                  <SelectItem key={e} value={e}>{ENTITY_LABELS[e]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterActionType} onValueChange={v => { setFilterActionType(v); setPage(0); }}>
              <SelectTrigger className="w-40 h-8 text-sm">
                <SelectValue placeholder="Acción" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las acciones</SelectItem>
                <SelectItem value="create">Creado</SelectItem>
                <SelectItem value="update">Actualizado</SelectItem>
                <SelectItem value="delete">Eliminado</SelectItem>
                <SelectItem value="reorder">Reordenado</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={filterUser}
              onChange={e => setFilterUser(e.target.value)}
              placeholder="Filtrar por usuario…"
              className="w-44 h-8 text-sm"
            />
            {(search || filterEntityType !== "all" || filterActionType !== "all" || filterUser) && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-slate-500"
                onClick={() => { setSearch(""); setFilterEntityType("all"); setFilterActionType("all"); setFilterUser(""); }}
              >
                Limpiar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-sm text-slate-500">
        <span className="font-medium text-slate-700">{filtered.length}</span> entradas
        {logs.length >= PAGE_SIZE && (
          <span className="text-slate-400">(mostrando últimas {logs.length})</span>
        )}
      </div>

      {/* Log entries */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-slate-400">Cargando registros…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <Activity className="w-10 h-10 mx-auto mb-3 text-slate-200" />
            <p>No se encontraron registros con los filtros actuales.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(log => (
              <LogRow key={log.id} log={log} />
            ))}
          </div>
        )}
      </Card>

      {/* Load more */}
      {logs.length >= PAGE_SIZE && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => setPage(p => p + 1)}
            disabled={isFetching}
          >
            {isFetching ? "Cargando…" : "Cargar más"}
          </Button>
        </div>
      )}
    </div>
  );
}
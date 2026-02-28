// ArtsSubmissions — Admin view for arts form submission audit trail
// 2026-02-28: Created as part of arts submission tracking feature
// Reads from ArtsSubmissionLog entity, grouped by event with search/filter

import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/utils/i18n";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Palette, Search, User, Clock, FileText, ChevronDown, ChevronRight } from "lucide-react";

// ART_TYPE display labels (bilingual)
const ART_TYPE_LABELS = { DANCE: 'Danza', DRAMA: 'Drama', VIDEO: 'Video', OTHER: 'Otro' };

function SubmissionRow({ log, language }) {
  const [expanded, setExpanded] = useState(false);
  const date = log.submitted_at ? new Date(log.submitted_at) : null;
  const changedCount = log.fields_changed?.length || 0;

  return (
    <div className="border border-gray-200 rounded-lg bg-white hover:border-gray-300 transition-colors">
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-gray-900 truncate">{log.segment_title || 'Segment'}</span>
            {changedCount > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {changedCount} {language === 'es' ? 'cambios' : 'changes'}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
            <span className="flex items-center gap-1"><User className="w-3 h-3" />{log.submitter_name}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{date ? date.toLocaleDateString(language === 'es' ? 'es-US' : 'en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-3">
          {/* Submitter info */}
          <div className="text-xs text-gray-500">
            <span className="font-medium">{language === 'es' ? 'Email' : 'Email'}:</span> {log.submitter_email || '—'}
          </div>

          {/* Changed fields */}
          {log.fields_changed?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">{language === 'es' ? 'Campos modificados' : 'Fields changed'}:</p>
              <div className="flex flex-wrap gap-1">
                {log.fields_changed.map(f => (
                  <Badge key={f} variant="secondary" className="text-[10px]">{f}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Data snapshot preview */}
          {log.data_snapshot && (
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">{language === 'es' ? 'Datos enviados' : 'Submitted data'}:</p>
              <div className="bg-gray-50 rounded-md p-2 text-xs text-gray-700 max-h-48 overflow-auto">
                {/* Show art_types if present */}
                {log.data_snapshot.art_types && (
                  <p><span className="font-medium">Art types:</span> {log.data_snapshot.art_types.map(t => ART_TYPE_LABELS[t] || t).join(', ')}</p>
                )}
                {/* Show key fields inline */}
                {log.data_snapshot.drama_song_title && <p><span className="font-medium">Drama song:</span> {log.data_snapshot.drama_song_title}</p>}
                {log.data_snapshot.dance_song_title && <p><span className="font-medium">Dance song:</span> {log.data_snapshot.dance_song_title}</p>}
                {log.data_snapshot.arts_run_of_show_url && <p><span className="font-medium">Run of show:</span> <a href={log.data_snapshot.arts_run_of_show_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline truncate">{log.data_snapshot.arts_run_of_show_url}</a></p>}
                {log.data_snapshot.art_other_description && <p><span className="font-medium">Other:</span> {log.data_snapshot.art_other_description}</p>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ArtsSubmissions() {
  const { language, t } = useLanguage();
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState('all');

  // Fetch all submission logs (most recent first)
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['artsSubmissionLogs'],
    queryFn: () => base44.entities.ArtsSubmissionLog.list('-submitted_at', 200),
  });

  // Fetch events for filter dropdown
  const { data: events = [] } = useQuery({
    queryKey: ['events-for-arts-filter'],
    queryFn: () => base44.entities.Event.list('-created_date', 50),
  });

  // Filter + search
  const filtered = useMemo(() => {
    let result = logs;
    if (eventFilter !== 'all') {
      result = result.filter(l => l.event_id === eventFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        (l.submitter_name || '').toLowerCase().includes(q) ||
        (l.submitter_email || '').toLowerCase().includes(q) ||
        (l.segment_title || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [logs, eventFilter, search]);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center brand-gradient">
            <Palette className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl tracking-wider">
              {language === 'es' ? 'ENVÍOS DE ARTES' : 'ARTS SUBMISSIONS'}
            </h1>
            <p className="text-sm text-gray-500">
              {language === 'es' ? 'Historial de envíos del formulario de artes' : 'Arts form submission audit trail'}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder={language === 'es' ? 'Buscar por nombre, email o segmento...' : 'Search by name, email, or segment...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder={language === 'es' ? 'Filtrar por evento' : 'Filter by event'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{language === 'es' ? 'Todos los eventos' : 'All events'}</SelectItem>
            {events.map(ev => (
              <SelectItem key={ev.id} value={ev.id}>{ev.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" />{filtered.length} {language === 'es' ? 'envíos' : 'submissions'}</span>
        {eventFilter !== 'all' && (
          <button onClick={() => setEventFilter('all')} className="text-blue-600 underline">
            {language === 'es' ? 'Limpiar filtro' : 'Clear filter'}
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <Palette className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">{language === 'es' ? 'Sin envíos' : 'No submissions'}</p>
            <p className="text-sm mt-1">{language === 'es' ? 'Los envíos del formulario público de artes aparecerán aquí' : 'Public arts form submissions will appear here'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(log => (
            <SubmissionRow key={log.id} log={log} language={language} />
          ))}
        </div>
      )}
    </div>
  );
}
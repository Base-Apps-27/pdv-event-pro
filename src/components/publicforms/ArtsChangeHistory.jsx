/**
 * ArtsChangeHistory.jsx
 * 2026-02-28: Collapsible panel showing recent submission activity for the event.
 * Helps admins and collaborators see who changed what recently.
 * 
 * Fetches from getArtsChangeHistory backend function on first expand.
 * Displays: who, when, which segment, which fields changed.
 */
import React, { useState, useCallback } from 'react';
import { ChevronDown, Clock, User, FileText } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { usePublicLang } from './PublicFormLangContext';

/** Human-friendly field name map (bilingual) */
const FIELD_LABELS = {
  art_types: { es: 'Tipos de arte', en: 'Art types' },
  arts_type_order: { es: 'Orden de presentación', en: 'Performance order' },
  dance_start_cue: { es: 'Cue inicio (danza)', en: 'Start cue (dance)' },
  dance_end_cue: { es: 'Cue fin (danza)', en: 'End cue (dance)' },
  dance_song_title: { es: 'Canción danza', en: 'Dance song' },
  dance_song_source: { es: 'Enlace canción danza', en: 'Dance song link' },
  drama_start_cue: { es: 'Cue inicio (drama)', en: 'Start cue (drama)' },
  drama_end_cue: { es: 'Cue fin (drama)', en: 'End cue (drama)' },
  drama_song_title: { es: 'Canción drama', en: 'Drama song' },
  video_name: { es: 'Nombre del video', en: 'Video name' },
  video_url: { es: 'Enlace del video', en: 'Video link' },
  video_location: { es: 'Ubicación del video', en: 'Video location' },
  spoken_word_speaker: { es: 'Orador', en: 'Speaker' },
  spoken_word_description: { es: 'Descripción spoken word', en: 'Spoken word description' },
  painting_canvas_size: { es: 'Tamaño lienzo', en: 'Canvas size' },
  arts_run_of_show_url: { es: 'Guía de artes', en: 'Arts directions' },
  description_details: { es: 'Notas', en: 'Notes' },
};

function formatFieldName(field, lang) {
  const label = FIELD_LABELS[field];
  if (label) return label[lang] || label.en;
  // Fallback: humanize the field name
  return field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function timeAgo(dateStr, lang) {
  if (!dateStr) return '';
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return lang === 'es' ? 'Justo ahora' : 'Just now';
  if (diffMin < 60) return lang === 'es' ? `hace ${diffMin} min` : `${diffMin}m ago`;
  if (diffHr < 24) return lang === 'es' ? `hace ${diffHr}h` : `${diffHr}h ago`;
  if (diffDay < 7) return lang === 'es' ? `hace ${diffDay}d` : `${diffDay}d ago`;
  return then.toLocaleDateString(lang === 'es' ? 'es' : 'en', { month: 'short', day: 'numeric' });
}

export default function ArtsChangeHistory({ eventId }) {
  const { t, lang } = usePublicLang();
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadHistory = useCallback(async () => {
    if (history !== null) return; // Already loaded
    setLoading(true);
    setError(null);
    const res = await base44.functions.invoke('getArtsChangeHistory', { event_id: eventId });
    if (res.data?.error) {
      setError(res.data.error);
    } else {
      setHistory(res.data?.history || []);
    }
    setLoading(false);
  }, [eventId, history]);

  const handleToggle = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen) {
      loadHistory();
      base44.analytics.track({ eventName: 'arts_history_opened', properties: { event_id: eventId } });
    }
  };

  // Refresh button handler
  const handleRefresh = async () => {
    setHistory(null); // Force reload
    setLoading(true);
    setError(null);
    const res = await base44.functions.invoke('getArtsChangeHistory', { event_id: eventId });
    if (res.data?.error) {
      setError(res.data.error);
    } else {
      setHistory(res.data?.history || []);
    }
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-4">
      {/* Toggle header */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-700">
            {t('Historial de Cambios', 'Change History')}
          </span>
          {history && history.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">
              {history.length}
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Body */}
      {isOpen && (
        <div className="border-t border-gray-100 px-4 py-3">
          {/* Refresh bar */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">
              {t('Últimos cambios del evento', 'Recent event changes')}
            </p>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="text-[10px] text-[#1F8A70] font-semibold hover:underline disabled:opacity-50"
            >
              {loading ? t('Cargando...', 'Loading...') : t('Actualizar', 'Refresh')}
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-600 mb-2">{error}</p>
          )}

          {loading && !history && (
            <div className="text-center py-4">
              <div className="animate-spin w-5 h-5 border-2 border-[#1F8A70] border-t-transparent rounded-full mx-auto" />
            </div>
          )}

          {history && history.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">
              {t('No hay cambios registrados aún.', 'No changes recorded yet.')}
            </p>
          )}

          {history && history.length > 0 && (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {history.map((entry) => (
                <div key={entry.id} className="flex gap-2.5 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="w-7 h-7 rounded-full bg-[#1F8A70]/10 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5 text-[#1F8A70]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-semibold text-gray-800 truncate">
                        {entry.submitter_name}
                      </span>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap shrink-0">
                        {timeAgo(entry.submitted_at, lang)}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      <FileText className="w-3 h-3 inline mr-0.5 -mt-0.5" />
                      {entry.segment_title}
                    </p>
                    {entry.fields_changed.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {entry.fields_changed.slice(0, 5).map(f => (
                          <span key={f} className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                            {formatFieldName(f, lang)}
                          </span>
                        ))}
                        {entry.fields_changed.length > 5 && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                            +{entry.fields_changed.length - 5}
                          </span>
                        )}
                      </div>
                    )}
                    {entry.fields_changed.length === 0 && (
                      <span className="text-[9px] text-gray-400 italic mt-0.5 block">
                        {t('Sin cambios de datos', 'No data changes')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
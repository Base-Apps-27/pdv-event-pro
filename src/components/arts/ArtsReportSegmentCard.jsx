/**
 * ArtsReportSegmentCard.jsx
 * 2026-03-09: Print-optimized read-only card for a single arts segment.
 * Mirrors the public arts form structure (all sections expanded) but is
 * a rich, clean document — not a form UI.
 * Used by pages/ArtsReport.jsx.
 */
import React, { useMemo } from 'react';
import { formatTimeToEST } from '@/components/utils/timeFormat';

const TYPE_LABELS = {
  DANCE: '🩰 Danza',
  DRAMA: '🎭 Drama',
  VIDEO: '🎬 Video',
  SPOKEN_WORD: '🎤 Spoken Word',
  PAINTING: '🎨 Pintura',
  OTHER: '✨ Otro',
};

const TYPE_ACCENT = {
  DANCE: 'border-purple-400',
  DRAMA: 'border-red-400',
  VIDEO: 'border-blue-400',
  SPOKEN_WORD: 'border-amber-400',
  PAINTING: 'border-pink-400',
  OTHER: 'border-gray-400',
};

const TYPE_HEADER_BG = {
  DANCE: 'bg-purple-50 text-purple-900 print:bg-white',
  DRAMA: 'bg-red-50 text-red-900 print:bg-white',
  VIDEO: 'bg-blue-50 text-blue-900 print:bg-white',
  SPOKEN_WORD: 'bg-amber-50 text-amber-900 print:bg-white',
  PAINTING: 'bg-pink-50 text-pink-900 print:bg-white',
  OTHER: 'bg-gray-50 text-gray-900 print:bg-white',
};

// ── Primitives ──────────────────────────────────────────────────────────────

function Field({ label, value }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="mb-2">
      <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{label}</div>
      <div className="text-sm text-gray-900 whitespace-pre-wrap leading-snug">{value}</div>
    </div>
  );
}

function LinkField({ label, url }) {
  const urlStr = Array.isArray(url) ? url[0] : url;
  if (!urlStr) return null;
  return (
    <div className="mb-2">
      <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{label}</div>
      <a href={urlStr} target="_blank" rel="noopener noreferrer"
        className="text-sm text-[#1F8A70] underline break-all print:text-gray-700 print:no-underline">
        {urlStr}
      </a>
      {/* Print URL as text so it's readable when printed */}
      <span className="hidden print:inline text-[10px] text-gray-500 ml-1">↗</span>
    </div>
  );
}

function MicRow({ handheld, headset }) {
  if (!handheld && !headset) return null;
  return (
    <div className="flex gap-2 mb-2">
      {handheld > 0 && (
        <span className="text-xs font-semibold bg-gray-100 border border-gray-200 px-2.5 py-0.5 rounded-full print:border-gray-400">
          {handheld} Handheld
        </span>
      )}
      {headset > 0 && (
        <span className="text-xs font-semibold bg-gray-100 border border-gray-200 px-2.5 py-0.5 rounded-full print:border-gray-400">
          {headset} Headset
        </span>
      )}
    </div>
  );
}

function SongBlock({ num, title, url, owner }) {
  if (!title && !url && !owner) return null;
  const urlStr = Array.isArray(url) ? url[0] : url;
  return (
    <div className="border border-gray-200 rounded-lg p-3 mb-2 print:border-gray-400">
      <div className="text-[9px] font-bold text-[#1F8A70] uppercase tracking-widest mb-1.5">
        Canción / Song {num}
      </div>
      {title && <div className="text-sm font-semibold text-gray-900 mb-0.5">{title}</div>}
      {owner && <div className="text-xs text-gray-500">Responsable: {owner}</div>}
      {urlStr && (
        <a href={urlStr} target="_blank" rel="noopener noreferrer"
          className="text-xs text-[#1F8A70] underline break-all mt-1 block print:text-gray-600">
          {urlStr}
        </a>
      )}
    </div>
  );
}

// ── Per-type sections ────────────────────────────────────────────────────────

function DanceSection({ seg }) {
  const hasSongs = seg.dance_has_song !== false;
  return (
    <div className="space-y-1.5">
      <MicRow handheld={seg.dance_handheld_mics} headset={seg.dance_headset_mics} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cue de Inicio / Start Cue" value={seg.dance_start_cue} />
        <Field label="Cue de Fin / End Cue" value={seg.dance_end_cue} />
      </div>
      <Field label="Vestuario / Outfit Colors" value={seg.dance_outfit_colors} />
      <Field label="Artículos Especiales / Special Items" value={seg.dance_special_items} />
      {hasSongs && (
        <>
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest pt-1">
            Canciones / Songs
          </div>
          <SongBlock num={1} title={seg.dance_song_title} url={seg.dance_song_source} owner={seg.dance_song_owner} />
          <SongBlock num={2} title={seg.dance_song_2_title} url={seg.dance_song_2_url} owner={seg.dance_song_2_owner} />
          <SongBlock num={3} title={seg.dance_song_3_title} url={seg.dance_song_3_url} owner={seg.dance_song_3_owner} />
        </>
      )}
    </div>
  );
}

function DramaSection({ seg }) {
  return (
    <div className="space-y-1.5">
      <MicRow handheld={seg.drama_handheld_mics} headset={seg.drama_headset_mics} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cue de Inicio / Start Cue" value={seg.drama_start_cue} />
        <Field label="Cue de Fin / End Cue" value={seg.drama_end_cue} />
      </div>
      <Field label="Vestuario / Outfit Colors" value={seg.drama_outfit_colors} />
      <Field label="Artículos Especiales / Special Items" value={seg.drama_special_items} />
      {seg.drama_has_song && (
        <>
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest pt-1">
            Canciones / Songs
          </div>
          <SongBlock num={1} title={seg.drama_song_title} url={seg.drama_song_source} owner={seg.drama_song_owner} />
          <SongBlock num={2} title={seg.drama_song_2_title} url={seg.drama_song_2_url} owner={seg.drama_song_2_owner} />
          <SongBlock num={3} title={seg.drama_song_3_title} url={seg.drama_song_3_url} owner={seg.drama_song_3_owner} />
        </>
      )}
    </div>
  );
}

function formatDuration(secs) {
  if (!secs) return '';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function VideoSection({ seg }) {
  return (
    <div className="space-y-1.5">
      <Field label="Nombre del Video / Video Name" value={seg.video_name} />
      <LinkField label="Archivo / Video File" url={seg.video_url} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Duración / Duration" value={formatDuration(seg.video_length_sec)} />
        <Field label="Responsable / Owner" value={seg.video_owner} />
      </div>
      <Field label="Ubicación / Location" value={seg.video_location} />
    </div>
  );
}

const MIC_LABELS = {
  headset: 'Headset',
  handheld: 'Handheld',
  stand: 'Atril / On a Stand',
  off_stage: 'Fuera del Escenario / Off Stage',
  lapel: 'Lapel',
  podium: 'Podio / Podium',
};

function SpokenWordSection({ seg }) {
  return (
    <div className="space-y-1.5">
      <Field label="Orador / Speaker" value={seg.spoken_word_speaker} />
      <Field label="Descripción / Piece Title" value={seg.spoken_word_description} />
      <Field label="Posición del Micrófono / Mic" value={MIC_LABELS[seg.spoken_word_mic_position] || seg.spoken_word_mic_position} />
      <Field label="Vestuario / Outfit Colors" value={seg.spoken_word_outfit_colors} />
      <Field label="Artículos Especiales / Special Items" value={seg.spoken_word_special_items} />
      <LinkField label="Guión / Script" url={seg.spoken_word_script_url} />
      <LinkField label="Audio" url={seg.spoken_word_audio_url} />
      {seg.spoken_word_has_music && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 print:bg-white print:border-amber-400">
          <div className="text-[9px] font-bold text-amber-700 uppercase tracking-widest mb-1.5">
            Música de Fondo / Background Music
          </div>
          <Field label="Track" value={seg.spoken_word_music_title} />
          <Field label="Responsable" value={seg.spoken_word_music_owner} />
          <LinkField label="Archivo" url={seg.spoken_word_music_url} />
        </div>
      )}
      <Field label="Notas / Notes" value={seg.spoken_word_notes} />
    </div>
  );
}

function PaintingSection({ seg }) {
  const needs = [
    seg.painting_needs_easel && 'Caballete / Easel',
    seg.painting_needs_drop_cloth && 'Protección de piso / Drop Cloth',
    seg.painting_needs_lighting && 'Iluminación especial / Special Lighting',
  ].filter(Boolean);
  return (
    <div className="space-y-1.5">
      {needs.length > 0 && (
        <div className="mb-2">
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
            Necesidades / Needs
          </div>
          <div className="flex flex-wrap gap-1.5">
            {needs.map(n => (
              <span key={n} className="text-xs bg-pink-50 border border-pink-300 px-2.5 py-0.5 rounded-full print:bg-white">
                ✓ {n}
              </span>
            ))}
          </div>
        </div>
      )}
      <Field label="Tamaño del Lienzo / Canvas Size" value={seg.painting_canvas_size} />
      <Field label="Otros Requisitos / Other Setup" value={seg.painting_other_setup} />
      <Field label="Notas / Notes" value={seg.painting_notes} />
    </div>
  );
}

function OtherSection({ seg }) {
  return <Field label="Descripción / Description" value={seg.art_other_description} />;
}

const TYPE_RENDERERS = {
  DANCE: DanceSection,
  DRAMA: DramaSection,
  VIDEO: VideoSection,
  SPOKEN_WORD: SpokenWordSection,
  PAINTING: PaintingSection,
  OTHER: OtherSection,
};

// ── Main card ────────────────────────────────────────────────────────────────

export default function ArtsReportSegmentCard({ seg, sessionName }) {
  const types = seg.art_types || [];
  if (types.length === 0) return null;

  // Respect the arts_type_order for sequencing
  const orderedTypes = React.useMemo(() => {
    if (!seg.arts_type_order || seg.arts_type_order.length === 0) return types;
    const orderMap = {};
    seg.arts_type_order.forEach(o => { orderMap[o.type] = o.order ?? 99; });
    return [...types].sort((a, b) => (orderMap[a] ?? 99) - (orderMap[b] ?? 99));
  }, [types, seg.arts_type_order]);

  const submittedAt = seg.arts_last_submitted_at
    ? new Date(seg.arts_last_submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6 print:mb-5 print:border-gray-500 print:rounded-none print:shadow-none">
      {/* ── Header ── */}
      <div className="brand-gradient p-4 print:bg-gray-800">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-lg leading-tight print:text-white">{seg.title}</h3>
            <div className="text-white/75 text-xs mt-0.5 flex flex-wrap gap-2">
              {sessionName && <span>{sessionName}</span>}
              {seg.start_time && <span>· {formatTimeToEST(seg.start_time)}</span>}
              {seg.presenter && <span>· {seg.presenter}</span>}
            </div>
          </div>
        </div>
        {/* Art type badges in performance order */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {orderedTypes.map((tp, idx) => (
            <span key={tp} className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-semibold print:bg-transparent print:border print:border-white print:text-white">
              {idx + 1}. {TYPE_LABELS[tp] || tp}
            </span>
          ))}
        </div>
      </div>

      {/* ── Submission meta ── */}
      {(seg.arts_last_submitted_by || submittedAt) && (
        <div className="bg-gray-50 border-b border-gray-100 px-4 py-2 flex flex-wrap gap-4 text-xs text-gray-500 print:bg-white print:border-gray-300">
          {seg.arts_last_submitted_by && (
            <span>Enviado por / Submitted by: <strong className="text-gray-700">{seg.arts_last_submitted_by}</strong></span>
          )}
          {submittedAt && <span>{submittedAt}</span>}
        </div>
      )}

      {/* ── Per-type sections ── */}
      <div className="p-4 space-y-4">
        {orderedTypes.map(tp => {
          const Renderer = TYPE_RENDERERS[tp];
          if (!Renderer) return null;
          return (
            <div key={tp} className={`border-l-4 ${TYPE_ACCENT[tp] || 'border-gray-300'} rounded-r-lg overflow-hidden`}>
              <div className={`px-3 py-2 text-xs font-bold uppercase tracking-wider ${TYPE_HEADER_BG[tp] || 'bg-gray-50 text-gray-900'}`}>
                {TYPE_LABELS[tp] || tp}
              </div>
              <div className="px-3 pt-2 pb-3">
                <Renderer seg={seg} />
              </div>
            </div>
          );
        })}

        {/* ── Common: Run of Show + Notes ── */}
        {(seg.arts_run_of_show_url || seg.description_details) && (
          <div className="border-t border-gray-100 pt-3">
            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">
              📋 Guía General & Notas / Run of Show & Notes
            </div>
            <LinkField label="Guía Final / Run of Show" url={seg.arts_run_of_show_url} />
            <Field label="Notas Adicionales / Additional Notes" value={seg.description_details} />
          </div>
        )}
      </div>
    </div>
  );
}
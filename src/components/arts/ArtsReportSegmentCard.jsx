/**
 * ArtsReportSegmentCard.jsx
 * 2026-03-09: Print-optimized read-only card for a single arts segment.
 * Design goal: dense reference document, not a form UI.
 * 
 * Key decisions:
 * - Skip ALL empty fields (no blank song boxes, no empty labels)
 * - URLs rendered as short "↗ Link" anchors — no URL wrapping
 * - Bilingual labels condensed to single line (ES / EN)
 * - Tight spacing throughout for print density
 */
import React, { useMemo } from 'react';
import { formatTimeToEST } from '@/components/utils/timeFormat';

const TYPE_LABELS = {
  DANCE: 'Danza',
  DRAMA: 'Drama',
  VIDEO: 'Video',
  SPOKEN_WORD: 'Spoken Word',
  PAINTING: 'Pintura',
  OTHER: 'Otro',
};

const TYPE_ACCENT = {
  DANCE: 'border-purple-500 bg-purple-50',
  DRAMA: 'border-red-500 bg-red-50',
  VIDEO: 'border-blue-500 bg-blue-50',
  SPOKEN_WORD: 'border-amber-500 bg-amber-50',
  PAINTING: 'border-pink-500 bg-pink-50',
  OTHER: 'border-gray-400 bg-gray-50',
};

const TYPE_LABEL_COLOR = {
  DANCE: 'text-purple-800',
  DRAMA: 'text-red-800',
  VIDEO: 'text-blue-800',
  SPOKEN_WORD: 'text-amber-800',
  PAINTING: 'text-pink-800',
  OTHER: 'text-gray-700',
};

// ── Primitive helpers ────────────────────────────────────────────────────────

/** Renders nothing if value is empty */
function Row({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex gap-2 text-sm leading-snug mb-1">
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide shrink-0 pt-px w-28">{label}</span>
      <span className="text-gray-900 flex-1">{value}</span>
    </div>
  );
}

/** Compact URL link — shows a short label, hides the raw URL */
function LinkRow({ label, url }) {
  const urlStr = Array.isArray(url) ? url[0] : url;
  if (!urlStr) return null;
  // Derive a short display name from the URL
  let display = '↗ Ver archivo';
  try {
    const u = new URL(urlStr);
    const filename = u.pathname.split('/').pop();
    if (filename && filename.length > 0 && filename.length < 60) {
      // Strip long hash prefixes (e.g. "263d4e2b5_StagePositions...")
      display = '↗ ' + filename.replace(/^[a-f0-9]{6,}_/, '');
    }
  } catch {}
  return (
    <div className="flex gap-2 text-sm leading-snug mb-1">
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide shrink-0 pt-px w-28">{label}</span>
      <a href={urlStr} target="_blank" rel="noopener noreferrer"
        className="text-[#1F8A70] underline truncate max-w-xs print:text-gray-700 print:no-underline">
        {display}
      </a>
    </div>
  );
}

function CuePair({ startCue, endCue }) {
  if (!startCue && !endCue) return null;
  return (
    <div className="grid grid-cols-2 gap-3 mb-1">
      {startCue && (
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Cue inicio</div>
          <div className="text-sm text-gray-900 leading-snug">{startCue}</div>
        </div>
      )}
      {endCue && (
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Cue fin</div>
          <div className="text-sm text-gray-900 leading-snug">{endCue}</div>
        </div>
      )}
    </div>
  );
}

function MicBadges({ handheld, headset }) {
  if (!handheld && !headset) return null;
  return (
    <div className="flex gap-1.5 mb-1.5 flex-wrap">
      {handheld > 0 && (
        <span className="text-xs font-semibold bg-white border border-gray-300 px-2 py-0.5 rounded-full">
          🎤 {handheld} handheld
        </span>
      )}
      {headset > 0 && (
        <span className="text-xs font-semibold bg-white border border-gray-300 px-2 py-0.5 rounded-full">
          🎧 {headset} headset
        </span>
      )}
    </div>
  );
}

/** Only renders if the song has at least a title or URL */
function SongLine({ num, title, url, owner }) {
  const urlStr = Array.isArray(url) ? url[0] : url;
  if (!title && !urlStr && !owner) return null;
  return (
    <div className="flex items-baseline gap-2 text-sm mb-0.5">
      <span className="text-[10px] font-bold text-gray-400 uppercase w-12 shrink-0">#{num}</span>
      {title && <span className="font-medium text-gray-900">{title}</span>}
      {owner && <span className="text-gray-500 text-xs">· {owner}</span>}
      {urlStr && (
        <a href={urlStr} target="_blank" rel="noopener noreferrer"
          className="text-[#1F8A70] text-xs underline ml-auto print:text-gray-600">↗</a>
      )}
    </div>
  );
}

function SongsBlock({ prefix, seg }) {
  const s1 = seg[`${prefix}_song_title`];
  const s1url = seg[`${prefix}_song_source`];
  const s1own = seg[`${prefix}_song_owner`];
  const s2 = seg[`${prefix}_song_2_title`];
  const s2url = seg[`${prefix}_song_2_url`];
  const s2own = seg[`${prefix}_song_2_owner`];
  const s3 = seg[`${prefix}_song_3_title`];
  const s3url = seg[`${prefix}_song_3_url`];
  const s3own = seg[`${prefix}_song_3_owner`];
  const hasAny = s1 || s1url || s2 || s2url || s3 || s3url;
  if (!hasAny) return null;
  return (
    <div className="mt-1.5">
      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Canciones</div>
      <SongLine num={1} title={s1} url={s1url} owner={s1own} />
      <SongLine num={2} title={s2} url={s2url} owner={s2own} />
      <SongLine num={3} title={s3} url={s3url} owner={s3own} />
    </div>
  );
}

// ── Per-type sections ────────────────────────────────────────────────────────

function DanceSection({ seg }) {
  return (
    <>
      <MicBadges handheld={seg.dance_handheld_mics} headset={seg.dance_headset_mics} />
      <CuePair startCue={seg.dance_start_cue} endCue={seg.dance_end_cue} />
      <Row label="Vestuario" value={seg.dance_outfit_colors} />
      <Row label="Artículos esp." value={seg.dance_special_items} />
      {seg.dance_has_song !== false && <SongsBlock prefix="dance" seg={seg} />}
    </>
  );
}

function DramaSection({ seg }) {
  return (
    <>
      <MicBadges handheld={seg.drama_handheld_mics} headset={seg.drama_headset_mics} />
      <CuePair startCue={seg.drama_start_cue} endCue={seg.drama_end_cue} />
      <Row label="Vestuario" value={seg.drama_outfit_colors} />
      <Row label="Artículos esp." value={seg.drama_special_items} />
      {seg.drama_has_song && <SongsBlock prefix="drama" seg={seg} />}
    </>
  );
}

function formatDuration(secs) {
  if (!secs) return null;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function VideoSection({ seg }) {
  return (
    <>
      <Row label="Nombre" value={seg.video_name} />
      <LinkRow label="Archivo" url={seg.video_url} />
      <div className="flex gap-4">
        {formatDuration(seg.video_length_sec) && <Row label="Duración" value={formatDuration(seg.video_length_sec)} />}
        {seg.video_owner && <Row label="Responsable" value={seg.video_owner} />}
      </div>
      <Row label="Ubicación" value={seg.video_location} />
    </>
  );
}

const MIC_LABELS = {
  headset: 'Headset',
  handheld: 'Handheld',
  stand: 'Atril',
  off_stage: 'Fuera del escenario',
  lapel: 'Lapel',
  podium: 'Podio',
};

function SpokenWordSection({ seg }) {
  return (
    <>
      <Row label="Orador" value={seg.spoken_word_speaker} />
      <Row label="Pieza" value={seg.spoken_word_description} />
      <Row label="Micrófono" value={MIC_LABELS[seg.spoken_word_mic_position] || seg.spoken_word_mic_position} />
      <Row label="Vestuario" value={seg.spoken_word_outfit_colors} />
      <Row label="Artículos esp." value={seg.spoken_word_special_items} />
      <LinkRow label="Guión" url={seg.spoken_word_script_url} />
      <LinkRow label="Audio" url={seg.spoken_word_audio_url} />
      {seg.spoken_word_has_music && (
        <div className="mt-1.5 pl-2 border-l-2 border-amber-300">
          <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-1">Música de fondo</div>
          <Row label="Track" value={seg.spoken_word_music_title} />
          <Row label="Responsable" value={seg.spoken_word_music_owner} />
          <LinkRow label="Archivo" url={seg.spoken_word_music_url} />
        </div>
      )}
      <Row label="Notas" value={seg.spoken_word_notes} />
    </>
  );
}

function PaintingSection({ seg }) {
  const needs = [
    seg.painting_needs_easel && 'Caballete',
    seg.painting_needs_drop_cloth && 'Protección de piso',
    seg.painting_needs_lighting && 'Iluminación especial',
  ].filter(Boolean);
  return (
    <>
      {needs.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-1.5">
          {needs.map(n => (
            <span key={n} className="text-xs bg-white border border-pink-300 px-2 py-0.5 rounded-full">✓ {n}</span>
          ))}
        </div>
      )}
      <Row label="Lienzo" value={seg.painting_canvas_size} />
      <Row label="Montaje" value={seg.painting_other_setup} />
      <Row label="Notas" value={seg.painting_notes} />
    </>
  );
}

function OtherSection({ seg }) {
  return <Row label="Descripción" value={seg.art_other_description} />;
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

  const orderedTypes = useMemo(() => {
    if (!seg.arts_type_order || seg.arts_type_order.length === 0) return types;
    const orderMap = {};
    seg.arts_type_order.forEach(o => { orderMap[o.type] = o.order ?? 99; });
    return [...types].sort((a, b) => (orderMap[a] ?? 99) - (orderMap[b] ?? 99));
  }, [types, seg.arts_type_order]);

  const submittedAt = seg.arts_last_submitted_at
    ? new Date(seg.arts_last_submitted_at).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit'
      })
    : null;

  const runOfShowUrl = Array.isArray(seg.arts_run_of_show_url)
    ? seg.arts_run_of_show_url[0]
    : seg.arts_run_of_show_url;

  return (
    <div className="bg-white border border-gray-300 rounded-lg overflow-hidden mb-4 print:mb-3 print:rounded-none print:border-gray-600"
      style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>

      {/* ── Compact header ── */}
      <div className="brand-gradient px-4 py-2.5 print:bg-gray-800">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <span className="text-white font-bold text-base leading-tight">{seg.title}</span>
            <span className="text-white/70 text-xs ml-2">
              {sessionName && <>{sessionName}</>}
              {seg.start_time && <> · {formatTimeToEST(seg.start_time)}</>}
              {seg.presenter && <> · {seg.presenter}</>}
            </span>
          </div>
          {/* Art type sequence — compact pills */}
          <div className="flex gap-1 flex-wrap">
            {orderedTypes.map((tp, idx) => (
              <span key={tp} className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-semibold">
                {idx + 1}. {TYPE_LABELS[tp] || tp}
              </span>
            ))}
          </div>
        </div>
        {/* Submission meta — compact, single line */}
        {(seg.arts_last_submitted_by || submittedAt) && (
          <div className="text-white/60 text-[10px] mt-1">
            {seg.arts_last_submitted_by && <>Enviado por: {seg.arts_last_submitted_by}</>}
            {submittedAt && <> · {submittedAt}</>}
          </div>
        )}
      </div>

      {/* ── Per-type sections (side by side when 2 types, stacked otherwise) ── */}
      <div className={`p-3 ${orderedTypes.length >= 2 ? 'grid grid-cols-2 gap-3' : ''}`}>
        {orderedTypes.map(tp => {
          const Renderer = TYPE_RENDERERS[tp];
          if (!Renderer) return null;
          const accent = TYPE_ACCENT[tp] || 'border-gray-400 bg-gray-50';
          const labelColor = TYPE_LABEL_COLOR[tp] || 'text-gray-700';
          return (
            <div key={tp} className={`border-l-4 rounded-r-md ${accent} px-2.5 py-2`}
              style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
              <div className={`text-[10px] font-black uppercase tracking-widest mb-1.5 ${labelColor}`}>
                {TYPE_LABELS[tp] || tp}
              </div>
              <Renderer seg={seg} />
            </div>
          );
        })}
      </div>

      {/* ── Common footer: run of show link + description notes ── */}
      {(runOfShowUrl || seg.description_details) && (
        <div className="border-t border-gray-100 px-3 py-2 bg-gray-50 print:bg-white">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Notas generales</div>
          {runOfShowUrl && (
            <a href={runOfShowUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-[#1F8A70] underline mr-4 print:text-gray-600">
              ↗ Run of Show
            </a>
          )}
          {seg.description_details && (
            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-snug mt-1">{seg.description_details}</p>
          )}
        </div>
      )}
    </div>
  );
}
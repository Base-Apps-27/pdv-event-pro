/**
 * ArtsResourcesSection.jsx
 * 2026-02-28: Extracted component for displaying arts-specific resources in SegmentResourcesModal.
 * 
 * Hybrid approach: shows summary-card style info for each art type (key fields like
 * mics, cues, speaker name), PLUS clickable links for any attached files/URLs.
 * Organized by art type in the performance order (arts_type_order).
 * 
 * Props:
 *   segment - full Segment entity object
 *   language - 'es' | 'en'
 */
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Music, Video, FileText, ExternalLink, Play, User, Mic,
  ArrowRight, Palette, BookOpen
} from 'lucide-react';

const TYPE_LABELS = {
  DANCE: { es: '🩰 Danza', en: '🩰 Dance' },
  DRAMA: { es: '🎭 Drama', en: '🎭 Drama' },
  VIDEO: { es: '🎬 Video', en: '🎬 Video' },
  SPOKEN_WORD: { es: '🎤 Spoken Word', en: '🎤 Spoken Word' },
  PAINTING: { es: '🎨 Pintura', en: '🎨 Painting' },
  OTHER: { es: '✨ Otro', en: '✨ Other' },
};

function InfoRow({ label, value, icon }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start gap-2 text-xs">
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <span className="text-gray-500 shrink-0">{label}:</span>
      <span className="text-gray-800 font-medium break-words whitespace-pre-wrap">{value}</span>
    </div>
  );
}

function LinkRow({ label, url, type = 'link' }) {
  if (!url) return null;
  const icons = {
    song: <Music className="w-3.5 h-3.5 text-pink-600" />,
    video: <Video className="w-3.5 h-3.5 text-blue-600" />,
    pdf: <FileText className="w-3.5 h-3.5 text-red-600" />,
    audio: <Music className="w-3.5 h-3.5 text-purple-600" />,
    link: <ExternalLink className="w-3.5 h-3.5 text-gray-500" />,
  };
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 text-xs transition-colors">
      {icons[type] || icons.link}
      <span className="flex-1 text-gray-700 truncate">{label}</span>
      <Play className="w-3 h-3 text-gray-400 shrink-0" />
    </a>
  );
}

function DanceSection({ seg, lang }) {
  const es = lang === 'es';
  const mics = [];
  if (seg.dance_handheld_mics > 0) mics.push(`${seg.dance_handheld_mics} handheld`);
  if (seg.dance_headset_mics > 0) mics.push(`${seg.dance_headset_mics} headset`);

  // 2026-02-28: Show songs based on data presence, NOT the dance_has_song checkbox.
  // The checkbox may not be set even when song data was submitted via the public form.
  const songs = [
    { title: seg.dance_song_title, url: seg.dance_song_source, owner: seg.dance_song_owner },
    { title: seg.dance_song_2_title, url: seg.dance_song_2_url, owner: seg.dance_song_2_owner },
    { title: seg.dance_song_3_title, url: seg.dance_song_3_url, owner: seg.dance_song_3_owner },
  ].filter(s => s.title || s.url);

  return (
    <div className="space-y-1.5">
      {mics.length > 0 && <InfoRow label={es ? 'Micrófonos' : 'Mics'} value={mics.join(', ')} icon={<Mic className="w-3.5 h-3.5 text-gray-400" />} />}
      {seg.dance_start_cue && <InfoRow label={es ? 'Cue inicio' : 'Start cue'} value={seg.dance_start_cue} icon={<ArrowRight className="w-3.5 h-3.5 text-green-500" />} />}
      {seg.dance_end_cue && <InfoRow label={es ? 'Cue fin' : 'End cue'} value={seg.dance_end_cue} icon={<ArrowRight className="w-3.5 h-3.5 text-red-500" />} />}
      {songs.map((s, i) => s.url
        ? <LinkRow key={i} label={s.title || `${es ? 'Canción' : 'Song'} ${i + 1}`} url={s.url} type="song" />
        : <InfoRow key={i} label={`${es ? 'Canción' : 'Song'} ${i + 1}`} value={`${s.title}${s.owner ? ` — ${s.owner}` : ''}`} icon={<Music className="w-3.5 h-3.5 text-pink-600" />} />
      )}
    </div>
  );
}

function DramaSection({ seg, lang }) {
  const es = lang === 'es';
  const mics = [];
  if (seg.drama_handheld_mics > 0) mics.push(`${seg.drama_handheld_mics} handheld`);
  if (seg.drama_headset_mics > 0) mics.push(`${seg.drama_headset_mics} headset`);

  // 2026-02-28: Show songs based on data presence, NOT the drama_has_song checkbox.
  // The checkbox may not be set even when song data was submitted via the public form.
  const songs = [
    { title: seg.drama_song_title, url: seg.drama_song_source, owner: seg.drama_song_owner },
    { title: seg.drama_song_2_title, url: seg.drama_song_2_url, owner: seg.drama_song_2_owner },
    { title: seg.drama_song_3_title, url: seg.drama_song_3_url, owner: seg.drama_song_3_owner },
  ].filter(s => s.title || s.url);

  return (
    <div className="space-y-1.5">
      {mics.length > 0 && <InfoRow label={es ? 'Micrófonos' : 'Mics'} value={mics.join(', ')} icon={<Mic className="w-3.5 h-3.5 text-gray-400" />} />}
      {seg.drama_start_cue && <InfoRow label={es ? 'Cue inicio' : 'Start cue'} value={seg.drama_start_cue} icon={<ArrowRight className="w-3.5 h-3.5 text-green-500" />} />}
      {seg.drama_end_cue && <InfoRow label={es ? 'Cue fin' : 'End cue'} value={seg.drama_end_cue} icon={<ArrowRight className="w-3.5 h-3.5 text-red-500" />} />}
      {songs.map((s, i) => s.url
        ? <LinkRow key={i} label={s.title || `${es ? 'Canción' : 'Song'} ${i + 1}`} url={s.url} type="song" />
        : <InfoRow key={i} label={`${es ? 'Canción' : 'Song'} ${i + 1}`} value={`${s.title}${s.owner ? ` — ${s.owner}` : ''}`} icon={<Music className="w-3.5 h-3.5 text-pink-600" />} />
      )}
    </div>
  );
}

function VideoSection({ seg, lang }) {
  const es = lang === 'es';
  return (
    <div className="space-y-1.5">
      {seg.video_name && <InfoRow label={es ? 'Nombre' : 'Name'} value={seg.video_name} />}
      {seg.video_owner && <InfoRow label={es ? 'Responsable' : 'Owner'} value={seg.video_owner} icon={<User className="w-3.5 h-3.5 text-gray-400" />} />}
      {seg.video_location && <InfoRow label={es ? 'Ubicación' : 'Location'} value={seg.video_location} />}
      {seg.video_length_sec > 0 && <InfoRow label={es ? 'Duración' : 'Duration'} value={`${Math.floor(seg.video_length_sec / 60)}:${String(seg.video_length_sec % 60).padStart(2, '0')}`} />}
      <LinkRow label={seg.video_url_meta?.title || seg.video_name || 'Video'} url={seg.video_url} type="video" />
    </div>
  );
}

function SpokenWordSection({ seg, lang }) {
  const es = lang === 'es';
  const micLabels = { headset: 'Headset', handheld: 'Handheld', stand: es ? 'Atril' : 'Stand', off_stage: es ? 'Fuera del escenario' : 'Off Stage', lapel: 'Lapel', podium: es ? 'Podio' : 'Podium' };
  return (
    <div className="space-y-1.5">
      {seg.spoken_word_speaker && <InfoRow label={es ? 'Orador' : 'Speaker'} value={seg.spoken_word_speaker} icon={<User className="w-3.5 h-3.5 text-gray-400" />} />}
      {seg.spoken_word_description && <InfoRow label={es ? 'Pieza' : 'Piece'} value={seg.spoken_word_description} />}
      {seg.spoken_word_mic_position && <InfoRow label={es ? 'Micrófono' : 'Mic'} value={micLabels[seg.spoken_word_mic_position] || seg.spoken_word_mic_position} icon={<Mic className="w-3.5 h-3.5 text-gray-400" />} />}
      <LinkRow label={es ? 'Guión / Script' : 'Script'} url={seg.spoken_word_script_url} type="pdf" />
      <LinkRow label={es ? 'Audio del Spoken Word' : 'Spoken Word Audio'} url={seg.spoken_word_audio_url} type="audio" />
      {/* 2026-02-28: Show music based on data presence, NOT the spoken_word_has_music checkbox.
       * The checkbox may not be set even when music data was submitted. */}
      {(seg.spoken_word_music_title || seg.spoken_word_music_url) && (
        seg.spoken_word_music_url
          ? <LinkRow label={seg.spoken_word_music_title || (es ? 'Música de fondo' : 'Background Music')} url={seg.spoken_word_music_url} type="song" />
          : <InfoRow label={es ? 'Música' : 'Music'} value={`${seg.spoken_word_music_title}${seg.spoken_word_music_owner ? ` — ${seg.spoken_word_music_owner}` : ''}`} icon={<Music className="w-3.5 h-3.5 text-pink-600" />} />
      )}
      {seg.spoken_word_notes && <InfoRow label={es ? 'Notas' : 'Notes'} value={seg.spoken_word_notes} />}
    </div>
  );
}

function PaintingSection({ seg, lang }) {
  const es = lang === 'es';
  const needs = [];
  if (seg.painting_needs_easel) needs.push(es ? 'Caballete' : 'Easel');
  if (seg.painting_needs_drop_cloth) needs.push(es ? 'Protección de piso' : 'Drop Cloth');
  if (seg.painting_needs_lighting) needs.push(es ? 'Iluminación especial' : 'Special Lighting');

  return (
    <div className="space-y-1.5">
      {needs.length > 0 && <InfoRow label={es ? 'Necesita' : 'Needs'} value={needs.join(', ')} icon={<Palette className="w-3.5 h-3.5 text-gray-400" />} />}
      {seg.painting_canvas_size && <InfoRow label={es ? 'Lienzo' : 'Canvas'} value={seg.painting_canvas_size} />}
      {seg.painting_other_setup && <InfoRow label="Setup" value={seg.painting_other_setup} />}
      {seg.painting_notes && <InfoRow label={es ? 'Notas' : 'Notes'} value={seg.painting_notes} />}
    </div>
  );
}

function OtherSection({ seg, lang }) {
  if (!seg.art_other_description) return null;
  return (
    <div className="space-y-1.5">
      <InfoRow label={lang === 'es' ? 'Descripción' : 'Description'} value={seg.art_other_description} />
    </div>
  );
}

const TYPE_RENDERERS = {
  DANCE: DanceSection,
  DRAMA: DramaSection,
  VIDEO: VideoSection,
  SPOKEN_WORD: SpokenWordSection,
  PAINTING: PaintingSection,
  OTHER: OtherSection,
};

export default function ArtsResourcesSection({ segment, language = 'es' }) {
  if (!segment) return null;
  const artTypes = segment.art_types || [];
  if (artTypes.length === 0) return null;

  // Use arts_type_order for sequencing, fall back to art_types array order
  const orderedTypes = (() => {
    const savedOrder = segment.arts_type_order || [];
    if (savedOrder.length > 0) {
      const sorted = [...savedOrder]
        .filter(item => artTypes.includes(item.type))
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      // Append any types not in the saved order
      const existing = new Set(sorted.map(i => i.type));
      const extra = artTypes.filter(t => !existing.has(t));
      return [...sorted.map(i => i.type), ...extra];
    }
    return artTypes;
  })();

  const lang = language;
  const es = lang === 'es';

  return (
    <div className="space-y-3">
      {/* Section header with sequence indicator */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs font-semibold">
          🎭 {es ? 'Artes' : 'Arts'} ({orderedTypes.length})
        </Badge>
        {orderedTypes.length > 1 && (
          <span className="text-[10px] text-gray-400">
            {es ? 'En orden de presentación' : 'In performance order'}
          </span>
        )}
      </div>

      {orderedTypes.map((type, idx) => {
        const Renderer = TYPE_RENDERERS[type];
        if (!Renderer) return null;
        const typeLabel = TYPE_LABELS[type]?.[lang] || type;

        return (
          <div key={type} className="border border-gray-100 rounded-lg overflow-hidden">
            {/* Type header bar with sequence number */}
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
              {orderedTypes.length > 1 && (
                <span className="w-5 h-5 rounded-full bg-[#1F8A70] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
              )}
              <span className="text-xs font-semibold text-gray-700">{typeLabel}</span>
            </div>
            {/* Type content */}
            <div className="p-3">
              <Renderer seg={segment} lang={lang} />
            </div>
          </div>
        );
      })}

      {/* Run of show PDF — bottom of arts section */}
      {segment.arts_run_of_show_url && (
        <a href={segment.arts_run_of_show_url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2.5 bg-white rounded-lg border border-gray-200 hover:border-gray-300 text-xs transition-colors">
          <FileText className="w-4 h-4 text-red-600 shrink-0" />
          <span className="flex-1 text-gray-700">{es ? 'Guía de Artes (PDF)' : 'Arts Directions (PDF)'}</span>
          <Play className="w-3 h-3 text-gray-400 shrink-0" />
        </a>
      )}

      {/* Description/notes if present */}
      {segment.description_details && (
        <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2.5 border border-gray-100 whitespace-pre-wrap">
          <span className="font-semibold text-gray-600">{es ? 'Notas:' : 'Notes:'}</span> {segment.description_details}
        </div>
      )}
    </div>
  );
}
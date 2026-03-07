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

/**
 * 2026-03-07 FIX: Check if a URL field has actual content.
 * URL fields are schema type "array" — empty arrays [] are truthy in JS,
 * which caused songs to pass filters but render nothing (LinkRow returns null for []).
 * This helper properly checks for actual URL strings inside the value.
 */
function hasUrlContent(url) {
  if (Array.isArray(url)) return url.some(u => typeof u === 'string' && u.trim());
  return typeof url === 'string' && url.trim().length > 0;
}

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
  const urls = (Array.isArray(url) ? url : url.split(',')).map(u => u.trim()).filter(Boolean);
  if (urls.length === 0) return null;
  
  const icons = {
    song: <Music className="w-3.5 h-3.5 text-pink-600" />,
    video: <Video className="w-3.5 h-3.5 text-blue-600" />,
    pdf: <FileText className="w-3.5 h-3.5 text-red-600" />,
    audio: <Music className="w-3.5 h-3.5 text-purple-600" />,
    link: <ExternalLink className="w-3.5 h-3.5 text-gray-500" />,
  };
  
  return (
    <div className="space-y-1">
      {urls.map((u, i) => (
        <a key={i} href={u} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 text-xs transition-colors">
          {icons[type] || icons.link}
          <span className="flex-1 text-gray-700 truncate">{label}{urls.length > 1 ? ` (${i + 1})` : ''}</span>
          <Play className="w-3 h-3 text-gray-400 shrink-0" />
        </a>
      ))}
    </div>
  );
}

function DanceSection({ seg, lang }) {
  const es = lang === 'es';
  // 2026-03-07: Access segment fields safely from both root and data sub-object
  const getField = (field) => seg[field] !== undefined ? seg[field] : seg.data?.[field];

  const mics = [];
  if (getField('dance_handheld_mics') > 0) mics.push(`${getField('dance_handheld_mics')} handheld`);
  if (getField('dance_headset_mics') > 0) mics.push(`${getField('dance_headset_mics')} headset`);

  // 2026-03-07: New outfit/items fields
  const hasOutfitInfo = getField('dance_outfit_colors') || getField('dance_special_items');

  // 2026-02-28: Show songs based on data presence, NOT the dance_has_song checkbox.
  // The checkbox may not be set even when song data was submitted via the public form.
  // 2026-03-07 FIX: URL fields are schema type "array" — [] is truthy in JS.
  // Must check for actual URL content, not just truthiness, to avoid silent render failures.
  const songs = [
    { title: getField('dance_song_title'), url: getField('dance_song_source'), owner: getField('dance_song_owner') },
    { title: getField('dance_song_2_title'), url: getField('dance_song_2_url'), owner: getField('dance_song_2_owner') },
    { title: getField('dance_song_3_title'), url: getField('dance_song_3_url'), owner: getField('dance_song_3_owner') },
  ].filter(s => s.title || hasUrlContent(s.url));

  return (
    <div className="space-y-1.5">
      {mics.length > 0 && <InfoRow label={es ? 'Micrófonos' : 'Mics'} value={mics.join(', ')} icon={<Mic className="w-3.5 h-3.5 text-gray-400" />} />}
      {getField('dance_start_cue') && <InfoRow label={es ? 'Cue inicio' : 'Start cue'} value={getField('dance_start_cue')} icon={<ArrowRight className="w-3.5 h-3.5 text-green-500" />} />}
      {getField('dance_end_cue') && <InfoRow label={es ? 'Cue fin' : 'End cue'} value={getField('dance_end_cue')} icon={<ArrowRight className="w-3.5 h-3.5 text-red-500" />} />}
      {getField('dance_outfit_colors') && <InfoRow label={es ? 'Vestuario' : 'Outfit'} value={getField('dance_outfit_colors')} />}
      {getField('dance_special_items') && <InfoRow label={es ? 'Artículos especiales' : 'Special items'} value={getField('dance_special_items')} />}
      {songs.map((s, i) => hasUrlContent(s.url)
        ? <LinkRow key={i} label={s.title || `${es ? 'Canción' : 'Song'} ${i + 1}`} url={s.url} type="song" />
        : <InfoRow key={i} label={`${es ? 'Canción' : 'Song'} ${i + 1}`} value={`${s.title}${s.owner ? ` — ${s.owner}` : ''}`} icon={<Music className="w-3.5 h-3.5 text-pink-600" />} />
      )}
    </div>
  );
}

function DramaSection({ seg, lang }) {
  const es = lang === 'es';
  const getField = (field) => seg[field] !== undefined ? seg[field] : seg.data?.[field];

  const mics = [];
  if (getField('drama_handheld_mics') > 0) mics.push(`${getField('drama_handheld_mics')} handheld`);
  if (getField('drama_headset_mics') > 0) mics.push(`${getField('drama_headset_mics')} headset`);

  // 2026-03-07: New outfit/items fields
  const hasOutfitInfo = getField('drama_outfit_colors') || getField('drama_special_items');

  // 2026-02-28: Show songs based on data presence, NOT the drama_has_song checkbox.
  // 2026-03-07 FIX: Use hasUrlContent() — same empty-array fix as DanceSection.
  const songs = [
    { title: getField('drama_song_title'), url: getField('drama_song_source'), owner: getField('drama_song_owner') },
    { title: getField('drama_song_2_title'), url: getField('drama_song_2_url'), owner: getField('drama_song_2_owner') },
    { title: getField('drama_song_3_title'), url: getField('drama_song_3_url'), owner: getField('drama_song_3_owner') },
  ].filter(s => s.title || hasUrlContent(s.url));

  return (
    <div className="space-y-1.5">
      {mics.length > 0 && <InfoRow label={es ? 'Micrófonos' : 'Mics'} value={mics.join(', ')} icon={<Mic className="w-3.5 h-3.5 text-gray-400" />} />}
      {getField('drama_start_cue') && <InfoRow label={es ? 'Cue inicio' : 'Start cue'} value={getField('drama_start_cue')} icon={<ArrowRight className="w-3.5 h-3.5 text-green-500" />} />}
      {getField('drama_end_cue') && <InfoRow label={es ? 'Cue fin' : 'End cue'} value={getField('drama_end_cue')} icon={<ArrowRight className="w-3.5 h-3.5 text-red-500" />} />}
      {getField('drama_outfit_colors') && <InfoRow label={es ? 'Vestuario' : 'Outfit'} value={getField('drama_outfit_colors')} />}
      {getField('drama_special_items') && <InfoRow label={es ? 'Artículos especiales' : 'Special items'} value={getField('drama_special_items')} />}
      {songs.map((s, i) => hasUrlContent(s.url)
        ? <LinkRow key={i} label={s.title || `${es ? 'Canción' : 'Song'} ${i + 1}`} url={s.url} type="song" />
        : <InfoRow key={i} label={`${es ? 'Canción' : 'Song'} ${i + 1}`} value={`${s.title}${s.owner ? ` — ${s.owner}` : ''}`} icon={<Music className="w-3.5 h-3.5 text-pink-600" />} />
      )}
    </div>
  );
}

function VideoSection({ seg, lang }) {
  const es = lang === 'es';
  const getField = (field) => seg[field] !== undefined ? seg[field] : seg.data?.[field];
  
  return (
    <div className="space-y-1.5">
      {getField('video_name') && <InfoRow label={es ? 'Nombre' : 'Name'} value={getField('video_name')} />}
      {getField('video_owner') && <InfoRow label={es ? 'Responsable' : 'Owner'} value={getField('video_owner')} icon={<User className="w-3.5 h-3.5 text-gray-400" />} />}
      {getField('video_location') && <InfoRow label={es ? 'Ubicación' : 'Location'} value={getField('video_location')} />}
      {getField('video_length_sec') > 0 && <InfoRow label={es ? 'Duración' : 'Duration'} value={`${Math.floor(getField('video_length_sec') / 60)}:${String(getField('video_length_sec') % 60).padStart(2, '0')}`} />}
      <LinkRow label={getField('video_url_meta')?.title || getField('video_name') || 'Video'} url={getField('video_url')} type="video" />
    </div>
  );
}

function SpokenWordSection({ seg, lang }) {
  const es = lang === 'es';
  const getField = (field) => seg[field] !== undefined ? seg[field] : seg.data?.[field];
  
  const micLabels = { headset: 'Headset', handheld: 'Handheld', stand: es ? 'Atril' : 'Stand', off_stage: es ? 'Fuera del escenario' : 'Off Stage', lapel: 'Lapel', podium: es ? 'Podio' : 'Podium' };
  return (
    <div className="space-y-1.5">
      {getField('spoken_word_speaker') && <InfoRow label={es ? 'Orador' : 'Speaker'} value={getField('spoken_word_speaker')} icon={<User className="w-3.5 h-3.5 text-gray-400" />} />}
      {getField('spoken_word_description') && <InfoRow label={es ? 'Pieza' : 'Piece'} value={getField('spoken_word_description')} />}
      {getField('spoken_word_mic_position') && <InfoRow label={es ? 'Micrófono' : 'Mic'} value={micLabels[getField('spoken_word_mic_position')] || getField('spoken_word_mic_position')} icon={<Mic className="w-3.5 h-3.5 text-gray-400" />} />}
      {getField('spoken_word_outfit_colors') && <InfoRow label={es ? 'Vestuario' : 'Outfit'} value={getField('spoken_word_outfit_colors')} />}
      {getField('spoken_word_special_items') && <InfoRow label={es ? 'Artículos especiales' : 'Special items'} value={getField('spoken_word_special_items')} />}
      <LinkRow label={es ? 'Guión / Script' : 'Script'} url={getField('spoken_word_script_url')} type="pdf" />
      <LinkRow label={es ? 'Audio del Spoken Word' : 'Spoken Word Audio'} url={getField('spoken_word_audio_url')} type="audio" />
      {/* 2026-02-28: Show music based on data presence, NOT the spoken_word_has_music checkbox.
       * 2026-03-07 FIX: Use hasUrlContent() to avoid empty-array truthiness bug. */}
      {(getField('spoken_word_music_title') || hasUrlContent(getField('spoken_word_music_url'))) && (
        hasUrlContent(getField('spoken_word_music_url'))
          ? <LinkRow label={getField('spoken_word_music_title') || (es ? 'Música de fondo' : 'Background Music')} url={getField('spoken_word_music_url')} type="song" />
          : <InfoRow label={es ? 'Música' : 'Music'} value={`${getField('spoken_word_music_title')}${getField('spoken_word_music_owner') ? ` — ${getField('spoken_word_music_owner')}` : ''}`} icon={<Music className="w-3.5 h-3.5 text-pink-600" />} />
      )}
      {getField('spoken_word_notes') && <InfoRow label={es ? 'Notas' : 'Notes'} value={getField('spoken_word_notes')} />}
    </div>
  );
}

function PaintingSection({ seg, lang }) {
  const es = lang === 'es';
  const getField = (field) => seg[field] !== undefined ? seg[field] : seg.data?.[field];
  
  const needs = [];
  if (getField('painting_needs_easel')) needs.push(es ? 'Caballete' : 'Easel');
  if (getField('painting_needs_drop_cloth')) needs.push(es ? 'Protección de piso' : 'Drop Cloth');
  if (getField('painting_needs_lighting')) needs.push(es ? 'Iluminación especial' : 'Special Lighting');

  return (
    <div className="space-y-1.5">
      {needs.length > 0 && <InfoRow label={es ? 'Necesita' : 'Needs'} value={needs.join(', ')} icon={<Palette className="w-3.5 h-3.5 text-gray-400" />} />}
      {getField('painting_canvas_size') && <InfoRow label={es ? 'Lienzo' : 'Canvas'} value={getField('painting_canvas_size')} />}
      {getField('painting_other_setup') && <InfoRow label="Setup" value={getField('painting_other_setup')} />}
      {getField('painting_notes') && <InfoRow label={es ? 'Notas' : 'Notes'} value={getField('painting_notes')} />}
    </div>
  );
}

function OtherSection({ seg, lang }) {
  const getField = (field) => seg[field] !== undefined ? seg[field] : seg.data?.[field];
  
  if (!getField('art_other_description')) return null;
  return (
    <div className="space-y-1.5">
      <InfoRow label={lang === 'es' ? 'Descripción' : 'Description'} value={getField('art_other_description')} />
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
  // 2026-03-07: Handle both root-level and nested data.art_types
  const artTypes = segment.art_types || segment.data?.art_types || [];
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
      {(() => {
       const getField = (field) => segment[field] !== undefined ? segment[field] : segment.data?.[field];
       const artUrl = getField('arts_run_of_show_url');
       const urls = artUrl ? (Array.isArray(artUrl) ? artUrl : artUrl.split(',')) : [];
       return urls.map((u, i, arr) => u.trim() ? (
         <a key={i} href={u.trim()} target="_blank" rel="noopener noreferrer"
           className="flex items-center gap-2 px-3 py-2.5 bg-white rounded-lg border border-gray-200 hover:border-gray-300 text-xs transition-colors mb-1">
           <FileText className="w-4 h-4 text-red-600 shrink-0" />
           <span className="flex-1 text-gray-700">{es ? 'Guía de Artes (PDF)' : 'Arts Directions (PDF)'}{arr.length > 1 ? ` (${i + 1})` : ''}</span>
           <Play className="w-3 h-3 text-gray-400 shrink-0" />
         </a>
       ) : null);
      })()}

      {/* Description/notes if present */}
      {(() => {
       const getField = (field) => segment[field] !== undefined ? segment[field] : segment.data?.[field];
       const desc = getField('description_details');
       return desc ? (
         <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2.5 border border-gray-100 whitespace-pre-wrap">
           <span className="font-semibold text-gray-600">{es ? 'Notas:' : 'Notes:'}</span> {desc}
         </div>
       ) : null;
      })()}
    </div>
  );
}
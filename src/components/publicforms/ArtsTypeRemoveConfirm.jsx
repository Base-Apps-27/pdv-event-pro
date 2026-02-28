/**
 * ArtsTypeRemoveConfirm.jsx
 * 
 * Custom branded confirmation dialog for removing an art type that has filled data.
 * Replaces native window.confirm() per Public Form Protocol (no device dialogs).
 * 
 * 2026-02-28: Created to prevent accidental data loss when untoggling art types
 * that already have content entered. Mobile-first, bilingual, on-brand.
 */
import React from 'react';
import { usePublicLang } from './PublicFormLangContext';

const TYPE_LABELS = {
  DANCE: '🩰 Danza',
  DRAMA: '🎭 Drama',
  VIDEO: '🎬 Video',
  SPOKEN_WORD: '🎤 Spoken Word',
  PAINTING: '🎨 Pintura',
  OTHER: '✨ Otro'
};

export default function ArtsTypeRemoveConfirm({ artType, filledFieldCount, onConfirm, onCancel }) {
  const { t } = usePublicLang();
  const label = TYPE_LABELS[artType] || artType;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />
      
      {/* Dialog card */}
      <div
        className="relative bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95"
        onClick={e => e.stopPropagation()}
      >
        {/* Top accent bar */}
        <div className="h-1.5 bg-gradient-to-r from-amber-400 via-orange-400 to-red-400" />
        
        <div className="p-5 space-y-4">
          {/* Warning icon + heading */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <span className="text-lg">⚠️</span>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm" style={{ fontFamily: 'Inter, sans-serif', textTransform: 'none', letterSpacing: 'normal' }}>
                {t(`¿Quitar ${label}?`, `Remove ${label}?`)}
              </h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                {t(
                  `Hay ${filledFieldCount} campo${filledFieldCount > 1 ? 's' : ''} con información. Al quitar este tipo, los datos NO se borrarán automáticamente, pero la sección quedará oculta y no se guardará con el formulario.`,
                  `There ${filledFieldCount > 1 ? 'are' : 'is'} ${filledFieldCount} field${filledFieldCount > 1 ? 's' : ''} with content. Removing this type will hide the section and its data won't be included when you save.`
                )}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {t('Cancelar', 'Cancel')}
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
            >
              {t('Sí, quitar', 'Yes, remove')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * TYPE_FIELD_MAP: Maps each art type to the segment fields that belong to it.
 * Used to detect if a type has any filled data before allowing removal.
 * Must stay in sync with the Segment entity schema and submitArtsSegment allowlist.
 */
export const TYPE_FIELD_MAP = {
  DANCE: [
    'dance_has_song', 'dance_handheld_mics', 'dance_headset_mics',
    'dance_start_cue', 'dance_end_cue',
    'dance_song_title', 'dance_song_source', 'dance_song_owner',
    'dance_song_2_title', 'dance_song_2_url', 'dance_song_2_owner',
    'dance_song_3_title', 'dance_song_3_url', 'dance_song_3_owner',
  ],
  DRAMA: [
    'drama_has_song', 'drama_handheld_mics', 'drama_headset_mics',
    'drama_start_cue', 'drama_end_cue',
    'drama_song_title', 'drama_song_source', 'drama_song_owner',
    'drama_song_2_title', 'drama_song_2_url', 'drama_song_2_owner',
    'drama_song_3_title', 'drama_song_3_url', 'drama_song_3_owner',
  ],
  VIDEO: [
    'video_name', 'video_url', 'video_owner', 'video_length_sec', 'video_location',
  ],
  SPOKEN_WORD: [
    'spoken_word_speaker', 'spoken_word_description', 'spoken_word_mic_position',
    'spoken_word_has_music', 'spoken_word_music_title', 'spoken_word_music_url',
    'spoken_word_music_owner', 'spoken_word_notes',
    'spoken_word_script_url', 'spoken_word_audio_url',
  ],
  PAINTING: [
    'painting_needs_easel', 'painting_needs_drop_cloth', 'painting_needs_lighting',
    'painting_canvas_size', 'painting_other_setup', 'painting_notes',
  ],
  OTHER: [
    'art_other_description',
  ],
};

/**
 * Count how many fields for a given art type have non-empty values in the segment.
 * Returns 0 if no data exists (safe to remove without confirmation).
 */
export function countFilledFieldsForType(seg, artType) {
  const fields = TYPE_FIELD_MAP[artType] || [];
  let count = 0;
  for (const f of fields) {
    const v = seg[f];
    if (v === undefined || v === null || v === '' || v === false || v === 0) continue;
    count++;
  }
  return count;
}
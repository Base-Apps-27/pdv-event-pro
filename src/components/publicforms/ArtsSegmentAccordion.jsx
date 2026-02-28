/**
 * ArtsSegmentAccordion.jsx
 * 
 * Hybrid UX refactor (2026-02-28): Single accordion item for an arts segment.
 * Interior uses ArtsTypeSection collapsible sub-sections per art type instead of
 * one giant vertical stack. Reduces scroll-bomb on mobile. Save is handled externally
 * by ArtsStickyBar — the inline save button is removed.
 * 
 * CSP Migration origin (2026-02-27): Replaces inline JS accordion from serveArtsSubmission.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { usePublicLang } from './PublicFormLangContext';
import ArtsTypeSection from './ArtsTypeSection';
import ArtsTypeDance from './ArtsTypeDance';
import ArtsTypeDrama from './ArtsTypeDrama';
import ArtsTypeVideo from './ArtsTypeVideo';
import ArtsTypeSpokenWord from './ArtsTypeSpokenWord';
import ArtsTypePainting from './ArtsTypePainting';
import ArtsTypeOther from './ArtsTypeOther';
import CompactFileAttach from './CompactFileAttach';
import ArtsTypeOrderEditor from '@/components/session/ArtsTypeOrderEditor';

const TYPE_LABELS = { DANCE: '🩰 Danza', DRAMA: '🎭 Drama', VIDEO: '🎬 Video', SPOKEN_WORD: '🎤 Spoken Word', PAINTING: '🎨 Pintura', OTHER: '✨ Otro' };

/** Per-type status calculation for sub-section badges */
function calcTypeStatus(seg, type, t) {
  switch (type) {
    case 'DANCE': {
      const hasSong = !!(seg.dance_song_title || seg.dance_song_source);
      const hasCue = !!seg.dance_start_cue;
      if (hasSong && hasCue) return { level: 'complete', label: '✓' };
      if (hasSong || hasCue) return { level: 'partial', label: t('Parcial', 'Partial') };
      return { level: 'empty', label: '' };
    }
    case 'DRAMA': {
      const hasSong = !!(seg.drama_song_title || seg.drama_song_source);
      const hasCue = !!seg.drama_start_cue;
      const hasMics = (seg.drama_handheld_mics > 0) || (seg.drama_headset_mics > 0);
      if ((hasSong || !seg.drama_has_song) && hasCue && hasMics) return { level: 'complete', label: '✓' };
      if (hasSong || hasCue || hasMics) return { level: 'partial', label: t('Parcial', 'Partial') };
      return { level: 'empty', label: '' };
    }
    case 'VIDEO': {
      if (seg.video_url && seg.video_name) return { level: 'complete', label: '✓' };
      if (seg.video_url || seg.video_name) return { level: 'partial', label: t('Parcial', 'Partial') };
      return { level: 'empty', label: '' };
    }
    case 'SPOKEN_WORD': {
      const hasSpeaker = !!seg.spoken_word_speaker;
      const hasDesc = !!seg.spoken_word_description;
      if (hasSpeaker && hasDesc) return { level: 'complete', label: '✓' };
      if (hasSpeaker || hasDesc) return { level: 'partial', label: t('Parcial', 'Partial') };
      return { level: 'empty', label: '' };
    }
    case 'PAINTING': {
      const hasCanvas = !!seg.painting_canvas_size;
      const hasSetup = seg.painting_needs_easel || seg.painting_needs_drop_cloth || seg.painting_needs_lighting;
      if (hasCanvas) return { level: 'complete', label: '✓' };
      if (hasSetup) return { level: 'partial', label: t('Parcial', 'Partial') };
      return { level: 'empty', label: '' };
    }
    case 'OTHER': {
      if (seg.art_other_description) return { level: 'complete', label: '✓' };
      return { level: 'empty', label: '' };
    }
    default: return { level: 'empty', label: '' };
  }
}

/** Overall segment status (used in progress strip and header badge) */
export function calcSegmentStatus(seg) {
  const types = seg.art_types || [];
  if (types.length === 0) return { level: 'incomplete', label: '🔴' };
  const hasAnySong = !!(seg.dance_song_source || seg.drama_song_source || seg.dance_song_title || seg.drama_song_title);
  const hasVideoLink = !!seg.video_url;
  const hasRunOfShow = !!seg.arts_run_of_show_url;
  const hasSpokenWord = !!(seg.spoken_word_speaker || seg.spoken_word_description);
  const hasPainting = !!(seg.painting_canvas_size || seg.painting_needs_easel);
  const hasAnyAsset = hasAnySong || hasVideoLink || hasRunOfShow || hasSpokenWord || hasPainting;
  if (!hasAnyAsset && !seg.art_other_description) return { level: 'incomplete', label: '🔴' };
  // Check for completeness
  const missing = [];
  if (types.includes('DANCE') && !seg.dance_start_cue) missing.push('dance cue');
  if (types.includes('DRAMA') && !seg.drama_start_cue) missing.push('drama cue');
  if (types.includes('VIDEO') && !seg.video_url) missing.push('video');
  if (types.includes('SPOKEN_WORD') && !seg.spoken_word_speaker) missing.push('speaker');
  if (missing.length === 0) return { level: 'complete', label: '🟢' };
  return { level: 'minimum', label: '🟡' };
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export default function ArtsSegmentAccordion({ segment: initialSeg, submitterName, submitterEmail, isUnica, isOpen, onToggle, onSaveStateChange, onSegmentDataChange }) {
  const { t, lang } = usePublicLang();
  const [seg, setSeg] = useState({ ...initialSeg });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const touchedFieldsRef = useRef(new Set());

  // Ref to always hold the latest seg for save closure (fixes stale closure bug)
  const segRef = useRef(seg);
  useEffect(() => { segRef.current = seg; }, [seg]);

  // Propagate live data to parent for progress strip status calculation
  useEffect(() => {
    if (onSegmentDataChange) {
      onSegmentDataChange(seg.id, seg);
    }
  }, [seg, onSegmentDataChange]);

  const updateField = useCallback((field, value) => {
    setSeg(prev => ({ ...prev, [field]: value }));
    if (!touchedFieldsRef.current.has(field)) {
      touchedFieldsRef.current.add(field);
      base44.analytics.track({ eventName: 'arts_field_edited', properties: { segment_id: initialSeg.id, field_name: field } });
    }
  }, [initialSeg.id]);

  const toggleType = useCallback((type, checked) => {
    setSeg(prev => {
      const set = new Set(prev.art_types || []);
      if (checked) set.add(type); else set.delete(type);
      return { ...prev, art_types: Array.from(set) };
    });
    base44.analytics.track({ eventName: 'arts_type_toggled', properties: { segment_id: initialSeg.id, type, action: checked ? 'add' : 'remove' } });
  }, [initialSeg.id]);

  // handleSave reads from segRef.current to always get latest state (not stale closure)
  const handleSave = useCallback(async () => {
    const currentSeg = segRef.current; // always-fresh reference
    setSaving(true);
    setSaveMsg(null);
    const saveStart = Date.now();

    const payload = {
      segment_id: currentSeg.id,
      submitter_name: submitterName,
      submitter_email: submitterEmail,
      data: {
        art_types: currentSeg.art_types || [],
        dance_has_song: currentSeg.dance_has_song || false, dance_handheld_mics: currentSeg.dance_handheld_mics ?? '', dance_headset_mics: currentSeg.dance_headset_mics ?? '',
        dance_start_cue: currentSeg.dance_start_cue || '', dance_end_cue: currentSeg.dance_end_cue || '',
        dance_song_title: currentSeg.dance_song_title || '', dance_song_source: currentSeg.dance_song_source || '', dance_song_owner: currentSeg.dance_song_owner || '',
        dance_song_2_title: currentSeg.dance_song_2_title || '', dance_song_2_url: currentSeg.dance_song_2_url || '', dance_song_2_owner: currentSeg.dance_song_2_owner || '',
        dance_song_3_title: currentSeg.dance_song_3_title || '', dance_song_3_url: currentSeg.dance_song_3_url || '', dance_song_3_owner: currentSeg.dance_song_3_owner || '',
        drama_has_song: currentSeg.drama_has_song || false, drama_handheld_mics: currentSeg.drama_handheld_mics ?? '', drama_headset_mics: currentSeg.drama_headset_mics ?? '',
        drama_start_cue: currentSeg.drama_start_cue || '', drama_end_cue: currentSeg.drama_end_cue || '',
        drama_song_title: currentSeg.drama_song_title || '', drama_song_source: currentSeg.drama_song_source || '', drama_song_owner: currentSeg.drama_song_owner || '',
        drama_song_2_title: currentSeg.drama_song_2_title || '', drama_song_2_url: currentSeg.drama_song_2_url || '', drama_song_2_owner: currentSeg.drama_song_2_owner || '',
        drama_song_3_title: currentSeg.drama_song_3_title || '', drama_song_3_url: currentSeg.drama_song_3_url || '', drama_song_3_owner: currentSeg.drama_song_3_owner || '',
        has_video: (currentSeg.art_types || []).includes('VIDEO'), video_name: currentSeg.video_name || '', video_url: currentSeg.video_url || '',
        video_owner: currentSeg.video_owner || '', video_length_sec: currentSeg.video_length_sec ?? '', video_location: currentSeg.video_location || '',
        art_other_description: currentSeg.art_other_description || '', arts_run_of_show_url: currentSeg.arts_run_of_show_url || '',
        arts_type_order: currentSeg.arts_type_order || [],
        description_details: currentSeg.description_details || '',
        spoken_word_mic_position: currentSeg.spoken_word_mic_position || '', spoken_word_has_music: currentSeg.spoken_word_has_music || false,
        spoken_word_music_title: currentSeg.spoken_word_music_title || '', spoken_word_music_url: currentSeg.spoken_word_music_url || '',
        spoken_word_music_owner: currentSeg.spoken_word_music_owner || '', spoken_word_notes: currentSeg.spoken_word_notes || '',
        spoken_word_description: currentSeg.spoken_word_description || '', spoken_word_speaker: currentSeg.spoken_word_speaker || '',
        spoken_word_script_url: currentSeg.spoken_word_script_url || '', spoken_word_audio_url: currentSeg.spoken_word_audio_url || '',
        painting_needs_easel: currentSeg.painting_needs_easel || false, painting_needs_drop_cloth: currentSeg.painting_needs_drop_cloth || false,
        painting_needs_lighting: currentSeg.painting_needs_lighting || false, painting_canvas_size: currentSeg.painting_canvas_size || '',
        painting_other_setup: currentSeg.painting_other_setup || '', painting_notes: currentSeg.painting_notes || '',
      }
    };

    const d = payload.data;
    const filledFields = Object.entries(d).filter(([_, v]) => {
      if (typeof v === 'boolean') return v;
      if (typeof v === 'number') return v > 0;
      if (Array.isArray(v)) return v.length > 0;
      return !!v && v !== '';
    }).map(([k]) => k);

    base44.analytics.track({
      eventName: 'arts_save_attempt',
      properties: {
        segment_id: currentSeg.id, segment_title: currentSeg.title || '',
        art_types: (currentSeg.art_types || []).join(','),
        filled_field_count: filledFields.length, total_field_count: Object.keys(d).length,
      }
    });

    try {
      const res = await base44.functions.invoke('submitArtsSegment', payload);
      if (res.data?.error) {
        setSaveMsg({ type: 'error', text: '❌ ' + res.data.error });
        base44.analytics.track({ eventName: 'arts_save_error', properties: { segment_id: currentSeg.id, error_message: res.data.error, duration_ms: Date.now() - saveStart } });
      } else {
        setSaveMsg({ type: 'success', text: '✅' });
        base44.analytics.track({ eventName: 'arts_save_success', properties: { segment_id: currentSeg.id, duration_ms: Date.now() - saveStart } });
      }
    } catch (err) {
      setSaveMsg({ type: 'error', text: '❌ ' + (err.message || 'Connection error') });
      base44.analytics.track({ eventName: 'arts_save_error', properties: { segment_id: currentSeg.id, error_message: err.message || 'unknown', duration_ms: Date.now() - saveStart } });
    } finally {
      setSaving(false);
    }
  }, [submitterName, submitterEmail]);

  // Expose save handler + state to parent (for sticky bar).
  // Uses handleSave ref via useCallback — must be below handleSave definition.
  useEffect(() => {
    if (onSaveStateChange) {
      onSaveStateChange(seg.id, { saving, saveMsg, handleSave, segmentTitle: seg.title });
    }
  }, [saving, saveMsg, seg.title, handleSave, onSaveStateChange, seg.id]);

  const status = calcSegmentStatus(seg);
  const types = seg.art_types || [];
  const statusColors = { incomplete: 'bg-red-100 text-red-800', minimum: 'bg-yellow-100 text-yellow-800', complete: 'bg-green-100 text-green-800' };

  // TYPE_COMPONENTS map for rendering
  const TYPE_RENDERERS = {
    DANCE: () => <ArtsTypeDance seg={seg} updateField={updateField} isUnica={isUnica} />,
    DRAMA: () => <ArtsTypeDrama seg={seg} updateField={updateField} isUnica={isUnica} />,
    VIDEO: () => <ArtsTypeVideo seg={seg} updateField={updateField} isUnica={isUnica} />,
    SPOKEN_WORD: () => <ArtsTypeSpokenWord seg={seg} updateField={updateField} />,
    PAINTING: () => <ArtsTypePainting seg={seg} updateField={updateField} />,
    OTHER: () => <ArtsTypeOther seg={seg} updateField={updateField} />,
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-4 hover:border-gray-300 transition-colors" id={`seg-${seg.id}`}>
      {/* Accordion header */}
      <button onClick={() => {
        onToggle(seg.id);
        if (!isOpen) {
          base44.analytics.track({ eventName: 'arts_segment_opened', properties: { segment_id: seg.id, segment_title: seg.title || '' } });
        }
      }} className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors" style={{ minHeight: '56px' }}>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 truncate">{seg.title}</div>
          <div className="text-xs text-gray-400 mt-0.5">{seg.session_name}{seg.start_time ? ` • ${formatTime(seg.start_time)}` : ''}{seg.presenter ? ` • ${seg.presenter}` : ''}</div>
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {types.map(tp => <span key={tp} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold">{TYPE_LABELS[tp] || tp}</span>)}
          </div>
        </div>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${statusColors[status.level]}`}>{status.label}</span>
        <ChevronDown className={`w-5 h-5 text-gray-400 ml-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Accordion body */}
      {isOpen && (
        <div className="border-t border-gray-200 p-4 space-y-4">
          {/* Art Type Selection — chip toggle bar */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">{t('TIPO DE ARTE', 'ART TYPE')}</p>
            <div className="flex flex-wrap gap-2">
              {['DANCE', 'DRAMA', 'VIDEO', 'SPOKEN_WORD', 'PAINTING', 'OTHER'].map(tp => (
                <label key={tp} className={`flex items-center gap-1.5 text-xs cursor-pointer px-3 py-2 rounded-full border transition-all ${types.includes(tp) ? 'bg-[#1F8A70]/10 border-[#1F8A70] text-[#1F8A70] font-semibold' : 'border-gray-200 text-gray-500 hover:border-[#1F8A70]/50'}`}>
                  <input type="checkbox" checked={types.includes(tp)} onChange={e => toggleType(tp, e.target.checked)} className="sr-only" />
                  {TYPE_LABELS[tp]}
                </label>
              ))}
            </div>
          </div>

          {/* Per-type collapsible sub-sections (only for selected types) */}
          {types.map(tp => {
            const renderer = TYPE_RENDERERS[tp];
            if (!renderer) return null;
            const typeStatus = calcTypeStatus(seg, tp, t);
            return (
              <ArtsTypeSection
                key={tp}
                artType={tp}
                statusLevel={typeStatus.level}
                statusLabel={typeStatus.label}
                defaultOpen={types.length === 1}
                lang={lang}
              >
                {renderer()}
              </ArtsTypeSection>
            );
          })}

          {/* Performance order — drag-to-reorder when 2+ types selected (2026-02-28) */}
          {types.length >= 2 && (
            <ArtsTypeOrderEditor
              artTypes={types}
              artTypeOrder={seg.arts_type_order || []}
              onChange={(newOrder) => updateField('arts_type_order', newOrder)}
              language={lang}
              isPublicForm={true}
            />
          )}

          {/* Common section: Run of Show + Notes — always visible when types are selected */}
          {types.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{t('📋 GUÍA & NOTAS', '📋 GUIDE & NOTES')}</p>
              <CompactFileAttach
                value={seg.arts_run_of_show_url || ''}
                onChange={v => updateField('arts_run_of_show_url', v)}
                label={t('Guía Final (PDF/Documento)', 'Final Run of Show (PDF/Document)')}
                accept=".pdf,.doc,.docx,image/*"
                placeholder="https://drive.google.com/..."
                helpText={t('Suba el archivo final (≤50MB) o pegue un enlace.', 'Upload the final file (≤50MB) or paste a link.')}
              />
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Notas Adicionales', 'Additional Notes')}</label>
                <textarea rows={2} value={seg.description_details || ''} onChange={e => updateField('description_details', e.target.value)}
                  placeholder={t('Detalles para el equipo técnico...', 'Details for the technical team...')}
                  className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white resize-y focus:outline-none focus:border-[#1F8A70]" />
              </div>
            </div>
          )}

          {/* Bottom padding for sticky bar clearance on mobile */}
          <div className="h-16" />
        </div>
      )}
    </div>
  );
}
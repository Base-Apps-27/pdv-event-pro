/**
 * ArtesFormSection.jsx
 * Phase 3B Extraction: Artes block (Dance/Drama/Video/Other) from SegmentFormTwoColumn
 * ~400 lines extracted — handles art type selection, dance songs, drama songs, and other art descriptions.
 * 
 * Props:
 *   formData - full form state object
 *   setFormData - state setter for form
 *   language - 'es' | 'en'
 */
import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import ArtsTypeOrderEditor from "@/components/session/ArtsTypeOrderEditor";
import VideoDurationInput from "@/components/publicforms/VideoDurationInput";
import MultiFileOrLinkInput from "@/components/publicforms/MultiFileOrLinkInput";

// Toggle helper for Artes multiselect
const toggleArtType = (formData, setFormData, val) => {
  const set = new Set(formData.art_types || []);
  if (set.has(val)) set.delete(val); else set.add(val);
  setFormData(prev => ({ ...prev, art_types: Array.from(set) }));
};

// Reusable song slot for dance or drama
function SongSlot({ prefix, index, formData, setFormData, language, onRemove }) {
  // For slot 1, fields use legacy naming (e.g. dance_song_title, drama_song_source)
  // For slots 2/3, fields use numbered naming (e.g. dance_song_2_title)
  const titleField = index === 1 ? `${prefix}_song_title` : `${prefix}_song_${index}_title`;
  const urlField = index === 1 ? `${prefix}_song_source` : `${prefix}_song_${index}_url`;
  const ownerField = index === 1 ? `${prefix}_song_owner` : `${prefix}_song_${index}_owner`;
  const metaField = index === 1 ? `${prefix}_song_1_url_meta` : `${prefix}_song_${index}_url_meta`;
  const showFlag = `_show_${prefix}_song_${index}`;

  return (
    <div className="space-y-2 border-t border-pink-50 pt-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">
          {language === 'es' ? `Playlist/Canción ${index}` : `Playlist/Song ${index}`}
        </Label>
        {index > 1 && onRemove && (
          <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-red-500 hover:text-red-700" onClick={onRemove}>
            <Trash2 className="w-3 h-3" />
          </Button>
        )}
      </div>
      <Input
        value={formData[titleField] || ""}
        onChange={(e) => setFormData({ ...formData, [titleField]: e.target.value })}
        placeholder={language === 'es' ? 'Título' : 'Title'}
        className="h-8 text-sm"
      />
      <div className="pt-1 pb-1">
        <MultiFileOrLinkInput
          urls={formData[urlField]}
          onChange={(urls) => setFormData({ ...formData, [urlField]: urls, [metaField]: null })}
          placeholder={language === 'es' ? 'Enlace (URL)' : 'Link (URL)'}
        />
      </div>
      <Input
        value={formData[ownerField] || ""}
        onChange={(e) => setFormData({ ...formData, [ownerField]: e.target.value })}
        placeholder={language === 'es' ? 'Responsable' : 'Owner'}
        className="h-8 text-sm"
      />
    </div>
  );
}

// Renders a multi-song list (up to 3) for dance or drama
function SongList({ prefix, formData, setFormData, language }) {
  const hasSong2 = formData[`_show_${prefix}_song_2`] || formData[`${prefix}_song_2_title`]?.trim() || formData[`${prefix}_song_2_url`]?.trim();
  const hasSong3 = formData[`_show_${prefix}_song_3`] || formData[`${prefix}_song_3_title`]?.trim() || formData[`${prefix}_song_3_url`]?.trim();

  const clearSong = (index) => {
    const titleField = `${prefix}_song_${index}_title`;
    const urlField = `${prefix}_song_${index}_url`;
    const ownerField = `${prefix}_song_${index}_owner`;
    const metaField = `${prefix}_song_${index}_url_meta`;
    const showFlag = `_show_${prefix}_song_${index}`;
    setFormData({ ...formData, [titleField]: '', [urlField]: '', [ownerField]: '', [metaField]: null, [showFlag]: false });
  };

  const showNextSlot = () => {
    if (!hasSong2) {
      setFormData({ ...formData, [`${prefix}_song_2_title`]: '', [`${prefix}_song_2_url`]: '', [`${prefix}_song_2_owner`]: '', [`_show_${prefix}_song_2`]: true });
    } else if (!hasSong3) {
      setFormData({ ...formData, [`${prefix}_song_3_title`]: '', [`${prefix}_song_3_url`]: '', [`${prefix}_song_3_owner`]: '', [`_show_${prefix}_song_3`]: true });
    }
  };

  return (
    <div className="space-y-3 border-t border-pink-100 pt-2">
      <SongSlot prefix={prefix} index={1} formData={formData} setFormData={setFormData} language={language} />
      {hasSong2 && (
        <SongSlot prefix={prefix} index={2} formData={formData} setFormData={setFormData} language={language} onRemove={() => clearSong(2)} />
      )}
      {hasSong3 && (
        <SongSlot prefix={prefix} index={3} formData={formData} setFormData={setFormData} language={language} onRemove={() => clearSong(3)} />
      )}
      {(!hasSong2 || !hasSong3) && (
        <Button type="button" variant="ghost" size="sm" className="w-full border border-dashed border-pink-200 text-pink-600 hover:bg-pink-50" onClick={showNextSlot}>
          <Plus className="w-4 h-4 mr-1" /> {language === 'es' ? 'Agregar playlist/canción' : 'Add playlist/song'}
        </Button>
      )}
    </div>
  );
}

export default function ArtesFormSection({ formData, setFormData, language }) {
  const hasDance = formData.art_types?.includes("DANCE");
  const hasDrama = formData.art_types?.includes("DRAMA");
  const hasArtVideo = formData.art_types?.includes("VIDEO");
  const hasSpokenWord = formData.art_types?.includes("SPOKEN_WORD");
  const hasPainting = formData.art_types?.includes("PAINTING");
  const hasOtherArt = formData.art_types?.includes("OTHER");

  return (
    <div className="space-y-3 bg-pink-50 p-4 rounded border border-pink-200">
      <div className="flex items-center justify-between mb-1">
        <Label className="font-semibold">Artes</Label>
      </div>

      {/* Art Types Selection — 2026-02-28: added SPOKEN_WORD + PAINTING to match public form */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {['DANCE', 'DRAMA', 'VIDEO', 'SPOKEN_WORD', 'PAINTING', 'OTHER'].map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={Array.isArray(formData.art_types) && formData.art_types.includes(opt)}
              onCheckedChange={() => toggleArtType(formData, setFormData, opt)}
            />
            <span>{opt}</span>
          </label>
        ))}
      </div>

      {/* DANCE Block */}
      {hasDance && (
        <div className="space-y-3 bg-white p-3 rounded border border-pink-100">
          <Label className="text-xs font-semibold text-pink-800">🩰 DANZA</Label>
          <div className="grid grid-cols-2 gap-2 md:max-w-md">
            <div className="space-y-1">
              <Label className="text-xs">Handheld</Label>
              <Input type="number" value={formData.dance_handheld_mics ?? ''} onChange={(e) => setFormData({ ...formData, dance_handheld_mics: e.target.value === '' ? '' : parseInt(e.target.value) })} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Headset</Label>
              <Input type="number" value={formData.dance_headset_mics ?? ''} onChange={(e) => setFormData({ ...formData, dance_headset_mics: e.target.value === '' ? '' : parseInt(e.target.value) })} className="h-9 text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{language === 'es' ? 'Cues de inicio y fin' : 'Start and end cues'}</Label>
            <div className="grid md:grid-cols-2 gap-2">
              <Textarea rows={2} value={formData.dance_start_cue} onChange={(e) => setFormData({ ...formData, dance_start_cue: e.target.value })} placeholder={language === 'es' ? 'Cue inicio' : 'Start cue'} className="text-sm" />
              <Textarea rows={2} value={formData.dance_end_cue} onChange={(e) => setFormData({ ...formData, dance_end_cue: e.target.value })} placeholder={language === 'es' ? 'Cue fin' : 'End cue'} className="text-sm" />
            </div>
          </div>
          <div className="col-span-2 flex items-center gap-2 mt-1">
            <Checkbox id="dance_has_song" checked={formData.dance_has_song} onCheckedChange={(checked) => setFormData({ ...formData, dance_has_song: checked })} />
            <label htmlFor="dance_has_song" className="text-xs">{language === 'es' ? 'Incluye playlist/canción(es)' : 'Includes playlist/song(s)'}</label>
          </div>
          {formData.dance_has_song && (
            <SongList prefix="dance" formData={formData} setFormData={setFormData} language={language} />
          )}
        </div>
      )}

      {/* DRAMA Block */}
      {hasDrama && (
        <div className="space-y-3 bg-white p-3 rounded border border-pink-100">
          <Label className="text-xs font-semibold text-pink-800">🎭 DRAMA</Label>
          <div className="grid grid-cols-2 gap-2 md:max-w-md">
            <div className="space-y-1">
              <Label className="text-xs">Handheld</Label>
              <Input type="number" value={formData.drama_handheld_mics ?? ''} onChange={(e) => setFormData({ ...formData, drama_handheld_mics: e.target.value === '' ? '' : parseInt(e.target.value) })} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Headset</Label>
              <Input type="number" value={formData.drama_headset_mics ?? ''} onChange={(e) => setFormData({ ...formData, drama_headset_mics: e.target.value === '' ? '' : parseInt(e.target.value) })} className="h-9 text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{language === 'es' ? 'Cues de inicio y fin' : 'Start and end cues'}</Label>
            <div className="grid md:grid-cols-2 gap-2">
              <Textarea rows={2} value={formData.drama_start_cue} onChange={(e) => setFormData({ ...formData, drama_start_cue: e.target.value })} placeholder={language === 'es' ? 'Cue inicio' : 'Start cue'} className="text-sm" />
              <Textarea rows={2} value={formData.drama_end_cue} onChange={(e) => setFormData({ ...formData, drama_end_cue: e.target.value })} placeholder={language === 'es' ? 'Cue fin' : 'End cue'} className="text-sm" />
            </div>
          </div>
          <div className="col-span-2 flex items-center gap-2 mt-1">
            <Checkbox id="drama_has_song" checked={formData.drama_has_song} onCheckedChange={(checked) => setFormData({ ...formData, drama_has_song: checked })} />
            <label htmlFor="drama_has_song" className="text-xs">{language === 'es' ? 'Incluye playlist/canción(es)' : 'Includes playlist/song(s)'}</label>
          </div>
          {formData.drama_has_song && (
            <SongList prefix="drama" formData={formData} setFormData={setFormData} language={language} />
          )}
        </div>
      )}

      {/* SPOKEN_WORD Block — 2026-02-28: wired to match public form fields */}
      {hasSpokenWord && (
        <div className="space-y-3 bg-white p-3 rounded border border-pink-100">
          <Label className="text-xs font-semibold text-pink-800">🎤 SPOKEN WORD</Label>
          <div className="space-y-1">
            <Label className="text-xs">{language === 'es' ? 'Orador' : 'Speaker'}</Label>
            <Input value={formData.spoken_word_speaker || ""} onChange={(e) => setFormData({ ...formData, spoken_word_speaker: e.target.value })} placeholder={language === 'es' ? 'Nombre del orador' : 'Speaker name'} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{language === 'es' ? 'Descripción / Título de la pieza' : 'Description / Piece title'}</Label>
            <Textarea rows={2} value={formData.spoken_word_description || ""} onChange={(e) => setFormData({ ...formData, spoken_word_description: e.target.value })} placeholder={language === 'es' ? 'Tema, contexto...' : 'Theme, context...'} className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{language === 'es' ? 'Posición del Micrófono' : 'Mic Position'}</Label>
            <select value={formData.spoken_word_mic_position || ""} onChange={(e) => setFormData({ ...formData, spoken_word_mic_position: e.target.value })} className="w-full h-8 px-2 text-sm border border-gray-200 rounded-md">
              <option value="">{language === 'es' ? 'Seleccione...' : 'Select...'}</option>
              <option value="headset">Headset</option>
              <option value="handheld">Handheld</option>
              <option value="stand">{language === 'es' ? 'Atril / Stand' : 'Stand'}</option>
              <option value="off_stage">{language === 'es' ? 'Fuera del escenario' : 'Off Stage'}</option>
              <option value="lapel">Lapel</option>
              <option value="podium">{language === 'es' ? 'Podio' : 'Podium'}</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{language === 'es' ? 'Guión / Script' : 'Script / Guide'}</Label>
            <MultiFileOrLinkInput 
               urls={formData.spoken_word_script_url} 
               onChange={(urls) => setFormData({ ...formData, spoken_word_script_url: urls })} 
               placeholder="https://..." 
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{language === 'es' ? 'Audio del Spoken Word' : 'Spoken Word Audio'}</Label>
            <MultiFileOrLinkInput 
               urls={formData.spoken_word_audio_url} 
               onChange={(urls) => setFormData({ ...formData, spoken_word_audio_url: urls })} 
               placeholder="https://..." 
            />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Checkbox id="spoken_word_has_music" checked={formData.spoken_word_has_music} onCheckedChange={(checked) => setFormData({ ...formData, spoken_word_has_music: checked })} />
            <label htmlFor="spoken_word_has_music" className="text-xs">{language === 'es' ? 'Incluye música de fondo' : 'Includes background music'}</label>
          </div>
          {formData.spoken_word_has_music && (
            <div className="space-y-2 pl-3 border-l-2 border-pink-200">
              <Input value={formData.spoken_word_music_title || ""} onChange={(e) => setFormData({ ...formData, spoken_word_music_title: e.target.value })} placeholder={language === 'es' ? 'Título de la pista' : 'Track title'} className="h-8 text-sm" />
              <Input value={Array.isArray(formData.spoken_word_music_url) ? formData.spoken_word_music_url.join(', ') : (formData.spoken_word_music_url || "")} onChange={(e) => setFormData({ ...formData, spoken_word_music_url: e.target.value ? e.target.value.split(',').map(s=>s.trim()).filter(Boolean) : [] })} placeholder={language === 'es' ? 'Enlace al archivo de música' : 'Music file URL'} className="h-8 text-sm" />
              <Input value={formData.spoken_word_music_owner || ""} onChange={(e) => setFormData({ ...formData, spoken_word_music_owner: e.target.value })} placeholder={language === 'es' ? 'Persona a cargo' : 'Person in charge'} className="h-8 text-sm" />
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">{language === 'es' ? 'Notas adicionales' : 'Additional notes'}</Label>
            <Textarea rows={2} value={formData.spoken_word_notes || ""} onChange={(e) => setFormData({ ...formData, spoken_word_notes: e.target.value })} className="text-sm" />
          </div>
        </div>
      )}

      {/* PAINTING Block — 2026-02-28: wired to match public form fields */}
      {hasPainting && (
        <div className="space-y-3 bg-white p-3 rounded border border-pink-100">
          <Label className="text-xs font-semibold text-pink-800">🎨 {language === 'es' ? 'PINTURA' : 'PAINTING'}</Label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs"><Checkbox checked={formData.painting_needs_easel} onCheckedChange={(c) => setFormData({ ...formData, painting_needs_easel: c })} />{language === 'es' ? 'Caballete' : 'Easel'}</label>
            <label className="flex items-center gap-2 text-xs"><Checkbox checked={formData.painting_needs_drop_cloth} onCheckedChange={(c) => setFormData({ ...formData, painting_needs_drop_cloth: c })} />{language === 'es' ? 'Protección de piso' : 'Drop Cloth'}</label>
            <label className="flex items-center gap-2 text-xs"><Checkbox checked={formData.painting_needs_lighting} onCheckedChange={(c) => setFormData({ ...formData, painting_needs_lighting: c })} />{language === 'es' ? 'Iluminación especial' : 'Special Lighting'}</label>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{language === 'es' ? 'Tamaño del lienzo' : 'Canvas size'}</Label>
            <Input value={formData.painting_canvas_size || ""} onChange={(e) => setFormData({ ...formData, painting_canvas_size: e.target.value })} placeholder={language === 'es' ? 'Ej: 24x36 pulgadas' : 'E.g. 24x36 inches'} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{language === 'es' ? 'Otros requisitos de montaje' : 'Other setup requirements'}</Label>
            <Textarea rows={2} value={formData.painting_other_setup || ""} onChange={(e) => setFormData({ ...formData, painting_other_setup: e.target.value })} className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{language === 'es' ? 'Notas adicionales' : 'Additional notes'}</Label>
            <Textarea rows={2} value={formData.painting_notes || ""} onChange={(e) => setFormData({ ...formData, painting_notes: e.target.value })} className="text-sm" />
          </div>
        </div>
      )}

      {/* OTHER Block */}
      {hasOtherArt && (
        <div className="space-y-2 bg-white p-3 rounded border border-pink-100">
          <Label className="text-xs">{language === 'es' ? 'Descripción (Otra)' : 'Description (Other)'}</Label>
          <Textarea
            rows={3}
            value={formData.art_other_description}
            onChange={(e) => setFormData({ ...formData, art_other_description: e.target.value })}
            placeholder={language === 'es' ? 'Describe brevemente la presentación (elementos, accesos, transiciones)' : 'Briefly describe the presentation (elements, entrances, transitions)'}
            className="text-sm"
          />
        </div>
      )}

      {/* VIDEO Block — 2026-02-28: inlined per parity audit (was just a redirect hint before) */}
      {hasArtVideo && (
        <div className="space-y-3 bg-white p-3 rounded border border-pink-100">
          <Label className="text-xs font-semibold text-pink-800">🎬 VIDEO</Label>
          <div className="space-y-2">
            <Label className="text-xs">{language === 'es' ? 'Nombre del Video' : 'Video Name'}</Label>
            <Input value={formData.video_name || ""} onChange={(e) => setFormData({ ...formData, video_name: e.target.value })} placeholder="Video de Apertura" className="h-8 text-sm" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">{language === 'es' ? 'Ubicación' : 'Location'}</Label>
            <Input value={formData.video_location || ""} onChange={(e) => setFormData({ ...formData, video_location: e.target.value })} placeholder="ProPresenter > Videos > Opening.mp4" className="h-8 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">{language === 'es' ? 'Responsable' : 'Owner'}</Label>
              <Input value={formData.video_owner || ""} onChange={(e) => setFormData({ ...formData, video_owner: e.target.value })} className="h-8 text-sm" />
            </div>
            <VideoDurationInput
              value={formData.video_length_sec}
              onChange={v => setFormData({ ...formData, video_length_sec: v })}
              labelEs="Duración"
              labelEn="Duration"
              t={(es, en) => language === 'es' ? es : en}
              className="h-8 text-sm w-full p-2 border border-gray-200 rounded-md bg-white focus:outline-none focus:border-[#1F8A70]"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">{language === 'es' ? 'Enlace al Video (URL)' : 'Video Link (URL)'}</Label>
            <Input value={formData.video_url || ""} onChange={(e) => setFormData({ ...formData, video_url: e.target.value, video_url_meta: null })} placeholder="https://youtube.com/watch?v=..." className="h-8 text-sm" />
          </div>
        </div>
      )}

      {/* Performance order — drag-to-reorder when 2+ types selected (2026-02-28) */}
      {(formData.art_types?.length || 0) >= 2 && (
        <ArtsTypeOrderEditor
          artTypes={formData.art_types || []}
          artTypeOrder={formData.arts_type_order || []}
          onChange={(newOrder) => setFormData({ ...formData, arts_type_order: newOrder })}
          language={language}
        />
      )}

      {/* Arts Directions PDF - simple input */}
      <div className="border-t border-pink-200 pt-3 mt-3 space-y-2">
        <Label className="text-xs">{language === 'es' ? 'Guía de Artes (PDF/Documento, separadas por coma)' : 'Arts Directions (PDF/Document, comma separated)'}</Label>
        <Input
          value={Array.isArray(formData.arts_run_of_show_url) ? formData.arts_run_of_show_url.join(', ') : (formData.arts_run_of_show_url || "")}
          onChange={(e) => setFormData({ ...formData, arts_run_of_show_url: e.target.value ? e.target.value.split(',').map(s=>s.trim()).filter(Boolean) : [], arts_run_of_show_url_meta: null })}
          placeholder="https://drive.google.com/..."
          className="h-9 text-sm"
        />
      </div>
    </div>
  );
}
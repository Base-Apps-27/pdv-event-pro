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
      <Input
        value={formData[urlField] || ""}
        onChange={(e) => setFormData({ ...formData, [urlField]: e.target.value, [metaField]: null })}
        placeholder={language === 'es' ? 'Enlace (URL)' : 'Link (URL)'}
        className="h-8 text-sm"
      />
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
  const hasOtherArt = formData.art_types?.includes("OTHER");

  return (
    <div className="space-y-3 bg-pink-50 p-4 rounded border border-pink-200">
      <div className="flex items-center justify-between mb-1">
        <Label className="font-semibold">Artes</Label>
      </div>

      {/* Art Types Selection */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {['DANCE', 'DRAMA', 'VIDEO', 'OTHER'].map((opt) => (
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
              <Input type="number" value={formData.dance_handheld_mics || ''} onChange={(e) => setFormData({ ...formData, dance_handheld_mics: e.target.value === '' ? 0 : parseInt(e.target.value) })} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Headset</Label>
              <Input type="number" value={formData.dance_headset_mics || ''} onChange={(e) => setFormData({ ...formData, dance_headset_mics: e.target.value === '' ? 0 : parseInt(e.target.value) })} className="h-9 text-sm" />
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
              <Input type="number" value={formData.drama_handheld_mics || ''} onChange={(e) => setFormData({ ...formData, drama_handheld_mics: e.target.value === '' ? 0 : parseInt(e.target.value) })} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Headset</Label>
              <Input type="number" value={formData.drama_headset_mics || ''} onChange={(e) => setFormData({ ...formData, drama_headset_mics: e.target.value === '' ? 0 : parseInt(e.target.value) })} className="h-9 text-sm" />
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

      {/* Video hint */}
      {hasArtVideo && (
        <p className="text-xs text-pink-700">Este segmento incluye VIDEO; añade detalles en la sección "Video" arriba.</p>
      )}

      {/* Arts Directions PDF - simple input */}
      <div className="border-t border-pink-200 pt-3 mt-3 space-y-2">
        <Label className="text-xs">{language === 'es' ? 'Guía de Artes (PDF/Documento)' : 'Arts Directions (PDF/Document)'}</Label>
        <Input
          value={formData.arts_run_of_show_url}
          onChange={(e) => setFormData({ ...formData, arts_run_of_show_url: e.target.value, arts_run_of_show_url_meta: null })}
          placeholder="https://drive.google.com/..."
          className="h-9 text-sm"
        />
      </div>
    </div>
  );
}
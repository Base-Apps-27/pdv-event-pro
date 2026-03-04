/**
 * MessageMaterialSection.jsx
 * 
 * Admin-facing material display for the Message Processing page.
 * Shows presentation_url, notes_url, content_is_slides_only for a segment.
 * Allows inline editing via FileOrLinkInput (upload + link hybrid).
 * 
 * 2026-02-28: Created as part of FileOrLinkInput rollout to all surfaces.
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Pencil, Save, X, ExternalLink, FileText, Presentation, Sparkles } from 'lucide-react';
import MultiFileOrLinkInput from '@/components/publicforms/MultiFileOrLinkInput';
import { toast } from 'sonner';

export default function MessageMaterialSection({ segment, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [presentationUrls, setPresentationUrls] = useState(segment.presentation_url ? segment.presentation_url.split(',').map(s=>s.trim()).filter(Boolean) : []);
  const [notesUrls, setNotesUrls] = useState(segment.notes_url ? segment.notes_url.split(',').map(s=>s.trim()).filter(Boolean) : []);
  const [slidesOnly, setSlidesOnly] = useState(!!segment.content_is_slides_only);
  const [saving, setSaving] = useState(false);

  const hasMaterial = segment.presentation_url || segment.notes_url || segment.content_is_slides_only;

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.Segment.update(segment.id, {
      presentation_url: presentationUrls.join(','),
      notes_url: notesUrls.join(','),
      content_is_slides_only: slidesOnly,
    });
    setSaving(false);
    setEditing(false);
    toast.success('Material actualizado');
    if (onUpdated) onUpdated();
  };

  const handleCancel = () => {
    setPresentationUrls(segment.presentation_url ? segment.presentation_url.split(',').map(s=>s.trim()).filter(Boolean) : []);
    setNotesUrls(segment.notes_url ? segment.notes_url.split(',').map(s=>s.trim()).filter(Boolean) : []);
    setSlidesOnly(!!segment.content_is_slides_only);
    setEditing(false);
  };

  // Read-only compact view
  if (!editing) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-md p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Material del Orador</span>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-slate-400 hover:text-slate-700" onClick={() => setEditing(true)}>
            <Pencil className="w-3 h-3 mr-1" /> Editar
          </Button>
        </div>

        {!hasMaterial ? (
          <p className="text-xs text-gray-400 italic">Sin material adjunto</p>
        ) : (
          <div className="space-y-1.5">
            {segment.content_is_slides_only && (
              <Badge className="bg-blue-100 text-blue-800 text-[10px]">
                <Sparkles className="w-3 h-3 mr-1" /> Solo Slides
              </Badge>
            )}
            {segment.presentation_url && (Array.isArray(segment.presentation_url) ? segment.presentation_url : segment.presentation_url.split(',')).map((url, i) => url.trim() ? (
              <a key={`pres-${i}`} href={url.trim()} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-teal-700 hover:underline truncate">
                <Presentation className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{url.trim()}</span>
                <ExternalLink className="w-3 h-3 shrink-0 opacity-50" />
              </a>
            ) : null)}
            {segment.notes_url && (Array.isArray(segment.notes_url) ? segment.notes_url : segment.notes_url.split(',')).map((url, i) => url.trim() ? (
              <a key={`note-${i}`} href={url.trim()} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-teal-700 hover:underline truncate">
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{url.trim()}</span>
                <ExternalLink className="w-3 h-3 shrink-0 opacity-50" />
              </a>
            ) : null)}
          </div>
        )}
      </div>
    );
  }

  // Edit view with FileOrLinkInput
  return (
    <div className="bg-white border-2 border-teal-200 rounded-md p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-teal-700 uppercase tracking-wide">Editar Material</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleCancel} disabled={saving}>
            <X className="w-3 h-3 mr-1" /> Cancelar
          </Button>
          <Button size="sm" className="h-7 text-xs bg-teal-600 hover:bg-teal-700" onClick={handleSave} disabled={saving}>
            <Save className="w-3 h-3 mr-1" /> {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>

      <MultiFileOrLinkInput
        urls={presentationUrls}
        onChange={setPresentationUrls}
        maxCount={4}
        label="Presentación / Slides Finales"
        accept="image/*,.pdf"
        placeholder="https://drive.google.com/..."
        helpText="Archivo final listo para proyección. / Final file ready for projection."
        variant="compact"
      />

      <MultiFileOrLinkInput
        urls={notesUrls}
        onChange={setNotesUrls}
        maxCount={4}
        label="Bosquejo / Notas Finales (PDF o Doc)"
        accept=".pdf,.doc,.docx"
        placeholder="https://..."
        helpText="Documento terminado para el equipo. / Finished document for the team."
        variant="compact"
      />

      <div className="flex items-center space-x-2">
        <Checkbox
          id="mp-slides-only"
          checked={slidesOnly}
          onCheckedChange={setSlidesOnly}
        />
        <Label htmlFor="mp-slides-only" className="text-xs cursor-pointer text-gray-600">
          Solo Slides (el contenido reemplaza versículos)
        </Label>
      </div>
    </div>
  );
}
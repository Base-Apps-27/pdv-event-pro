/**
 * PlenariaSection.jsx
 * Phase 3B extraction: Plenaria (message) fields from SegmentFormTwoColumn.
 * Verbatim extraction — zero logic changes.
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { BookOpen, Sparkles } from "lucide-react";
import { useLanguage } from "@/components/utils/i18n";
import ParsedContentPreview from "@/components/service/ParsedContentPreview";
import MultiFileOrLinkInput from "@/components/publicforms/MultiFileOrLinkInput";

export default function PlenariaSection({ formData, setFormData, onOpenVerseParser }) {
  const { language } = useLanguage();

  return (
    <div className="space-y-3 bg-orange-50 p-4 rounded border border-orange-200">
      <div className="space-y-2">
        <Label>Título del Mensaje</Label>
        <Input
          value={formData.message_title}
          onChange={(e) => setFormData({...formData, message_title: e.target.value})}
          placeholder="Conquistando nuevas alturas"
        />
      </div>
      <div className="space-y-3 pt-2 border-t border-orange-200">
        <div className="space-y-2">
          <Label>Presentación / Slides</Label>
          <MultiFileOrLinkInput
            urls={formData.presentation_url}
            onChange={(urls) => setFormData({...formData, presentation_url: urls})}
            placeholder="https://..."
          />
        </div>
        <div className="space-y-2">
          <Label>Bosquejo / Notas</Label>
          <MultiFileOrLinkInput
            urls={formData.notes_url}
            onChange={(urls) => setFormData({...formData, notes_url: urls})}
            placeholder="https://..."
          />
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="content_is_slides_only" 
            checked={formData.content_is_slides_only || false} 
            onCheckedChange={(checked) => setFormData({...formData, content_is_slides_only: checked})} 
          />
          <Label htmlFor="content_is_slides_only" className="cursor-pointer normal-case text-sm font-normal">
            El contenido son solo slides (no extraer versículos)
          </Label>
        </div>
      </div>
      {/* 2026-02-28: Hide Citas Bíblicas section entirely for slides-only submissions.
          When content_is_slides_only=true, parsed_verse_data is always {type:'empty'} by design.
          Showing "No processed content" is misleading — the submission was processed correctly. */}
      {!formData.content_is_slides_only && (
        <div className="space-y-2 pt-2 border-t border-orange-200">
          <div className="flex items-center justify-between">
            <Label>Citas Bíblicas</Label>
          </div>
          {formData.parsed_verse_data && formData.parsed_verse_data.type !== 'empty' ? (
            <div className="mt-3 bg-white p-3 rounded-md border border-orange-100 shadow-sm">
              <ParsedContentPreview parsedData={formData.parsed_verse_data} language={language} />
            </div>
          ) : (
            <div className="mt-2 border border-dashed border-orange-200 rounded-md p-4 text-center bg-orange-50/50">
              <BookOpen className="w-6 h-6 text-orange-200 mx-auto mb-2" />
              <p className="text-xs text-gray-500">{language === 'es' ? 'Sin contenido procesado' : 'No processed content'}</p>
              <p className="text-[10px] text-gray-400 mt-1">
                {language === 'es' ? 'Las citas bíblicas son de solo lectura aquí. Ve a Procesamiento de Mensajes para modificar.' : 'Verses are read-only here. Go to Message Processing to modify.'}
              </p>
            </div>
          )}
        </div>
      )}
      {formData.content_is_slides_only && (
        <div className="mt-2 pt-2 border-t border-orange-200">
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
            <Sparkles className="w-4 h-4 text-green-600 shrink-0" />
            <p className="text-xs text-green-800">
              {language === 'es' ? 'Contenido de solo slides — las citas bíblicas se manejan dentro de la presentación.' : 'Slides-only content — scripture references are handled within the presentation.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
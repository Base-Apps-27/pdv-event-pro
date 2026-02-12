/**
 * PlenariaSection.jsx
 * Phase 3B extraction: Plenaria (message) fields from SegmentFormTwoColumn.
 * Verbatim extraction — zero logic changes.
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, Sparkles } from "lucide-react";
import { useLanguage } from "@/components/utils/i18n";

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
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Citas Bíblicas</Label>
          <Button
            type="button" variant="outline" size="sm"
            onClick={onOpenVerseParser}
            className="h-7 px-2 bg-white border-orange-300 text-orange-700 hover:bg-orange-50"
          >
            <BookOpen className="w-3.5 h-3.5 mr-1" />
            <span className="text-xs">{language === 'es' ? 'Añadir Versículos' : 'Add Verses'}</span>
          </Button>
        </div>
        {formData.scripture_references ? (
          <p className="text-sm text-gray-700 py-2">{formData.scripture_references}</p>
        ) : (
          <p className="text-sm text-gray-400 italic py-2">{language === 'es' ? 'Sin versículos añadidos' : 'No verses added'}</p>
        )}
        {formData.parsed_verse_data && (
          <p className="text-xs text-green-600 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            {language === 'es' ? 'Versos estructurados guardados' : 'Structured verses saved'}
          </p>
        )}
      </div>
    </div>
  );
}
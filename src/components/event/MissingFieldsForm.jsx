import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useLanguage } from "@/components/utils/i18n";
import { AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

const FIELD_LABELS = {
  name: { es: "Nombre de la Sesión", en: "Session Name" },
  message_title: { es: "Título del Mensaje", en: "Message Title" },
  number_of_songs: { es: "Número de Canciones", en: "Number of Songs" },
  video_name: { es: "Nombre del Video", en: "Video Name" },
  video_location: { es: "Ubicación del Video", en: "Video Location" },
  announcement_title: { es: "Título del Anuncio", en: "Announcement Title" },
  art_types: { es: "Tipos de Artes", en: "Art Types" },
  breakout_rooms: { es: "Salas Paralelas", en: "Breakout Rooms" }
};

export default function MissingFieldsForm({
  fixableErrors,
  proposedActions,
  onFieldChange,
  onDraftToggle,
  isDraft
}) {
  const { language } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!fixableErrors || fixableErrors.length === 0) return null;

  // Group errors by segment
  const errorsBySegment = {};
  fixableErrors.forEach(err => {
    const key = `${err.actionIndex}-${err.segmentIndex}`;
    if (!errorsBySegment[key]) {
      errorsBySegment[key] = [];
    }
    errorsBySegment[key].push(err);
  });

  return (
    <div className="space-y-3">
      <Card className="border-amber-200 overflow-hidden">
        {/* Collapsible Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-4 flex items-center gap-3 bg-amber-50 hover:bg-amber-100 transition-colors text-left"
        >
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-amber-900 text-sm">
              {language === 'es' ? 'Campos Opcionales' : 'Optional Fields'}
            </h4>
            <p className="text-xs text-amber-700 mt-0.5">
              {language === 'es' ? 'Expandir para completar' : 'Expand to fill in'}
            </p>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-amber-600 flex-shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-amber-600 flex-shrink-0" />
          )}
        </button>

        {/* Expandable Content */}
        {isExpanded && (
          <div className="p-4 bg-white border-t border-amber-200">
            <div className="space-y-4 mb-4">
              {Object.entries(errorsBySegment).map(([key, errors]) => {
                const [actionIndex, segmentIndex] = key.split('-').map(Number);
                const action = proposedActions.actions?.[actionIndex];
                const segment = action?.create_data?.[segmentIndex];
                const segmentLabel = segment?.title || `Segment ${segmentIndex + 1}`;

                return (
                  <div key={key} className="bg-white p-3 rounded border border-amber-200">
                    <p className="font-semibold text-amber-900 text-xs mb-2">
                      {segmentLabel}{segment?.segment_type ? ` (${segment.segment_type})` : ''}
                    </p>

                    <div className="space-y-2">
                      {errors.map((err, idx) => (
                        <div key={idx} className="space-y-1">
                          <Label className="text-xs text-amber-800 font-medium">
                            {FIELD_LABELS[err.field]?.[language] || err.field}
                          </Label>
                          <Input
                            placeholder={language === 'es' ? 'ej. ****Placeholder****' : 'e.g. ****Placeholder****'}
                            defaultValue=""
                            onChange={(e) => onFieldChange(actionIndex, segmentIndex, err.field, e.target.value)}
                            className="text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Draft Checkbox */}
            <div className="pt-3 border-t border-amber-200 flex items-center gap-2">
              <Checkbox
                id="draft-checkbox"
                checked={isDraft}
                onCheckedChange={onDraftToggle}
              />
              <Label
                htmlFor="draft-checkbox"
                className="text-xs text-amber-800 font-medium cursor-pointer"
              >
                {language === 'es'
                  ? 'Continuar como borrador (llenar campos más tarde)'
                  : 'Continue as draft (fill fields later)'}
              </Label>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
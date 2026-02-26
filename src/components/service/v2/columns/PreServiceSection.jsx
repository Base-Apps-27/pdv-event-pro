/**
 * PreServiceSection.jsx — V2 pre-service notes input.
 * HARDENING (Phase 9):
 *   - Collapsible by default when empty (saves vertical space)
 *   - Print-friendly read-only rendering
 *   - Shows PSD facility notes and other fields if present
 */

import React, { useState, useEffect, memo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, ChevronDown, ChevronUp } from "lucide-react";

export default memo(function PreServiceSection({ session, psd, onWritePSD }) {
  const value = psd?.general_notes || '';
  const facilityNotes = psd?.facility_notes || '';
  const hasContent = !!(value || facilityNotes);
  const [expanded, setExpanded] = useState(hasContent);
  const [local, setLocal] = useState(value);

  useEffect(() => { setLocal(value); }, [value]);
  // Auto-expand when content appears
  useEffect(() => { if (hasContent) setExpanded(true); }, [hasContent]);

  return (
    <Card className="bg-gray-100 border-2 border-gray-400">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2 text-gray-700">
          <Clock className="w-4 h-4" />
          PRE-SERVICIO
          <Badge variant="outline" className="ml-auto text-xs text-gray-600 border-gray-500 print:hidden">
            Antes de iniciar
          </Badge>
          {!expanded && (
            <Button variant="ghost" size="sm" onClick={() => setExpanded(true)} className="print:hidden h-6 px-2 text-xs text-gray-500">
              <ChevronDown className="w-3 h-3" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-2 pt-2">
          {/* Screen: editable */}
          <div className="print:hidden space-y-2">
            <Textarea
              placeholder="Instrucciones pre-servicio (opcional)..."
              value={local}
              onChange={(e) => {
                setLocal(e.target.value);
                onWritePSD(psd?.id || null, session.id, 'general_notes', e.target.value);
              }}
              className="text-xs bg-white border-gray-300 text-gray-700 placeholder:text-gray-400"
              rows={2}
            />
            {!value && (
              <Button variant="ghost" size="sm" onClick={() => setExpanded(false)} className="w-full text-xs text-gray-400">
                <ChevronUp className="w-3 h-3 mr-1" />Ocultar
              </Button>
            )}
          </div>
          {/* Print: read-only */}
          {hasContent && (
            <div className="hidden print:block text-xs text-gray-700 whitespace-pre-wrap">
              {value}
              {facilityNotes && (
                <div className="mt-1 text-gray-600 italic">{facilityNotes}</div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
});
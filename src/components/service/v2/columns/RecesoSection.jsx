/**
 * RecesoSection.jsx — V2 break notes between service slots.
 * HARDENING (Phase 9):
 *   - Collapsible when empty
 *   - Print-friendly rendering
 *   - Flush timer on unmount to prevent data loss
 */

import React, { useState, useEffect, useRef, memo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Clock, ChevronDown, ChevronUp } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default memo(function RecesoSection({ serviceId, slotName, recesoNotes, markOwnWrite }) {
  const value = recesoNotes?.[slotName] || '';
  const hasContent = !!value;
  const [expanded, setExpanded] = useState(hasContent);
  const [local, setLocal] = useState(value);
  const timerRef = useRef(null);
  // Keep recesoNotes ref fresh for timer closure
  const recesoRef = useRef(recesoNotes);
  recesoRef.current = recesoNotes;

  useEffect(() => { setLocal(value); }, [value]);
  useEffect(() => { if (hasContent) setExpanded(true); }, [hasContent]);

  const handleChange = (val) => {
    setLocal(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      markOwnWrite?.();
      const updated = { ...recesoRef.current, [slotName]: val };
      base44.entities.Service.update(serviceId, { receso_notes: updated });
    }, 500);
  };

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        // Fire final write if value changed
        if (local !== value) {
          markOwnWrite?.();
          const updated = { ...recesoRef.current, [slotName]: local };
          base44.entities.Service.update(serviceId, { receso_notes: updated }).catch(() => {});
        }
      }
    };
  }, [local, value, serviceId, slotName, markOwnWrite]);

  return (
    <Card className="bg-gray-100 border-2 border-gray-400">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2 text-gray-600">
          <Clock className="w-4 h-4" />
          RECESO
          {!expanded && (
            <Button variant="ghost" size="sm" onClick={() => setExpanded(true)} className="print:hidden h-6 px-2 text-xs text-gray-400">
              <ChevronDown className="w-3 h-3" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-2 pt-2">
          <div className="print:hidden">
            <Textarea
              placeholder="Notas del receso (opcional)..."
              value={local}
              onChange={(e) => handleChange(e.target.value)}
              className="text-xs bg-white border-gray-300 text-gray-700 placeholder:text-gray-400"
              rows={2}
            />
            {!value && (
              <Button variant="ghost" size="sm" onClick={() => setExpanded(false)} className="w-full text-xs text-gray-400 mt-1">
                <ChevronUp className="w-3 h-3 mr-1" />Ocultar
              </Button>
            )}
          </div>
          {/* Print */}
          {hasContent && (
            <div className="hidden print:block text-xs text-gray-700 whitespace-pre-wrap">{value}</div>
          )}
        </CardContent>
      )}
    </Card>
  );
});
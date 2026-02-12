/**
 * PanelSection.jsx
 * Phase 3B extraction: Panel fields from SegmentFormTwoColumn.
 * Verbatim extraction — zero logic changes.
 */

import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/components/utils/i18n";

export default function PanelSection({ formData, setFormData }) {
  const { language } = useLanguage();

  return (
    <div className="space-y-4 bg-amber-50 p-4 rounded border border-amber-200">
      <div className="space-y-2">
        <Label>{language === 'es' ? 'Anfitrión(es) / Moderador(es)' : 'Host(s) / Moderator(s)'}</Label>
        <Input
          value={formData.panel_moderators}
          onChange={(e) => setFormData({...formData, panel_moderators: e.target.value})}
          placeholder={language === 'es' ? 'Nombres de los moderadores' : 'Moderator names'}
          className="text-sm"
        />
      </div>
      <div className="space-y-2">
        <Label>{language === 'es' ? 'Panelista(s)' : 'Panelist(s)'}</Label>
        <Textarea
          value={formData.panel_panelists}
          onChange={(e) => setFormData({...formData, panel_panelists: e.target.value})}
          placeholder={language === 'es' ? 'Nombres de los panelistas (uno por línea o separados por coma)' : 'Panelist names (one per line or comma-separated)'}
          className="text-sm"
          rows={3}
        />
      </div>
    </div>
  );
}
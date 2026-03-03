/**
 * TeamSection.jsx — V2 team inputs per session.
 * HARDENING (Phase 9):
 *   - AutocompleteInput for team member suggestions
 *   - Labels visible above each field
 *   - Print-friendly: shows values as text, hides inputs
 *   - Compact 2-column grid on desktop
 */

import React, { useState, useEffect, memo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import AutocompleteInput from "@/components/ui/AutocompleteInput";
import { TEAM_FIELDS } from "../constants/fieldMap";
import { useLanguage } from "@/components/utils/i18n.jsx";

const AUTOCOMPLETE_TYPE_MAP = {
  coordinators:     'person',
  ushers_team:      'person',
  sound_team:       'person',
  tech_team:        'person',
  photography_team: 'person',
};

export default memo(function TeamSection({ session, accentColor = 'teal', onWriteSession, label }) {
  const { t } = useLanguage();
  // Phase 2 (2026-03-02): Optional label prop overrides default team header
  // Used by CustomEditorV2 to show custom label instead of a generic session name
  const displayLabel = label || t('team.label').replace('{name}', session.name);
  return (
    <Card className={`bg-${accentColor}-50 border-${accentColor}-300 border-2`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm print:text-xs">{displayLabel}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Screen: editable inputs */}
        <div className="print:hidden grid grid-cols-1 md:grid-cols-2 gap-2">
          {TEAM_FIELDS.map(f => (
            <TeamInput
              key={f.key}
              session={session}
              column={f.column}
              label={t(f.labelKey)}
              onWriteSession={onWriteSession}
            />
          ))}
        </div>
        {/* Print: read-only text */}
        <div className="hidden print:block space-y-1">
          {TEAM_FIELDS.map(f => {
            const val = session[f.column];
            if (!val) return null;
            return (
              <div key={f.key} className="text-xs">
                <span className="font-semibold">{t(f.labelKey)}:</span> {val}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
});

function TeamInput({ session, column, label, onWriteSession }) {
  const value = session[column] || '';
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);

  return (
    <div className="space-y-0.5">
      <Label className="text-[10px] text-gray-600 font-medium">{label}</Label>
      <AutocompleteInput
        type={AUTOCOMPLETE_TYPE_MAP[column] || 'person'}
        placeholder={label}
        value={local}
        onChange={(e) => {
          setLocal(e.target.value);
          onWriteSession(session.id, column, e.target.value);
        }}
        className="text-xs"
      />
    </div>
  );
}
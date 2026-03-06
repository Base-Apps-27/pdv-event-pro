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

/**
 * TEAM_COLOR_STYLES: Concrete CSS for team card background + border.
 * Avoids dynamic Tailwind class purging (e.g. `bg-${color}-50` gets purged at build).
 */
const TEAM_COLOR_STYLES = {
  green:  { bg: '#f0fdf4', border: '#86efac' },
  blue:   { bg: '#eff6ff', border: '#93c5fd' },
  pink:   { bg: '#fdf2f8', border: '#f9a8d4' },
  orange: { bg: '#fff7ed', border: '#fdba74' },
  yellow: { bg: '#fffbeb', border: '#fcd34d' },
  amber:  { bg: '#fffbeb', border: '#fcd34d' },
  purple: { bg: '#faf5ff', border: '#d8b4fe' },
  red:    { bg: '#fef2f2', border: '#fca5a5' },
  teal:   { bg: '#f0fdfa', border: '#5eead4' },
};

export default memo(function TeamSection({ session, accentColor = 'teal', onWriteSession, label }) {
  const { t } = useLanguage();
  // Phase 2 (2026-03-02): Optional label prop overrides default team header
  // Used by CustomEditorV2 to show custom label instead of a generic session name
  const displayLabel = label || t('team.label').replace('{name}', session.name);
  const teamColors = TEAM_COLOR_STYLES[accentColor] || TEAM_COLOR_STYLES.teal;
  return (
    <Card className="border-2" style={{ backgroundColor: teamColors.bg, borderColor: teamColors.border }}>
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
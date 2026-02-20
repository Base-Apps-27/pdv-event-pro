/**
 * SessionEditorCard.jsx — Editable session card with nested segment rows.
 *
 * Displays session header fields (name, date, start/end time, color) and
 * a list of editable segment rows. Each segment can be renamed, retyped,
 * retimed, deleted, or moved to another session.
 */
import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown, ChevronUp, Trash2, Plus
} from "lucide-react";
import { useLanguage } from "@/components/utils/i18n";
import SegmentEditorRow from "@/components/event/SegmentEditorRow";

const SESSION_COLORS = ['blue','green','pink','orange','yellow','purple','red'];
const COLOR_CSS = {
  blue: 'border-l-blue-500', green: 'border-l-green-500', pink: 'border-l-pink-500',
  orange: 'border-l-orange-500', yellow: 'border-l-yellow-500', purple: 'border-l-purple-500',
  red: 'border-l-red-500'
};

export default function SessionEditorCard({
  session,
  sessionIndex,
  allSessions,
  onUpdateSession,
  onDeleteSession,
  onUpdateSegment,
  onDeleteSegment,
  onMoveSegment,
  onAddSegment
}) {
  const { language } = useLanguage();
  const [collapsed, setCollapsed] = useState(false);

  const colorClass = COLOR_CSS[session.session_color] || 'border-l-blue-500';

  return (
    <Card className={`border-l-4 ${colorClass} overflow-hidden`}>
      {/* Session Header — always visible */}
      <div className="p-3 bg-gray-50 space-y-2">
        {/* Row 1: name + collapse/delete */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-400 w-6 text-center">{sessionIndex + 1}</span>
          <Input
            value={session.name}
            onChange={(e) => onUpdateSession(session._key, 'name', e.target.value)}
            placeholder={language === 'es' ? 'Nombre de sesión...' : 'Session name...'}
            className="flex-1 text-sm font-semibold h-8"
          />
          <Button
            variant="ghost" size="icon"
            className="h-7 w-7"
            onClick={() => setCollapsed(c => !c)}
          >
            {collapsed
              ? <ChevronDown className="w-4 h-4 text-gray-400" />
              : <ChevronUp className="w-4 h-4 text-gray-400" />}
          </Button>
          <Button
            variant="ghost" size="icon"
            className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
            onClick={() => onDeleteSession(session._key)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Row 2: date, times, color */}
        <div className="flex items-center gap-2 ml-8 flex-wrap">
          <Input
            type="date"
            value={session.date}
            onChange={(e) => onUpdateSession(session._key, 'date', e.target.value)}
            className="w-[130px] h-7 text-xs"
          />
          <Input
            value={session.planned_start_time}
            onChange={(e) => onUpdateSession(session._key, 'planned_start_time', e.target.value)}
            placeholder="HH:MM"
            className="w-[70px] h-7 text-xs text-center"
          />
          <span className="text-gray-400 text-xs">→</span>
          <Input
            value={session.planned_end_time}
            onChange={(e) => onUpdateSession(session._key, 'planned_end_time', e.target.value)}
            placeholder="HH:MM"
            className="w-[70px] h-7 text-xs text-center"
          />
          {/* Color picker */}
          <div className="flex gap-1 ml-2">
            {SESSION_COLORS.map(c => (
              <button
                key={c}
                onClick={() => onUpdateSession(session._key, 'session_color', c)}
                className={`w-4 h-4 rounded-full border-2 transition-all ${
                  session.session_color === c ? 'border-gray-800 scale-125' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
                style={{ backgroundColor: { blue:'#3B82F6', green:'#22C55E', pink:'#EC4899', orange:'#F97316', yellow:'#EAB308', purple:'#A855F7', red:'#EF4444' }[c] }}
              />
            ))}
          </div>
          <Badge variant="outline" className="text-[10px] ml-auto">
            {session.segments.length} seg
          </Badge>
        </div>
      </div>

      {/* Segments list */}
      {!collapsed && (
        <div className="divide-y divide-gray-100">
          {session.segments.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-gray-400">
              {language === 'es' ? 'Sin segmentos' : 'No segments'}
            </div>
          )}
          {session.segments.map((seg, segIdx) => (
            <SegmentEditorRow
              key={seg._key}
              segment={seg}
              segmentIndex={segIdx}
              sessionKey={session._key}
              allSessions={allSessions}
              onUpdate={(field, value) => onUpdateSegment(session._key, seg._key, field, value)}
              onDelete={() => onDeleteSegment(session._key, seg._key)}
              onMove={(toSessionKey) => onMoveSegment(session._key, seg._key, toSessionKey)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
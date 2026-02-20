/**
 * SegmentEditorRow.jsx — Single editable segment row inside a SessionEditorCard.
 *
 * Shows: order, title, segment_type dropdown, start_time, duration, presenter.
 * Actions: delete, move to another session.
 * Compact single-line for quick scanning, expands for detail fields.
 */
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Trash2, MoreHorizontal, ArrowRightLeft, ChevronDown, ChevronUp } from "lucide-react";
import { useLanguage } from "@/components/utils/i18n";
import { VALID_SEGMENT_TYPES } from "@/components/utils/segmentValidation";

// Color dot for segment type
const TYPE_COLORS = {
  Alabanza: '#8B5CF6', Plenaria: '#3B82F6', Bienvenida: '#10B981', Ofrenda: '#F59E0B',
  Oración: '#6366F1', Break: '#9CA3AF', Receso: '#9CA3AF', Almuerzo: '#D97706',
  Video: '#EC4899', Artes: '#F43F5E', MC: '#06B6D4', Cierre: '#64748B',
  Especial: '#EAB308', Ministración: '#A855F7', Anuncio: '#0EA5E9',
  Dinámica: '#14B8A6', TechOnly: '#475569', Breakout: '#7C3AED', Panel: '#2563EB'
};

export default function SegmentEditorRow({
  segment,
  segmentIndex,
  sessionKey,
  allSessions,
  onUpdate,
  onDelete,
  onMove
}) {
  const { language } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const dotColor = TYPE_COLORS[segment.segment_type] || '#9CA3AF';
  const otherSessions = allSessions.filter(s => s._key !== sessionKey);

  return (
    <div className="group">
      {/* Main row */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-50 transition-colors">
        {/* Order number */}
        <span className="text-[10px] text-gray-400 w-5 text-center font-mono flex-shrink-0">
          {segmentIndex + 1}
        </span>

        {/* Type color dot */}
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: dotColor }}
        />

        {/* Type select — compact */}
        <Select
          value={segment.segment_type}
          onValueChange={(val) => onUpdate('segment_type', val)}
        >
          <SelectTrigger className="h-7 w-[100px] text-[11px] border-0 bg-transparent px-1 font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {VALID_SEGMENT_TYPES.map(t => (
              <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Title */}
        <Input
          value={segment.title}
          onChange={(e) => onUpdate('title', e.target.value)}
          placeholder={language === 'es' ? 'Título...' : 'Title...'}
          className="flex-1 h-7 text-xs border-0 bg-transparent px-1 min-w-0"
        />

        {/* Time */}
        <Input
          value={segment.start_time}
          onChange={(e) => onUpdate('start_time', e.target.value)}
          placeholder="HH:MM"
          className="w-[55px] h-7 text-[11px] text-center px-0.5"
        />

        {/* Duration */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <Input
            type="number"
            value={segment.duration_min || ''}
            onChange={(e) => onUpdate('duration_min', e.target.value ? Number(e.target.value) : null)}
            placeholder="—"
            className="w-[40px] h-7 text-[11px] text-center px-0.5"
          />
          <span className="text-[10px] text-gray-400">min</span>
        </div>

        {/* Expand toggle */}
        <Button
          variant="ghost" size="icon"
          className="h-6 w-6 flex-shrink-0"
          onClick={() => setExpanded(e => !e)}
        >
          {expanded
            ? <ChevronUp className="w-3 h-3 text-gray-400" />
            : <ChevronDown className="w-3 h-3 text-gray-400" />}
        </Button>

        {/* Actions menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreHorizontal className="w-3.5 h-3.5 text-gray-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {otherSessions.length > 0 && otherSessions.map(s => (
              <DropdownMenuItem key={s._key} onClick={() => onMove(s._key)} className="text-xs">
                <ArrowRightLeft className="w-3 h-3 mr-2" />
                {language === 'es' ? 'Mover a' : 'Move to'} {s.name || `Session ${allSessions.indexOf(s) + 1}`}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={onDelete} className="text-xs text-red-600 focus:text-red-600">
              <Trash2 className="w-3 h-3 mr-2" />
              {language === 'es' ? 'Eliminar' : 'Delete'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Expanded detail fields */}
      {expanded && (
        <div className="px-3 pb-2 ml-8 grid grid-cols-2 sm:grid-cols-3 gap-2 bg-gray-50 border-t border-gray-100">
          <div>
            <label className="text-[10px] text-gray-500 uppercase">{language === 'es' ? 'Presentador' : 'Presenter'}</label>
            <Input
              value={segment.presenter || ''}
              onChange={(e) => onUpdate('presenter', e.target.value)}
              className="h-7 text-xs"
            />
          </div>
          {segment.segment_type === 'Plenaria' && (
            <div>
              <label className="text-[10px] text-gray-500 uppercase">{language === 'es' ? 'Título Mensaje' : 'Message Title'}</label>
              <Input
                value={segment.message_title || ''}
                onChange={(e) => onUpdate('message_title', e.target.value)}
                className="h-7 text-xs"
              />
            </div>
          )}
          <div>
            <label className="text-[10px] text-gray-500 uppercase">Color</label>
            <Select
              value={segment.color_code || 'default'}
              onValueChange={(val) => onUpdate('color_code', val)}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['default','worship','preach','break','tech','special'].map(c => (
                  <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
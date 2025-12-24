import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Globe, Video, Music, BookOpen, MoreHorizontal, ChevronDown, ChevronUp, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { formatTimeToEST } from "@/components/utils/timeFormat";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";

export default function SegmentRow({ segment, onUpdate, onEditDetails }) {
  const [localPresenter, setLocalPresenter] = useState(segment.presenter || "");
  const [localTranslator, setLocalTranslator] = useState(segment.translator_name || "");
  const [isDirty, setIsDirty] = useState(false);

  const handleBlur = () => {
    if (isDirty) {
      onUpdate(segment.id, { 
        presenter: localPresenter,
        translator_name: localTranslator
      });
      setIsDirty(false);
    }
  };

  const colorSchemes = {
    worship: "bg-purple-100 text-purple-800",
    preach: "bg-orange-100 text-orange-800",
    break: "bg-gray-100 text-gray-800",
    tech: "bg-blue-100 text-blue-800",
    special: "bg-pink-100 text-pink-800",
    default: "bg-slate-100 text-slate-800"
  };

  // Fallback to type-based colors if color_code is default or missing
  const typeFallback = {
    Alabanza: "worship",
    Plenaria: "preach",
    Break: "break",
    TechOnly: "tech",
    Especial: "special"
  };

  const effectiveColor = segment.color_code !== 'default' && segment.color_code 
    ? segment.color_code 
    : (typeFallback[segment.segment_type] || 'default');

  return (
    <div className="grid grid-cols-12 gap-2 items-center p-2 hover:bg-gray-50 border-b text-sm group">
      {/* Time & Duration */}
      <div className="col-span-2 text-xs text-gray-500">
        <div className="font-medium text-gray-900">{formatTimeToEST(segment.start_time)}</div>
        <div>{segment.duration_min}m</div>
      </div>

      {/* Title & Type */}
      <div className="col-span-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={`px-1 py-0 text-[10px] uppercase ${colorSchemes[effectiveColor] || colorSchemes.default}`}>
            {segment.segment_type?.substring(0, 3)}
          </Badge>
          <span className="font-medium truncate" title={segment.title}>{segment.title}</span>
        </div>
        
        {/* Content Pills */}
        <div className="flex flex-wrap gap-1 mt-1">
            {segment.segment_type === 'Alabanza' && (
                <Badge variant="outline" className="text-[9px] h-4 px-1 cursor-pointer hover:bg-blue-50" onClick={onEditDetails}>
                    <Music className="w-3 h-3 mr-1" />
                    {segment.number_of_songs || 0} canciones
                </Badge>
            )}
            {segment.segment_type === 'Plenaria' && segment.message_title && (
                <Badge variant="outline" className="text-[9px] h-4 px-1 max-w-[120px] truncate cursor-pointer hover:bg-purple-50" onClick={onEditDetails}>
                    <BookOpen className="w-3 h-3 mr-1" />
                    {segment.message_title}
                </Badge>
            )}
        </div>
      </div>

      {/* Presenter Inline Edit */}
      <div className="col-span-2">
        <div className="space-y-1">
            <div className="relative">
                <User className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input 
                    className="h-7 text-xs pl-6" 
                    value={localPresenter}
                    onChange={(e) => { setLocalPresenter(e.target.value); setIsDirty(true); }}
                    onBlur={handleBlur}
                    placeholder="Líder..."
                />
            </div>
            {segment.segment_type === 'Alabanza' && (
                <p className="text-[9px] text-gray-500 leading-tight">
                    💡 Sarah/Anthony o Director de Banda
                </p>
            )}
        </div>
      </div>

      {/* Toggles */}
      <div className="col-span-3 flex items-center gap-3 justify-end">
         {/* Video Toggle */}
         <button 
            onClick={() => onUpdate(segment.id, { has_video: !segment.has_video })}
            className={`p-1 rounded transition-colors ${segment.has_video ? 'text-red-600 bg-red-50' : 'text-gray-300 hover:text-gray-400'}`}
            title="Tiene Video"
        >
            <Video className="w-4 h-4" />
        </button>

        {/* Translation Toggle + Input */}
        <div className="flex items-center gap-1">
            <button 
                onClick={() => onUpdate(segment.id, { requires_translation: !segment.requires_translation })}
                className={`p-1 rounded transition-colors ${segment.requires_translation ? 'text-blue-600 bg-blue-50' : 'text-gray-300 hover:text-gray-400'}`}
                title="Requiere Traducción"
            >
                <Globe className="w-4 h-4" />
            </button>
            {segment.requires_translation && (
                 <Input 
                 className="h-6 w-20 text-[10px] px-1" 
                 value={localTranslator}
                 onChange={(e) => { setLocalTranslator(e.target.value); setIsDirty(true); }}
                 onBlur={handleBlur}
                 placeholder="Trad..."
             />
            )}
        </div>
      </div>

      {/* Actions */}
      <div className="col-span-2 flex justify-end">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onEditDetails}>
            <MoreHorizontal className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
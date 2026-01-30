import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Save, X, FileText, Plus, Trash2, ChevronDown, ChevronUp, ScrollText, Bell, ListChecks, Zap } from "lucide-react";
import OverlapDetectedDialog from "./OverlapDetectedDialog";
import ShiftPreviewModal from "./ShiftPreviewModal";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import TimePicker from "@/components/ui/TimePicker";
import { formatTimeToEST } from "@/components/utils/timeFormat";
import SegmentTimelinePreview from "./SegmentTimelinePreview";
import { FieldOriginIndicator, getFieldOrigin } from "@/components/utils/fieldOrigins";
import AnnouncementSeriesManager from "../announcements/AnnouncementSeriesManager";
import { useLanguage } from "@/components/utils/i18n";
import { toast } from "sonner";

// Break type hidden from UI but kept in schema for backwards compatibility
// Receso = short breaks (coffee, transition); Almuerzo = meal breaks
const SEGMENT_TYPES = [
  "Alabanza", "Bienvenida", "Ofrenda", "Plenaria", "Video",
  "Anuncio", "Dinámica", "TechOnly", "Oración", 
  "Especial", "Cierre", "MC", "Ministración", "Receso", "Almuerzo", "Artes", "Panel", "Breakout"
];

const TYPE_TO_COLOR = {
  "Alabanza": "worship",
  "Plenaria": "preach",
  "Panel": "special",
  "Break": "break",
  "Receso": "break",
  "Almuerzo": "break",
  "TechOnly": "tech",
  "Video": "tech",
  "Especial": "special",
  "Artes": "special",
  "Ministración": "special",
};

const getColorForType = (type) => {
  return TYPE_TO_COLOR[type] || "default";
};

const DEPARTMENTS = [
  "Admin", "MC", "Sound", "Projection", "Hospitality", "Ujieres", "Kids", "Coordinador", "Stage & Decor", "Alabanza", "Translation", "Other"
];

const ACTION_TIMINGS = [
  { value: "before_start", label: "Antes de iniciar" },
  { value: "after_start", label: "Después de iniciar" },
  { value: "before_end", label: "Antes de terminar" },
  { value: "absolute", label: "Hora exacta" }
];

export default function SegmentFormTwoColumn({ session, segment, templates, onClose, sessionId }) {
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [breakoutRooms, setBreakoutRooms] = useState(segment?.breakout_rooms || []);
  const [showSeriesManager, setShowSeriesManager] = useState(false);
  
  // Fetch announcement series for selection
  const { data: announcementSeries = [] } = useQuery({
    queryKey: ['announcementSeries'],
    queryFn: () => base44.entities.AnnouncementSeries.list(),
  });

  // Fetch segments to calculate suggested start time and validate overlaps
  const { data: allSegments = [] } = useQuery({
    queryKey: ['segments', sessionId],
    queryFn: () => base44.entities.Segment.filter({ session_id: sessionId }, 'order'),
    enabled: !!sessionId,
  });

  // Determine next sequential order for new segments (fallback to 1)
  const nextOrder = React.useMemo(() => {
    if (!allSegments || allSegments.length === 0) return 1;
    const max = Math.max(...allSegments.map(s => Number(s.order) || 0));
    return (isFinite(max) ? max : 0) + 1;
  }, [allSegments]);
  
  // Calculate suggested start time for new segments
  const getSuggestedStartTime = () => {
    if (segment) return segment.start_time || "";
    if (allSegments.length === 0) return session?.planned_start_time || "";
    
    const sortedSegments = [...allSegments].sort((a, b) => (a.order || 0) - (b.order || 0));
    const lastSegment = sortedSegments[sortedSegments.length - 1];
    return lastSegment.end_time || lastSegment.start_time || "";
  };
  
  const [formData, setFormData] = useState({
    title: segment?.title || "",
    segment_type: segment?.segment_type || "Plenaria",
    presenter: segment?.presenter || "",
    description_details: segment?.description_details || "",
    prep_instructions: segment?.prep_instructions || "",
    start_time: segment?.start_time || getSuggestedStartTime(),
    duration_min: segment?.duration_min || 30,
    projection_notes: segment?.projection_notes || "",
    sound_notes: segment?.sound_notes || "",
    ushers_notes: segment?.ushers_notes || "",
    translation_notes: segment?.translation_notes || "",
    stage_decor_notes: segment?.stage_decor_notes || "",
    other_notes: segment?.other_notes || "",
    show_in_general: segment?.show_in_general ?? true,
    show_in_projection: segment?.show_in_projection ?? true,
    show_in_sound: segment?.show_in_sound ?? true,
    show_in_ushers: segment?.show_in_ushers ?? true,
    color_code: segment?.color_code || "default",
    order: segment?.order || 1,
    message_title: segment?.message_title || "",
    scripture_references: segment?.scripture_references || "",
    number_of_songs: segment?.number_of_songs || 3,
    song_1_title: segment?.song_1_title || "",
    song_1_lead: segment?.song_1_lead || "",
    song_2_title: segment?.song_2_title || "",
    song_2_lead: segment?.song_2_lead || "",
    song_3_title: segment?.song_3_title || "",
    song_3_lead: segment?.song_3_lead || "",
    song_4_title: segment?.song_4_title || "",
    song_4_lead: segment?.song_4_lead || "",
    song_5_title: segment?.song_5_title || "",
    song_5_lead: segment?.song_5_lead || "",
    song_6_title: segment?.song_6_title || "",
    song_6_lead: segment?.song_6_lead || "",
    requires_translation: segment?.requires_translation || false,
    translation_mode: segment?.translation_mode || "InPerson",
    translator_name: segment?.translator_name || "",
    panel_moderators: segment?.panel_moderators || "",
    panel_panelists: segment?.panel_panelists || "",
    major_break: segment?.major_break || false,
    room_id: segment?.room_id || "",
    has_video: segment?.has_video || false,
    video_name: segment?.video_name || "",
    video_location: segment?.video_location || "",
    video_owner: segment?.video_owner || "",
    video_length_sec: segment?.video_length_sec || 0,
    art_types: segment?.art_types || [],
    drama_handheld_mics: segment?.drama_handheld_mics || 0,
    drama_headset_mics: segment?.drama_headset_mics || 0,
    drama_start_cue: segment?.drama_start_cue || "",
    drama_end_cue: segment?.drama_end_cue || "",
    drama_has_song: segment?.drama_has_song || false,
    drama_song_title: segment?.drama_song_title || "",
    drama_song_source: segment?.drama_song_source || "",
    drama_song_owner: segment?.drama_song_owner || "",
    dance_has_song: segment?.dance_has_song || false,
    dance_song_title: segment?.dance_song_title || "",
    dance_song_source: segment?.dance_song_source || "",
    dance_song_owner: segment?.dance_song_owner || "",
    dance_handheld_mics: segment?.dance_handheld_mics || 0,
    dance_headset_mics: segment?.dance_headset_mics || 0,
    dance_start_cue: segment?.dance_start_cue || "",
    dance_end_cue: segment?.dance_end_cue || "",
    art_other_description: segment?.art_other_description || "",
    announcement_title: segment?.announcement_title || "",
    announcement_description: segment?.announcement_description || "",
    announcement_date: segment?.announcement_date || "",
    announcement_tone: segment?.announcement_tone || "",
    announcement_series_id: segment?.announcement_series_id || "",
    segment_actions: segment?.segment_actions || [],
  });

  const [fieldOrigins, setFieldOrigins] = useState(segment?.field_origins || {});

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (fieldOrigins[field] && fieldOrigins[field] !== 'manual') {
      setFieldOrigins(prev => ({ ...prev, [field]: 'manual' }));
    }
  };

  const calculateTimes = (startTime, durationMin) => {
    if (!startTime || !durationMin) return { end_time: "" };
    
    const [hours, minutes] = startTime.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + durationMin;

    const formatTime = (totalMinutes) => {
      const h = Math.floor(totalMinutes / 60) % 24;
      const m = totalMinutes % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    return {
      end_time: formatTime(endMinutes)
    };
  };

  const times = calculateTimes(
    formData.start_time,
    formData.duration_min
  );

  useEffect(() => {
    if (selectedTemplate) {
      const template = templates.find(t => t.id === selectedTemplate);
      if (template) {
        setFormData(prev => ({
          ...prev,
          title: template.default_title || prev.title,
          segment_type: template.segment_type,
          duration_min: template.default_duration_min || prev.duration_min,
          projection_notes: template.default_projection_notes || "",
          sound_notes: template.default_sound_notes || "",
          ushers_notes: template.default_ushers_notes || "",
          color_code: template.default_color_code || "default",
          show_in_general: template.show_in_general ?? true,
          show_in_projection: template.show_in_projection ?? true,
          show_in_sound: template.show_in_sound ?? true,
          show_in_ushers: template.show_in_ushers ?? true,
        }));

        // Mark fields from template
        setFieldOrigins(prev => ({
          ...prev,
          title: template.default_title ? 'template' : prev.title,
          segment_type: 'template',
          duration_min: template.default_duration_min ? 'template' : prev.duration_min,
          projection_notes: template.default_projection_notes ? 'template' : 'manual',
          sound_notes: template.default_sound_notes ? 'template' : 'manual',
          ushers_notes: template.default_ushers_notes ? 'template' : 'manual',
          color_code: template.default_color_code ? 'template' : 'manual',
        }));
      }
    }
  }, [selectedTemplate, templates]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Segment.create(data),
    onSuccess: () => {
      // Ensure the list re-sorts by time after a fractional-order insert
      queryClient.invalidateQueries(['segments', sessionId]);
      onClose();
      // Optional: small success toast (bilingual)
      // toast.success(language === 'es' ? 'Segmento creado' : 'Segment created');
    },
    onError: () => {
      toast.error(t('error.save_failed'));
    },
  });

  // State for conflict + preview modals
  const [showOverlapDialog, setShowOverlapDialog] = useState(false);
  const [overlapText, setOverlapText] = useState("");
  const [showShiftPreview, setShowShiftPreview] = useState(false);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Segment.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['segments', sessionId]);
      onClose();
    },
    onError: () => {
      toast.error(t('error.save_failed'));
    },
  });



  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => base44.entities.Room.list(),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Basic required fields validation (bilingual toast)
    const isBreakTypeNow = ["Break", "Receso", "Almuerzo"].includes(formData.segment_type);
    const isTechOnlyNow = formData.segment_type === "TechOnly";
    const isBreakoutTypeNow = formData.segment_type === "Breakout";
    const needsPresenterNow = !isBreakTypeNow && !isTechOnlyNow && !isBreakoutTypeNow;

    const missing = [];
    if (!formData.title?.trim()) missing.push(t('field.title'));
    if (!formData.start_time) missing.push(t('field.start_time'));
    if (!formData.duration_min || formData.duration_min <= 0) missing.push(t('field.duration_min'));
    // Presenter not required for break types (Receso/Almuerzo) - it's optional
    const isBreakTypeNowForValidation = ["Break", "Receso", "Almuerzo"].includes(formData.segment_type);
    if (needsPresenterNow && !isBreakTypeNowForValidation && !formData.presenter?.trim()) missing.push(t('field.presenter'));
    if (missing.length > 0) {
      toast.error(`${t('error.required_fields_missing')}: ${missing.join(', ')}`);
      return;
    }

    // Validate segment times don't overlap with other segments in the same session
    if (formData.start_time && times.end_time && allSegments) {
      const otherSegments = allSegments.filter(s => s.id !== segment?.id);
      
      for (const existingSegment of otherSegments) {
        if (existingSegment.start_time && existingSegment.end_time) {
          const newStart = formData.start_time;
          const newEnd = times.end_time;
          const existingStart = existingSegment.start_time;
          const existingEnd = existingSegment.end_time;
          
          // Check for overlap
          if ((newStart >= existingStart && newStart < existingEnd) ||
              (newEnd > existingStart && newEnd <= existingEnd) ||
              (newStart <= existingStart && newEnd >= existingEnd)) {
            setOverlapText(`El segmento se solapa con "${existingSegment.title}" (${formatTimeToEST(existingStart)} - ${formatTimeToEST(existingEnd)}). ${language === 'es' ? 'Por favor ajusta los horarios o elige ajustar segmentos posteriores.' : 'Please adjust times or choose to shift downstream segments.'}`);
            setShowOverlapDialog(true);
            return;
          }
        }
      }
    }

    // Determine auto-insertion order by time (Option 1 - Gap-Fit, order-only)
    // Only for new segments, when live adjustments are OFF, and we have valid time/duration.
    let insertionOrder = null;
    if (!segment && !session?.live_adjustment_enabled && formData.start_time && formData.duration_min && allSegments?.length) {
      const parse = (t) => {
        const [h, m] = String(t).split(":").map(Number);
        return (isFinite(h) && isFinite(m)) ? h * 60 + m : null;
      };
      const newStartMin = parse(formData.start_time);
      const newEndMin = newStartMin != null ? newStartMin + Number(formData.duration_min) : null;
      if (newStartMin != null && newEndMin != null) {
        // Consider only segments with both start and end times; sort by time
        const byTime = allSegments
          .filter(s => s.start_time && s.end_time)
          .sort((a, b) => (parse(a.start_time) ?? 0) - (parse(b.start_time) ?? 0));

        const sessionStartMin = session?.planned_start_time ? parse(session.planned_start_time) : null;
        let prev = null;
        for (let i = 0; i < byTime.length; i++) {
          const next = byTime[i];
          const gapStart = prev ? parse(prev.end_time) : (sessionStartMin ?? parse(next.start_time));
          const gapEnd = parse(next.start_time);
          // Fits entirely within the gap (boundaries inclusive)
          if (gapStart != null && gapEnd != null && newStartMin >= gapStart && newEndMin <= gapEnd) {
            const prevOrder = prev ? Number(prev.order) || 0 : 0;
            const nextOrderVal = Number(next.order) || (prevOrder + 1);
            // Place between prev and next using fractional order to avoid touching others
            insertionOrder = prev ? (prevOrder + nextOrderVal) / 2 : (nextOrderVal - 0.5);
            break;
          }
          prev = next;
        }
      }
    }

    const data = {
      session_id: sessionId,
      ...formData,
      // Ensure a proper sequential order for new segments
      // Only assign order when creating; preserve existing order on edits
      ...(segment ? {} : { order: insertionOrder ?? nextOrder }),
      ...times,
      // Only include breakout_rooms for Breakout type; undefined fields are omitted by JSON.stringify
      breakout_rooms: formData.segment_type === "Breakout" ? breakoutRooms : undefined,
      field_origins: fieldOrigins,
    };

    if (segment) {
      // If an overlap was detected we halt earlier and show the guided fix.
      updateMutation.mutate({ id: segment.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const addBreakoutRoom = () => {
    setBreakoutRooms([...breakoutRooms, {
      room_id: "",
      hosts: "",
      speakers: "",
      topic: "",
      general_notes: "",
      other_notes: "",
      requires_translation: false,
      translation_mode: "InPerson",
      translator_name: ""
    }]);
  };

  const removeBreakoutRoom = (index) => {
    setBreakoutRooms(breakoutRooms.filter((_, i) => i !== index));
  };

  const updateBreakoutRoom = (index, field, value) => {
    const updated = [...breakoutRooms];
    updated[index] = { ...updated[index], [field]: value };
    setBreakoutRooms(updated);
  };

  const isWorshipType = formData.segment_type === "Alabanza";
  const isPlenariaType = formData.segment_type === "Plenaria";
  const isBreakType = ["Break", "Receso", "Almuerzo"].includes(formData.segment_type);
  const isTechOnly = formData.segment_type === "TechOnly";
  const isBreakoutType = formData.segment_type === "Breakout";
  const isVideoType = formData.segment_type === "Video";
  const isArtesType = formData.segment_type === "Artes";
  const isPanelType = formData.segment_type === "Panel";
  const isMcLedType = ["Bienvenida", "Ofrenda", "Anuncio", "Dinámica", "Oración", "Especial", "Cierre", "MC", "Ministración"].includes(formData.segment_type);
  const isAnnouncementType = formData.segment_type === "Anuncio";
  
  // Break types (Receso/Almuerzo) can have optional presenter (person managing stage transition)
  const needsPresenter = !isTechOnly && !isBreakoutType && !isPanelType; // dynamic required depending on type
  const presenterOptionalForBreak = isBreakType; // presenter is optional but available for breaks
  const showDescription = !isTechOnly && !isVideoType;
  const showTranslation = !isBreakoutType; // Now available for break types too
  const showUshersNotes = !isBreakType && !isTechOnly && !isBreakoutType;
  const showProjectionNotes = !isBreakType && !isBreakoutType;
  const showSoundNotes = !isBreakType && !isBreakoutType;
  const showOtherNotes = !isBreakoutType;
  const showActions = true; // Now available for all types including breaks
  const requiresSala = !isBreakoutType;

  // Auto-default Sala to 'Santuario' when required and empty
  useEffect(() => {
    if (requiresSala && !formData.room_id && rooms && rooms.length) {
      const santuario = rooms.find(r => typeof r.name === 'string' && r.name.toLowerCase().includes('santuario'));
      if (santuario) {
        setFormData(prev => ({ ...prev, room_id: santuario.id }));
      }
    }
  }, [requiresSala, rooms]);



  // Computed submit readiness: enables the "Crear" button only when required fields are filled
  // Allow placeholders: admins may intentionally leave fields as 'TBD' or '---' when scaffolding
  const isPlaceholder = (val) => typeof val === 'string' && /^(tbd|por definir|---)$/i.test(val.trim());
  const hasValueOrPlaceholder = (val) => Boolean(val && String(val).trim()) || isPlaceholder(val);

  // Presenter is optional for break types
  const canSubmit = hasValueOrPlaceholder(formData.title) &&
    Boolean(formData.segment_type) &&
    (!needsPresenter || presenterOptionalForBreak || hasValueOrPlaceholder(formData.presenter)) &&
    (!requiresSala || Boolean(formData.room_id));
  
  const hasDrama = formData.art_types?.includes("DRAMA");
  const hasDance = formData.art_types?.includes("DANCE");
  const hasArtVideo = formData.art_types?.includes("VIDEO");
  const hasOtherArt = formData.art_types?.includes("OTHER");

  // Toggle helper for Artes multiselect
  const toggleArtType = (val) => {
    const set = new Set(formData.art_types || []);
    if (set.has(val)) set.delete(val); else set.add(val);
    setFormData(prev => ({ ...prev, art_types: Array.from(set) }));
  };

  // Returns the dynamic label for the presenter field based on type and language
  const getPresenterLabel = () => {
    if (isPlenariaType) return language === 'es' ? 'Predicador' : 'Preacher';
    if (isWorshipType) return language === 'es' ? 'Líder de Alabanza' : 'Worship Leader';
    if (isArtesType) return language === 'es' ? 'Grupo / Director' : 'Group / Director';
    if (isBreakType) return language === 'es' ? 'Encargado de Transición' : 'Transition Host';
    return t('field.presenter');
  };

  // Auto-lock has_video for Video type
  React.useEffect(() => {
    if (isVideoType && !formData.has_video) {
      setFormData(prev => ({ ...prev, has_video: true }));
    }
  }, [isVideoType]);

  // Auto-enable video when Artes includes VIDEO type
  React.useEffect(() => {
    if (isArtesType && formData.art_types?.includes('VIDEO') && !formData.has_video) {
      setFormData(prev => ({ ...prev, has_video: true }));
    }
  }, [isArtesType, formData.art_types]);

  const handleAddAction = () => {
    const newAction = {
      label: "",
      department: "Other",
      timing: "before_start",
      offset_min: 5,
      notes: ""
    };
    setFormData({...formData, segment_actions: [...formData.segment_actions, newAction]});
  };

  const handleUpdateAction = (index, field, value) => {
    const newActions = [...formData.segment_actions];
    newActions[index] = {...newActions[index], [field]: value};
    setFormData({...formData, segment_actions: newActions});
  };

  const handleDeleteAction = (index) => {
    const newActions = formData.segment_actions.filter((_, i) => i !== index);
    setFormData({...formData, segment_actions: newActions});
  };

  const scrollToSection = (sectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const colorCodeLabels = {
    worship: "Adoración",
    preach: "Predicación",
    break: "Descanso",
    tech: "Técnico",
    special: "Especial",
    default: "Predeterminado"
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      {/* Sticky Summary Header */}
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm px-6 py-3">
        <div className="flex items-center justify-between gap-4 mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg truncate">{formData.title || "Nuevo Segmento"}</h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mt-1">
              <Badge variant="outline" className="text-xs">{formData.segment_type}</Badge>
              {formData.presenter && <span>• {formData.presenter}</span>}
              {formData.start_time && <span>• {formatTimeToEST(formData.start_time)}</span>}
              {times.end_time && <span>→ {formatTimeToEST(times.end_time)}</span>}
              {formData.duration_min && <span>({formData.duration_min}m)</span>}
              {formData.requires_translation && <Badge className="bg-purple-100 text-purple-800 text-xs">TRAD</Badge>}
              <span>• {colorCodeLabels[formData.color_code]}</span>
            </div>
          </div>
        </div>

        {/* Anchor Navigation */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button type="button" onClick={() => scrollToSection('basico')} className="flex-shrink-0 text-xs px-2 py-1 rounded hover:bg-slate-100 whitespace-nowrap">Básico</button>
          <button type="button" onClick={() => scrollToSection('contenido')} className="flex-shrink-0 text-xs px-2 py-1 rounded hover:bg-slate-100 whitespace-nowrap">Contenido</button>
          <button type="button" onClick={() => scrollToSection('acciones')} className="flex-shrink-0 text-xs px-2 py-1 rounded hover:bg-slate-100 whitespace-nowrap">Acciones</button>
          <button type="button" onClick={() => scrollToSection('notas')} className="flex-shrink-0 text-xs px-2 py-1 rounded hover:bg-slate-100 whitespace-nowrap">Notas</button>
          <button type="button" onClick={() => scrollToSection('otros')} className="flex-shrink-0 text-xs px-2 py-1 rounded hover:bg-slate-100 whitespace-nowrap">Otros</button>
          {segment && <button type="button" onClick={() => scrollToSection('timeline')} className="flex-shrink-0 text-xs px-2 py-1 rounded hover:bg-slate-100 whitespace-nowrap flex items-center gap-1"><ScrollText className="w-3 h-3"/>Timeline</button>}
        </div>
      </div>

      <div>
        <div className="grid md:grid-cols-2 gap-6 p-6">
          {/* LEFT COLUMN - Content */}
          <div className="space-y-6">
            <div id="basico" className="bg-white rounded-lg border border-l-4 border-l-pdv-teal border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-pdv-teal"></div>
                <h3 className="font-bold text-lg text-slate-900">Información Básica</h3>
              </div>
              
              <div className="p-4">
              {!segment && templates.length > 0 && (
                <Card className="p-3 bg-blue-50 border-blue-200 mb-4">
                  <Label htmlFor="template" className="text-sm">Usar Plantilla</Label>
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger className="mt-1 bg-white">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Card>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <Input 
                      id="title" 
                      value={formData.title}
                      onChange={(e) => updateField('title', e.target.value)}
                      required 
                      placeholder="PLENARIA #1: Conquistando"
                    />
                    <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'title')} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="segment_type">Tipo <span className="text-red-500">*</span></Label>
                    <Select 
                      value={formData.segment_type}
                      onValueChange={(value) => {
                        updateField('segment_type', value);
                        // Auto-update color based on type
                        setFormData(prev => ({ ...prev, segment_type: value, color_code: getColorForType(value) }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SEGMENT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {needsPresenter && (
                  <div className="space-y-2">
                    <Label htmlFor="presenter">
                      {isBreakType ? (language === 'es' ? 'Encargado de Transición' : 'Transition Host') : getPresenterLabel()}
                      {!presenterOptionalForBreak && <span className="text-red-500">*</span>}
                    </Label>
                    <div className="relative">
                      <Input 
                        id="presenter" 
                        value={formData.presenter}
                        onChange={(e) => updateField('presenter', e.target.value)}
                        placeholder={isBreakType ? (language === 'es' ? 'Persona dando instrucciones (opcional)' : 'Person giving instructions (optional)') : "Nombre"}
                      />
                      <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'presenter')} />
                    </div>
                    {isBreakType && (
                      <p className="text-xs text-gray-500">
                        {language === 'es' 
                          ? 'Persona que da instrucciones desde la tarima durante el receso' 
                          : 'Person giving stage instructions during the break'}
                      </p>
                    )}
                  </div>
                )}

                {!isBreakoutType && (
                  <div className="space-y-2">
                    <Label htmlFor="room_id">Sala {requiresSala && <span className="text-red-500">*</span>}</Label>
                    <Select 
                      value={formData.room_id}
                      onValueChange={(value) => setFormData({...formData, room_id: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar sala..." />
                      </SelectTrigger>
                      <SelectContent>
                        {rooms.map((room) => (
                          <SelectItem key={room.id} value={room.id}>{room.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

              </div>
              </div>
            </div>

            <div id="contenido" className="bg-white rounded-lg border border-l-4 border-l-pdv-blue border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-pdv-blue"></div>
                <h3 className="font-bold text-lg text-slate-900">Contenido Específico</h3>
              </div>
              <div className="p-4 space-y-4">
                {isAnnouncementType && (
                  <div className="space-y-3 bg-indigo-50 p-4 rounded border border-indigo-200 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Bell className="w-5 h-5 text-indigo-600" />
                        <h4 className="font-bold text-indigo-800">Serie de Anuncios</h4>
                      </div>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setShowSeriesManager(true)}
                        className="bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                      >
                        <ListChecks className="w-4 h-4 mr-2" />
                        Gestionar Series
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Seleccionar Serie de Anuncios</Label>
                      <div className="relative">
                        <Select 
                          value={formData.announcement_series_id}
                          onValueChange={(value) => updateField('announcement_series_id', value)}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Seleccionar configuración..." />
                          </SelectTrigger>
                          <SelectContent>
                            {announcementSeries.map(series => (
                              <SelectItem key={series.id} value={series.id}>{series.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-xs text-indigo-700 mt-1">
                        Esta serie determina qué anuncios fijos y eventos dinámicos se mostrarán.
                      </p>
                    </div>

                    {/* Legacy Fields / Manual Overrides (Collapsible or simplified?) */}
                    {/* Keeping them accessible but secondary if manual override is needed */}
                    <div className="mt-4 pt-4 border-t border-indigo-200">
                        <Label className="text-xs font-bold text-indigo-800 uppercase mb-2 block">Overrides Manuales (Opcional)</Label>
                        <div className="space-y-2">
                            <Label className="text-xs">Título Alternativo (Sobreescribe nombre de serie)</Label>
                            <Input 
                                value={formData.announcement_title}
                                onChange={(e) => updateField('announcement_title', e.target.value)}
                                placeholder="Dejar vacío para usar nombre de serie"
                                className="bg-white h-8 text-sm"
                            />
                        </div>
                         <div className="space-y-2 mt-2">
                            <Label className="text-xs">Notas Adicionales</Label>
                            <Textarea 
                                value={formData.announcement_description}
                                onChange={(e) => updateField('announcement_description', e.target.value)}
                                rows={2}
                                placeholder="Notas extra específicas para este servicio..."
                                className="bg-white text-sm"
                            />
                        </div>
                    </div>
                  </div>
                )}
                {formData.has_video && (
                  <div className="space-y-3 bg-blue-50 p-4 rounded border border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="font-semibold">Video</Label>
                      {!isVideoType && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setFormData({...formData, has_video: false})}
                          className="text-red-600"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Nombre del Video *</Label>
                      <Input 
                        value={formData.video_name}
                        onChange={(e) => setFormData({...formData, video_name: e.target.value})}
                        placeholder="Video de Apertura"
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Ubicación</Label>
                      <Input 
                        value={formData.video_location}
                        onChange={(e) => setFormData({...formData, video_location: e.target.value})}
                        placeholder="ProPresenter > Videos > Opening.mp4"
                        className="text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label className="text-xs">Propietario</Label>
                        <Input 
                          value={formData.video_owner}
                          onChange={(e) => setFormData({...formData, video_owner: e.target.value})}
                          placeholder="PDV Media"
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Duración (seg)</Label>
                        <Input 
                          type="number"
                          value={formData.video_length_sec}
                          onChange={(e) => setFormData({...formData, video_length_sec: parseInt(e.target.value) || 0})}
                          placeholder="120"
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {!formData.has_video && !isVideoType && !isBreakType && !isTechOnly && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData({...formData, has_video: true})}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Añadir Video
                  </Button>
                )}

                {isArtesType && (
                  <div className="space-y-3 bg-pink-50 p-4 rounded border border-pink-200">
                    <div className="flex items-center justify-between mb-1">
                      <Label className="font-semibold">Artes</Label>
                    </div>

                    {/* Art Types Selection */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {['DANCE','DRAMA','VIDEO','OTHER'].map((opt) => (
                        <label key={opt} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={Array.isArray(formData.art_types) && formData.art_types.includes(opt)}
                            onCheckedChange={() => toggleArtType(opt)}
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>

                    {/* DANCE Block */}
                    {hasDance && (
                      <div className="space-y-3 bg-white p-3 rounded border border-pink-100">
                        <div className="grid md:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-xs">{language === 'es' ? 'Canción' : 'Song'}</Label>
                            <Input 
                              value={formData.dance_song_title} 
                              onChange={(e)=>setFormData({...formData, dance_song_title: e.target.value})} 
                              placeholder={language === 'es' ? 'Título de canción' : 'Song title'} 
                              className="h-9 text-sm" 
                            />
                            <div>
                              <Label className="text-[11px] text-gray-700">{language === 'es' ? 'Fuente / ubicación' : 'Source / location'}</Label>
                              <Textarea 
                                rows={2}
                                value={formData.dance_song_source} 
                                onChange={(e)=>setFormData({...formData, dance_song_source: e.target.value})} 
                                placeholder={language === 'es' ? 'URL, ruta de ProPresenter u otras instrucciones' : 'URL, ProPresenter path, or other instructions'} 
                                className="text-sm" 
                              />
                            </div>
                            <div>
                              <Label className="text-[11px] text-gray-700">{language === 'es' ? 'Responsable del medio' : 'Media owner/responsible'}</Label>
                              <Input 
                                value={formData.dance_song_owner} 
                                onChange={(e)=>setFormData({...formData, dance_song_owner: e.target.value})} 
                                placeholder={language === 'es' ? 'Quién provee/controla este audio (equipo o persona)' : 'Who provides/controls this audio (team or person)'} 
                                className="h-9 text-sm" 
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Handheld</Label>
                              <Input type="number" value={formData.dance_handheld_mics} onChange={(e)=>setFormData({...formData, dance_handheld_mics: parseInt(e.target.value)||0})} className="h-9 text-sm" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Headset</Label>
                              <Input type="number" value={formData.dance_headset_mics} onChange={(e)=>setFormData({...formData, dance_headset_mics: parseInt(e.target.value)||0})} className="h-9 text-sm" />
                            </div>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{language === 'es' ? 'Cues de inicio y fin' : 'Start and end cues'}</Label>
                          <div className="grid md:grid-cols-2 gap-2">
                            <Textarea 
                              rows={2}
                              value={formData.dance_start_cue} 
                              onChange={(e)=>setFormData({...formData, dance_start_cue: e.target.value})} 
                              placeholder={language === 'es' ? 'Cue inicio (ej. "Bailarines por derecha, FOH preparado")' : 'Start cue (e.g., "Dancers from stage right, FOH ready")'} 
                              className="text-sm" 
                            />
                            <Textarea 
                              rows={2}
                              value={formData.dance_end_cue} 
                              onChange={(e)=>setFormData({...formData, dance_end_cue: e.target.value})} 
                              placeholder={language === 'es' ? 'Cue fin (ej. "Fade a negro; MC entra por izquierda")' : 'End cue (e.g., "Fade to black; MC enters from left")'} 
                              className="text-sm" 
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* DRAMA Block */}
                    {hasDrama && (
                      <div className="space-y-3 bg-white p-3 rounded border border-pink-100">
                        <div className="grid grid-cols-2 gap-2 md:max-w-md">
                          <div className="space-y-1">
                            <Label className="text-xs">Handheld</Label>
                            <Input type="number" value={formData.drama_handheld_mics} onChange={(e)=>setFormData({...formData, drama_handheld_mics: parseInt(e.target.value)||0})} className="h-9 text-sm" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Headset</Label>
                            <Input type="number" value={formData.drama_headset_mics} onChange={(e)=>setFormData({...formData, drama_headset_mics: parseInt(e.target.value)||0})} className="h-9 text-sm" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{language === 'es' ? 'Cues de inicio y fin' : 'Start and end cues'}</Label>
                          <div className="grid md:grid-cols-2 gap-2">
                            <Textarea 
                              rows={2}
                              value={formData.drama_start_cue} 
                              onChange={(e)=>setFormData({...formData, drama_start_cue: e.target.value})} 
                              placeholder={language === 'es' ? 'Cue inicio (ej. "Actores preparados; cortina a media")' : 'Start cue (e.g., "Actors ready; curtain half")'} 
                              className="text-sm" 
                            />
                            <Textarea 
                              rows={2}
                              value={formData.drama_end_cue} 
                              onChange={(e)=>setFormData({...formData, drama_end_cue: e.target.value})} 
                              placeholder={language === 'es' ? 'Cue fin (ej. "Oscuro total; MC entra por centro")' : 'End cue (e.g., "Full blackout; MC enters center")'} 
                              className="text-sm" 
                            />
                          </div>
                        </div>
                        <div className="col-span-2 flex items-center gap-2 mt-1">
                          <Checkbox id="drama_has_song" checked={formData.drama_has_song} onCheckedChange={(checked)=>setFormData({...formData, drama_has_song: checked})} />
                          <label htmlFor="drama_has_song" className="text-xs">{language === 'es' ? 'Incluye canción' : 'Includes song'}</label>
                        </div>
                        {formData.drama_has_song && (
                          <div className="space-y-2">
                            <Label className="text-xs">{language === 'es' ? 'Canción (opcional)' : 'Song (optional)'}</Label>
                            <div className="grid md:grid-cols-3 gap-2">
                              <Input value={formData.drama_song_title} onChange={(e)=>setFormData({...formData, drama_song_title: e.target.value})} placeholder={language === 'es' ? 'Título' : 'Title'} className="h-9 text-sm" />
                              <Textarea rows={2} value={formData.drama_song_source} onChange={(e)=>setFormData({...formData, drama_song_source: e.target.value})} placeholder={language === 'es' ? 'Fuente / ubicación (URL, ruta, instrucciones)' : 'Source / location (URL, path, instructions)'} className="text-sm" />
                              <Input value={formData.drama_song_owner} onChange={(e)=>setFormData({...formData, drama_song_owner: e.target.value})} placeholder={language === 'es' ? 'Responsable del medio' : 'Media owner/responsible'} className="h-9 text-sm" />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* OTHER Block */}
                    {hasOtherArt && (
                      <div className="space-y-2 bg-white p-3 rounded border border-pink-100">
                        <Label className="text-xs">{language === 'es' ? 'Descripción (Otra)' : 'Description (Other)'}</Label>
                        <Textarea 
                          rows={3} 
                          value={formData.art_other_description} 
                          onChange={(e)=>setFormData({...formData, art_other_description: e.target.value})} 
                          placeholder={language === 'es' ? 'Describe brevemente la presentación (elementos, accesos, transiciones)' : 'Briefly describe the presentation (elements, entrances, transitions)'}
                          className="text-sm" 
                        />
                      </div>
                    )}

                    {/* Video hint */}
                    {hasArtVideo && !isVideoType && (
                      <p className="text-xs text-pink-700">Este segmento incluye VIDEO; añade detalles en la sección "Video" arriba.</p>
                    )}
                  </div>
                )}

                {isBreakoutType && (
                  <div className="space-y-3 bg-amber-50 p-4 rounded border border-amber-200">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="font-semibold">Salas Paralelas</Label>
                      <Button 
                        type="button"
                        size="sm" 
                        onClick={addBreakoutRoom}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Añadir Sala
                      </Button>
                    </div>

                    {breakoutRooms.length === 0 && (
                      <p className="text-sm text-gray-600 text-center py-4">
                        No hay salas definidas. Añade al menos una sala para el breakout.
                      </p>
                    )}

                    {breakoutRooms.map((room, index) => (
                      <Card key={index} className="p-3 bg-white border-gray-300">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline">Sala {index + 1}</Badge>
                          <Button 
                            type="button"
                            variant="ghost" 
                            size="sm"
                            onClick={() => removeBreakoutRoom(index)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Sala</Label>
                            <Select 
                              value={room.room_id}
                              onValueChange={(value) => updateBreakoutRoom(index, 'room_id', value)}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Seleccionar..." />
                              </SelectTrigger>
                              <SelectContent>
                                {rooms.map((r) => (
                                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Tema/Tópico</Label>
                            <Input 
                              value={room.topic}
                              onChange={(e) => updateBreakoutRoom(index, 'topic', e.target.value)}
                              placeholder="Nombre del taller o tópico"
                              className="h-8 text-sm"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Anfitrión(es) / Moderador(es)</Label>
                            <Input 
                              value={room.hosts}
                              onChange={(e) => updateBreakoutRoom(index, 'hosts', e.target.value)}
                              placeholder="Nombres de los anfitriones"
                              className="h-8 text-sm"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Presentador(es) / Panelistas</Label>
                            <Input 
                              value={room.speakers}
                              onChange={(e) => updateBreakoutRoom(index, 'speakers', e.target.value)}
                              placeholder="Nombres de los presentadores"
                              className="h-8 text-sm"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Notas de Producción</Label>
                            <Input 
                              value={room.general_notes}
                              onChange={(e) => updateBreakoutRoom(index, 'general_notes', e.target.value)}
                              placeholder="Instrucciones generales para producción"
                              className="h-8 text-sm"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Otras Notas</Label>
                            <Input 
                              value={room.other_notes}
                              onChange={(e) => updateBreakoutRoom(index, 'other_notes', e.target.value)}
                              placeholder="Instrucciones adicionales"
                              className="h-8 text-sm"
                            />
                          </div>

                          <div className="border-t border-gray-200 pt-2 mt-2">
                            <div className="flex items-center space-x-2 mb-2">
                              <Checkbox 
                                id={`requires_translation_${index}`}
                                checked={room.requires_translation}
                                onCheckedChange={(checked) => updateBreakoutRoom(index, 'requires_translation', checked)}
                              />
                              <label htmlFor={`requires_translation_${index}`} className="text-xs font-semibold cursor-pointer">
                                Requiere Traducción
                              </label>
                            </div>

                            {room.requires_translation && (
                              <div className="space-y-2">
                                <div className="space-y-1">
                                  <Label className="text-xs">Modo</Label>
                                  <Select
                                    value={room.translation_mode}
                                    onValueChange={(value) => updateBreakoutRoom(index, 'translation_mode', value)}
                                  >
                                    <SelectTrigger className="h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="InPerson">En Persona</SelectItem>
                                      <SelectItem value="RemoteBooth">Cabina Remota</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-1">
                                  <Label className="text-xs">
                                    {room.translation_mode === "InPerson" ? "Traductor (en persona)" : "Traductor (cabina)"}
                                  </Label>
                                  <Input 
                                    value={room.translator_name}
                                    onChange={(e) => updateBreakoutRoom(index, 'translator_name', e.target.value)}
                                    placeholder="Nombre"
                                    className="h-8 text-sm"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                {isWorshipType && (
                  <div className="space-y-3 bg-purple-50 p-4 rounded border border-purple-200">
                    <div className="flex items-center justify-between">
                      <Label>Canciones</Label>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">#</Label>
                        <Input 
                          type="number"
                          min="1"
                          max="6"
                          value={formData.number_of_songs}
                          onChange={(e) => setFormData({...formData, number_of_songs: parseInt(e.target.value) || 1})}
                          className="w-16 h-8"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-1">
                      <Label className="text-xs">Título</Label>
                      <Label className="text-xs">Vocalista</Label>
                    </div>

                    {[...Array(formData.number_of_songs || 0)].map((_, idx) => {
                      const songNum = idx + 1;
                      return (
                        <div key={songNum} className="grid grid-cols-2 gap-2">
                          <Input 
                            value={formData[`song_${songNum}_title`]}
                            onChange={(e) => setFormData({...formData, [`song_${songNum}_title`]: e.target.value})}
                            placeholder={`Canción ${songNum}`}
                            className="text-sm"
                          />
                          <Input 
                            value={formData[`song_${songNum}_lead`]}
                            onChange={(e) => setFormData({...formData, [`song_${songNum}_lead`]: e.target.value})}
                            placeholder="Nombre"
                            className="text-sm"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {isPlenariaType && (
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
                      <Label>Citas Bíblicas</Label>
                      <Input 
                        value={formData.scripture_references}
                        onChange={(e) => setFormData({...formData, scripture_references: e.target.value})}
                        placeholder="Juan 3:16, Romanos 8:28"
                      />
                    </div>
                  </div>
                )}

                {!isTechOnly && (
                  <div className="space-y-2">
                    <Label htmlFor="description_details">Descripción</Label>
                    <div className="relative">
                      <Textarea 
                        id="description_details" 
                        value={formData.description_details}
                        onChange={(e) => updateField('description_details', e.target.value)}
                        rows={3}
                        placeholder="Detalles adicionales"
                      />
                      <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'description_details')} />
                    </div>
                  </div>
                )}

                {isPanelType && (
                  <div className="space-y-3 bg-amber-50 p-4 rounded border border-amber-200">
                    <div className="grid md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>{language === 'es' ? 'Anfitrión(es) / Moderador(es)' : 'Host(s) / Moderator(s)'}</Label>
                        <Input 
                          value={formData.panel_moderators}
                          onChange={(e) => setFormData({...formData, panel_moderators: e.target.value})}
                          placeholder={language === 'es' ? 'Nombres de los moderadores' : 'Moderator names'}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>{language === 'es' ? 'Panelista(s)' : 'Panelist(s)'}</Label>
                        <Input 
                          value={formData.panel_panelists}
                          onChange={(e) => setFormData({...formData, panel_panelists: e.target.value})}
                          placeholder={language === 'es' ? 'Nombres de los panelistas' : 'Panelist names'}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}



                {isBreakType && (
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="major_break"
                      checked={formData.major_break}
                      onCheckedChange={(checked) => setFormData({...formData, major_break: checked})}
                    />
                    <label htmlFor="major_break" className="text-sm cursor-pointer">
                      Receso Mayor (Almuerzo/Cena)
                    </label>
                  </div>
                )}
              </div>
            </div>

            {showActions && (
              <div id="acciones" className="bg-white rounded-lg border border-l-4 border-l-orange-500 border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-orange-500" />
                    <h3 className="font-bold text-lg text-slate-900">Acciones / Tareas de Preparación</h3>
                  </div>
                  <Badge variant="outline" className="text-xs">{formData.segment_actions.length}</Badge>
                </div>
                <div className="p-4 space-y-3">
                  {formData.segment_actions.length === 0 ? (
                    <p className="text-sm text-gray-500 italic text-center py-2">No hay acciones definidas para este segmento.</p>
                  ) : (
                    formData.segment_actions.map((action, idx) => (
                      <Card key={idx} className="p-3 bg-orange-50/30 border-orange-200">
                        <div className="flex items-start gap-2 mb-2">
                          <Input 
                            placeholder="Etiqueta (ej: A&A sube)" 
                            className="flex-1 h-8 text-sm bg-white"
                            value={action.label || ""}
                            onChange={(e) => handleUpdateAction(idx, 'label', e.target.value)}
                          />
                          <Button 
                            type="button"
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-red-400 hover:text-red-600"
                            onClick={() => handleDeleteAction(idx)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          <Select 
                            value={action.department || "Other"} 
                            onValueChange={(val) => handleUpdateAction(idx, 'department', val)}
                          >
                            <SelectTrigger className="h-8 text-xs bg-white">
                              <SelectValue placeholder="Equipo" />
                            </SelectTrigger>
                            <SelectContent>
                              {DEPARTMENTS.map((dept) => (
                                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select 
                            value={action.timing || "before_end"} 
                            onValueChange={(val) => handleUpdateAction(idx, 'timing', val)}
                          >
                            <SelectTrigger className="h-8 text-xs bg-white">
                              <SelectValue placeholder="Timing" />
                            </SelectTrigger>
                            <SelectContent>
                              {ACTION_TIMINGS.map((t) => (
                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex items-center gap-1">
                            <Input 
                              type="number" 
                              className="h-8 text-xs w-16 bg-white"
                              value={action.offset_min || 0}
                              onChange={(e) => handleUpdateAction(idx, 'offset_min', parseInt(e.target.value) || 0)}
                            />
                            <span className="text-xs text-gray-500">min</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs mb-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${action.timing === 'before_start' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                            {action.timing === 'before_start' ? '⚡ PREP' : '▶ DURANTE'}
                          </span>
                        </div>
                        <Input 
                          placeholder="Notas adicionales..."
                          className="h-8 text-xs bg-white"
                          value={action.notes || ""}
                          onChange={(e) => handleUpdateAction(idx, 'notes', e.target.value)}
                        />
                      </Card>
                    ))
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddAction}
                    className="w-full border-dashed border-orange-300 text-orange-600 hover:bg-orange-50"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar Acción
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">

            {/* Segment Timeline Preview */}
            {segment && (
              <div id="timeline" className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
                <SegmentTimelinePreview segments={allSegments} currentSegmentId={segment.id} />
              </div>
            )}

            <div className="bg-white rounded-lg border border-l-4 border-l-pdv-orange border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-pdv-orange"></div>
                <h3 className="font-bold text-lg text-slate-900">Tiempos y Ejecución</h3>
              </div>

              <div className="p-4 space-y-4">
                <Card className="p-4 bg-blue-50 border-blue-200">
                  <Label className="font-semibold mb-3 block">Horarios *</Label>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Inicio <span className="text-red-500">*</span></Label>
                      <TimePicker
                        value={formData.start_time}
                        onChange={(val) => setFormData({...formData, start_time: val})}
                        placeholder="Seleccionar hora"
                        className="h-9"
                        invalid={!formData.start_time}
                        required
                      />
                      {!segment && allSegments && allSegments.length > 0 && (() => {
                        const sortedSegments = [...allSegments].sort((a, b) => (a.order || 0) - (b.order || 0));
                        const lastSegment = sortedSegments[sortedSegments.length - 1];
                        if (lastSegment?.end_time) {
                          return (
                            <p className="text-xs text-blue-600">
                              Debe ser después de {formatTimeToEST(lastSegment.end_time)} (fin de "{lastSegment.title}")
                            </p>
                          );
                        }
                      })()}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Duración (min) <span className="text-red-500">*</span></Label>
                      <Input 
                        type="number"
                        value={formData.duration_min}
                        onChange={(e) => setFormData({...formData, duration_min: parseInt(e.target.value)})}
                        className="h-9"
                        min="1"
                        required
                      />
                    </div>
                  </div>

                  {times.end_time && (
                    <div className="mt-3 text-sm text-slate-600 border-t border-blue-300 pt-2">
                      <div className="flex justify-between">
                        <span>Fin estimado:</span>
                        <span className="font-mono font-medium text-blue-700">{formatTimeToEST(times.end_time)}</span>
                      </div>
                    </div>
                  )}

                  {allSegments && allSegments.length > 0 && (
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                      ⚠️ Los segmentos no deben solaparse dentro de la sesión
                    </div>
                  )}
                </Card>

                {showTranslation && (
                  <Card className="p-4 bg-purple-50 border-purple-200">
                    <div className="flex items-center space-x-2 mb-3">
                      <Checkbox 
                        id="requires_translation"
                        checked={formData.requires_translation}
                        onCheckedChange={(checked) => setFormData({...formData, requires_translation: checked})}
                      />
                      <label htmlFor="requires_translation" className="font-semibold cursor-pointer">
                        Requiere Traducción
                      </label>
                    </div>

                    {formData.requires_translation && (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label className="text-xs">Modo</Label>
                          <Select
                            value={formData.translation_mode}
                            onValueChange={(value) => setFormData({...formData, translation_mode: value})}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="InPerson">En Persona (en tarima)</SelectItem>
                              <SelectItem value="RemoteBooth">Cabina Remota (audífonos)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs">
                            {formData.translation_mode === "InPerson" ? "Traductor (en tarima)" : "Traductor (cabina)"}
                          </Label>
                          <Input 
                            value={formData.translator_name}
                            onChange={(e) => setFormData({...formData, translator_name: e.target.value})}
                            placeholder="Nombre"
                            className="h-9"
                          />
                        </div>
                      </div>
                    )}
                  </Card>
                )}

                <div id="notas" className="bg-white rounded-lg border border-l-4 border-l-purple-500 border-slate-200 shadow-sm overflow-hidden mt-6">
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                    <h3 className="font-bold text-lg text-slate-900">Notas por Equipo</h3>
                  </div>
                  
                  <div className="p-4 space-y-3">
                  {isBreakoutType && (
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded text-sm">
                      <p className="text-gray-700">
                        Para segmentos de tipo Breakout, las notas se definen individualmente para cada sala en la sección de "Contenido Específico".
                      </p>
                    </div>
                  )}

                  {!isBreakType && !isBreakoutType && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs text-purple-700">Proyección</Label>
                        <div className="relative">
                          <Textarea 
                            value={formData.projection_notes}
                            onChange={(e) => updateField('projection_notes', e.target.value)}
                            rows={2}
                            placeholder="Slides, videos..."
                            className="text-sm"
                          />
                          <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'projection_notes')} />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs text-red-700">Sonido</Label>
                        <div className="relative">
                          <Textarea 
                            value={formData.sound_notes}
                            onChange={(e) => updateField('sound_notes', e.target.value)}
                            rows={2}
                            placeholder="Micrófonos, cues..."
                            className="text-sm"
                          />
                          <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'sound_notes')} />
                        </div>
                      </div>
                    </>
                  )}

                  {!isBreakType && !isTechOnly && !isBreakoutType && (
                    <div className="space-y-1">
                      <Label className="text-xs text-green-700">Ujieres</Label>
                      <div className="relative">
                        <Textarea 
                          value={formData.ushers_notes}
                          onChange={(e) => updateField('ushers_notes', e.target.value)}
                          rows={2}
                          placeholder="Instrucciones..."
                          className="text-sm"
                        />
                        <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'ushers_notes')} />
                      </div>
                    </div>
                  )}

                  {formData.requires_translation && !isBreakoutType && (
                    <div className="space-y-1">
                      <Label className="text-xs text-purple-700">Traducción</Label>
                      <Textarea 
                        value={formData.translation_notes}
                        onChange={(e) => setFormData({...formData, translation_notes: e.target.value})}
                        rows={2}
                        placeholder="Instrucciones para traductor..."
                        className="text-sm"
                      />
                    </div>
                  )}

                  {!isBreakType && !isBreakoutType && (
                    <div className="space-y-1">
                      <Label className="text-xs text-amber-700">Stage & Decor</Label>
                      <div className="relative">
                        <Textarea 
                          value={formData.stage_decor_notes}
                          onChange={(e) => updateField('stage_decor_notes', e.target.value)}
                          rows={2}
                          placeholder="Mover mesas, preparar escenario..."
                          className="text-sm"
                        />
                        <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'stage_decor_notes')} />
                      </div>
                    </div>
                  )}

                  {!isBreakoutType && (
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-700">Otras Notas</Label>
                      <div className="relative">
                        <Textarea 
                          value={formData.other_notes}
                          onChange={(e) => updateField('other_notes', e.target.value)}
                          rows={2}
                          className="text-sm"
                        />
                        <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'other_notes')} />
                      </div>
                    </div>
                  )}
                </div>

                </div>
                </div>
              </div>

                <div id="otros" className="bg-white rounded-lg border border-l-4 border-l-slate-500 border-slate-200 shadow-sm overflow-hidden mt-6">
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-slate-500"></div>
                    <h3 className="font-bold text-lg text-slate-900">Opciones de Visibilidad</h3>
                  </div>
                  <div className="p-4 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="show_in_general"
                        checked={formData.show_in_general}
                        onCheckedChange={(checked) => setFormData({...formData, show_in_general: checked})}
                      />
                      <label htmlFor="show_in_general" className="cursor-pointer">General</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="show_in_projection"
                        checked={formData.show_in_projection}
                        onCheckedChange={(checked) => setFormData({...formData, show_in_projection: checked})}
                      />
                      <label htmlFor="show_in_projection" className="cursor-pointer">Proyección</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="show_in_sound"
                        checked={formData.show_in_sound}
                        onCheckedChange={(checked) => setFormData({...formData, show_in_sound: checked})}
                      />
                      <label htmlFor="show_in_sound" className="cursor-pointer">Sonido</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="show_in_ushers"
                        checked={formData.show_in_ushers}
                        onCheckedChange={(checked) => setFormData({...formData, show_in_ushers: checked})}
                      />
                      <label htmlFor="show_in_ushers" className="cursor-pointer">Ujieres</label>
                    </div>
                  </div>
                </div>
          </div>
        </div>
      </div>
      </div>

      <div className="border-t bg-slate-50 p-4 flex justify-end gap-3 sticky bottom-0 z-20">
        <Button type="button" variant="outline" onClick={onClose}>
          <X className="w-4 h-4 mr-2" />
          {t('btn.cancel') || 'Cancelar'}
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button type="submit" disabled={!canSubmit} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                <Save className="w-4 h-4 mr-2" />
                {segment ? (t('btn.save') || 'Guardar') : (t('btn.confirm') || 'Crear')}
              </Button>
            </span>
          </TooltipTrigger>
          {!canSubmit && (
            <TooltipContent>
              <div className="text-xs">
                {t('error.required_fields_missing')}: {[
                  !hasValueOrPlaceholder(formData.title) && t('field.title'),
                  !formData.segment_type && t('field.type'),
                  (needsPresenter && !hasValueOrPlaceholder(formData.presenter)) && getPresenterLabel(),
                  (requiresSala && !formData.room_id) && t('field.room')
                ].filter(Boolean).join(', ')}
                <div className="mt-1 text-slate-500">{t('hint.allowed_placeholders')}</div>
              </div>
            </TooltipContent>
          )}
        </Tooltip>
      </div>

      {/* Series Manager Modal */}
      {showSeriesManager && (
        <AnnouncementSeriesManager 
            isOpen={showSeriesManager} 
            onClose={() => setShowSeriesManager(false)}
            initialSeriesId={formData.announcement_series_id || "new"}
            onSelect={(seriesId) => updateField('announcement_series_id', seriesId)}
        />
      )}
      {/* Overlap → Adjust flow */}
      <OverlapDetectedDialog
        open={showOverlapDialog}
        message={overlapText}
        onCancel={() => setShowOverlapDialog(false)}
        onProceed={() => {
          setShowOverlapDialog(false);
          setShowShiftPreview(true);
        }}
      />
      <ShiftPreviewModal
        open={showShiftPreview}
        onClose={() => setShowShiftPreview(false)}
        session={session}
        segments={allSegments}
        editedSegment={segment}
        newStartTime={formData.start_time}
        onConfirm={async ({ affected }) => {
          // Apply planned updates for affected segments + save current segment
          const updates = [];
          // Apply downstream
          for (const a of affected) {
            updates.push(base44.entities.Segment.update(a.id, { start_time: a.newStart, end_time: a.newEnd }));
          }
          // Save current segment with full form data and computed times
          const currentTimes = calculateTimes(formData.start_time, formData.duration_min);
          const currentData = {
            session_id: sessionId,
            ...formData,
            ...currentTimes,
            breakout_rooms: formData.segment_type === "Breakout" ? breakoutRooms : undefined,
            field_origins: fieldOrigins,
            // preserve order on edit
          };
          if (segment) {
            updates.push(base44.entities.Segment.update(segment.id, currentData));
          } else {
            updates.push(base44.entities.Segment.create(currentData));
          }
          await Promise.all(updates);
          await queryClient.invalidateQueries(['segments', sessionId]);
          setShowShiftPreview(false);
          onClose();
        }}
      />
    </form>
  );
}
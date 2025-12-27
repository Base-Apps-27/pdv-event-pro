import React, { useState, useEffect, useRef, useCallback, useContext } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { hasPermission } from "@/components/utils/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import StaticAnnouncementForm from "@/components/announcements/StaticAnnouncementForm";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Clock, Plus, Trash2, Copy, Edit, Sparkles, ChevronUp, ChevronDown, Loader2, ArrowRight, ChevronsRight, Mail, Eye, Wand2, Printer, ExternalLink, Settings, BookOpen } from "lucide-react";
import PrintSettingsModal from "@/components/print/PrintSettingsModal";
import VerseParserDialog from "@/components/service/VerseParserDialog";
import { Calendar } from "@/components/ui/calendar";
import { createPageUrl } from "@/utils";

import { addMinutes, parse, format as formatDate } from "date-fns";
import { es } from "date-fns/locale";
import AutocompleteInput from "@/components/ui/AutocompleteInput";
import { useLanguage } from "@/components/utils/i18n";
import { useDebouncedCommit } from "@/components/utils/useDebouncedCommit";

// Context for sharing serviceData and updaters
const ServiceDataContext = React.createContext(null);
const UpdatersContext = React.createContext(null);

// Song Input Row with local state
function SongInputRow({ service, segmentIndex, songIndex }) {
  const segment = useContext(ServiceDataContext)?.[service]?.[segmentIndex];
  const song = segment?.songs?.[songIndex] || { title: "", lead: "" };
  const updateSegmentField = useContext(UpdatersContext)?.updateSegmentField;
  
  const [localTitle, setLocalTitle] = useState("");
  const [localLead, setLocalLead] = useState("");
  
  const commitTitle = useDebouncedCommit(
    localTitle,
    song.title,
    (val) => {
      const newSongs = [...(segment.songs || [])];
      newSongs[songIndex] = { ...newSongs[songIndex], title: val };
      updateSegmentField(service, segmentIndex, "songs", newSongs);
    },
    3000
  );
  
  const commitLead = useDebouncedCommit(
    localLead,
    song.lead,
    (val) => {
      const newSongs = [...(segment.songs || [])];
      newSongs[songIndex] = { ...newSongs[songIndex], lead: val };
      updateSegmentField(service, segmentIndex, "songs", newSongs);
    },
    3000
  );
  
  useEffect(() => {
    setLocalTitle(song.title);
    setLocalLead(song.lead);
  }, [song.title, song.lead]);
  
  return (
    <div className="grid grid-cols-2 gap-2">
      <AutocompleteInput
        type="songTitle"
        placeholder={`Canción ${songIndex + 1}`}
        value={localTitle}
        onChange={(e) => setLocalTitle(e.target.value)}
        onBlur={commitTitle}
        className="text-xs"
      />
      <AutocompleteInput
        type="worshipLeader"
        placeholder="Líder"
        value={localLead}
        onChange={(e) => setLocalLead(e.target.value)}
        onBlur={commitLead}
        className="text-xs"
      />
    </div>
  );
}

// Pre-Service Notes Input with local state
function PreServiceNotesInput({ service }) {
  const currentGlobalValue = useContext(ServiceDataContext)?.pre_service_notes?.[service] || "";
  const setServiceData = useContext(UpdatersContext)?.setServiceData;
  const [localValue, setLocalValue] = useState("");
  
  const commitNow = useDebouncedCommit(
    localValue,
    currentGlobalValue,
    (val) => {
      setServiceData(prev => ({
        ...prev,
        pre_service_notes: { 
          ...prev.pre_service_notes, 
          [service]: val 
        }
      }));
    },
    3000
  );
  
  useEffect(() => {
    setLocalValue(currentGlobalValue);
  }, [currentGlobalValue]);
  
  return (
    <Textarea
      placeholder="Instrucciones pre-servicio (opcional)..."
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={commitNow}
      className="text-xs bg-white border-gray-300 text-gray-700 placeholder:text-gray-400"
      rows={2}
    />
  );
}

// Receso Notes Input with local state
function RecesoNotesInput() {
  const currentGlobalValue = useContext(ServiceDataContext)?.receso_notes?.["9:30am"] || "";
  const setServiceData = useContext(UpdatersContext)?.setServiceData;
  const [localValue, setLocalValue] = useState("");
  
  const commitNow = useDebouncedCommit(
    localValue,
    currentGlobalValue,
    (val) => {
      setServiceData(prev => ({
        ...prev,
        receso_notes: { 
          ...prev.receso_notes, 
          "9:30am": val 
        }
      }));
    },
    3000
  );
  
  useEffect(() => {
    setLocalValue(currentGlobalValue);
  }, [currentGlobalValue]);
  
  return (
    <Textarea
      placeholder="Notas del receso (opcional)..."
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={commitNow}
      className="text-xs bg-white border-gray-300 text-gray-700 placeholder:text-gray-400"
      rows={2}
    />
  );
}

// Team Input Component with local state
function TeamInput({ field, service, placeholder }) {
  const currentGlobalValue = useContext(ServiceDataContext)?.[field]?.[service] || "";
  const updateTeamField = useContext(UpdatersContext)?.updateTeamField;
  const [localValue, setLocalValue] = useState("");
  
  const commitNow = useDebouncedCommit(
    localValue,
    currentGlobalValue,
    (val) => updateTeamField(field, service, val),
    3000
  );
  
  useEffect(() => {
    setLocalValue(currentGlobalValue);
  }, [currentGlobalValue]);
  
  return (
    <Input
      placeholder={placeholder}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={commitNow}
      className="text-xs"
    />
  );
}

// Segment Field Component with local state (for simple text inputs)
function SegmentTextInput({ service, segmentIndex, field, placeholder, className = "text-sm" }) {
  const segment = useContext(ServiceDataContext)?.[service]?.[segmentIndex];
  const currentGlobalValue = segment?.data?.[field] || "";
  const updateSegmentField = useContext(UpdatersContext)?.updateSegmentField;
  const [localValue, setLocalValue] = useState("");
  
  const commitNow = useDebouncedCommit(
    localValue,
    currentGlobalValue,
    (val) => updateSegmentField(service, segmentIndex, field, val),
    3000
  );
  
  useEffect(() => {
    setLocalValue(currentGlobalValue);
  }, [currentGlobalValue]);
  
  return (
    <Input
      placeholder={placeholder}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={commitNow}
      className={className}
    />
  );
}

// Segment Textarea Component with local state
function SegmentTextarea({ service, segmentIndex, field, placeholder, className = "text-sm", rows = 2 }) {
  const segment = useContext(ServiceDataContext)?.[service]?.[segmentIndex];
  const currentGlobalValue = segment?.data?.[field] || "";
  const updateSegmentField = useContext(UpdatersContext)?.updateSegmentField;
  const [localValue, setLocalValue] = useState("");
  
  const commitNow = useDebouncedCommit(
    localValue,
    currentGlobalValue,
    (val) => updateSegmentField(service, segmentIndex, field, val),
    3000
  );
  
  useEffect(() => {
    setLocalValue(currentGlobalValue);
  }, [currentGlobalValue]);
  
  return (
    <Textarea
      placeholder={placeholder}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={commitNow}
      className={className}
      rows={rows}
    />
  );
}

// Segment Autocomplete Component with local state
function SegmentAutocomplete({ service, segmentIndex, field, placeholder, type, className = "text-sm" }) {
  const segment = useContext(ServiceDataContext)?.[service]?.[segmentIndex];
  const currentGlobalValue = segment?.data?.[field] || "";
  const updateSegmentField = useContext(UpdatersContext)?.updateSegmentField;
  const [localValue, setLocalValue] = useState("");
  
  const commitNow = useDebouncedCommit(
    localValue,
    currentGlobalValue,
    (val) => updateSegmentField(service, segmentIndex, field, val),
    3000
  );
  
  useEffect(() => {
    setLocalValue(currentGlobalValue);
  }, [currentGlobalValue]);
  
  return (
    <AutocompleteInput
      type={type}
      placeholder={placeholder}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={commitNow}
      className={className}
    />
  );
}

export default function WeeklyServiceManager() {
  const navigate = useNavigate();
  const tealStyle = { backgroundColor: '#1F8A70', color: '#ffffff' };
  const greenStyle = { backgroundColor: '#8DC63F', color: '#ffffff' };
  
  const { t } = useLanguage();
  const [user, setUser] = useState(null);
  
  // Fetch user for permissions
  useEffect(() => {
    const fetchUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    fetchUser();
  }, []);
  
  // State
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const date = today.getDate();
    const day = today.getDay();
    
    // Calculate days to add to get to next Sunday (0 = Sunday)
    const daysToAdd = day === 0 ? 0 : 7 - day;
    
    const nextSunday = new Date(year, month, date + daysToAdd);
    const y = nextSunday.getFullYear();
    const m = String(nextSunday.getMonth() + 1).padStart(2, '0');
    const d = String(nextSunday.getDate()).padStart(2, '0');
    
    return `${y}-${m}-${d}`;
  });
  const [serviceData, setServiceData] = useState(null);
  const [showSpecialDialog, setShowSpecialDialog] = useState(false);
  const [specialSegmentDetails, setSpecialSegmentDetails] = useState({
    timeSlot: "9:30am",
    title: "",
    duration: 15,
    insertAfterIdx: -1,
    presenter: "",
    translator: "",
  });
  const [selectedAnnouncements, setSelectedAnnouncements] = useState([]);
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [announcementForm, setAnnouncementForm] = useState({
    title: "",
    content: "",
    instructions: "",
    category: "General",
    is_active: true,
    priority: 10,
    has_video: false,
    date_of_occurrence: "",
    emphasize: false
  });
  const [expandedSegments, setExpandedSegments] = useState({});
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [savingField, setSavingField] = useState(null);
  const [optimizingAnnouncement, setOptimizingAnnouncement] = useState(false);
  const [showPrintSettings, setShowPrintSettings] = useState(false);
  const [printSettingsPage1, setPrintSettingsPage1] = useState(null);
  const [printSettingsPage2, setPrintSettingsPage2] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedData, setLastSavedData] = useState(null);
  const [lastSaveTimestamp, setLastSaveTimestamp] = useState(null);
  const [isQuickPrint, setIsQuickPrint] = useState(false);
  const [verseParserOpen, setVerseParserOpen] = useState(false);
  const [verseParserContext, setVerseParserContext] = useState({ timeSlot: null, segmentIdx: null });
  
  const saveTimeoutRef = useRef(null);
  const serviceDataRef = useRef(null);
  const queryClient = useQueryClient();

  // Keep ref in sync with state
  useEffect(() => {
    serviceDataRef.current = serviceData;
  }, [serviceData]);

  // Blueprint structure
  const BLUEPRINT = {
    "9:30am": [
      { 
        type: "worship", 
        title: "Equipo de A&A", 
        duration: 35, 
        fields: ["leader", "songs", "ministry_leader"],
        actions: [
          { label: "Video de introducción en FB", timing: "before_start", offset_min: 0, department: "Projection" }
        ]
      },
      { type: "welcome", title: "Bienvenida y Anuncios", duration: 5, fields: ["presenter"], actions: [] },
      { 
        type: "offering", 
        title: "Ofrendas", 
        duration: 5, 
        fields: ["presenter", "verse"],
        actions: [
          { label: "Enviar texto: 844-555-5555", timing: "after_start", offset_min: 0, department: "Admin" }
        ]
      },
      { 
        type: "message", 
        title: "Mensaje", 
        duration: 45, 
        fields: ["preacher", "title", "verse"],
        actions: [
          { label: "Pianista sube", timing: "before_end", offset_min: 15, department: "Alabanza" },
          { label: "Equipo de A&A sube", timing: "before_end", offset_min: 5, department: "Alabanza" }
        ]
      }
    ],
    "11:30am": [
      { 
        type: "worship", 
        title: "Equipo de A&A", 
        duration: 35, 
        fields: ["leader", "songs", "ministry_leader", "translator"],
        actions: [
          { label: "Video de introducción en FB", timing: "before_start", offset_min: 0, department: "Projection" }
        ],
        requires_translation: true,
        default_translator_source: "manual"
      },
      { 
        type: "welcome", 
        title: "Bienvenida y Anuncios", 
        duration: 5, 
        fields: ["presenter", "translator"], 
        actions: [],
        requires_translation: true,
        default_translator_source: "worship_segment_translator"
      },
      { 
        type: "offering", 
        title: "Ofrendas", 
        duration: 5, 
        fields: ["presenter", "verse", "translator"],
        actions: [
          { label: "Enviar texto: 844-555-5555", timing: "after_start", offset_min: 0, department: "Admin" }
        ],
        requires_translation: true,
        default_translator_source: "worship_segment_translator"
      },
      { 
        type: "message", 
        title: "Mensaje", 
        duration: 45, 
        fields: ["preacher", "title", "verse", "translator"],
        actions: [
          { label: "Pianista sube", timing: "before_end", offset_min: 15, department: "Alabanza" },
          { label: "Equipo de A&A sube", timing: "before_end", offset_min: 5, department: "Alabanza" }
        ],
        requires_translation: true,
        default_translator_source: "manual"
      }
    ]
  };

  // Fetch blueprint from database
  const { data: blueprintData } = useQuery({
    queryKey: ['serviceBlueprint'],
    queryFn: async () => {
      const blueprints = await base44.entities.Service.filter({ status: 'blueprint' });
      return blueprints[0] || null;
    }
  });

  // Fetch service data
  const { data: existingData, isLoading } = useQuery({
    queryKey: ['weeklyService', selectedDate],
    queryFn: async () => {
      const services = await base44.entities.Service.filter({ date: selectedDate });
      return services[0] || null;
    },
    enabled: !!selectedDate
  });

  // Fetch announcements
  const { data: allAnnouncements = [] } = useQuery({
    queryKey: ['allAnnouncements'],
    queryFn: () => base44.entities.AnnouncementItem.list('priority'),
  });

  const fixedAnnouncements = allAnnouncements.filter(a => a.category === 'General' && a.is_active);

  const { data: dynamicAnnouncements = [] } = useQuery({
    queryKey: ['dynamicAnnouncements', selectedDate],
    queryFn: async () => {
      const selDate = new Date(selectedDate + 'T00:00:00');
      const [items, events] = await Promise.all([
        base44.entities.AnnouncementItem.list(),
        base44.entities.Event.list()
      ]);
      
      const filteredItems = items.filter(a => {
        if (a.category === 'General' || !a.is_active) return false;
        if (!a.date_of_occurrence) return false;
        const occurrenceDate = new Date(a.date_of_occurrence + 'T00:00:00');
        return occurrenceDate >= selDate;
      });

      const filteredEvents = events.filter(e => {
        if (!e.promote_in_announcements || !e.start_date) return false;
        const eventStartDate = new Date(e.start_date + 'T00:00:00');
        return eventStartDate >= selDate;
      });

      const combined = [
        ...filteredItems.map(a => ({ ...a, sortDate: new Date(a.date_of_occurrence + 'T00:00:00') })),
        ...filteredEvents.map(e => ({ ...e, isEvent: true, sortDate: new Date(e.start_date + 'T00:00:00') }))
      ];

      return combined.sort((a, b) => a.sortDate - b.sortDate);
    },
    enabled: !!selectedDate
  });

  // Mutations
  const saveServiceMutation = useMutation({
    mutationFn: async (data) => {
      if (existingData?.id) {
        return await base44.entities.Service.update(existingData.id, data);
      } else {
        return await base44.entities.Service.create(data);
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries(['weeklyService', selectedDate]);
      // Don't update lastSavedData here - it causes re-renders that interrupt typing
      // We'll sync on initial load only
      setLastSaveTimestamp(new Date().toISOString());
      setHasUnsavedChanges(false);
      
      const backupKey = `service_backup_${selectedDate}`;
      localStorage.setItem(backupKey, JSON.stringify({
        data: result,
        timestamp: new Date().toISOString()
      }));
    },
    onError: (error) => {
      alert('Error al guardar: ' + error.message);
    }
  });

  const createAnnouncementMutation = useMutation({
    mutationFn: (data) => base44.entities.AnnouncementItem.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['allAnnouncements']);
      queryClient.invalidateQueries(['dynamicAnnouncements']);
      setShowAnnouncementDialog(false);
      setAnnouncementForm({ title: "", content: "", instructions: "", category: "General", is_active: true, priority: 10, has_video: false, date_of_occurrence: "" });
      setEditingAnnouncement(null);
    },
  });

  const updateAnnouncementMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AnnouncementItem.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['allAnnouncements']);
      queryClient.invalidateQueries(['dynamicAnnouncements']);
      setShowAnnouncementDialog(false);
      setAnnouncementForm({ title: "", content: "", instructions: "", category: "General", is_active: true, priority: 10, has_video: false, date_of_occurrence: "" });
      setEditingAnnouncement(null);
    },
  });

  const deleteAnnouncementMutation = useMutation({
    mutationFn: async (id) => {
      return await base44.entities.AnnouncementItem.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['allAnnouncements']);
      queryClient.invalidateQueries(['dynamicAnnouncements']);
    },
    onError: (error) => {
      alert('Error al eliminar: ' + (error.message || JSON.stringify(error)));
    }
  });

  // Initialize service data
  useEffect(() => {
    if (existingData) {
      const mergeSegmentsWithBlueprint = (existingSegments, timeSlot) => {
        const activeBlueprint = blueprintData || { "9:30am": BLUEPRINT["9:30am"], "11:30am": BLUEPRINT["11:30am"] };
        return existingSegments.map((savedSeg, idx) => {
          const blueprintSeg = activeBlueprint[timeSlot]?.find(b => b.type === savedSeg.type) || 
                               activeBlueprint[timeSlot]?.[idx] ||
                               BLUEPRINT[timeSlot]?.[idx];
          
          if (blueprintSeg) {
            let subAssignments = blueprintSeg.sub_assignments || savedSeg.sub_assignments || [];
            
            // Add defaults if missing
            if (!subAssignments || subAssignments.length === 0) {
              if (savedSeg.type === 'worship') {
                subAssignments = [{ label: 'Ministración de Sanidad y Milagros', person_field_name: 'ministry_leader', duration_min: 5 }];
              } else if (savedSeg.type === 'message') {
                subAssignments = [{ label: 'Cierre', person_field_name: 'cierre_leader', duration_min: 5 }];
              }
            }
            
            return {
              ...savedSeg,
              fields: blueprintSeg.fields || savedSeg.fields,
              sub_assignments: subAssignments,
              actions: blueprintSeg.actions || savedSeg.actions || [],
              requires_translation: blueprintSeg.requires_translation !== undefined ? blueprintSeg.requires_translation : savedSeg.requires_translation,
              default_translator_source: blueprintSeg.default_translator_source || savedSeg.default_translator_source || "manual",
            };
          }
          return savedSeg;
        });
      };

      const loadedData = {
        ...existingData,
        "9:30am": mergeSegmentsWithBlueprint(existingData["9:30am"] || [], "9:30am"),
        "11:30am": mergeSegmentsWithBlueprint(existingData["11:30am"] || [], "11:30am"),
        pre_service_notes: existingData.pre_service_notes || { "9:30am": "", "11:30am": "" },
        receso_notes: existingData.receso_notes || { "9:30am": "" },
        selected_announcements: existingData.selected_announcements || []
      };
      setServiceData(loadedData);
      setLastSavedData(JSON.parse(JSON.stringify(loadedData)));
      setSelectedAnnouncements(existingData.selected_announcements || []);
      setPrintSettingsPage1(existingData.print_settings_page1 || null);
      setPrintSettingsPage2(existingData.print_settings_page2 || null);
      setHasUnsavedChanges(false);
      
      const backupKey = `service_backup_${selectedDate}`;
      const backup = localStorage.getItem(backupKey);
      if (backup) {
        try {
          const { data, timestamp } = JSON.parse(backup);
          const backupDate = new Date(timestamp);
          const serverDate = existingData.updated_date ? new Date(existingData.updated_date) : new Date(0);
          if (backupDate > serverDate) {
            if (window.confirm('Se encontró una versión más reciente en el navegador. ¿Restaurar datos del backup local?')) {
              setServiceData(data);
              setLastSavedData(JSON.parse(JSON.stringify(data)));
            }
          }
        } catch (error) {
          console.error('[BACKUP RECOVERY ERROR] Failed to restore localStorage backup', {
            backupKey,
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
      }
    } else {
      // Use database blueprint if available, fallback to hardcoded
      const activeBlueprint = blueprintData || { "9:30am": BLUEPRINT["9:30am"], "11:30am": BLUEPRINT["11:30am"] };
      
      const initialData = {
        date: selectedDate,
        "9:30am": activeBlueprint["9:30am"].map(seg => {
          const segmentCopy = {
            type: seg.type,
            title: seg.title,
            duration: seg.duration,
            fields: [...(seg.fields || [])],
            data: {},
            actions: seg.actions ? seg.actions.map(a => ({ ...a })) : [],
            sub_assignments: seg.sub_assignments ? seg.sub_assignments.map(sa => ({ ...sa })) : [],
            requires_translation: seg.requires_translation || false,
            default_translator_source: seg.default_translator_source || "manual"
          };
          
          if (seg.type === "worship") {
            segmentCopy.songs = [
              { title: "", lead: "" },
              { title: "", lead: "" },
              { title: "", lead: "" },
              { title: "", lead: "" }
            ];
          }
          
          return segmentCopy;
        }),
        "11:30am": activeBlueprint["11:30am"].map(seg => {
          const segmentCopy = {
            type: seg.type,
            title: seg.title,
            duration: seg.duration,
            fields: [...(seg.fields || [])],
            data: {},
            actions: seg.actions ? seg.actions.map(a => ({ ...a })) : [],
            sub_assignments: seg.sub_assignments ? seg.sub_assignments.map(sa => ({ ...sa })) : [],
            requires_translation: seg.requires_translation || false,
            default_translator_source: seg.default_translator_source || "manual"
          };
          
          if (seg.type === "worship") {
            segmentCopy.songs = [
              { title: "", lead: "" },
              { title: "", lead: "" },
              { title: "", lead: "" },
              { title: "", lead: "" }
            ];
          }
          
          return segmentCopy;
        }),
        coordinators: { "9:30am": "", "11:30am": "" },
        ujieres: { "9:30am": "", "11:30am": "" },
        sound: { "9:30am": "", "11:30am": "" },
        luces: { "9:30am": "", "11:30am": "" },
        receso_notes: { "9:30am": "" },
        pre_service_notes: { "9:30am": "", "11:30am": "" },
        selected_announcements: []
      };
      setServiceData(initialData);
      setLastSavedData(null);
      setSelectedAnnouncements([]);
      setPrintSettingsPage1(null);
      setPrintSettingsPage2(null);
      setHasUnsavedChanges(false);
    }
  }, [existingData, selectedDate, blueprintData]);

  // Track unsaved changes
  useEffect(() => {
    if (!lastSavedData || !serviceData) return;
    
    const hasChanges = JSON.stringify(serviceData) !== JSON.stringify(lastSavedData);
    setHasUnsavedChanges(hasChanges);
  }, [serviceData, lastSavedData]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'Tienes cambios sin guardar. ¿Estás seguro de que quieres salir?';
        return e.returnValue;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Auto-select announcements for new services AND existing services without selections
  useEffect(() => {
    // Skip if still loading
    if (isLoading) return;
    
    // Check if we have announcements but none selected
    const hasAnnouncements = fixedAnnouncements.length > 0 || dynamicAnnouncements.length > 0;
    const hasNoSelections = !selectedAnnouncements || selectedAnnouncements.length === 0;
    
    if (hasAnnouncements && hasNoSelections) {
      const allActiveIds = [
        ...fixedAnnouncements.map(a => a.id),
        ...dynamicAnnouncements.map(a => a.id)
      ];
      setSelectedAnnouncements(allActiveIds);
    }
  }, [isLoading, fixedAnnouncements, dynamicAnnouncements]);

  // Filter out inactive announcements from loaded selections
  useEffect(() => {
    if (existingData && selectedAnnouncements.length > 0) {
      const allActiveIds = [
        ...fixedAnnouncements.map(a => a.id),
        ...dynamicAnnouncements.map(a => a.id)
      ];
      
      const filtered = selectedAnnouncements.filter(id => allActiveIds.includes(id));
      
      // Only update if there were ghost announcements to remove
      if (filtered.length !== selectedAnnouncements.length) {
        setSelectedAnnouncements(filtered);
      }
    }
  }, [existingData, fixedAnnouncements, dynamicAnnouncements]);

  // Debounced save
  const debouncedSave = useCallback((fieldKey) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSavingField(fieldKey);

    saveTimeoutRef.current = setTimeout(() => {
      const currentData = serviceDataRef.current;
      if (!currentData) {
        setSavingField(null);
        return;
      }
      
      const dataToSave = {
        ...currentData,
        selected_announcements: selectedAnnouncements,
        print_settings_page1: printSettingsPage1,
        print_settings_page2: printSettingsPage2,
        day_of_week: 'Sunday',
        name: `Domingo - ${selectedDate}`,
        status: 'active'
      };
      
      saveServiceMutation.mutate(dataToSave, {
        onSettled: () => {
          setSavingField(null);
        }
      });
    }, 800);
  }, [selectedDate, selectedAnnouncements, saveServiceMutation]);

  // Sync selected announcements with serviceData
  useEffect(() => {
    setServiceData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        selected_announcements: selectedAnnouncements
      };
    });
  }, [selectedAnnouncements]);

  // Central auto-save: triggers when serviceData changes
  useEffect(() => {
    if (!lastSavedData || !serviceData) return;
    
    const hasChanges = JSON.stringify(serviceData) !== JSON.stringify(lastSavedData);
    if (!hasChanges) return;

    const handler = setTimeout(() => {
      const dataToSave = {
        ...serviceData,
        selected_announcements: selectedAnnouncements,
        print_settings_page1: printSettingsPage1,
        print_settings_page2: printSettingsPage2,
        day_of_week: 'Sunday',
        name: `Domingo - ${selectedDate}`,
        status: 'active'
      };
      saveServiceMutation.mutate(dataToSave);
    }, 1000); // Short delay after serviceData settles

    return () => clearTimeout(handler);
  }, [serviceData, lastSavedData, selectedAnnouncements, printSettingsPage1, printSettingsPage2, selectedDate]);

  // Update handlers (pure state mutation, no saves)
  const updateSegmentField = (service, segmentIndex, field, value) => {
    setServiceData(prev => {
      const updated = { ...prev };
      if (field === 'songs') {
        updated[service][segmentIndex].songs = value;
      } else {
        updated[service][segmentIndex].data = {
          ...updated[service][segmentIndex].data,
          [field]: value
        };
      }
      
      // Auto-propagate translator from worship to other segments in 11:30am
      if (field === 'translator' && service === '11:30am' && updated[service][segmentIndex].type === 'worship') {
        const worshipTranslator = value;
        updated['11:30am'] = updated['11:30am'].map((seg, idx) => {
          if (idx !== segmentIndex && seg.default_translator_source === 'worship_segment_translator' && !seg.data?.translator) {
            return {
              ...seg,
              data: {
                ...seg.data,
                translator: worshipTranslator
              }
            };
          }
          return seg;
        });
      }
      
      return updated;
    });
  };

  const handleOpenVerseParser = (timeSlot, segmentIdx) => {
    const currentVerse = serviceData[timeSlot][segmentIdx]?.data?.verse || "";
    const currentParsedData = serviceData[timeSlot][segmentIdx]?.data?.parsed_verse_data;
    
    setVerseParserContext({ 
      timeSlot, 
      segmentIdx,
      initialText: currentVerse,
      initialParsed: currentParsedData
    });
    setVerseParserOpen(true);
  };

  const handleSaveParsedVerses = (data) => {
    const { timeSlot, segmentIdx } = verseParserContext;
    
    setServiceData(prev => {
      const updated = { ...prev };
      const currentVerse = updated[timeSlot][segmentIdx].data?.verse || "";
      updated[timeSlot][segmentIdx].data = {
        ...updated[timeSlot][segmentIdx].data,
        verse: currentVerse, // Preserve existing verse text
        parsed_verse_data: data.parsed_data
      };
      return updated;
    });
    
    debouncedSave(`${timeSlot}-${segmentIdx}-verse-parsed`);
    setVerseParserOpen(false);
    setVerseParserContext({ timeSlot: null, segmentIdx: null });
  };

  const copy930To1130 = () => {
    setSavingField('copy-services');
    setServiceData(prev => {
      if (!prev) return prev;

      const updated = { ...prev };

      const copiedSegments = updated["9:30am"].map(seg => ({
        ...seg,
        data: { ...seg.data },
        actions: seg.actions ? seg.actions.map(a => ({ ...a })) : [],
        songs: seg.songs ? seg.songs.map(s => ({ ...s })) : undefined,
      }));

      updated["11:30am"] = copiedSegments;

      // Always copy pre-service notes and team info
      updated.pre_service_notes["11:30am"] = updated.pre_service_notes["9:30am"];
      updated.coordinators["11:30am"] = updated.coordinators["9:30am"];
      updated.ujieres["11:30am"] = updated.ujieres["9:30am"];
      updated.sound["11:30am"] = updated.sound["9:30am"];
      updated.luces["11:30am"] = updated.luces["9:30am"];

      return updated;
    });
    debouncedSave('copy-services');
  };

  const copySegmentTo1130 = (segmentIndex) => {
    setSavingField(`copy-segment-${segmentIndex}`);
    setServiceData(prev => {
      if (!prev) return prev;

      const updated = { ...prev };
      const sourceSeg = updated["9:30am"][segmentIndex];

      if (sourceSeg) {
        const copiedSegment = {
          ...sourceSeg,
          data: { ...sourceSeg.data },
          actions: sourceSeg.actions ? sourceSeg.actions.map(a => ({ ...a })) : [],
          songs: sourceSeg.songs ? sourceSeg.songs.map(s => ({ ...s })) : undefined,
        };
        updated["11:30am"][segmentIndex] = copiedSegment;
      }

      return updated;
    });
    debouncedSave(`copy-segment-${segmentIndex}`);
  };

  const copyPreServiceNotesTo1130 = () => {
    setSavingField('copy-preservice');
    setServiceData(prev => {
      if (!prev) return prev;
      const updated = { ...prev };
      updated.pre_service_notes["11:30am"] = updated.pre_service_notes["9:30am"];
      return updated;
    });
    debouncedSave('copy-preservice');
  };

  const copyTeamTo1130 = () => {
    setSavingField('copy-team');
    setServiceData(prev => {
      if (!prev) return prev;
      const updated = { ...prev };
      updated.coordinators["11:30am"] = updated.coordinators["9:30am"];
      updated.ujieres["11:30am"] = updated.ujieres["9:30am"];
      updated.sound["11:30am"] = updated.sound["9:30am"];
      updated.luces["11:30am"] = updated.luces["9:30am"];
      return updated;
    });
    debouncedSave('copy-team');
  };

  const updateTeamField = (field, service, value) => {
    setServiceData(prev => ({
      ...prev,
      [field]: { ...prev[field], [service]: value }
    }));
  };







  const addSpecialSegment = () => {
    setSavingField('add-special');
    const newSegment = {
      type: "special",
      title: specialSegmentDetails.title,
      duration: specialSegmentDetails.duration,
      fields: ["description"],
      data: { 
        description: "",
        presenter: specialSegmentDetails.presenter,
        translator: specialSegmentDetails.translator
      },
      actions: []
    };

    const updatedData = { ...serviceData };
    const targetArray = [...updatedData[specialSegmentDetails.timeSlot]];
    let insertIndex = specialSegmentDetails.insertAfterIdx + 1;
    if (insertIndex <= 0) insertIndex = 0;
    if (insertIndex > targetArray.length) insertIndex = targetArray.length;
    
    targetArray.splice(insertIndex, 0, newSegment);
    updatedData[specialSegmentDetails.timeSlot] = targetArray;
    
    setServiceData(updatedData);
    
    const dataToSave = {
      ...updatedData,
      selected_announcements: selectedAnnouncements,
      day_of_week: 'Sunday',
      name: `Domingo - ${selectedDate}`,
      status: 'active'
    };
    
    saveServiceMutation.mutate(dataToSave, {
      onSettled: () => setSavingField(null)
    });
    
    setShowSpecialDialog(false);
    setSpecialSegmentDetails({
      timeSlot: "9:30am", title: "", duration: 15, insertAfterIdx: -1, presenter: "", translator: "",
    });
  };

  const removeSpecialSegment = (timeSlot, index) => {
    setSavingField('remove-special');
    const updatedData = { ...serviceData };
    const targetArray = [...updatedData[timeSlot]];
    targetArray.splice(index, 1);
    updatedData[timeSlot] = targetArray;
    
    setServiceData(updatedData);
    
    const dataToSave = {
      ...updatedData,
      selected_announcements: selectedAnnouncements,
      day_of_week: 'Sunday',
      name: `Domingo - ${selectedDate}`,
      status: 'active'
    };
    
    saveServiceMutation.mutate(dataToSave, {
      onSettled: () => setSavingField(null)
    });
  };

  const handleMoveSegment = (timeSlot, index, direction) => {
    setSavingField('reorder');
    const items = [...serviceData[timeSlot]];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= items.length) return;
    
    // Swap items
    [items[index], items[targetIndex]] = [items[targetIndex], items[index]];
    
    const updatedData = {
      ...serviceData,
      [timeSlot]: items
    };
    
    setServiceData(updatedData);
    
    const dataToSave = {
      ...updatedData,
      selected_announcements: selectedAnnouncements,
      day_of_week: 'Sunday',
      name: `Domingo - ${selectedDate}`,
      status: 'active'
    };
    
    saveServiceMutation.mutate(dataToSave, {
      onSettled: () => setSavingField(null)
    });
  };

  const handleAnnouncementSubmit = (formData) => {
    if (editingAnnouncement) {
      updateAnnouncementMutation.mutate({ id: editingAnnouncement.id, data: formData });
    } else {
      createAnnouncementMutation.mutate(formData);
    }
  };

  const openAnnouncementEdit = (ann) => {
    setEditingAnnouncement(ann);
    setAnnouncementForm({
      title: ann.title,
      content: ann.content,
      instructions: ann.instructions || "",
      category: ann.category,
      is_active: ann.is_active,
      priority: ann.priority || 10,
      has_video: ann.has_video || false,
      date_of_occurrence: ann.date_of_occurrence || "",
      emphasize: ann.emphasize || false
    });
    setShowAnnouncementDialog(true);
  };

  const optimizeAnnouncementWithAI = async (formData, setResult) => {
    setOptimizingAnnouncement(true);
    
    const isStatic = formData?.category === "General";
    
    // Different limits for static vs dynamic
    const limits = isStatic 
      ? { title: 60, body: 420, cue: 200 }
      : { title: 80, body: 600, cue: 300 };
    
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a church communications editor optimizing an announcement for print and presentation.

ANNOUNCEMENT TYPE: ${isStatic ? 'STATIC (appears every week)' : 'DYNAMIC (event/ministry promotion)'}
CATEGORY: ${formData?.category || 'General'}

CURRENT CONTENT:
Title: ${formData?.title || '(empty)'}
Body: ${formData?.content || '(empty)'}
CUE/Instructions: ${formData?.instructions || '(empty)'}
${!isStatic && formData?.date_of_occurrence ? `Event Date: ${formData.date_of_occurrence}` : ''}
${formData?.emphasize ? 'EMPHASIZED: Yes (important announcement)' : ''}

STRICT CHARACTER LIMITS:
- Title: max ${limits.title} characters (currently ${(formData?.title || '').length})
- Body: max ${limits.body} characters (currently ${(formData?.content || '').replace(/<[^>]*>/g, '').length})
- CUE: max ${limits.cue} characters (currently ${(formData?.instructions || '').replace(/<[^>]*>/g, '').length})

FORMATTING OPTIONS (use HTML tags):
- <b>bold</b> for emphasis on key words/phrases
- <i>italic</i> for dates, times, locations
- Use bullet points (•) for lists (max 3-4 bullets)
- Use line breaks for paragraph separation

OPTIMIZATION RULES:
1. PRESERVE all essential information (dates, times, locations, contact info)
2. ${isStatic ? 'Keep it brief and punchy - this repeats weekly' : 'Include WHO, WHAT, WHEN, WHERE if applicable'}
3. Title: Action-oriented, attention-grabbing, NO formatting tags
4. Body: 
   - Lead with the most important info
   - Use <b>bold</b> for key action items or highlights
   - Use <i>italic</i> for dates/times/locations
   - Bullet points for multiple items
5. CUE: Brief presenter instructions (tone, gestures, emphasis points)
6. Output in the SAME LANGUAGE as the input (Spanish or English)
7. If content is good, improve clarity/formatting without major rewrites
8. ${formData?.emphasize ? 'This is EMPHASIZED - make it impactful and urgent' : ''}

Return ONLY valid JSON:
{
  "title": "optimized title (plain text, no HTML)",
  "content": "optimized body with HTML formatting",
  "instructions": "optimized CUE with HTML formatting or empty string"
}`,
        response_json_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            content: { type: "string" },
            instructions: { type: "string" }
          },
          required: ["title", "content"]
        }
      });

      if (result && setResult) {
        setResult({
          title: (result.title || formData.title).substring(0, limits.title),
          content: (result.content || formData.content).substring(0, limits.body + 100), // Allow extra for HTML tags
          instructions: (result.instructions || formData.instructions || "").substring(0, limits.cue + 50)
        });
      }
    } catch (error) {
      console.error('AI optimization error:', error);
      alert('Error al optimizar / Error optimizing: ' + error.message);
    } finally {
      setOptimizingAnnouncement(false);
    }
  };

  const moveAnnouncementPriority = (ann, direction) => {
    const newPriority = direction === 'up' ? (ann.priority || 10) - 1 : (ann.priority || 10) + 1;
    updateAnnouncementMutation.mutate({
      id: ann.id,
      data: { ...ann, priority: newPriority }
    });
  };

  const handleSavePrintSettings = (newSettings) => {
    setPrintSettingsPage1(newSettings.page1);
    setPrintSettingsPage2(newSettings.page2);
    setServiceData(prev => ({
      ...prev,
      print_settings_page1: newSettings.page1,
      print_settings_page2: newSettings.page2
    }));
    debouncedSave('print-settings');
  };

  const handleQuickPrint = () => {
    setIsQuickPrint(true);
    setTimeout(() => {
      window.print();
      // Reset after print dialog closes
      setTimeout(() => setIsQuickPrint(false), 100);
    }, 50);
  };

  const toggleSegmentExpanded = (timeSlot, idx) => {
    const key = `${timeSlot}-${idx}`;
    setExpandedSegments(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };



  // Overflow detection helpers
  const calculateServiceProgramOverflow = () => {
    if (!serviceData) return { hasOverflow: false, level: 'low' };
    
    // Count content items for each service
    const count930 = {
      segments: serviceData["9:30am"]?.filter(s => s.type !== 'break').length || 0,
      songs: serviceData["9:30am"]?.reduce((sum, seg) => sum + (seg.songs?.filter(s => s.title).length || 0), 0) || 0,
      notes: (serviceData.pre_service_notes?.["9:30am"] ? 1 : 0)
    };
    
    const count1130 = {
      segments: serviceData["11:30am"]?.filter(s => s.type !== 'break').length || 0,
      songs: serviceData["11:30am"]?.reduce((sum, seg) => sum + (seg.songs?.filter(s => s.title).length || 0), 0) || 0,
      notes: (serviceData.pre_service_notes?.["11:30am"] ? 1 : 0)
    };
    
    // Estimate page units (1 unit ≈ 1 line of content)
    const units930 = count930.segments * 4 + count930.songs * 1.2 + count930.notes * 2;
    const units1130 = count1130.segments * 4 + count1130.songs * 1.2 + count1130.notes * 2;
    
    // Each column can fit ~50 units comfortably
    const maxUnitsPerColumn = 50;
    
    if (units930 > maxUnitsPerColumn || units1130 > maxUnitsPerColumn) {
      return { hasOverflow: true, level: 'high', label: 'Sobrecarga Detectada', color: 'bg-red-100 text-red-800 border-red-300' };
    }
    if (units930 > maxUnitsPerColumn * 0.85 || units1130 > maxUnitsPerColumn * 0.85) {
      return { hasOverflow: true, level: 'medium', label: 'Riesgo Moderado', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
    }
    
    return { hasOverflow: false, level: 'low', label: 'Se Ajusta Bien', color: 'bg-green-100 text-green-800 border-green-300' };
  };

  const calculateAnnouncementOverflow = () => {
    const selected = [...fixedAnnouncements, ...dynamicAnnouncements]
      .filter(ann => selectedAnnouncements.includes(ann.id));
    
    if (selected.length === 0) return { hasOverflow: false, level: 'low', label: 'Sin Anuncios', color: 'bg-gray-100 text-gray-800 border-gray-300' };
    
    // Estimate content units for 2-column layout
    // Fixed announcements go in left column, dynamic in right
    const fixedSelected = selected.filter(a => !a.isEvent && a.category === 'General');
    const dynamicSelected = selected.filter(a => a.isEvent || a.category !== 'General');
    
    // Calculate units (title=2, content line=1, instructions=1.5, video badge=0.5)
    const calculateUnits = (ann) => {
      const content = ann.isEvent ? (ann.announcement_blurb || ann.description || '') : (ann.content || '');
      const instructions = ann.instructions || '';
      
      // Strip HTML and count characters
      const contentText = content.replace(/<[^>]*>/g, '');
      const instructionsText = instructions.replace(/<[^>]*>/g, '');
      
      // 2-column layout: ~40 chars per line
      const contentLines = Math.ceil(contentText.length / 40);
      const instructionLines = Math.ceil(instructionsText.length / 35);
      
      let units = 2; // Title
      units += contentLines;
      units += instructionLines * 1.5;
      units += (ann.has_video || ann.announcement_has_video) ? 0.5 : 0;
      units += 1; // Spacing
      
      return units;
    };
    
    const fixedUnits = fixedSelected.reduce((sum, ann) => sum + calculateUnits(ann), 0);
    const dynamicUnits = dynamicSelected.reduce((sum, ann) => sum + calculateUnits(ann), 0);
    
    // Each column can fit ~55 units
    const maxUnitsPerColumn = 55;
    
    if (fixedUnits > maxUnitsPerColumn || dynamicUnits > maxUnitsPerColumn) {
      return { hasOverflow: true, level: 'high', label: 'Sobrecarga Detectada', color: 'bg-red-100 text-red-800 border-red-300' };
    }
    if (fixedUnits > maxUnitsPerColumn * 0.85 || dynamicUnits > maxUnitsPerColumn * 0.85) {
      return { hasOverflow: true, level: 'medium', label: 'Riesgo Moderado', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
    }
    
    return { hasOverflow: false, level: 'low', label: 'Se Ajusta Bien', color: 'bg-green-100 text-green-800 border-green-300' };
  };

  const calculateServiceTimes = (timeSlot) => {
    const segments = serviceData?.[timeSlot] || [];
    const totalDuration = segments
      .filter(seg => seg.type !== 'break' && seg.type !== 'ministry')
      .reduce((sum, seg) => sum + (seg.duration || 0), 0);
    
    const startTime = parse(timeSlot, "h:mma", new Date());
    const endTime = addMinutes(startTime, totalDuration);
    const targetDuration = 90;
    const isOverage = totalDuration > targetDuration;
    const overageAmount = totalDuration - targetDuration;

    return {
      totalDuration,
      startTime: formatDate(startTime, "h:mm a"),
      endTime: formatDate(endTime, "h:mm a"),
      isOverage,
      overageAmount,
      targetDuration
    };
  };

  if (!serviceData || isLoading) {
    return <div className="p-8">Cargando...</div>;
  }

  // Apply print settings dynamically
  const defaultPrintSettings = {
    globalScale: 1.0,
    margins: { top: "0.5in", right: "0.5in", bottom: "0.5in", left: "0.5in" },
    bodyFontScale: 1.0,
    titleFontScale: 1.0
  };

  const activePrintSettingsPage1 = isQuickPrint ? defaultPrintSettings : (printSettingsPage1 || defaultPrintSettings);
  const activePrintSettingsPage2 = isQuickPrint ? defaultPrintSettings : (printSettingsPage2 || defaultPrintSettings);

  return (
    <ServiceDataContext.Provider value={serviceData}>
      <UpdatersContext.Provider value={{ updateSegmentField, updateTeamField, setServiceData }}>
    <div className="p-6 md:p-8 space-y-8 print:p-0 bg-[#F0F1F3] min-h-screen">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        @media print {
          @page { 
            size: letter; 
            margin: 0;
          }
          
          body { 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact;
            font-family: 'Inter', Helvetica, Arial, sans-serif;
            background: white;
            font-size: 10.5pt;
            line-height: 1.3;
            color: #374151;
          }
          
          .print-page-1-wrapper {
            padding: ${activePrintSettingsPage1.margins.top} ${activePrintSettingsPage1.margins.right} calc(${activePrintSettingsPage1.margins.bottom} + 24pt) ${activePrintSettingsPage1.margins.left};
          }

          .print-page-2-wrapper {
            padding: ${activePrintSettingsPage2.margins.top} ${activePrintSettingsPage2.margins.right} calc(${activePrintSettingsPage2.margins.bottom} + 24pt) ${activePrintSettingsPage2.margins.left};
          }
          
          .print-body-content {
            transform: scale(${activePrintSettingsPage1.globalScale});
            transform-origin: top left;
          }
          
          .print-announcements-body {
            transform: scale(${activePrintSettingsPage2.globalScale});
            transform-origin: top left;
          }
          
          * {
            background: white !important;
          }

          .print-header {
            position: relative;
            text-align: center;
            margin-bottom: 14pt;
            padding-bottom: 8pt;
            border-bottom: 1pt solid #e5e7eb;
          }

          .print-logo {
            position: absolute;
            left: 0;
            top: 0;
            width: 50px;
            height: 50px;
          }

          .print-logo img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }

          .print-title {
            text-align: center;
            padding: 0 60px;
          }

          .print-title h1 {
            font-size: 18pt;
            font-weight: 600;
            margin: 0 0 4pt 0;
            text-transform: uppercase;
            color: #000000;
            letter-spacing: 0.5px;
          }

          .print-title p {
            font-size: 11pt;
            color: #4b5563;
            font-weight: 400;
            margin: 0 0 8pt 0;
          }

          .print-team-info {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 4pt;
            flex-wrap: wrap;
            font-size: 9pt;
            color: #4b5563;
          }

          .print-team-label {
            font-weight: 600;
            color: #1f2937;
          }

          .print-two-columns {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24pt;
            margin-bottom: 0;
          }

          .print-service-column {
            break-inside: avoid;
          }

          .print-service-time {
            font-size: 14pt;
            font-weight: 600;
            color: #000000;
            margin-bottom: 10pt;
            padding-bottom: 6pt;
            border-bottom: 2pt solid #1f2937;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .print-segment {
            margin-bottom: 10pt;
            padding-bottom: 8pt;
            border-bottom: 1pt solid #f3f4f6;
            font-size: calc(10.5pt * ${activePrintSettingsPage1.bodyFontScale});
            line-height: 1.3;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .print-segment:last-child {
            border-bottom: none;
          }

          .print-segment-time {
            font-weight: 600;
            color: #dc2626;
            font-size: 10.5pt;
            display: inline;
            margin-right: 6pt;
          }

          .print-segment-title {
            font-weight: 600;
            text-transform: uppercase;
            font-size: calc(11pt * ${activePrintSettingsPage1.titleFontScale});
            color: #000000;
            letter-spacing: 0.25px;
            display: inline;
          }

          .print-segment-detail {
            font-size: 10.5pt;
            color: #374151;
            line-height: 1.3;
            margin-top: 2pt;
            padding-left: 4pt;
          }

          .print-name {
            color: #111827;
            font-weight: 700;
            font-size: 11pt;
          }

          .print-duration {
            font-size: 10pt;
            font-weight: 400;
            color: #6b7280;
          }

          .print-note-text {
            font-size: 9.5pt;
            color: #6b7280;
            font-style: italic;
          }

          /* Coordinator Actions - De-emphasized */
          .print-note-coordinator-actions {
            background-color: #fffdf5; /* Very light yellow (almost white) */
            border: 1px solid #fef3c7; /* Thin soft yellow border */
            color: #78350f; /* Muted yellow-brown text */
            font-size: 8pt; /* Smaller text */
            margin-top: 4pt;
            padding: 3pt 6pt;
            border-radius: 2pt;
          }

          .print-note-coordinator-actions div {
            font-size: 8pt;
            line-height: 1.2;
            font-style: normal; /* No italics */
          }

          /* General / Pre-Service Notes - Primary Importance */
          .print-note-general-info {
            background-color: #f0fdf4; /* Light green background */
            border-left: 4pt solid #16a34a; /* Strong green left border */
            color: #14532d; /* Dark green text */
            font-size: 10pt; /* Slightly larger text */
            margin-top: 4pt;
            padding: 4pt 8pt;
          }

          /* Projection Notes - Role Indicator Only */
          .print-note-projection-team {
            border-left: 3pt solid #2563eb; /* Blue left border only */
            background-color: transparent;
            color: #1e40af; /* Blue text */
            font-size: 9pt;
            margin-top: 4pt;
            padding: 2pt 6pt;
          }

          /* Sound Notes - Role Indicator Only */
          .print-note-sound-team {
            border-left: 3pt solid #dc2626; /* Red left border only */
            background-color: transparent;
            color: #991b1b; /* Red text */
            font-size: 9pt;
            margin-top: 4pt;
            padding: 2pt 6pt;
          }

          /* Segment-Specific Coordinator Notes - Contextual */
          .print-note-segment-coordinator {
            background-color: #fffbeb; /* Very subtle yellow background */
            border-left: 1px solid #fcd34d; /* Thin yellow left border */
            color: #92400e; /* Yellow-brown text */
            font-size: 9pt;
            margin-top: 2pt;
            padding: 2pt 4pt;
            font-style: italic; /* Italics retained */
          }

          .print-segment-songs {
            margin-top: 4pt;
            padding-left: 4pt;
            font-size: 10pt;
            line-height: 1.35;
          }

          .print-segment-songs div {
            color: #374151;
          }

          .print-receso {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12pt;
            padding: 8pt 0;
            margin: 14pt 0;
            font-size: 11pt;
            font-weight: 600;
            color: #1f2937;
          }

          .print-receso::before,
          .print-receso::after {
            content: '';
            flex: 1;
            height: 1pt;
            background: #d1d5db;
          }

          .print-announcements {
            break-before: page;
            padding-bottom: 28pt;
          }

          .print-announcements-logo {
            position: absolute;
            left: 0;
            top: 0;
            width: 50px;
            height: 50px;
          }

          .print-announcements-logo img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }

          .print-announcements-header {
            position: relative;
            text-align: center;
            margin-bottom: 14pt;
            padding-bottom: 8pt;
            border-bottom: 1pt solid #e5e7eb;
          }

          .print-announcements-title {
            font-size: 18pt;
            font-weight: 600;
            text-transform: uppercase;
            margin: 0 0 4pt 0;
            color: #000000;
            letter-spacing: 0.5px;
          }

          .print-announcements-header p {
            font-size: 11pt;
            font-weight: 400;
            color: #4b5563;
            margin: 0;
          }

          .print-announcement-list {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20pt;
            margin: 0;
            padding: 0;
          }

          .print-announcements-column-left {
            display: flex;
            flex-direction: column;
            gap: 8pt;
          }

          .print-events-column-right {
            display: flex;
            flex-direction: column;
            gap: 6pt;
            border-left: 2pt solid #e5e7eb;
            padding-left: 12pt;
          }

          .print-events-header {
            font-size: 9pt;
            font-weight: 600;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4pt;
            padding-bottom: 4pt;
            border-bottom: 1pt solid #e5e7eb;
          }

          .print-event-compact {
            display: flex;
            flex-direction: column;
            padding: 4pt 0;
            border-bottom: 1pt solid #f3f4f6;
          }

          .print-event-compact:last-child {
            border-bottom: none;
          }

          .print-event-compact.print-event-emphasized {
            background: #fef3c7 !important;
            border: 2pt solid #f59e0b !important;
            border-radius: 4pt;
            padding: 4pt 6pt;
            margin-bottom: 4pt;
          }

          .print-event-title {
            font-size: 10pt;
            font-weight: 600;
            color: #16a34a;
            line-height: 1.2;
          }

          .print-event-date {
            font-size: 9pt;
            color: #4b5563;
            font-weight: 500;
            margin-top: 2pt;
          }

          .print-event-content {
            font-size: 9pt;
            color: #374151;
            line-height: 1.3;
            margin-top: 2pt;
            white-space: pre-wrap;
          }

          .print-event-brief {
            font-size: 8.5pt;
            color: #6b7280;
            font-style: italic;
            margin-top: 1pt;
          }

          .print-announcement-item {
            margin-bottom: 8pt;
            padding-bottom: 8pt;
            border-bottom: 1pt solid #e5e7eb;
            break-inside: avoid;
            page-break-inside: avoid;
            font-size: calc(9.5pt * ${activePrintSettingsPage2.bodyFontScale});
          }

          .print-announcement-item:last-child {
            border-bottom: none;
          }

          .print-announcement-header {
            margin-bottom: 3pt;
          }

          .print-announcement-title {
            font-size: calc(10pt * ${activePrintSettingsPage2.titleFontScale});
            font-weight: 600;
            color: #000000;
            text-transform: uppercase;
            letter-spacing: 0.25px;
            display: block;
            line-height: 1.25;
          }

          .print-announcement-date {
            font-size: 9pt;
            font-weight: 400;
            color: #4b5563;
            display: block;
            margin-top: 2pt;
          }

          .print-announcement-content {
            font-size: 9.5pt;
            line-height: 1.3;
            color: #374151;
            white-space: pre-wrap;
          }

          .print-announcement-instructions {
            margin-top: 4pt;
            font-size: 8.5pt;
            font-style: italic;
            color: #6b7280;
            padding-left: 6pt;
            border-left: 2pt solid #fbbf24;
            line-height: 1.2;
          }

          .print-announcement-instructions::before {
            content: "CUE: ";
            font-weight: 700;
            font-style: normal;
            color: #1f2937;
            text-transform: uppercase;
            font-size: 7.5pt;
            letter-spacing: 0.5px;
          }

          .print-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            width: 100%;
            height: 20pt;
            background: linear-gradient(90deg, #16a34a 0%, #059669 100%) !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white !important;
            font-size: 9pt;
            font-weight: 600;
            letter-spacing: 0.5px;
          }

          .print-content {
            padding-bottom: 24pt;
          }
        }
      `}</style>

      {/* Print Layout */}
      <div className="hidden print:block">
        {/* PAGE 1 */}
        <div className="print-page-1-wrapper">
        <div className="print-header" style={{ position: 'relative' }}>
          <div className="print-logo" style={{ position: 'absolute', left: '0', top: '0' }}>
            <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691b19c064436ea35f171ca3/e75f54157_image.png" alt="Logo" />
          </div>
          <div className="print-title" style={{ textAlign: 'center', paddingLeft: '0', paddingRight: '0' }}>
            <h1>Orden de Servicio</h1>
            <p>Domingo {formatDate(new Date(selectedDate + 'T12:00:00'), "d 'de' MMMM, yyyy", { locale: es })}</p>
            <div className="print-team-info">
              <span><span className="print-team-label">Coordinador:</span> {serviceData?.coordinators?.["9:30am"] || serviceData?.coordinators?.["11:30am"] || "—"}</span>
              <span style={{ color: '#9ca3af' }}>/</span>
              <span><span className="print-team-label">Ujier:</span> {serviceData?.ujieres?.["9:30am"] || serviceData?.ujieres?.["11:30am"] || "—"}</span>
              <span style={{ color: '#9ca3af' }}>/</span>
              <span><span className="print-team-label">Sonido:</span> {serviceData?.sound?.["9:30am"] || "—"}</span>
              <span style={{ color: '#9ca3af' }}>/</span>
              <span><span className="print-team-label">Luces:</span> {serviceData?.luces?.["9:30am"] || serviceData?.luces?.["11:30am"] || "—"}</span>
            </div>
          </div>
        </div>

        <div className="print-body-content">
        <div className="print-two-columns">
          <div className="print-service-column left">
            <div className="print-service-time">9:30 A.M.</div>
            {serviceData?.pre_service_notes?.["9:30am"] && (
              <div className="print-segment">
                <div className="print-note-general-info">
                  {serviceData.pre_service_notes["9:30am"]}
                </div>
              </div>
            )}
            {serviceData?.["9:30am"]?.filter(s => s.type !== 'break').map((segment, idx) => {
              let currentTime = parse("9:30am", "h:mma", new Date());
              for (let i = 0; i < idx; i++) {
                if (serviceData["9:30am"][i].type !== 'break' && serviceData["9:30am"][i].type !== 'ministry') {
                  currentTime = addMinutes(currentTime, serviceData["9:30am"][i].duration || 0);
                }
              }
              const segmentTime = formatDate(currentTime, "h:mm a");

              return (
                <div key={idx} className="print-segment">
                  <div>
                    <span className="print-segment-time">{segmentTime}</span>
                    <span className="print-segment-title">{segment.title}</span>
                    {segment.duration && <span className="print-duration"> ({segment.duration} mins)</span>}
                  </div>

                  {segment.data?.leader && (
                    <div className="print-segment-detail">
                      Dirige: <span className="print-name">{segment.data.leader.replace(/\s*(?:trad|traduc|traducción|translation)[\s:.-].*$/i, '')}</span>
                    </div>
                  )}

                  {segment.songs && segment.songs.filter(s => s.title).length > 0 && (
                    <div className="print-segment-songs">
                      {segment.songs.filter(s => s.title).map((song, sIdx) => (
                        <div key={sIdx}>- {song.title} {song.lead && `(${song.lead})`}</div>
                      ))}
                    </div>
                  )}

                  {/* Dynamic sub-assignments from blueprint */}
                  {segment.sub_assignments && segment.sub_assignments.map((subAssign, saIdx) => {
                    const personValue = segment.data?.[subAssign.person_field_name];
                    if (!personValue) return null;
                    return (
                      <div key={saIdx} className="print-segment-detail">
                        • {subAssign.label}: <span className="print-name">{personValue}</span>
                        {subAssign.duration_min && <span className="print-duration"> ({subAssign.duration_min} min)</span>}
                      </div>
                    );
                  })}
                  
                  {/* Legacy fallback for old ministry_leader field */}
                  {(!segment.sub_assignments || segment.sub_assignments.length === 0) && segment.data?.ministry_leader && (
                    <div className="print-segment-detail">
                      • Ministración: <span className="print-name">{segment.data.ministry_leader}</span> <span className="print-duration">(5 min)</span>
                    </div>
                  )}

                  {segment.data?.preacher && (
                    <div className="print-segment-detail">
                      <span className="print-name">{segment.data.preacher.replace(/\s*(?:trad|traduc|traducción|translation)[\s:.-].*$/i, '')}</span>
                    </div>
                  )}

                  {segment.data?.preacher && segment.requires_translation && segment.data?.translator && 
                   !/(trad|traduc)/i.test(segment.data?.preacher || '') && (
                    <div className="print-segment-detail print-note-text" style={{ fontSize: '9pt', color: '#6b7280', marginTop: '2pt' }}>
                      🌐 Traduce: {segment.data.translator}
                    </div>
                  )}

                  {/* Cierre sub-assignment (shown after speaker) */}
                  {segment.sub_assignments && segment.sub_assignments.filter(sa => sa.person_field_name === 'cierre_leader').map((subAssign, saIdx) => {
                    const personValue = segment.data?.[subAssign.person_field_name];
                    if (!personValue) return null;
                    return (
                      <div key={saIdx} className="print-segment-detail">
                        • {subAssign.label}: <span className="print-name">{personValue}</span>
                        {subAssign.duration_min && <span className="print-duration"> ({subAssign.duration_min} min)</span>}
                      </div>
                    );
                  })}

                  {segment.data?.presenter && !segment.data?.ministry_leader && !segment.data?.preacher && !segment.data?.leader && (
                    <div className="print-segment-detail">
                      <span className="print-name">{segment.data.presenter.replace(/\s*(?:trad|traduc|traducción|translation)[\s:.-].*$/i, '')}</span>
                    </div>
                  )}

                  {segment.data?.presenter && !segment.data?.ministry_leader && !segment.data?.preacher && !segment.data?.leader && 
                   segment.requires_translation && segment.data?.translator && 
                   !/(trad|traduc)/i.test(segment.data?.presenter || '') && (
                    <div className="print-segment-detail print-note-text" style={{ fontSize: '9pt', color: '#6b7280', marginTop: '2pt' }}>
                      🌐 Traduce: {segment.data.translator}
                    </div>
                  )}

                  {segment.data?.title && (
                    <div className="print-segment-detail">
                      {segment.data.title}
                    </div>
                  )}

                  {segment.data?.verse && (
                    <div className="print-segment-detail print-note-text">
                      {segment.data.verse}
                    </div>
                  )}

                  {segment.data?.description && (
                    <div className="print-note-general-info">
                      {segment.data.description}
                    </div>
                  )}

                  {segment.data?.description_details && (
                    <div className="print-note-general-info">
                      <strong>📝 Notas:</strong> {segment.data.description_details}
                    </div>
                  )}

                  {segment.data?.projection_notes && (
                    <div className="print-note-projection-team">
                      <strong>📽️ Proyección:</strong> {segment.data.projection_notes}
                    </div>
                  )}

                  {segment.data?.sound_notes && (
                    <div className="print-note-sound-team">
                      <strong>🔊 Sonido:</strong> {segment.data.sound_notes}
                    </div>
                  )}

                  {segment.actions && segment.actions.length > 0 && (
                    <div className="print-note-coordinator-actions">
                      {segment.actions.map((action, aIdx) => {
                        const safeAction = typeof action === 'object' && action !== null ? action : {};
                        const hasTimingInLabel = /\d+\s*min/i.test(safeAction.label || '');
                        return (
                          <div key={aIdx}>
                            {safeAction.label || ''}
                            {!hasTimingInLabel && safeAction.timing === "before_end" && ` (${safeAction.offset_min || 0} min antes)`}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

          </div>

          <div className="print-service-column right">
            <div className="print-service-time">11:30 A.M.</div>
            {serviceData?.pre_service_notes?.["11:30am"] && (
              <div className="print-segment">
                <div className="print-note-general-info">
                  {serviceData.pre_service_notes["11:30am"]}
                </div>
              </div>
            )}
            {serviceData?.["11:30am"]?.filter(s => s.type !== 'break').map((segment, idx) => {
              let currentTime = parse("11:30am", "h:mma", new Date());
              for (let i = 0; i < idx; i++) {
                if (serviceData["11:30am"][i].type !== 'break' && serviceData["11:30am"][i].type !== 'ministry') {
                  currentTime = addMinutes(currentTime, serviceData["11:30am"][i].duration || 0);
                }
              }
              const segmentTime = formatDate(currentTime, "h:mm a");

              const presenterHasTranslation = /(trad|traduc)/i.test(segment.data?.presenter || '');
              const preacherHasTranslation = /(trad|traduc)/i.test(segment.data?.preacher || '');
              const leaderHasTranslation = /(trad|traduc)/i.test(segment.data?.leader || '');

              return (
                <div key={idx} className="print-segment">
                  <div>
                    <span className="print-segment-time">{segmentTime}</span>
                    <span className="print-segment-title">{segment.title}</span>
                    {segment.duration && <span className="print-duration"> ({segment.duration} mins)</span>}
                  </div>

                  {segment.data?.leader && (
                    <div className="print-segment-detail">
                      Dirige: <span className="print-name">{segment.data.leader.replace(/\s*(?:trad|traduc|traducción|translation)[\s:.-].*$/i, '')}</span>
                    </div>
                  )}

                  {segment.data?.leader && segment.requires_translation && segment.data?.translator && !leaderHasTranslation && (
                    <div className="print-segment-detail print-note-text" style={{ fontSize: '9pt', color: '#6b7280', marginTop: '2pt' }}>
                      🌐 Traduce: {segment.data.translator}
                    </div>
                  )}

                  {segment.songs && segment.songs.filter(s => s.title).length > 0 && (
                    <div className="print-segment-songs">
                      {segment.songs.filter(s => s.title).map((song, sIdx) => (
                        <div key={sIdx}>- {song.title} {song.lead && `(${song.lead})`}</div>
                      ))}
                    </div>
                  )}

                  {/* Dynamic sub-assignments from blueprint */}
                  {segment.sub_assignments && segment.sub_assignments.map((subAssign, saIdx) => {
                    const personValue = segment.data?.[subAssign.person_field_name];
                    if (!personValue) return null;
                    return (
                      <div key={saIdx} className="print-segment-detail">
                        • {subAssign.label}: <span className="print-name">{personValue}</span>
                        {subAssign.duration_min && <span className="print-duration"> ({subAssign.duration_min} min)</span>}
                      </div>
                    );
                  })}
                  
                  {/* Legacy fallback for old ministry_leader field */}
                  {(!segment.sub_assignments || segment.sub_assignments.length === 0) && segment.data?.ministry_leader && (
                    <div className="print-segment-detail">
                      • Ministración: <span className="print-name">{segment.data.ministry_leader}</span> <span className="print-duration">(5 min)</span>
                    </div>
                  )}

                  {segment.data?.preacher && (
                    <div className="print-segment-detail">
                      <span className="print-name">{segment.data.preacher.replace(/\s*(?:trad|traduc|traducción|translation)[\s:.-].*$/i, '')}</span>
                    </div>
                  )}

                  {segment.data?.preacher && segment.requires_translation && segment.data?.translator && !preacherHasTranslation && (
                    <div className="print-segment-detail print-note-text" style={{ fontSize: '9pt', color: '#6b7280', marginTop: '2pt' }}>
                      🌐 Traduce: {segment.data.translator}
                    </div>
                  )}

                  {/* Cierre sub-assignment (shown after speaker) */}
                  {segment.sub_assignments && segment.sub_assignments.filter(sa => sa.person_field_name === 'cierre_leader').map((subAssign, saIdx) => {
                    const personValue = segment.data?.[subAssign.person_field_name];
                    if (!personValue) return null;
                    return (
                      <div key={saIdx} className="print-segment-detail">
                        • {subAssign.label}: <span className="print-name">{personValue}</span>
                        {subAssign.duration_min && <span className="print-duration"> ({subAssign.duration_min} min)</span>}
                      </div>
                    );
                  })}

                  {segment.data?.presenter && !segment.data?.ministry_leader && !segment.data?.preacher && !segment.data?.leader && (
                    <div className="print-segment-detail">
                      <span className="print-name">{segment.data.presenter.replace(/\s*(?:trad|traduc|traducción|translation)[\s:.-].*$/i, '')}</span>
                    </div>
                  )}

                  {segment.data?.presenter && !segment.data?.ministry_leader && !segment.data?.preacher && !segment.data?.leader && 
                   segment.requires_translation && segment.data?.translator && !presenterHasTranslation && (
                    <div className="print-segment-detail print-note-text" style={{ fontSize: '9pt', color: '#6b7280', marginTop: '2pt' }}>
                      🌐 Traduce: {segment.data.translator}
                    </div>
                  )}

                  {segment.data?.title && (
                    <div className="print-segment-detail">
                      {segment.data.title}
                    </div>
                  )}

                  {segment.data?.verse && (
                    <div className="print-segment-detail print-note-text">
                      {segment.data.verse}
                    </div>
                  )}

                  {segment.data?.description && (
                    <div className="print-note-general-info">
                      {segment.data.description}
                    </div>
                  )}

                  {segment.data?.description_details && (
                    <div className="print-note-general-info">
                      {segment.data.description_details}
                    </div>
                  )}

                  {segment.data?.coordinator_notes && (
                    <div className="print-note-segment-coordinator">
                      <strong>📋 Coordinador:</strong> {segment.data.coordinator_notes}
                    </div>
                  )}

                  {segment.data?.projection_notes && (
                    <div className="print-note-projection-team">
                      <strong>📽️ Proyección:</strong> {segment.data.projection_notes}
                    </div>
                  )}

                  {segment.data?.sound_notes && (
                    <div className="print-note-sound-team">
                      <strong>🔊 Sonido:</strong> {segment.data.sound_notes}
                    </div>
                  )}

                  {segment.actions && segment.actions.length > 0 && (
                    <div className="print-note-coordinator-actions">
                      {segment.actions.map((action, aIdx) => {
                        const safeAction = typeof action === 'object' && action !== null ? action : {};
                        return (
                          <div key={aIdx}>
                            {safeAction.label || ''}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        </div>

        <div className="print-receso">
          11:00 A.M. — 11:30 A.M. • RECESO
          {serviceData?.receso_notes?.["9:30am"] && (
            <span style={{ fontSize: '9pt', fontWeight: 400, marginLeft: '8pt', fontStyle: 'italic', color: '#6b7280' }}>
              ({serviceData.receso_notes["9:30am"]})
            </span>
          )}
        </div>
        </div>

        {/* PAGE 2 */}
        <div className="print-page-2-wrapper">
        <div className="print-announcements">
          <div className="print-announcements-header" style={{ position: 'relative' }}>
            <div className="print-announcements-logo" style={{ position: 'absolute', left: '0', top: '0' }}>
              <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691b19c064436ea35f171ca3/e75f54157_image.png" alt="Logo" />
            </div>
            <div style={{ textAlign: 'center', paddingLeft: '0', paddingRight: '0' }}>
              <div className="print-announcements-title">ANUNCIOS</div>
              <p>Domingo {formatDate(new Date(selectedDate + 'T12:00:00'), "d 'de' MMMM, yyyy", { locale: es })}</p>
            </div>
          </div>

          <div className="print-announcements-body">
          <div className="print-announcement-list">
            {/* Left Column: Fixed announcements with full content + CUEs */}
            <div className="print-announcements-column-left">
              {fixedAnnouncements
                .filter(ann => selectedAnnouncements.includes(ann.id))
                .map((ann) => {
                  // Sanitize HTML for print - only allow safe tags
                  const sanitize = (html) => {
                    if (!html) return '';
                    return html
                      .replace(/<(?!\/?(b|i|strong|em|br)\b)[^>]*>/gi, '')
                      .replace(/&nbsp;/g, ' ');
                  };
                  return (
                    <div key={ann.id} className="print-announcement-item">
                      <div className="print-announcement-header">
                        <div className="print-announcement-title">{ann.title}</div>
                      </div>
                      {ann.content && (
                        <div 
                          className="print-announcement-content"
                          dangerouslySetInnerHTML={{ __html: sanitize(ann.content) }}
                        />
                      )}
                      {ann.instructions && (
                        <div 
                          className="print-announcement-instructions"
                          dangerouslySetInnerHTML={{ __html: sanitize(ann.instructions) }}
                        />
                      )}
                    </div>
                  );
                })}
            </div>
            
            {/* Right Column: Dynamic events with full details */}
            <div className="print-events-column-right">
              <div className="print-events-header">Próximos Eventos / Upcoming Events</div>
              {dynamicAnnouncements
                .filter(ann => selectedAnnouncements.includes(ann.id))
                .map((ann) => {
                  const sanitize = (html) => {
                    if (!html) return '';
                    return html
                      .replace(/<(?!\/?(b|i|strong|em|br)\b)[^>]*>/gi, '')
                      .replace(/&nbsp;/g, ' ');
                  };
                  const content = ann.isEvent ? (ann.announcement_blurb || ann.description) : ann.content;
                  const isEmphasized = ann.emphasize || ann.category === 'Urgent';
                  return (
                    <div key={ann.id} className={`print-event-compact ${isEmphasized ? 'print-event-emphasized' : ''}`}>
                      <div className="print-event-title">{ann.isEvent ? ann.name : ann.title}</div>
                      {(ann.date_of_occurrence || ann.start_date) && (
                        <div className="print-event-date">
                          {ann.date_of_occurrence || ann.start_date}
                          {ann.end_date && ` — ${ann.end_date}`}
                        </div>
                      )}
                      {content && (
                        <div 
                          className="print-event-content"
                          dangerouslySetInnerHTML={{ __html: sanitize(content) }}
                        />
                      )}
                      {ann.instructions && (
                        <div 
                          className="print-announcement-instructions"
                          dangerouslySetInnerHTML={{ __html: sanitize(ann.instructions) }}
                        />
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
          </div>
        </div>
        </div>

        <div className="print-footer">
          ¡Atrévete a cambiar!
        </div>
      </div>

      {/* Screen UI */}
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-5xl font-bold text-gray-900 uppercase tracking-tight font-['Bebas_Neue']">
            Servicios Dominicales
          </h1>
          <p className="text-gray-500 mt-1">{t('dashboard.services.subtitle')}</p>
          {/* Data Integrity Indicators */}
          <div className="flex items-center gap-3 mt-2">
            {existingData?.updated_date && (
              <Badge variant="outline" className="text-xs bg-green-50 border-green-200 text-green-700">
                Última actualización: {new Date(existingData.updated_date).toLocaleString('es-ES', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })}
              </Badge>
            )}
            {hasUnsavedChanges && (
              <Badge className="text-xs bg-yellow-500 text-white animate-pulse">
                {t('btn.saving')}
              </Badge>
            )}
            {lastSaveTimestamp && !hasUnsavedChanges && (
              <Badge variant="outline" className="text-xs bg-green-50 border-green-200 text-green-700">
                ✓ Guardado a las {new Date(lastSaveTimestamp).toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-3 items-center">
          {savingField && (
            <div className="flex items-center gap-2 text-xs md:text-sm text-gray-600">
              <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin text-pdv-teal" />
              <span className="hidden md:inline">{t('btn.saving')}</span>
            </div>
          )}
          
          {/* Live View Link - Always visible */}
          <Button 
            onClick={() => navigate(createPageUrl('PublicProgramView') + `?date=${selectedDate}`)}
            variant="outline"
            className="border-pdv-teal text-pdv-teal hover:bg-pdv-teal hover:text-white border-2 font-semibold text-xs md:text-sm px-2 py-1 md:px-4 md:py-2"
          >
            <Eye className="w-3 h-3 md:w-4 md:h-4 md:mr-2" />
            <span className="hidden md:inline">{t('btn.live_view')}</span>
          </Button>
          
          <Button 
            onClick={handleQuickPrint}
            variant="outline"
            className="border-2 border-gray-400 bg-white text-gray-900 hover:bg-gray-100 font-semibold text-xs md:text-sm px-2 py-1 md:px-4 md:py-2"
            title="Impresión Rápida / Quick Print"
          >
            <Printer className="w-3 h-3 md:w-4 md:h-4 md:mr-2" />
            <span className="hidden md:inline">Quick Print</span>
          </Button>
          
          <Button 
            onClick={() => setShowPrintSettings(true)}
            style={greenStyle}
            className="font-semibold text-xs md:text-sm px-2 py-1 md:px-4 md:py-2"
          >
            <Settings className="w-3 h-3 md:w-4 md:h-4 md:mr-2" />
            <span className="hidden md:inline">{t('btn.print')}</span>
          </Button>
        </div>
      </div>

      {/* Print Size Warning */}
      {(() => {
        const programOverflow = calculateServiceProgramOverflow();
        const announcementOverflow = calculateAnnouncementOverflow();
        const hasAnyOverflow = programOverflow.hasOverflow || announcementOverflow.hasOverflow;
        const worstLevel = programOverflow.level === 'high' || announcementOverflow.level === 'high' ? 'high' : 
                          programOverflow.level === 'medium' || announcementOverflow.level === 'medium' ? 'medium' : 'low';
        
        const statusConfig = {
          high: { color: 'bg-red-50 border-red-200 text-red-800', icon: '⚠', recommendation: 'Usa el botón ⚙️ (ajustes) para comprimir antes de imprimir' },
          medium: { color: 'bg-yellow-50 border-yellow-200 text-yellow-800', icon: '⚡', recommendation: 'Recomendado: usa el botón ⚙️ (ajustes) para mejor ajuste' },
          low: { color: 'bg-green-50 border-green-200 text-green-800', icon: '✓', recommendation: 'Todo se ajusta bien. Usa el botón 🖨️ (impresión rápida)' }
        }[worstLevel];

        return (
          <div className={`border-l-4 ${statusConfig.color} rounded px-4 py-2 print:hidden`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm">{statusConfig.icon}</span>
                <span className="font-semibold text-xs">Recomendación de Impresión:</span>
              </div>
              <span className="text-xs">{statusConfig.recommendation}</span>
            </div>
          </div>
        );
      })()}

      {/* Date Selection */}
      <Card className="print:hidden border-2 border-gray-300 bg-white">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <CalendarIcon className="w-5 h-5 text-pdv-teal flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <Label>Fecha del Domingo</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal mt-1">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? formatDate(new Date(selectedDate + 'T12:00:00'), "PPPP", { locale: es }) : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <style>{`
                    [data-disabled="true"] {
                      color: #d1d5db !important;
                      cursor: not-allowed !important;
                    }
                    [data-disabled="true"]:hover {
                      background-color: transparent !important;
                    }
                    button[role="gridcell"]:not([data-disabled="true"]):not([data-selected="true"]) {
                      color: #111827 !important;
                    }
                    button[role="gridcell"][data-selected="true"],
                    button[role="gridcell"][aria-selected="true"] {
                      background-color: #8DC63F !important;
                      color: white !important;
                    }
                    .rdp-day_selected {
                      background-color: #8DC63F !important;
                      color: white !important;
                    }
                  `}</style>
                  <Calendar
                    mode="single"
                    selected={selectedDate ? new Date(selectedDate + 'T12:00:00') : undefined}
                    onSelect={(date) => {
                      if (date) {
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        setSelectedDate(`${year}-${month}-${day}`);
                      }
                    }}
                    disabled={(date) => {
                      const dayOfWeek = date.getDay();
                      return dayOfWeek !== 0;
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two Services Side by Side */}
      <div className="grid md:grid-cols-2 gap-6 print:hidden">
        {/* 9:30 AM Service */}
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold text-red-600">9:30 a.m.</h2>
              {hasPermission(user, 'edit_services') && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSpecialSegmentDetails(prev => ({ ...prev, timeSlot: "9:30am" }));
                    setShowSpecialDialog(true);
                  }}
                  className="print:hidden border-2 border-gray-400 bg-white text-gray-900 font-semibold"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Especial
                </Button>
              )}
            </div>
            <div className="text-sm text-gray-600 flex items-center gap-3 flex-wrap">
              <Badge variant="outline" className={calculateServiceTimes("9:30am").isOverage ? "bg-amber-100 border-amber-400 text-amber-900 font-bold" : "bg-red-50"}>
                {calculateServiceTimes("9:30am").totalDuration} min total
                {calculateServiceTimes("9:30am").isOverage && ` (+${calculateServiceTimes("9:30am").overageAmount} min)`}
              </Badge>
              <span>Termina: {calculateServiceTimes("9:30am").endTime}</span>
              <span className="text-xs text-gray-500">(Meta: 11:00am)</span>
              {calculateServiceTimes("9:30am").isOverage && (
                <Badge className="bg-amber-600 text-white text-xs">⚠ Sobrepasa</Badge>
              )}
            </div>
          </div>

          {/* Pre-Service Block */}
          <Card className="bg-gray-100 border-2 border-gray-400">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-gray-700">
                <Clock className="w-4 h-4" />
                PRE-SERVICIO
                <Badge variant="outline" className="ml-auto text-xs text-gray-600 border-gray-500">Antes de iniciar</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyPreServiceNotesTo1130}
                  className="print:hidden h-7 px-2 hover:bg-blue-50"
                  title="Copiar a 11:30"
                >
                  <ArrowRight className="w-4 h-4 text-blue-600" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-2">
              <PreServiceNotesInput service="9:30am" />
            </CardContent>
          </Card>

          <div className="space-y-4">
            {serviceData["9:30am"].filter(seg => seg.type !== 'break').map((segment, idx) => {
              const timeSlot = "9:30am";
              const isExpanded = expandedSegments[`${timeSlot}-${idx}`];
                    
                    if (segment.type === "special") {
                     return (
                       <Card 
                         key={`${timeSlot}-special-${idx}`}
                         className="border-2 border-gray-300 border-l-4 border-l-orange-500 bg-orange-50"
                       >
                         <CardHeader className="pb-2">
                           <div className="flex items-center justify-between">
                             <CardTitle className="text-lg flex items-center gap-2">
                               <div className="print:hidden flex flex-col gap-0.5">
                                 <Button
                                   variant="ghost"
                                   size="sm"
                                   onClick={() => handleMoveSegment(timeSlot, idx, 'up')}
                                   disabled={idx === 0}
                                   className="h-4 w-5 p-0 hover:bg-blue-100"
                                 >
                                   <ChevronUp className="w-3 h-3" />
                                 </Button>
                                 <Button
                                   variant="ghost"
                                   size="sm"
                                   onClick={() => handleMoveSegment(timeSlot, idx, 'down')}
                                   disabled={idx === serviceData[timeSlot].filter(s => s.type !== 'break').length - 1}
                                   className="h-4 w-5 p-0 hover:bg-blue-100"
                                 >
                                   <ChevronDown className="w-3 h-3" />
                                 </Button>
                               </div>
                               <Sparkles className="w-4 h-4 text-orange-600" />
                               {segment.title}
                               <Badge className="ml-2 bg-orange-200 text-orange-800">Especial</Badge>
                             </CardTitle>
                             <Button
                               variant="ghost"
                               size="sm"
                               onClick={() => removeSpecialSegment(timeSlot, idx)}
                               className="print:hidden"
                             >
                               <Trash2 className="w-4 h-4 text-red-500" />
                             </Button>
                           </div>
                         </CardHeader>
                         <CardContent className="space-y-2 pt-3">
                           <AutocompleteInput
                             type="presenter"
                             placeholder="Presentador"
                             value={segment.data?.presenter || ""}
                             onChange={(e) => updateSegmentField(timeSlot, idx, "presenter", e.target.value)}
                             className="text-sm"
                           />
                           <AutocompleteInput
                             type="translator"
                             placeholder="Traductor"
                             value={segment.data?.translator || ""}
                             onChange={(e) => updateSegmentField(timeSlot, idx, "translator", e.target.value)}
                             className="text-sm"
                           />
                           <Textarea
                             placeholder="Descripción / Notas"
                             value={segment.data?.description || ""}
                             onChange={(e) => updateSegmentField(timeSlot, idx, "description", e.target.value)}
                             className="text-sm"
                             rows={2}
                           />
                           
                           <Button
                             variant="ghost"
                             size="sm"
                             onClick={() => toggleSegmentExpanded(timeSlot, idx)}
                             className="w-full text-xs mt-2 print:hidden"
                           >
                             {isExpanded ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                             {isExpanded ? "Menos detalles" : "Más detalles"}
                           </Button>

                           {isExpanded && (
                             <div className="space-y-2 pt-2 border-t">
                               <div className="space-y-1">
                                 <Label className="text-xs font-semibold text-gray-700">Duración (minutos)</Label>
                                 <Input
                                   type="number"
                                   value={segment.duration || 0}
                                   onChange={(e) => {
                                     const newDuration = parseInt(e.target.value) || 0;
                                     setServiceData(prev => {
                                       const updated = { ...prev };
                                       updated[timeSlot][idx].duration = newDuration;
                                       return updated;
                                     });
                                     debouncedSave(`${timeSlot}-${idx}-duration`);
                                   }}
                                   className="text-xs w-24"
                                 />
                               </div>
                               <Textarea
                                 placeholder="Notas de Proyección"
                                 value={segment.data?.projection_notes || ""}
                                 onChange={(e) => updateSegmentField(timeSlot, idx, "projection_notes", e.target.value)}
                                 className="text-xs"
                                 rows={2}
                               />
                               <Textarea
                                 placeholder="Notas de Sonido"
                                 value={segment.data?.sound_notes || ""}
                                 onChange={(e) => updateSegmentField(timeSlot, idx, "sound_notes", e.target.value)}
                                 className="text-xs"
                                 rows={2}
                               />
                               <Textarea
                                 placeholder="Notas Generales"
                                 value={segment.data?.description_details || ""}
                                 onChange={(e) => updateSegmentField(timeSlot, idx, "description_details", e.target.value)}
                                 className="text-xs"
                                 rows={2}
                               />
                             </div>
                           )}
                         </CardContent>
                       </Card>
                      );
                    }

                    return (
                      <Card 
                        key={`${timeSlot}-${idx}`}
                        className="border-2 border-gray-300 border-l-4 border-l-red-500 bg-white"
                      >
                        <CardHeader className="pb-2 bg-gray-50">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <div className="print:hidden flex flex-col gap-0.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMoveSegment(timeSlot, idx, 'up')}
                                disabled={idx === 0}
                                className="h-4 w-5 p-0 hover:bg-blue-100"
                              >
                                <ChevronUp className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMoveSegment(timeSlot, idx, 'down')}
                                disabled={idx === serviceData[timeSlot].filter(s => s.type !== 'break').length - 1}
                                className="h-4 w-5 p-0 hover:bg-blue-100"
                              >
                                <ChevronDown className="w-3 h-3" />
                              </Button>
                            </div>
                                <Clock className="w-4 h-4 text-red-600" />
                                {segment.title}
                                <Badge variant="outline" className="ml-auto text-xs">{segment.duration} min</Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copySegmentTo1130(idx)}
                                  className="print:hidden h-7 px-2 hover:bg-blue-50"
                                  title="Copiar a 11:30"
                                >
                                  <ArrowRight className="w-4 h-4 text-blue-600" />
                                </Button>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 pt-3">
                              {segment.fields.includes("leader") && (
                                <div className="space-y-1">
                                  <SegmentAutocomplete
                                    service="9:30am"
                                    segmentIndex={idx}
                                    field="leader"
                                    type="worshipLeader"
                                    placeholder="Líder / Director"
                                  />
                                  <p className="text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded px-2 py-1">
                                    💡 Sarah Manzano o Anthony Estrella (quien esté sirviendo). Si ninguno, el Director de Banda designado.
                                  </p>
                                </div>
                              )}
                              {segment.fields.includes("presenter") && (
                                <SegmentAutocomplete
                                  service="9:30am"
                                  segmentIndex={idx}
                                  field="presenter"
                                  type="presenter"
                                  placeholder="Presentador"
                                />
                              )}
                              {segment.fields.includes("preacher") && (
                                <SegmentAutocomplete
                                  service="9:30am"
                                  segmentIndex={idx}
                                  field="preacher"
                                  type="preacher"
                                  placeholder="Predicador"
                                />
                              )}
                              {segment.fields.includes("title") && (
                                <SegmentTextInput
                                  service="9:30am"
                                  segmentIndex={idx}
                                  field="title"
                                  placeholder="Título del Mensaje"
                                />
                              )}
                              {segment.fields.includes("verse") && (
                                <div className="space-y-1">
                                  <div className="flex gap-2">
                                    <SegmentTextInput
                                      service="9:30am"
                                      segmentIndex={idx}
                                      field="verse"
                                      placeholder="Verso / Cita Bíblica"
                                      className="text-sm flex-1"
                                    />
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleOpenVerseParser("9:30am", idx)}
                                      className="border-2 border-pdv-teal text-pdv-teal hover:bg-pdv-teal hover:text-white flex-shrink-0"
                                      title="Analizar versos y bosquejo"
                                    >
                                      <BookOpen className="w-4 h-4" />
                                    </Button>
                                  </div>
                                  <p className="text-[10px] text-gray-500 italic">
                                    💡 Usa el ícono 📖 para extraer y estructurar referencias bíblicas
                                  </p>
                                  {segment.data?.parsed_verse_data && (
                                    <Badge variant="outline" className="text-xs bg-green-50 border-green-300 text-green-700">
                                      ✓ Analizado ({segment.data.parsed_verse_data.sections?.length || 0} elementos)
                                    </Badge>
                                  )}
                                </div>
                              )}
                              {segment.songs && (
                                <div className="space-y-1">
                                  <Label className="text-xs font-semibold text-gray-700">Canciones</Label>
                                  {segment.songs.map((song, sIdx) => (
                                    <SongInputRow key={sIdx} service="9:30am" segmentIndex={idx} songIndex={sIdx} />
                                  ))}
                                </div>
                              )}
                              {segment.requires_translation && (
                                <div className="bg-blue-50 border border-blue-200 rounded p-2">
                                  <Label className="text-xs font-semibold text-blue-800 mb-1">
                                    🌐 Traductor(a)
                                    {segment.default_translator_source === "worship_segment_translator" && (
                                      <span className="ml-2 text-[10px] font-normal text-blue-600">(auto-rellena de Alabanza)</span>
                                    )}
                                  </Label>
                                  <SegmentAutocomplete
                                    service="9:30am"
                                    segmentIndex={idx}
                                    field="translator"
                                    type="translator"
                                    placeholder={
                                      segment.default_translator_source === "worship_segment_translator"
                                        ? (serviceData["9:30am"].find(s => s.type === "worship")?.data?.translator || "Del segmento de Alabanza")
                                        : "Nombre del traductor"
                                    }
                                  />
                                </div>
                              )}
                              {/* Dynamic Sub-Assignments from Blueprint */}
                              {segment.sub_assignments && segment.sub_assignments.length > 0 && (
                                <div className="space-y-2 border-t pt-2 mt-2">
                                  <Label className="text-xs font-semibold text-purple-800">Sub-Asignaciones</Label>
                                  {segment.sub_assignments.map((subAssign, saIdx) => (
                                    <div key={saIdx} className="bg-purple-50 border border-purple-200 rounded p-2">
                                      <Label className="text-xs font-semibold text-purple-800 mb-1">
                                        {subAssign.label} {subAssign.duration_min ? `(${subAssign.duration_min} min)` : ''}
                                      </Label>
                                      <SegmentAutocomplete
                                        service="9:30am"
                                        segmentIndex={idx}
                                        field={subAssign.person_field_name}
                                        type="person"
                                        placeholder={`Nombre para ${subAssign.label}`}
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {/* Legacy fallback for old ministry_leader field */}
                              {!segment.sub_assignments?.length && segment.fields.includes("ministry_leader") && (
                                <div className="bg-purple-50 border border-purple-200 rounded p-2">
                                  <Label className="text-xs font-semibold text-purple-800 mb-1">Ministración de Sanidad y Milagros (5 min)</Label>
                                  <SegmentAutocomplete
                                    service="9:30am"
                                    segmentIndex={idx}
                                    field="ministry_leader"
                                    type="ministryLeader"
                                    placeholder="Líder de Ministración"
                                  />
                                </div>
                              )}

                              <Button
                               variant="ghost"
                               size="sm"
                               onClick={() => toggleSegmentExpanded(timeSlot, idx)}
                               className="w-full text-xs mt-2 print:hidden"
                              >
                               {isExpanded ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                               {isExpanded ? "Menos detalles" : "Más detalles"}
                              </Button>

                              {isExpanded && (
                               <div className="space-y-2 pt-2 border-t">
                                 <div className="space-y-1">
                                   <Label className="text-xs font-semibold text-gray-700">Duración (minutos)</Label>
                                   <Input
                                     type="number"
                                     value={segment.duration || 0}
                                     onChange={(e) => {
                                       const newDuration = parseInt(e.target.value) || 0;
                                       setServiceData(prev => {
                                         const updated = { ...prev };
                                         updated[timeSlot][idx].duration = newDuration;
                                         return updated;
                                       });
                                       debouncedSave(`${timeSlot}-${idx}-duration`);
                                     }}
                                     className="text-xs w-24"
                                   />
                                 </div>

                                 {segment.actions && segment.actions.length > 0 && (
                                   <div className="bg-[#fffdf5] border border-yellow-100 rounded p-2">
                                     <Label className="text-xs font-semibold text-yellow-800 mb-2 block opacity-75">⏰ Acciones para Coordinador</Label>
                                     <div className="space-y-1">
                                       {segment.actions.map((action, aIdx) => (
                                         <div key={aIdx} className="text-xs text-yellow-900 flex items-start gap-1">
                                           <span className="font-semibold">•</span>
                                           <span>{action?.label || ''}</span>
                                         </div>
                                       ))}
                                     </div>
                                   </div>
                                 )}

                                 <SegmentTextarea service={timeSlot} segmentIndex={idx} field="coordinator_notes" placeholder="Notas para Coordinador" className="text-xs" />
                                 <SegmentTextarea service={timeSlot} segmentIndex={idx} field="projection_notes" placeholder="Notas de Proyección" className="text-xs" />
                                 <SegmentTextarea service={timeSlot} segmentIndex={idx} field="sound_notes" placeholder="Notas de Sonido" className="text-xs" />
                                 <SegmentTextarea service={timeSlot} segmentIndex={idx} field="description_details" placeholder="Notas Generales" className="text-xs" />
                                </div>
                              )}
                            </CardContent>
                          </Card>
                    );
                  })}
                </div>

          {/* Receso Block */}
          <Card className="bg-gray-100 border-2 border-gray-400">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-gray-600">
                <Clock className="w-4 h-4" />
                RECESO
                <Badge variant="outline" className="ml-auto text-xs text-gray-500 border-gray-400">30 min</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-2">
              <RecesoNotesInput />
            </CardContent>
          </Card>

          {/* Team Section */}
          <Card className="bg-green-50 border-2 border-green-300 print:hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                EQUIPO 9:30am
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyTeamTo1130}
                  className="h-7 px-2 hover:bg-blue-50"
                  title="Copiar a 11:30"
                >
                  <ArrowRight className="w-4 h-4 text-blue-600" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <TeamInput field="coordinators" service="9:30am" placeholder="Coordinador(a)" />
              <TeamInput field="ujieres" service="9:30am" placeholder="Ujieres" />
              <TeamInput field="sound" service="9:30am" placeholder="Sonido" />
              <TeamInput field="luces" service="9:30am" placeholder="Luces" />
            </CardContent>
          </Card>
        </div>

        {/* 11:30 AM Service */}
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold text-blue-600">11:30 a.m.</h2>
              {hasPermission(user, 'edit_services') && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={copy930To1130}
                    className="print:hidden bg-blue-600 hover:bg-blue-700 text-white font-semibold border-2 border-blue-600"
                  >
                    <ChevronsRight className="w-4 h-4 mr-2" />
                    Copiar Todo de 9:30
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSpecialSegmentDetails(prev => ({ ...prev, timeSlot: "11:30am" }));
                      setShowSpecialDialog(true);
                    }}
                    className="print:hidden border-2 border-gray-400 bg-white text-gray-900 font-semibold"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Especial
                  </Button>
                </div>
              )}
            </div>
            <div className="text-sm text-gray-600 flex items-center gap-3 flex-wrap">
              <Badge variant="outline" className={calculateServiceTimes("11:30am").isOverage ? "bg-amber-100 border-amber-400 text-amber-900 font-bold" : "bg-blue-50"}>
                {calculateServiceTimes("11:30am").totalDuration} min total
                {calculateServiceTimes("11:30am").isOverage && ` (+${calculateServiceTimes("11:30am").overageAmount} min)`}
              </Badge>
              <span>Termina: {calculateServiceTimes("11:30am").endTime}</span>
              <span className="text-xs text-gray-500">(Meta: 1:00pm)</span>
              {calculateServiceTimes("11:30am").isOverage && (
                <Badge className="bg-amber-600 text-white text-xs">⚠ Sobrepasa</Badge>
              )}
            </div>
          </div>

          {/* Pre-Service Block */}
          <Card className="bg-gray-100 border-2 border-gray-400">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-gray-700">
                <Clock className="w-4 h-4" />
                PRE-SERVICIO
                <Badge variant="outline" className="ml-auto text-xs text-gray-600 border-gray-500">Antes de iniciar</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-2">
              <PreServiceNotesInput service="11:30am" />
            </CardContent>
          </Card>

          <div className="space-y-4">
            {serviceData["11:30am"].map((segment, idx) => {
              const timeSlot = "11:30am";
              const isExpanded = expandedSegments[`${timeSlot}-${idx}`];
                    
                    if (segment.type === "special") {
                     return (
                       <Card 
                         key={`${timeSlot}-special-${idx}`}
                         className="border-2 border-gray-300 border-l-4 border-l-orange-500 bg-orange-50"
                       >
                         <CardHeader className="pb-2">
                           <div className="flex items-center justify-between">
                             <CardTitle className="text-lg flex items-center gap-2">
                               <div className="print:hidden flex flex-col gap-0.5">
                                 <Button
                                   variant="ghost"
                                   size="sm"
                                   onClick={() => handleMoveSegment(timeSlot, idx, 'up')}
                                   disabled={idx === 0}
                                   className="h-4 w-5 p-0 hover:bg-blue-100"
                                 >
                                   <ChevronUp className="w-3 h-3" />
                                 </Button>
                                 <Button
                                   variant="ghost"
                                   size="sm"
                                   onClick={() => handleMoveSegment(timeSlot, idx, 'down')}
                                   disabled={idx === serviceData[timeSlot].length - 1}
                                   className="h-4 w-5 p-0 hover:bg-blue-100"
                                 >
                                   <ChevronDown className="w-3 h-3" />
                                 </Button>
                               </div>
                               <Sparkles className="w-4 h-4 text-orange-600" />
                               {segment.title}
                               <Badge className="ml-2 bg-orange-200 text-orange-800">Especial</Badge>
                             </CardTitle>
                             <Button
                               variant="ghost"
                               size="sm"
                               onClick={() => removeSpecialSegment(timeSlot, idx)}
                               className="print:hidden"
                             >
                               <Trash2 className="w-4 h-4 text-red-500" />
                             </Button>
                           </div>
                         </CardHeader>
                         <CardContent className="space-y-2 pt-3">
                           <AutocompleteInput
                             type="presenter"
                             placeholder="Presentador"
                             value={segment.data?.presenter || ""}
                             onChange={(e) => updateSegmentField(timeSlot, idx, "presenter", e.target.value)}
                             className="text-sm"
                           />
                           <AutocompleteInput
                             type="translator"
                             placeholder="Traductor"
                             value={segment.data?.translator || ""}
                             onChange={(e) => updateSegmentField(timeSlot, idx, "translator", e.target.value)}
                             className="text-sm"
                           />
                           <Textarea
                             placeholder="Descripción / Notas"
                             value={segment.data?.description || ""}
                             onChange={(e) => updateSegmentField(timeSlot, idx, "description", e.target.value)}
                             className="text-sm"
                             rows={2}
                           />
                           
                           <Button
                             variant="ghost"
                             size="sm"
                             onClick={() => toggleSegmentExpanded(timeSlot, idx)}
                             className="w-full text-xs mt-2 print:hidden"
                           >
                             {isExpanded ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                             {isExpanded ? "Menos detalles" : "Más detalles"}
                           </Button>

                           {isExpanded && (
                             <div className="space-y-2 pt-2 border-t">
                               <div className="space-y-1">
                                 <Label className="text-xs font-semibold text-gray-700">Duración (minutos)</Label>
                                 <Input
                                   type="number"
                                   value={segment.duration || 0}
                                   onChange={(e) => {
                                     const newDuration = parseInt(e.target.value) || 0;
                                     setServiceData(prev => {
                                       const updated = { ...prev };
                                       updated[timeSlot][idx].duration = newDuration;
                                       return updated;
                                     });
                                     debouncedSave(`${timeSlot}-${idx}-duration`);
                                   }}
                                   className="text-xs w-24"
                                 />
                               </div>
                               <Textarea
                                 placeholder="Notas de Proyección"
                                 value={segment.data?.projection_notes || ""}
                                 onChange={(e) => updateSegmentField(timeSlot, idx, "projection_notes", e.target.value)}
                                 className="text-xs"
                                 rows={2}
                               />
                               <Textarea
                                 placeholder="Notas de Sonido"
                                 value={segment.data?.sound_notes || ""}
                                 onChange={(e) => updateSegmentField(timeSlot, idx, "sound_notes", e.target.value)}
                                 className="text-xs"
                                 rows={2}
                               />
                               <Textarea
                                 placeholder="Notas Generales"
                                 value={segment.data?.description_details || ""}
                                 onChange={(e) => updateSegmentField(timeSlot, idx, "description_details", e.target.value)}
                                 className="text-xs"
                                 rows={2}
                               />
                             </div>
                           )}
                         </CardContent>
                       </Card>
                      );
                    }

                    return (
                      <Card 
                        key={`${timeSlot}-${idx}`}
                        className="border-2 border-gray-300 border-l-4 border-l-blue-500 bg-white"
                      >
                        <CardHeader className="pb-2 bg-gray-50">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <div className="print:hidden flex flex-col gap-0.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMoveSegment(timeSlot, idx, 'up')}
                                disabled={idx === 0}
                                className="h-4 w-5 p-0 hover:bg-blue-100"
                              >
                                <ChevronUp className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMoveSegment(timeSlot, idx, 'down')}
                                disabled={idx === serviceData[timeSlot].length - 1}
                                className="h-4 w-5 p-0 hover:bg-blue-100"
                              >
                                <ChevronDown className="w-3 h-3" />
                              </Button>
                            </div>
                                <Clock className="w-4 h-4 text-blue-600" />
                                {segment.title}
                                <Badge variant="outline" className="ml-auto text-xs">{segment.duration} min</Badge>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 pt-3">
                              {segment.fields.includes("leader") && (
                                <div className="space-y-1">
                                  <SegmentAutocomplete
                                    service="11:30am"
                                    segmentIndex={idx}
                                    field="leader"
                                    type="worshipLeader"
                                    placeholder="Líder / Director"
                                  />
                                  <p className="text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded px-2 py-1">
                                    💡 Sarah Manzano o Anthony Estrella (quien esté sirviendo). Si ninguno, el Director de Banda designado.
                                  </p>
                                </div>
                              )}
                              {segment.fields.includes("presenter") && (
                                <SegmentAutocomplete
                                  service="11:30am"
                                  segmentIndex={idx}
                                  field="presenter"
                                  type="presenter"
                                  placeholder="Presentador"
                                />
                              )}
                              {segment.fields.includes("preacher") && (
                                <SegmentAutocomplete
                                  service="11:30am"
                                  segmentIndex={idx}
                                  field="preacher"
                                  type="preacher"
                                  placeholder="Predicador"
                                />
                              )}
                              {segment.fields.includes("title") && (
                                <SegmentTextInput
                                  service="11:30am"
                                  segmentIndex={idx}
                                  field="title"
                                  placeholder="Título del Mensaje"
                                />
                              )}
                              {segment.fields.includes("verse") && (
                                <div className="space-y-1">
                                  <div className="flex gap-2">
                                    <SegmentTextInput
                                      service="11:30am"
                                      segmentIndex={idx}
                                      field="verse"
                                      placeholder="Verso / Cita Bíblica"
                                      className="text-sm flex-1"
                                    />
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleOpenVerseParser("11:30am", idx)}
                                      className="border-2 border-pdv-teal text-pdv-teal hover:bg-pdv-teal hover:text-white flex-shrink-0"
                                      title="Analizar versos y bosquejo"
                                    >
                                      <BookOpen className="w-4 h-4" />
                                    </Button>
                                  </div>
                                  <p className="text-[10px] text-gray-500 italic">
                                    💡 Usa el ícono 📖 para extraer y estructurar referencias bíblicas
                                  </p>
                                  {segment.data?.parsed_verse_data && (
                                    <Badge variant="outline" className="text-xs bg-green-50 border-green-300 text-green-700">
                                      ✓ Analizado ({segment.data.parsed_verse_data.sections?.length || 0} elementos)
                                    </Badge>
                                  )}
                                </div>
                              )}
                              {segment.songs && (
                                <div className="space-y-1">
                                  <Label className="text-xs font-semibold text-gray-700">Canciones</Label>
                                  {segment.songs.map((song, sIdx) => (
                                    <SongInputRow key={sIdx} service="11:30am" segmentIndex={idx} songIndex={sIdx} />
                                  ))}
                                </div>
                              )}
                              {segment.requires_translation && (
                                <div className="bg-blue-50 border border-blue-200 rounded p-2">
                                  <Label className="text-xs font-semibold text-blue-800 mb-1">
                                    🌐 Traductor(a)
                                    {segment.default_translator_source === "worship_segment_translator" && (
                                      <span className="ml-2 text-[10px] font-normal text-blue-600">(auto-rellena de Alabanza)</span>
                                    )}
                                  </Label>
                                  <SegmentAutocomplete
                                    service="11:30am"
                                    segmentIndex={idx}
                                    field="translator"
                                    type="translator"
                                    placeholder={
                                      segment.default_translator_source === "worship_segment_translator"
                                        ? (serviceData["11:30am"].find(s => s.type === "worship")?.data?.translator || "Del segmento de Alabanza")
                                        : "Nombre del traductor"
                                    }
                                  />
                                </div>
                              )}


                              {/* Dynamic Sub-Assignments from Blueprint */}
                              {segment.sub_assignments && segment.sub_assignments.length > 0 && (
                                <div className="space-y-2 border-t pt-2 mt-2">
                                  <Label className="text-xs font-semibold text-purple-800">Sub-Asignaciones</Label>
                                  {segment.sub_assignments.map((subAssign, saIdx) => (
                                    <div key={saIdx} className="bg-purple-50 border border-purple-200 rounded p-2">
                                      <Label className="text-xs font-semibold text-purple-800 mb-1">
                                        {subAssign.label} {subAssign.duration_min ? `(${subAssign.duration_min} min)` : ''}
                                      </Label>
                                      <SegmentAutocomplete
                                        service="11:30am"
                                        segmentIndex={idx}
                                        field={subAssign.person_field_name}
                                        type="person"
                                        placeholder={`Nombre para ${subAssign.label}`}
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {/* Legacy fallback for old ministry_leader field */}
                              {!segment.sub_assignments?.length && segment.fields.includes("ministry_leader") && (
                                <div className="bg-purple-50 border border-purple-200 rounded p-2">
                                  <Label className="text-xs font-semibold text-purple-800 mb-1">Ministración de Sanidad y Milagros (5 min)</Label>
                                  <SegmentAutocomplete
                                    service="11:30am"
                                    segmentIndex={idx}
                                    field="ministry_leader"
                                    type="ministryLeader"
                                    placeholder="Líder de Ministración"
                                  />
                                </div>
                              )}



                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleSegmentExpanded(timeSlot, idx)}
                                className="w-full text-xs mt-2 print:hidden"
                              >
                                {isExpanded ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                                {isExpanded ? "Menos detalles" : "Más detalles"}
                              </Button>

                              {isExpanded && (
                                <div className="space-y-2 pt-2 border-t">
                                  <div className="space-y-1">
                                    <Label className="text-xs font-semibold text-gray-700">Duración (minutos)</Label>
                                    <Input
                                      type="number"
                                      value={segment.duration || 0}
                                      onChange={(e) => {
                                        const newDuration = parseInt(e.target.value) || 0;
                                        setServiceData(prev => {
                                          const updated = { ...prev };
                                          updated[timeSlot][idx].duration = newDuration;
                                          return updated;
                                        });
                                        debouncedSave(`${timeSlot}-${idx}-duration`);
                                      }}
                                      className="text-xs w-24"
                                    />
                                  </div>
                                  
                                  {segment.actions && segment.actions.length > 0 && (
                                    <div className="bg-amber-50 border border-amber-200 rounded p-2">
                                      <Label className="text-xs font-semibold text-amber-900 mb-2 block">⏰ Acciones para Coordinador</Label>
                                      <div className="space-y-1">
                                        {segment.actions.map((action, aIdx) => (
                                          <div key={aIdx} className="text-xs text-amber-800 flex items-start gap-1">
                                            <span className="font-semibold">•</span>
                                            <span>{action?.label || ''}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}


                                  <SegmentTextarea service={timeSlot} segmentIndex={idx} field="coordinator_notes" placeholder="Notas para Coordinador" className="text-xs" />
                                  <SegmentTextarea service={timeSlot} segmentIndex={idx} field="projection_notes" placeholder="Notas de Proyección" className="text-xs" />
                                  <SegmentTextarea service={timeSlot} segmentIndex={idx} field="sound_notes" placeholder="Notas de Sonido" className="text-xs" />
                                  <SegmentTextarea service={timeSlot} segmentIndex={idx} field="description_details" placeholder="Notas Generales" className="text-xs" />
                                </div>
                              )}
                            </CardContent>
                          </Card>
                    );
                    })}
                    </div>

                    {/* Team Section */}
          <Card className="bg-blue-50 border-2 border-blue-300 print:hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">EQUIPO 11:30am</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <TeamInput field="coordinators" service="11:30am" placeholder="Coordinador(a)" />
              <TeamInput field="ujieres" service="11:30am" placeholder="Ujieres" />
              <TeamInput field="sound" service="11:30am" placeholder="Sonido" />
              <TeamInput field="luces" service="11:30am" placeholder="Luces" />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Announcements Section */}
      <Card className="print:hidden border-2 border-gray-300 bg-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold uppercase">Anuncios</CardTitle>
            {hasPermission(user, 'create_announcements') && (
              <Button
                onClick={() => {
                  setEditingAnnouncement(null);
                  setAnnouncementForm({ title: "", content: "", instructions: "", category: "General", is_active: true, priority: 10, has_video: false, date_of_occurrence: "", emphasize: false });
                  setShowAnnouncementDialog(true);
                }}
                size="sm"
                style={tealStyle}
                className="print:hidden"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Anuncio
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Bulk Selection Controls */}
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const allFixed = fixedAnnouncements.map(a => a.id);
                setSelectedAnnouncements(prev => [...new Set([...prev, ...allFixed])]);
              }}
            >
              ✓ Seleccionar todos los fijos
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const allDynamic = dynamicAnnouncements.map(a => a.id);
                setSelectedAnnouncements(prev => [...new Set([...prev, ...allDynamic])]);
              }}
            >
              ✓ Seleccionar dinámicos relevantes
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const defaultSelection = [
                  ...fixedAnnouncements.map(a => a.id),
                  ...dynamicAnnouncements.map(a => a.id)
                ];
                setSelectedAnnouncements(defaultSelection);
              }}
            >
              ⟲ Restaurar selección por defecto
            </Button>
          </div>

          {/* Fixed Announcements */}
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <Label className="text-base font-bold text-gray-900">Anuncios Fijos / Static Announcements</Label>
              <p className="text-xs text-gray-600 mt-1">
                Los anuncios fijos aparecen cada semana. Manténgalos cortos y use el formato para claridad, no para longitud.
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Static announcements appear every week. Keep them short and use formatting for clarity, not length.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {fixedAnnouncements.map(ann => (
                <div key={ann.id} className="flex items-start gap-2 p-3 border-2 border-gray-300 rounded-lg bg-white hover:border-gray-400 transition-colors">
                  <Checkbox
                    checked={selectedAnnouncements.includes(ann.id)}
                    onCheckedChange={(checked) => {
                      setSelectedAnnouncements(prev => 
                        checked ? [...prev, ann.id] : prev.filter(id => id !== ann.id)
                      );
                    }}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-bold text-sm leading-tight">{ann.title}</h3>
                      {hasPermission(user, 'edit_announcements') && (
                        <div className="flex gap-1 flex-shrink-0 print:hidden">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => moveAnnouncementPriority(ann, 'up')}
                          >
                            <ChevronUp className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => moveAnnouncementPriority(ann, 'down')}
                          >
                            <ChevronDown className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openAnnouncementEdit(ann)}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          {hasPermission(user, 'delete_announcements') && (
                            <button
                              type="button"
                              className="h-7 w-7 flex items-center justify-center hover:bg-red-50 rounded"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDeleteConfirmId(ann.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-red-500 hover:text-red-700" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div 
                      className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap mb-2"
                      dangerouslySetInnerHTML={{ __html: (ann.content || '').replace(/<(?!\/?(b|i|strong|em|br)\b)[^>]*>/gi, '') }}
                    />
                    {ann.instructions && (
                      <div className="bg-gray-100 border border-gray-300 rounded p-2 mt-2">
                        <p className="text-[10px] text-gray-600 font-semibold mb-1">📋 Instrucciones (solo presentador):</p>
                        <div 
                          className="text-[10px] text-gray-600 italic whitespace-pre-wrap"
                          dangerouslySetInnerHTML={{ __html: (ann.instructions || '').replace(/<(?!\/?(b|i|strong|em|br)\b)[^>]*>/gi, '') }}
                        />
                      </div>
                    )}
                    {ann.has_video && (
                      <Badge className="bg-purple-100 text-purple-800 text-[10px] mt-2">
                        📹 Video
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dynamic Announcements */}
          <div className="space-y-3">
            <div>
              <Label className="text-base font-bold text-gray-900">Anuncios Dinámicos</Label>
              <p className="text-xs text-gray-600 mt-1">
                Anuncios de Eventos, Ministerios o Urgentes activos. Expiran automáticamente después de su Fecha de Ocurrencia.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {dynamicAnnouncements.map(ann => (
                <div key={ann.id} className={`flex items-start gap-2 p-3 rounded-lg transition-colors ${ann.emphasize || ann.category === 'Urgent' ? 'border-[3px] border-red-400 bg-red-50' : 'border-2 border-blue-300 bg-blue-50'}`}>
                  <Checkbox
                    checked={selectedAnnouncements.includes(ann.id)}
                    onCheckedChange={(checked) => {
                      setSelectedAnnouncements(prev => 
                        checked ? [...prev, ann.id] : prev.filter(id => id !== ann.id)
                      );
                    }}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                   <div className="flex items-start justify-between gap-2 mb-2">
                     <div className="flex-1">
                       <div className="flex items-center gap-2 mb-1">
                         <h3 className="font-bold text-sm leading-tight">{ann.isEvent ? ann.name : ann.title}</h3>
                         {ann.isEvent && <Badge className="bg-purple-200 text-purple-800 text-[10px]">Evento</Badge>}
                         {!ann.isEvent && (ann.emphasize || ann.category === 'Urgent') && <Badge className="bg-red-100 text-red-700 text-[10px] border border-red-300">⚡ DESTACADO</Badge>}
                       </div>
                        {(ann.date_of_occurrence || ann.start_date) && (
                          <p className="text-xs font-semibold text-blue-600 mb-1">
                            📅 {ann.date_of_occurrence || ann.start_date} {ann.end_date && `- ${ann.end_date}`}
                          </p>
                        )}
                      </div>
                      {ann.isEvent && (
                        <div className="flex items-center gap-1 print:hidden">
                          <Checkbox
                            checked={ann.announcement_has_video}
                            onCheckedChange={(checked) => {
                              updateAnnouncementMutation.mutate({
                                id: ann.id,
                                data: { ...ann, announcement_has_video: checked }
                              });
                            }}
                          />
                          <span className="text-xs font-semibold text-purple-700">📹</span>
                        </div>
                      )}
                      {!ann.isEvent && hasPermission(user, 'edit_announcements') && (
                        <div className="flex gap-1 flex-shrink-0 print:hidden">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => moveAnnouncementPriority(ann, 'up')}
                          >
                            <ChevronUp className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => moveAnnouncementPriority(ann, 'down')}
                          >
                            <ChevronDown className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openAnnouncementEdit(ann)}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          {hasPermission(user, 'delete_announcements') && (
                            <button
                              type="button"
                              className="h-7 w-7 flex items-center justify-center hover:bg-red-50 rounded"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDeleteConfirmId(ann.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-red-500 hover:text-red-700" />
                            </button>
                          )}
                        </div>
                      )}
                      )}
                    </div>
                    <div 
                      className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap mb-2"
                      dangerouslySetInnerHTML={{ __html: ((ann.isEvent ? ann.announcement_blurb || ann.description : ann.content) || '').replace(/<(?!\/?(b|i|strong|em|br)\b)[^>]*>/gi, '') }}
                    />
                    {ann.instructions && (
                      <div className="bg-gray-100 border border-gray-300 rounded p-2 mt-2">
                        <p className="text-[10px] text-gray-600 font-semibold mb-1">📋 Instrucciones (solo presentador):</p>
                        <div 
                          className="text-[10px] text-gray-600 italic whitespace-pre-wrap"
                          dangerouslySetInnerHTML={{ __html: (ann.instructions || '').replace(/<(?!\/?(b|i|strong|em|br)\b)[^>]*>/gi, '') }}
                        />
                      </div>
                    )}
                    {(ann.has_video || ann.announcement_has_video) && (
                      <Badge className="bg-purple-100 text-purple-800 text-[10px] mt-2">
                        📹 Video
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Special Segment Dialog */}
      <Dialog open={showSpecialDialog} onOpenChange={setShowSpecialDialog}>
        <DialogContent className="max-w-md bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base md:text-lg">Insertar Segmento Especial ({specialSegmentDetails.timeSlot})</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título del Segmento</Label>
              <Input
                value={specialSegmentDetails.title}
                onChange={(e) => setSpecialSegmentDetails(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ej. Presentación de Niños"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Presentador</Label>
                <AutocompleteInput
                  type="presenter"
                  value={specialSegmentDetails.presenter}
                  onChange={(e) => setSpecialSegmentDetails(prev => ({ ...prev, presenter: e.target.value }))}
                  placeholder="Nombre del presentador"
                  className="text-sm"
                />
              </div>
              {specialSegmentDetails.timeSlot === "11:30am" && (
                <div className="space-y-2">
                  <Label className="text-sm">Traductor</Label>
                  <AutocompleteInput
                    type="translator"
                    value={specialSegmentDetails.translator}
                    onChange={(e) => setSpecialSegmentDetails(prev => ({ ...prev, translator: e.target.value }))}
                    placeholder="Nombre del traductor"
                    className="text-sm"
                  />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Duración (minutos)</Label>
              <Input
                type="number"
                value={specialSegmentDetails.duration}
                onChange={(e) => setSpecialSegmentDetails(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Insertar después de:</Label>
              <select
                className="w-full border rounded-md p-2 text-sm"
                value={specialSegmentDetails.insertAfterIdx}
                onChange={(e) => setSpecialSegmentDetails(prev => ({ ...prev, insertAfterIdx: parseInt(e.target.value) }))}
              >
                <option value="-1">Al inicio</option>
                {serviceData[specialSegmentDetails.timeSlot]
                  .filter(seg => seg.type !== "special")
                  .map((segment, idx) => (
                    <option key={idx} value={idx}>{segment.title}</option>
                  ))}
              </select>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
              <Button variant="outline" onClick={() => setShowSpecialDialog(false)} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <Button onClick={addSpecialSegment} style={tealStyle} className="w-full sm:w-auto">
                Añadir Segmento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm bg-white">
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">¿Estás seguro de que deseas eliminar este anuncio?</p>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancelar
            </Button>
            <Button 
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                deleteAnnouncementMutation.mutate(deleteConfirmId);
                setDeleteConfirmId(null);
              }}
            >
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print Settings Modal */}
      <PrintSettingsModal
        open={showPrintSettings}
        onOpenChange={setShowPrintSettings}
        settingsPage1={activePrintSettingsPage1}
        settingsPage2={activePrintSettingsPage2}
        onSave={handleSavePrintSettings}
        language="es"
        serviceData={serviceData}
      />

      {/* Verse Parser Dialog */}
      <VerseParserDialog
        open={verseParserOpen}
        onOpenChange={setVerseParserOpen}
        initialText={verseParserContext.initialText || ""}
        onSave={handleSaveParsedVerses}
        language="es"
      />

      {/* Announcement Dialog */}
      <Dialog open={showAnnouncementDialog} onOpenChange={setShowAnnouncementDialog}>
        <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>
                {editingAnnouncement ? "Editar Anuncio / Edit Announcement" : "Nuevo Anuncio / New Announcement"}
              </DialogTitle>
              {editingAnnouncement && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDeleteConfirmId(editingAnnouncement.id);
                    setShowAnnouncementDialog(false);
                  }}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar / Delete
                </Button>
              )}
            </div>
          </DialogHeader>
          <StaticAnnouncementForm
            announcement={announcementForm}
            onChange={setAnnouncementForm}
            onSave={handleAnnouncementSubmit}
            onCancel={() => setShowAnnouncementDialog(false)}
            isEditing={!!editingAnnouncement}
            onOptimize={optimizeAnnouncementWithAI}
            optimizing={optimizingAnnouncement}
          />
        </DialogContent>
      </Dialog>
    </div>
      </UpdatersContext.Provider>
    </ServiceDataContext.Provider>
  );
}
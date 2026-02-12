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
import { Calendar as CalendarIcon, Clock, Plus, Trash2, Edit, Sparkles, ChevronUp, ChevronDown, Loader2, ArrowRight, ChevronsRight, Eye, Wand2, ExternalLink, Settings, BookOpen, Download } from "lucide-react";
import PrintSettingsModal from "@/components/print/PrintSettingsModal";
import VerseParserDialog from "@/components/service/VerseParserDialog";
import { Calendar } from "@/components/ui/calendar";
import { createPageUrl } from "@/utils";

import { addMinutes, parse, format as formatDate } from "date-fns";
import { generateWeeklyProgramPDF } from "@/components/service/generateWeeklyProgramPDF";
import { generateAnnouncementsPDF } from "@/components/service/generateAnnouncementsPDF";
import WeeklyServicePrintView from "@/components/service/WeeklyServicePrintView";
import { toast } from "sonner";
import { es } from "date-fns/locale";
import { useLanguage } from "@/components/utils/i18n";
import WeeklyServicePrintCSS from "@/components/service/WeeklyServicePrintCSS";
import WeeklyAnnouncementSection from "@/components/service/WeeklyAnnouncementSection";
import SpecialSegmentDialog from "@/components/service/SpecialSegmentDialog";
import ServiceTimeSlotColumn from "@/components/service/ServiceTimeSlotColumn";
import { ServiceDataContext, UpdatersContext } from "@/components/service/WeeklyServiceInputs";
import { calculateServiceProgramOverflow, calculateAnnouncementOverflow } from "@/components/service/useOverflowDetection";

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
      if (!services || services.length === 0) return null;

      // Filter for services that look like Weekly Services (have 9:30am/11:30am arrays populated)
      // and exclude Custom Services (which typically use the 'segments' array)
      const weeklyCandidates = services.filter(s => 
        (s["9:30am"]?.length > 0 || s["11:30am"]?.length > 0) &&
        (!s.segments || s.segments.length === 0)
      );

      if (weeklyCandidates.length > 0) {
        // Sort by updated_date desc to get latest valid one
        return weeklyCandidates.sort((a, b) => new Date(b.updated_date || 0) - new Date(a.updated_date || 0))[0];
      }

      // If only empty candidates exist (e.g. created but empty), prefer one without 'segments' populated (not a custom service)
      const emptyCandidates = services.filter(s => !s.segments || s.segments.length === 0);
      if (emptyCandidates.length > 0) {
         return emptyCandidates.sort((a, b) => new Date(b.updated_date || 0) - new Date(a.updated_date || 0))[0];
      }

      return services[0];
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
      // Phase 1: Replaced alert() with toast (2026-02-11)
      toast.error('Error al guardar: ' + error.message);
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
      // Phase 1: Replaced alert() with toast (2026-02-11)
      toast.error('Error al eliminar: ' + (error.message || JSON.stringify(error)));
    }
  });

  // Initialize service data
  useEffect(() => {
    if (existingData) {
      const mergeSegmentsWithBlueprint = (existingSegments, timeSlot) => {
        const activeBlueprint = blueprintData || { "9:30am": BLUEPRINT["9:30am"], "11:30am": BLUEPRINT["11:30am"] };
        
        // Helper to normalize types for matching (handles Spanish/English and Case)
        const normalizeType = (t) => {
          if (!t) return "";
          const lower = t.toLowerCase();
          if (lower === 'alabanza' || lower === 'worship') return 'worship';
          if (lower === 'bienvenida' || lower === 'welcome') return 'welcome';
          if (lower === 'ofrenda' || lower === 'ofrendas' || lower === 'offering') return 'offering';
          if (lower === 'plenaria' || lower === 'predica' || lower === 'mensaje' || lower === 'message') return 'message';
          return lower;
        };

        return existingSegments.map((savedSeg, idx) => {
          const savedType = normalizeType(savedSeg.type);
          
          // Try to match by index first (if types match), otherwise find by type
          let blueprintSeg = activeBlueprint[timeSlot]?.[idx];
          
          // If index-matched segment doesn't exist or type mismatch, try to find ANY segment of this type
          if (!blueprintSeg || normalizeType(blueprintSeg.type) !== savedType) {
            blueprintSeg = activeBlueprint[timeSlot]?.find(b => normalizeType(b.type) === savedType);
          }
          
          // Fallback to hardcoded blueprint if not found in active (and type matches)
          if (!blueprintSeg) {
             const hardcoded = BLUEPRINT[timeSlot]?.[idx];
             if (hardcoded && normalizeType(hardcoded.type) === savedType) {
               blueprintSeg = hardcoded;
             } else {
               blueprintSeg = BLUEPRINT[timeSlot]?.find(b => normalizeType(b.type) === savedType);
             }
          }
          
          if (blueprintSeg) {
            let subAssignments = blueprintSeg.sub_assignments || savedSeg.sub_assignments || [];
            
            // Add defaults if missing
            if (!subAssignments || subAssignments.length === 0) {
              if (savedType === 'worship') {
                subAssignments = [{ label: 'Ministración de Sanidad y Milagros', person_field_name: 'ministry_leader', duration_min: 5 }];
              } else if (savedType === 'message') {
                subAssignments = [{ label: 'Cierre', person_field_name: 'cierre_leader', duration_min: 5 }];
              }
            }
            
            return {
              ...savedSeg, // CRITICAL: This spreads ALL fields including root-level presentation_url, notes_url, etc.
              fields: blueprintSeg.fields || savedSeg.fields,
              sub_assignments: subAssignments,
              actions: blueprintSeg.actions || savedSeg.actions || [],
              requires_translation: blueprintSeg.requires_translation !== undefined ? blueprintSeg.requires_translation : savedSeg.requires_translation,
              default_translator_source: blueprintSeg.default_translator_source || savedSeg.default_translator_source || "manual",
            };
          }

          // Emergency Fallback: If no blueprint match, ensure standard types have their fields
          // This fixes legacy/corrupted data where fields array is empty
          if (!savedSeg.fields || savedSeg.fields.length === 0) {
             let defaultFields = [];
             if (savedType === 'worship') defaultFields = ["leader", "songs", "ministry_leader"];
             else if (savedType === 'welcome') defaultFields = ["presenter"];
             else if (savedType === 'offering') defaultFields = ["presenter", "verse"];
             else if (savedType === 'message') defaultFields = ["preacher", "title", "verse"];
             
             if (defaultFields.length > 0) {
                return { ...savedSeg, fields: defaultFields };
             }
          }
          
          // HOTFIX: Clean up corrupted actions from previous "Special" segments that inherited "Mensaje" actions
          if (savedSeg.type === 'special') {
             const cleanedActions = (savedSeg.actions || []).filter(action => {
                const label = (action.label || '').toLowerCase();
                // Filter out specific message closure actions
                if (label.includes('pianista sube') || label.includes('equipo de a&a sube')) return false;
                return true;
             });
             
             if (cleanedActions.length !== (savedSeg.actions || []).length) {
                return { ...savedSeg, actions: cleanedActions };
             }
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
      
      // Phase 1: Replaced window.confirm with toast action for backup recovery (2026-02-11)
      // Non-blocking: user sees toast with "Restore" action instead of blocking confirm dialog
      const backupKey = `service_backup_${selectedDate}`;
      const backup = localStorage.getItem(backupKey);
      if (backup) {
        try {
          const { data: backupData, timestamp } = JSON.parse(backup);
          const backupDate = new Date(timestamp);
          const serverDate = existingData.updated_date ? new Date(existingData.updated_date) : new Date(0);
          if (backupDate > serverDate) {
            toast('Se encontró una versión más reciente en el navegador.', {
              duration: 15000,
              action: {
                label: 'Restaurar',
                onClick: () => {
                  setServiceData(backupData);
                  setLastSavedData(JSON.parse(JSON.stringify(backupData)));
                  toast.success('Datos restaurados del backup local');
                },
              },
            });
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
              { title: "", lead: "", key: "" },
              { title: "", lead: "", key: "" },
              { title: "", lead: "", key: "" },
              { title: "", lead: "", key: "" }
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
              { title: "", lead: "", key: "" },
              { title: "", lead: "", key: "" },
              { title: "", lead: "", key: "" },
              { title: "", lead: "", key: "" }
            ];
          }
          
          return segmentCopy;
        }),
        coordinators: { "9:30am": "", "11:30am": "" },
        ujieres: { "9:30am": "", "11:30am": "" },
        sound: { "9:30am": "", "11:30am": "" },
        luces: { "9:30am": "", "11:30am": "" },
        fotografia: { "9:30am": "", "11:30am": "" },
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
      // Deep clone the service array we are modifying to ensure immutability
      const newServiceArray = [...(prev[service] || [])];
      
      // Clone the specific segment we are updating
      if (!newServiceArray[segmentIndex]) return prev;
      const newSegment = { ...newServiceArray[segmentIndex] };
      
      // Define fields that sit at the root of the segment object
      const rootFields = ['songs', 'presentation_url', 'notes_url', 'content_is_slides_only'];
      
      if (rootFields.includes(field)) {
        newSegment[field] = value;
      } else {
        newSegment.data = {
          ...newSegment.data,
          [field]: value
        };
      }
      
      // Place the updated segment back into the new array
      newServiceArray[segmentIndex] = newSegment;
      
      const updated = { 
        ...prev,
        [service]: newServiceArray
      };
      
      // Auto-propagate translator from worship to other segments in 11:30am
      if (field === 'translator' && service === '11:30am' && newSegment.type === 'worship') {
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
      updated.fotografia["11:30am"] = updated.fotografia["9:30am"];

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
      updated.fotografia["11:30am"] = updated.fotografia["9:30am"];
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

  // Phase 1: resetToBlueprint now uses state + confirmation dialog instead of window.confirm (2026-02-11)
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  
  const resetToBlueprint = () => {
    setShowResetConfirm(true);
  };

  const executeResetToBlueprint = () => {
    setShowResetConfirm(false);

    setSavingField('reset-blueprint');
    
    // Use database blueprint if available, fallback to hardcoded
    const activeBlueprint = blueprintData || { "9:30am": BLUEPRINT["9:30am"], "11:30am": BLUEPRINT["11:30am"] };
    
    // Helper to get default fields if blueprint is corrupted/missing them
    const getDefaultFields = (type) => {
      const t = type?.toLowerCase() || '';
      if (t === 'worship') return ["leader", "songs", "ministry_leader"];
      if (t === 'welcome') return ["presenter"];
      if (t === 'offering') return ["presenter", "verse"];
      if (t === 'message') return ["preacher", "title", "verse"];
      return [];
    };

    const initialData = {
      ...serviceData, // Keep ID, date, name, etc.
      "9:30am": activeBlueprint["9:30am"].map(seg => {
        const fields = seg.fields && seg.fields.length > 0 ? seg.fields : getDefaultFields(seg.type);
        const segmentCopy = {
          type: seg.type,
          title: seg.title,
          duration: seg.duration,
          fields: [...fields],
          data: {},
          actions: seg.actions ? seg.actions.map(a => ({ ...a })) : [],
          sub_assignments: seg.sub_assignments ? seg.sub_assignments.map(sa => ({ ...sa })) : [],
          requires_translation: seg.requires_translation || false,
          default_translator_source: seg.default_translator_source || "manual"
        };
        
        if (seg.type === "worship") {
          segmentCopy.songs = [
            { title: "", lead: "", key: "" },
            { title: "", lead: "", key: "" },
            { title: "", lead: "", key: "" },
            { title: "", lead: "", key: "" }
          ];
        }
        
        return segmentCopy;
      }),
      "11:30am": activeBlueprint["11:30am"].map(seg => {
        const fields = seg.fields && seg.fields.length > 0 ? seg.fields : getDefaultFields(seg.type);
        const segmentCopy = {
          type: seg.type,
          title: seg.title,
          duration: seg.duration,
          fields: [...fields],
          data: {},
          actions: seg.actions ? seg.actions.map(a => ({ ...a })) : [],
          sub_assignments: seg.sub_assignments ? seg.sub_assignments.map(sa => ({ ...sa })) : [],
          requires_translation: seg.requires_translation || false,
          default_translator_source: seg.default_translator_source || "manual"
        };
        
        if (seg.type === "worship") {
          segmentCopy.songs = [
            { title: "", lead: "", key: "" },
            { title: "", lead: "", key: "" },
            { title: "", lead: "", key: "" },
            { title: "", lead: "", key: "" }
          ];
        }
        
        return segmentCopy;
      }),
      // Preserve team info and notes
    };

    setServiceData(initialData);
    
    // Force immediate save
    const dataToSave = {
      ...initialData,
      selected_announcements: selectedAnnouncements,
      day_of_week: 'Sunday',
      name: `Domingo - ${selectedDate}`,
      status: 'active'
    };
    
    saveServiceMutation.mutate(dataToSave, {
      onSettled: () => setSavingField(null),
      onSuccess: () => {
        toast.success("Servicio restablecido al diseño original");
      }
    });
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
      // Phase 1: Replaced alert() with toast (2026-02-11)
      toast.error('Error al optimizar / Error optimizing: ' + error.message);
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

  const handleDownloadProgramPDF = async () => {
    const toastId = toast.loading('Generando PDF del Programa...');
    try {
      const pdf = await generateWeeklyProgramPDF(serviceData);
      pdf.download(`Programa-Domingo-${serviceData.date}.pdf`);
      toast.success('PDF descargado', { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('Error generando PDF: ' + error.message, { id: toastId });
    }
  };

  const handleDownloadAnnouncementsPDF = async () => {
    const toastId = toast.loading('Generando PDF de Anuncios...');
    try {
      const allAnns = [...fixedAnnouncements, ...dynamicAnnouncements];
      const selectedForPrint = allAnns.filter(a => selectedAnnouncements.includes(a.id));
      
      if (selectedForPrint.length === 0) {
        toast.error('No hay anuncios seleccionados', { id: toastId });
        return;
      }

      const pdf = await generateAnnouncementsPDF(selectedForPrint, serviceData);
      pdf.download(`Anuncios-Domingo-${serviceData.date}.pdf`);
      toast.success('PDF descargado', { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('Error generando PDF: ' + error.message, { id: toastId });
    }
  };

  const toggleSegmentExpanded = (timeSlot, idx) => {
    const key = `${timeSlot}-${idx}`;
    setExpandedSegments(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };



  // Phase 3A: Overflow detection extracted to useOverflowDetection.js

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
      {/* Phase 3A: Print CSS extracted to WeeklyServicePrintCSS component (~540 lines) */}
      <WeeklyServicePrintCSS
        printSettingsPage1={activePrintSettingsPage1}
        printSettingsPage2={activePrintSettingsPage2}
      />

      {/* Print Layout — Phase 3B: Extracted to WeeklyServicePrintView component */}
      <WeeklyServicePrintView
        serviceData={serviceData}
        selectedDate={selectedDate}
        fixedAnnouncements={fixedAnnouncements}
        dynamicAnnouncements={dynamicAnnouncements}
        selectedAnnouncements={selectedAnnouncements}
        printSettingsPage1={printSettingsPage1}
        printSettingsPage2={printSettingsPage2}
        isQuickPrint={isQuickPrint}
      />
      {/* REMOVED: ~500 lines of inline print HTML moved to WeeklyServicePrintView (Phase 3B) */}

      {/* Screen UI */}
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-5xl text-gray-900 uppercase tracking-tight">
            Servicios Dominicales
          </h1>
          <p className="text-gray-500 mt-1">{t('dashboard.services.subtitle')}</p>
          {/* Service ID for debugging */}
          {existingData?.id && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-400 font-mono">ID: {existingData.id}</span>
            </div>
          )}
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
            onClick={handleDownloadProgramPDF}
            style={tealStyle}
            className="font-semibold text-xs md:text-sm px-2 py-1 md:px-4 md:py-2"
            title="Descargar PDF Programa"
          >
            <Download className="w-3 h-3 md:w-4 md:h-4 md:mr-2" />
            <span className="hidden md:inline">PDF Programa</span>
          </Button>
          
          <Button 
            onClick={handleDownloadAnnouncementsPDF}
            style={greenStyle}
            className="font-semibold text-xs md:text-sm px-2 py-1 md:px-4 md:py-2"
            title="Descargar PDF Anuncios"
          >
            <Download className="w-3 h-3 md:w-4 md:h-4 md:mr-2" />
            <span className="hidden md:inline">PDF Anuncios</span>
          </Button>

          <Button 
            onClick={() => window.open('/api/functions/serveWeeklyServiceSubmission', '_blank')}
            variant="outline"
            className="border-2 border-purple-400 text-purple-600 hover:bg-purple-50 font-semibold px-2"
            title="Link para Oradores (Mensaje)"
          >
            <ExternalLink className="w-4 h-4 md:mr-2" />
            <span className="hidden md:inline">Link Mensaje</span>
          </Button>

          <Button 
            onClick={() => setShowPrintSettings(true)}
            variant="outline"
            className="border-2 border-gray-400 bg-white text-gray-900 hover:bg-gray-100 font-semibold px-2"
            title="Ajustes de Impresión / Scaling Settings"
          >
            <Settings className="w-4 h-4" />
          </Button>
          
          {hasPermission(user, 'edit_services') && (
            <Button 
              onClick={() => setShowResetConfirm(true)}
              variant="destructive"
              className="border-2 border-red-600 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white font-semibold px-2"
              title="Restablecer diseño original (Borrar datos)"
            >
              <Wand2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>



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

      {/* Phase 3A: Two service columns extracted to ServiceTimeSlotColumn (~1000 lines) */}
      <div className="grid md:grid-cols-2 gap-6 print:hidden">
        <ServiceTimeSlotColumn
          timeSlot="9:30am"
          serviceData={serviceData}
          expandedSegments={expandedSegments}
          toggleSegmentExpanded={toggleSegmentExpanded}
          handleMoveSegment={handleMoveSegment}
          removeSpecialSegment={removeSpecialSegment}
          updateSegmentField={updateSegmentField}
          debouncedSave={debouncedSave}
          setServiceData={setServiceData}
          handleOpenVerseParser={handleOpenVerseParser}
          calculateServiceTimes={calculateServiceTimes}
          copySegmentTo1130={copySegmentTo1130}
          copyPreServiceNotesTo1130={copyPreServiceNotesTo1130}
          copyTeamTo1130={copyTeamTo1130}
          onOpenSpecialDialog={(ts) => { setSpecialSegmentDetails(prev => ({ ...prev, timeSlot: ts })); setShowSpecialDialog(true); }}
          canEdit={hasPermission(user, 'edit_services')}
        />
        <ServiceTimeSlotColumn
          timeSlot="11:30am"
          serviceData={serviceData}
          expandedSegments={expandedSegments}
          toggleSegmentExpanded={toggleSegmentExpanded}
          handleMoveSegment={handleMoveSegment}
          removeSpecialSegment={removeSpecialSegment}
          updateSegmentField={updateSegmentField}
          debouncedSave={debouncedSave}
          setServiceData={setServiceData}
          handleOpenVerseParser={handleOpenVerseParser}
          calculateServiceTimes={calculateServiceTimes}
          copy930To1130={copy930To1130}
          onOpenSpecialDialog={(ts) => { setSpecialSegmentDetails(prev => ({ ...prev, timeSlot: ts })); setShowSpecialDialog(true); }}
          canEdit={hasPermission(user, 'edit_services')}
        />
      </div>

      {/* Phase 3A: Announcements section extracted to WeeklyAnnouncementSection (~270 lines) */}
      <WeeklyAnnouncementSection
        fixedAnnouncements={fixedAnnouncements}
        dynamicAnnouncements={dynamicAnnouncements}
        selectedAnnouncements={selectedAnnouncements}
        setSelectedAnnouncements={setSelectedAnnouncements}
        onNewAnnouncement={() => {
          setEditingAnnouncement(null);
          setAnnouncementForm({ title: "", content: "", instructions: "", category: "General", is_active: true, priority: 10, has_video: false, date_of_occurrence: "", emphasize: false });
          setShowAnnouncementDialog(true);
        }}
        onEditAnnouncement={openAnnouncementEdit}
        onDeleteAnnouncement={(id) => setDeleteConfirmId(id)}
        onMovePriority={moveAnnouncementPriority}
        onUpdateEvent={({ id, data }) => updateAnnouncementMutation.mutate({ id, data })}
        canCreate={hasPermission(user, 'create_announcements')}
        canEdit={hasPermission(user, 'edit_announcements')}
        canDelete={hasPermission(user, 'delete_announcements')}
        tealStyle={tealStyle}
      />

      {/* Phase 3A: Special Segment Dialog extracted (~70 lines) */}
      <SpecialSegmentDialog
        open={showSpecialDialog}
        onOpenChange={setShowSpecialDialog}
        details={specialSegmentDetails}
        setDetails={setSpecialSegmentDetails}
        serviceSegments={serviceData[specialSegmentDetails.timeSlot]}
        onAdd={addSpecialSegment}
        tealStyle={tealStyle}
      />

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

      {/* Reset Blueprint Confirmation Dialog — Phase 1 (2026-02-11) */}
      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent className="max-w-sm bg-white">
          <DialogHeader>
            <DialogTitle>Confirmar Restablecimiento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">¿Estás seguro? Esto restablecerá TODOS los segmentos y campos al diseño original. Se perderán los datos ingresados en los segmentos.</p>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowResetConfirm(false)}>
              Cancelar
            </Button>
            <Button 
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={executeResetToBlueprint}
            >
              Restablecer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
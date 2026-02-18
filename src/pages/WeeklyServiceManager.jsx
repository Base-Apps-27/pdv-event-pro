/**
 * WeeklyServiceManager.jsx
 * Phase 3A FINAL: Slim orchestrator (~580 lines).
 * 
 * All handler logic → useWeeklyServiceHandlers hook
 * All dialogs → WeeklyServiceDialogs component
 * Blueprint constant → weeklyBlueprint.js
 * Print CSS → WeeklyServicePrintCSS
 * Print layout → WeeklyServicePrintView
 * Announcements → WeeklyAnnouncementSection
 * Time slot columns → ServiceTimeSlotColumn
 * Input components → WeeklyServiceInputs
 * Special segment dialog → SpecialSegmentDialog
 * Overflow detection → useOverflowDetection
 */

import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { hasPermission } from "@/components/utils/permissions";
import { useCurrentUser } from "@/components/utils/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Loader2, Eye, Wand2, ExternalLink, Settings, Download } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { createPageUrl } from "@/utils";
import { format as formatDate } from "date-fns";
import { toast } from "sonner";
import { es } from "date-fns/locale";
import { useLanguage } from "@/components/utils/i18n";
import { safeGetItem, safeSetItem } from "@/components/utils/safeLocalStorage";

// Phase 3A extracted components
import WeeklyServicePrintCSS from "@/components/service/WeeklyServicePrintCSS";
import WeeklyServicePrintView from "@/components/service/WeeklyServicePrintView";
import WeeklyAnnouncementSection from "@/components/service/WeeklyAnnouncementSection";
import SpecialSegmentDialog from "@/components/service/SpecialSegmentDialog";
import ServiceTimeSlotColumn from "@/components/service/ServiceTimeSlotColumn";
import WeeklyServiceDialogs from "@/components/service/weekly/WeeklyServiceDialogs";
import { ServiceDataContext, UpdatersContext } from "@/components/service/WeeklyServiceInputs";
import { WEEKLY_BLUEPRINT } from "@/components/service/weekly/weeklyBlueprint";
import { useWeeklyServiceHandlers } from "@/components/service/weekly/useWeeklyServiceHandlers";
import { syncWeeklyToSessions, loadWeeklyFromSessions } from "@/components/service/weeklySessionSync";
import useStaleGuard from "@/components/utils/useStaleGuard";
import StaleEditWarningDialog from "@/components/session/StaleEditWarningDialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import WeekdayServicePanel from "@/components/service/weekly/WeekdayServicePanel";

// Weekday definitions — ordered Mon→Sun matching ISO week. Labels in Spanish.
const WEEKDAYS = [
  { key: 'monday', label: 'Lun', fullLabel: 'Lunes', dayIndex: 1 },
  { key: 'tuesday', label: 'Mar', fullLabel: 'Martes', dayIndex: 2 },
  { key: 'wednesday', label: 'Mié', fullLabel: 'Miércoles', dayIndex: 3 },
  { key: 'thursday', label: 'Jue', fullLabel: 'Jueves', dayIndex: 4 },
  { key: 'friday', label: 'Vie', fullLabel: 'Viernes', dayIndex: 5 },
  { key: 'saturday', label: 'Sáb', fullLabel: 'Sábado', dayIndex: 6 },
  { key: 'sunday', label: 'Dom', fullLabel: 'Domingo', dayIndex: 0 },
];

export default function WeeklyServiceManager() {
  const navigate = useNavigate();
  const tealStyle = { backgroundColor: '#1F8A70', color: '#ffffff' };
  const greenStyle = { backgroundColor: '#8DC63F', color: '#ffffff' };
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  // P1-4: Replaced duplicate user fetch with shared hook (2026-02-12)
  const { user } = useCurrentUser();

  // ── Core state ──
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const daysToAdd = day === 0 ? 0 : 7 - day;
    const nextSunday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysToAdd);
    const y = nextSunday.getFullYear();
    const m = String(nextSunday.getMonth() + 1).padStart(2, '0');
    const d = String(nextSunday.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [serviceData, setServiceData] = useState(null);
  const [selectedAnnouncements, setSelectedAnnouncements] = useState([]);
  const [expandedSegments, setExpandedSegments] = useState({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedData, setLastSavedData] = useState(null);
  const [lastSaveTimestamp, setLastSaveTimestamp] = useState(null);

  // ── Dialog / UI state ──
  const [showSpecialDialog, setShowSpecialDialog] = useState(false);
  const [specialSegmentDetails, setSpecialSegmentDetails] = useState({
    timeSlot: "9:30am", title: "", duration: 15, insertAfterIdx: -1, presenter: "", translator: "",
  });
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [announcementForm, setAnnouncementForm] = useState({
    title: "", content: "", instructions: "", category: "General",
    is_active: true, priority: 10, has_video: false, date_of_occurrence: "", emphasize: false
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [savingField, setSavingField] = useState(null);
  const [optimizingAnnouncement, setOptimizingAnnouncement] = useState(false);
  const [showPrintSettings, setShowPrintSettings] = useState(false);
  const [printSettingsPage1, setPrintSettingsPage1] = useState(null);
  const [printSettingsPage2, setPrintSettingsPage2] = useState(null);
  const [isQuickPrint, setIsQuickPrint] = useState(false);
  const [verseParserOpen, setVerseParserOpen] = useState(false);
  const [verseParserContext, setVerseParserContext] = useState({ timeSlot: null, segmentIdx: null });
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Phase 5: Concurrent editing guard
  const { captureBaseline: captureServiceBaseline, checkStale: checkServiceStale } = useStaleGuard();
  const [showStaleWarning, setShowStaleWarning] = useState(false);
  const [staleInfo, setStaleInfo] = useState(null);

  // ── Weekday tab state ──
  // Defaults to sunday (the primary service day). Other days show if services exist.
  const [activeDay, setActiveDay] = useState('sunday');

  // ── Queries ──
  const { data: blueprintData } = useQuery({
    queryKey: ['serviceBlueprint'],
    queryFn: async () => {
      const blueprints = await base44.entities.Service.filter({ status: 'blueprint' });
      return blueprints[0] || null;
    }
  });

  // Fetch services for the full week surrounding selectedDate to populate weekday tabs
  const { data: weekServices = [] } = useQuery({
    queryKey: ['weekServices', selectedDate],
    queryFn: async () => {
      // Compute the week range (Mon–Sun) containing selectedDate
      const sel = new Date(selectedDate + 'T12:00:00');
      const dayOfWeek = sel.getDay(); // 0=Sun
      const monday = new Date(sel);
      monday.setDate(sel.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      // Build date strings for each day
      const dates = [];
      for (let d = new Date(monday); d <= sunday; d.setDate(d.getDate() + 1)) {
        const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        dates.push(ds);
      }

      // Fetch weekly services for each date (exclude blueprints and one-off services)
      const results = await Promise.all(
        dates.map(async (dt) => {
          const svcs = await base44.entities.Service.filter({ date: dt });
          return svcs
            .filter(s => s.status !== 'blueprint' && s.service_type !== 'one_off')
            .map(s => ({ ...s, _weekDate: dt }));
        })
      );
      return results.flat();
    },
    enabled: !!selectedDate,
    staleTime: 60000,
  });

  // Derive which weekdays have services
  const activeDays = React.useMemo(() => {
    const daySet = new Set(['sunday']); // Always show Sunday
    weekServices.forEach(svc => {
      if (!svc._weekDate) return;
      const d = new Date(svc._weekDate + 'T12:00:00');
      const dow = d.getDay();
      const wd = WEEKDAYS.find(w => w.dayIndex === dow);
      if (wd) daySet.add(wd.key);
    });
    return WEEKDAYS.filter(w => daySet.has(w.key));
  }, [weekServices]);

  const { data: existingData, isLoading } = useQuery({
    queryKey: ['weeklyService', selectedDate],
    queryFn: async () => {
      const services = await base44.entities.Service.filter({ date: selectedDate });
      if (!services || services.length === 0) return null;

      // Prefer services with explicit service_type: 'weekly'
      let weeklyCandidates = services.filter(s => s.service_type === 'weekly');

      // Legacy fallback: structural detection for services without service_type
      if (weeklyCandidates.length === 0) {
        weeklyCandidates = services.filter(s =>
          !s.service_type &&
          (s["9:30am"]?.length > 0 || s["11:30am"]?.length > 0) &&
          (!s.segments || s.segments.length === 0)
        );
      }

      let service = null;
      if (weeklyCandidates.length > 0) {
        service = weeklyCandidates.sort((a, b) => new Date(b.updated_date || 0) - new Date(a.updated_date || 0))[0];
      } else {
        // Last resort: any service on this date that isn't one_off
        const emptyCandidates = services.filter(s =>
          s.service_type !== 'one_off' &&
          (!s.segments || s.segments.length === 0)
        );
        if (emptyCandidates.length > 0) {
          service = emptyCandidates.sort((a, b) => new Date(b.updated_date || 0) - new Date(a.updated_date || 0))[0];
        }
      }

      // Entity Lift: try loading from Session/Segment entities
      if (service?.id) {
        try {
          const entityData = await loadWeeklyFromSessions(base44, service.id, blueprintData || WEEKLY_BLUEPRINT);
          if (entityData) {
            // Merge entity-sourced segment/team data onto the Service metadata
            return { ...service, ...entityData, _fromEntities: true };
          }
        } catch (err) {
          console.warn("[ENTITY_LIFT] Entity load failed, falling back to JSON:", err.message);
        }
      }

      return service;
    },
    enabled: !!selectedDate
  });

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
        return new Date(a.date_of_occurrence + 'T00:00:00') >= selDate;
      });
      const filteredEvents = events.filter(e => {
        if (!e.promote_in_announcements || !e.start_date) return false;
        return new Date(e.start_date + 'T00:00:00') >= selDate;
      });
      const combined = [
        ...filteredItems.map(a => ({ ...a, sortDate: new Date(a.date_of_occurrence + 'T00:00:00') })),
        ...filteredEvents.map(e => ({ ...e, isEvent: true, sortDate: new Date(e.start_date + 'T00:00:00') }))
      ];
      return combined.sort((a, b) => a.sortDate - b.sortDate);
    },
    enabled: !!selectedDate
  });

  // ── Mutations ──
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
      setLastSaveTimestamp(new Date().toISOString());
      setHasUnsavedChanges(false);
      const backupKey = `service_backup_${selectedDate}`;
      safeSetItem(backupKey, JSON.stringify({ data: result, timestamp: new Date().toISOString() }));

      // Entity Lift: sync to Session/Segment/PreSessionDetails entities (fire-and-forget)
      syncWeeklyToSessions(base44, result, result).catch(err => {
        console.error("[WEEKLY_SYNC] Entity sync failed (non-blocking):", err.message);
      });
    },
    onError: (error) => {
      toast.error('Error al guardar: ' + error.message);
    }
  });

  // P0-2: Added onError toast handlers (2026-02-12)
  const createAnnouncementMutation = useMutation({
    mutationFn: (data) => base44.entities.AnnouncementItem.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['allAnnouncements']);
      queryClient.invalidateQueries(['dynamicAnnouncements']);
      setShowAnnouncementDialog(false);
      setAnnouncementForm({ title: "", content: "", instructions: "", category: "General", is_active: true, priority: 10, has_video: false, date_of_occurrence: "" });
      setEditingAnnouncement(null);
    },
    onError: (err) => toast.error('Error al crear anuncio: ' + err.message),
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
    onError: (err) => toast.error('Error al actualizar anuncio: ' + err.message),
  });

  const deleteAnnouncementMutation = useMutation({
    mutationFn: async (id) => await base44.entities.AnnouncementItem.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['allAnnouncements']);
      queryClient.invalidateQueries(['dynamicAnnouncements']);
    },
    onError: (error) => {
      toast.error('Error al eliminar: ' + (error.message || JSON.stringify(error)));
    }
  });

  // ── Handlers (extracted hook) ──
  const handlers = useWeeklyServiceHandlers({
    serviceData, setServiceData, selectedDate, selectedAnnouncements,
    printSettingsPage1, printSettingsPage2, saveServiceMutation,
    updateAnnouncementMutation, fixedAnnouncements, dynamicAnnouncements,
    blueprintData, BLUEPRINT: WEEKLY_BLUEPRINT,
    setSavingField, setVerseParserOpen, setVerseParserContext, verseParserContext,
    setShowSpecialDialog, setSpecialSegmentDetails, specialSegmentDetails,
    setOptimizingAnnouncement, setPrintSettingsPage1, setPrintSettingsPage2,
    setEditingAnnouncement, setAnnouncementForm, setShowAnnouncementDialog,
    setShowResetConfirm, editingAnnouncement, createAnnouncementMutation,
  });

  // ── Initialize service data from DB or blueprint ──
  useEffect(() => {
    if (existingData) {
      const mergeSegmentsWithBlueprint = (existingSegments, timeSlot) => {
        const activeBlueprint = blueprintData || { "9:30am": WEEKLY_BLUEPRINT["9:30am"], "11:30am": WEEKLY_BLUEPRINT["11:30am"] };
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
          let blueprintSeg = activeBlueprint[timeSlot]?.[idx];
          if (!blueprintSeg || normalizeType(blueprintSeg.type) !== savedType) {
            blueprintSeg = activeBlueprint[timeSlot]?.find(b => normalizeType(b.type) === savedType);
          }
          if (!blueprintSeg) {
            const hardcoded = WEEKLY_BLUEPRINT[timeSlot]?.[idx];
            if (hardcoded && normalizeType(hardcoded.type) === savedType) {
              blueprintSeg = hardcoded;
            } else {
              blueprintSeg = WEEKLY_BLUEPRINT[timeSlot]?.find(b => normalizeType(b.type) === savedType);
            }
          }
          if (blueprintSeg) {
            let subAssignments = blueprintSeg.sub_assignments || savedSeg.sub_assignments || [];
            if (!subAssignments || subAssignments.length === 0) {
              if (savedType === 'worship') subAssignments = [{ label: 'Ministración de Sanidad y Milagros', person_field_name: 'ministry_leader', duration_min: 5 }];
              else if (savedType === 'message') subAssignments = [{ label: 'Cierre', person_field_name: 'cierre_leader', duration_min: 5 }];
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
          if (!savedSeg.fields || savedSeg.fields.length === 0) {
            let defaultFields = [];
            if (savedType === 'worship') defaultFields = ["leader", "songs", "ministry_leader"];
            else if (savedType === 'welcome') defaultFields = ["presenter"];
            else if (savedType === 'offering') defaultFields = ["presenter", "verse"];
            else if (savedType === 'message') defaultFields = ["preacher", "title", "verse"];
            if (defaultFields.length > 0) return { ...savedSeg, fields: defaultFields };
          }
          if (savedSeg.type === 'special') {
            const cleanedActions = (savedSeg.actions || []).filter(action => {
              const label = (action.label || '').toLowerCase();
              if (label.includes('pianista sube') || label.includes('equipo de a&a sube')) return false;
              return true;
            });
            if (cleanedActions.length !== (savedSeg.actions || []).length) return { ...savedSeg, actions: cleanedActions };
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
      // Phase 5: Capture baseline for stale detection
      captureServiceBaseline(existingData.updated_date);

      // Backup recovery toast
      const backupKey = `service_backup_${selectedDate}`;
      const backup = safeGetItem(backupKey);
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
          console.error('[BACKUP RECOVERY ERROR]', error.message);
        }
      }
    } else {
      const activeBlueprint = blueprintData || { "9:30am": WEEKLY_BLUEPRINT["9:30am"], "11:30am": WEEKLY_BLUEPRINT["11:30am"] };
      const mapBlueprintToSegments = (segments) => segments.map(seg => {
        const segmentCopy = {
          type: seg.type, title: seg.title, duration: seg.duration,
          fields: [...(seg.fields || [])], data: {},
          actions: seg.actions ? seg.actions.map(a => ({ ...a })) : [],
          sub_assignments: seg.sub_assignments ? seg.sub_assignments.map(sa => ({ ...sa })) : [],
          requires_translation: seg.requires_translation || false,
          default_translator_source: seg.default_translator_source || "manual"
        };
        if (seg.type === "worship") {
          segmentCopy.songs = [{ title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }];
        }
        return segmentCopy;
      });
      setServiceData({
        date: selectedDate,
        "9:30am": mapBlueprintToSegments(activeBlueprint["9:30am"]),
        "11:30am": mapBlueprintToSegments(activeBlueprint["11:30am"]),
        coordinators: { "9:30am": "", "11:30am": "" },
        ujieres: { "9:30am": "", "11:30am": "" },
        sound: { "9:30am": "", "11:30am": "" },
        luces: { "9:30am": "", "11:30am": "" },
        fotografia: { "9:30am": "", "11:30am": "" },
        receso_notes: { "9:30am": "" },
        pre_service_notes: { "9:30am": "", "11:30am": "" },
        selected_announcements: []
      });
      setLastSavedData(null);
      setSelectedAnnouncements([]);
      setPrintSettingsPage1(null);
      setPrintSettingsPage2(null);
      setHasUnsavedChanges(false);
    }
  }, [existingData, selectedDate, blueprintData]);

  // ── Real-time entity subscriptions ──
  // Subscribe to Session/Segment changes so external edits (live adjustments)
  // push updates without requiring page reload.
  // Debounced with 2s settle window to prevent invalidation storm during
  // syncWeeklyToSessions (which fires 16+ events from delete-all + create-all).
  useEffect(() => {
    if (!existingData?.id) return;
    const serviceId = existingData.id;
    let settleTimer = null;

    const debouncedInvalidate = () => {
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        queryClient.invalidateQueries(['weeklyService', selectedDate]);
      }, 2000);
    };

    const unsubSession = base44.entities.Session.subscribe((event) => {
      if (event.data?.service_id === serviceId) {
        debouncedInvalidate();
      }
    });
    const unsubSegment = base44.entities.Segment.subscribe((event) => {
      if (event.data?.service_id === serviceId) {
        debouncedInvalidate();
      }
    });

    return () => {
      if (settleTimer) clearTimeout(settleTimer);
      if (typeof unsubSession === 'function') unsubSession();
      if (typeof unsubSegment === 'function') unsubSegment();
    };
  }, [existingData?.id, selectedDate, queryClient]);

  // ── Side effects ──
  // Track unsaved changes
  useEffect(() => {
    if (!lastSavedData || !serviceData) return;
    setHasUnsavedChanges(JSON.stringify(serviceData) !== JSON.stringify(lastSavedData));
  }, [serviceData, lastSavedData]);

  // Warn before leaving
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) { e.preventDefault(); e.returnValue = 'Tienes cambios sin guardar.'; return e.returnValue; }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Auto-select announcements
  useEffect(() => {
    if (isLoading) return;
    const hasAnnouncements = fixedAnnouncements.length > 0 || dynamicAnnouncements.length > 0;
    if (hasAnnouncements && (!selectedAnnouncements || selectedAnnouncements.length === 0)) {
      setSelectedAnnouncements([...fixedAnnouncements.map(a => a.id), ...dynamicAnnouncements.map(a => a.id)]);
    }
  }, [isLoading, fixedAnnouncements, dynamicAnnouncements]);

  // Filter ghost announcements
  useEffect(() => {
    if (existingData && selectedAnnouncements.length > 0) {
      const allActiveIds = [...fixedAnnouncements.map(a => a.id), ...dynamicAnnouncements.map(a => a.id)];
      const filtered = selectedAnnouncements.filter(id => allActiveIds.includes(id));
      if (filtered.length !== selectedAnnouncements.length) setSelectedAnnouncements(filtered);
    }
  }, [existingData, fixedAnnouncements, dynamicAnnouncements]);

  // Sync announcements into serviceData
  useEffect(() => {
    setServiceData(prev => {
      if (!prev) return prev;
      return { ...prev, selected_announcements: selectedAnnouncements };
    });
  }, [selectedAnnouncements]);

  // Central auto-save (Phase 5: with stale guard for manual-save scenarios)
  // Auto-save does NOT check staleness (would be disruptive).
  // Staleness is only checked on the manual save path; auto-save is last-write-wins by design.
  useEffect(() => {
    if (!lastSavedData || !serviceData) return;
    if (JSON.stringify(serviceData) === JSON.stringify(lastSavedData)) return;
    const handler = setTimeout(() => {
      saveServiceMutation.mutate({
        ...serviceData, selected_announcements: selectedAnnouncements,
        print_settings_page1: printSettingsPage1, print_settings_page2: printSettingsPage2,
        day_of_week: 'Sunday', name: `Domingo - ${selectedDate}`, status: 'active',
        service_type: 'weekly'
      });
    }, 1000);
    return () => clearTimeout(handler);
  }, [serviceData, lastSavedData, selectedAnnouncements, printSettingsPage1, printSettingsPage2, selectedDate]);

  // ── Segment expand toggle (local UI) ──
  const toggleSegmentExpanded = (timeSlot, idx) => {
    const key = `${timeSlot}-${idx}`;
    setExpandedSegments(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Loading / guard ──
  if (!serviceData || isLoading) return <div className="p-8">Cargando...</div>;

  // ── Print settings ──
  const defaultPrintSettings = { globalScale: 1.0, margins: { top: "0.5in", right: "0.5in", bottom: "0.5in", left: "0.5in" }, bodyFontScale: 1.0, titleFontScale: 1.0 };
  const activePrintSettingsPage1 = isQuickPrint ? defaultPrintSettings : (printSettingsPage1 || defaultPrintSettings);
  const activePrintSettingsPage2 = isQuickPrint ? defaultPrintSettings : (printSettingsPage2 || defaultPrintSettings);

  // ── Render ──
  return (
    <ServiceDataContext.Provider value={serviceData}>
      <UpdatersContext.Provider value={{ updateSegmentField: handlers.updateSegmentField, updateTeamField: handlers.updateTeamField, setServiceData }}>
    <div className="p-6 md:p-8 space-y-8 print:p-0 bg-[#F0F1F3] min-h-screen">
      <WeeklyServicePrintCSS printSettingsPage1={activePrintSettingsPage1} printSettingsPage2={activePrintSettingsPage2} />

      <WeeklyServicePrintView
        serviceData={serviceData} selectedDate={selectedDate}
        fixedAnnouncements={fixedAnnouncements} dynamicAnnouncements={dynamicAnnouncements}
        selectedAnnouncements={selectedAnnouncements}
        printSettingsPage1={printSettingsPage1} printSettingsPage2={printSettingsPage2}
        isQuickPrint={isQuickPrint}
      />

      {/* Screen UI — Header */}
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-5xl text-gray-900 uppercase tracking-tight">Servicios Dominicales</h1>
          <p className="text-gray-500 mt-1">{t('dashboard.services.subtitle')}</p>
          {existingData?.id && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-400 font-mono">ID: {existingData.id}</span>
            </div>
          )}
          <div className="flex items-center gap-3 mt-2">
            {existingData?.updated_date && (
              <Badge variant="outline" className="text-xs bg-green-50 border-green-200 text-green-700">
                Última actualización: {new Date(existingData.updated_date).toLocaleString('es-ES', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </Badge>
            )}
            {hasUnsavedChanges && <Badge className="text-xs bg-yellow-500 text-white animate-pulse">{t('btn.saving')}</Badge>}
            {lastSaveTimestamp && !hasUnsavedChanges && (
              <Badge variant="outline" className="text-xs bg-green-50 border-green-200 text-green-700">
                ✓ Guardado a las {new Date(lastSaveTimestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
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
          <Button onClick={() => navigate(createPageUrl('PublicProgramView') + `?date=${selectedDate}`)} variant="outline" className="border-pdv-teal text-pdv-teal hover:bg-pdv-teal hover:text-white border-2 font-semibold text-xs md:text-sm px-2 py-1 md:px-4 md:py-2">
            <Eye className="w-3 h-3 md:w-4 md:h-4 md:mr-2" /><span className="hidden md:inline">{t('btn.live_view')}</span>
          </Button>
          <Button onClick={handlers.handleDownloadProgramPDF} style={tealStyle} className="font-semibold text-xs md:text-sm px-2 py-1 md:px-4 md:py-2" title="Descargar PDF Programa">
            <Download className="w-3 h-3 md:w-4 md:h-4 md:mr-2" /><span className="hidden md:inline">PDF Programa</span>
          </Button>
          <Button onClick={handlers.handleDownloadAnnouncementsPDF} style={greenStyle} className="font-semibold text-xs md:text-sm px-2 py-1 md:px-4 md:py-2" title="Descargar PDF Anuncios">
            <Download className="w-3 h-3 md:w-4 md:h-4 md:mr-2" /><span className="hidden md:inline">PDF Anuncios</span>
          </Button>
          <Button onClick={() => window.open('/api/functions/serveWeeklyServiceSubmission', '_blank')} variant="outline" className="border-2 border-purple-400 text-purple-600 hover:bg-purple-50 font-semibold px-2" title="Link para Oradores (Mensaje)">
            <ExternalLink className="w-4 h-4 md:mr-2" /><span className="hidden md:inline">Link Mensaje</span>
          </Button>
          <Button onClick={() => setShowPrintSettings(true)} variant="outline" className="border-2 border-gray-400 bg-white text-gray-900 hover:bg-gray-100 font-semibold px-2" title="Ajustes de Impresión">
            <Settings className="w-4 h-4" />
          </Button>
          {hasPermission(user, 'edit_services') && (
            <Button onClick={() => setShowResetConfirm(true)} variant="destructive" className="border-2 border-red-600 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white font-semibold px-2" title="Restablecer diseño original">
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
                    [data-disabled="true"] { color: #d1d5db !important; cursor: not-allowed !important; }
                    [data-disabled="true"]:hover { background-color: transparent !important; }
                    button[role="gridcell"]:not([data-disabled="true"]):not([data-selected="true"]) { color: #111827 !important; }
                    button[role="gridcell"][data-selected="true"], button[role="gridcell"][aria-selected="true"] { background-color: #8DC63F !important; color: white !important; }
                    .rdp-day_selected { background-color: #8DC63F !important; color: white !important; }
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
                    disabled={(date) => date.getDay() !== 0}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekday tabs + service session columns */}
      <Tabs value={activeDay} onValueChange={setActiveDay} className="print:hidden">
        {/* Weekday tab bar — shows all days that have services */}
        {activeDays.length > 1 && (
          <TabsList className="mb-4 h-10 bg-gray-200">
            {activeDays.map(day => (
              <TabsTrigger
                key={day.key}
                value={day.key}
                className="px-4 py-1.5 text-sm font-bold data-[state=active]:bg-pdv-teal data-[state=active]:text-white"
              >
                <span className="hidden sm:inline">{day.fullLabel}</span>
                <span className="sm:hidden">{day.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        )}

        {/* Sunday (default) — current 9:30am / 11:30am columns */}
        <TabsContent value="sunday" className="mt-0">
          <div className="overflow-x-auto -mx-2 px-2">
            <div className="grid md:grid-cols-2 gap-6 min-w-[640px]">
              <ServiceTimeSlotColumn
                timeSlot="9:30am" serviceData={serviceData}
                expandedSegments={expandedSegments} toggleSegmentExpanded={toggleSegmentExpanded}
                handleMoveSegment={handlers.handleMoveSegment} removeSpecialSegment={handlers.removeSpecialSegment}
                updateSegmentField={handlers.updateSegmentField} debouncedSave={handlers.debouncedSave}
                setServiceData={setServiceData} handleOpenVerseParser={handlers.handleOpenVerseParser}
                calculateServiceTimes={handlers.calculateServiceTimes}
                copySegmentTo1130={handlers.copySegmentTo1130}
                copyPreServiceNotesTo1130={handlers.copyPreServiceNotesTo1130}
                copyTeamTo1130={handlers.copyTeamTo1130}
                onOpenSpecialDialog={(ts) => { setSpecialSegmentDetails(prev => ({ ...prev, timeSlot: ts })); setShowSpecialDialog(true); }}
                canEdit={hasPermission(user, 'edit_services')}
              />
              <ServiceTimeSlotColumn
                timeSlot="11:30am" serviceData={serviceData}
                expandedSegments={expandedSegments} toggleSegmentExpanded={toggleSegmentExpanded}
                handleMoveSegment={handlers.handleMoveSegment} removeSpecialSegment={handlers.removeSpecialSegment}
                updateSegmentField={handlers.updateSegmentField} debouncedSave={handlers.debouncedSave}
                setServiceData={setServiceData} handleOpenVerseParser={handlers.handleOpenVerseParser}
                calculateServiceTimes={handlers.calculateServiceTimes}
                copy930To1130={handlers.copy930To1130}
                onOpenSpecialDialog={(ts) => { setSpecialSegmentDetails(prev => ({ ...prev, timeSlot: ts })); setShowSpecialDialog(true); }}
                canEdit={hasPermission(user, 'edit_services')}
              />
            </div>
          </div>
        </TabsContent>

        {/* Other weekdays — render their service sessions with full segment display */}
        {activeDays.filter(d => d.key !== 'sunday').map(day => {
          const dayServices = weekServices.filter(svc => {
            if (!svc._weekDate) return false;
            const d = new Date(svc._weekDate + 'T12:00:00');
            return d.getDay() === day.dayIndex;
          });
          return (
            <TabsContent key={day.key} value={day.key} className="mt-0">
              {dayServices.length === 0 ? (
                <Card className="p-8 text-center bg-white border-2 border-gray-300">
                  <p className="text-gray-500">No hay servicios programados para {day.fullLabel}</p>
                </Card>
              ) : (
                <div className="overflow-x-auto -mx-2 px-2">
                  <div className="flex gap-6 min-w-[640px]">
                    {dayServices.map(svc => (
                      <WeekdayServicePanel key={svc.id} service={svc} />
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Announcements */}
      <WeeklyAnnouncementSection
        fixedAnnouncements={fixedAnnouncements} dynamicAnnouncements={dynamicAnnouncements}
        selectedAnnouncements={selectedAnnouncements} setSelectedAnnouncements={setSelectedAnnouncements}
        onNewAnnouncement={() => {
          setEditingAnnouncement(null);
          setAnnouncementForm({ title: "", content: "", instructions: "", category: "General", is_active: true, priority: 10, has_video: false, date_of_occurrence: "", emphasize: false });
          setShowAnnouncementDialog(true);
        }}
        onEditAnnouncement={handlers.openAnnouncementEdit}
        onDeleteAnnouncement={(id) => setDeleteConfirmId(id)}
        onMovePriority={handlers.moveAnnouncementPriority}
        onUpdateEvent={({ id, data }) => updateAnnouncementMutation.mutate({ id, data })}
        canCreate={hasPermission(user, 'create_announcements')}
        canEdit={hasPermission(user, 'edit_announcements')}
        canDelete={hasPermission(user, 'delete_announcements')}
        tealStyle={tealStyle}
      />

      {/* Special Segment Dialog */}
      <SpecialSegmentDialog
        open={showSpecialDialog} onOpenChange={setShowSpecialDialog}
        details={specialSegmentDetails} setDetails={setSpecialSegmentDetails}
        serviceSegments={serviceData[specialSegmentDetails.timeSlot]}
        onAdd={handlers.addSpecialSegment} tealStyle={tealStyle}
      />

      {/* Phase 5: Concurrent editing warning */}
      <StaleEditWarningDialog
        open={showStaleWarning}
        onCancel={() => setShowStaleWarning(false)}
        onForceSave={() => { setShowStaleWarning(false); setStaleInfo(null); }}
        staleInfo={staleInfo}
        language="es"
      />

      {/* All remaining dialogs */}
      <WeeklyServiceDialogs
        deleteConfirmId={deleteConfirmId} setDeleteConfirmId={setDeleteConfirmId}
        deleteAnnouncementMutation={deleteAnnouncementMutation}
        showResetConfirm={showResetConfirm} setShowResetConfirm={setShowResetConfirm}
        executeResetToBlueprint={handlers.executeResetToBlueprint}
        verseParserOpen={verseParserOpen} setVerseParserOpen={setVerseParserOpen}
        verseParserContext={verseParserContext} handleSaveParsedVerses={handlers.handleSaveParsedVerses}
        showPrintSettings={showPrintSettings} setShowPrintSettings={setShowPrintSettings}
        activePrintSettingsPage1={activePrintSettingsPage1} activePrintSettingsPage2={activePrintSettingsPage2}
        handleSavePrintSettings={handlers.handleSavePrintSettings} serviceData={serviceData}
        showAnnouncementDialog={showAnnouncementDialog} setShowAnnouncementDialog={setShowAnnouncementDialog}
        editingAnnouncement={editingAnnouncement} announcementForm={announcementForm}
        setAnnouncementForm={setAnnouncementForm} handleAnnouncementSubmit={handlers.handleAnnouncementSubmit}
        optimizeAnnouncementWithAI={handlers.optimizeAnnouncementWithAI} optimizingAnnouncement={optimizingAnnouncement}
      />
    </div>
      </UpdatersContext.Provider>
    </ServiceDataContext.Provider>
  );
}
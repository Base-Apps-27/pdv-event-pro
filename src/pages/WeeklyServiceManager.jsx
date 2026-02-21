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
import { Calendar as CalendarIcon, Loader2, Eye, Wand2, ExternalLink, Settings, Download, Wrench, MoreVertical, RefreshCw, Users } from "lucide-react";
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
// Blueprint Revamp (2026-02-18): DB blueprint (status='blueprint') is the single source of truth.
// No hardcoded WEEKLY_BLUEPRINT constant. If DB blueprint is missing, segments use their own
// data as-is — no phantom actions/fields injected from a stale constant.
import { useWeeklyServiceHandlers } from "@/components/service/weekly/useWeeklyServiceHandlers";
import {
  syncWeeklyToSessions, loadWeeklyFromSessions,
  pushSegmentField as pushSegmentFieldToEntity,
  pushSegmentSongs as pushSegmentSongsToEntity,
  pushSessionTeamField as pushSessionTeamFieldToEntity,
  pushPreSessionNotes as pushPreSessionNotesToEntity,
} from "@/components/service/weeklySessionSync";
import { useServiceSchedules } from "@/components/service/weekly/useServiceSchedules";
import useStaleGuard from "@/components/utils/useStaleGuard";
import StaleEditWarningDialog from "@/components/session/StaleEditWarningDialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import WeekdayServicePanel from "@/components/service/weekly/WeekdayServicePanel";
import ServiceScheduleManager from "@/components/service/weekly/ServiceScheduleManager";
import SundaySlotColumns from "@/components/service/weekly/SundaySlotColumns";

/**
 * extractServiceMetadata — strips entity-managed fields from save payload.
 * Session/Segment entities (via syncWeeklyToSessions) are the SOLE source of
 * truth for segment data, team assignments, and pre-service notes.
 * The Service entity only stores lightweight metadata.
 *
 * Old JSON slot arrays are NOT cleared from existing records — they remain as
 * a read-only fallback for legacy services that haven't been entity-synced yet.
 */
function extractServiceMetadata(data, slotNames) {
  const metadata = { ...data };

  // Team fields — live on Session entities
  delete metadata.coordinators;
  delete metadata.ujieres;
  delete metadata.sound;
  delete metadata.luces;
  delete metadata.fotografia;

  // Pre-service notes — live on PreSessionDetails entities
  delete metadata.pre_service_notes;

  // Dynamic slot arrays — live on Segment entities
  for (const name of slotNames) {
    delete metadata[name];
  }

  // Internal UI markers (never persist)
  delete metadata._fromEntities;
  delete metadata._slotNames;
  delete metadata._sessionIds;

  return metadata;
}

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

  // Phase 2: Dynamic session slots from ServiceSchedule entity
  const { getTimeSlotsForDay, getSessionsForDay, getActiveDays: getScheduledDays } = useServiceSchedules();
  const sundaySlots = React.useMemo(() => getTimeSlotsForDay("Sunday"), [getTimeSlotsForDay]);
  // Slot names for the current Sunday, e.g. ["9:30am", "11:30am"]
  const sundaySlotNames = React.useMemo(() => sundaySlots.map(s => s.name), [sundaySlots]);
  // Days that have active ServiceSchedule records (drives weekday tabs)
  const scheduledDays = React.useMemo(() => getScheduledDays(), [getScheduledDays]);

  // Schedule management dialog state
  const [showScheduleManager, setShowScheduleManager] = useState(false);

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
    timeSlot: "", title: "", duration: 15, insertAfterIdx: -1, presenter: "", translator: "",
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
  // SEGMENT-DISAPPEAR-FIX-v4 (2026-02-21): Explicit staleTime: Infinity on blueprintData.
  // Blueprint is a reference template — it does not change during a user session.
  // Without staleTime, background refetches can momentarily set blueprintData to null,
  // which triggers unwanted side effects during initialization.
  const { data: blueprintData } = useQuery({
    queryKey: ['serviceBlueprint'],
    queryFn: async () => {
      const blueprints = await base44.entities.Service.filter({ status: 'blueprint' });
      return blueprints[0] || null;
    },
    staleTime: Infinity,
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

      // Fetch services for each date in the week.
      // Exclude blueprints. Include one_off services (they show as read-only weekday tabs).
      // Exclude weekly services on non-Sunday days (they're managed by the Sunday tab).
      const results = await Promise.all(
        dates.map(async (dt) => {
          const svcs = await base44.entities.Service.filter({ date: dt });
          return svcs
            .filter(s => s.status !== 'blueprint')
            .filter(s => {
              // Always include one_off / custom services on any day
              if (s.service_type === 'one_off') return true;
              // For weekly services, only include on their primary tab day (Sunday)
              // to avoid double-showing them as weekday panels
              if (s.service_type === 'weekly') return false;
              // Legacy services without service_type: include if they have segments
              // (custom-style) or if on a non-Sunday day
              if (s.segments && s.segments.length > 0) return true;
              return false;
            })
            .map(s => ({ ...s, _weekDate: dt }));
        })
      );
      return results.flat();
    },
    enabled: !!selectedDate,
    staleTime: 60000,
  });

  // Derive which weekdays have tabs — union of ServiceSchedule days + actual services
  const activeDays = React.useMemo(() => {
    const daySet = new Set(['sunday']); // Always show Sunday
    // Add days from ServiceSchedule entity (e.g., Wednesday if configured)
    const dayNameToKey = { Sunday: 'sunday', Monday: 'monday', Tuesday: 'tuesday', Wednesday: 'wednesday', Thursday: 'thursday', Friday: 'friday', Saturday: 'saturday' };
    scheduledDays.forEach(day => {
      const key = dayNameToKey[day];
      if (key) daySet.add(key);
    });
    // Also add days that have actual service records this week
    weekServices.forEach(svc => {
      if (!svc._weekDate) return;
      const d = new Date(svc._weekDate + 'T12:00:00');
      const dow = d.getDay();
      const wd = WEEKDAYS.find(w => w.dayIndex === dow);
      if (wd) daySet.add(wd.key);
    });
    return WEEKDAYS.filter(w => daySet.has(w.key));
  }, [weekServices, scheduledDays]);

  // SEGMENT-DISAPPEAR-FIX-v2 (2026-02-20): staleTime: Infinity.
  // Same rationale as blueprintData — local state is source of truth once loaded.
  // Only refetches when selectedDate changes (new queryKey) or after save invalidation.
  const { data: existingData, isLoading } = useQuery({
    queryKey: ['weeklyService', selectedDate],
    queryFn: async () => {
      const services = await base44.entities.Service.filter({ date: selectedDate });
      if (!services || services.length === 0) return null;

      // Prefer services with explicit service_type: 'weekly'
      let weeklyCandidates = services.filter(s => s.service_type === 'weekly');

      // Legacy fallback: structural detection for services without service_type.
      // Checks for any key that looks like a time-slot array (e.g. "9:30am", "1:00pm").
      if (weeklyCandidates.length === 0) {
        weeklyCandidates = services.filter(s =>
          !s.service_type &&
          Object.keys(s).some(key => /^\d{1,2}:\d{2}(am|pm)$/i.test(key) && Array.isArray(s[key]) && s[key].length > 0) &&
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
          const entityData = await loadWeeklyFromSessions(base44, service.id, blueprintData);
          // Guard: only use entity data if it actually contains segments.
          // Sessions can exist without segments (e.g., session was created but
          // segment bulk-create failed mid-sync). Without this check, an empty
          // entity result would override valid legacy JSON with nothing.
          const hasSegments = entityData && Object.values(entityData).some(
            val => Array.isArray(val) && val.length > 0
          );
          if (hasSegments) {
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
  const localStateInitializedRef = React.useRef(false);

  // ENTITY SYNC SERIALIZATION (2026-02-21): Prevents concurrent syncWeeklyToSessions.
  // The delete-all-recreate pattern in syncWeeklyToSessions is NOT safe for concurrent
  // execution: two parallel syncs both snapshot old IDs → both create new → both delete
  // "old" (which now includes the other's new segments) → data loss.
  // If a sync is already running, the auto-save skips and retries after it completes.
  const entitySyncInProgressRef = React.useRef(false);

  // MULTI-ADMIN (2026-02-21): Track own saves to filter subscription events.
  const ownSaveInProgressRef = React.useRef(false);
  const [externalChangeAvailable, setExternalChangeAvailable] = React.useState(false);
  const hasUnsavedChangesRef = React.useRef(false);
  React.useEffect(() => { hasUnsavedChangesRef.current = hasUnsavedChanges; }, [hasUnsavedChanges]);
  const lastSavedDataRef = React.useRef(lastSavedData);
  React.useEffect(() => { lastSavedDataRef.current = lastSavedData; }, [lastSavedData]);
  // NOTE: blurSaveTimerRef removed — blur no longer triggers full sync.

  // Ref to always have current serviceData for save operations.
  // Defined BEFORE the mutation so onSuccess can reference it.
  const serviceDataRef = React.useRef(serviceData);
  React.useEffect(() => { serviceDataRef.current = serviceData; }, [serviceData]);

  // PER-FIELD PUSH (2026-02-21): Fire-and-forget entity updates for individual fields.
  // Tracks active pushes so the subscription handler doesn't treat our own Session
  // updates as external changes.
  const fieldPushActiveRef = React.useRef(0);

  const pushFn = React.useCallback((type, opts) => {
    fieldPushActiveRef.current++;
    const done = () => setTimeout(() => { fieldPushActiveRef.current = Math.max(0, fieldPushActiveRef.current - 1); }, 500);
    let promise;
    if (type === "segment") {
      promise = pushSegmentFieldToEntity(base44, opts.entityId, opts.field, opts.value);
    } else if (type === "songs") {
      promise = pushSegmentSongsToEntity(base44, opts.entityId, opts.songs);
    } else if (type === "team") {
      promise = pushSessionTeamFieldToEntity(base44, opts.sessionId, opts.field, opts.value);
    } else if (type === "preNotes") {
      promise = pushPreSessionNotesToEntity(base44, opts.sessionId, opts.value);
    } else if (type === "serviceField" && existingData?.id) {
      // Service-level fields (e.g., receso_notes): merge into existing value
      const currentData = serviceDataRef.current;
      const mergedValue = type === "serviceField" && opts.field === "receso_notes"
        ? { ...(currentData?.receso_notes || {}), [opts.slotName]: opts.value }
        : opts.value;
      promise = base44.entities.Service.update(existingData.id, { [opts.field]: mergedValue })
        .catch(err => console.error("[FIELD_PUSH] Service field update failed:", opts.field, err.message));
    } else {
      promise = Promise.resolve();
    }
    promise.then(done, done);
  }, [existingData?.id]);

  // SAVE PIPELINE (2026-02-21): Safety-net full sync. Per-field pushes handle
  // individual field changes immediately. This full sync runs on a 30-second timer
  // to catch structural changes (add/remove/reorder segments) and update Service
  // metadata (triggers refreshActiveProgram → display surface updates).
  //
  // RACE FIX (2026-02-21): Snapshots serviceData at sync START time, not completion
  // time. This prevents marking fields as "saved" that were committed to serviceData
  // AFTER the sync started but were never actually sent to the server.
  const saveServiceMutation = useMutation({
    mutationFn: async (data) => {
      // Serialization guard: skip if a save is already running.
      if (entitySyncInProgressRef.current) {
        console.warn("[WEEKLY_SYNC] Skipping overlapping save — will retry on next cycle");
        return null;
      }
      entitySyncInProgressRef.current = true;
      ownSaveInProgressRef.current = true;

      // RACE FIX: Snapshot what we're ACTUALLY syncing right now.
      // onSuccess will use this as the new baseline, not serviceDataRef.current
      // (which may have accumulated new field commits during the async sync).
      const syncedSnapshot = JSON.parse(JSON.stringify(serviceDataRef.current));

      try {
        const metadata = extractServiceMetadata(data, sundaySlotNames);
        let serviceResult;
        let syncResult = null;

        if (existingData?.id) {
          syncResult = await syncWeeklyToSessions(base44, existingData, syncedSnapshot, sundaySlots);
          serviceResult = await base44.entities.Service.update(existingData.id, metadata);
        } else {
          serviceResult = await base44.entities.Service.create(metadata);
          syncResult = await syncWeeklyToSessions(base44, serviceResult, syncedSnapshot, sundaySlots);
          serviceResult = await base44.entities.Service.update(serviceResult.id, { status: 'active' });
        }

        return { serviceResult, syncResult, syncedSnapshot };
      } finally {
        entitySyncInProgressRef.current = false;
        setTimeout(() => { ownSaveInProgressRef.current = false; }, 3000);
      }
    },
    onSuccess: (result) => {
      if (!result) return; // Skipped save (serialization guard)
      const { serviceResult, syncResult, syncedSnapshot } = result;

      queryClient.invalidateQueries({ queryKey: ['activeProgram'] });
      queryClient.invalidateQueries({ queryKey: ['publicProgramData-explicit'] });

      setLastSaveTimestamp(new Date().toISOString());
      setExternalChangeAvailable(false);

      // RACE FIX: Use the snapshot of what was ACTUALLY synced as the new baseline.
      // If the admin committed new fields during the async sync, those changes will
      // still differ from lastSavedData and trigger the next safety-net cycle.
      setLastSavedData(syncedSnapshot);

      // Update entity IDs in serviceData from the sync result so per-field pushes
      // continue working after the delete-all-recreate cycle.
      if (syncResult?.entityIdMap) {
        setServiceData(prev => {
          if (!prev) return prev;
          const updated = { ...prev };
          for (const [slot, ids] of Object.entries(syncResult.entityIdMap)) {
            if (!updated[slot] || !Array.isArray(ids)) continue;
            updated[slot] = updated[slot].map((seg, i) => ({
              ...seg,
              _entityId: ids[i]?.entityId || seg._entityId,
              _sessionId: ids[i]?.sessionId || seg._sessionId,
            }));
          }
          if (syncResult.sessionIdMap) {
            updated._sessionIds = { ...(updated._sessionIds || {}), ...syncResult.sessionIdMap };
          }
          return updated;
        });
      }

      if (serviceResult?.updated_date) captureServiceBaseline(serviceResult.updated_date);
      const backupKey = `service_backup_${selectedDate}`;
      safeSetItem(backupKey, JSON.stringify({ data: serviceDataRef.current, timestamp: new Date().toISOString() }));
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
  // PER-FIELD PUSH (2026-02-21): handlers update state AND push changed fields
  // to entities via pushFn. Safety-net full sync handles structural changes.

  // IMMEDIATE-SYNC (2026-02-21): After structural changes (reset, add/remove
  // segment), per-field push is dead because new segments have no _entityId.
  // This ref tells the safety-net to use a short delay instead of 30 seconds.
  const immediateSyncRequestRef = React.useRef(false);
  const requestImmediateSync = React.useCallback(() => {
    immediateSyncRequestRef.current = true;
  }, []);

  const handlers = useWeeklyServiceHandlers({
    serviceData, setServiceData, selectedAnnouncements,
    updateAnnouncementMutation, fixedAnnouncements, dynamicAnnouncements,
    blueprintData,
    setVerseParserOpen, setVerseParserContext, verseParserContext,
    setShowSpecialDialog, setSpecialSegmentDetails, specialSegmentDetails,
    setOptimizingAnnouncement, setPrintSettingsPage1, setPrintSettingsPage2,
    setEditingAnnouncement, setAnnouncementForm, setShowAnnouncementDialog,
    setShowResetConfirm, editingAnnouncement, createAnnouncementMutation,
    slotNames: sundaySlotNames,
    pushFn,
    requestImmediateSync,
  });

  // ── Initialize service data from DB or blueprint ──
  // SONG-OVERWRITE-FIX-2 (2026-02-20): Only initialize on first load for this date.
  // Once we've initialized, local state is the source of truth.
  // Reset the ref when selectedDate changes so new dates get fresh initialization.
  React.useEffect(() => {
    localStateInitializedRef.current = false;
  }, [selectedDate]);

  useEffect(() => {
    // Guard: skip re-initialization if we've already loaded data for this date
    if (localStateInitializedRef.current) return;
    // CRITICAL: For fresh loads (existingData=null), blueprintData MUST be available
    // to seed segments. Only skip if blueprintData hasn't loaded yet.
    if (!blueprintData) return;
    if (existingData) {
      // Entity Lift FINAL: When data came from Session/Segment entities (_fromEntities),
      // segments already carry their own fields/sub_assignments/actions — no blueprint
      // merge needed. This eliminates the last piece of the dual-write system.
      // Blueprint merge is ONLY for legacy JSON-only services that haven't been re-saved
      // through the entity sync pipeline yet.
      // Blueprint Revamp (2026-02-18): Simplified merge.
      // Entity-sourced segments (_entityId present) are trusted as-is — they carry their own
      // ui_fields, ui_sub_assignments, and segment_actions. No blueprint overlay.
      // Legacy JSON-only segments (no _entityId) get fields populated from DB blueprint IF available,
      // but NEVER get phantom actions injected. Actions only come from what the user entered.
      const mergeSegmentsWithBlueprint = (existingSegments, timeSlot) => {
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
          // Entity-sourced segments: trust as-is, add minimal sub_assignment defaults only
          if (savedSeg.fields && savedSeg.fields.length > 0 && savedSeg._entityId) {
            const savedType = normalizeType(savedSeg.type);
            let subAssignments = savedSeg.sub_assignments || [];
            if (subAssignments.length === 0) {
              if (savedType === 'worship') subAssignments = [{ label: 'Ministración de Sanidad y Milagros', person_field_name: 'ministry_leader', duration_min: 5 }];
              else if (savedType === 'message') subAssignments = [{ label: 'Cierre', person_field_name: 'cierre_leader', duration_min: 5 }];
            }
            // SONG-SLOT FIX (2026-02-20): Ensure worship segments always have song
            // slots for the UI. Entity round-trip can drop empty songs.
            let songs = savedSeg.songs;
            if (savedType === 'worship' && (!songs || !Array.isArray(songs) || songs.length === 0)) {
              songs = [{ title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }];
            }
            return { ...savedSeg, sub_assignments: subAssignments, songs };
          }

          // Legacy JSON-only: only populate missing fields from DB blueprint.
          // CRITICAL: Do NOT overlay actions or translation settings from blueprint.
          // Those must come from user input only.
          const savedType = normalizeType(savedSeg.type);
          if (blueprintData) {
            let blueprintSeg = blueprintData[timeSlot]?.[idx];
            if (!blueprintSeg || normalizeType(blueprintSeg.type) !== savedType) {
              blueprintSeg = blueprintData[timeSlot]?.find(b => normalizeType(b.type) === savedType);
            }
            if (blueprintSeg) {
              // Only fill in structural UI metadata (fields, sub_assignments) — never actions
              const mergedFields = (savedSeg.fields && savedSeg.fields.length > 0) ? savedSeg.fields : (blueprintSeg.fields || []);
              let subAssignments = savedSeg.sub_assignments || blueprintSeg.sub_assignments || [];
              if (!subAssignments || subAssignments.length === 0) {
                if (savedType === 'worship') subAssignments = [{ label: 'Ministración de Sanidad y Milagros', person_field_name: 'ministry_leader', duration_min: 5 }];
                else if (savedType === 'message') subAssignments = [{ label: 'Cierre', person_field_name: 'cierre_leader', duration_min: 5 }];
              }
              // SONG-SLOT FIX (2026-02-20): Ensure worship segments have song slots
              let songs = savedSeg.songs;
              if (savedType === 'worship' && (!songs || !Array.isArray(songs) || songs.length === 0)) {
                songs = [{ title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }];
              }
              return {
                ...savedSeg,
                fields: mergedFields,
                sub_assignments: subAssignments,
                songs,
                // Preserve user's own actions — do NOT inject blueprint actions
              };
            }
          }

          // No blueprint available: assign default field sets so the UI renders inputs
          if (!savedSeg.fields || savedSeg.fields.length === 0) {
            let defaultFields = [];
            if (savedType === 'worship') defaultFields = ["leader", "songs", "ministry_leader"];
            else if (savedType === 'welcome') defaultFields = ["presenter"];
            else if (savedType === 'offering') defaultFields = ["presenter", "verse"];
            else if (savedType === 'message') defaultFields = ["preacher", "title", "verse"];
            if (defaultFields.length > 0) {
              let songs = savedSeg.songs;
              if (savedType === 'worship' && (!songs || !Array.isArray(songs) || songs.length === 0)) {
                songs = [{ title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }];
              }
              return { ...savedSeg, fields: defaultFields, songs };
            }
          }
          return savedSeg;
        });
      };

      // Phase 2: merge segments dynamically for all configured slots
      const loadedData = { ...existingData };
      const defaultPreNotes = {};
      sundaySlotNames.forEach(name => { defaultPreNotes[name] = ""; });
      sundaySlotNames.forEach(name => {
        const existingSlotSegments = existingData[name] || [];
        if (existingSlotSegments.length > 0) {
          // Slot has data — merge with blueprint for fields/sub_assignments
          loadedData[name] = mergeSegmentsWithBlueprint(existingSlotSegments, name);
        } else {
          // Slot is empty (new slot added to ServiceSchedule after service was created).
          // Seed it from the blueprint so users get the standard segment structure.
          const bpSegments = blueprintData?.[name] || blueprintData?.[sundaySlotNames[0]] || [];
          loadedData[name] = bpSegments.map(seg => {
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
        }
      });
      loadedData.pre_service_notes = existingData.pre_service_notes || defaultPreNotes;
      loadedData.receso_notes = existingData.receso_notes || { [sundaySlotNames[0]]: "" };
      loadedData.selected_announcements = existingData.selected_announcements || [];
      setServiceData(loadedData);
      setLastSavedData(JSON.parse(JSON.stringify(loadedData)));
      setSelectedAnnouncements(existingData.selected_announcements || []);
      setPrintSettingsPage1(existingData.print_settings_page1 || null);
      setPrintSettingsPage2(existingData.print_settings_page2 || null);
      setHasUnsavedChanges(false);
      // Phase 5: Capture baseline for stale detection
      captureServiceBaseline(existingData.updated_date);
      // SONG-OVERWRITE-FIX-2: Mark as initialized — subsequent existingData changes
      // (from our own saves) will NOT re-run this initialization.
      localStateInitializedRef.current = true;

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
      // Phase 2: Build initial data dynamically from ServiceSchedule slots
      const initData = { date: selectedDate, selected_announcements: [] };
      const emptySlotObj = {};
      sundaySlotNames.forEach(name => { emptySlotObj[name] = ""; });
      initData.coordinators = { ...emptySlotObj };
      initData.ujieres = { ...emptySlotObj };
      initData.sound = { ...emptySlotObj };
      initData.luces = { ...emptySlotObj };
      initData.fotografia = { ...emptySlotObj };
      initData.receso_notes = { [sundaySlotNames[0]]: "" };
      initData.pre_service_notes = { ...emptySlotObj };
      sundaySlotNames.forEach(name => {
        const bpSegments = blueprintData?.[name] || blueprintData?.[sundaySlotNames[0]] || [];
        initData[name] = mapBlueprintToSegments(bpSegments);
      });
      setServiceData(initData);
      setLastSavedData(null);
      setSelectedAnnouncements([]);
      setPrintSettingsPage1(null);
      setPrintSettingsPage2(null);
      setHasUnsavedChanges(false);
      localStateInitializedRef.current = true;
      }
      // SEGMENT-DISAPPEAR-FIX-v4 (2026-02-21): Re-added blueprintData to deps.
      // On fresh load (existingData=null), the effect must wait for blueprintData
      // to arrive before initializing. Removing it caused a race where the else block
      // would run with undefined blueprintData, seeding empty segments.
      // The initialization guard (localStateInitializedRef) ensures we only initialize
      // once per date, so subsequent blueprintData changes won't re-trigger (it only
      // fires when existingData OR blueprintData first become non-null).
      }, [existingData, selectedDate, blueprintData]);

  // MULTI-ADMIN REAL-TIME (2026-02-21): Subscribe to entity changes for collaboration.
  // When another admin saves (entities change), we detect it and either auto-reload
  // (if no local unsaved changes) or show a banner (if user has unsaved changes).
  // Uses ownSaveInProgressRef to filter out our own save events.
  useEffect(() => {
    if (!existingData?.id) return;

    const externalDebounce = { timer: null };

    const handleExternalChange = () => {
      // Ignore our own saves and per-field pushes
      if (ownSaveInProgressRef.current || fieldPushActiveRef.current > 0) return;

      if (externalDebounce.timer) clearTimeout(externalDebounce.timer);
      externalDebounce.timer = setTimeout(() => {
        if (ownSaveInProgressRef.current || fieldPushActiveRef.current > 0) return;

        if (!hasUnsavedChangesRef.current) {
          // No local changes — auto-reload seamlessly
          localStateInitializedRef.current = false;
          queryClient.invalidateQueries({ queryKey: ['weeklyService', selectedDate] });
          toast.info('Programa actualizado por otro administrador');
        } else {
          // Has local changes — show banner, let user decide
          setExternalChangeAvailable(true);
          toast.warning('Otro administrador actualizó el programa');
        }
      }, 1500); // Debounce: wait for entity sync to complete (multiple entities change in rapid succession)
    };

    const unsubs = [
      base44.entities.Service.subscribe((event) => {
        if (event.id !== existingData.id) return;
        handleExternalChange();
      }),
      base44.entities.Session.subscribe((event) => {
        // Filter: only react to sessions belonging to our service
        if (event.data?.service_id && event.data.service_id !== existingData.id) return;
        handleExternalChange();
      }),
    ];

    return () => {
      if (externalDebounce.timer) clearTimeout(externalDebounce.timer);
      unsubs.forEach(u => typeof u === 'function' && u());
    };
  }, [existingData?.id, selectedDate, queryClient]);

  // Reload handler for the external change banner
  const handleExternalReload = React.useCallback(() => {
    localStateInitializedRef.current = false;
    setExternalChangeAvailable(false);
    queryClient.invalidateQueries({ queryKey: ['weeklyService', selectedDate] });
    toast.info('Recargando programa...');
  }, [selectedDate, queryClient]);

  // ── Side effects ──
  // Track unsaved changes
  useEffect(() => {
    if (!lastSavedData || !serviceData) return;
    setHasUnsavedChanges(JSON.stringify(serviceData) !== JSON.stringify(lastSavedData));
  }, [serviceData, lastSavedData]);

  // Continuous localStorage backup (5s debounce). Since per-field pushes don't
  // trigger full sync immediately, we keep a rolling backup so the recovery toast
  // can offer data from even very recent edits if the browser crashes.
  useEffect(() => {
    if (!serviceData || !selectedDate) return;
    const timer = setTimeout(() => {
      const backupKey = `service_backup_${selectedDate}`;
      safeSetItem(backupKey, JSON.stringify({ data: serviceData, timestamp: new Date().toISOString() }));
    }, 5000);
    return () => clearTimeout(timer);
  }, [serviceData, selectedDate]);

  // Dynamic day label for service naming (used in save payloads and PDF filenames)
  const activeDayMeta = WEEKDAYS.find(w => w.key === activeDay);
  const activeDayLabel = activeDayMeta?.fullLabel || 'Domingo';
  const activeDayEnglish = activeDay.charAt(0).toUpperCase() + activeDay.slice(1);

  // Warn before leaving + flush unsaved changes on exit/tab-switch.
  // visibilitychange fires reliably on tab switch and mobile app backgrounding.
  // beforeunload fires on navigation/close (not guaranteed on mobile).
  // Both trigger an immediate full sync if there are uncommitted changes.
  useEffect(() => {
    const flushOnExit = () => {
      if (!hasUnsavedChangesRef.current || entitySyncInProgressRef.current) return;
      if (!serviceDataRef.current || !lastSavedDataRef.current) return;
      if (JSON.stringify(serviceDataRef.current) === JSON.stringify(lastSavedDataRef.current)) return;
      // Fire full sync immediately — don't wait for 30s safety net
      const payload = {
        ...serviceDataRef.current,
        selected_announcements: selectedAnnouncements,
        print_settings_page1: printSettingsPage1, print_settings_page2: printSettingsPage2,
        day_of_week: activeDayEnglish,
        name: `${activeDayLabel} - ${selectedDate}`, status: 'active',
        service_type: 'weekly'
      };
      saveServiceMutation.mutate(payload);
    };
    const handleBeforeUnload = (e) => {
      flushOnExit();
      if (hasUnsavedChangesRef.current) {
        e.preventDefault();
        e.returnValue = 'Tienes cambios sin guardar.';
        return e.returnValue;
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushOnExit();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedAnnouncements, printSettingsPage1, printSettingsPage2, selectedDate, activeDay]);

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

  // PER-FIELD PUSH (2026-02-21): Primary save trigger is now per-field entity pushes
  // that fire on each input commit (blur or 3-second debounce). The full sync below
  // is a SAFETY NET for structural changes (add/remove/reorder segments), Service
  // metadata updates, and triggering refreshActiveProgram for display surfaces.
  //
  // The old blur-triggered full sync has been REMOVED because it caused data loss:
  // while the heavy sync was running, fields committed during the async window
  // were marked as "saved" in lastSavedData but never actually sent to the server.
  const buildSavePayload = () => ({
    ...serviceData, selected_announcements: selectedAnnouncements,
    print_settings_page1: printSettingsPage1, print_settings_page2: printSettingsPage2,
    day_of_week: activeDayEnglish,
    name: `${activeDayLabel} - ${selectedDate}`, status: 'active',
    service_type: 'weekly'
  });

  // Safety-net full sync: runs 30 seconds after last change (or 2 seconds if
  // an immediate sync was requested, e.g. after blueprint reset). Handles
  // structural changes, Service metadata, and triggers display surface refresh.
  // Per-field pushes handle individual field values immediately on commit.
  useEffect(() => {
    if (!lastSavedData || !serviceData) return;
    if (JSON.stringify(serviceData) === JSON.stringify(lastSavedData)) return;
    // IMMEDIATE-SYNC (2026-02-21): Use short delay after structural changes
    // (reset, add/remove segment) so new entity IDs are assigned quickly.
    const delay = immediateSyncRequestRef.current ? 2000 : 30000;
    immediateSyncRequestRef.current = false;
    const handler = setTimeout(() => {
      saveServiceMutation.mutate(buildSavePayload());
    }, delay);
    return () => clearTimeout(handler);
  }, [serviceData, lastSavedData, selectedAnnouncements, printSettingsPage1, printSettingsPage2, selectedDate, activeDay]);

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
      <UpdatersContext.Provider value={{ updateSegmentField: handlers.updateSegmentField, updateTeamField: handlers.updateTeamField, setServiceData, pushFn }}>
    <div className="p-6 md:p-8 space-y-8 print:p-0 bg-[#F0F1F3] min-h-screen">
      <WeeklyServicePrintCSS printSettingsPage1={activePrintSettingsPage1} printSettingsPage2={activePrintSettingsPage2} />

      <WeeklyServicePrintView
        serviceData={serviceData} selectedDate={selectedDate}
        fixedAnnouncements={fixedAnnouncements} dynamicAnnouncements={dynamicAnnouncements}
        selectedAnnouncements={selectedAnnouncements}
        printSettingsPage1={printSettingsPage1} printSettingsPage2={printSettingsPage2}
        isQuickPrint={isQuickPrint}
        slotNames={sundaySlotNames}
      />

      {/* Screen UI — Header */}
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-5xl text-gray-900 uppercase tracking-tight">Servicios Semanales</h1>
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
        {/* Toolbar: PDFs + Live View top-level, secondary actions in overflow menu */}
        <div className="flex gap-2 items-center">
          {savingField && (
            <div className="flex items-center gap-2 text-xs md:text-sm text-gray-600">
              <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin text-pdv-teal" />
              <span className="hidden md:inline">{t('btn.saving')}</span>
            </div>
          )}
          {/* Primary actions — always visible */}
          <Button onClick={() => navigate(createPageUrl('PublicProgramView') + `?date=${selectedDate}`)} variant="outline" className="border-pdv-teal text-pdv-teal hover:bg-pdv-teal hover:text-white border-2 font-semibold text-xs md:text-sm px-2 py-1 md:px-4 md:py-2">
            <Eye className="w-3 h-3 md:w-4 md:h-4 md:mr-2" /><span className="hidden md:inline">{t('btn.live_view')}</span>
          </Button>
          <Button onClick={handlers.handleDownloadProgramPDF} style={tealStyle} className="font-semibold text-xs md:text-sm px-2 py-1 md:px-4 md:py-2" title="Descargar PDF Programa">
            <Download className="w-3 h-3 md:w-4 md:h-4 md:mr-2" /><span className="hidden md:inline">PDF Programa</span>
          </Button>
          <Button onClick={handlers.handleDownloadAnnouncementsPDF} style={greenStyle} className="font-semibold text-xs md:text-sm px-2 py-1 md:px-4 md:py-2" title="Descargar PDF Anuncios">
            <Download className="w-3 h-3 md:w-4 md:h-4 md:mr-2" /><span className="hidden md:inline">PDF Anuncios</span>
          </Button>

          {/* Overflow menu — secondary actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="border-2 border-gray-300 bg-white text-gray-600 hover:bg-gray-100 h-9 w-9">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => window.open('/api/functions/serveWeeklyServiceSubmission', '_blank')} className="gap-2">
                <ExternalLink className="w-4 h-4 text-purple-500" />
                <span>Link para Oradores</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowPrintSettings(true)} className="gap-2">
                <Settings className="w-4 h-4 text-gray-500" />
                <span>Ajustes de Impresión</span>
              </DropdownMenuItem>
              {hasPermission(user, 'edit_services') && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowScheduleManager(true)} className="gap-2">
                    <Wrench className="w-4 h-4 text-purple-500" />
                    <span>Configurar Horarios</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowResetConfirm(true)} className="gap-2 text-red-600 focus:text-red-600">
                    <Wand2 className="w-4 h-4" />
                    <span>Restablecer Blueprint</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Multi-admin: External change notification */}
      {externalChangeAvailable && (
        <div className="bg-blue-50 border-2 border-blue-400 rounded-lg p-3 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-blue-800 font-medium">
              Otro administrador actualizó el programa. Tus cambios no guardados se perderán al recargar.
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExternalReload}
            className="border-blue-400 text-blue-700 hover:bg-blue-100 ml-4 shrink-0"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Recargar
          </Button>
        </div>
      )}

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
      <style>{`
        [data-weekday-tab][data-state="active"] { background-color: #1F8A70 !important; color: #ffffff !important; }
      `}</style>
      <Tabs value={activeDay} onValueChange={setActiveDay} className="print:hidden">
        {/* Weekday tab bar — shows all days that have services */}
        {activeDays.length > 1 && (
          <TabsList className="mb-4 h-10 bg-gray-200">
            {activeDays.map(day => (
              <TabsTrigger
                key={day.key}
                value={day.key}
                className="px-4 py-1.5 text-sm font-bold text-gray-700"
                style={{}}
                data-weekday-tab="true"
              >
                <span className="hidden sm:inline">{day.fullLabel}</span>
                <span className="sm:hidden">{day.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        )}

        {/* Sunday (default) — dynamic columns from ServiceSchedule */}
        <TabsContent value="sunday" className="mt-0">
          <SundaySlotColumns
            sundaySlotNames={sundaySlotNames}
            serviceData={serviceData}
            expandedSegments={expandedSegments}
            toggleSegmentExpanded={toggleSegmentExpanded}
            handlers={handlers}
            setServiceData={setServiceData}
            setSpecialSegmentDetails={setSpecialSegmentDetails}
            setShowSpecialDialog={setShowSpecialDialog}
            canEdit={hasPermission(user, 'edit_services')}
          />
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
                <div className="space-y-4">
                  {dayServices.map(svc => (
                    <WeekdayServicePanel key={svc.id} service={svc} />
                  ))}
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
        slotHasTranslation={(serviceData?.[specialSegmentDetails.timeSlot] || []).some(seg => seg.requires_translation)}
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

      {/* Schedule Manager Dialog */}
      <Dialog open={showScheduleManager} onOpenChange={setShowScheduleManager}>
        <DialogContent className="max-w-3xl bg-white max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurar Horarios</DialogTitle>
          </DialogHeader>
          <ServiceScheduleManager />
        </DialogContent>
      </Dialog>

      {/* All remaining dialogs */}
      <WeeklyServiceDialogs
        deleteConfirmId={deleteConfirmId} setDeleteConfirmId={setDeleteConfirmId}
        deleteAnnouncementMutation={deleteAnnouncementMutation}
        showResetConfirm={showResetConfirm} setShowResetConfirm={setShowResetConfirm}
        executeResetToBlueprint={handlers.executeResetToBlueprint}
        slotNames={sundaySlotNames}
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
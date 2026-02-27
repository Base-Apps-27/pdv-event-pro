/**
 * WeeklyServiceManager.jsx
 * Recurring Services Refactor (2026-02-23): Thin orchestrator shell.
 *
 * Per-day editing logic extracted to DayServiceEditor.
 * This file owns: date picker, day tabs, announcements, shared dialogs.
 *
 * Previous: 1055 lines (monolithic Sunday-centric editor)
 * Now: ~350 lines (day-agnostic orchestrator)
 */

import React, { useState, useEffect, useMemo } from "react";
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
import { Calendar as CalendarIcon, Eye, Download, Settings, Wand2, MoreVertical, Wrench, ExternalLink, Tv, UserCircle } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { createPageUrl } from "@/utils";
import { format as formatDate } from "date-fns";
import { toast } from "sonner";
import { es } from "date-fns/locale";
import { useLanguage } from "@/components/utils/i18n";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import WeeklyServicePrintCSS from "@/components/service/WeeklyServicePrintCSS";
import WeeklyAnnouncementSection from "@/components/service/WeeklyAnnouncementSection";
import WeeklyServiceDialogs from "@/components/service/weekly/WeeklyServiceDialogs";
import ServiceScheduleManager from "@/components/service/weekly/ServiceScheduleManager";
import WeeklyEditorV2 from "@/components/service/v2/WeeklyEditorV2";
import { useServiceSchedules } from "@/components/service/weekly/useServiceSchedules";

// Weekday definitions — ordered Mon→Sun matching ISO week. Labels in Spanish.
const WEEKDAYS = [
  { key: 'monday', label: 'Lun', fullLabel: 'Lunes', dayIndex: 1, dayName: 'Monday' },
  { key: 'tuesday', label: 'Mar', fullLabel: 'Martes', dayIndex: 2, dayName: 'Tuesday' },
  { key: 'wednesday', label: 'Mié', fullLabel: 'Miércoles', dayIndex: 3, dayName: 'Wednesday' },
  { key: 'thursday', label: 'Jue', fullLabel: 'Jueves', dayIndex: 4, dayName: 'Thursday' },
  { key: 'friday', label: 'Vie', fullLabel: 'Viernes', dayIndex: 5, dayName: 'Friday' },
  { key: 'saturday', label: 'Sáb', fullLabel: 'Sábado', dayIndex: 6, dayName: 'Saturday' },
  { key: 'sunday', label: 'Dom', fullLabel: 'Domingo', dayIndex: 0, dayName: 'Sunday' },
];

export default function WeeklyServiceManager() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  // Phase 2: Dynamic session slots from ServiceSchedule entity
  const { getTimeSlotsForDay, getActiveDays: getScheduledDays } = useServiceSchedules();
  const scheduledDays = useMemo(() => getScheduledDays(), [getScheduledDays]);

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

  // Weekday tab state — defaults to sunday
  const [activeDay, setActiveDay] = useState('sunday');

  // ── Shared dialog / UI state ──
  // Note: SpecialSegment, VerseParser, and ResetConfirm dialogs are now
  // per-day and owned by DayServiceEditor. Only announcement + print dialogs remain shared.
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [announcementForm, setAnnouncementForm] = useState({
    title: "", content: "", instructions: "", category: "General",
    is_active: true, priority: 10, has_video: false, date_of_occurrence: "", emphasize: false
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [optimizingAnnouncement, setOptimizingAnnouncement] = useState(false);
  const [showPrintSettings, setShowPrintSettings] = useState(false);
  const [printSettingsPage1, setPrintSettingsPage1] = useState(null);
  const [printSettingsPage2, setPrintSettingsPage2] = useState(null);
  const [selectedAnnouncements, setSelectedAnnouncements] = useState([]);

  // ── Blueprints ──
  const { data: blueprints = [] } = useQuery({
    queryKey: ['serviceBlueprintsList'],
    queryFn: () => base44.entities.Service.filter({ status: 'blueprint' }),
    staleTime: Infinity,
  });

  // ── Announcements ──
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
      return [
        ...filteredItems.map(a => ({ ...a, sortDate: new Date(a.date_of_occurrence + 'T00:00:00') })),
        ...filteredEvents.map(e => ({ ...e, isEvent: true, sortDate: new Date(e.start_date + 'T00:00:00') }))
      ].sort((a, b) => a.sortDate - b.sortDate);
    },
    enabled: !!selectedDate
  });

  // Announcement mutations
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
    onError: (error) => toast.error('Error al eliminar: ' + (error.message || JSON.stringify(error))),
  });

  // Announcement handlers
  const openAnnouncementEdit = (ann) => {
    setEditingAnnouncement(ann);
    setAnnouncementForm({
      title: ann.title, content: ann.content, instructions: ann.instructions || "",
      category: ann.category, is_active: ann.is_active, priority: ann.priority || 10,
      has_video: ann.has_video || false, date_of_occurrence: ann.date_of_occurrence || "", emphasize: ann.emphasize || false
    });
    setShowAnnouncementDialog(true);
  };
  const moveAnnouncementPriority = (ann, direction) => {
    const newPriority = direction === 'up' ? (ann.priority || 10) - 1 : (ann.priority || 10) + 1;
    updateAnnouncementMutation.mutate({ id: ann.id, data: { ...ann, priority: newPriority } });
  };

  // Auto-select announcements
  useEffect(() => {
    if (fixedAnnouncements.length > 0 || dynamicAnnouncements.length > 0) {
      if (!selectedAnnouncements || selectedAnnouncements.length === 0) {
        setSelectedAnnouncements([...fixedAnnouncements.map(a => a.id), ...dynamicAnnouncements.map(a => a.id)]);
      }
    }
  }, [fixedAnnouncements, dynamicAnnouncements]);

  // ── Compute active days and dates ──
  const activeDays = useMemo(() => {
    const daySet = new Set(['sunday']);
    const dayNameToKey = { Sunday: 'sunday', Monday: 'monday', Tuesday: 'tuesday', Wednesday: 'wednesday', Thursday: 'thursday', Friday: 'friday', Saturday: 'saturday' };
    scheduledDays.forEach(day => {
      const key = dayNameToKey[day];
      if (key) daySet.add(key);
    });
    return WEEKDAYS.filter(w => daySet.has(w.key));
  }, [scheduledDays]);

  // Compute dates for each day in the selected week
  const dayDates = useMemo(() => {
    const sel = new Date(selectedDate + 'T12:00:00');
    const dayOfWeek = sel.getDay(); // 0=Sun
    const monday = new Date(sel);
    monday.setDate(sel.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    const dates = {};
    WEEKDAYS.forEach(wd => {
      const d = new Date(monday);
      const offset = wd.dayIndex === 0 ? 6 : wd.dayIndex - 1; // Mon=0, Tue=1, ... Sun=6
      d.setDate(monday.getDate() + offset);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dates[wd.key] = ds;
    });
    return dates;
  }, [selectedDate]);

  // Compute sessions per day
  const daySessionsMap = useMemo(() => {
    const map = {};
    activeDays.forEach(day => {
      const slots = getTimeSlotsForDay(day.dayName);
      map[day.key] = slots;
    });
    // Ensure Sunday always has sessions (legacy fallback)
    if (!map.sunday || map.sunday.length === 0) {
      map.sunday = [
        { name: "9:30am", planned_start_time: "09:30", order: 1, color: "green" },
        { name: "11:30am", planned_start_time: "11:30", order: 2, color: "blue" }
      ];
    }
    return map;
  }, [activeDays, getTimeSlotsForDay]);

  // Default print settings
  const defaultPrintSettings = { globalScale: 1.0, margins: { top: "0.5in", right: "0.5in", bottom: "0.5in", left: "0.5in" }, bodyFontScale: 1.0, titleFontScale: 1.0 };

  // ── Render ──
  return (
    <div className="p-6 md:p-8 space-y-8 print:p-0 bg-[#F0F1F3] min-h-screen">
      <WeeklyServicePrintCSS printSettingsPage1={printSettingsPage1 || defaultPrintSettings} printSettingsPage2={printSettingsPage2 || defaultPrintSettings} />

      {/* Header — Row 1: Title + view buttons + menu */}
      <div className="space-y-2 print:hidden">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl md:text-3xl text-gray-900 uppercase tracking-tight leading-tight">Servicios</h1>
          <div className="flex gap-1.5 items-center flex-shrink-0">
            <Button onClick={() => navigate(createPageUrl('PublicProgramView') + `?date=${dayDates[activeDay] || selectedDate}`)} variant="outline" size="sm" className="border-pdv-teal text-pdv-teal hover:bg-pdv-teal hover:text-white border-2 font-semibold text-xs px-2 py-1 h-8">
              <Eye className="w-3.5 h-3.5 md:mr-1.5" /><span className="hidden md:inline">{t('btn.live_view')}</span>
            </Button>
            <Button onClick={() => navigate(createPageUrl('PublicCountdownDisplay') + `?date=${dayDates[activeDay] || selectedDate}`)} variant="outline" size="sm" className="border-purple-400 text-purple-700 hover:bg-purple-600 hover:text-white border-2 font-semibold text-xs px-2 py-1 h-8" title="TV Display">
              <Tv className="w-3.5 h-3.5 md:mr-1.5" /><span className="hidden md:inline">TV</span>
            </Button>
            <Button onClick={() => navigate(createPageUrl('MyProgram') + `?date=${dayDates[activeDay] || selectedDate}`)} variant="outline" size="sm" className="border-blue-400 text-blue-700 hover:bg-blue-600 hover:text-white border-2 font-semibold text-xs px-2 py-1 h-8" title="Mi Programa">
              <UserCircle className="w-3.5 h-3.5 md:mr-1.5" /><span className="hidden md:inline">Mi Prog.</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="border-2 border-gray-300 bg-white text-gray-600 hover:bg-gray-100 h-8 w-8">
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
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Row 2: Date centered, prominent — visually separated */}
        <div className="flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-lg py-2 px-4 shadow-sm">
          <span className="text-2xl md:text-3xl text-pdv-teal tracking-tight leading-tight" style={{ fontFamily: "'Anton', sans-serif", textTransform: 'uppercase' }}>
            {selectedDate ? formatDate(new Date(selectedDate + 'T12:00:00'), "d 'de' MMMM", { locale: es }) : ""}
          </span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="text-pdv-teal hover:bg-emerald-50 px-1.5 h-8">
                <CalendarIcon className="w-5 h-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <style>{`
                [data-disabled="true"] { color: #d1d5db !important; cursor: not-allowed !important; }
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

      {/* Weekday tabs — each renders its own DayServiceEditor */}
      <style>{`
        [data-weekday-tab][data-state="active"] { background-color: #1F8A70 !important; color: #ffffff !important; }
      `}</style>
      <Tabs value={activeDay} onValueChange={setActiveDay} className="print:hidden">
        {activeDays.length > 1 && (
          <TabsList className="mb-4 h-10 bg-gray-200">
            {activeDays.map(day => (
              <TabsTrigger
                key={day.key}
                value={day.key}
                className="px-4 py-1.5 text-sm font-bold text-gray-700"
                data-weekday-tab="true"
              >
                <span className="hidden sm:inline">{day.fullLabel}</span>
                <span className="sm:hidden">{day.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        )}

        {activeDays.map(day => (
          <TabsContent key={day.key} value={day.key} className="mt-0">
            <WeeklyEditorV2
              dayOfWeek={day.dayName}
              date={dayDates[day.key] || selectedDate}
              sessions={daySessionsMap[day.key] || []}
              blueprints={blueprints}
              user={user}
            />
          </TabsContent>
        ))}
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
        onEditAnnouncement={openAnnouncementEdit}
        onDeleteAnnouncement={(id) => setDeleteConfirmId(id)}
        onMovePriority={moveAnnouncementPriority}
        onUpdateEvent={({ id, data }) => updateAnnouncementMutation.mutate({ id, data })}
        canCreate={hasPermission(user, 'create_announcements')}
        canEdit={hasPermission(user, 'edit_announcements')}
        canDelete={hasPermission(user, 'delete_announcements')}
        tealStyle={{ backgroundColor: '#1F8A70', color: '#ffffff' }}
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

      {/* Shared dialogs: Print Settings, Announcement, Delete Confirmation */}
      <WeeklyServiceDialogs
        deleteConfirmId={deleteConfirmId} setDeleteConfirmId={setDeleteConfirmId}
        deleteAnnouncementMutation={deleteAnnouncementMutation}
        showResetConfirm={false} setShowResetConfirm={() => {}}
        executeResetToBlueprint={() => {}}
        slotNames={(daySessionsMap[activeDay] || []).map(s => s.name)}
        verseParserOpen={false} setVerseParserOpen={() => {}}
        verseParserContext={{}} handleSaveParsedVerses={() => {}}
        showPrintSettings={showPrintSettings} setShowPrintSettings={setShowPrintSettings}
        activePrintSettingsPage1={printSettingsPage1 || defaultPrintSettings}
        activePrintSettingsPage2={printSettingsPage2 || defaultPrintSettings}
        handleSavePrintSettings={(s) => { setPrintSettingsPage1(s.page1); setPrintSettingsPage2(s.page2); }}
        serviceData={{}}
        showAnnouncementDialog={showAnnouncementDialog} setShowAnnouncementDialog={setShowAnnouncementDialog}
        editingAnnouncement={editingAnnouncement} announcementForm={announcementForm}
        setAnnouncementForm={setAnnouncementForm}
        handleAnnouncementSubmit={(formData) => {
          if (editingAnnouncement) {
            updateAnnouncementMutation.mutate({ id: editingAnnouncement.id, data: formData });
          } else {
            createAnnouncementMutation.mutate(formData);
          }
        }}
        optimizeAnnouncementWithAI={() => {}} optimizingAnnouncement={optimizingAnnouncement}
      />
    </div>
  );
}
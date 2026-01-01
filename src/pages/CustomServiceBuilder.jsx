import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AutocompleteInput from "@/components/ui/AutocompleteInput";
import { Calendar, Clock, Save, Plus, Trash2, Printer, ArrowLeft, ChevronUp, ChevronDown, Sparkles, Settings, ArrowUp, ArrowDown } from "lucide-react";
import AnnouncementListSelector from "@/components/announcements/AnnouncementListSelector";
import DatePicker from "@/components/ui/DatePicker";
import TimePicker from "@/components/ui/TimePicker";
import AnimatedSortableItem from "@/components/shared/AnimatedSortableItem";
import { AnimatePresence } from "framer-motion";
import { addMinutes, parse, format } from "date-fns";
import PrintSettingsModal from "@/components/print/PrintSettingsModal";
import VerseParserDialog from "@/components/service/VerseParserDialog";
import { BookOpen } from "lucide-react";
import { formatDate as formatDateES } from "date-fns";
import { es } from "date-fns/locale";
import { normalizeSegment, normalizeServiceTeams, getSegmentData } from "@/components/utils/segmentDataUtils";

export default function CustomServiceBuilder() {
  const tealStyle = { backgroundColor: '#1F8A70', color: '#ffffff' };
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const serviceId = searchParams.get('id');
  const queryClient = useQueryClient();

  const [serviceData, setServiceData] = useState({
    name: "",
    date: new Date().toISOString().split('T')[0],
    day_of_week: "",
    time: "10:00",
    location: "",
    description: "",
    segments: [
      normalizeSegment({
        _uiId: "init-1",
        title: "Equipo de A&A",
        type: "Alabanza",
        duration: 35,
        // Legacy root fields for initial state
        presenter: "",
        translator: "",
        preacher: "",
        leader: "",
        messageTitle: "",
        verse: "",
        songs: [
          { title: "", lead: "", key: "" },
          { title: "", lead: "", key: "" },
          { title: "", lead: "", key: "" },
          { title: "", lead: "", key: "" }
        ],
        description: "",
        description_details: "",
        coordinator_notes: "",
        projection_notes: "",
        sound_notes: "",
        ushers_notes: "",
        translation_notes: "",
        stage_decor_notes: "",
        actions: []
      }),
      normalizeSegment({
        _uiId: "init-2",
        title: "Bienvenida y Anuncios",
        type: "Bienvenida",
        duration: 5,
        presenter: "",
        translator: "",
        preacher: "",
        leader: "",
        messageTitle: "",
        verse: "",
        songs: [],
        description: "",
        description_details: "",
        coordinator_notes: "",
        projection_notes: "",
        sound_notes: "",
        ushers_notes: "",
        translation_notes: "",
        stage_decor_notes: "",
        actions: []
      }),
      normalizeSegment({
        _uiId: "init-3",
        title: "Ofrendas",
        type: "Ofrenda",
        duration: 5,
        presenter: "",
        translator: "",
        preacher: "",
        leader: "",
        messageTitle: "",
        verse: "",
        songs: [],
        description: "",
        description_details: "",
        coordinator_notes: "",
        projection_notes: "",
        sound_notes: "",
        ushers_notes: "",
        translation_notes: "",
        stage_decor_notes: "",
        actions: []
      }),
      normalizeSegment({
        _uiId: "init-4",
        title: "Mensaje",
        type: "Plenaria",
        duration: 45,
        presenter: "",
        translator: "",
        preacher: "",
        leader: "",
        messageTitle: "",
        verse: "",
        songs: [],
        description: "",
        description_details: "",
        coordinator_notes: "",
        projection_notes: "",
        sound_notes: "",
        ushers_notes: "",
        translation_notes: "",
        stage_decor_notes: "",
        actions: []
      })
    ],
    coordinators: { main: "" },
    ujieres: { main: "" },
    sound: { main: "" },
    luces: { main: "" },
    fotografia: { main: "" },
    notes: "",
    selected_announcements: []
  });

  const [expandedSegments, setExpandedSegments] = useState({});
  const [showPrintSettings, setShowPrintSettings] = useState(false);
  const [printSettingsPage1, setPrintSettingsPage1] = useState(null);
  const [printSettingsPage2, setPrintSettingsPage2] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [printMode, setPrintMode] = useState(null); // 'program' or 'announcements'
  const [lastSavedData, setLastSavedData] = useState(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState("idle"); // idle, saving, saved, error
  const [highlightedSegmentId, setHighlightedSegmentId] = useState(null);
  const [verseParserOpen, setVerseParserOpen] = useState(false);
  const [verseParserContext, setVerseParserContext] = useState({ segmentIdx: null });

  // Generate simple unique ID for UI tracking
  const generateUiId = () => Math.random().toString(36).substr(2, 9) + Date.now().toString(36);

  const getDefaultSegmentForm = () => ({
    _uiId: generateUiId(),
    title: "",
    type: "Especial",
    duration: 15,
    // Initialize with data object for canonical structure
    data: {
      presenter: "",
      translator: "",
      preacher: "",
      leader: "",
      messageTitle: "",
      verse: "",
      songs: [
        { title: "", lead: "", key: "" },
        { title: "", lead: "", key: "" },
        { title: "", lead: "", key: "" },
        { title: "", lead: "", key: "" }
      ],
      description: "",
      description_details: "",
      coordinator_notes: "",
      projection_notes: "",
      sound_notes: "",
      ushers_notes: "",
      translation_notes: "",
      stage_decor_notes: "",
      actions: []
    },
    // Keep root fields empty/synced for now to ensure legacy compatibility
    presenter: "",
    translator: "",
    preacher: "",
    leader: "",
    messageTitle: "",
    verse: "",
    songs: [
      { title: "", lead: "", key: "" },
      { title: "", lead: "", key: "" },
      { title: "", lead: "", key: "" },
      { title: "", lead: "", key: "" }
    ],
    description: "",
    description_details: "",
    coordinator_notes: "",
    projection_notes: "",
    sound_notes: "",
    ushers_notes: "",
    translation_notes: "",
    stage_decor_notes: "",
    actions: []
  });

  const { data: existingService } = useQuery({
    queryKey: ['customService', serviceId],
    queryFn: async () => {
      if (!serviceId) return null;
      const service = await base44.entities.Service.filter({ id: serviceId });
      return service[0] || null;
    },
    enabled: !!serviceId
  });

  useEffect(() => {
    if (existingService) {
      console.log('[DATA LOAD] Service loaded from backend:', {
        id: existingService.id,
        name: existingService.name,
        updated_date: existingService.updated_date,
        segmentCount: existingService.segments?.length || 0,
        fullData: existingService
      });
      
      // Normalize loaded data using shared utilities
      // This ensures teams are objects and segments have nested data structure
      const sanitizedService = normalizeServiceTeams(existingService);
      
      // Ensure all segments have a stable UI ID for React keys
      if (sanitizedService.segments) {
        sanitizedService.segments = sanitizedService.segments.map(s => ({
          ...s,
          _uiId: s._uiId || Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
        }));
      }

      if (!sanitizedService.selected_announcements) {
        sanitizedService.selected_announcements = [];
      }

      setServiceData(sanitizedService);
      setLastSavedData(JSON.parse(JSON.stringify(sanitizedService)));
      setPrintSettingsPage1(existingService.print_settings_page1 || null);
      setPrintSettingsPage2(existingService.print_settings_page2 || null);
      setHasUnsavedChanges(false);
      
      // Load from localStorage backup if available and newer
      const backupKey = `service_backup_${existingService.id}`;
      const backup = localStorage.getItem(backupKey);
      if (backup) {
        try {
          const { data, timestamp } = JSON.parse(backup);
          const backupDate = new Date(timestamp);
          const serverDate = existingService.updated_date ? new Date(existingService.updated_date) : new Date(0);
          if (backupDate > serverDate) {
            console.warn('[BACKUP RECOVERY] LocalStorage backup is newer than server data. User should be prompted to restore.', {
              backupTimestamp: timestamp,
              serverTimestamp: existingService.updated_date,
              serviceId: existingService.id
            });
          }
        } catch (error) {
          console.error('[BACKUP RECOVERY ERROR] Failed to parse localStorage backup', {
            backupKey,
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
      }
    }
  }, [existingService]);

  // Auto-populate day of week from date
  useEffect(() => {
    if (serviceData.date) {
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dateObj = new Date(serviceData.date + 'T00:00:00');
      const dayOfWeek = days[dateObj.getDay()];
      if (dayOfWeek !== serviceData.day_of_week) {
        setServiceData(prev => ({ ...prev, day_of_week: dayOfWeek }));
      }
    }
  }, [serviceData.date]);

  const saveServiceMutation = useMutation({
    mutationFn: async (data) => {
      console.log('[SAVE START]', {
        serviceId,
        operation: serviceId ? 'UPDATE' : 'CREATE',
        dataSnapshot: {
          name: data.name,
          date: data.date,
          segmentCount: data.segments?.length || 0,
          hasCoordinators: !!data.coordinators,
          hasPrintSettings: !!data.print_settings_page1
        },
        fullPayload: data
      });
      
      try {
        // Normalize data before saving to ensure consistency
        // This performs the "lazy migration" - saving in the new format
        const sanitizedData = normalizeServiceTeams(data);

        let result;
        if (serviceId) {
          result = await base44.entities.Service.update(serviceId, sanitizedData);
        } else {
          result = await base44.entities.Service.create(sanitizedData);
        }
        
        console.log('[SAVE SUCCESS]', {
          resultId: result?.id,
          resultUpdatedDate: result?.updated_date,
          fullResult: result
        });
        
        return result;
      } catch (error) {
        console.error('[SAVE ERROR]', {
          error: error.message,
          stack: error.stack,
          payload: data
        });
        throw error;
      }
    },
    onSuccess: async (result) => {
      console.log('[MUTATION SUCCESS] Invalidating queries and updating state');
      
      // SYNC TO SESSION/SEGMENTS for Live Control support
      try {
        await syncToSession(result);
      } catch (err) {
        console.error("Failed to sync session data:", err);
      }

      queryClient.invalidateQueries(['customService']);
      queryClient.invalidateQueries(['services']);
      setLastSavedData(JSON.parse(JSON.stringify(serviceData)));
      setHasUnsavedChanges(false);
      setAutoSaveStatus("saved");
      
      // Save to localStorage backup
      if (result?.id) {
        const backupKey = `service_backup_${result.id}`;
        localStorage.setItem(backupKey, JSON.stringify({
          data: result,
          timestamp: new Date().toISOString()
        }));
        console.log('[BACKUP] Saved to localStorage:', backupKey);
      }
      
      // Only alert if manual save (status is saving)
      if (autoSaveStatus !== "saving") {
         alert('Servicio guardado exitosamente en ' + new Date().toLocaleTimeString('es-ES', { timeZone: 'America/New_York' }));
      }
    },
    onError: (error) => {
      console.error('[MUTATION ERROR]', error);
      setAutoSaveStatus("error");
      alert('Error al guardar: ' + error.message);
    }
  });

  const handleSave = () => {
    console.log('[USER ACTION] Manual save triggered');
    saveServiceMutation.mutate({
      ...serviceData,
      print_settings_page1: printSettingsPage1,
      status: 'active'
    });
  };

  // Track unsaved changes
  useEffect(() => {
    if (!lastSavedData) return;
    
    const hasChanges = JSON.stringify(serviceData) !== JSON.stringify(lastSavedData);
    setHasUnsavedChanges(hasChanges);
    
    if (hasChanges) {
      console.log('[UNSAVED CHANGES] Detected differences from last saved state');
    }
  }, [serviceData, lastSavedData]);

  // Auto-save with debouncing
  useEffect(() => {
    if (!hasUnsavedChanges || !serviceId) return;
    
    setAutoSaveStatus("saving");
    const timer = setTimeout(() => {
      console.log('[AUTO-SAVE] Triggering auto-save after 3 seconds of inactivity');
      saveServiceMutation.mutate({
        ...serviceData,
        print_settings_page1: printSettingsPage1,
        print_settings_page2: printSettingsPage2,
        status: 'active'
      });
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [serviceData, hasUnsavedChanges, serviceId]);

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

  const handleSavePrintSettings = (newSettings) => {
    setPrintSettingsPage1(newSettings.page1);
    setPrintSettingsPage2(newSettings.page2);
    setServiceData(prev => ({
      ...prev,
      print_settings_page1: newSettings.page1,
      print_settings_page2: newSettings.page2
    }));
  };

  const handlePrintProgram = () => {
    setPrintMode('program');
    setTimeout(() => {
      window.print();
      setPrintMode(null);
    }, 100);
  };

  const handlePrintAnnouncements = () => {
    setPrintMode('announcements');
    setTimeout(() => {
      window.print();
      setPrintMode(null);
    }, 100);
  };

  const addSegment = () => {
    setServiceData(prev => ({
      ...prev,
      segments: [...prev.segments, getDefaultSegmentForm()]
    }));
  };

  const removeSegment = (idx) => {
    if (window.confirm('¿Eliminar este segmento?')) {
      setServiceData(prev => ({
        ...prev,
        segments: prev.segments.filter((_, i) => i !== idx)
      }));
    }
  };

  const updateSegmentField = (idx, field, value) => {
    setServiceData(prev => {
      const updated = { ...prev };
      const segments = [...prev.segments];
      const segment = { ...segments[idx] };
      
      // Update root property (Legacy)
      if (field === 'songs') {
        segment.songs = value;
      } else {
        segment[field] = value;
      }
      
      // Update nested data property (Canonical)
      // For safety, we ensure data object exists
      if (!segment.data) segment.data = {};
      
      if (field === 'songs') {
        segment.data.songs = value;
      } else {
        segment.data[field] = value;
      }
      
      segments[idx] = segment;
      updated.segments = segments;
      return updated;
    });
  };

  const toggleSegmentExpanded = (idx) => {
    setExpandedSegments(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const moveSegmentUp = (idx) => {
    if (idx === 0) return;
    const items = Array.from(serviceData.segments);
    const movingSegment = items[idx];
    [items[idx - 1], items[idx]] = [items[idx], items[idx - 1]];
    setServiceData(prev => ({ ...prev, segments: items }));
    setHighlightedSegmentId(movingSegment._uiId);
  };

  const moveSegmentDown = (idx) => {
    if (idx === serviceData.segments.length - 1) return;
    const items = Array.from(serviceData.segments);
    const movingSegment = items[idx];
    [items[idx], items[idx + 1]] = [items[idx + 1], items[idx]];
    setServiceData(prev => ({ ...prev, segments: items }));
    setHighlightedSegmentId(movingSegment._uiId);
  };

  const handleOpenVerseParser = (idx) => {
    const segment = serviceData.segments[idx];
    const currentVerse = segment.verse || "";
    // Check both root and data object for compatibility
    const currentParsedData = segment.parsed_verse_data || segment.data?.parsed_verse_data;
    
    setVerseParserContext({ 
      segmentIdx: idx,
      initialText: currentVerse
    });
    setVerseParserOpen(true);
  };

  const handleSaveParsedVerses = (data) => {
    const { segmentIdx } = verseParserContext;
    
    setServiceData(prev => {
      const updated = { ...prev };
      const segment = updated.segments[segmentIdx];
      
      // Save to BOTH root and data object for maximum compatibility with viewers
      updated.segments[segmentIdx] = {
        ...segment,
        // Update root property if it exists there
        parsed_verse_data: data.parsed_data,
        // Ensure data object exists and update it there too (for PublicProgramView compatibility)
        data: {
          ...(segment.data || {}),
          parsed_verse_data: data.parsed_data,
          // Sync verse text too just in case
          verse: segment.verse || segment.data?.verse
        }
      };
      
      return updated;
    });
    
    setVerseParserOpen(false);
    setVerseParserContext({ segmentIdx: null });
  };

  const calculateTotalTime = () => {
    const total = serviceData.segments.reduce((sum, seg) => sum + (seg.duration || 0), 0);
    if (!serviceData.time) return { total, endTime: "N/A" };
    
    const startTime = parse(serviceData.time, "HH:mm", new Date());
    const endTime = addMinutes(startTime, total);
    
    return {
      total,
      endTime: format(endTime, "h:mm a")
    };
  };

  const timeCalc = calculateTotalTime();

  // Helper to sync Service JSON to Session/Segment Entities
  const syncToSession = async (serviceResult) => {
    if (!serviceResult || !serviceResult.id) return;
    
    console.log('[SYNC] Starting sync to Session entities...');
    const serviceId = serviceResult.id;
    
    // 1. Find or Create Session
    let session = null;
    const existingSessions = await base44.entities.Session.filter({ service_id: serviceId });
    
    if (existingSessions.length > 0) {
      session = existingSessions[0];
      // Update session details if needed
      if (session.name !== serviceResult.name || session.date !== serviceResult.date || session.location !== serviceResult.location) {
         await base44.entities.Session.update(session.id, {
           name: serviceResult.name,
           date: serviceResult.date,
           location: serviceResult.location,
           planned_start_time: serviceResult.time
         });
      }
    } else {
      session = await base44.entities.Session.create({
        service_id: serviceId,
        name: serviceResult.name,
        date: serviceResult.date,
        location: serviceResult.location,
        planned_start_time: serviceResult.time,
        live_adjustment_enabled: false
      });
    }
    
    // 2. Sync Segments
    // We delete all existing segments for this session and recreate them to ensure order and content match perfectly.
    // NOTE: This resets "Live" status if it was active. This is a tradeoff for the Builder.
    const existingSegments = await base44.entities.Segment.filter({ session_id: session.id });
    if (existingSegments.length > 0) {
      // Parallel delete
      await Promise.all(existingSegments.map(s => base44.entities.Segment.delete(s.id)));
    }
    
    // 3. Create new Segments
    const newSegments = [];
    let currentTime = parse(serviceResult.time, "HH:mm", new Date());
    
    for (let i = 0; i < serviceData.segments.length; i++) {
      const segData = serviceData.segments[i];
      // Use helper to get data (prioritizes data object, falls back to root)
      const getData = (field) => getSegmentData(segData, field);
      
      const duration = segData.duration || 0;
      
      const startTimeStr = format(currentTime, "HH:mm");
      currentTime = addMinutes(currentTime, duration);
      const endTimeStr = format(currentTime, "HH:mm");
      
      // Flatten songs
      const flatSongs = {};
      const songs = getData('songs');
      if (songs && Array.isArray(songs)) {
        songs.forEach((song, idx) => {
          if (idx < 6) {
            flatSongs[`song_${idx+1}_title`] = song.title;
            flatSongs[`song_${idx+1}_lead`] = song.lead;
            flatSongs[`song_${idx+1}_key`] = song.key;
          }
        });
      }

      newSegments.push({
        session_id: session.id,
        service_id: serviceId,
        order: i + 1,
        title: segData.title,
        segment_type: segData.type || 'Especial',
        start_time: startTimeStr,
        end_time: endTimeStr,
        duration_min: duration,
        presenter: getData('presenter'),
        translator_name: getData('translator'), // Mapping translator
        description_details: getData('description_details') || getData('description'),
        // Map notes
        coordinator_notes: getData('coordinator_notes'),
        projection_notes: getData('projection_notes'),
        sound_notes: getData('sound_notes'),
        ushers_notes: getData('ushers_notes'),
        translation_notes: getData('translation_notes'),
        stage_decor_notes: getData('stage_decor_notes'),
        // Map specific fields
        message_title: getData('messageTitle'),
        scripture_references: getData('verse'),
        parsed_verse_data: getData('parsed_verse_data'),
        // Songs
        ...flatSongs,
        // Actions
        segment_actions: getData('actions'),
        // Flags
        requires_translation: !!getData('translator'),
        show_in_general: true
      });
    }
    
    // Batch create if possible, or sequential
    // Segment.create doesn't support bulk in standard SDK usually, check instructions?
    // Instructions say: create_entity_records tool supports bulk. SDK?
    // SDK: base44.entities.Todo.bulkCreate([...])
    await base44.entities.Segment.bulkCreate(newSegments);
    console.log('[SYNC] Completed sync to Session/Segments');
  };

  const activePrintSettingsPage1 = printSettingsPage1 || {
    globalScale: 1.0,
    margins: { top: "0.5in", right: "0.5in", bottom: "0.5in", left: "0.5in" },
    bodyFontScale: 1.0,
    titleFontScale: 1.0
  };

  const activePrintSettingsPage2 = printSettingsPage2 || {
    globalScale: 1.0,
    margins: { top: "0.5in", right: "0.5in", bottom: "0.5in", left: "0.5in" },
    bodyFontScale: 1.0,
    titleFontScale: 1.0
  };

  // Fetch announcements for print
  const { data: allAnnouncements = [] } = useQuery({
    queryKey: ['allAnnouncements'],
    queryFn: () => base44.entities.AnnouncementItem.list('priority'),
  });

  const selectedAnnouncementsForPrint = allAnnouncements.filter(a => 
    serviceData.selected_announcements?.includes(a.id)
  );
  const selectedFixed = selectedAnnouncementsForPrint.filter(a => a.category === 'General');
  const selectedDynamic = selectedAnnouncementsForPrint.filter(a => a.category !== 'General' || a.isEvent);

  return (
    <div className="p-6 md:p-8 space-y-8 print:p-0">
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
            font-size: calc(18pt * ${activePrintSettingsPage1.titleFontScale});
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
            color: #4b5563;
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

          .print-name-blue {
            color: #2563eb;
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

          .print-note-general-info {
            background-color: #f0fdf4 !important;
            border-left: 4pt solid #16a34a !important;
            color: #14532d !important;
            font-size: 10pt;
            margin-top: 4pt;
            padding: 4pt 8pt;
            font-style: italic;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .print-note-projection-team {
            border-left: 3pt solid #2563eb;
            background-color: transparent;
            color: #1e40af;
            font-size: 9pt;
            margin-top: 4pt;
            padding: 2pt 6pt;
          }

          .print-note-sound-team {
            border-left: 3pt solid #dc2626;
            background-color: transparent;
            color: #991b1b;
            font-size: 9pt;
            margin-top: 4pt;
            padding: 2pt 6pt;
          }

          .print-note-ushers-team {
            border-left: 3pt solid #16a34a;
            background-color: transparent;
            color: #14532d;
            font-size: 9pt;
            margin-top: 4pt;
            padding: 2pt 6pt;
          }

          .print-note-translation-team {
            border-left: 3pt solid #9333ea;
            background-color: transparent;
            color: #581c87;
            font-size: 9pt;
            margin-top: 4pt;
            padding: 2pt 6pt;
          }

          .print-note-stage-team {
            border-left: 3pt solid #c026d3;
            background-color: transparent;
            color: #701a75;
            font-size: 9pt;
            margin-top: 4pt;
            padding: 2pt 6pt;
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

          .print-announcements {
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
            font-size: calc(18pt * ${activePrintSettingsPage2.titleFontScale});
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

          .print-announcement-title {
            font-size: calc(10pt * ${activePrintSettingsPage2.titleFontScale});
            font-weight: 600;
            color: #000000;
            text-transform: uppercase;
            letter-spacing: 0.25px;
            display: block;
            line-height: 1.25;
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

          .print-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            width: 100%;
            height: 20pt;
            background: linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%) !important;
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
      {/* Header */}
      <div className="flex justify-between items-center print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(createPageUrl('CustomServicesManager'))}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-5xl font-bold text-gray-900 uppercase tracking-tight font-['Bebas_Neue']">
              {serviceId ? 'Editar Servicio' : 'Nuevo Servicio Personalizado'}
            </h1>
            <p className="text-gray-500 mt-1">Crea servicios especiales con horarios y elementos personalizados</p>
            {/* Last Updated & Status Indicators */}
            <div className="flex items-center gap-3 mt-2">
              {existingService?.updated_date && (
                <Badge variant="outline" className="text-xs bg-green-50 border-green-200 text-green-700">
                  Última actualización: {new Date(existingService.updated_date).toLocaleString('es-ES', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'America/New_York'
                  })}
                </Badge>
              )}
              {hasUnsavedChanges && (
                <Badge className="text-xs bg-yellow-500 text-white animate-pulse">
                  Cambios sin guardar
                </Badge>
              )}
              {autoSaveStatus === "saving" && (
                <Badge variant="outline" className="text-xs bg-blue-50 border-blue-200 text-blue-700">
                  Guardando automáticamente...
                </Badge>
              )}
              {autoSaveStatus === "saved" && !hasUnsavedChanges && (
                <Badge variant="outline" className="text-xs bg-green-50 border-green-200 text-green-700">
                  ✓ Auto-guardado
                </Badge>
              )}
              {autoSaveStatus === "error" && (
                <Badge variant="outline" className="text-xs bg-red-50 border-red-200 text-red-700">
                  ⚠ Error al guardar
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            disabled={saveServiceMutation.isPending}
            style={tealStyle}
            className="font-semibold"
          >
            <Save className="w-5 h-5 mr-2" />
            {saveServiceMutation.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowPrintSettings(true)}
            title="Ajustes de Impresión"
            className="border-2 border-gray-400"
          >
            <Settings className="w-5 h-5" />
          </Button>
          <Button
            variant="outline"
            onClick={handlePrintProgram}
            title="Imprimir Programa"
            className="border-2 border-gray-400 gap-2"
          >
            <Printer className="w-4 h-4" />
            Programa
          </Button>
          <Button
            variant="outline"
            onClick={handlePrintAnnouncements}
            title="Imprimir Anuncios"
            className="border-2 border-gray-400 gap-2"
            disabled={!serviceData.selected_announcements || serviceData.selected_announcements.length === 0}
          >
            <Printer className="w-4 h-4" />
            Anuncios
          </Button>
        </div>
      </div>

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

      {/* Print Layout - Program */}
      <div className={printMode === 'program' ? 'hidden print:block' : 'hidden'}>
        <div className="print-page-1-wrapper">
          <div className="print-header" style={{ position: 'relative' }}>
            <div className="print-logo" style={{ position: 'absolute', left: '0', top: '0' }}>
              <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691b19c064436ea35f171ca3/e75f54157_image.png" alt="Logo" />
            </div>
            <div className="print-title">
              <h1>{serviceData.name || 'Orden de Servicio'}</h1>
              <p>{serviceData.day_of_week} {serviceData.date && formatDateES(new Date(serviceData.date + 'T12:00:00'), "d 'de' MMMM, yyyy", { locale: es })} {serviceData.time && `• ${serviceData.time}`}</p>
              <div className="print-team-info">
                {serviceData.coordinators?.main && (
                  <span><span className="print-team-label">Coordinador:</span> {serviceData.coordinators.main}</span>
                )}
                {serviceData.ujieres?.main && (
                  <>
                    <span style={{ color: '#9ca3af' }}>/</span>
                    <span><span className="print-team-label">Ujier:</span> {serviceData.ujieres.main}</span>
                  </>
                )}
                {serviceData.sound?.main && (
                  <>
                    <span style={{ color: '#9ca3af' }}>/</span>
                    <span><span className="print-team-label">Sonido:</span> {serviceData.sound.main}</span>
                  </>
                )}
                {serviceData.luces?.main && (
                  <>
                    <span style={{ color: '#9ca3af' }}>/</span>
                    <span><span className="print-team-label">Luces:</span> {serviceData.luces.main}</span>
                  </>
                )}
                {serviceData.fotografia?.main && (
                  <>
                    <span style={{ color: '#9ca3af' }}>/</span>
                    <span className="print-team-label">Foto:</span> {serviceData.fotografia.main}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="print-body-content">
            {(() => {
              let currentTime = serviceData.time ? parse(serviceData.time, 'HH:mm', new Date()) : null;

              return serviceData.segments.map((seg, idx) => {
                const startTimeStr = currentTime ? format(currentTime, 'h:mm a') : '';
                if (currentTime && seg.duration) {
                  currentTime = addMinutes(currentTime, seg.duration);
                }

                const getData = (field) => getSegmentData(seg, field);
                const segmentType = seg.type || getData('type') || 'Especial';
                const isWorship = ['Alabanza', 'worship'].includes(segmentType);
                const isMessage = ['Plenaria', 'message', 'Message'].includes(segmentType);
                const isOffering = ['Ofrenda', 'offering'].includes(segmentType);

                const leader = isWorship ? getData('leader') : null;
                const preacher = isMessage ? getData('preacher') : null;
                const presenter = (!isWorship && !isMessage) ? getData('presenter') : null;

                const translator = getData('translator');
                const songs = isWorship ? (getData('songs') || seg.songs) : null;
                const messageTitle = isMessage ? getData('messageTitle') : null;
                const verse = (isMessage || isOffering) ? getData('verse') : null;
                const description = getData('description');
                const description_details = getData('description_details');
                const coordinator_notes = getData('coordinator_notes');
                const projection_notes = getData('projection_notes');
                const sound_notes = getData('sound_notes');
                const ushers_notes = getData('ushers_notes');

                return (
                  <div key={idx} className="print-segment">
                    <div style={{ marginBottom: '2px', display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                      {segmentType === 'Especial' && (
                        <Sparkles 
                          size={11 * activePrintSettingsPage1.titleFontScale} 
                          color="#f59e0b" 
                          fill="#fef3c7"
                          style={{ marginRight: '6px' }} 
                        />
                      )}
                      <span className="print-segment-title">
                        {startTimeStr && <span className="print-segment-time">{startTimeStr}</span>}
                        {seg.title || 'Sin título'}
                      </span>
                      {seg.duration && <span className="print-duration" style={{ marginLeft: '4px' }}>({seg.duration} min)</span>}
                    </div>

                    {leader && <div className="print-segment-detail">Dirige: <span className="print-name-blue">{leader}</span></div>}
                    {preacher && <div className="print-segment-detail"><span className="print-name-blue">{preacher}</span></div>}
                    {presenter && !leader && !preacher && <div className="print-segment-detail"><span className="print-name-blue">{presenter}</span></div>}
                    {translator && <div className="print-segment-detail print-note-text">🌐 {translator}</div>}

                    {songs && Array.isArray(songs) && songs.filter(s => s.title).length > 0 && (
                      <div className="print-segment-songs">
                        {songs.filter(s => s.title).map((song, sIdx) => (
                          <div key={sIdx}>- {song.title} {song.lead && `(${song.lead})`}</div>
                        ))}
                      </div>
                    )}

                    {messageTitle && <div className="print-segment-detail print-note-text">{messageTitle}</div>}
                    {verse && <div className="print-segment-detail print-note-text">📖 {verse}</div>}
                    {description && <div className="print-note-general-info">{description}</div>}
                    {description_details && (
                      <div className="print-note-general-info">
                        <strong style={{ display: 'block', marginBottom: '2px', color: '#111827', textTransform: 'uppercase', fontSize: '0.9em' }}>📝 Notas Generales:</strong>
                        {description_details}
                      </div>
                    )}

                    {coordinator_notes && <div className="print-note-projection-team"><strong>📋 Coord:</strong> {coordinator_notes}</div>}
                    {projection_notes && <div className="print-note-projection-team"><strong>📽️ Proyección:</strong> {projection_notes}</div>}
                    {sound_notes && <div className="print-note-sound-team"><strong>🔊 Sonido:</strong> {sound_notes}</div>}
                    {ushers_notes && <div className="print-note-ushers-team"><strong>🤝 Ujieres:</strong> {ushers_notes}</div>}
                  </div>
                );
              });
            })()}
          </div>
        </div>
        <div className="print-footer">
          ¡Atrévete a cambiar!
        </div>
      </div>

      {/* Print Layout - Announcements ONLY */}
      {printMode === 'announcements' && (
        <div className="hidden print:block" style={{ pageBreakAfter: 'auto' }}>
          <div className="print-page-2-wrapper">
            <div className="print-announcements">
              {/* Header */}
              <div className="print-announcements-header" style={{ position: 'relative' }}>
                <div className="print-announcements-logo" style={{ position: 'absolute', left: '0', top: '0' }}>
                  <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691b19c064436ea35f171ca3/e75f54157_image.png" alt="Logo" />
                </div>
                <div style={{ textAlign: 'center', paddingLeft: '0', paddingRight: '0' }}>
                  <div className="print-announcements-title">ANUNCIOS</div>
                  <p>{serviceData.day_of_week} {serviceData.date && formatDateES(new Date(serviceData.date + 'T12:00:00'), "d 'de' MMMM, yyyy", { locale: es })}</p>
                </div>
              </div>

              {/* Two Column Body */}
              <div className="print-announcements-body">
                <div className="print-announcement-list">
                  {/* Left Column: Fixed */}
                  <div className="print-announcements-column-left">
                    {selectedFixed.length > 0 && selectedFixed.map((ann) => {
                      const sanitize = (html) => {
                        if (!html) return '';
                        return html.replace(/<(?!\/?(b|i|strong|em|br)\b)[^>]*>/gi, '').replace(/&nbsp;/g, ' ');
                      };
                      return (
                        <div key={ann.id} className="print-announcement-item">
                          <div className="print-announcement-title">{ann.title}</div>
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
                          {ann.has_video && (
                            <div style={{ fontSize: '8pt', color: '#8b5cf6', marginTop: '2pt' }}>📹 Video</div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Right Column: Dynamic */}
                  <div className="print-events-column-right">
                    {selectedDynamic.length > 0 && (
                      <>
                        <div className="print-events-header">Próximos Eventos</div>
                        {selectedDynamic.map((ann) => {
                          const sanitize = (html) => {
                            if (!html) return '';
                            return html.replace(/<(?!\/?(b|i|strong|em|br)\b)[^>]*>/gi, '').replace(/&nbsp;/g, ' ');
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
                              {(ann.has_video || ann.announcement_has_video) && (
                                <div style={{ fontSize: '8pt', color: '#8b5cf6', marginTop: '2pt' }}>📹 Video</div>
                              )}
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="print-footer">
            ¡Atrévete a cambiar!
          </div>
        </div>
      )}

      {/* Screen UI */}
      {/* Service Details */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Detalles del Servicio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre del Servicio *</Label>
              <Input
                value={serviceData.name}
                onChange={(e) => setServiceData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ej. Servicio Especial de Navidad"
                required
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha *</Label>
              <DatePicker
                value={serviceData.date}
                onChange={(val) => setServiceData(prev => ({ ...prev, date: val }))}
                placeholder="Seleccionar fecha"
                required
                className="w-full max-w-full"
              />
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Día de la Semana (auto)</Label>
              <Input
                value={serviceData.day_of_week}
                disabled
                className="bg-gray-50"
              />
            </div>
            <div className="space-y-2">
              <Label>Hora *</Label>
              <TimePicker
                value={serviceData.time}
                onChange={(val) => setServiceData(prev => ({ ...prev, time: val }))}
                placeholder="Seleccionar hora"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Ubicación</Label>
              <Input
                value={serviceData.location}
                onChange={(e) => setServiceData(prev => ({ ...prev, location: e.target.value }))}
                placeholder="Santuario principal"
              />
            </div>
            </div>
          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea
              value={serviceData.description}
              onChange={(e) => setServiceData(prev => ({ ...prev, description: e.target.value }))}
              rows={2}
              placeholder="Descripción breve del servicio..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Service Timeline */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 uppercase">Programa del Servicio</h2>
            <div className="flex items-center gap-3 mt-2">
              <Badge variant="outline" className="bg-blue-50">
                {timeCalc.total} min total
              </Badge>
              <span className="text-sm text-gray-600">
                Termina: {timeCalc.endTime}
              </span>
            </div>
          </div>
          <Button
            onClick={addSegment}
            style={tealStyle}
            className="print:hidden"
          >
            <Plus className="w-4 h-4 mr-2" />
            Añadir Segmento
          </Button>
        </div>

        <AnimatePresence>
          <div className="space-y-3">
            {serviceData.segments.map((segment, idx) => {
              const isExpanded = expandedSegments[idx];
              const isSpecial = segment.type === "Especial";
              // Use stable ID for key to prevent re-mounting on title change (which causes focus loss)
              const segmentId = segment._uiId || `seg-${idx}`; 
              
              return (
                <AnimatedSortableItem
                  key={segmentId}
                  id={segmentId}
                  isHighlighted={highlightedSegmentId === segmentId}
                >
                  <Card
                    className={`border-l-4 ${isSpecial ? 'border-l-orange-500 bg-orange-50' : 'border-l-pdv-teal'}`}
                  >
                <CardHeader className="pb-2 bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex flex-col gap-1 print:hidden">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 p-0"
                        onClick={() => moveSegmentUp(idx)}
                        disabled={idx === 0}
                      >
                        <ArrowUp className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 p-0"
                        onClick={() => moveSegmentDown(idx)}
                        disabled={idx === serviceData.segments.length - 1}
                      >
                        <ArrowDown className="w-3 h-3" />
                      </Button>
                    </div>
                              {isSpecial ? <Sparkles className="w-4 h-4 text-orange-600" /> : <Clock className="w-4 h-4 text-pdv-teal" />}
                              <Input
                                value={segment.title}
                                onChange={(e) => updateSegmentField(idx, 'title', e.target.value)}
                                className="text-lg font-bold border-0 shadow-none p-0 h-auto focus-visible:ring-0 flex-1"
                                placeholder="Título del segmento"
                              />
                              <Badge variant="outline" className="text-xs">{segment.duration} min</Badge>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => removeSegment(idx)}
                                className="print:hidden"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                            <div className="print:hidden">
                              <Select 
                                value={segment.type} 
                                onValueChange={(value) => {
                                  updateSegmentField(idx, 'type', value);
                                  // Initialize songs if switching to Alabanza and songs are missing
                                  if ((value === 'Alabanza' || value === 'worship') && (!segment.songs || segment.songs.length === 0)) {
                                    const defaultSongs = [
                                      { title: "", lead: "", key: "" },
                                      { title: "", lead: "", key: "" },
                                      { title: "", lead: "", key: "" },
                                      { title: "", lead: "", key: "" }
                                    ];
                                    updateSegmentField(idx, 'songs', defaultSongs);
                                  }
                                }}
                              >
                                <SelectTrigger className="w-48">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Alabanza">Alabanza</SelectItem>
                                  <SelectItem value="Plenaria">Plenaria (Mensaje)</SelectItem>
                                  <SelectItem value="Bienvenida">Bienvenida</SelectItem>
                                  <SelectItem value="Ofrenda">Ofrenda</SelectItem>
                                  <SelectItem value="Anuncio">Anuncio</SelectItem>
                                  <SelectItem value="Video">Video</SelectItem>
                                  <SelectItem value="Dinámica">Dinámica</SelectItem>
                                  <SelectItem value="Oración">Oración</SelectItem>
                                  <SelectItem value="Ministración">Ministración</SelectItem>
                                  <SelectItem value="Cierre">Cierre</SelectItem>
                                  <SelectItem value="Especial">Especial</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2 pt-3">
                            {/* Worship fields */}
                            {(segment.type === 'Alabanza' || segment.type === 'worship') && (
                              <>
                                <div className="grid md:grid-cols-2 gap-2">
                                  <div className="space-y-2">
                                    <Label className="text-xs">Líder / Director</Label>
                                    <AutocompleteInput
                                      type="leader"
                                      value={segment.leader}
                                      onChange={(e) => updateSegmentField(idx, 'leader', e.target.value)}
                                      placeholder="Nombre del líder"
                                      className="text-sm"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs">Traductor</Label>
                                    <AutocompleteInput
                                      type="translator"
                                      value={segment.translator}
                                      onChange={(e) => updateSegmentField(idx, 'translator', e.target.value)}
                                      placeholder="Nombre del traductor"
                                      className="text-sm"
                                    />
                                  </div>
                                </div>
                                {segment.songs && segment.songs.length > 0 && (
                                  <div className="space-y-1">
                                    <Label className="text-xs font-semibold text-pdv-green">Canciones</Label>
                                    {segment.songs.map((song, sIdx) => (
                                      <div key={sIdx} className="grid grid-cols-12 gap-2">
                                        <div className="col-span-6">
                                          <AutocompleteInput
                                            type="songTitle"
                                            placeholder={`Canción ${sIdx + 1}`}
                                            value={song.title}
                                            onChange={(e) => {
                                              const newSongs = [...segment.songs];
                                              newSongs[sIdx].title = e.target.value;
                                              updateSegmentField(idx, 'songs', newSongs);
                                            }}
                                            className="text-xs"
                                          />
                                        </div>
                                        <div className="col-span-4">
                                          <AutocompleteInput
                                            type="leader"
                                            placeholder="Líder"
                                            value={song.lead}
                                            onChange={(e) => {
                                              const newSongs = [...segment.songs];
                                              newSongs[sIdx].lead = e.target.value;
                                              updateSegmentField(idx, 'songs', newSongs);
                                            }}
                                            className="text-xs"
                                          />
                                        </div>
                                        <div className="col-span-2">
                                          <Input
                                            placeholder="Tono"
                                            value={song.key || ""}
                                            onChange={(e) => {
                                              const newSongs = [...segment.songs];
                                              newSongs[sIdx].key = e.target.value;
                                              updateSegmentField(idx, 'songs', newSongs);
                                            }}
                                            className="text-xs h-9"
                                          />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}

                            {/* Message fields */}
                            {(segment.type === 'Plenaria' || segment.type === 'message') && (
                              <>
                                <div className="grid md:grid-cols-2 gap-2">
                                  <div className="space-y-2">
                                    <Label className="text-xs">Predicador</Label>
                                    <AutocompleteInput
                                      type="preacher"
                                      value={segment.preacher}
                                      onChange={(e) => updateSegmentField(idx, 'preacher', e.target.value)}
                                      placeholder="Nombre del predicador"
                                      className="text-sm"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs">Traductor</Label>
                                    <AutocompleteInput
                                      type="translator"
                                      value={segment.translator}
                                      onChange={(e) => updateSegmentField(idx, 'translator', e.target.value)}
                                      placeholder="Nombre del traductor"
                                      className="text-sm"
                                    />
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs">Título del Mensaje</Label>
                                  <AutocompleteInput
                                    type="messageTitle"
                                    value={segment.messageTitle}
                                    onChange={(e) => updateSegmentField(idx, 'messageTitle', e.target.value)}
                                    placeholder="Título del mensaje"
                                    className="text-sm"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs">Verso / Cita Bíblica</Label>
                                  <div className="flex gap-2">
                                    <Input
                                      value={segment.verse}
                                      onChange={(e) => updateSegmentField(idx, 'verse', e.target.value)}
                                      placeholder="Ej. Juan 3:16"
                                      className="text-sm flex-1"
                                    />
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleOpenVerseParser(idx)}
                                      className="border-2 border-pdv-teal text-pdv-teal hover:bg-pdv-teal hover:text-white flex-shrink-0"
                                      title="Analizar versos"
                                    >
                                      <BookOpen className="w-4 h-4" />
                                    </Button>
                                  </div>
                                  {(segment.parsed_verse_data || segment.data?.parsed_verse_data) && (
                                    <Badge variant="outline" className="text-xs bg-green-50 border-green-300 text-green-700 mt-1">
                                      ✓ Analizado ({(segment.parsed_verse_data || segment.data?.parsed_verse_data).sections?.length || 0} elementos)
                                    </Badge>
                                  )}
                                </div>
                              </>
                            )}

                            {/* Welcome fields */}
                            {(segment.type === 'Bienvenida' || segment.type === 'welcome') && (
                              <div className="grid md:grid-cols-2 gap-2">
                                <div className="space-y-2">
                                  <Label className="text-xs">Presentador</Label>
                                  <AutocompleteInput
                                    type="presenter"
                                    value={segment.presenter}
                                    onChange={(e) => updateSegmentField(idx, 'presenter', e.target.value)}
                                    placeholder="Nombre del presentador"
                                    className="text-sm"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs">Traductor</Label>
                                  <AutocompleteInput
                                    type="translator"
                                    value={segment.translator}
                                    onChange={(e) => updateSegmentField(idx, 'translator', e.target.value)}
                                    placeholder="Nombre del traductor"
                                    className="text-sm"
                                  />
                                </div>
                              </div>
                            )}

                            {/* Offering fields */}
                            {(segment.type === 'Ofrenda' || segment.type === 'offering') && (
                              <>
                                <div className="grid md:grid-cols-2 gap-2">
                                  <div className="space-y-2">
                                    <Label className="text-xs">Presentador</Label>
                                    <AutocompleteInput
                                      type="presenter"
                                      value={segment.presenter}
                                      onChange={(e) => updateSegmentField(idx, 'presenter', e.target.value)}
                                      placeholder="Nombre del presentador"
                                      className="text-sm"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs">Traductor</Label>
                                    <AutocompleteInput
                                      type="translator"
                                      value={segment.translator}
                                      onChange={(e) => updateSegmentField(idx, 'translator', e.target.value)}
                                      placeholder="Nombre del traductor"
                                      className="text-sm"
                                    />
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs">Verso / Cita Bíblica</Label>
                                  <Input
                                    value={segment.verse}
                                    onChange={(e) => updateSegmentField(idx, 'verse', e.target.value)}
                                    placeholder="Ej. Malaquías 3:10"
                                    className="text-sm"
                                  />
                                </div>
                              </>
                            )}

                            {/* Special/Generic fields (and others) */}
                            {['Especial', 'Anuncio', 'Video', 'Dinámica', 'Oración', 'Ministración', 'Cierre'].includes(segment.type) && (
                              <div className="grid md:grid-cols-2 gap-2">
                                <div className="space-y-2">
                                  <Label className="text-xs">
                                    {segment.type === 'Ministración' ? 'Ministra' : 'Presentador'}
                                  </Label>
                                  <AutocompleteInput
                                    type="presenter"
                                    value={segment.presenter}
                                    onChange={(e) => updateSegmentField(idx, 'presenter', e.target.value)}
                                    placeholder="Nombre del presentador"
                                    className="text-sm"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs">Traductor</Label>
                                  <AutocompleteInput
                                    type="translator"
                                    value={segment.translator}
                                    onChange={(e) => updateSegmentField(idx, 'translator', e.target.value)}
                                    placeholder="Nombre del traductor"
                                    className="text-sm"
                                  />
                                </div>
                              </div>
                            )}

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleSegmentExpanded(idx)}
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
                                    onChange={(e) => updateSegmentField(idx, 'duration', parseInt(e.target.value) || 0)}
                                    className="text-xs w-24"
                                  />
                                </div>
                                <Textarea
                                  placeholder="Descripción / Notas adicionales..."
                                  value={segment.description}
                                  onChange={(e) => updateSegmentField(idx, 'description', e.target.value)}
                                  className="text-xs"
                                  rows={3}
                                />
                                
                                <div className="grid md:grid-cols-2 gap-3 pt-2">
                                  <div className="space-y-1">
                                    <Label className="text-xs font-semibold text-gray-700">Notas Coordinador</Label>
                                    <Textarea
                                      placeholder="Instrucciones para el coordinador..."
                                      value={segment.coordinator_notes || ""}
                                      onChange={(e) => updateSegmentField(idx, 'coordinator_notes', e.target.value)}
                                      className="text-xs"
                                      rows={2}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs font-semibold text-gray-700">Notas Proyección</Label>
                                    <Textarea
                                      placeholder="Instrucciones para pantallas..."
                                      value={segment.projection_notes || ""}
                                      onChange={(e) => updateSegmentField(idx, 'projection_notes', e.target.value)}
                                      className="text-xs"
                                      rows={2}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs font-semibold text-gray-700">Notas Sonido</Label>
                                    <Textarea
                                      placeholder="Instrucciones para audio..."
                                      value={segment.sound_notes || ""}
                                      onChange={(e) => updateSegmentField(idx, 'sound_notes', e.target.value)}
                                      className="text-xs"
                                      rows={2}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs font-semibold text-gray-700">Notas Ujieres</Label>
                                    <Textarea
                                      placeholder="Instrucciones para ujieres..."
                                      value={segment.ushers_notes || ""}
                                      onChange={(e) => updateSegmentField(idx, 'ushers_notes', e.target.value)}
                                      className="text-xs"
                                      rows={2}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs font-semibold text-gray-700">Notas Traducción</Label>
                                    <Textarea
                                      placeholder="Instrucciones para traducción..."
                                      value={segment.translation_notes || ""}
                                      onChange={(e) => updateSegmentField(idx, 'translation_notes', e.target.value)}
                                      className="text-xs"
                                      rows={2}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs font-semibold text-gray-700">Notas Stage/Decor</Label>
                                    <Textarea
                                      placeholder="Instrucciones para escenario..."
                                      value={segment.stage_decor_notes || ""}
                                      onChange={(e) => updateSegmentField(idx, 'stage_decor_notes', e.target.value)}
                                      className="text-xs"
                                      rows={2}
                                    />
                                  </div>
                                </div>

                                <div className="space-y-1 pt-2">
                                  <Label className="text-xs font-semibold text-gray-700">Notas Generales / Detalles</Label>
                                  <Textarea
                                    placeholder="Detalles adicionales para el programa..."
                                    value={segment.description_details || ""}
                                    onChange={(e) => updateSegmentField(idx, 'description_details', e.target.value)}
                                    className="text-xs"
                                    rows={2}
                                  />
                                </div>
                              </div>
                            )}
                    </CardContent>
                  </Card>
                </AnimatedSortableItem>
              );
            })}
          </div>
        </AnimatePresence>

        {serviceData.segments.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>No hay segmentos añadidos. Haz clic en "Añadir Segmento" para comenzar.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Announcements Section */}
      <AnnouncementListSelector
        selectedAnnouncementIds={serviceData.selected_announcements}
        onSelectionChange={(newSelection) => setServiceData(prev => ({ ...prev, selected_announcements: newSelection }))}
        serviceDate={serviceData.date}
      />

      {/* Team Section */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Equipo del Servicio</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Coordinador(a)</Label>
            <AutocompleteInput
              type="presenter"
              value={serviceData.coordinators?.main || ""}
              onChange={(e) => setServiceData(prev => ({ ...prev, coordinators: { ...prev.coordinators, main: e.target.value } }))}
              placeholder="Nombre del coordinador"
            />
          </div>
          <div className="space-y-2">
            <Label>Ujieres</Label>
            <AutocompleteInput
              type="ujieres"
              value={serviceData.ujieres?.main || ""}
              onChange={(e) => setServiceData(prev => ({ ...prev, ujieres: { ...prev.ujieres, main: e.target.value } }))}
              placeholder="Nombres de ujieres"
            />
          </div>
          <div className="space-y-2">
            <Label>Sonido</Label>
            <AutocompleteInput
              type="sound"
              value={serviceData.sound?.main || ""}
              onChange={(e) => setServiceData(prev => ({ ...prev, sound: { ...prev.sound, main: e.target.value } }))}
              placeholder="Equipo de sonido"
            />
          </div>
          <div className="space-y-2">
            <Label>Luces/Proyección</Label>
            <AutocompleteInput
              type="tech"
              value={serviceData.luces?.main || ""}
              onChange={(e) => setServiceData(prev => ({ ...prev, luces: { ...prev.luces, main: e.target.value } }))}
              placeholder="Equipo de luces"
            />
          </div>
          <div className="space-y-2">
            <Label>Fotografía</Label>
            <AutocompleteInput
              type="tech"
              value={serviceData.fotografia?.main || ""}
              onChange={(e) => setServiceData(prev => ({ ...prev, fotografia: { ...prev.fotografia, main: e.target.value } }))}
              placeholder="Equipo de fotografía"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
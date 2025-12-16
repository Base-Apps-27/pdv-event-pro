import React, { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Clock, Plus, Trash2, Printer, Copy, Edit, Sparkles, ChevronUp, ChevronDown, GripVertical, Loader2, ArrowRight, ChevronsRight } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { addMinutes, parse, format as formatDate } from "date-fns";
import { es } from "date-fns/locale";
import AutocompleteInput from "@/components/ui/AutocompleteInput";

export default function WeeklyServiceManager() {
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
    date_of_occurrence: ""
  });
  const [expandedSegments, setExpandedSegments] = useState({});
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [savingField, setSavingField] = useState(null);
  
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
        ]
      },
      { type: "welcome", title: "Bienvenida y Anuncios", duration: 5, fields: ["presenter", "translator"], actions: [] },
      { 
        type: "offering", 
        title: "Ofrendas", 
        duration: 5, 
        fields: ["presenter", "verse", "translator"],
        actions: [
          { label: "Enviar texto: 844-555-5555", timing: "after_start", offset_min: 0, department: "Admin" }
        ]
      },
      { 
        type: "message", 
        title: "Mensaje", 
        duration: 45, 
        fields: ["preacher", "title", "verse", "translator"],
        actions: [
          { label: "Pianista sube", timing: "before_end", offset_min: 15, department: "Alabanza" },
          { label: "Equipo de A&A sube", timing: "before_end", offset_min: 5, department: "Alabanza" }
        ]
      }
    ]
  };

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
      console.log('About to save:', data);
      if (existingData?.id) {
        return await base44.entities.Service.update(existingData.id, data);
      } else {
        return await base44.entities.Service.create(data);
      }
    },
    onSuccess: (result) => {
      console.log('Save successful:', result);
      // Don't invalidate queries to prevent refetch clearing state
    },
    onError: (error) => {
      console.error('Error saving service:', error);
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
      console.error('Delete error:', error);
      alert('Error al eliminar: ' + (error.message || JSON.stringify(error)));
    }
  });

  // Initialize service data
  useEffect(() => {
    if (existingData) {
      const loadedData = {
        ...existingData,
        pre_service_notes: existingData.pre_service_notes || { "9:30am": "", "11:30am": "" },
        receso_notes: existingData.receso_notes || { "9:30am": "" },
        selected_announcements: existingData.selected_announcements || []
      };
      setServiceData(loadedData);
      setSelectedAnnouncements(existingData.selected_announcements || []);
    } else {
      const initialData = {
        date: selectedDate,
        "9:30am": BLUEPRINT["9:30am"].map(seg => ({
          ...seg,
          data: {},
          actions: seg.actions || [],
          songs: seg.type === "worship" ? [
            { title: "", lead: "" },
            { title: "", lead: "" },
            { title: "", lead: "" },
            { title: "", lead: "" }
          ] : undefined
        })),
        "11:30am": BLUEPRINT["11:30am"].map(seg => ({
          ...seg,
          data: {},
          actions: seg.actions || [],
          songs: seg.type === "worship" ? [
            { title: "", lead: "" },
            { title: "", lead: "" },
            { title: "", lead: "" },
            { title: "", lead: "" }
          ] : undefined
        })),
        coordinators: { "9:30am": "", "11:30am": "" },
        ujieres: { "9:30am": "", "11:30am": "" },
        sound: { "9:30am": "", "11:30am": "" },
        luces: { "9:30am": "", "11:30am": "" },
        receso_notes: { "9:30am": "" },
        pre_service_notes: { "9:30am": "", "11:30am": "" },
        selected_announcements: []
      };
      setServiceData(initialData);
    }
  }, [existingData]);

  // Auto-select announcements
  useEffect(() => {
    if (!existingData && (fixedAnnouncements.length > 0 || dynamicAnnouncements.length > 0)) {
      const fixed = fixedAnnouncements.map(a => a.id);
      const dynamic = dynamicAnnouncements.map(a => a.id);
      setSelectedAnnouncements([...new Set([...fixed, ...dynamic])]);
    }
  }, [dynamicAnnouncements, fixedAnnouncements, existingData]);

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
        selected_announcements: currentData.selected_announcements || selectedAnnouncements,
        day_of_week: 'Sunday',
        name: `Domingo - ${selectedDate}`,
        status: 'active'
      };
      
      console.log('Saving data:', dataToSave);
      
      saveServiceMutation.mutate(dataToSave, {
        onSettled: () => {
          setSavingField(null);
        }
      });
    }, 800);
  }, [selectedDate, selectedAnnouncements, saveServiceMutation]);

  // Update handlers
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
      return updated;
    });
    debouncedSave(`${service}-${segmentIndex}-${field}`);
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
    debouncedSave(`team-${field}-${service}`);
  };

  const handlePrint = () => {
    window.print();
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

  const handleDragEnd = (result, timeSlot) => {
    if (!result.destination) return;
    
    setSavingField('reorder');
    const items = [...serviceData[timeSlot]];
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);
    
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

  const handleAnnouncementSubmit = () => {
    if (editingAnnouncement) {
      updateAnnouncementMutation.mutate({ id: editingAnnouncement.id, data: announcementForm });
    } else {
      createAnnouncementMutation.mutate(announcementForm);
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
      date_of_occurrence: ann.date_of_occurrence || ""
    });
    setShowAnnouncementDialog(true);
  };

  const moveAnnouncementPriority = (ann, direction) => {
    const newPriority = direction === 'up' ? (ann.priority || 10) - 1 : (ann.priority || 10) + 1;
    updateAnnouncementMutation.mutate({
      id: ann.id,
      data: { ...ann, priority: newPriority }
    });
  };

  const toggleSegmentExpanded = (timeSlot, idx) => {
    const key = `${timeSlot}-${idx}`;
    setExpandedSegments(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
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

  return (
    <div className="p-6 md:p-8 space-y-8 print:p-0">
      <style>{`
        @media print {
          @page { size: letter; margin: 0.4in 0.5in; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

          .print-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid #d1d5db;
          }

          .print-logo {
            width: 50px;
            height: 50px;
            background: linear-gradient(135deg, #1F8A70 0%, #8DC63F 100%);
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 20px;
            font-weight: bold;
            flex-shrink: 0;
          }

          .print-title {
            text-align: center;
            flex: 1;
            margin: 0 20px;
          }

          .print-title h1 {
            font-size: 22px;
            font-weight: bold;
            margin: 0 0 2px 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .print-title p {
            font-size: 13px;
            color: #2563eb;
            font-weight: bold;
            margin: 0;
          }

          .print-team-box {
            text-align: right;
            font-size: 10px;
            line-height: 1.4;
            min-width: 140px;
            flex-shrink: 0;
          }

          .print-team-box div {
            margin-bottom: 1px;
          }

          .print-team-label {
            font-weight: bold;
            color: #000;
          }

          .print-two-columns {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 0;
          }

          .print-service-column {
            break-inside: avoid;
          }

          .print-service-time {
            font-size: 18px;
            font-weight: bold;
            color: #dc2626;
            margin-bottom: 6px;
            padding-bottom: 2px;
            border-bottom: 1.5px solid #dc2626;
          }

          .print-service-column.right .print-service-time {
            color: #2563eb;
            border-color: #2563eb;
          }

          .print-segment {
            margin-bottom: 6px;
            padding-bottom: 5px;
            border-bottom: 1px solid #e5e7eb;
            font-size: 9px;
            line-height: 1.3;
          }

          .print-segment-time {
            font-weight: bold;
            color: #dc2626;
            font-size: 12px;
          }

          .print-service-column.right .print-segment-time {
            color: #2563eb;
          }

          .print-segment-title {
            font-weight: bold;
            text-transform: uppercase;
            font-size: 11px;
            margin-left: 4px;
            color: #000;
          }

          .print-segment-detail {
            margin-left: 8px;
            font-size: 8px;
            color: #374151;
            line-height: 1.3;
            margin-top: 2px;
          }

          .print-name {
            color: #8DC63F;
            font-weight: bold;
            font-size: 9px;
          }

          .print-coordinator-actions {
            margin-top: 6px;
            padding: 4px 6px;
            background: #fffbeb;
            border-left: 2px solid #fbbf24;
            border-radius: 2px;
          }

          .print-coordinator-actions strong {
            color: #92400e;
            font-size: 7px;
            display: block;
            margin-bottom: 2px;
          }

          .print-coordinator-actions div {
            margin-left: 10px;
            font-size: 6.5px;
            color: #78350f;
            line-height: 1.3;
          }

          .print-segment-songs {
            margin-left: 8px;
            font-size: 8px;
            line-height: 1.2;
          }

          .print-receso {
            background: #f9fafb;
            padding: 6px;
            margin: 6px 0;
            text-align: center;
            font-size: 9px;
            font-weight: bold;
            color: #6b7280;
            border-top: 1px solid #d1d5db;
            border-bottom: 1px solid #d1d5db;
          }

          .print-announcements {
            break-before: page;
            padding-top: 0;
          }

          .print-announcements-header {
            text-align: center;
            margin-bottom: 16px;
            padding-bottom: 10px;
            border-bottom: 1px solid #d1d5db;
          }

          .print-announcements-title {
            font-size: 22px;
            font-weight: bold;
            text-transform: uppercase;
            margin-bottom: 4px;
            letter-spacing: 0.5px;
          }

          .print-announcement-list {
            padding-left: 30px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }

          .print-announcement-item {
            margin-bottom: 12px;
            padding-bottom: 10px;
            border-bottom: 1px solid #e5e7eb;
            break-inside: avoid;
            font-size: 10px;
            line-height: 1.4;
          }

          .print-announcement-item:last-child {
            border-bottom: none;
          }

          .print-announcement-header {
            display: flex;
            align-items: baseline;
            gap: 8px;
            margin-bottom: 4px;
          }

          .print-announcement-title {
            font-size: 11px;
            font-weight: bold;
            color: #000;
            text-transform: uppercase;
          }

          .print-announcement-date {
            font-size: 9px;
            font-weight: bold;
            color: #2563eb;
          }

          .print-announcement-content {
            font-size: 9px;
            line-height: 1.3;
            color: #374151;
            margin-bottom: 3px;
          }

          .print-announcement-instructions {
            font-size: 8px;
            background: #fef3c7;
            padding: 4px 6px;
            margin-top: 4px;
            font-style: italic;
            border-left: 2px solid #f59e0b;
          }

          .print-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 35px;
            background: linear-gradient(90deg, #1F8A70 0%, #8DC63F 50%, #D9DF32 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 16px;
            font-weight: bold;
            text-transform: lowercase;
          }
        }
      `}</style>

      {/* Print Layout */}
      <div className="hidden print:block">
        <div className="print-header">
          <div className="print-logo">P</div>
          <div className="print-title">
            <h1>ORDEN DE SERVICIO</h1>
            <p>Domingo {formatDate(new Date(selectedDate + 'T12:00:00'), "d 'de' MMMM, yyyy", { locale: es })}</p>
          </div>
          <div className="print-team-box">
            <div><span className="print-team-label">Coordinador(a):</span> {serviceData?.coordinators?.["9:30am"] || serviceData?.coordinators?.["11:30am"] || ""}</div>
            <div><span className="print-team-label">Ujier:</span> {serviceData?.ujieres?.["9:30am"] || serviceData?.ujieres?.["11:30am"] || ""}</div>
            <div><span className="print-team-label">Sonido:</span> {serviceData?.sound?.["9:30am"] || ""}</div>
            <div><span className="print-team-label">Luces:</span> {serviceData?.luces?.["9:30am"] || serviceData?.luces?.["11:30am"] || ""}</div>
          </div>
        </div>

        <div className="print-two-columns">
          <div className="print-service-column left">
            <div className="print-service-time">9:30 a.m.</div>
            {serviceData?.pre_service_notes?.["9:30am"] && (
              <div className="print-segment">
                <div className="print-segment-detail" style={{ fontStyle: 'italic', color: '#6b7280' }}>
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
                    {segment.duration && <span style={{ fontSize: '9px', color: '#6b7280' }}> ({segment.duration} min)</span>}
                  </div>

                  {segment.data?.leader && (
                    <div className="print-segment-detail">
                      <strong>Dir:</strong> <span className="print-name">{segment.data.leader}</span>
                    </div>
                  )}

                  {segment.songs && segment.songs.filter(s => s.title).length > 0 && (
                    <div className="print-segment-songs">
                      {segment.songs.filter(s => s.title).map((song, sIdx) => (
                        <div key={sIdx}>• {song.title} {song.lead && `(${song.lead})`}</div>
                      ))}
                    </div>
                  )}

                  {segment.data?.ministry_leader && (
                    <div className="print-segment-detail" style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px dashed #d1d5db' }}>
                      <strong>Ministración de Sanidad y Milagros</strong><br/>
                      P. <span className="print-name">{segment.data.ministry_leader}</span> (5 min)
                    </div>
                  )}

                  {segment.data?.presenter && (
                    <div className="print-segment-detail">
                      <strong>P:</strong> <span className="print-name">{segment.data.presenter}</span>
                    </div>
                  )}

                  {segment.data?.preacher && (
                    <div className="print-segment-detail">
                      <strong>P:</strong> <span className="print-name">{segment.data.preacher}</span>
                    </div>
                  )}

                  {segment.data?.title && (
                    <div className="print-segment-detail">
                      <em>{segment.data.title}</em>
                    </div>
                  )}

                  {segment.data?.verse && (
                    <div className="print-segment-detail">
                      {segment.data.verse}
                    </div>
                  )}

                  {segment.data?.description && (
                    <div className="print-segment-detail" style={{ fontStyle: 'italic' }}>
                      {segment.data.description}
                    </div>
                  )}

                  {segment.data?.description_details && (
                    <div className="print-segment-detail" style={{ marginTop: '3px', color: '#6b7280' }}>
                      {segment.data.description_details}
                    </div>
                  )}

                  {segment.data?.projection_notes && (
                    <div className="print-segment-detail" style={{ marginTop: '3px', paddingTop: '3px', borderTop: '1px dashed #e5e7eb' }}>
                      <strong>📽️ Proyección:</strong> {segment.data.projection_notes}
                    </div>
                  )}

                  {segment.data?.sound_notes && (
                    <div className="print-segment-detail" style={{ marginTop: '2px' }}>
                      <strong>🔊 Sonido:</strong> {segment.data.sound_notes}
                    </div>
                  )}

                  {segment.actions && segment.actions.length > 0 && (
                    <div className="print-coordinator-actions">
                      <strong>⏰ Acciones:</strong>
                      {segment.actions.map((action, aIdx) => (
                        <div key={aIdx}>
                          • {action.label}
                          {action.timing === "before_end" && ` (${action.offset_min} min antes)`}
                          {action.timing === "after_start" && action.offset_min > 0 && ` (+${action.offset_min} min)`}
                          {action.timing === "before_start" && ` (antes)`}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="print-receso">
              11:00am a 11:30am - RECESO
            </div>
          </div>

          <div className="print-service-column right">
            <div className="print-service-time">11:30 a.m.</div>
            {serviceData?.pre_service_notes?.["11:30am"] && (
              <div className="print-segment">
                <div className="print-segment-detail" style={{ fontStyle: 'italic', color: '#6b7280' }}>
                  {serviceData.pre_service_notes["11:30am"]}
                </div>
              </div>
            )}
            {serviceData?.["11:30am"]?.map((segment, idx) => {
              let currentTime = parse("11:30am", "h:mma", new Date());
              for (let i = 0; i < idx; i++) {
                if (serviceData["11:30am"][i].type !== 'break' && serviceData["11:30am"][i].type !== 'ministry') {
                  currentTime = addMinutes(currentTime, serviceData["11:30am"][i].duration || 0);
                }
              }
              const segmentTime = formatDate(currentTime, "h:mm a");

              return (
                <div key={idx} className="print-segment">
                  <div>
                    <span className="print-segment-time">{segmentTime}</span>
                    <span className="print-segment-title">{segment.title}</span>
                    {segment.duration && <span style={{ fontSize: '9px', color: '#6b7280' }}> ({segment.duration} min)</span>}
                  </div>

                  {segment.data?.leader && (
                    <div className="print-segment-detail">
                      <strong>Dir:</strong> <span className="print-name">{segment.data.leader}</span>
                    </div>
                  )}

                  {segment.songs && segment.songs.filter(s => s.title).length > 0 && (
                    <div className="print-segment-songs">
                      {segment.songs.filter(s => s.title).map((song, sIdx) => (
                        <div key={sIdx}>• {song.title} {song.lead && `(${song.lead})`}</div>
                      ))}
                    </div>
                  )}

                  {segment.data?.ministry_leader && (
                    <div className="print-segment-detail" style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px dashed #d1d5db' }}>
                      <strong>Ministración de Sanidad y Milagros</strong><br/>
                      P. {segment.data.ministry_leader} (5 min)
                    </div>
                  )}

                  {segment.actions && segment.actions.length > 0 && (
                    <div className="print-segment-detail" style={{ marginTop: '3px', paddingTop: '3px', borderTop: '1px dashed #e5e7eb', background: '#fef3c7', padding: '3px 5px', borderRadius: '2px' }}>
                      <strong style={{ color: '#92400e' }}>⏰ Acciones:</strong>
                      {segment.actions.map((action, aIdx) => (
                        <div key={aIdx} style={{ marginLeft: '8px', fontSize: '7px', color: '#92400e' }}>
                          • {action.label}
                          {action.timing === "before_end" && ` (${action.offset_min} min antes de terminar)`}
                          {action.timing === "after_start" && action.offset_min > 0 && ` (${action.offset_min} min después)`}
                          {action.timing === "before_start" && ` (antes de iniciar)`}
                        </div>
                      ))}
                    </div>
                  )}

                  {segment.data?.translator && (
                    <div className="print-segment-detail" style={{ color: '#2563eb' }}>
                      <strong>🌐 Trad:</strong> <span className="print-name">{segment.data.translator}</span>
                    </div>
                  )}

                  {segment.data?.presenter && (
                    <div className="print-segment-detail">
                      <strong>P:</strong> {segment.data.presenter}
                    </div>
                  )}

                  {segment.data?.preacher && (
                    <div className="print-segment-detail">
                      <strong>P:</strong> {segment.data.preacher}
                    </div>
                  )}

                  {segment.data?.title && (
                    <div className="print-segment-detail">
                      <em>{segment.data.title}</em>
                    </div>
                  )}

                  {segment.data?.verse && (
                    <div className="print-segment-detail">
                      {segment.data.verse}
                    </div>
                  )}

                  {segment.data?.description && (
                    <div className="print-segment-detail" style={{ fontStyle: 'italic' }}>
                      {segment.data.description}
                    </div>
                  )}

                  {segment.data?.description_details && (
                    <div className="print-segment-detail" style={{ marginTop: '3px', color: '#6b7280' }}>
                      {segment.data.description_details}
                    </div>
                  )}

                  {segment.data?.projection_notes && (
                    <div className="print-segment-detail" style={{ marginTop: '3px', paddingTop: '3px', borderTop: '1px dashed #e5e7eb' }}>
                      <strong>📽️ Proyección:</strong> {segment.data.projection_notes}
                    </div>
                  )}

                  {segment.data?.sound_notes && (
                    <div className="print-segment-detail" style={{ marginTop: '2px' }}>
                      <strong>🔊 Sonido:</strong> {segment.data.sound_notes}
                    </div>
                  )}

                  {segment.actions && segment.actions.length > 0 && (
                    <div className="print-coordinator-actions">
                      <strong>⏰ Acciones:</strong>
                      {segment.actions.map((action, aIdx) => (
                        <div key={aIdx}>
                          • {action.label}
                          {action.timing === "before_end" && ` (${action.offset_min} min antes)`}
                          {action.timing === "after_start" && action.offset_min > 0 && ` (+${action.offset_min} min)`}
                          {action.timing === "before_start" && ` (antes)`}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="print-announcements">
          <div className="print-announcements-header">
            <div className="print-announcements-title">ANUNCIOS</div>
            <p style={{ fontSize: '13px', color: '#2563eb', fontWeight: 'bold', margin: 0 }}>
              Domingo {formatDate(new Date(selectedDate + 'T12:00:00'), "d 'de' MMMM, yyyy", { locale: es })}
            </p>
          </div>

          <div className="print-announcement-list">
            {[...fixedAnnouncements, ...dynamicAnnouncements]
              .filter(ann => selectedAnnouncements.includes(ann.id))
              .map((ann, idx) => (
                <div key={ann.id} className="print-announcement-item">
                  <div className="print-announcement-header">
                    <span style={{ fontSize: '12px', color: '#999' }}>📢</span>
                    <div className="print-announcement-title">
                      {ann.isEvent ? ann.name : ann.title}
                      {(ann.has_video || ann.announcement_has_video) && ' 📹'}
                    </div>
                    {(ann.date_of_occurrence || ann.start_date) && (
                      <div className="print-announcement-date">
                        {ann.date_of_occurrence || ann.start_date}
                        {ann.end_date && ` - ${ann.end_date}`}
                      </div>
                    )}
                  </div>
                  <div className="print-announcement-content">
                    {ann.isEvent ? (ann.announcement_blurb || ann.description) : ann.content}
                  </div>
                  {ann.instructions && (
                    <div className="print-announcement-instructions">
                      Instrucciones: {ann.instructions}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>

        <div className="print-footer">
          ¡atrévete a cambiar!
        </div>
      </div>

      {/* Screen UI */}
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-5xl font-bold text-gray-900 uppercase tracking-tight font-['Bebas_Neue']">
            Servicios Dominicales
          </h1>
          <p className="text-gray-500 mt-1">Gestión semanal unificada</p>
        </div>
        <div className="flex gap-3 items-center">
          {savingField && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Loader2 className="w-4 h-4 animate-spin text-pdv-teal" />
              <span>Guardando...</span>
            </div>
          )}
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Date Selection */}
      <Card className="print:hidden">
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
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSpecialSegmentDetails(prev => ({ ...prev, timeSlot: "9:30am" }));
                  setShowSpecialDialog(true);
                }}
                className="print:hidden"
              >
                <Plus className="w-4 h-4 mr-2" />
                Especial
              </Button>
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
          <Card className="bg-gray-100 border-gray-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-gray-600">
                <Clock className="w-4 h-4" />
                PRE-SERVICIO
                <Badge variant="outline" className="ml-auto text-xs text-gray-500 border-gray-400">Antes de iniciar</Badge>
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
              <Textarea
                placeholder="Instrucciones pre-servicio (opcional)..."
                value={serviceData.pre_service_notes?.["9:30am"] || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setServiceData(prev => {
                    const updated = {
                      ...prev,
                      pre_service_notes: { 
                        ...prev.pre_service_notes, 
                        "9:30am": value 
                      }
                    };
                    console.log('Updated pre-service 9:30am:', updated.pre_service_notes);
                    return updated;
                  });
                  debouncedSave('pre-service-930');
                }}
                className="text-xs bg-white border-gray-300 text-gray-700 placeholder:text-gray-400"
                rows={2}
              />
            </CardContent>
          </Card>

          <DragDropContext onDragEnd={(result) => handleDragEnd(result, "9:30am")}>
            <Droppable droppableId="9:30am">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                  {serviceData["9:30am"].filter(seg => seg.type !== 'break').map((segment, idx) => {
                    const timeSlot = "9:30am";
                    const isExpanded = expandedSegments[`${timeSlot}-${idx}`];
                    
                    if (segment.type === "special") {
                      return (
                        <Draggable key={`${timeSlot}-special-${idx}`} draggableId={`${timeSlot}-special-${idx}`} index={idx}>
                          {(provided) => (
                            <Card 
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className="border-l-4 border-l-orange-500 bg-orange-50"
                            >
                              <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-lg flex items-center gap-2">
                                    <div {...provided.dragHandleProps} className="print:hidden">
                                      <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
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
                                <Textarea
                                  placeholder="Descripción / Notas"
                                  value={segment.data?.description || ""}
                                  onChange={(e) => updateSegmentField(timeSlot, idx, "description", e.target.value)}
                                  className="text-sm"
                                  rows={2}
                                />
                              </CardContent>
                            </Card>
                          )}
                        </Draggable>
                      );
                    }

                    return (
                      <Draggable key={`${timeSlot}-${idx}`} draggableId={`${timeSlot}-${idx}`} index={idx}>
                        {(provided) => (
                          <Card 
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className="border-l-4 border-l-red-500"
                          >
                            <CardHeader className="pb-2 bg-gray-50">
                              <CardTitle className="text-lg flex items-center gap-2">
                                <div {...provided.dragHandleProps} className="print:hidden touch-none p-1 -m-1 active:bg-gray-200 rounded">
                                  <GripVertical className="w-6 h-6 md:w-4 md:h-4 text-gray-400 cursor-grab" />
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
                                <AutocompleteInput
                                  type="worshipLeader"
                                  placeholder="Líder / Director"
                                  value={segment.data?.leader || ""}
                                  onChange={(e) => updateSegmentField("9:30am", idx, "leader", e.target.value)}
                                  className="text-sm"
                                />
                              )}
                              {segment.fields.includes("presenter") && (
                                <AutocompleteInput
                                  type="presenter"
                                  placeholder="Presentador"
                                  value={segment.data?.presenter || ""}
                                  onChange={(e) => updateSegmentField("9:30am", idx, "presenter", e.target.value)}
                                  className="text-sm"
                                />
                              )}
                              {segment.fields.includes("preacher") && (
                                <AutocompleteInput
                                  type="preacher"
                                  placeholder="Predicador"
                                  value={segment.data?.preacher || ""}
                                  onChange={(e) => updateSegmentField("9:30am", idx, "preacher", e.target.value)}
                                  className="text-sm"
                                />
                              )}
                              {segment.fields.includes("title") && (
                                <Input
                                  placeholder="Título del Mensaje"
                                  value={segment.data?.title || ""}
                                  onChange={(e) => updateSegmentField("9:30am", idx, "title", e.target.value)}
                                  className="text-sm"
                                />
                              )}
                              {segment.fields.includes("verse") && (
                                <Input
                                  placeholder="Verso / Cita Bíblica"
                                  value={segment.data?.verse || ""}
                                  onChange={(e) => updateSegmentField("9:30am", idx, "verse", e.target.value)}
                                  className="text-sm"
                                />
                              )}
                              {segment.songs && (
                                <div className="space-y-1">
                                  <Label className="text-xs font-semibold text-pdv-green">Canciones</Label>
                                  {segment.songs.map((song, sIdx) => (
                                    <div key={sIdx} className="grid grid-cols-2 gap-2">
                                      <AutocompleteInput
                                        type="songTitle"
                                        placeholder={`Canción ${sIdx + 1}`}
                                        value={song.title}
                                        onChange={(e) => {
                                          const newSongs = [...segment.songs];
                                          newSongs[sIdx].title = e.target.value;
                                          updateSegmentField("9:30am", idx, "songs", newSongs);
                                        }}
                                        className="text-xs"
                                      />
                                      <AutocompleteInput
                                        type="worshipLeader"
                                        placeholder="Líder"
                                        value={song.lead}
                                        onChange={(e) => {
                                          const newSongs = [...segment.songs];
                                          newSongs[sIdx].lead = e.target.value;
                                          updateSegmentField("9:30am", idx, "songs", newSongs);
                                        }}
                                        className="text-xs"
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                              {segment.fields.includes("ministry_leader") && (
                                <div className="bg-purple-50 border border-purple-200 rounded p-2">
                                  <Label className="text-xs font-semibold text-purple-800 mb-1">Ministración de Sanidad y Milagros (5 min)</Label>
                                  <AutocompleteInput
                                    type="ministryLeader"
                                    placeholder="Líder de Ministración"
                                    value={segment.data?.ministry_leader || ""}
                                    onChange={(e) => updateSegmentField("9:30am", idx, "ministry_leader", e.target.value)}
                                    className="text-sm"
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
                                            <span>
                                              {action.label} 
                                              {action.timing === "before_end" && ` (${action.offset_min} min antes de terminar)`}
                                              {action.timing === "after_start" && action.offset_min > 0 && ` (${action.offset_min} min después de iniciar)`}
                                              {action.timing === "before_start" && ` (antes de iniciar)`}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

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
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          {/* Receso Block */}
          <Card className="bg-gray-100 border-gray-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-gray-600">
                <Clock className="w-4 h-4" />
                RECESO
                <Badge variant="outline" className="ml-auto text-xs text-gray-500 border-gray-400">30 min</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-2">
              <Textarea
                placeholder="Notas del receso (opcional)..."
                value={serviceData.receso_notes?.["9:30am"] || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setServiceData(prev => {
                    const updated = {
                      ...prev,
                      receso_notes: { 
                        ...prev.receso_notes, 
                        "9:30am": value 
                      }
                    };
                    console.log('Updated receso 9:30am:', updated.receso_notes);
                    return updated;
                  });
                  debouncedSave('receso-930');
                }}
                className="text-xs bg-white border-gray-300 text-gray-700 placeholder:text-gray-400"
                rows={2}
              />
            </CardContent>
          </Card>

          {/* Team Section */}
          <Card className="bg-green-50 border-green-200 print:hidden">
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
              <Input placeholder="Coordinador(a)" value={serviceData.coordinators?.["9:30am"] || ""} onChange={(e) => updateTeamField("coordinators", "9:30am", e.target.value)} className="text-xs" />
              <Input placeholder="Ujieres" value={serviceData.ujieres?.["9:30am"] || ""} onChange={(e) => updateTeamField("ujieres", "9:30am", e.target.value)} className="text-xs" />
              <Input placeholder="Sonido" value={serviceData.sound?.["9:30am"] || ""} onChange={(e) => updateTeamField("sound", "9:30am", e.target.value)} className="text-xs" />
              <Input placeholder="Luces" value={serviceData.luces?.["9:30am"] || ""} onChange={(e) => updateTeamField("luces", "9:30am", e.target.value)} className="text-xs" />
            </CardContent>
          </Card>
        </div>

        {/* 11:30 AM Service */}
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold text-blue-600">11:30 a.m.</h2>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={copy930To1130}
                  className="print:hidden bg-blue-600 hover:bg-blue-700 text-white font-semibold"
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
                  className="print:hidden"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Especial
                </Button>
              </div>
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
          <Card className="bg-gray-100 border-gray-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-gray-600">
                <Clock className="w-4 h-4" />
                PRE-SERVICIO
                <Badge variant="outline" className="ml-auto text-xs text-gray-500 border-gray-400">Antes de iniciar</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-2">
              <Textarea
                placeholder="Instrucciones pre-servicio (opcional)..."
                value={serviceData.pre_service_notes?.["11:30am"] || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setServiceData(prev => {
                    const updated = {
                      ...prev,
                      pre_service_notes: { 
                        ...prev.pre_service_notes, 
                        "11:30am": value 
                      }
                    };
                    console.log('Updated pre-service 11:30am:', updated.pre_service_notes);
                    return updated;
                  });
                  debouncedSave('pre-service-1130');
                }}
                className="text-xs bg-white border-gray-300 text-gray-700 placeholder:text-gray-400"
                rows={2}
              />
            </CardContent>
          </Card>

          <DragDropContext onDragEnd={(result) => handleDragEnd(result, "11:30am")}>
            <Droppable droppableId="11:30am">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                  {serviceData["11:30am"].map((segment, idx) => {
                    const timeSlot = "11:30am";
                    const isExpanded = expandedSegments[`${timeSlot}-${idx}`];
                    
                    if (segment.type === "special") {
                      return (
                        <Draggable key={`${timeSlot}-special-${idx}`} draggableId={`${timeSlot}-special-${idx}`} index={idx}>
                          {(provided) => (
                            <Card 
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className="border-l-4 border-l-orange-500 bg-orange-50"
                            >
                              <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-lg flex items-center gap-2">
                                    <div {...provided.dragHandleProps} className="print:hidden">
                                      <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
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
                              </CardContent>
                            </Card>
                          )}
                        </Draggable>
                      );
                    }

                    return (
                      <Draggable key={`${timeSlot}-${idx}`} draggableId={`${timeSlot}-${idx}`} index={idx}>
                        {(provided) => (
                          <Card 
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className="border-l-4 border-l-blue-500"
                          >
                            <CardHeader className="pb-2 bg-gray-50">
                              <CardTitle className="text-lg flex items-center gap-2">
                                <div {...provided.dragHandleProps} className="print:hidden touch-none p-1 -m-1 active:bg-gray-200 rounded">
                                  <GripVertical className="w-6 h-6 md:w-4 md:h-4 text-gray-400 cursor-grab" />
                                </div>
                                <Clock className="w-4 h-4 text-blue-600" />
                                {segment.title}
                                <Badge variant="outline" className="ml-auto text-xs">{segment.duration} min</Badge>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 pt-3">
                              {segment.fields.includes("leader") && (
                                <AutocompleteInput
                                  type="worshipLeader"
                                  placeholder="Líder / Director"
                                  value={segment.data?.leader || ""}
                                  onChange={(e) => updateSegmentField("11:30am", idx, "leader", e.target.value)}
                                  className="text-sm"
                                />
                              )}
                              {segment.fields.includes("presenter") && (
                                <AutocompleteInput
                                  type="presenter"
                                  placeholder="Presentador"
                                  value={segment.data?.presenter || ""}
                                  onChange={(e) => updateSegmentField("11:30am", idx, "presenter", e.target.value)}
                                  className="text-sm"
                                />
                              )}
                              {segment.fields.includes("preacher") && (
                                <AutocompleteInput
                                  type="preacher"
                                  placeholder="Predicador"
                                  value={segment.data?.preacher || ""}
                                  onChange={(e) => updateSegmentField("11:30am", idx, "preacher", e.target.value)}
                                  className="text-sm"
                                />
                              )}
                              {segment.fields.includes("title") && (
                                <Input
                                  placeholder="Título del Mensaje"
                                  value={segment.data?.title || ""}
                                  onChange={(e) => updateSegmentField("11:30am", idx, "title", e.target.value)}
                                  className="text-sm"
                                />
                              )}
                              {segment.fields.includes("verse") && (
                                <Input
                                  placeholder="Verso / Cita Bíblica"
                                  value={segment.data?.verse || ""}
                                  onChange={(e) => updateSegmentField("11:30am", idx, "verse", e.target.value)}
                                  className="text-sm"
                                />
                              )}
                              {segment.songs && (
                                <div className="space-y-1">
                                  <Label className="text-xs font-semibold text-pdv-green">Canciones</Label>
                                  {segment.songs.map((song, sIdx) => (
                                    <div key={sIdx} className="grid grid-cols-2 gap-2">
                                      <AutocompleteInput
                                        type="songTitle"
                                        placeholder={`Canción ${sIdx + 1}`}
                                        value={song.title}
                                        onChange={(e) => {
                                          const newSongs = [...segment.songs];
                                          newSongs[sIdx].title = e.target.value;
                                          updateSegmentField("11:30am", idx, "songs", newSongs);
                                        }}
                                        className="text-xs"
                                      />
                                      <AutocompleteInput
                                        type="worshipLeader"
                                        placeholder="Líder"
                                        value={song.lead}
                                        onChange={(e) => {
                                          const newSongs = [...segment.songs];
                                          newSongs[sIdx].lead = e.target.value;
                                          updateSegmentField("11:30am", idx, "songs", newSongs);
                                        }}
                                        className="text-xs"
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                              {segment.fields.includes("ministry_leader") && (
                                <div className="bg-purple-50 border border-purple-200 rounded p-2">
                                  <Label className="text-xs font-semibold text-purple-800 mb-1">Ministración de Sanidad y Milagros (5 min)</Label>
                                  <AutocompleteInput
                                    type="ministryLeader"
                                    placeholder="Líder de Ministración"
                                    value={segment.data?.ministry_leader || ""}
                                    onChange={(e) => updateSegmentField("11:30am", idx, "ministry_leader", e.target.value)}
                                    className="text-sm"
                                  />
                                </div>
                              )}
                              {segment.fields.includes("translator") && segment.type === "worship" && (
                                <div className="bg-blue-50 border border-blue-200 rounded p-2">
                                  <Label className="text-xs font-semibold text-blue-800 mb-1">🌐 Traductor(a) - Ministración, Anuncios, Ofrenda</Label>
                                  <AutocompleteInput
                                    type="translator"
                                    placeholder="Nombre del traductor"
                                    value={segment.data?.translator || ""}
                                    onChange={(e) => updateSegmentField("11:30am", idx, "translator", e.target.value)}
                                    className="text-sm"
                                  />
                                </div>
                              )}

                              {segment.fields.includes("translator") && (segment.type === "welcome" || segment.type === "offering") && (
                                <div className="text-xs text-blue-600 italic flex items-center gap-1 mt-1">
                                  🌐 Traductor(a): {segment.data?.translator || serviceData["11:30am"].find(s => s.type === "worship")?.data?.translator || "Por definir"}
                                </div>
                              )}

                              {segment.fields.includes("translator") && segment.type === "message" && (
                                <div className="bg-blue-50 border border-blue-200 rounded p-2">
                                  <Label className="text-xs font-semibold text-blue-800 mb-1">🌐 Traductor(a) del Mensaje</Label>
                                  <AutocompleteInput
                                    type="translator"
                                    placeholder="Nombre del traductor (puede ser el mismo)"
                                    value={segment.data?.translator || ""}
                                    onChange={(e) => updateSegmentField("11:30am", idx, "translator", e.target.value)}
                                    className="text-sm"
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
                                            <span>
                                              {action.label} 
                                              {action.timing === "before_end" && ` (${action.offset_min} min antes de terminar)`}
                                              {action.timing === "after_start" && action.offset_min > 0 && ` (${action.offset_min} min después de iniciar)`}
                                              {action.timing === "before_start" && ` (antes de iniciar)`}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {segment.fields.includes("translator") && (segment.type === "welcome" || segment.type === "offering") && (
                                    <div className="bg-blue-50 border border-blue-200 rounded p-2">
                                      <Label className="text-xs font-semibold text-blue-800 mb-1">🌐 Traductor(a)</Label>
                                      <AutocompleteInput
                                        type="translator"
                                        placeholder="Auto-rellena del segmento de A&A, editable si es diferente"
                                        value={segment.data?.translator || serviceData["11:30am"].find(s => s.type === "worship")?.data?.translator || ""}
                                        onChange={(e) => updateSegmentField("11:30am", idx, "translator", e.target.value)}
                                        className="text-xs"
                                      />
                                    </div>
                                  )}
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
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          {/* Team Section */}
          <Card className="bg-blue-50 border-blue-200 print:hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">EQUIPO 11:30am</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Input placeholder="Coordinador(a)" value={serviceData.coordinators?.["11:30am"] || ""} onChange={(e) => updateTeamField("coordinators", "11:30am", e.target.value)} className="text-xs" />
              <Input placeholder="Ujieres" value={serviceData.ujieres?.["11:30am"] || ""} onChange={(e) => updateTeamField("ujieres", "11:30am", e.target.value)} className="text-xs" />
              <Input placeholder="Sonido" value={serviceData.sound?.["11:30am"] || ""} onChange={(e) => updateTeamField("sound", "11:30am", e.target.value)} className="text-xs" />
              <Input placeholder="Luces" value={serviceData.luces?.["11:30am"] || ""} onChange={(e) => updateTeamField("luces", "11:30am", e.target.value)} className="text-xs" />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Announcements Section */}
      <Card className="print:hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold uppercase">Anuncios</CardTitle>
            <Button
              onClick={() => {
                setEditingAnnouncement(null);
                setAnnouncementForm({ title: "", content: "", instructions: "", category: "General", is_active: true, priority: 10, has_video: false, date_of_occurrence: "" });
                setShowAnnouncementDialog(true);
              }}
              size="sm"
              className="bg-pdv-teal text-white print:hidden"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Anuncio
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Fixed Announcements */}
          <div className="space-y-3">
            <Label className="text-base font-bold text-gray-900">Anuncios Fijos</Label>
            <div className="grid md:grid-cols-2 gap-3">
              {fixedAnnouncements.map(ann => (
                <div key={ann.id} className="flex items-start gap-2 p-3 border-2 rounded-lg bg-white hover:shadow-md transition-shadow">
                  <Checkbox
                    checked={selectedAnnouncements.includes(ann.id)}
                    onCheckedChange={(checked) => {
                      setSelectedAnnouncements(prev => 
                        checked ? [...prev, ann.id] : prev.filter(id => id !== ann.id)
                      );
                      debouncedSave('announcement-selection');
                    }}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-bold text-sm leading-tight">{ann.title}</h3>
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
                      </div>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap mb-2">{ann.content}</p>
                    {ann.instructions && (
                      <div className="bg-amber-50 border border-amber-200 rounded p-2 mt-2">
                        <p className="text-xs text-amber-900 font-semibold mb-1">Instrucciones:</p>
                        <p className="text-xs text-amber-800 whitespace-pre-wrap">{ann.instructions}</p>
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
            <Label className="text-base font-bold text-gray-900">Anuncios Dinámicos</Label>
            <div className="grid md:grid-cols-2 gap-3">
              {dynamicAnnouncements.map(ann => (
                <div key={ann.id} className="flex items-start gap-2 p-3 border-2 rounded-lg bg-blue-50 hover:shadow-md transition-shadow">
                  <Checkbox
                    checked={selectedAnnouncements.includes(ann.id)}
                    onCheckedChange={(checked) => {
                      setSelectedAnnouncements(prev => 
                        checked ? [...prev, ann.id] : prev.filter(id => id !== ann.id)
                      );
                      debouncedSave('announcement-selection');
                    }}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-sm leading-tight">{ann.isEvent ? ann.name : ann.title}</h3>
                          {ann.isEvent && <Badge className="bg-purple-200 text-purple-800 text-[10px]">Evento</Badge>}
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
                      {!ann.isEvent && (
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
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap mb-2">
                      {ann.isEvent ? ann.announcement_blurb || ann.description : ann.content}
                    </p>
                    {ann.instructions && (
                      <div className="bg-amber-50 border border-amber-200 rounded p-2 mt-2">
                        <p className="text-xs text-amber-900 font-semibold mb-1">Instrucciones:</p>
                        <p className="text-xs text-amber-800 whitespace-pre-wrap">{ann.instructions}</p>
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
              <Button onClick={addSpecialSegment} className="bg-pdv-teal text-white w-full sm:w-auto">
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

      {/* Announcement Dialog */}
      <Dialog open={showAnnouncementDialog} onOpenChange={setShowAnnouncementDialog}>
        <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{editingAnnouncement ? "Editar Anuncio" : "Nuevo Anuncio"}</DialogTitle>
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
                  Eliminar
                </Button>
              )}
            </div>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-6 p-3 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={announcementForm.has_video}
                  onCheckedChange={(checked) => setAnnouncementForm(prev => ({ ...prev, has_video: checked }))}
                />
                <Label className="font-semibold">📹 Incluye Video</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={announcementForm.is_active}
                  onCheckedChange={(checked) => setAnnouncementForm(prev => ({ ...prev, is_active: checked }))}
                />
                <Label className="font-semibold">👁️ Visible</Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <select
                className="w-full border rounded-md p-2 text-sm"
                value={announcementForm.category}
                onChange={(e) => setAnnouncementForm(prev => ({ ...prev, category: e.target.value }))}
              >
                <option value="General">General</option>
                <option value="Event">Evento</option>
                <option value="Ministry">Ministerio</option>
                <option value="Urgent">Urgente</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={announcementForm.title}
                onChange={(e) => setAnnouncementForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Título del anuncio"
              />
            </div>
            {announcementForm.category !== "General" && (
              <div className="space-y-2">
                <Label>Fecha de Ocurrencia</Label>
                <Input
                  type="date"
                  value={announcementForm.date_of_occurrence}
                  onChange={(e) => setAnnouncementForm(prev => ({ ...prev, date_of_occurrence: e.target.value }))}
                />
                <p className="text-xs text-gray-500">El anuncio se mostrará hasta esta fecha (inclusive)</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Contenido (Texto principal con contexto, fechas, horarios)</Label>
              <Textarea
                value={announcementForm.content}
                onChange={(e) => setAnnouncementForm(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Contenido completo del anuncio con todos los detalles necesarios..."
                rows={6}
              />
            </div>
            <div className="space-y-2">
              <Label>Instrucciones para el Presentador (Opcional)</Label>
              <Textarea
                value={announcementForm.instructions}
                onChange={(e) => setAnnouncementForm(prev => ({ ...prev, instructions: e.target.value }))}
                placeholder="Instrucciones especiales, notas de tono, recordatorios para el presentador..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Prioridad (menor = más arriba)</Label>
              <Input
                type="number"
                value={announcementForm.priority}
                onChange={(e) => setAnnouncementForm(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
              />
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
              <Button variant="outline" onClick={() => setShowAnnouncementDialog(false)} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <Button onClick={handleAnnouncementSubmit} className="bg-pdv-teal text-white w-full sm:w-auto">
                {editingAnnouncement ? "Guardar" : "Crear"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
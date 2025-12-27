import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
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
      {
        title: "Equipo de A&A",
        type: "worship",
        duration: 35,
        presenter: "",
        translator: "",
        preacher: "",
        leader: "",
        messageTitle: "",
        verse: "",
        songs: [
          { title: "", lead: "" },
          { title: "", lead: "" },
          { title: "", lead: "" },
          { title: "", lead: "" }
        ],
        description: "",
        actions: []
      },
      {
        title: "Bienvenida y Anuncios",
        type: "welcome",
        duration: 5,
        presenter: "",
        translator: "",
        preacher: "",
        leader: "",
        messageTitle: "",
        verse: "",
        songs: [],
        description: "",
        actions: []
      },
      {
        title: "Ofrendas",
        type: "offering",
        duration: 5,
        presenter: "",
        translator: "",
        preacher: "",
        leader: "",
        messageTitle: "",
        verse: "",
        songs: [],
        description: "",
        actions: []
      },
      {
        title: "Mensaje",
        type: "message",
        duration: 45,
        presenter: "",
        translator: "",
        preacher: "",
        leader: "",
        messageTitle: "",
        verse: "",
        songs: [],
        description: "",
        actions: []
      }
    ],
    coordinators: "",
    ujieres: "",
    sound: "",
    luces: "",
    notes: ""
  });

  const [expandedSegments, setExpandedSegments] = useState({});
  const [showPrintSettings, setShowPrintSettings] = useState(false);
  const [printSettingsPage1, setPrintSettingsPage1] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedData, setLastSavedData] = useState(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState("idle"); // idle, saving, saved, error
  const [highlightedSegmentId, setHighlightedSegmentId] = useState(null);
  const [verseParserOpen, setVerseParserOpen] = useState(false);
  const [verseParserContext, setVerseParserContext] = useState({ segmentIdx: null });

  const getDefaultSegmentForm = () => ({
    title: "",
    type: "Especial",
    duration: 15,
    presenter: "",
    translator: "",
    preacher: "",
    leader: "",
    messageTitle: "",
    verse: "",
    songs: [],
    description: "",
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
      setServiceData(existingService);
      setLastSavedData(JSON.parse(JSON.stringify(existingService)));
      setPrintSettingsPage1(existingService.print_settings_page1 || null);
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
        let result;
        if (serviceId) {
          result = await base44.entities.Service.update(serviceId, data);
        } else {
          result = await base44.entities.Service.create(data);
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
    onSuccess: (result) => {
      console.log('[MUTATION SUCCESS] Invalidating queries and updating state');
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
      
      alert('Servicio guardado exitosamente en ' + new Date().toLocaleTimeString());
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
    setServiceData(prev => ({
      ...prev,
      print_settings_page1: newSettings.page1
    }));
  };

  const handlePrint = () => {
    window.print();
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
      if (field === 'songs') {
        updated.segments[idx].songs = value;
      } else {
        updated.segments[idx][field] = value;
      }
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
    const segmentId = `segment-${Date.now()}-${idx}`;
    [items[idx - 1], items[idx]] = [items[idx], items[idx - 1]];
    setServiceData(prev => ({ ...prev, segments: items }));
    setHighlightedSegmentId(segmentId);
  };

  const moveSegmentDown = (idx) => {
    if (idx === serviceData.segments.length - 1) return;
    const items = Array.from(serviceData.segments);
    const segmentId = `segment-${Date.now()}-${idx}`;
    [items[idx], items[idx + 1]] = [items[idx + 1], items[idx]];
    setServiceData(prev => ({ ...prev, segments: items }));
    setHighlightedSegmentId(segmentId);
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

  const activePrintSettingsPage1 = printSettingsPage1 || {
    globalScale: 1.0,
    margins: { top: "0.5in", right: "0.5in", bottom: "0.5in", left: "0.5in" },
    bodyFontScale: 1.0,
    titleFontScale: 1.0
  };

  return (
    <div className="p-6 md:p-8 space-y-8 print:p-2">
      <style>{`
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
            color: #374151;
          }

          .print-page-wrapper {
            padding: ${activePrintSettingsPage1.margins.top} ${activePrintSettingsPage1.margins.right} ${activePrintSettingsPage1.margins.bottom} ${activePrintSettingsPage1.margins.left};
          }
          
          .print-body-content {
            transform: scale(${activePrintSettingsPage1.globalScale});
            transform-origin: top left;
            font-size: calc(10.5pt * ${activePrintSettingsPage1.bodyFontScale});
            line-height: 1.3;
          }
          
          .print-body-content h1, 
          .print-body-content h2, 
          .print-body-content h3 {
            font-size: calc(1em * ${activePrintSettingsPage1.titleFontScale});
            page-break-after: avoid;
          }
          
          * {
            box-shadow: none !important;
            text-shadow: none !important;
          }
        }
      `}</style>
      {/* Header */}
      <div className="flex justify-between items-center print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
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
                    minute: '2-digit'
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
            size="icon"
            onClick={handlePrint}
            title="Imprimir"
            className="border-2 border-gray-400"
          >
            <Printer className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <PrintSettingsModal
        open={showPrintSettings}
        onOpenChange={setShowPrintSettings}
        settingsPage1={activePrintSettingsPage1}
        settingsPage2={activePrintSettingsPage1}
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

      {/* Print Layout */}
      <div className="hidden print:block print-page-wrapper">
        {/* FIXED Print Header */}
        <div className="text-center mb-6">
          <div className="w-20 h-1 mx-auto mb-4" style={{ background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)' }} />
          <h1 className="text-3xl font-bold uppercase mb-1">{serviceData.name || 'Orden de Servicio'}</h1>
          <p className="text-lg text-gray-600">{serviceData.day_of_week} - {serviceData.date}</p>
          {serviceData.time && <p className="text-sm text-gray-500">{serviceData.time}</p>}
        </div>

        {/* SCALABLE Body Content */}
        <div className="print-body-content">
          {/* Print content will be rendered here */}
          <p>Print view placeholder</p>
        </div>
      </div>

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
              const segmentId = `segment-${idx}-${segment.title}`;
              
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
                                onValueChange={(value) => updateSegmentField(idx, 'type', value)}
                              >
                                <SelectTrigger className="w-48">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="worship">Alabanza</SelectItem>
                                  <SelectItem value="message">Mensaje</SelectItem>
                                  <SelectItem value="welcome">Bienvenida</SelectItem>
                                  <SelectItem value="offering">Ofrenda</SelectItem>
                                  <SelectItem value="Especial">Especial</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2 pt-3">
                            {/* Worship fields */}
                            {segment.type === 'worship' && (
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
                                      <div key={sIdx} className="grid grid-cols-2 gap-2">
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
                                    ))}
                                  </div>
                                )}
                              </>
                            )}

                            {/* Message fields */}
                            {segment.type === 'message' && (
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
                            {segment.type === 'welcome' && (
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
                            {segment.type === 'offering' && (
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

                            {/* Special/Generic fields */}
                            {segment.type === 'Especial' && (
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
              value={serviceData.coordinators}
              onChange={(e) => setServiceData(prev => ({ ...prev, coordinators: e.target.value }))}
              placeholder="Nombre del coordinador"
            />
          </div>
          <div className="space-y-2">
            <Label>Ujieres</Label>
            <Input
              value={serviceData.ujieres}
              onChange={(e) => setServiceData(prev => ({ ...prev, ujieres: e.target.value }))}
              placeholder="Nombres de ujieres"
            />
          </div>
          <div className="space-y-2">
            <Label>Sonido</Label>
            <Input
              value={serviceData.sound}
              onChange={(e) => setServiceData(prev => ({ ...prev, sound: e.target.value }))}
              placeholder="Equipo de sonido"
            />
          </div>
          <div className="space-y-2">
            <Label>Luces/Proyección</Label>
            <Input
              value={serviceData.luces}
              onChange={(e) => setServiceData(prev => ({ ...prev, luces: e.target.value }))}
              placeholder="Equipo de luces"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
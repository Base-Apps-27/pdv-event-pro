import React, { useState, useEffect } from "react";
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
import { Calendar, Clock, Save, Plus, Trash2, Printer, Copy, Edit } from "lucide-react";

export default function WeeklyServiceManager() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [serviceData, setServiceData] = useState(null);
  const [showSpecialDialog, setShowSpecialDialog] = useState(false);
  const [selectedAnnouncements, setSelectedAnnouncements] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);

  const queryClient = useQueryClient();

  // Blueprint structure
  const BLUEPRINT = {
    "9:30am": [
      { type: "worship", title: "Equipo de A&A", duration: 35, fields: ["leader", "songs"] },
      { type: "ministry", title: "Ministración de Sanidad y Milagros", duration: 10, fields: ["leader"] },
      { type: "welcome", title: "Bienvenida", duration: 5, fields: ["presenter"] },
      { type: "offering", title: "Ofrendas", duration: 5, fields: ["presenter", "verse"] },
      { type: "message", title: "Mensaje", duration: 30, fields: ["preacher", "title", "verse"] },
      { type: "break", title: "RECESO", duration: 30, fields: [] }
    ],
    "11:30am": [
      { type: "worship", title: "Equipo de A&A", duration: 30, fields: ["leader", "songs"] },
      { type: "ministry", title: "Ministración de Sanidad y Milagros", duration: 10, fields: ["leader"] },
      { type: "welcome", title: "Bienvenida", duration: 5, fields: ["presenter"] },
      { type: "offering", title: "Ofrendas", duration: 5, fields: ["presenter", "verse"] },
      { type: "message", title: "Mensaje", duration: 30, fields: ["preacher", "title", "verse"] }
    ]
  };

  // Fetch or create service data for selected date
  const { data: existingData, isLoading } = useQuery({
    queryKey: ['weeklyService', selectedDate],
    queryFn: async () => {
      const services = await base44.entities.Service.filter({ date: selectedDate });
      return services[0] || null;
    },
    enabled: !!selectedDate
  });

  // Fetch announcements
  const { data: fixedAnnouncements = [] } = useQuery({
    queryKey: ['fixedAnnouncements'],
    queryFn: async () => {
      const all = await base44.entities.AnnouncementItem.list();
      return all.filter(a => a.category === 'General' && a.is_active);
    }
  });

  const { data: dynamicAnnouncements = [] } = useQuery({
    queryKey: ['dynamicAnnouncements', selectedDate],
    queryFn: async () => {
      const selDate = new Date(selectedDate);
      const [items, events] = await Promise.all([
        base44.entities.AnnouncementItem.list(),
        base44.entities.Event.list()
      ]);
      
      const filteredItems = items.filter(a => {
        if (a.category === 'General' || !a.is_active) return false;
        const startDate = a.start_date ? new Date(a.start_date) : null;
        const endDate = a.end_date ? new Date(a.end_date) : null;
        if (startDate && selDate < startDate) return false;
        if (endDate && selDate > endDate) return false;
        return true;
      });

      const filteredEvents = events.filter(e => {
        if (!e.promote_in_announcements) return false;
        const promoStart = e.promotion_start_date ? new Date(e.promotion_start_date) : null;
        const promoEnd = e.promotion_end_date ? new Date(e.promotion_end_date) : null;
        if (promoStart && selDate < promoStart) return false;
        if (promoEnd && selDate > promoEnd) return false;
        return true;
      });

      return [...filteredItems, ...filteredEvents.map(e => ({ ...e, isEvent: true }))];
    },
    enabled: !!selectedDate
  });

  const saveServiceMutation = useMutation({
    mutationFn: async (data) => {
      if (existingData?.id) {
        return await base44.entities.Service.update(existingData.id, data);
      } else {
        return await base44.entities.Service.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['weeklyService']);
      setHasChanges(false);
      alert('Servicio guardado');
    }
  });

  // Initialize service data from existing or blueprint
  useEffect(() => {
    if (existingData) {
      setServiceData(existingData);
      setSelectedAnnouncements(existingData.selected_announcements || []);
    } else {
      // Initialize from blueprint
      const initialData = {
        date: selectedDate,
        "9:30am": BLUEPRINT["9:30am"].map(seg => ({
          ...seg,
          data: {},
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
          songs: seg.type === "worship" ? [
            { title: "", lead: "" },
            { title: "", lead: "" },
            { title: "", lead: "" },
            { title: "", lead: "" }
          ] : undefined
        })),
        special_segments: [],
        coordinators: { "9:30am": "", "11:30am": "" },
        ujieres: { "9:30am": "", "11:30am": "" },
        sound: { "9:30am": "", "11:30am": "" },
        luces: { "9:30am": "", "11:30am": "" }
      };
      setServiceData(initialData);
    }
  }, [existingData, selectedDate]);

  // Auto-select dynamic announcements
  useEffect(() => {
    if (dynamicAnnouncements.length > 0 && !existingData) {
      setSelectedAnnouncements(prev => {
        const fixed = fixedAnnouncements.map(a => a.id);
        const dynamic = dynamicAnnouncements.map(a => a.id);
        return [...new Set([...fixed, ...dynamic])];
      });
    }
  }, [dynamicAnnouncements, fixedAnnouncements]);

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
    setHasChanges(true);
  };

  const updateTeamField = (field, service, value) => {
    setServiceData(prev => ({
      ...prev,
      [field]: { ...prev[field], [service]: value }
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    const dataToSave = {
      ...serviceData,
      selected_announcements: selectedAnnouncements,
      day_of_week: 'Sunday',
      name: `Domingo - ${selectedDate}`,
      status: 'active'
    };
    saveServiceMutation.mutate(dataToSave);
  };

  const handlePrint = () => {
    window.print();
  };

  const copyTo1130 = () => {
    if (window.confirm('¿Copiar datos de 9:30am a 11:30am?')) {
      setServiceData(prev => ({
        ...prev,
        "11:30am": prev["9:30am"].slice(0, -1).map(seg => ({ ...seg })) // Copy all except break
      }));
      setHasChanges(true);
    }
  };

  if (!serviceData || isLoading) {
    return <div className="p-8">Cargando...</div>;
  }

  return (
    <div className="p-6 md:p-8 space-y-8 print:p-2">
      {/* Header */}
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-5xl font-bold text-gray-900 uppercase tracking-tight font-['Bebas_Neue']">
            Servicios Dominicales
          </h1>
          <p className="text-gray-500 mt-1">Gestión semanal unificada</p>
        </div>
        <div className="flex gap-3">
          {hasChanges && (
            <Button onClick={handleSave} className="bg-pdv-teal text-white">
              <Save className="w-4 h-4 mr-2" />
              Guardar
            </Button>
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
            <Calendar className="w-5 h-5 text-pdv-teal" />
            <div className="flex-1">
              <Label>Fecha del Domingo</Label>
              <Input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Print Header */}
      <div className="hidden print:block text-center mb-6">
        <h1 className="text-3xl font-bold uppercase">Orden de Servicio</h1>
        <p className="text-xl text-blue-600">Domingo {selectedDate}</p>
      </div>

      {/* Two Services Side by Side */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* 9:30 AM Service */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold text-red-600">9:30 a.m.</h2>
            <Button 
              size="sm" 
              variant="outline"
              onClick={copyTo1130}
              className="print:hidden"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copiar a 11:30
            </Button>
          </div>

          {serviceData["9:30am"].map((segment, idx) => (
            <Card key={idx} className="border-l-4 border-l-red-500">
              <CardHeader className="pb-2 bg-gray-50">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-4 h-4 text-red-600" />
                  {segment.title}
                  <Badge variant="outline" className="ml-auto text-xs">{segment.duration} min</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-3">
                {segment.fields.includes("leader") && (
                  <Input
                    placeholder="Líder / Director"
                    value={segment.data?.leader || ""}
                    onChange={(e) => updateSegmentField("9:30am", idx, "leader", e.target.value)}
                    className="text-sm"
                  />
                )}
                {segment.fields.includes("presenter") && (
                  <Input
                    placeholder="Presentador"
                    value={segment.data?.presenter || ""}
                    onChange={(e) => updateSegmentField("9:30am", idx, "presenter", e.target.value)}
                    className="text-sm"
                  />
                )}
                {segment.fields.includes("preacher") && (
                  <Input
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
                        <Input
                          placeholder={`Canción ${sIdx + 1}`}
                          value={song.title}
                          onChange={(e) => {
                            const newSongs = [...segment.songs];
                            newSongs[sIdx].title = e.target.value;
                            updateSegmentField("9:30am", idx, "songs", newSongs);
                          }}
                          className="text-xs"
                        />
                        <Input
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
              </CardContent>
            </Card>
          ))}

          {/* Team Section */}
          <Card className="bg-green-50 border-green-200 print:hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">EQUIPO 9:30am</CardTitle>
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
          <h2 className="text-3xl font-bold text-blue-600">11:30 a.m.</h2>

          {serviceData["11:30am"].map((segment, idx) => (
            <Card key={idx} className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-2 bg-gray-50">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  {segment.title}
                  <Badge variant="outline" className="ml-auto text-xs">{segment.duration} min</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-3">
                {segment.fields.includes("leader") && (
                  <Input
                    placeholder="Líder / Director"
                    value={segment.data?.leader || ""}
                    onChange={(e) => updateSegmentField("11:30am", idx, "leader", e.target.value)}
                    className="text-sm"
                  />
                )}
                {segment.fields.includes("presenter") && (
                  <Input
                    placeholder="Presentador"
                    value={segment.data?.presenter || ""}
                    onChange={(e) => updateSegmentField("11:30am", idx, "presenter", e.target.value)}
                    className="text-sm"
                  />
                )}
                {segment.fields.includes("preacher") && (
                  <Input
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
                        <Input
                          placeholder={`Canción ${sIdx + 1}`}
                          value={song.title}
                          onChange={(e) => {
                            const newSongs = [...segment.songs];
                            newSongs[sIdx].title = e.target.value;
                            updateSegmentField("11:30am", idx, "songs", newSongs);
                          }}
                          className="text-xs"
                        />
                        <Input
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
              </CardContent>
            </Card>
          ))}

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
      <Card className="print:break-before-page">
        <CardHeader>
          <CardTitle className="text-2xl font-bold uppercase">Anuncios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="font-semibold">Anuncios Fijos</Label>
            <div className="grid md:grid-cols-3 gap-2">
              {fixedAnnouncements.map(ann => (
                <div key={ann.id} className="flex items-start gap-2 p-2 border rounded">
                  <Checkbox
                    checked={selectedAnnouncements.includes(ann.id)}
                    onCheckedChange={(checked) => {
                      setSelectedAnnouncements(prev => 
                        checked ? [...prev, ann.id] : prev.filter(id => id !== ann.id)
                      );
                      setHasChanges(true);
                    }}
                  />
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{ann.title}</p>
                    <p className="text-xs text-gray-600">{ann.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold">Anuncios Dinámicos</Label>
            <div className="grid md:grid-cols-2 gap-3">
              {dynamicAnnouncements.map(ann => (
                <div key={ann.id} className="flex items-start gap-2 p-3 border rounded bg-blue-50">
                  <Checkbox
                    checked={selectedAnnouncements.includes(ann.id)}
                    onCheckedChange={(checked) => {
                      setSelectedAnnouncements(prev => 
                        checked ? [...prev, ann.id] : prev.filter(id => id !== ann.id)
                      );
                      setHasChanges(true);
                    }}
                  />
                  <div className="flex-1">
                    <p className="font-bold">{ann.isEvent ? ann.name : ann.title}</p>
                    {(ann.start_date || ann.end_date) && (
                      <p className="text-xs text-blue-600 font-semibold">
                        {ann.start_date} {ann.end_date && `- ${ann.end_date}`}
                      </p>
                    )}
                    <p className="text-sm text-gray-700 mt-1">
                      {ann.isEvent ? ann.announcement_blurb || ann.description : ann.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
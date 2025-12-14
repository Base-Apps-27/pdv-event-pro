import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Printer, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ServiceAnnouncementBuilder() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [announcementType, setAnnouncementType] = useState("fixed"); // "fixed" or "dynamic"
  const [selectedAnnouncements, setSelectedAnnouncements] = useState({
    fixed: [],
    dynamic: []
  });
  
  const queryClient = useQueryClient();

  // Fetch services
  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => base44.entities.Service.list(),
  });

  // Fetch all announcements
  const { data: allAnnouncements = [] } = useQuery({
    queryKey: ['announcementItems'],
    queryFn: () => base44.entities.AnnouncementItem.list('-priority'),
  });

  // Fetch events for dynamic announcements
  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.Event.list('-start_date'),
  });

  const fixedAnnouncements = allAnnouncements.filter(a => a.category === 'General' && a.is_active);
  
  // Get dynamic announcements that are active for selected date
  const dynamicFromItems = allAnnouncements.filter(a => {
    if (a.category === 'General' || !a.is_active) return false;
    if (!selectedDate) return true;
    const selDate = new Date(selectedDate);
    const startDate = a.start_date ? new Date(a.start_date) : null;
    const endDate = a.end_date ? new Date(a.end_date) : null;
    
    if (startDate && selDate < startDate) return false;
    if (endDate && selDate > endDate) return false;
    return true;
  });

  const dynamicFromEvents = events.filter(e => {
    if (!e.promote_in_announcements) return false;
    if (!selectedDate) return true;
    const selDate = new Date(selectedDate);
    const promoStart = e.promotion_start_date ? new Date(e.promotion_start_date) : null;
    const promoEnd = e.promotion_end_date ? new Date(e.promotion_end_date) : null;
    
    if (promoStart && selDate < promoStart) return false;
    if (promoEnd && selDate > promoEnd) return false;
    return true;
  });

  const dynamicAnnouncements = [...dynamicFromItems, ...dynamicFromEvents];

  // Auto-select dynamic announcements when date changes
  useEffect(() => {
    if (selectedDate && dynamicAnnouncements.length > 0) {
      setSelectedAnnouncements(prev => ({
        ...prev,
        dynamic: dynamicAnnouncements.map(a => a.id)
      }));
    }
  }, [selectedDate, selectedServiceId]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.AnnouncementItem.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['announcementItems']);
      setEditingAnnouncement(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AnnouncementItem.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['announcementItems']);
      setEditingAnnouncement(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.AnnouncementItem.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['announcementItems']);
    },
  });

  const toggleAnnouncementSelection = (type, id) => {
    setSelectedAnnouncements(prev => ({
      ...prev,
      [type]: prev[type].includes(id) 
        ? prev[type].filter(i => i !== id)
        : [...prev[type], id]
    }));
  };

  const handlePrint = () => {
    window.print();
  };

  const AnnouncementCard = ({ announcement, type, isEvent = false }) => {
    const isSelected = selectedAnnouncements[type].includes(announcement.id);
    
    return (
      <Card 
        className={`cursor-pointer transition-all hover:shadow-lg ${
          type === 'fixed' ? 'w-48' : 'w-80'
        } ${isSelected ? 'ring-2 ring-pdv-teal' : ''}`}
        onClick={() => toggleAnnouncementSelection(type, announcement.id)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className={`${type === 'fixed' ? 'text-sm' : 'text-base'} truncate`}>
                {isEvent ? announcement.name : announcement.title}
              </CardTitle>
              {!isEvent && announcement.presenter && (
                <p className="text-xs text-gray-600 mt-1">Por: {announcement.presenter}</p>
              )}
            </div>
            <Checkbox checked={isSelected} />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {type === 'dynamic' && (
            <div className="space-y-2">
              <p className="text-xs text-gray-600 line-clamp-3">
                {isEvent ? announcement.announcement_blurb || announcement.description : announcement.content}
              </p>
              {(announcement.start_date || announcement.end_date) && (
                <div className="text-xs text-pdv-teal font-semibold">
                  {announcement.start_date} {announcement.end_date && `- ${announcement.end_date}`}
                </div>
              )}
            </div>
          )}
          {!isEvent && (
            <div className="flex gap-1 mt-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingAnnouncement(announcement);
                  setAnnouncementType(type);
                }}
              >
                <Edit className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm('¿Eliminar este anuncio?')) {
                    deleteMutation.mutate(announcement.id);
                  }
                }}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-6 md:p-8 space-y-8 print:p-0">
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-5xl font-bold text-gray-900 uppercase tracking-tight font-['Bebas_Neue']">
            Constructor de Anuncios
          </h1>
          <p className="text-gray-500 mt-1">Selecciona anuncios para el servicio</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Date and Service Selection */}
      <Card className="print:hidden">
        <CardContent className="p-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fecha del Servicio</Label>
              <Input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Servicio</Label>
              <select 
                className="w-full border rounded-md p-2"
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
              >
                <option value="">Seleccionar...</option>
                {services.filter(s => s.status === 'active').map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fixed Announcements */}
      <div className="space-y-4">
        <div className="flex items-center justify-between print:hidden">
          <div>
            <h2 className="text-2xl font-bold uppercase">Anuncios Fijos</h2>
            <p className="text-sm text-gray-600">Información general y recurrente</p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setEditingAnnouncement({});
              setAnnouncementType('fixed');
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Fijo
          </Button>
        </div>
        
        <div className="flex gap-4 overflow-x-auto pb-4 print:flex-wrap print:overflow-visible">
          {fixedAnnouncements.map(ann => (
            <AnnouncementCard key={ann.id} announcement={ann} type="fixed" />
          ))}
        </div>
      </div>

      {/* Dynamic Announcements */}
      <div className="space-y-4">
        <div className="flex items-center justify-between print:hidden">
          <div>
            <h2 className="text-2xl font-bold uppercase">Anuncios Dinámicos</h2>
            <p className="text-sm text-gray-600">Eventos especiales y anuncios temporales</p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setEditingAnnouncement({});
              setAnnouncementType('dynamic');
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Dinámico
          </Button>
        </div>
        
        <div className="flex gap-4 overflow-x-auto pb-4 print:flex-wrap print:overflow-visible">
          {dynamicAnnouncements.map(ann => (
            <AnnouncementCard 
              key={ann.id} 
              announcement={ann} 
              type="dynamic" 
              isEvent={'name' in ann && 'slug' in ann}
            />
          ))}
        </div>
      </div>

      {/* Print Preview */}
      <div className="hidden print:block">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold uppercase">ANUNCIOS</h1>
          <p className="text-lg text-blue-600">{selectedDate}</p>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-4">
            <h2 className="text-xl font-bold uppercase border-b-2 pb-2">Bienvenida y Anuncios</h2>
            {fixedAnnouncements.filter(a => selectedAnnouncements.fixed.includes(a.id)).map(ann => (
              <div key={ann.id} className="text-sm">
                <h3 className="font-bold">{ann.title}</h3>
                <p className="text-gray-700">{ann.content}</p>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            {dynamicAnnouncements.filter(a => selectedAnnouncements.dynamic.includes(a.id)).map(ann => {
              const isEvent = 'name' in ann && 'slug' in ann;
              return (
                <Card key={ann.id} className="border-2 border-gray-300">
                  <CardContent className="p-4">
                    <h3 className="font-bold text-lg">{isEvent ? ann.name : ann.title}</h3>
                    {(ann.start_date || ann.end_date) && (
                      <p className="text-sm font-semibold text-blue-600">
                        {ann.start_date} {ann.end_date && `- ${ann.end_date}`}
                      </p>
                    )}
                    <p className="text-sm mt-2">
                      {isEvent ? ann.announcement_blurb || ann.description : ann.content}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingAnnouncement} onOpenChange={() => setEditingAnnouncement(null)}>
        <DialogContent className="max-w-xl bg-white">
          <DialogHeader>
            <DialogTitle>
              {editingAnnouncement?.id ? 'Editar' : 'Nuevo'} Anuncio {announcementType === 'fixed' ? 'Fijo' : 'Dinámico'}
            </DialogTitle>
          </DialogHeader>
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              const data = {
                title: formData.get('title'),
                content: formData.get('content'),
                presenter: formData.get('presenter'),
                category: announcementType === 'fixed' ? 'General' : 'Event',
                start_date: formData.get('start_date') || selectedDate,
                is_active: true,
              };
              
              if (editingAnnouncement?.id) {
                updateMutation.mutate({ id: editingAnnouncement.id, data });
              } else {
                createMutation.mutate(data);
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Título</Label>
              <Input name="title" defaultValue={editingAnnouncement?.title} required />
            </div>
            
            <div className="space-y-2">
              <Label>Contenido</Label>
              <Textarea 
                name="content" 
                defaultValue={editingAnnouncement?.content} 
                rows={4}
                required 
              />
            </div>

            <div className="space-y-2">
              <Label>Presentador</Label>
              <Input name="presenter" defaultValue={editingAnnouncement?.presenter} />
            </div>

            {announcementType === 'dynamic' && (
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input 
                  type="date" 
                  name="start_date" 
                  defaultValue={editingAnnouncement?.start_date || selectedDate} 
                />
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setEditingAnnouncement(null)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-pdv-teal text-white">
                Guardar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
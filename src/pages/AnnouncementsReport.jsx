import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Calendar, Printer, Plus, Edit, Trash2, Tag, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function AnnouncementsReport() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['announcements-unified'],
    queryFn: async () => {
      // 1. Fetch Dynamic Announcement Items
      const dynamicItems = await base44.entities.AnnouncementItem.filter({ is_active: true });
      
      // 2. Fetch Event Promos
      const events = await base44.entities.Event.filter({ promote_in_announcements: true });
      
      // 3. Fetch Segment Anuncios (Legacy/Specific)
      const segments = await base44.entities.Segment.filter({ segment_type: 'Anuncio' });
      const sessions = await base44.entities.Session.list(); // Need sessions for dates
      const sessionMap = sessions.reduce((acc, s) => ({...acc, [s.id]: s}), {});

      // Normalize
      const unified = [];

      // Add Dynamic Items
      dynamicItems.forEach(item => {
        unified.push({
            id: item.id,
            type: 'Dynamic',
            title: item.title,
            description: item.content,
            date_display: item.start_date && item.end_date ? `${format(new Date(item.start_date), 'd MMM')} - ${format(new Date(item.end_date), 'd MMM')}` : 'Siempre activo',
            priority: item.priority || 10,
            source: item,
            presenter: item.presenter,
            tags: item.category
        });
      });

      // Add Event Promos
      events.forEach(evt => {
        unified.push({
            id: evt.id,
            type: 'EventPromo',
            title: evt.name,
            description: evt.announcement_blurb || evt.description,
            date_display: evt.start_date ? format(new Date(evt.start_date), 'd MMM yyyy', {locale: es}) : '',
            priority: 5, // Events usually high priority
            source: evt,
            presenter: '', // Usually determined by service
            tags: 'Evento'
        });
      });

      // Add Segment Anuncios (Only future or recent ones)
      const today = new Date();
      today.setDate(today.getDate() - 7); // Show from last week onwards

      segments.forEach(seg => {
        const session = sessionMap[seg.session_id];
        if (session && new Date(session.date) >= today) {
            unified.push({
                id: seg.id,
                type: 'Segment',
                title: seg.announcement_title || seg.title,
                description: seg.announcement_description || seg.description_details,
                date_display: format(new Date(session.date), 'd MMM yyyy', {locale: es}),
                priority: 1, // Specific segment is immediate priority
                source: seg,
                presenter: seg.presenter,
                tags: 'En Programa'
            });
        }
      });

      return unified.sort((a, b) => a.priority - b.priority);
    }
  });

  // CRUD for AnnouncementItem
  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.AnnouncementItem.create(data),
    onSuccess: () => { queryClient.invalidateQueries(['announcements-unified']); setShowDialog(false); }
  });

  const updateMutation = useMutation({
    mutationFn: ({id, data}) => base44.entities.AnnouncementItem.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries(['announcements-unified']); setShowDialog(false); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.AnnouncementItem.update(id, { is_active: false }), // Soft delete
    onSuccess: () => { queryClient.invalidateQueries(['announcements-unified']); }
  });

  const openDialog = (item = null) => {
      if (item && item.type !== 'Dynamic') return; // Can only edit Dynamic items here
      setEditingItem(item?.source || null);
      setFormData(item?.source || {
          title: '', content: '', priority: 10, category: 'General',
          start_date: new Date().toISOString().split('T')[0],
          end_date: '',
          is_active: true
      });
      setShowDialog(true);
  };

  const handleSubmit = (e) => {
      e.preventDefault();
      const data = { ...formData, priority: parseInt(formData.priority) };
      if (editingItem) {
          updateMutation.mutate({ id: editingItem.id, data });
      } else {
          createMutation.mutate(data);
      }
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex justify-between items-end border-b pb-6 print:hidden">
        <div>
          <h1 className="text-4xl font-bold uppercase font-['Bebas_Neue']">Gestión de Anuncios</h1>
          <p className="text-gray-500">Vista unificada de anuncios dinámicos, eventos y segmentos</p>
        </div>
        <div className="flex gap-2">
            <Button onClick={() => openDialog()} className="bg-pdv-teal text-white">
                <Plus className="w-4 h-4 mr-2" /> Nuevo Anuncio
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
                <Printer className="w-4 h-4 mr-2" /> Imprimir Reporte
            </Button>
        </div>
      </div>

      {/* Print-only Header */}
      <div className="hidden print:block mb-8 border-b border-black pb-4">
          <div className="flex justify-between items-start">
              <div>
                  <h1 className="text-3xl font-bold uppercase font-['Bebas_Neue']">Reporte de Anuncios</h1>
                  <p className="text-sm text-gray-600">Palabras de Vida - {format(new Date(), 'PPP', { locale: es })}</p>
              </div>
              <div className="text-right">
                  <div className="text-xs text-gray-500">Generado el {format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
              </div>
          </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 print:block print:columns-2 print:gap-6 print:space-y-0">
        {items.map((item) => (
            <Card key={`${item.type}-${item.id}`} className="break-inside-avoid mb-6 print:mb-4 print:shadow-none print:border print:border-gray-300 print:rounded-lg print:bg-white">
                <CardHeader className="pb-2 flex flex-row justify-between items-start print:pt-4 print:pb-1">
                    <div>
                        <div className="flex gap-2 mb-2 print:mb-1">
                            <Badge variant={item.type === 'Dynamic' ? 'default' : 'secondary'} className="print:border print:border-black print:text-black print:bg-transparent print:px-1 print:h-5 print:text-[10px]">
                                {item.type === 'Segment' ? 'En Programa' : (item.type === 'EventPromo' ? 'Evento' : item.tags)}
                            </Badge>
                            {item.date_display && <span className="text-xs text-gray-500 self-center print:text-gray-600 print:text-[10px]">{item.date_display}</span>}
                        </div>
                        <CardTitle className="text-lg font-bold print:text-base print:leading-tight">{item.title}</CardTitle>
                    </div>
                    {item.type === 'Dynamic' && (
                        <div className="flex gap-1 print:hidden">
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openDialog(item)}>
                                <Edit className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500" onClick={() => deleteMutation.mutate(item.id)}>
                                <Trash2 className="w-3 h-3" />
                            </Button>
                        </div>
                    )}
                </CardHeader>
                <CardContent className="print:pb-4 print:pt-1">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap print:text-xs print:text-justify print:leading-relaxed">{item.description}</p>
                    {item.presenter && <p className="text-xs text-gray-500 mt-2 font-semibold print:text-[10px]">Presenta: {item.presenter}</p>}
                </CardContent>
            </Card>
        ))}
        </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>{editingItem ? 'Editar Anuncio' : 'Nuevo Anuncio'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                      <Label>Título</Label>
                      <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                      <Label>Contenido</Label>
                      <Textarea value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} rows={4} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <Label>Fecha Inicio</Label>
                          <Input type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                          <Label>Fecha Fin</Label>
                          <Input type="date" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} />
                      </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <Label>Prioridad (1 = Alta)</Label>
                          <Input type="number" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                          <Label>Categoría</Label>
                          <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="General">General</SelectItem>
                                  <SelectItem value="Event">Evento</SelectItem>
                                  <SelectItem value="Ministry">Ministerio</SelectItem>
                                  <SelectItem value="Urgent">Urgente</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                  </div>
                  <div className="space-y-2">
                      <Label>Presentador (Opcional)</Label>
                      <Input value={formData.presenter} onChange={e => setFormData({...formData, presenter: e.target.value})} />
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
                      <Button type="submit">Guardar</Button>
                  </div>
              </form>
          </DialogContent>
      </Dialog>
    </div>
  );
}
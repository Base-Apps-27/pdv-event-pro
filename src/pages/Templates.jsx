import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, FileText, Copy, Calendar, ArrowRight, Loader2 } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DuplicateEventDialog from "@/components/event/DuplicateEventDialog";
import { useLanguage } from "@/components/utils/i18n";

const SEGMENT_TYPES = [
  "Alabanza", "Bienvenida", "Ofrenda", "Plenaria", "Video",
  "Anuncio", "Dinámica", "Break", "TechOnly", "Oración", "Especial", "Cierre"
];

const COLOR_CODES = [
  { value: "worship", label: "Adoración" },
  { value: "preach", label: "Predicación" },
  { value: "break", label: "Descanso" },
  { value: "tech", label: "Técnico" },
  { value: "special", label: "Especial" },
  { value: "default", label: "Predeterminado" }
];

export default function Templates() {
  const { t } = useLanguage();
  const gradientStyle = {
    background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)',
  };
  
  const [showDialog, setShowDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateToUse, setTemplateToUse] = useState(null);
  const queryClient = useQueryClient();

  // Phase 7: Added staleTime to reduce unnecessary refetches
  const { data: segmentTemplatesData, isLoading: stLoading } = useQuery({
    queryKey: ['segmentTemplates'],
    queryFn: () => base44.entities.SegmentTemplate.list(),
    staleTime: 10 * 60 * 1000, // 10 minutes (templates change rarely)
  });
  const segmentTemplates = segmentTemplatesData || [];

  const { data: eventTemplatesData, isLoading: etLoading } = useQuery({
    queryKey: ['eventTemplates'],
    queryFn: () => base44.entities.Event.filter({ status: 'template' }),
    staleTime: 10 * 60 * 1000, // 10 minutes (templates change rarely)
  });
  const eventTemplates = eventTemplatesData || [];
  const isLoading = stLoading || etLoading;

  const deleteEventTemplateMutation = useMutation({
    mutationFn: (id) => base44.entities.Event.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['eventTemplates']);
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.SegmentTemplate.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['segmentTemplates']);
      setShowDialog(false);
      setEditingTemplate(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SegmentTemplate.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['segmentTemplates']);
      setShowDialog(false);
      setEditingTemplate(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SegmentTemplate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['segmentTemplates']);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const data = {
      name: formData.get('name'),
      segment_type: formData.get('segment_type'),
      default_title: formData.get('default_title'),
      default_duration_min: parseInt(formData.get('default_duration_min')),
      default_stage_call_offset_min: parseInt(formData.get('default_stage_call_offset_min')),
      default_projection_notes: formData.get('default_projection_notes'),
      default_sound_notes: formData.get('default_sound_notes'),
      default_ushers_notes: formData.get('default_ushers_notes'),
      default_color_code: formData.get('default_color_code'),
      show_in_general: formData.get('show_in_general') === 'on',
      show_in_projection: formData.get('show_in_projection') === 'on',
      show_in_sound: formData.get('show_in_sound') === 'on',
      show_in_ushers: formData.get('show_in_ushers') === 'on',
    };

    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const colorSchemes = {
    worship: "bg-purple-100 text-purple-800 border-purple-200",
    preach: "bg-orange-100 text-orange-800 border-orange-200",
    break: "bg-gray-100 text-gray-800 border-gray-200",
    tech: "bg-blue-100 text-blue-800 border-blue-200",
    special: "bg-pink-100 text-pink-800 border-pink-200",
    default: "bg-slate-100 text-slate-700 border-slate-200"
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl text-gray-900 uppercase tracking-tight">{t('templates.title')}</h1>
          <p className="text-slate-600 mt-1">{t('templates.subtitle')}</p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      )}
      <Tabs defaultValue="events">
        <TabsList className="mb-6">
          <TabsTrigger value="services" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {t('templates.serviceBlueprints')}
          </TabsTrigger>
          <TabsTrigger value="events" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {t('templates.eventTemplates')}
          </TabsTrigger>
          <TabsTrigger value="segments" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {t('templates.segmentTemplates')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="services">
          {/* ServiceTemplatesTab deprecated (2026-02-21): Blueprint editing consolidated
              into the "Configurar Horarios" workflow (ServiceScheduleManager + BlueprintEditor).
              Both editors wrote to the same Service entity, causing conflicts. */}
          <Card className="border-2 border-dashed border-gray-300 bg-gray-50">
            <CardContent className="py-12 text-center space-y-4">
              <FileText className="w-12 h-12 text-gray-400 mx-auto" />
              <div>
                <h3 className="text-lg font-bold text-gray-800">Blueprint de Servicios</h3>
                <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                  La configuración de blueprints se ha movido a la página de Configuración de Servicios para evitar conflictos de datos.
                </p>
              </div>
              <Button
                onClick={() => window.location.href = createPageUrl("ServiceBlueprints")}
                style={{ backgroundColor: '#1F8A70', color: '#ffffff' }}
                className="hover:opacity-90"
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                Ir a Configuración de Servicios
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {eventTemplates.map((template) => (
              <Card key={template.id} className="hover:shadow-lg transition-shadow bg-white border-t-4 border-t-blue-500">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-2">{template.name}</CardTitle>
                      {template.theme && (
                        <p className="text-sm text-slate-500 italic">"{template.theme}"</p>
                      )}
                    </div>
                    <Calendar className="w-5 h-5 text-blue-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-sm text-slate-600">
                      {t('templates.thisTemplateIncludes')}
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                      <Button 
                        className="w-full bg-blue-600 hover:bg-blue-700"
                        onClick={() => setTemplateToUse(template)}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {t('templates.createEvent')}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          if (confirm(t('templates.deleteConfirm'))) {
                            deleteEventTemplateMutation.mutate(template.id);
                          }
                        }}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {t('templates.deleteTemplate')}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {eventTemplates.length === 0 && (
              <Card className="col-span-full p-12 text-center border-dashed border-2 bg-slate-50">
                <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">{t('templates.noEventTemplates')}</h3>
                <p className="text-slate-500 mb-4">
                  {t('templates.noEventTemplatesDesc')}
                </p>
                <Button variant="outline" asChild>
                  <a href={createPageUrl('Events')}>
                    {t('templates.goToEvents')} <ArrowRight className="w-4 h-4 ml-2" />
                  </a>
                </Button>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="segments">
          <div className="flex justify-end mb-4">
            <Button onClick={() => { setEditingTemplate(null); setShowDialog(true); }} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              {t('templates.newSegmentTemplate')}
            </Button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {segmentTemplates.map((template) => (
              <Card key={template.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-2">{template.name}</CardTitle>
                      <div className="flex gap-2">
                        <Badge className={`${colorSchemes[template.default_color_code || 'default']} border text-xs`}>
                          {template.segment_type}
                        </Badge>
                      </div>
                    </div>
                    <FileText className="w-5 h-5 text-slate-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {template.default_title && (
                      <div>
                        <p className="text-xs text-slate-500">{t('templates.defaultTitle')}</p>
                        <p className="text-sm font-medium text-slate-900">{template.default_title}</p>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-slate-500">{t('templates.duration')}</p>
                        <p className="font-medium">{template.default_duration_min} min</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">{t('templates.stageCall')}</p>
                        <p className="font-medium">{template.default_stage_call_offset_min} {t('templates.minBefore')}</p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => { setEditingTemplate(template); setShowDialog(true); }}
                        className="flex-1"
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        {t('common.edit')}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          if (confirm('¿Eliminar esta plantilla?')) {
                            deleteMutation.mutate(template.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {segmentTemplates.length === 0 && (
              <Card className="col-span-full p-12 text-center border-dashed border-2">
                <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">{t('templates.noSegmentTemplates')}</h3>
                <p className="text-slate-500 mb-4">{t('templates.noSegmentTemplatesDesc')}</p>
                <Button onClick={() => setShowDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t('templates.createTemplate')}
                </Button>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <DuplicateEventDialog
        open={!!templateToUse}
        onOpenChange={(open) => !open && setTemplateToUse(null)}
        event={templateToUse}
        mode="from_template"
      />

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900 font-['Bebas_Neue'] tracking-wide uppercase">{editingTemplate ? t('templates.editTemplate') : t('templates.newSegmentTemplate')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('templates.templateName')} *</Label>
              <Input 
                id="name" 
                name="name" 
                defaultValue={editingTemplate?.name}
                required 
                placeholder="Bloque de Alabanza 30min"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="segment_type">{t('templates.segmentType')} *</Label>
                <Select name="segment_type" defaultValue={editingTemplate?.segment_type || "Plenaria"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEGMENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="default_color_code">Color</Label>
                <Select name="default_color_code" defaultValue={editingTemplate?.default_color_code || "default"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLOR_CODES.map((color) => (
                      <SelectItem key={color.value} value={color.value}>{color.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default_title">{t('templates.defaultTitle')}</Label>
              <Input 
                id="default_title" 
                name="default_title" 
                defaultValue={editingTemplate?.default_title}
                placeholder="Alabanza y Adoración"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="default_duration_min">{t('templates.duration')} (min)</Label>
                <Input 
                  id="default_duration_min" 
                  name="default_duration_min" 
                  type="number"
                  defaultValue={editingTemplate?.default_duration_min || 30}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="default_stage_call_offset_min">{t('templates.stageCall')} ({t('templates.minBefore')})</Label>
                <Input 
                  id="default_stage_call_offset_min" 
                  name="default_stage_call_offset_min" 
                  type="number"
                  defaultValue={editingTemplate?.default_stage_call_offset_min || 15}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default_projection_notes">{t('templates.projectionNotes')}</Label>
              <Textarea 
                id="default_projection_notes" 
                name="default_projection_notes" 
                defaultValue={editingTemplate?.default_projection_notes}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="default_sound_notes">{t('templates.soundNotes')}</Label>
              <Textarea 
                id="default_sound_notes" 
                name="default_sound_notes" 
                defaultValue={editingTemplate?.default_sound_notes}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="default_ushers_notes">{t('templates.ushersNotes')}</Label>
              <Textarea 
                id="default_ushers_notes" 
                name="default_ushers_notes" 
                defaultValue={editingTemplate?.default_ushers_notes}
                rows={2}
              />
            </div>

            <div className="space-y-3">
              <Label>{t('templates.defaultVisibility')}</Label>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="show_in_general"
                    name="show_in_general"
                    defaultChecked={editingTemplate?.show_in_general ?? true}
                  />
                  <label htmlFor="show_in_general" className="text-sm cursor-pointer">
                    {t('templates.generalProgram')}
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="show_in_projection"
                    name="show_in_projection"
                    defaultChecked={editingTemplate?.show_in_projection ?? true}
                  />
                  <label htmlFor="show_in_projection" className="text-sm cursor-pointer">
                    {t('templates.projectionView')}
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="show_in_sound"
                    name="show_in_sound"
                    defaultChecked={editingTemplate?.show_in_sound ?? true}
                  />
                  <label htmlFor="show_in_sound" className="text-sm cursor-pointer">
                    {t('templates.soundView')}
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="show_in_ushers"
                    name="show_in_ushers"
                    defaultChecked={editingTemplate?.show_in_ushers ?? true}
                  />
                  <label htmlFor="show_in_ushers" className="text-sm cursor-pointer">
                    {t('templates.ushersView')}
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" style={gradientStyle} className="text-white font-bold uppercase">
                {editingTemplate ? t('common.save') : t('common.create')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
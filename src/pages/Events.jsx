import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { hasPermission } from "@/components/utils/permissions";
import { useLanguage } from "@/components/utils/i18n";
import { Plus, Calendar, MapPin, Edit, Trash2, Copy, Save } from "lucide-react";
import DatePicker from "@/components/ui/DatePicker";
import { FieldOriginIndicator, getFieldOrigin } from "@/components/utils/fieldOrigins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import DeleteEventDialog from "@/components/event/DeleteEventDialog";
import DuplicateEventDialog from "@/components/event/DuplicateEventDialog";
import TemplateSelectorDialog from "@/components/event/TemplateSelectorDialog";

export default function Events() {
  const { t } = useLanguage();
  const gradientStyle = {
    background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)',
  };
  const [showDialog, setShowDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [eventToDuplicate, setEventToDuplicate] = useState(null);
  const [eventToTemplate, setEventToTemplate] = useState(null);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [formData, setFormData] = useState({});
  const [fieldOrigins, setFieldOrigins] = useState({});
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    fetchUser();
  }, []);

  const { data: allEvents = [], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.Event.list('-year'),
  });

  const events = allEvents.filter(e => e.status !== 'template');

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Event.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['events']);
      setShowDialog(false);
      setEditingEvent(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Event.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['events']);
      setShowDialog(false);
      setEditingEvent(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Event.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['events']);
      setEventToDelete(null);
    },
  });

  const handleDeleteClick = (event) => {
    // First confirmation: Browser alert
    if (window.confirm(t('events.deleteConfirm'))) {
      setEventToDelete(event);
    }
  };

  const updateFormField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (fieldOrigins[field] && fieldOrigins[field] !== 'manual') {
      setFieldOrigins(prev => ({ ...prev, [field]: 'manual' }));
    }
  };

  const generateSlug = (name, year) => {
    return `${name}-${year}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const slug = formData.slug || generateSlug(formData.name, formData.year);
    const data = {
      ...formData,
      slug,
      year: parseInt(formData.year),
      field_origins: fieldOrigins,
      promotion_targets: formData.promotion_targets.split(',').map(s => s.trim()).filter(Boolean),
    };

    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEditDialog = (event) => {
    setEditingEvent(event);
    setFieldOrigins(event?.field_origins || {});
    setFormData({
      name: event?.name || '',
      slug: event?.slug || '',
      theme: event?.theme || '',
      year: event?.year || new Date().getFullYear(),
      location: event?.location || '',
      start_date: event?.start_date || '',
      end_date: event?.end_date || '',
      description: event?.description || '',
      status: event?.status || 'planning',
      print_color: event?.print_color || 'blue',
      promote_in_announcements: event?.promote_in_announcements || false,
      promotion_start_date: event?.promotion_start_date || '',
      promotion_end_date: event?.promotion_end_date || '',
      announcement_blurb: event?.announcement_blurb || '',
      promotion_targets: event?.promotion_targets ? event.promotion_targets.join(', ') : '',
    });
    setShowDialog(true);
  };

  const statusColors = {
    planning: "bg-yellow-100 text-yellow-800 border-yellow-200",
    confirmed: "bg-green-100 text-green-800 border-green-200",
    in_progress: "bg-blue-100 text-blue-800 border-blue-200",
    completed: "bg-gray-100 text-gray-800 border-gray-200",
    archived: "bg-slate-100 text-slate-600 border-slate-200"
  };

  const statusLabels = {
    planning: t('status.planning'),
    confirmed: t('status.confirmed'),
    in_progress: t('status.in_progress'),
    completed: t('status.completed'),
    archived: t('status.archived')
  };

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-gray-200 pb-6">
        <div>
          <h1 className="text-5xl text-gray-900 uppercase tracking-tight">{t('events.title')}</h1>
          <p className="text-gray-500 mt-1 font-medium">{t('events.subtitle')}</p>
        </div>
        {hasPermission(user, 'create_events') && (
          <div className="flex gap-3">
            <Button 
              onClick={() => setShowTemplateSelector(true)} 
              variant="outline"
              className="shadow-sm hover:shadow-md transition-all font-bold uppercase px-4 border-gray-300 text-gray-600 hover:text-blue-600 hover:border-blue-300"
            >
              <Copy className="w-4 h-4 mr-2" />
              {t('events.fromTemplate')}
            </Button>
            <Button onClick={() => openEditDialog(null)} className="text-white shadow-md hover:shadow-lg hover:scale-105 transition-all font-bold uppercase px-6" style={gradientStyle}>
              <Plus className="w-5 h-5 mr-2" />
              {t('events.newEvent')}
            </Button>
          </div>
        )}
        </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event) => (
          <Card key={event.id} className="group hover:shadow-xl transition-all duration-300 bg-white border-none shadow-md overflow-hidden relative">
            <div className={`absolute top-0 left-0 w-full h-1.5 ${statusColors[event.status].replace('bg-', 'bg-').replace('text-', '').split(' ')[0]}`} />
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-xl mb-2 font-bold uppercase text-gray-900 transition-colors" style={{'--hover-color': '#1F8A70'}}>{event.name}</CardTitle>
                  <Badge className={`${statusColors[event.status]} border-none font-bold uppercase tracking-wider text-[10px]`}>
                    {statusLabels[event.status]}
                  </Badge>
                </div>
                <div className="text-4xl font-bold text-gray-100 font-['Bebas_Neue'] select-none">{event.year}</div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {event.theme && (
                  <p className="text-sm font-semibold italic" style={{ color: '#8DC63F' }}>"{event.theme}"</p>
                )}
                
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="w-4 h-4" />
                  <span>{event.location || t('events.noLocation')}</span>
                </div>

                {event.start_date && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>{event.start_date} {event.end_date && `- ${event.end_date}`}</span>
                  </div>
                )}

                <div className="pt-3 border-t border-gray-200 flex gap-2">
                  <Link to={createPageUrl(`EventDetail?id=${event.id}`)} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full" style={{ borderColor: '#1F8A70', color: '#1F8A70' }}>
                      {t('events.viewDetails')}
                    </Button>
                  </Link>
                  {hasPermission(user, 'edit_events') && (
                    <Button variant="outline" size="sm" onClick={() => openEditDialog(event)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                  )}
                  {hasPermission(user, 'create_events') && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setEventToDuplicate(event)}
                        title={t('events.duplicate')}
                      >
                        <Copy className="w-4 h-4 text-blue-500" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setEventToTemplate(event)}
                        title={t('events.saveAsTemplate')}
                      >
                        <Save className="w-4 h-4 text-amber-600" />
                      </Button>
                    </>
                  )}
                  {hasPermission(user, 'delete_events') && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleDeleteClick(event)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl text-gray-900 tracking-wide uppercase">{editingEvent ? t('events.editEvent') : t('events.newEvent')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('events.form.name')}</Label>
                <div className="relative">
                  <Input 
                    id="name" 
                    name="name" 
                    value={formData.name}
                    onChange={(e) => updateFormField('name', e.target.value)}
                    required 
                    placeholder={t('placeholder.eventName')}
                  />
                  <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'name')} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">{t('events.form.year')}</Label>
                <div className="relative">
                  <Input 
                    id="year" 
                    name="year" 
                    type="number"
                    value={formData.year}
                    onChange={(e) => updateFormField('year', e.target.value)}
                    required 
                  />
                  <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'year')} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="theme">{t('events.form.theme')}</Label>
              <div className="relative">
                <Input 
                  id="theme" 
                  name="theme" 
                  value={formData.theme}
                  onChange={(e) => updateFormField('theme', e.target.value)}
                  placeholder={t('placeholder.theme')}
                />
                <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'theme')} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">{t('events.form.location')}</Label>
              <div className="relative">
                <Input 
                  id="location" 
                  name="location" 
                  value={formData.location}
                  onChange={(e) => updateFormField('location', e.target.value)}
                  placeholder={t('placeholder.location')}
                />
                <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'location')} />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">{t('events.form.startDate')}</Label>
                <div className="relative">
                  <DatePicker
                    value={formData.start_date}
                    onChange={(val) => updateFormField('start_date', val)}
                    placeholder={t('placeholder.selectDate')}
                  />
                  <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'start_date')} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">{t('events.form.endDate')}</Label>
                <div className="relative">
                  <DatePicker
                    value={formData.end_date}
                    onChange={(val) => updateFormField('end_date', val)}
                    placeholder={t('placeholder.selectDate')}
                  />
                  <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'end_date')} />
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">{t('events.form.status')}</Label>
                <div className="relative">
                  <Select name="status" value={formData.status} onValueChange={(value) => updateFormField('status', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planning">{t('status.planning')}</SelectItem>
                      <SelectItem value="confirmed">{t('status.confirmed')}</SelectItem>
                      <SelectItem value="in_progress">{t('status.in_progress')}</SelectItem>
                      <SelectItem value="completed">{t('status.completed')}</SelectItem>
                      <SelectItem value="archived">{t('status.archived')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'status')} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="print_color">{t('events.form.printColor')}</Label>
                <div className="relative">
                  <Select name="print_color" value={formData.print_color} onValueChange={(value) => updateFormField('print_color', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blue">{t('color.blue')}</SelectItem>
                      <SelectItem value="green">{t('color.green')}</SelectItem>
                      <SelectItem value="pink">{t('color.pink')}</SelectItem>
                      <SelectItem value="orange">{t('color.orange')}</SelectItem>
                      <SelectItem value="yellow">{t('color.yellow')}</SelectItem>
                      <SelectItem value="purple">{t('color.purple')}</SelectItem>
                      <SelectItem value="red">{t('color.red')}</SelectItem>
                      <SelectItem value="teal">{t('color.teal')}</SelectItem>
                      <SelectItem value="charcoal">{t('color.charcoal')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'print_color')} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('events.form.description')}</Label>
              <div className="relative">
                <Textarea 
                  id="description" 
                  name="description" 
                  value={formData.description}
                  onChange={(e) => updateFormField('description', e.target.value)}
                  rows={3}
                  placeholder={t('placeholder.eventDescription')}
                />
                <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'description')} />
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <div className="flex items-center space-x-2 mb-4">
                <Checkbox 
                  id="promote_in_announcements" 
                  checked={formData.promote_in_announcements}
                  onCheckedChange={(checked) => updateFormField('promote_in_announcements', checked)}
                />
                <Label htmlFor="promote_in_announcements" className="font-bold" style={{ color: '#1F8A70' }}>{t('events.form.promoteInAnnouncements')}</Label>
              </div>

              {formData.promote_in_announcements && (
                <div className="space-y-4 pl-6 border-l-2" style={{ borderColor: 'rgba(31, 138, 112, 0.2)' }}>
                   <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <Label>{t('events.form.promotionStart')}</Label>
                         <DatePicker
                           value={formData.promotion_start_date}
                           onChange={(val) => updateFormField('promotion_start_date', val)}
                           placeholder={t('placeholder.selectDate')}
                         />
                       </div>
                       <div className="space-y-2">
                         <Label>{t('events.form.promotionEnd')}</Label>
                         <DatePicker
                           value={formData.promotion_end_date}
                           onChange={(val) => updateFormField('promotion_end_date', val)}
                           placeholder={t('placeholder.selectDate')}
                         />
                       </div>
                   </div>
                   <div className="space-y-2">
                      <Label>{t('events.form.announcementBlurb')}</Label>
                      <Textarea 
                        value={formData.announcement_blurb}
                        onChange={(e) => updateFormField('announcement_blurb', e.target.value)}
                        rows={2}
                        placeholder={t('placeholder.announcementBlurb')}
                      />
                   </div>
                   <div className="space-y-2">
                      <Label>{t('events.form.targets')}</Label>
                      <Input 
                        value={formData.promotion_targets}
                        onChange={(e) => updateFormField('promotion_targets', e.target.value)}
                        placeholder={t('placeholder.targets')}
                      />
                   </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                {t('btn.cancel')}
              </Button>
              <Button type="submit" className="text-white font-bold uppercase" style={gradientStyle}>
                {editingEvent ? t('btn.save') : t('btn.create_event')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteEventDialog 
        open={!!eventToDelete} 
        onOpenChange={(open) => !open && setEventToDelete(null)}
        onConfirm={() => deleteMutation.mutate(eventToDelete.id)}
        eventName={eventToDelete?.name}
      />

      <DuplicateEventDialog
        open={!!eventToDuplicate}
        onOpenChange={(open) => !open && setEventToDuplicate(null)}
        event={eventToDuplicate}
        mode="duplicate"
      />

      <DuplicateEventDialog
        open={!!eventToTemplate}
        onOpenChange={(open) => !open && setEventToTemplate(null)}
        event={eventToTemplate}
        mode="template"
      />

      <TemplateSelectorDialog
        open={showTemplateSelector}
        onOpenChange={setShowTemplateSelector}
        onSelect={(template) => {
          setShowTemplateSelector(false);
          setSelectedTemplate(template);
        }}
      />

      <DuplicateEventDialog
        open={!!selectedTemplate}
        onOpenChange={(open) => !open && setSelectedTemplate(null)}
        event={selectedTemplate}
        mode="from_template"
      />
    </div>
  );
}
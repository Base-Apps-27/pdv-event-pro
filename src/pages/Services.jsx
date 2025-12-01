import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Plus, Calendar, MapPin, Edit, Trash2, Clock, Layers, Wand2 } from "lucide-react";
import BlueprintConfigurationModal from "../components/service/BlueprintConfigurationModal";
import { FieldOriginIndicator, getFieldOrigin } from "@/components/utils/fieldOrigins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Services() {
  const gradientStyle = {
    background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)',
  };
  const [showDialog, setShowDialog] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [formData, setFormData] = useState({});
  const [fieldOrigins, setFieldOrigins] = useState({});
  const [showBlueprintConfigDialog, setShowBlueprintConfigDialog] = useState(false);
  const [selectedBlueprintToConfigure, setSelectedBlueprintToConfigure] = useState(null);
  const [newServiceDraftData, setNewServiceDraftData] = useState({});
  const [serviceToApplyBlueprint, setServiceToApplyBlueprint] = useState(null);
  const [showBlueprintSelector, setShowBlueprintSelector] = useState(false);
  const queryClient = useQueryClient();

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: () => base44.entities.Service.list(),
  });

  // Filter out blueprints
  const displayServices = services.filter(s => s.status !== 'blueprint');

  // Fetch blueprints for the selector
  const { data: blueprints = [] } = useQuery({
    queryKey: ['service-blueprints'],
    queryFn: () => base44.entities.Service.filter({ status: 'blueprint' }),
  });

  // Helper function for cloning blueprint content
  const applyBlueprintToService = async (serviceId, blueprintId, blueprintSessionSegmentData) => {
      const bpSessions = await base44.entities.Session.filter({ service_id: blueprintId }, 'order');
      
      for (const bpSession of bpSessions) {
        // Create Session clone
        const newSession = await base44.entities.Session.create({
          ...bpSession,
          id: undefined, // Clear ID
          service_id: serviceId,
          origin: 'duplicate', // Mark as duplicate/template based
          date: "", // Reset date for new service
        });

        // Find overrides for this session
        const sessionOverrides = blueprintSessionSegmentData?.find(s => s.sessionId === bpSession.id);

        // Fetch blueprint segments for this session
        const bpSegments = await base44.entities.Segment.filter({ session_id: bpSession.id });
        
        // Clone Segments
        for (const bpSeg of bpSegments) {
           // Find overrides for this segment
           const segmentOverrides = sessionOverrides?.segments?.find(seg => seg.segmentId === bpSeg.id);
           const overrides = segmentOverrides || {};
           
           // Remove internal IDs from overrides
           delete overrides.segmentId;
           delete overrides.segment_type; // Keep original type just in case
           delete overrides.color_code; // Keep original color

           await base44.entities.Segment.create({
             ...bpSeg,
             ...overrides,
             id: undefined,
             session_id: newSession.id,
             service_id: undefined, // Ensure it links to session
             origin: 'duplicate'
           });
        }
      }
  };

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const { blueprint_id, blueprintSessionSegmentData, ...serviceData } = data;
      
      // 1. Create the service
      const newService = await base44.entities.Service.create(serviceData);

      // 2. If blueprint selected, clone sessions and segments
      if (blueprint_id) {
        await applyBlueprintToService(newService.id, blueprint_id, blueprintSessionSegmentData);
      }
      return newService;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['services']);
      setShowDialog(false);
      setShowBlueprintConfigDialog(false);
      setEditingService(null);
      setNewServiceDraftData({});
      setSelectedBlueprintToConfigure(null);
    },
  });

  const applyBlueprintMutation = useMutation({
    mutationFn: async ({ serviceId, blueprintId, blueprintSessionSegmentData }) => {
      await applyBlueprintToService(serviceId, blueprintId, blueprintSessionSegmentData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['services']);
      setShowBlueprintConfigDialog(false);
      setServiceToApplyBlueprint(null);
      setSelectedBlueprintToConfigure(null);
      setNewServiceDraftData({});
    },
  });

  const updateServiceConfigurationMutation = useMutation({
    mutationFn: async ({ serviceId, blueprintSessionSegmentData }) => {
      // Iterate through sessions and segments to update them
      for (const sessionData of blueprintSessionSegmentData) {
        for (const segmentData of sessionData.segments) {
          // Filter out non-updateable fields or reconstruct the update object
          const { segmentId, title, presenter, message_title, scripture_references, 
                  number_of_songs, song_1_title, song_1_lead, song_2_title, song_2_lead,
                  song_3_title, song_3_lead, song_4_title, song_4_lead, song_5_title, song_5_lead,
                  song_6_title, song_6_lead, announcement_title, announcement_description
          } = segmentData;

          const updateData = {
            title,
            presenter,
            message_title,
            scripture_references,
            number_of_songs,
            song_1_title, song_1_lead,
            song_2_title, song_2_lead,
            song_3_title, song_3_lead,
            song_4_title, song_4_lead,
            song_5_title, song_5_lead,
            song_6_title, song_6_lead,
            announcement_title,
            announcement_description
          };

          // Remove undefined/null keys if necessary, though base44 update usually handles partials
          await base44.entities.Segment.update(segmentId, updateData);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['services']);
      setShowBlueprintConfigDialog(false);
      setServiceToApplyBlueprint(null);
      setSelectedBlueprintToConfigure(null);
      setNewServiceDraftData({});
    }
  });



  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Service.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['services']);
      setShowDialog(false);
      setEditingService(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Service.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['services']);
    },
  });

  const handleDeleteClick = (service) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar el servicio "${service.name}"?`)) {
      deleteMutation.mutate(service.id);
    }
  };

  const updateFormField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (fieldOrigins[field] && fieldOrigins[field] !== 'manual') {
      setFieldOrigins(prev => ({ ...prev, [field]: 'manual' }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      field_origins: fieldOrigins,
    };

    if (editingService) {
      updateMutation.mutate({ id: editingService.id, data });
    } else {
      if (formData.blueprint_id) {
        // If using a blueprint, open configuration modal first
        setServiceToApplyBlueprint(null); // Ensure we are not applying to an existing service
        setNewServiceDraftData(data);
        setSelectedBlueprintToConfigure(formData.blueprint_id);
        setShowDialog(false);
        setShowBlueprintConfigDialog(true);
      } else {
        createMutation.mutate(data);
      }
    }
  };

  const openEditDialog = (service) => {
    setEditingService(service);
    setFieldOrigins(service?.field_origins || {});
    setFormData({
      name: service?.name || '',
      day_of_week: service?.day_of_week || 'Sunday',
      time: service?.time || '',
      location: service?.location || '',
      description: service?.description || '',
      status: service?.status || 'active',
    });
    setShowDialog(true);
  };

  const dayLabels = {
    Sunday: "Domingo",
    Monday: "Lunes",
    Tuesday: "Martes",
    Wednesday: "Miércoles",
    Thursday: "Jueves",
    Friday: "Viernes",
    Saturday: "Sábado"
  };

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-gray-200 pb-6">
        <div>
          <h1 className="text-5xl font-bold text-gray-900 uppercase tracking-tight font-['Bebas_Neue']">Servicios Semanales</h1>
          <p className="text-gray-500 mt-1 font-medium">Gestiona tus reuniones recurrentes y liturgias</p>
        </div>
        <div>

          <Button onClick={() => openEditDialog(null)} className="text-white shadow-md hover:shadow-lg hover:scale-105 transition-all font-bold uppercase px-6" style={gradientStyle}>
            <Plus className="w-5 h-5 mr-2" />
            Nuevo Servicio
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayServices.map((service) => (
          <Card key={service.id} className="group hover:shadow-xl transition-all duration-300 bg-white border-none shadow-md overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-pdv-teal" />
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-xl mb-2 font-bold uppercase text-gray-900 group-hover:text-pdv-teal transition-colors">{service.name}</CardTitle>
                  <Badge variant="secondary" className="font-bold uppercase tracking-wider text-[10px]">
                    {dayLabels[service.day_of_week]}
                  </Badge>
                </div>
                {service.time && (
                  <div className="flex items-center gap-1 text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded text-sm">
                    <Clock className="w-4 h-4" />
                    {service.time}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="w-4 h-4" />
                  <span>{service.location || "Sin ubicación"}</span>
                </div>
                
                {service.description && (
                  <p className="text-sm text-gray-500 line-clamp-2">{service.description}</p>
                )}

                <div className="pt-3 border-t border-gray-200 flex flex-wrap gap-2">
                  <Link to={createPageUrl(`ServiceDetail?id=${service.id}`)} className="flex-grow min-w-[120px]">
                    <Button variant="outline" size="sm" className="w-full border-pdv-teal text-pdv-teal hover:bg-pdv-teal hover:text-white">
                      <Layers className="w-4 h-4 mr-2" />
                      Gestionar
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm" onClick={() => openEditDialog(service)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    title="Configurar Detalles"
                    onClick={() => {
                      setServiceToApplyBlueprint(service);
                      setSelectedBlueprintToConfigure(service.id); // Use service ID as "blueprint" to load its own data
                      setShowBlueprintConfigDialog(true);
                    }}
                  >
                    <Wand2 className="w-4 h-4 text-pdv-teal" />
                  </Button>

                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDeleteClick(service)}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900 font-['Bebas_Neue'] tracking-wide uppercase">{editingService ? 'Editar Servicio' : 'Nuevo Servicio'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Blueprint Selector (Only for new services) */}
            {!editingService && (
                <div className="space-y-2">
                    <Label>Usar Plantilla (Blueprint)</Label>
                    <Select 
                        onValueChange={(val) => {
                            const bp = blueprints.find(b => b.id === val);
                            if(bp) {
                                setFormData({
                                    ...formData,
                                    name: bp.name, // Pre-fill name
                                    day_of_week: bp.day_of_week,
                                    time: bp.time,
                                    location: bp.location,
                                    description: bp.description,
                                    blueprint_id: bp.id
                                });
                            }
                        }}
                    >
                        <SelectTrigger><SelectValue placeholder="Seleccionar Plantilla..." /></SelectTrigger>
                        <SelectContent>
                            {blueprints.map(bp => (
                                <SelectItem key={bp.id} value={bp.id}>{bp.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Nombre del Servicio *</Label>
              <div className="relative">
                <Input 
                  id="name" 
                  value={formData.name}
                  onChange={(e) => updateFormField('name', e.target.value)}
                  required 
                  placeholder="Servicio Dominical AM"
                />
                <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'name')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="day_of_week">Día *</Label>
                <Select value={formData.day_of_week} onValueChange={(value) => updateFormField('day_of_week', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sunday">Domingo</SelectItem>
                    <SelectItem value="Monday">Lunes</SelectItem>
                    <SelectItem value="Tuesday">Martes</SelectItem>
                    <SelectItem value="Wednesday">Miércoles</SelectItem>
                    <SelectItem value="Thursday">Jueves</SelectItem>
                    <SelectItem value="Friday">Viernes</SelectItem>
                    <SelectItem value="Saturday">Sábado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Hora Default</Label>
                <div className="relative">
                  <Input 
                    id="time" 
                    type="time"
                    value={formData.time}
                    onChange={(e) => updateFormField('time', e.target.value)}
                  />
                  <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'time')} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Ubicación Default</Label>
              <div className="relative">
                <Input 
                  id="location" 
                  value={formData.location}
                  onChange={(e) => updateFormField('location', e.target.value)}
                  placeholder="Santuario Principal"
                />
                <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'location')} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <div className="relative">
                <Textarea 
                  id="description" 
                  value={formData.description}
                  onChange={(e) => updateFormField('description', e.target.value)}
                  rows={3}
                />
                <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'description')} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <Select value={formData.status} onValueChange={(value) => updateFormField('status', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="archived">Archivado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="text-white font-bold uppercase" style={gradientStyle}>
                {editingService ? 'Guardar' : 'Crear'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {showBlueprintConfigDialog && (
        <BlueprintConfigurationModal
          isOpen={showBlueprintConfigDialog}
          onClose={() => {
            setShowBlueprintConfigDialog(false);
            setServiceToApplyBlueprint(null);
            setSelectedBlueprintToConfigure(null);
          }}
          blueprintId={selectedBlueprintToConfigure}
          initialServiceData={serviceToApplyBlueprint ? serviceToApplyBlueprint : newServiceDraftData}
          title={serviceToApplyBlueprint ? `Configurar: ${serviceToApplyBlueprint.name}` : "Configurar Servicio desde Plantilla"}
          onSave={(data) => {
            if (serviceToApplyBlueprint) {
              // If we are editing an existing service (using its own ID as blueprint), we update.
              // If we were applying a NEW blueprint, we'd use applyBlueprintMutation.
              // Since we removed the selector for existing services, we assume update mode here 
              // if blueprintId matches serviceId or simply if we are in "edit existing" flow.
              
              if (selectedBlueprintToConfigure === serviceToApplyBlueprint.id) {
                 updateServiceConfigurationMutation.mutate({
                   serviceId: serviceToApplyBlueprint.id,
                   blueprintSessionSegmentData: data.blueprintSessionSegmentData
                 });
              } else {
                 // Fallback for apply template logic if we re-enable it later
                 applyBlueprintMutation.mutate({
                   serviceId: serviceToApplyBlueprint.id,
                   blueprintId: selectedBlueprintToConfigure,
                   blueprintSessionSegmentData: data.blueprintSessionSegmentData
                 });
              }
            } else {
              createMutation.mutate(data);
            }
          }}
          isSaving={createMutation.isLoading || applyBlueprintMutation.isLoading || updateServiceConfigurationMutation.isLoading}
        />
      )}

      <Dialog open={showBlueprintSelector} onOpenChange={(open) => {
        setShowBlueprintSelector(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Seleccionar Plantilla</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Elige una plantilla para aplicar a "{serviceToApplyBlueprint?.name}"</Label>
              <Select 
                onValueChange={(val) => {
                  setSelectedBlueprintToConfigure(val);
                  setShowBlueprintSelector(false);
                  setShowBlueprintConfigDialog(true);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Seleccionar Plantilla..." /></SelectTrigger>
                <SelectContent>
                  {blueprints.map(bp => (
                    <SelectItem key={bp.id} value={bp.id}>{bp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-gray-500 bg-yellow-50 p-2 rounded">
              Nota: Al aplicar una plantilla, se agregarán las sesiones y segmentos de la plantilla al servicio existente. No se borrará el contenido actual.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
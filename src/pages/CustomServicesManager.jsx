import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLanguage } from "@/components/utils/i18n";
import { hasPermission } from "@/components/utils/permissions";
import { useCurrentUser } from "@/components/utils/useCurrentUser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, Clock, ChevronDown, ChevronUp, Archive, Trash2, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { es as esLocale } from "date-fns/locale";
import DeleteServiceDialog from "@/components/service/DeleteServiceDialog";

export default function CustomServicesManager() {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const [showArchived, setShowArchived] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [restoringId, setRestoringId] = useState(null);
  // Audit fix: Use shared useCurrentUser hook instead of manual auth.me()
  const { user } = useCurrentUser();

  const gradientStyle = {
    background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)',
  };

  // Fetch one-off / custom services (exclude soft-deleted)
  // Supports both new service_type field and legacy structural detection
  const { data: allServices = [], isLoading, refetch } = useQuery({
    queryKey: ['customServices'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const services = await base44.entities.Service.filter({ status: 'active' }, '-date');
      return services.filter(s =>
        s.service_type === 'one_off' ||
        // Legacy fallback: has segments array but no service_type set
        (!s.service_type && s.segments && s.segments.length > 0)
      );
    },
  });

  // 2026-03-25: Fetch soft-deleted services for trash view
  const { data: deletedServices = [], refetch: refetchDeleted } = useQuery({
    queryKey: ['customServicesDeleted'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const services = await base44.entities.Service.filter({ status: 'deleted' }, '-updated_date');
      return services.filter(s =>
        s.service_type === 'one_off' ||
        (!s.service_type && s.segments && s.segments.length > 0)
      );
    },
  });

  // Split into upcoming and archived
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const upcoming = allServices.filter(s => {
    if (!s.date) return true; // If no date, show in upcoming
    const [year, month, day] = s.date.split('-').map(Number);
    const serviceDate = new Date(year, month - 1, day, 0, 0, 0, 0);
    // Include today in upcoming (>= today)
    return serviceDate >= today;
  });

  const archived = allServices.filter(s => {
    if (!s.date) return false;
    const [year, month, day] = s.date.split('-').map(Number);
    const serviceDate = new Date(year, month - 1, day, 0, 0, 0, 0);
    return serviceDate < today;
  });

  const handleCreateNew = () => {
    // V2 (2026-03-02): Route new services to entity-first editor
    navigate(createPageUrl('CustomEditorV2'));
  };

  const handleEdit = (serviceId) => {
    // V2 (2026-03-02): Route to entity-first editor
    navigate(createPageUrl('CustomEditorV2') + `?id=${serviceId}`);
  };

  const handleDeleteClick = (e, service) => {
    e.stopPropagation(); // Prevent card click navigation
    setSelectedService(service);
    setDeleteDialogOpen(true);
  };

  const handleDeleteSuccess = () => {
    refetch();
    refetchDeleted();
  };

  // 2026-03-25: Restore a soft-deleted service
  const handleRestore = async (serviceId) => {
    setRestoringId(serviceId);
    try {
      await base44.entities.Service.update(serviceId, {
        status: 'active',
        deleted_at: null,
        deleted_by: null,
      });
      const { toast } = await import('sonner');
      toast.success(t('custom.restoreSuccess') || 'Service restored');
      refetch();
      refetchDeleted();
    } catch (error) {
      console.error('Failed to restore service:', error);
      const { toast } = await import('sonner');
      toast.error(t('custom.restoreError') || 'Failed to restore service');
    } finally {
      setRestoringId(null);
    }
  };

  // Helper to parse "YYYY-MM-DD" as local date at midnight to prevent timezone shifts
  const parseLocalDate = (dateStr) => {
    if (!dateStr) return null;
    // Append T00:00:00 to treat as local time in Date constructor (or manually parse)
    // Safer to split and construct:
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  };

  const getStatusColor = (service) => {
    if (!service.date) return 'bg-gray-500';
    const serviceDate = parseLocalDate(service.date);
    const daysUntil = Math.floor((serviceDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntil < 0) return 'bg-gray-500';
    if (daysUntil === 0) return 'bg-green-500';
    if (daysUntil <= 7) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  const getStatusLabel = (service) => {
    if (!service.date) return t('custom.noDate');
    const serviceDate = parseLocalDate(service.date);
    const daysUntil = Math.floor((serviceDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntil < 0) return t('custom.past');
    if (daysUntil === 0) return t('custom.today');
    if (daysUntil === 1) return t('custom.tomorrow');
    return t('custom.inDays').replace('{n}', daysUntil);
  };

  return (
    <div className="min-h-screen bg-[#F0F1F3]">
      {/* Header */}
      <div style={gradientStyle} className="px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl md:text-4xl uppercase text-white mb-2">
            {t('custom.title')}
          </h1>
          <p className="text-white/90">
            {t('custom.subtitle')}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Create New Button */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl text-gray-900">
              {t('custom.upcomingTitle')}
            </h2>
            <p className="text-gray-600 text-sm">
              {t('custom.scheduledCount').replace('{count}', upcoming.length)}
            </p>
          </div>
          {hasPermission(user, 'create_services') && (
            <Button
              onClick={handleCreateNew}
              className="text-white font-semibold shadow-lg"
              style={gradientStyle}
              size="lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              {t('custom.createService')}
            </Button>
          )}
        </div>

        {/* Upcoming Services Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {t('common.loading')}
            </p>
          </div>
        ) : upcoming.length === 0 ? (
          <Card className="p-12 text-center border-2 border-dashed border-gray-300">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">
              {t('custom.noServices')}
            </p>
            <Button onClick={handleCreateNew} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              {t('custom.createFirst')}
            </Button>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcoming.map((service) => (
              <Card 
                key={service.id}
                className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-gray-200"
                onClick={() => handleEdit(service.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start mb-2">
                    <Badge className={`${getStatusColor(service)} text-white`}>
                      {getStatusLabel(service)}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        {service.segments?.length || 0} {t('common.segments')}
                      </span>
                      {hasPermission(user, 'delete_services') && (
                        <button
                          onClick={(e) => handleDeleteClick(e, service)}
                          className="text-gray-400 hover:text-red-600 transition-colors p-1"
                          title={t('common.delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <CardTitle className="text-xl text-gray-900">{service.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {service.date && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      {/* 2026-03-03: Use locale-aware date format for consistency with WeeklyServiceManager */}
                      {(() => {
                       const [y, m, d] = service.date.split('-').map(Number);
                       const localDate = new Date(y, m - 1, d);
                       return format(localDate, "d 'de' MMM, yyyy", { locale: language === 'es' ? esLocale : undefined });
                      })()}
                      </div>
                      )}
                      {service.time && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4" />
                      {service.time}
                      </div>
                      )}
                      {service.description && (
                      <p className="text-sm text-gray-500 line-clamp-2 mt-2">
                      {service.description}
                      </p>
                      )}
                      </CardContent>
                      </Card>
                      ))}
                      </div>
                      )}

                      {/* Archived Services Section */}
                      {archived.length > 0 && (
                      <div className="mt-8">
                      <Button
                      variant="ghost"
                      onClick={() => setShowArchived(!showArchived)}
                      className="mb-4 text-gray-700"
                      >
                      <Archive className="w-4 h-4 mr-2" />
                      {t('custom.pastServices')} ({archived.length})
                      {showArchived ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
                      </Button>

                      {showArchived && (
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {archived.map((service) => (
                      <Card 
                      key={service.id}
                      className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-gray-200 opacity-75"
                      onClick={() => handleEdit(service.id)}
                      >
                      <CardHeader className="pb-3">
                      <div className="flex justify-between items-start mb-2">
                       <Badge className="bg-gray-500 text-white">
                         {t('custom.completed')}
                        </Badge>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">
                            {service.segments?.length || 0} {t('common.segments')}
                          </span>
                          {hasPermission(user, 'delete_services') && (
                            <button
                              onClick={(e) => handleDeleteClick(e, service)}
                              className="text-gray-400 hover:text-red-600 transition-colors p-1"
                              title={t('common.delete')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <CardTitle className="text-xl text-gray-900">{service.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                      {service.date && (
                       <div className="flex items-center gap-2 text-sm text-gray-600">
                         <Calendar className="w-4 h-4" />
                         {(() => {
                           const [y, m, d] = service.date.split('-').map(Number);
                           const localDate = new Date(y, m - 1, d);
                           return format(localDate, "d 'de' MMM, yyyy", { locale: language === 'es' ? esLocale : undefined });
                         })()}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 2026-03-25: Trash / Recently Deleted section */}
        {deletedServices.length > 0 && (
          <div className="mt-8">
            <Button
              variant="ghost"
              onClick={() => setShowTrash(!showTrash)}
              className="mb-4 text-gray-700"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t('custom.trash')} ({deletedServices.length})
              {showTrash ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
            </Button>

            {showTrash && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {deletedServices.map((service) => (
                  <Card
                    key={service.id}
                    className="border-2 border-dashed border-red-200 opacity-60 hover:opacity-80 transition-opacity"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start mb-2">
                        <Badge className="bg-red-500 text-white">
                          {t('custom.deletedLabel')}
                        </Badge>
                      </div>
                      <CardTitle className="text-xl text-gray-900 line-through">{service.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {service.date && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          {(() => {
                            const [y, m, d] = service.date.split('-').map(Number);
                            const localDate = new Date(y, m - 1, d);
                            return format(localDate, "d 'de' MMM, yyyy", { locale: language === 'es' ? esLocale : undefined });
                          })()}
                        </div>
                      )}
                      {service.deleted_by && (
                        <p className="text-xs text-gray-400">
                          {t('custom.deletedBy')} {service.deleted_by}
                        </p>
                      )}
                      {hasPermission(user, 'delete_services') && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 w-full"
                          onClick={() => handleRestore(service.id)}
                          disabled={restoringId === service.id}
                        >
                          <RotateCcw className="w-4 h-4 mr-2" />
                          {restoringId === service.id
                            ? (t('custom.restoring') || 'Restoring...')
                            : (t('custom.restore') || 'Restore')}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        <DeleteServiceDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          service={selectedService}
          onDeleteSuccess={handleDeleteSuccess}
        />
      </div>
    </div>
  );
}
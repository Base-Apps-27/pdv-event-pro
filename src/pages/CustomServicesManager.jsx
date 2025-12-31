import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLanguage } from "@/components/utils/i18n";
import { hasPermission } from "@/components/utils/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, Clock, ChevronDown, ChevronUp, Archive } from "lucide-react";
import { format } from "date-fns";

export default function CustomServicesManager() {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const [showArchived, setShowArchived] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    fetchUser();
  }, []);

  const gradientStyle = {
    background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)',
  };

  // Fetch all custom services (those with 'segments' array populated)
  const { data: allServices = [], isLoading } = useQuery({
    queryKey: ['customServices'],
    queryFn: async () => {
      const services = await base44.entities.Service.list('-date');
      // Filter to only custom services (those with segments array and not WeeklyServiceManager format)
      return services.filter(s => 
        s.segments && 
        s.segments.length > 0 && 
        s.status === 'active'
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
    navigate(createPageUrl('CustomServiceBuilder'));
  };

  const handleEdit = (serviceId) => {
    navigate(createPageUrl('CustomServiceBuilder') + `?id=${serviceId}`);
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
    if (!service.date) return language === 'es' ? 'Sin Fecha' : 'No Date';
    const serviceDate = parseLocalDate(service.date);
    const daysUntil = Math.floor((serviceDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntil < 0) return language === 'es' ? 'Pasado' : 'Past';
    if (daysUntil === 0) return language === 'es' ? 'HOY' : 'TODAY';
    if (daysUntil === 1) return language === 'es' ? 'Mañana' : 'Tomorrow';
    if (daysUntil <= 7) return language === 'es' ? `En ${daysUntil} días` : `In ${daysUntil} days`;
    return language === 'es' ? `En ${daysUntil} días` : `In ${daysUntil} days`;
  };

  return (
    <div className="min-h-screen bg-[#F0F1F3]">
      {/* Header */}
      <div style={gradientStyle} className="px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold uppercase text-white mb-2">
            {language === 'es' ? 'Servicios Personalizados' : 'Custom Services'}
          </h1>
          <p className="text-white/90">
            {language === 'es' 
              ? 'Crea y gestiona servicios especiales y eventos únicos' 
              : 'Create and manage special services and one-time events'}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Create New Button */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {language === 'es' ? 'Próximos Servicios' : 'Upcoming Services'}
            </h2>
            <p className="text-gray-600 text-sm">
              {language === 'es' 
                ? `${upcoming.length} servicio${upcoming.length !== 1 ? 's' : ''} programado${upcoming.length !== 1 ? 's' : ''}`
                : `${upcoming.length} service${upcoming.length !== 1 ? 's' : ''} scheduled`}
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
              {language === 'es' ? 'Crear Servicio' : 'Create Service'}
            </Button>
          )}
        </div>

        {/* Upcoming Services Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {language === 'es' ? 'Cargando...' : 'Loading...'}
            </p>
          </div>
        ) : upcoming.length === 0 ? (
          <Card className="p-12 text-center border-2 border-dashed border-gray-300">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">
              {language === 'es' 
                ? 'No hay servicios personalizados programados' 
                : 'No custom services scheduled'}
            </p>
            <Button onClick={handleCreateNew} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              {language === 'es' ? 'Crear el Primero' : 'Create First One'}
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
                    <span className="text-xs text-gray-500">
                      {service.segments?.length || 0} {language === 'es' ? 'segmentos' : 'segments'}
                    </span>
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
                        return format(localDate, 'MMM d, yyyy');
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
              {language === 'es' ? 'Servicios Pasados' : 'Past Services'} ({archived.length})
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
                          {language === 'es' ? 'Finalizado' : 'Completed'}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {service.segments?.length || 0} {language === 'es' ? 'segmentos' : 'segments'}
                        </span>
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
                            return format(localDate, 'MMM d, yyyy');
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
      </div>
    </div>
  );
}
import React, { createContext, useContext, useState, useEffect } from 'react';

const translations = {
  es: {
    // Navigation
    'nav.dashboard': 'Inicio',
    'nav.liveProgram': 'Programa en Vivo',
    'nav.events': 'Eventos',
    'nav.services': 'Servicios',
    'nav.reports': 'Informes de Eventos',
    'nav.announcements': 'Anuncios',
    'nav.people': 'Personas',
    'nav.rooms': 'Salas',
    'nav.templates': 'Plantillas',
    'nav.importer': 'Importador IA',
    'nav.schema': 'Guía de Datos',
    
    // Sections
    'section.main': 'Panel Principal',
    'section.live': 'En Vivo',
    'section.events': 'Eventos Especiales',
    'section.services': 'Servicios Semanales',
    'section.resources': 'Recursos Compartidos',
    'section.settings': 'Gestión y Configuración',
    
    // Dashboard
    'dashboard.title': 'Panel de Control',
    'dashboard.subtitle': 'Gestiona eventos especiales y servicios semanales',
    'dashboard.events.title': 'Eventos Especiales',
    'dashboard.events.subtitle': 'Congresos, retiros, conferencias',
    'dashboard.services.title': 'Servicios Semanales',
    'dashboard.services.subtitle': 'Domingos, miércoles, operación regular',
    'dashboard.events.total': 'Total Eventos',
    'dashboard.events.sessions': 'Sesiones',
    'dashboard.events.segments': 'Segmentos',
    'dashboard.services.active': 'Servicios Activos',
    'dashboard.services.templates': 'Plantillas',
    'dashboard.upcoming': 'Próximos Eventos',
    'dashboard.other': 'Otros Eventos',
    'dashboard.no_events': 'No hay eventos próximos',
    'dashboard.create_first': 'Comienza creando tu primer evento',
    
    // Buttons
    'btn.view': 'Ver',
    'btn.view_events': 'Ver Eventos',
    'btn.view_services': 'Ver Servicios',
    'btn.manage_services': 'Gestionar Servicios',
    'btn.view_details': 'Ver Detalles',
    'btn.create_event': 'Crear Evento',
    'btn.view_all': 'Ver Todos los Eventos',
    'btn.cancel': 'Cancelar',
    'btn.confirm': 'Confirmar y Crear',
    'btn.save': 'Guardar Cambios',
    'btn.add': 'Agregar',
    'btn.edit': 'Editar',
    'btn.delete': 'Eliminar',
    'btn.live_view': 'Vista en Vivo',
    'btn.print_settings': 'Config. Impresión',
    'btn.print': 'Imprimir',
    'btn.saving': 'Guardando...',

    // Voice
    'voice.dictate': 'Dictar',
    'voice.use_keyboard_mic': 'Usa el micrófono del teclado del dispositivo',
    'voice.listening': 'Escuchando...',
    'voice.voice': 'Voz',
    'voice.mic_title': 'Micrófono',
    'voice.start_dictation': 'Activar dictado nativo',
    
    // Status
    'status.planning': 'EN PLANIFICACIÓN',
    'status.confirmed': 'CONFIRMADO',
    'status.in_progress': 'EN CURSO',
    'status.completed': 'COMPLETADO',
    'status.archived': 'ARCHIVADO',
    
    // Common
    'common.language': 'Idioma',
    'common.date': 'Fecha',
    'common.location': 'Ubicación',
    'common.sessions': 'sesiones',
    'common.segments': 'segmentos',
    // Fields
    'field.title': 'Título',
    'field.start_time': 'Hora de inicio',
    'field.duration_min': 'Duración (min)',
    'field.presenter': 'Presentador',
    // Errors
    'error.required_fields_missing': 'Faltan campos obligatorios',
    'error.please_complete': 'Por favor completa:'
  },
  en: {
    // Navigation
    'nav.dashboard': 'Home',
    'nav.liveProgram': 'Live Program',
    'nav.events': 'Events',
    'nav.services': 'Services',
    'nav.reports': 'Event Reports',
    'nav.announcements': 'Announcements',
    'nav.people': 'People',
    'nav.rooms': 'Rooms',
    'nav.templates': 'Templates',
    'nav.importer': 'AI Importer',
    'nav.schema': 'Data Guide',
    
    // Sections
    'section.main': 'Main Panel',
    'section.live': 'Live',
    'section.events': 'Special Events',
    'section.services': 'Weekly Services',
    'section.resources': 'Shared Resources',
    'section.settings': 'Management & Configuration',
    
    // Dashboard
    'dashboard.title': 'Control Panel',
    'dashboard.subtitle': 'Manage special events and weekly services',
    'dashboard.events.title': 'Special Events',
    'dashboard.events.subtitle': 'Conferences, retreats, special gatherings',
    'dashboard.services.title': 'Weekly Services',
    'dashboard.services.subtitle': 'Sundays, Wednesdays, regular operations',
    'dashboard.events.total': 'Total Events',
    'dashboard.events.sessions': 'Sessions',
    'dashboard.events.segments': 'Segments',
    'dashboard.services.active': 'Active Services',
    'dashboard.services.templates': 'Templates',
    'dashboard.upcoming': 'Upcoming Events',
    'dashboard.other': 'Other Events',
    'dashboard.no_events': 'No upcoming events',
    'dashboard.create_first': 'Start by creating your first event',
    
    // Buttons
    'btn.view': 'View',
    'btn.view_events': 'View Events',
    'btn.view_services': 'View Services',
    'btn.manage_services': 'Manage Services',
    'btn.view_details': 'View Details',
    'btn.create_event': 'Create Event',
    'btn.view_all': 'View All Events',
    'btn.cancel': 'Cancel',
    'btn.confirm': 'Confirm and Create',
    'btn.save': 'Save Changes',
    'btn.add': 'Add',
    'btn.edit': 'Edit',
    'btn.delete': 'Delete',
    'btn.live_view': 'Live View',
    'btn.print_settings': 'Print Settings',
    'btn.print': 'Print',
    'btn.saving': 'Saving...',

    // Voice
    'voice.dictate': 'Dictate',
    'voice.use_keyboard_mic': 'Use your keyboard microphone',
    'voice.listening': 'Listening...',
    'voice.voice': 'Voice',
    'voice.mic_title': 'Microphone',
    'voice.start_dictation': 'Activate native dictation',
    
    // Status
    'status.planning': 'PLANNING',
    'status.confirmed': 'CONFIRMED',
    'status.in_progress': 'IN PROGRESS',
    'status.completed': 'COMPLETED',
    'status.archived': 'ARCHIVED',
    
    // Common
    'common.language': 'Language',
    'common.date': 'Date',
    'common.location': 'Location',
    'common.sessions': 'sessions',
    'common.segments': 'segments',
    // Fields
    'field.title': 'Title',
    'field.start_time': 'Start time',
    'field.duration_min': 'Duration (min)',
    'field.presenter': 'Presenter',
    // Errors
    'error.required_fields_missing': 'Required fields are missing',
    'error.please_complete': 'Please complete:'

    // Live Admin
    'live.admin_mode': 'Live Director Mode',
    'live.enabled': 'Live adjustments enabled',
    'live.disabled': 'Live adjustments disabled',
    'live.mark_ended': 'End Now',
    'live.delay': 'Delay',
    'live.segment_ended': 'Segment marked as ended',
    'live.time_adjusted': 'Time adjusted by {minutes} min',
    'live.active_warning': 'Changes override planned times',
    'live.current': 'Current',
  }
};

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('language') || 'es';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const t = (key) => {
    return translations[language]?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
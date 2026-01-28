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
          'nav.customServices': 'Servicios Personalizados',
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
          'btn.skip': 'Omitir',

          // Session Date Fix modal
          'sessionsDateFix.title': 'Actualizar fechas de sesiones',
          'sessionsDateFix.subtitle': 'Algunas sesiones están fuera del nuevo rango del evento. Ajusta sus fechas a continuación.',
          'sessionsDateFix.none': 'No hay sesiones fuera del rango.' ,
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

    // Public Program (es)
    'public.headerTitle': 'Programa',
    'public.notificationsActive': 'Notificaciones activas',
    'public.explore': 'Explora el programa completo y mantente al día',
    'public.events': 'Eventos',
    'public.services': 'Servicios',
    'public.selectEvent': 'Selecciona un evento',
    'public.selectService': 'Selecciona un servicio',
    'public.hideDetails': 'Ocultar detalles',
    'public.viewMoreDetails': 'Ver más detalles',
    'public.noSessions': 'No hay sesiones disponibles para este evento',
    'public.selectPromptEvent': 'Selecciona un evento para ver su programa',
    'public.selectPromptService': 'Selecciona un servicio para ver su programa',

    // Live Adjustments (es)
    'adjustments.saveSuccess': 'Ajuste guardado',
    'adjustments.saveError': 'Error al guardar el ajuste',
    'adjustments.authorizedBy': 'Autorizado por',
    'adjustments.appliedBy': 'Aplicado por',
    'adjustments.time': 'Hora',
    'adjustments.adjustStart': 'Ajustar hora de inicio',
    'adjustments.timeSlot930am': '9:30 A.M.',
    'adjustments.timeSlot1130am': '11:30 A.M.',

    // Services (es)
    'service.specialService': 'Servicio especial',

    // Panel
    'panel.moderators': 'Moderador(es)',
    'panel.topic': 'Tema/Tópico',
    'panel.panelists': 'Panelista(s)',
    // Fields
    'field.title': 'Título',
    'field.start_time': 'Hora de inicio',
    'field.duration_min': 'Duración (min)',
    'field.presenter': 'Presentador',
          'field.type': 'Tipo',
          'field.room': 'Sala',
    // Errors
    'error.required_fields_missing': 'Faltan campos obligatorios',
    'error.please_complete': 'Por favor completa:',
    'hint.allowed_placeholders': 'Se permiten marcadores como "TBD", "Por definir" o "---"',
      'error.save_failed': 'No se pudo guardar el segmento'
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
          'nav.customServices': 'Custom Services',
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
          'btn.skip': 'Skip',

          // Session Date Fix modal
          'sessionsDateFix.title': 'Update session dates',
          'sessionsDateFix.subtitle': 'Some sessions fall outside the event\'s new date range. Adjust their dates below.',
          'sessionsDateFix.none': 'No out-of-range sessions.' ,
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
          'field.type': 'Type',
          'field.room': 'Room',
    // Errors
    'error.required_fields_missing': 'Required fields are missing',
    'error.please_complete': 'Please complete:',
    'hint.allowed_placeholders': 'Placeholders like "TBD", "To be defined", or "---" are allowed',
      'error.save_failed': 'Failed to save segment',

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

    // Live View labels
    'live.preacher': 'Preacher',
    'live.translator': 'Translator',
    'live.preparation': 'Preparation',
    'live.during': 'During Segment',
    'live.songs': 'Songs',
    'live.message': 'Message',
    'live.scriptures': 'Scriptures',
    'live.viewVerses': 'View Verses',
    'live.extractSaveVerses': 'Extract/Save Verses',
    'live.coordination': 'Coordination',
    'live.projection': 'Projection',
    'live.sound': 'Sound',
    'live.ushers': 'Ushers',
    'live.translation': 'Translation',
    'live.stageDecor': 'Stage & Decor',
    'live.notes': 'Notes',
    'live.roomAssigned': 'Assigned room',
    'live.video': 'Video',
    'live.majorBreak': 'Major Break',
    'live.slides': 'Slides',
    'live.countdown': 'Countdown',

    // Public Program (essentials)
    'public.headerTitle': 'Program',
    'public.notificationsActive': 'Notifications active',
    'public.explore': 'Explore the full program and stay updated',
    'public.events': 'Events',
    'public.services': 'Services',
    'public.selectEvent': 'Select an event',
    'public.selectService': 'Select a service',
    'public.hideDetails': 'Hide Details',
    'public.viewMoreDetails': 'View More Details',
    'public.noSessions': 'No sessions available for this event',
    'public.selectPromptEvent': 'Select an event to view its program',
    'public.selectPromptService': 'Select a service to view its program',

    // Live Adjustments (en)
    'adjustments.saveSuccess': 'Adjustment saved',
    'adjustments.saveError': 'Failed to save adjustment',
    'adjustments.authorizedBy': 'Authorized by',
    'adjustments.appliedBy': 'Applied by',
    'adjustments.time': 'Time',
    'adjustments.adjustStart': 'Adjust Start Time',
    'adjustments.timeSlot930am': '9:30 A.M.',
    'adjustments.timeSlot1130am': '11:30 A.M.',

    // Services (en)
    'service.specialService': 'Special service',

    // Panel
    'panel.moderators': 'Moderator(s)',
    'panel.topic': 'Topic',
    'panel.panelists': 'Panelist(s)',

    // Announcements (essentials)
    'ann.title': 'Announcements Management',
    'ann.subtitle': 'Unified view of dynamic announcements, events, and segments',
    'ann.new': 'New Announcement',
    'ann.print': 'Print Report',
    'ann.reportTitle': 'Announcements Report',
    'ann.generatedOn': 'Generated on',
  }
};

// Normalize language codes like 'es-ES', 'en-US' to base keys we support
function normalizeLang(lang) {
  if (!lang) return 'es';
  const l = String(lang).toLowerCase();
  if (l.startsWith('en')) return 'en';
  if (l.startsWith('es')) return 'es';
  return 'es';
}

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    const stored = localStorage.getItem('language') || 'es';
    return normalizeLang(stored);
  });

  useEffect(() => {
    localStorage.setItem('language', normalizeLang(language));
  }, [language]);

  const t = (key) => {
    const lang = normalizeLang(language);
    return translations[lang]?.[key] || key;
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
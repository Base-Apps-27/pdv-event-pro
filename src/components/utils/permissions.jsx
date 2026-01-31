/**
 * Permission Management Utilities
 * Handles hierarchical permission checks and role-based access control
 */

// Permission hierarchy: higher levels include all lower levels
const PERMISSION_HIERARCHY = {
  view: 0,
  edit: 1,
  create: 2,
  delete: 3,
  manage: 4,
  access: 4,
};

// Default role permissions (fallback for legacy app_role field)
// Role = template, user-level custom_permissions/revoked_permissions = final authority
const DEFAULT_ROLE_PERMISSIONS = {
  Admin: [
    'view_events', 'edit_events', 'create_events', 'delete_events',
    'view_services', 'edit_services', 'create_services', 'delete_services',
    'view_templates', 'edit_templates', 'create_templates', 'delete_templates',
    'view_people', 'edit_people', 'create_people', 'delete_people',
    'view_rooms', 'edit_rooms', 'create_rooms', 'delete_rooms',
    'view_announcements', 'edit_announcements', 'create_announcements', 'delete_announcements',
    'view_reports',
    'access_importer',
    'view_live_program',
    'view_live_chat',
    'manage_live_timing',
    'manage_users',
  ],
  LiveManager: [
    'view_live_program',
    'view_live_chat',
    'manage_live_timing',
    'adjust_service_timing',
  ],
  AdmAsst: [
    'view_events', 'edit_events', 'create_events',
    'view_services', 'edit_services', 'create_services',
    'view_reports',
    'view_announcements', 'edit_announcements', 'create_announcements',
    'view_people', 'edit_people', 'create_people',
    'view_live_program',
    'view_live_chat',
  ],
  EventDayViewer: [
    'view_live_program',
  ],
  // EventDayCoordinator: Same as EventDayViewer + view_live_chat + adjust_service_timing
  // For coordinators who need to participate in live operations chat and adjust service times
  EventDayCoordinator: [
    'view_live_program',
    'view_live_chat',
    'adjust_service_timing',
  ],
};

/**
 * Get all permissions for a user (role defaults + custom + revoked)
 */
export function getUserPermissions(user) {
  if (!user) return [];

  const permissions = new Set();

  // 1. Start with role-based permissions (role = template)
  const role = user.app_role || 'EventDayViewer';
  const rolePerms = DEFAULT_ROLE_PERMISSIONS[role] || [];
  
  rolePerms.forEach(p => permissions.add(p));

  // 2. Add custom permissions
  if (user.custom_permissions && Array.isArray(user.custom_permissions)) {
    user.custom_permissions.forEach(p => permissions.add(p));
  }

  // 3. Remove revoked permissions
  if (user.revoked_permissions && Array.isArray(user.revoked_permissions)) {
    user.revoked_permissions.forEach(p => permissions.delete(p));
  }

  return Array.from(permissions);
}

/**
 * Check if user has a specific permission (with hierarchy support)
 */
export function hasPermission(user, permissionKey) {
  if (!user || !permissionKey) return false;

  const userPermissions = getUserPermissions(user);

  // Direct match
  if (userPermissions.includes(permissionKey)) return true;

  // Check hierarchical permissions
  // e.g., if user has 'create_events' and checking for 'view_events', grant access
  const [action, resource] = permissionKey.split('_');
  const requiredLevel = PERMISSION_HIERARCHY[action];

  if (requiredLevel === undefined) return false;

  // Check if user has a higher-level permission on the same resource
  for (const userPerm of userPermissions) {
    const [userAction, userResource] = userPerm.split('_');
    
    // Must be same resource
    if (userResource !== resource) continue;

    const userLevel = PERMISSION_HIERARCHY[userAction];
    
    // User has higher or equal permission level
    if (userLevel !== undefined && userLevel >= requiredLevel) {
      return true;
    }
  }

  return false;
}

/**
 * Check if user has ANY of the provided permissions
 */
export function hasAnyPermission(user, permissionKeys) {
  if (!Array.isArray(permissionKeys)) return false;
  return permissionKeys.some(key => hasPermission(user, key));
}

/**
 * Check if user has ALL of the provided permissions
 */
export function hasAllPermissions(user, permissionKeys) {
  if (!Array.isArray(permissionKeys)) return false;
  return permissionKeys.every(key => hasPermission(user, key));
}

/**
 * Get all available permissions (for UI display)
 */
export function getAllPermissionDefinitions() {
  return [
    // Events
    { key: 'view_events', resource: 'events', action: 'view', category: 'events', hierarchy_level: 0, label_en: 'View Events', label_es: 'Ver Eventos' },
    { key: 'edit_events', resource: 'events', action: 'edit', category: 'events', hierarchy_level: 1, label_en: 'Edit Events', label_es: 'Editar Eventos' },
    { key: 'create_events', resource: 'events', action: 'create', category: 'events', hierarchy_level: 2, label_en: 'Create Events', label_es: 'Crear Eventos' },
    { key: 'delete_events', resource: 'events', action: 'delete', category: 'events', hierarchy_level: 3, label_en: 'Delete Events', label_es: 'Eliminar Eventos' },

    // Services
    { key: 'view_services', resource: 'services', action: 'view', category: 'services', hierarchy_level: 0, label_en: 'View Services', label_es: 'Ver Servicios' },
    { key: 'edit_services', resource: 'services', action: 'edit', category: 'services', hierarchy_level: 1, label_en: 'Edit Services', label_es: 'Editar Servicios' },
    { key: 'create_services', resource: 'services', action: 'create', category: 'services', hierarchy_level: 2, label_en: 'Create Services', label_es: 'Crear Servicios' },
    { key: 'delete_services', resource: 'services', action: 'delete', category: 'services', hierarchy_level: 3, label_en: 'Delete Services', label_es: 'Eliminar Servicios' },

    // Templates/Blueprints
    { key: 'view_templates', resource: 'templates', action: 'view', category: 'settings', hierarchy_level: 0, label_en: 'View Templates', label_es: 'Ver Plantillas' },
    { key: 'edit_templates', resource: 'templates', action: 'edit', category: 'settings', hierarchy_level: 1, label_en: 'Edit Templates', label_es: 'Editar Plantillas' },
    { key: 'create_templates', resource: 'templates', action: 'create', category: 'settings', hierarchy_level: 2, label_en: 'Create Templates', label_es: 'Crear Plantillas' },
    { key: 'delete_templates', resource: 'templates', action: 'delete', category: 'settings', hierarchy_level: 3, label_en: 'Delete Templates', label_es: 'Eliminar Plantillas' },

    // People
    { key: 'view_people', resource: 'people', action: 'view', category: 'resources', hierarchy_level: 0, label_en: 'View People', label_es: 'Ver Personas' },
    { key: 'edit_people', resource: 'people', action: 'edit', category: 'resources', hierarchy_level: 1, label_en: 'Edit People', label_es: 'Editar Personas' },
    { key: 'create_people', resource: 'people', action: 'create', category: 'resources', hierarchy_level: 2, label_en: 'Create People', label_es: 'Crear Personas' },
    { key: 'delete_people', resource: 'people', action: 'delete', category: 'resources', hierarchy_level: 3, label_en: 'Delete People', label_es: 'Eliminar Personas' },

    // Rooms
    { key: 'view_rooms', resource: 'rooms', action: 'view', category: 'settings', hierarchy_level: 0, label_en: 'View Rooms', label_es: 'Ver Salas' },
    { key: 'edit_rooms', resource: 'rooms', action: 'edit', category: 'settings', hierarchy_level: 1, label_en: 'Edit Rooms', label_es: 'Editar Salas' },
    { key: 'create_rooms', resource: 'rooms', action: 'create', category: 'settings', hierarchy_level: 2, label_en: 'Create Rooms', label_es: 'Crear Salas' },
    { key: 'delete_rooms', resource: 'rooms', action: 'delete', category: 'settings', hierarchy_level: 3, label_en: 'Delete Rooms', label_es: 'Eliminar Salas' },

    // Announcements
    { key: 'view_announcements', resource: 'announcements', action: 'view', category: 'services', hierarchy_level: 0, label_en: 'View Announcements', label_es: 'Ver Anuncios' },
    { key: 'edit_announcements', resource: 'announcements', action: 'edit', category: 'services', hierarchy_level: 1, label_en: 'Edit Announcements', label_es: 'Editar Anuncios' },
    { key: 'create_announcements', resource: 'announcements', action: 'create', category: 'services', hierarchy_level: 2, label_en: 'Create Announcements', label_es: 'Crear Anuncios' },
    { key: 'delete_announcements', resource: 'announcements', action: 'delete', category: 'services', hierarchy_level: 3, label_en: 'Delete Announcements', label_es: 'Eliminar Anuncios' },

    // Reports
    { key: 'view_reports', resource: 'reports', action: 'view', category: 'events', hierarchy_level: 0, label_en: 'View Reports', label_es: 'Ver Informes' },

    // Importer
    { key: 'access_importer', resource: 'importer', action: 'access', category: 'settings', hierarchy_level: 4, label_en: 'Access AI Importer', label_es: 'Acceder Importador IA' },

    // Live Program
    { key: 'view_live_program', resource: 'live_program', action: 'view', category: 'live', hierarchy_level: 0, label_en: 'View Live Program', label_es: 'Ver Programa en Vivo' },

    // User Management
    { key: 'manage_users', resource: 'users', action: 'manage', category: 'settings', hierarchy_level: 4, label_en: 'Manage Users', label_es: 'Gestionar Usuarios' },

    // Live Timing
    { key: 'manage_live_timing', resource: 'live_timing', action: 'manage', category: 'live', hierarchy_level: 2, label_en: 'Manage Live Timing', label_es: 'Gestionar Tiempos en Vivo' },

    // Live Chat
    { key: 'view_live_chat', resource: 'live_chat', action: 'view', category: 'live', hierarchy_level: 0, label_en: 'View Live Chat', label_es: 'Ver Chat en Vivo' },

    // Service Time Adjustment (for service coordinators to adjust start times)
    { key: 'adjust_service_timing', resource: 'service_timing', action: 'edit', category: 'live', hierarchy_level: 1, label_en: 'Adjust Service Timing', label_es: 'Ajustar Horario del Servicio' },
  ];
}
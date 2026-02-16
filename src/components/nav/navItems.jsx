// Shared navigation structure — single source of truth for desktop + mobile
// Each section has a label key, icon, and items. Permission gating happens at render time.
// Sidebar redesign 2026-02-14: consolidated from ~16 items to ~8 visible, grouped into
// primary quick-access items and a secondary "more" tray.

import { LayoutDashboard, Calendar, Bell, Clock, Plus, FileText, Users, Settings, MapPin, Copy, Sparkles, Shield, FileCode } from "lucide-react";

// PRIMARY: always visible in rail / bottom bar (max 5-6)
export const primaryNav = [
  {
    id: 'dashboard',
    labelKey: 'nav.dashboard',
    icon: LayoutDashboard,
    page: 'Dashboard',
    permission: 'view_events', // requires dashboard-level access (view_events OR view_services checked at render)
    matchPages: ['Dashboard'],
  },
  {
    id: 'live',
    labelKey: 'nav.liveProgram',
    icon: Bell,
    page: 'PublicProgramView',
    permission: 'access_live_view',
    matchPages: ['PublicProgramView', 'MyProgram'],
  },
  {
    id: 'events',
    labelKey: 'nav.events',
    icon: Calendar,
    page: 'Events',
    permission: 'view_events',
    matchPages: ['Events', 'EventDetail', 'Reports'],
  },
  {
    id: 'services',
    labelKey: 'nav.services',
    icon: Clock,
    page: 'WeeklyServiceManager',
    permission: 'view_services',
    matchPages: ['WeeklyServiceManager', 'CustomServicesManager', 'CustomServiceBuilder'],
  },
];

// SECONDARY: accessible from "more" tray or settings area
export const secondaryNav = [
  {
    id: 'myprogram',
    labelKey: 'myprogram.title',
    icon: Calendar,
    page: 'MyProgram',
    permission: 'access_my_program',
    matchPages: ['MyProgram'],
  },
  {
    id: 'custom-services',
    labelKey: 'nav.customServices',
    icon: Plus,
    page: 'CustomServicesManager',
    permission: 'view_services',
    matchPages: ['CustomServicesManager', 'CustomServiceBuilder'],
  },
  {
    id: 'reports',
    labelKey: 'nav.reports',
    icon: FileText,
    page: 'Reports',
    permission: 'view_events',
    matchPages: ['Reports'],
  },
  {
    id: 'people',
    labelKey: 'nav.people',
    icon: Users,
    page: 'People',
    permission: 'view_people',
    matchPages: ['People'],
  },
  {
    id: 'rooms',
    labelKey: 'nav.rooms',
    icon: MapPin,
    page: 'Rooms',
    permission: 'view_rooms',
    matchPages: ['Rooms'],
  },
  {
    id: 'templates',
    labelKey: 'nav.templates',
    icon: Copy,
    page: 'Templates',
    permission: 'view_templates',
    matchPages: ['Templates'],
  },
  {
    id: 'importer',
    labelKey: 'nav.importer',
    icon: Sparkles,
    page: 'ScheduleImporter',
    permission: 'access_importer',
    matchPages: ['ScheduleImporter'],
  },
  {
    id: 'users',
    labelKey: 'nav.userManagement',
    icon: Shield,
    page: 'UserManagement',
    permission: 'manage_users',
    matchPages: ['UserManagement', 'RolePermissionManager'],
  },
  {
    id: 'roles',
    labelKey: 'nav.roles',
    icon: Shield,
    page: 'RolePermissionManager',
    permission: 'manage_users',
    matchPages: ['RolePermissionManager'],
  },
  {
    id: 'messages',
    labelKey: 'nav.messages',
    icon: Sparkles,
    page: 'MessageProcessing',
    permission: 'manage_users',
    matchPages: ['MessageProcessing'],
  },
  {
    id: 'schema',
    labelKey: 'nav.schema',
    icon: FileCode,
    page: 'SchemaGuide',
    permission: 'manage_users',
    matchPages: ['SchemaGuide'],
  },
];
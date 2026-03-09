// Shared navigation structure — single source of truth for desktop + mobile
// Each section has a label key, icon, and items. Permission gating happens at render time.
// 2026-02-14: consolidated into primary rail + secondary "More" tray.
// 2026-02-18: slimmed secondary from 12→6 items. Admin tools moved to separate adminNav
//   to prevent "More" tray overflow on mobile. Merged roles into users matchPages.

import { LayoutDashboard, Calendar, Bell, Clock, Plus, FileText, Users, MapPin, Copy, Sparkles, Shield, FileCode, Wrench, Palette } from "lucide-react";

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
    matchPages: ['PublicProgramView'],
  },
  {
    id: 'events',
    labelKey: 'nav.events',
    icon: Calendar,
    page: 'Events',
    permission: 'view_events',
    matchPages: ['Events', 'EventDetail'],
  },
  {
    id: 'services',
    labelKey: 'nav.weeklyServices',
    icon: Clock,
    page: 'WeeklyServiceManager',
    permission: 'view_services',
    matchPages: ['WeeklyServiceManager'],
  },
];

// SECONDARY: user-facing items shown in "More" tray (max ~6 items for clean mobile UX)
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
    labelKey: 'nav.specialServices',
    icon: Plus,
    page: 'CustomServicesManager',
    permission: 'view_services',
    matchPages: ['CustomServicesManager', 'CustomEditorV2'],
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
];

// ADMIN: tools that require manage_users permission. Shown in a collapsible
// section below secondaryNav in the "More" tray. Keeps the main list short.
export const adminNav = [
  {
    id: 'users',
    labelKey: 'nav.userManagement',
    icon: Shield,
    page: 'UserManagement',
    permission: 'manage_users',
    // Merged: roles page accessible from user management, no separate nav entry needed
    matchPages: ['UserManagement', 'RolePermissionManager'],
  },
  {
    id: 'service-config',
    labelKey: 'nav.serviceConfig',
    icon: Wrench,
    page: 'ServiceBlueprints',
    permission: 'manage_users',
    matchPages: ['ServiceBlueprints'],
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
    id: 'messages',
    labelKey: 'nav.messages',
    icon: Sparkles,
    page: 'MessageProcessing',
    permission: 'manage_users',
    matchPages: ['MessageProcessing'],
  },
  {
    id: 'dev-tools',
    labelKey: 'nav.devTools',
    icon: FileCode,
    page: 'DevTools',
    permission: 'manage_users',
    matchPages: ['DevTools', 'SchemaGuide', 'DependencyTracker', 'ActivityLog'],
  },
  {
    id: 'arts-submissions',
    labelKey: 'nav.artsSubmissions',
    icon: Palette,
    page: 'ArtsSubmissions',
    permission: 'manage_users',
    matchPages: ['ArtsSubmissions'],
  },
];
import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useLanguage, LanguageProvider } from "@/components/utils/i18n";
import { hasPermission } from "@/components/utils/permissions";
import { useTheme } from "@/components/utils/useTheme";
import { Calendar, LayoutDashboard, ChevronDown, Menu, X, FileText, MapPin, Copy, Clock, Bell, Users, Sparkles, FileCode, Languages, Plus, Shield, Moon, Sun, ChevronLeft, ChevronRight } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";

function LayoutContent({ children }) {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&display=swap');
        h1, h2 {
          font-family: 'Anton', sans-serif !important;
          font-weight: 400;
        }
      `}</style>
      <LayoutContentInner>{children}</LayoutContentInner>
    </>
  );
}

function LayoutContentInner({ children }) {
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const gradientStyle = {
    background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)',
  };
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('sidebarCollapsed') === 'true';
    }
    return false;
  });

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
        const next = !prev;
        localStorage.setItem('sidebarCollapsed', String(next));
        return next;
    });
  };

  const isActive = (path) => location.pathname === path;

  // CRITICAL: PublicProgramView, PublicCountdownDisplay, AND /print/ routes bypass Layout auth checks
  const isPublicPage = location.pathname.includes('PublicProgramView') || location.pathname.includes('PublicCountdownDisplay') || location.pathname.includes('/print/');

  if (isPublicPage) {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  // Check authentication and get user role
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authenticated = await base44.auth.isAuthenticated();
        
        if (!authenticated) {
          setLoading(false);
          return;
        }

        const currentUser = await base44.auth.me();
        setUser(currentUser);
        setLoading(false);

      } catch (error) {
        console.error('Auth error:', error);
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  // Permission-based redirects
  useEffect(() => {
    if (!user || loading) return;

    const canViewDashboard = hasPermission(user, 'view_events') || hasPermission(user, 'view_services');
    
    // If a user has no permissions at all, they can only see the live program view.
    if (!canViewDashboard && !location.pathname.includes('PublicProgramView')) {
      navigate(createPageUrl('PublicProgramView'), { replace: true });
    }
  }, [user, location.pathname, loading, navigate]);

  if (loading) {
    return null;
  }

  // Not authenticated - show minimal layout
  if (!user) {
    return <div className="min-h-screen bg-[#F0F1F3]">{children}</div>;
  }

  // If user cannot view dashboard, they only get the minimal shell (similar to anonymous)
  if (!hasPermission(user, 'view_events') && !hasPermission(user, 'view_services')) {
    return <div className="min-h-screen bg-[#F0F1F3]">{children}</div>;
  }

  return (
    <div className="min-h-screen flex bg-[#F0F1F3]">
      {/* Dark Sidebar */}
      <aside className={`hidden lg:flex lg:flex-col ${isSidebarCollapsed ? 'lg:w-20' : 'lg:w-64'} bg-black text-white fixed h-full font-sans print:hidden transition-all duration-300 z-50`}>
        <div className={`p-6 mb-2 ${isSidebarCollapsed ? 'px-4' : ''}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shadow-lg shrink-0" style={gradientStyle}>
              <Calendar className="w-6 h-6 text-white" />
            </div>
            {!isSidebarCollapsed && (
              <div className="overflow-hidden whitespace-nowrap">
                <h2 className="text-white text-xl uppercase leading-none tracking-wide">PALABRAS DE VIDA</h2>
                <p className="text-[10px] text-pdv-green font-medium tracking-wider mt-1">¡ATRÉVETE A CAMBIAR!</p>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-800">
            {!isSidebarCollapsed && <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 mt-2 pl-3">{t('section.main')}</div>}
            <Link
              to={createPageUrl("Dashboard")}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                isActive(createPageUrl("Dashboard"))
                  ? "text-white shadow-md"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
              style={isActive(createPageUrl("Dashboard")) ? gradientStyle : {}}
              title={isSidebarCollapsed ? t('nav.dashboard') : ''}
            >
              <LayoutDashboard className="w-5 h-5 shrink-0" />
              {!isSidebarCollapsed && <span>{t('nav.dashboard')}</span>}
            </Link>

            {/* LIVE VIEW - All Roles */}
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 mt-6 pl-3 flex items-center gap-2">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-600 to-transparent"></div>
              <span>{t('section.live')}</span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-600 to-transparent"></div>
            </div>
            <Link
              to={createPageUrl("PublicProgramView")}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                isActive(createPageUrl("PublicProgramView"))
                  ? "text-white shadow-md"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
              style={isActive(createPageUrl("PublicProgramView")) ? gradientStyle : {}}
            >
              <Bell className="w-5 h-5" />
              {t('nav.liveProgram')}
            </Link>

            {/* EVENTS PILLAR - Permission-based */}
            {hasPermission(user, 'view_events') && (
              <>
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 mt-6 pl-3 flex items-center gap-2">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-600 to-transparent"></div>
                  <span>{t('section.events')}</span>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-600 to-transparent"></div>
                </div>
                <Link
                  to={createPageUrl("Events")}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                    isActive(createPageUrl("Events")) || 
                    isActive(createPageUrl("EventDetail"))
                      ? "text-white shadow-md"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                  }`}
                  style={isActive(createPageUrl("Events")) || isActive(createPageUrl("EventDetail")) ? gradientStyle : {}}
                >
                  <Calendar className="w-5 h-5" />
                  {t('nav.events')}
                </Link>
                <Link
                  to={createPageUrl("Reports")}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                    isActive(createPageUrl("Reports"))
                      ? "text-white shadow-md"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                  }`}
                  style={isActive(createPageUrl("Reports")) ? gradientStyle : {}}
                >
                  <FileText className="w-5 h-5" />
                  {t('nav.reports')}
                </Link>
              </>
            )}

            {/* SERVICES PILLAR - Permission-based */}
            {hasPermission(user, 'view_services') && (
              <>
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 mt-6 pl-3 flex items-center gap-2">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-600 to-transparent"></div>
                  <span>{t('section.services')}</span>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-600 to-transparent"></div>
                </div>
                <Link
                  to={createPageUrl("WeeklyServiceManager")}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                    isActive(createPageUrl("WeeklyServiceManager"))
                      ? "text-white shadow-md"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                  }`}
                  style={isActive(createPageUrl("WeeklyServiceManager")) ? gradientStyle : {}}
                >
                  <Clock className="w-5 h-5" />
                  {t('nav.services')}
                </Link>
                <Link
                  to={createPageUrl("CustomServicesManager")}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                    isActive(createPageUrl("CustomServicesManager")) || 
                    isActive(createPageUrl("CustomServiceBuilder"))
                      ? "text-white shadow-md"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                  }`}
                  style={isActive(createPageUrl("CustomServicesManager")) || isActive(createPageUrl("CustomServiceBuilder")) ? gradientStyle : {}}
                >
                  <Plus className="w-5 h-5" />
                  Servicios Personalizados
                </Link>
              </>
            )}

            {/* SHARED RESOURCES - Permission-based */}
            {hasPermission(user, 'view_people') && (
              <>
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 mt-6 pl-3">{t('section.resources')}</div>
                <Link
                  to={createPageUrl("People")}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                    isActive(createPageUrl("People"))
                      ? "text-white shadow-md"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                  }`}
                  style={isActive(createPageUrl("People")) ? gradientStyle : {}}
                >
                  <Users className="w-5 h-5" />
                  {t('nav.people')}
                </Link>
              </>
            )}

            {/* SETTINGS - Permission-based */}
            {(hasPermission(user, 'manage_users') || hasPermission(user, 'view_rooms') || hasPermission(user, 'view_templates') || hasPermission(user, 'access_importer')) && (
              <>
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-6 mb-3 pl-3">{t('section.settings')}</div>

                {hasPermission(user, 'manage_users') && (
                  <>
                    <Link
                      to={createPageUrl("UserManagement")}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                        isActive(createPageUrl("UserManagement"))
                          ? "text-white shadow-md"
                          : "text-gray-400 hover:bg-white/5 hover:text-white"
                      }`}
                      style={isActive(createPageUrl("UserManagement")) ? gradientStyle : {}}
                    >
                      <Users className="w-5 h-5" />
                      User Management
                    </Link>
                    <Link
                      to={createPageUrl("RolePermissionManager")}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                        isActive(createPageUrl("RolePermissionManager"))
                          ? "text-white shadow-md"
                          : "text-gray-400 hover:bg-white/5 hover:text-white"
                      }`}
                      style={isActive(createPageUrl("RolePermissionManager")) ? gradientStyle : {}}
                    >
                      <Shield className="w-5 h-5" />
                      {language === 'es' ? 'Roles y Permisos' : 'Roles & Permissions'}
                    </Link>
                    <Link
                      to={createPageUrl("MessageProcessing")}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                        isActive(createPageUrl("MessageProcessing"))
                          ? "text-white shadow-md"
                          : "text-gray-400 hover:bg-white/5 hover:text-white"
                      }`}
                      style={isActive(createPageUrl("MessageProcessing")) ? gradientStyle : {}}
                    >
                      <Sparkles className="w-5 h-5" />
                      {language === 'es' ? 'Procesar Mensajes' : 'Process Messages'}
                    </Link>
                  </>
                )}

                {hasPermission(user, 'view_rooms') && (
                <Link
                  to={createPageUrl("Rooms")}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                    isActive(createPageUrl("Rooms"))
                      ? "text-white shadow-md"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                  }`}
                  style={isActive(createPageUrl("Rooms")) ? gradientStyle : {}}
                >
                  <MapPin className="w-5 h-5" />
                  {t('nav.rooms')}
                </Link>
                )}

                {hasPermission(user, 'view_templates') && (
                <Link
                  to={createPageUrl("Templates")}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                    isActive(createPageUrl("Templates"))
                      ? "text-white shadow-md"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                  }`}
                  style={isActive(createPageUrl("Templates")) ? gradientStyle : {}}
                >
                  <Copy className="w-5 h-5" />
                  {t('nav.templates')}
                </Link>
                )}

                {hasPermission(user, 'access_importer') && (
                <Link
                  to={createPageUrl("ScheduleImporter")}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                    isActive(createPageUrl("ScheduleImporter"))
                      ? "text-white shadow-md"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                  }`}
                  style={isActive(createPageUrl("ScheduleImporter")) ? gradientStyle : {}}
                >
                  <Sparkles className="w-5 h-5" />
                  {t('nav.importer')}
                </Link>
                )}

                {hasPermission(user, 'manage_users') && (
                <Link
                  to={createPageUrl("SchemaGuide")}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                    isActive(createPageUrl("SchemaGuide"))
                      ? "text-white shadow-md"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                  }`}
                  style={isActive(createPageUrl("SchemaGuide")) ? gradientStyle : {}}
                >
                  <FileCode className="w-5 h-5" />
                  {t('nav.schema')}
                </Link>
                )}
                </>
                )}

            {/* Theme & Language Toggle */}
            <div className="pt-4 mt-4 border-t border-gray-700 space-y-2">
              {/* Theme Toggle */}
              <div className="relative group">
                <button
                  className="flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-all w-full"
                >
                  {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                  <span className="flex-1 text-left">{t('theme.label')}</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
                {/* Theme Dropdown */}
                <div className="absolute left-0 right-0 bottom-full mb-1 bg-gray-900 border border-gray-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <button
                    onClick={() => setTheme('light')}
                    className={`w-full text-left px-4 py-2 text-sm ${theme === 'light' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800'} transition-colors`}
                  >
                    {t('theme.light')}
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={`w-full text-left px-4 py-2 text-sm ${theme === 'dark' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800'} transition-colors`}
                  >
                    {t('theme.dark')}
                  </button>
                  <button
                    onClick={() => setTheme('system')}
                    className={`w-full text-left px-4 py-2 text-sm ${theme === 'system' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800'} transition-colors`}
                  >
                    {t('theme.system')}
                  </button>
                </div>
              </div>

              {/* Language Toggle */}
              <button
                onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
                className="flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-all w-full"
              >
                <Languages className="w-5 h-5" />
                {language === 'es' ? 'English' : 'Español'}
              </button>
            </div>
            </nav>
      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} print:ml-0 transition-all duration-300`}>
        {/* Mobile Header */}
        <header className="lg:hidden bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50 print:hidden">
          <div className="px-4 sm:px-6">
            <div className="flex items-center justify-between h-16">
              {/* Logo */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={gradientStyle}>
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-gray-900 text-xl uppercase leading-none tracking-wide">PALABRAS DE VIDA</h2>
                  <p className="text-[10px] text-pdv-teal font-bold tracking-wider mt-0.5">¡ATRÉVETE A CAMBIAR!</p>
                </div>
              </div>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded hover:bg-gray-100 text-gray-700"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>

            {/* Mobile Navigation */}
            {mobileMenuOpen && (
              <div className="py-4 border-t border-gray-200">
                <div className="space-y-1">
                  <Link
                    to={createPageUrl("Dashboard")}
                    className={`block px-4 py-2 rounded font-semibold uppercase text-sm ${
                      isActive(createPageUrl("Dashboard"))
                        ? "text-white"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                    style={isActive(createPageUrl("Dashboard")) ? gradientStyle : {}}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t('nav.dashboard')}
                  </Link>

                  <div className="px-4 py-2 text-xs font-bold text-gray-500 uppercase mt-4">{t('section.live')}</div>
                  <Link
                    to={createPageUrl("PublicProgramView")}
                    className="block px-6 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t('nav.liveProgram')}
                  </Link>

                  <div className="px-4 py-2 text-xs font-bold text-gray-500 uppercase mt-2">{t('section.events')}</div>
                  <Link
                    to={createPageUrl("Events")}
                    className="block px-6 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t('nav.events')}
                  </Link>
                  <Link
                    to={createPageUrl("Reports")}
                    className="block px-6 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t('nav.reports')}
                  </Link>

                  <div className="px-4 py-2 text-xs font-bold text-gray-500 uppercase mt-4">{t('section.services')}</div>
                  <Link
                    to={createPageUrl("WeeklyServiceManager")}
                    className="block px-6 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t('nav.services')}
                  </Link>
                  <Link
                    to={createPageUrl("CustomServicesManager")}
                    className="block px-6 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Servicios Personalizados
                  </Link>

                  <div className="px-4 py-2 text-xs font-bold text-gray-500 uppercase mt-4">{t('section.resources')}</div>
                  <Link
                    to={createPageUrl("People")}
                    className="block px-6 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t('nav.people')}
                  </Link>

                  <div className="px-4 py-2 text-xs font-bold text-gray-500 uppercase mt-2">{t('section.settings')}</div>
                  <Link
                    to={createPageUrl("Rooms")}
                    className="block px-6 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t('nav.rooms')}
                  </Link>
                  <Link
                    to={createPageUrl("Templates")}
                    className="block px-6 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t('nav.templates')}
                  </Link>
                  <Link
                    to={createPageUrl("ScheduleImporter")}
                    className="block px-6 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t('nav.importer')}
                  </Link>
                  <Link
                    to={createPageUrl("SchemaGuide")}
                    className="block px-6 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t('nav.schema')}
                  </Link>
                  </div>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function Layout({ children }) {
  return (
    <LanguageProvider>
      <TooltipProvider delayDuration={200}>
        <>
          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Anton&display=swap');
            h1, h2 {
              font-family: 'Anton', sans-serif !important;
              font-weight: 400;
            }
          `}</style>
          <LayoutContent>{children}</LayoutContent>
        </>
      </TooltipProvider>
    </LanguageProvider>
  );
}
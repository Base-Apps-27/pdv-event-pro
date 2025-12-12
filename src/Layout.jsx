import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useLanguage, LanguageProvider } from "@/components/utils/i18n";
import { Calendar, Settings, LayoutDashboard, ChevronDown, Menu, X, FileText, MapPin, Copy, Clock, Bell, Users, Sparkles, FileCode, Languages } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function LayoutContent({ children }) {
  const { language, setLanguage, t } = useLanguage();
  // Hardcoded brand colors for reliable gradient rendering
  const gradientStyle = {
    background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)', // Brand Teal -> Brand Green -> Brand Lime
  };
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const redirectingRef = React.useRef(false);

  useEffect(() => {
    const checkAuth = async () => {
      const authenticated = await base44.auth.isAuthenticated();
      setIsAuthenticated(authenticated);
    };
    checkAuth();
  }, []);

  const isActive = (path) => location.pathname === path;

  // If on PublicProgramView page, don't require auth
  const isPublicPage = location.pathname.includes('PublicProgramView');
  
  // Public page - show minimal layout
  if (isPublicPage) {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  // Still loading auth state
  if (isAuthenticated === null) {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  // Redirect to login if not authenticated (prevent multiple redirects)
  if (isAuthenticated === false && !redirectingRef.current) {
    redirectingRef.current = true;
    base44.auth.redirectToLogin();
    return null;
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Dark Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-black text-white fixed h-full font-sans print:hidden">
        <div className="p-6 mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shadow-lg" style={gradientStyle}>
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-white text-xl uppercase leading-none font-['Bebas_Neue'] tracking-wide">PALABRAS DE VIDA</h2>
              <p className="text-[10px] text-pdv-green font-medium tracking-wider mt-1">¡ATRÉVETE A CAMBIAR!</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 mt-2 pl-3">{t('section.main')}</div>
          <Link
            to={createPageUrl("Dashboard")}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all ${
              isActive(createPageUrl("Dashboard"))
                ? "text-white shadow-md"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
            style={isActive(createPageUrl("Dashboard")) ? gradientStyle : {}}
          >
            <LayoutDashboard className="w-5 h-5" />
            {t('nav.dashboard')}
          </Link>

          {/* EVENTS PILLAR */}
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

          {/* SERVICES PILLAR */}
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 mt-6 pl-3 flex items-center gap-2">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-600 to-transparent"></div>
            <span>{t('section.services')}</span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-600 to-transparent"></div>
          </div>
          <Link
            to={createPageUrl("Services")}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all ${
              isActive(createPageUrl("Services")) || 
              isActive(createPageUrl("ServiceDetail"))
                ? "text-white shadow-md"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
            style={isActive(createPageUrl("Services")) || isActive(createPageUrl("ServiceDetail")) ? gradientStyle : {}}
          >
            <Clock className="w-5 h-5" />
            {t('nav.services')}
          </Link>
          <Link
            to={createPageUrl("AnnouncementsReport")}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all ${
              isActive(createPageUrl("AnnouncementsReport"))
                ? "text-white shadow-md"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
            style={isActive(createPageUrl("AnnouncementsReport")) ? gradientStyle : {}}
          >
            <Bell className="w-5 h-5" />
            {t('nav.announcements')}
          </Link>

          {/* SHARED RESOURCES */}
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

          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-6 mb-3 pl-3">{t('section.settings')}</div>
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

          {/* Language Toggle */}
          <div className="pt-4 mt-4 border-t border-gray-700">
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
      <div className="flex-1 lg:ml-64 print:ml-0">
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
                  <h2 className="font-bold text-gray-900 text-xl uppercase leading-none font-['Bebas_Neue'] tracking-wide">PALABRAS DE VIDA</h2>
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
                    Inicio
                  </Link>

                  <div className="px-4 py-2 text-xs font-bold text-gray-500 uppercase mt-2">Operaciones</div>
                  <Link
                    to={createPageUrl("Events")}
                    className="block px-6 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Eventos
                  </Link>
                  <Link
                    to={createPageUrl("Services")}
                    className="block px-6 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Servicios
                  </Link>
                  <Link
                    to={createPageUrl("Reports")}
                    className="block px-6 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Informes
                  </Link>
                  <Link
                    to={createPageUrl("AnnouncementsReport")}
                    className="block px-6 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Anuncios
                  </Link>
                  <Link
                    to={createPageUrl("People")}
                    className="block px-6 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Personas
                  </Link>

                  <div className="px-4 py-2 text-xs font-bold text-gray-500 uppercase mt-2">Configuración</div>
                  <Link
                    to={createPageUrl("Rooms")}
                    className="block px-6 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Salas
                  </Link>
                  <Link
                    to={createPageUrl("Templates")}
                    className="block px-6 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Plantillas
                  </Link>
                  <Link
                    to={createPageUrl("ScheduleImporter")}
                    className="block px-6 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Importador IA
                  </Link>
                  <Link
                    to={createPageUrl("SchemaGuide")}
                    className="block px-6 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Guía de Datos
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
    <LayoutContent>{children}</LayoutContent>
    </LanguageProvider>
    );
    }
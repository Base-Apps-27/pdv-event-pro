// Desktop Sidebar — PDV Event Pro
// 2026-02-14 redesign: slim branded rail with icon buttons + flyout "More" panel.
// Replaces the old full-width list sidebar. Shared navItems data with mobile.

import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLanguage } from "@/components/utils/i18n";
import { hasPermission } from "@/components/utils/permissions";
import { primaryNav, secondaryNav } from "@/components/nav/navItems";
import { Calendar, Languages, MoreHorizontal, X, LogOut } from "lucide-react";
import { base44 } from "@/api/base44Client";

const GRADIENT = 'linear-gradient(180deg, #1F8A70 0%, #4DC15F 60%, #D9DF32 100%)';
const GRADIENT_H = 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)';

// Hoverable nav item that expands to show label on hover (aids transition for admins)
function NavRailItem({ to, icon: Icon, label, active, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`group relative flex items-center h-11 rounded-xl transition-all duration-200 overflow-hidden ${
        active
          ? 'text-white shadow-lg'
          : 'text-gray-500 hover:text-white hover:bg-white/5'
      }`}
      style={active ? { background: GRADIENT_H } : {}}
    >
      {/* Icon — always centered in 44px zone */}
      <span className="w-11 h-11 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5" />
      </span>
      {/* Label — slides out on hover */}
      <span className="whitespace-nowrap text-sm font-medium pr-4 max-w-0 opacity-0 group-hover:max-w-[160px] group-hover:opacity-100 transition-all duration-200 overflow-hidden">
        {label}
      </span>
      {/* Active indicator */}
      {active && (
        <span className="absolute -right-0.5 top-1/2 -translate-y-1/2 w-1 h-5 rounded-l-full bg-white/80" />
      )}
    </Link>
  );
}

export default function DesktopSidebar({ user }) {
  const { language, setLanguage, t } = useLanguage();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const isPageActive = (matchPages) =>
    matchPages.some(p => location.pathname === createPageUrl(p));

  const visiblePrimary = primaryNav.filter(
    item => !item.permission || hasPermission(user, item.permission)
  );

  const visibleSecondary = secondaryNav.filter(
    item => !item.permission || hasPermission(user, item.permission)
  );

  return (
    <>
      {/* Slim icon rail — 72px wide, always visible */}
      <aside className="hidden lg:flex lg:flex-col w-[72px] bg-[#0D0D0D] fixed h-full z-50 print:hidden items-center py-4">
        {/* Brand mark */}
        <Link to={createPageUrl("Dashboard")} className="mb-6 group">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110"
            style={{ background: GRADIENT }}
          >
            <Calendar className="w-6 h-6 text-white" />
          </div>
        </Link>

        {/* Gradient accent line */}
        <div className="w-8 h-0.5 rounded-full mb-5 opacity-40" style={{ background: GRADIENT_H }} />

        {/* Primary nav icons */}
        <nav className="flex flex-col items-center gap-1.5 flex-1">
          {visiblePrimary.map(item => {
            const active = isPageActive(item.matchPages);
            return (
              <NavRailItem
                key={item.id}
                to={createPageUrl(item.page)}
                icon={item.icon}
                label={t(item.labelKey)}
                active={active}
              />
            );
          })}

          {/* More button — opens flyout */}
          {visibleSecondary.length > 0 && (
            <>
              <div className="w-6 h-px bg-gray-700 my-2" />
              <button
                onClick={() => setMoreOpen(prev => !prev)}
                className={`group relative flex items-center h-11 rounded-xl transition-all duration-200 overflow-hidden ${
                  moreOpen
                    ? 'bg-white/10 text-white'
                    : 'text-gray-500 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="w-11 h-11 flex items-center justify-center shrink-0">
                  {moreOpen ? <X className="w-5 h-5" /> : <MoreHorizontal className="w-5 h-5" />}
                </span>
                <span className="whitespace-nowrap text-sm font-medium pr-4 max-w-0 opacity-0 group-hover:max-w-[160px] group-hover:opacity-100 transition-all duration-200 overflow-hidden">
                  {language === 'es' ? 'Más opciones' : 'More options'}
                </span>
              </button>
            </>
          )}
        </nav>

        {/* Bottom actions */}
        <div className="flex flex-col items-center gap-1.5 mt-auto pt-4">
          <button
            onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
            className="group relative flex items-center h-11 rounded-xl text-gray-500 hover:text-white hover:bg-white/5 transition-all duration-200 overflow-hidden"
          >
            <span className="w-11 h-11 flex items-center justify-center shrink-0">
              <Languages className="w-5 h-5" />
            </span>
            <span className="whitespace-nowrap text-sm font-medium pr-4 max-w-0 opacity-0 group-hover:max-w-[160px] group-hover:opacity-100 transition-all duration-200 overflow-hidden">
              {language === 'es' ? 'English' : 'Español'}
            </span>
          </button>

          <button
            onClick={() => base44.auth.logout()}
            className="group relative flex items-center h-11 rounded-xl text-gray-600 hover:text-red-400 hover:bg-white/5 transition-all duration-200 overflow-hidden"
          >
            <span className="w-11 h-11 flex items-center justify-center shrink-0">
              <LogOut className="w-4 h-4" />
            </span>
            <span className="whitespace-nowrap text-sm font-medium pr-4 max-w-0 opacity-0 group-hover:max-w-[160px] group-hover:opacity-100 transition-all duration-200 overflow-hidden">
              {language === 'es' ? 'Cerrar sesión' : 'Logout'}
            </span>
          </button>
        </div>
      </aside>

      {/* Flyout panel — slides out from the rail */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="hidden lg:block fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
            onClick={() => setMoreOpen(false)}
          />
          {/* Panel */}
          <div className="hidden lg:block fixed left-[72px] top-0 h-full w-64 bg-[#111111] border-r border-gray-800 z-40 shadow-2xl animate-in slide-in-from-left-4 duration-200">
            <div className="p-5">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  {language === 'es' ? 'Más opciones' : 'More options'}
                </h3>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="text-gray-500 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <nav className="space-y-1">
                {visibleSecondary.map(item => {
                  const active = isPageActive(item.matchPages);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.id}
                      to={createPageUrl(item.page)}
                      onClick={() => setMoreOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        active
                          ? 'text-white'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                      style={active ? { background: GRADIENT_H } : {}}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{t(item.labelKey)}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Brand footer in flyout */}
            <div className="absolute bottom-0 left-0 right-0 p-5 border-t border-gray-800">
              <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">Palabras de Vida</p>
              <p className="text-[9px] text-gray-700 tracking-wider mt-0.5">¡Atrévete a cambiar!</p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
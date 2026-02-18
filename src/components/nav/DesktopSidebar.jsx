// Desktop Sidebar — PDV Event Pro
// 2026-02-14 redesign: slim branded rail with icon buttons + flyout "More" panel.
// Replaces the old full-width list sidebar. Shared navItems data with mobile.

import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLanguage } from "@/components/utils/i18n";
import { hasPermission, hasDashboardAccess, getLandingPage } from "@/components/utils/permissions";
import { primaryNav, secondaryNav, adminNav } from "@/components/nav/navItems";
import { Calendar, Languages, MoreHorizontal, X, LogOut, Pin, PinOff, ChevronDown } from "lucide-react";
import { base44 } from "@/api/base44Client";
import useNavPins from "@/components/nav/useNavPins";

const GRADIENT = 'linear-gradient(180deg, #1F8A70 0%, #4DC15F 60%, #D9DF32 100%)';
const GRADIENT_H = 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)';

// Hoverable nav item — icon stays fixed in rail, label floats out to the right as overlay pill.
// Rail never changes width. Label uses absolute positioning so it's outside the rail DOM flow.
function NavRailItem({ to, icon: Icon, label, active, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`group relative w-11 h-11 rounded-xl flex items-center justify-center transition-colors duration-150 ${
        active
          ? 'text-white shadow-lg'
          : 'text-gray-500 hover:text-white hover:bg-white/5'
      }`}
      style={active ? { background: GRADIENT_H } : {}}
    >
      <Icon className="w-5 h-5 relative z-10" />
      {/* Active indicator bar on right edge */}
      {active && (
        <span className="absolute -right-0.5 top-1/2 -translate-y-1/2 w-1 h-5 rounded-l-full bg-white/80" />
      )}
      {/* Floating label — absolutely positioned to the right, outside the rail */}
      <span
        className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3
                   flex items-center h-8 px-3.5 rounded-lg
                   text-sm font-semibold text-white whitespace-nowrap
                   opacity-0 -translate-x-2 scale-95
                   group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100
                   transition-all duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)]
                   shadow-lg"
        style={{ background: GRADIENT_H }}
      >
        {label}
      </span>
    </Link>
  );
}

export default function DesktopSidebar({ user }) {
  const { language, setLanguage, t } = useLanguage();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  const isPageActive = (matchPages) =>
    matchPages.some(p => location.pathname === createPageUrl(p));

  const visiblePrimary = primaryNav.filter(item => {
    if (!item.permission) return true;
    if (item.id === 'dashboard') return hasDashboardAccess(user);
    return hasPermission(user, item.permission);
  });

  // All pinnable items = secondary + admin
  const allSecondaryItems = [...secondaryNav, ...adminNav];
  const { pinned, isPinned, togglePin, canPin } = useNavPins(user);

  const pinnedItems = pinned
    .map(id => allSecondaryItems.find(s => s.id === id))
    .filter(item => item && (!item.permission || hasPermission(user, item.permission)));

  const visibleSecondary = secondaryNav.filter(
    item => !item.permission || hasPermission(user, item.permission)
  );

  const visibleAdmin = adminNav.filter(
    item => !item.permission || hasPermission(user, item.permission)
  );

  return (
    <>
      {/* Slim icon rail — 72px wide, always visible */}
      <aside className="hidden lg:flex lg:flex-col w-[72px] bg-[#0D0D0D] fixed h-full z-50 print:hidden items-center py-4 overflow-visible">
        {/* Brand mark */}
        <Link to={createPageUrl(getLandingPage(user))} className="mb-6 group">
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
        <nav className="flex flex-col items-center gap-1.5 flex-1 overflow-visible">
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

          {/* Pinned secondary items — surfaced into the rail */}
          {pinnedItems.length > 0 && (
            <>
              <div className="w-6 h-px bg-gray-700 my-2" />
              {pinnedItems.map(item => {
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
            </>
          )}

          {/* More button — opens flyout */}
          {visibleSecondary.length > 0 && (
            <>
              <div className="w-6 h-px bg-gray-700 my-2" />
              <button
                onClick={() => setMoreOpen(prev => !prev)}
                className={`group relative w-11 h-11 rounded-xl flex items-center justify-center transition-colors duration-150 ${
                  moreOpen
                    ? 'bg-white/10 text-white'
                    : 'text-gray-500 hover:text-white hover:bg-white/5'
                }`}
              >
                {moreOpen ? <X className="w-5 h-5" /> : <MoreHorizontal className="w-5 h-5" />}
                <span
                  className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3
                             flex items-center h-8 px-3.5 rounded-lg
                             text-sm font-semibold text-white whitespace-nowrap
                             opacity-0 -translate-x-2 scale-95
                             group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100
                             transition-all duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)]
                             shadow-lg"
                  style={{ background: GRADIENT_H }}
                >
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
            className="group relative w-11 h-11 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5 transition-colors duration-150"
          >
            <Languages className="w-5 h-5" />
            <span
              className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3
                         flex items-center h-8 px-3.5 rounded-lg
                         text-sm font-semibold text-white whitespace-nowrap
                         opacity-0 -translate-x-2 scale-95
                         group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100
                         transition-all duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)]
                         shadow-lg"
              style={{ background: GRADIENT_H }}
            >
              {language === 'es' ? 'English' : 'Español'}
            </span>
          </button>

          <button
            onClick={() => base44.auth.logout()}
            className="group relative w-11 h-11 rounded-xl flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-white/5 transition-colors duration-150"
          >
            <LogOut className="w-4 h-4" />
            <span
              className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3
                         flex items-center h-8 px-3.5 rounded-lg
                         text-sm font-semibold text-white whitespace-nowrap
                         opacity-0 -translate-x-2 scale-95
                         group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100
                         transition-all duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)]
                         shadow-lg bg-red-600/90"
            >
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
              {/* Pin hint */}
              <p className="text-[10px] text-gray-600 mb-3">
                {language === 'es'
                  ? `Fija hasta 3 ítems en la barra lateral (${pinned.length}/3)`
                  : `Pin up to 3 items to the sidebar (${pinned.length}/3)`}
              </p>
              <nav className="space-y-1">
                {visibleSecondary.map(item => {
                  const active = isPageActive(item.matchPages);
                  const Icon = item.icon;
                  const itemPinned = isPinned(item.id);
                  return (
                    <div key={item.id} className="flex items-center group/pin">
                      <Link
                        to={createPageUrl(item.page)}
                        onClick={() => setMoreOpen(false)}
                        className={`flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                          active
                            ? 'text-white'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                        style={active ? { background: GRADIENT_H } : {}}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{t(item.labelKey)}</span>
                      </Link>
                      <button
                        onClick={() => togglePin(item.id)}
                        disabled={!itemPinned && !canPin}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0
                          ${itemPinned
                            ? 'text-teal-400 hover:text-teal-300 hover:bg-teal-900/30'
                            : canPin
                              ? 'text-gray-600 opacity-0 group-hover/pin:opacity-100 hover:text-gray-300 hover:bg-white/5'
                              : 'text-gray-700 opacity-0 group-hover/pin:opacity-50 cursor-not-allowed'
                          }`}
                        title={itemPinned
                          ? (language === 'es' ? 'Desfijar' : 'Unpin')
                          : (language === 'es' ? 'Fijar en barra' : 'Pin to sidebar')}
                      >
                        {itemPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                      </button>
                    </div>
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
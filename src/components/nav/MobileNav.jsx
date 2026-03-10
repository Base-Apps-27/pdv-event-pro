// Mobile Navigation — PDV Event Pro
// 2026-02-14 redesign: bottom tab bar with 4 primary + "More" sheet.
// Shared navItems data with desktop sidebar. Permission-gated.

import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLanguage } from "@/components/utils/i18n.jsx";
import { hasPermission, hasDashboardAccess } from "@/components/utils/permissions";
import { primaryNav, secondaryNav, adminNav } from "@/components/nav/navItems";
import { MoreHorizontal, X, Languages, LogOut, Calendar, Pin, PinOff, ChevronDown } from "lucide-react";
import { base44 } from "@/api/base44Client";
import useNavPins from "@/components/nav/useNavPins";

const GRADIENT_H = 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)';

export default function MobileNav({ user }) {
  const { language, setLanguage, t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  const isPageActive = (matchPages) =>
    matchPages.some(p => location.pathname === createPageUrl(p));

  // Apple HIG: Tapping active tab pops to root; tapping inactive tab navigates to it (2026-03-07)
  const handleTabClick = (item) => {
    const isActive = isPageActive(item.matchPages);
    if (isActive) {
      navigate(createPageUrl(item.page), { replace: true });
    } else {
      navigate(createPageUrl(item.page));
    }
  };

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
      {/* Fixed bottom tab bar */}
      {/* 2026-03-07: pb-[env(safe-area-inset-bottom)] ensures iOS Home Indicator clearance during active nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 print:hidden safe-area-bottom pb-[env(safe-area-inset-bottom,0px)]">
        <div className="flex items-center justify-around h-16 px-1">
          {/* Core primary items */}
          {visiblePrimary.slice(0, 4).map(item => {
            const active = isPageActive(item.matchPages);
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item)}
                className={`flex flex-col items-center justify-center gap-0.5 min-w-[48px] py-1 rounded-lg transition-colors no-select ${
                  active ? 'text-[#1F8A70]' : 'text-gray-400'
                }`}
              >
                <div className="relative">
                  {active && (
                    <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full" style={{ background: GRADIENT_H }} />
                  )}
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-medium leading-tight">{t(item.labelKey)}</span>
              </button>
            );
          })}

          {/* Pinned secondary items in tab bar (max 3, shown between primary and More) */}
          {pinnedItems.slice(0, 2).map(item => {
            const active = isPageActive(item.matchPages);
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item)}
                className={`flex flex-col items-center justify-center gap-0.5 min-w-[48px] py-1 rounded-lg transition-colors no-select ${
                  active ? 'text-[#1F8A70]' : 'text-gray-400'
                }`}
              >
                <div className="relative">
                  {active && (
                    <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full" style={{ background: GRADIENT_H }} />
                  )}
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-medium leading-tight truncate max-w-[52px]">{t(item.labelKey)}</span>
              </button>
            );
          })}

          {/* More tab */}
          {visibleSecondary.length > 0 && (
            <button
              onClick={() => setSheetOpen(true)}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[48px] py-1 rounded-lg transition-colors no-select ${
                sheetOpen ? 'text-[#1F8A70]' : 'text-gray-400'
              }`}
            >
              <MoreHorizontal className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-tight">
                {language === 'es' ? 'Más' : 'More'}
              </span>
            </button>
          )}
        </div>
      </nav>

      {/* Bottom sheet for "More" */}
      {sheetOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px]"
            onClick={() => setSheetOpen(false)}
          />
          {/* Sheet */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[61] bg-white rounded-t-2xl shadow-2xl max-h-[75vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-200">
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: GRADIENT_H }}
                >
                  <Calendar className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900 uppercase tracking-wide">PDV Event Pro</p>
                </div>
              </div>
              <button
                onClick={() => setSheetOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Pin hint */}
            <p className="text-[10px] text-gray-400 px-5 pt-3">
              {language === 'es'
                ? `Fija hasta 3 ítems en la barra inferior (${pinned.length}/3)`
                : `Pin up to 3 items to the tab bar (${pinned.length}/3)`}
            </p>

            {/* Nav items */}
            <div className="p-4 space-y-1">
              {visibleSecondary.map(item => {
                const active = isPageActive(item.matchPages);
                const Icon = item.icon;
                const itemPinned = isPinned(item.id);
                return (
                  <div key={item.id} className="flex items-center">
                    <Link
                      to={createPageUrl(item.page)}
                      onClick={() => setSheetOpen(false)}
                      className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                        active
                          ? 'text-white shadow-md'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                      style={active ? { background: GRADIENT_H } : {}}
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      <span>{t(item.labelKey)}</span>
                    </Link>
                    <button
                      onClick={() => togglePin(item.id)}
                      disabled={!itemPinned && !canPin}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0
                        ${itemPinned
                          ? 'text-[#1F8A70]'
                          : canPin
                            ? 'text-gray-300 hover:text-gray-500'
                            : 'text-gray-200 cursor-not-allowed'
                        }`}
                      title={itemPinned
                        ? (language === 'es' ? 'Desfijar' : 'Unpin')
                        : (language === 'es' ? 'Fijar' : 'Pin')}
                    >
                      {itemPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                    </button>
                  </div>
                );
              })}

              {/* Admin tools — collapsible section */}
              {visibleAdmin.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => setAdminOpen(prev => !prev)}
                    className="flex items-center justify-between w-full px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-widest"
                  >
                    <span>Admin</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${adminOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {adminOpen && (
                    <div className="space-y-1 mt-1">
                      {visibleAdmin.map(item => {
                        const active = isPageActive(item.matchPages);
                        const Icon = item.icon;
                        const itemPinned = isPinned(item.id);
                        return (
                          <div key={item.id} className="flex items-center">
                            <Link
                              to={createPageUrl(item.page)}
                              onClick={() => setSheetOpen(false)}
                              className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                                active
                                  ? 'text-white shadow-md'
                                  : 'text-gray-700 hover:bg-gray-50'
                              }`}
                              style={active ? { background: GRADIENT_H } : {}}
                            >
                              <Icon className="w-5 h-5 shrink-0" />
                              <span>{t(item.labelKey)}</span>
                            </Link>
                            <button
                              onClick={() => togglePin(item.id)}
                              disabled={!itemPinned && !canPin}
                              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0
                                ${itemPinned
                                  ? 'text-[#1F8A70]'
                                  : canPin
                                    ? 'text-gray-300 hover:text-gray-500'
                                    : 'text-gray-200 cursor-not-allowed'
                                }`}
                              title={itemPinned
                                ? (language === 'es' ? 'Desfijar' : 'Unpin')
                                : (language === 'es' ? 'Fijar' : 'Pin')}
                            >
                              {itemPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="border-t border-gray-100 p-4 space-y-2">
              <Link
                to={createPageUrl('Profile')}
                onClick={() => setSheetOpen(false)}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gray-50 text-gray-700 text-sm font-medium hover:bg-gray-100 transition-colors no-select"
              >
                👤 {t('nav.profile')}
              </Link>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setLanguage(language === 'es' ? 'en' : 'es');
                    setSheetOpen(false);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-50 text-gray-700 text-sm font-medium hover:bg-gray-100 transition-colors"
                >
                  <Languages className="w-4 h-4" />
                  {language === 'es' ? 'English' : 'Español'}
                </button>
                <button
                  onClick={() => base44.auth.logout()}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 text-gray-500 text-sm font-medium hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Safe area padding for iOS */}
            <div className="h-6" />
          </div>
        </>
      )}
    </>
  );
}
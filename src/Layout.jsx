import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { LanguageProvider } from "@/components/utils/i18n.jsx";
import { hasPermission, hasDashboardAccess, getLandingPage } from "@/components/utils/permissions";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "@/components/utils/ErrorBoundary";
import DesktopSidebar from "@/components/nav/DesktopSidebar";
import MobileNav from "@/components/nav/MobileNav";
import useSegmentHealing from "@/components/utils/useSegmentHealing";
import PullToRefresh from "@/components/ui/PullToRefresh";
import "./globals.css"; // Ensure brand utilities (.brand-gradient, etc.) load on all pages

function LayoutContentInner({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Define strictly public routes (no auth required, but authenticated users still get nav)
  // AUTH GATE (2026-02-14): Only TV Display remains truly public.
  // PublicProgramView now requires authentication.
  const isPublicPage = useMemo(() => {
    const path = location.pathname;
    const publicExactRoutes = [
      createPageUrl('PublicCountdownDisplay'),
      '/PublicCountdownDisplay',
      createPageUrl('PublicSpeakerForm'),
      '/PublicSpeakerForm',
      createPageUrl('PublicArtsForm'),
      '/PublicArtsForm',
      createPageUrl('PublicWeeklyForm'),
      '/PublicWeeklyForm',
    ];
    if (publicExactRoutes.includes(path)) return true;
    const publicPrefixes = ['/print/', '/public/'];
    if (publicPrefixes.some(prefix => path.startsWith(prefix))) return true;
    return false;
  }, [location.pathname]);

  // Pages that are public but should still show nav for authenticated users
  const isPublicWithNav = useMemo(() => {
    const path = location.pathname;
    return [
      createPageUrl('PublicCountdownDisplay'),
      '/PublicCountdownDisplay',
    ].includes(path);
  }, [location.pathname]);

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authenticated = await base44.auth.isAuthenticated();
        if (!authenticated) {
          setUser(null);
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

  // Enforce authentication on private pages
  useEffect(() => {
    if (!loading && !user && !isPublicPage) {
      base44.auth.redirectToLogin(window.location.href);
    }
  }, [loading, user, isPublicPage]);

  // 2026-04-15: ONE-TIME MIGRATION — Fix ~30 users with null app_role.
  // Runs automatically on first admin login. Idempotent (no-op if already fixed).
  // CLEANUP: Remove this useEffect + the fixNullAppRoles function after confirming fix.
  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    const migrationKey = 'fixNullAppRoles_v1_done';
    if (sessionStorage.getItem(migrationKey)) return; // Only once per session
    sessionStorage.setItem(migrationKey, 'pending');
    base44.functions.invoke('fixNullAppRoles', {})
      .then(res => {
        const fixed = res?.data?.fixed ?? 0;
        if (fixed > 0) {
          console.log(`[Layout] fixNullAppRoles migration: fixed ${fixed} users`);
        } else {
          console.log('[Layout] fixNullAppRoles migration: no users needed fixing');
        }
        sessionStorage.setItem(migrationKey, 'done');
      })
      .catch(err => {
        console.error('[Layout] fixNullAppRoles migration failed:', err.message);
        sessionStorage.removeItem(migrationKey); // Allow retry next nav
      });
  }, [user]);

  // 2026-04-16: ONE-TIME MIGRATION — Fix duplicate segment orders and null times.
  // Auto-runs on first admin login. Triggers cache rebuild after fixing.
  // CLEANUP: Remove after confirming all sessions are fixed.
  useSegmentHealing(user);

  // Permission-based redirects for authenticated users (2026-02-16 simplified)
  // Waterfall: Dashboard > Live View > MyProgram (universal).
  // Users are only allowed to navigate to pages their permissions grant.
  // If they land on a page they can't access, redirect to their landing page.
  useEffect(() => {
    if (!user || loading || isPublicPage) return;

    const currentPath = location.pathname;
    const landing = getLandingPage(user);
    const landingPath = createPageUrl(landing);
    const canDashboard = hasDashboardAccess(user);
    const canLiveView = hasPermission(user, 'access_live_view');

    // Dashboard users: no redirect needed — nav gating handles page-level access
    if (canDashboard) return;

    // Live View users: allowed on PublicProgramView and MyProgram only
    if (canLiveView) {
      const allowedPaths = [
        createPageUrl('PublicProgramView'), '/PublicProgramView',
        createPageUrl('MyProgram'), '/MyProgram',
      ];
      if (!allowedPaths.includes(currentPath)) {
        navigate(landingPath, { replace: true });
      }
      return;
    }

    // Everyone else: MyProgram only
    if (currentPath !== createPageUrl('MyProgram') && currentPath !== '/MyProgram') {
      navigate(landingPath, { replace: true });
    }
  }, [user, location.pathname, loading, navigate, isPublicPage]);

  if (loading) return null;

  // Public pages: show nav shell for authenticated users, bare shell for anonymous
  if (isPublicPage) {
    if (user && isPublicWithNav && hasDashboardAccess(user)) {
      // Authenticated admin/editor on a public page — show full nav
      return (
        <PullToRefresh>
          <div className="min-h-screen bg-[#F0F1F3]">
            <DesktopSidebar user={user} />
            <div className="lg:ml-[72px] print:ml-0 transition-all duration-200">
              <main className="flex-1 pb-20 lg:pb-0">{children}</main>
            </div>
            <MobileNav user={user} />
          </div>
        </PullToRefresh>
      );
    }
    return <PullToRefresh><div className="min-h-screen bg-gray-50">{children}</div></PullToRefresh>;
  }

  // Private pages block access if not authenticated
  if (!user) return null;

  // Minimal shell for users without dashboard permissions (Live View + MyProgram-only users)
  if (!hasDashboardAccess(user)) {
    return (
      <PullToRefresh>
        <div className="min-h-screen bg-[#F0F1F3]">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </PullToRefresh>
    );
  }

  return (
    <PullToRefresh>
      <div className="min-h-screen bg-[#F0F1F3]">
        {/* Desktop: slim icon rail sidebar */}
        <DesktopSidebar user={user} />

        {/* Main content — offset for the 72px desktop rail */}
        <div className="lg:ml-[72px] print:ml-0 transition-all duration-200">
          {/* Mobile bottom padding so content doesn't hide behind the tab bar */}
          <main className="flex-1 pb-20 lg:pb-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        {/* Mobile: bottom tab bar */}
        <MobileNav user={user} />
      </div>
    </PullToRefresh>
  );
}

export default function Layout({ children }) {
  // 2026-03-13: PushEngage SDK loading REMOVED from global Layout.
  // CRITICAL FIX: Previously, PushEngage SDK loaded for ALL users on every page,
  // causing MyProgram-only / EventDayViewer users to subscribe to push notifications.
  // When checkUpcomingNotifications broadcast, ALL subscribers received it — including
  // view-only volunteers who should never get operational alerts.
  //
  // PushEngage SDK is now loaded ONLY on pages that need it, gated by permission:
  //   ✅ PublicProgramView (access_live_view) — via PushEngageLoader component
  //   ✅ DirectorConsole (manage_live_director) — via PushEngageLoader component
  //   ❌ MyProgram — NEVER loads PushEngage
  //   ❌ PublicCountdownDisplay — NEVER loads PushEngage
  //
  // See Decision: "PushEngage SDK gated by permission" (2026-03-13)

  return (
    <LanguageProvider>
      <TooltipProvider delayDuration={200}>
        <ErrorBoundary>
          <>
            <style>{`
              @import url('https://fonts.googleapis.com/css2?family=Anton&display=swap');
              h1, h2 {
                font-family: 'Anton', sans-serif !important;
                font-weight: 400;
              }
              /* iOS safe area for bottom tab bar */
              .safe-area-bottom {
                padding-bottom: env(safe-area-inset-bottom, 0px);
              }
            `}</style>
            <LayoutContentInner>{children}</LayoutContentInner>
          </>
        </ErrorBoundary>
      </TooltipProvider>
    </LanguageProvider>
  );
}
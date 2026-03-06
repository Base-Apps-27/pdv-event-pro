/**
 * DevTools — Consolidated admin developer tools page (2026-03-06 UX-AUDIT #10)
 * Merges SchemaGuide, DependencyTracker, and ActivityLog into a single tabbed surface.
 * Reduces admin nav clutter from 3 items to 1.
 */
import React, { useState } from "react";
import { useCurrentUser } from "@/components/utils/useCurrentUser";
import { hasPermission } from "@/components/utils/permissions";
import { useLanguage } from "@/components/utils/i18n.jsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, FileCode, Network, Activity } from "lucide-react";

// Lazy-load the actual content from existing pages to avoid code duplication
import SchemaGuide from "@/pages/SchemaGuide";
import DependencyTracker from "@/pages/DependencyTracker";
import ActivityLog from "@/pages/ActivityLog";

export default function DevTools() {
  const { user, loading } = useCurrentUser();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("activity");

  if (loading) return null;

  const isAdmin = user && hasPermission(user, "manage_users");
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
        <Shield className="w-12 h-12 text-slate-300" />
        <h2 className="text-xl font-semibold text-slate-600">{t('nav.devTools')}</h2>
        <p className="text-slate-400 text-sm max-w-sm">Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="sticky top-0 z-30 bg-[#F0F1F3] border-b border-gray-200 px-6 pt-4 pb-0">
          <h1 className="text-3xl text-gray-900 uppercase tracking-tight mb-3">{t('nav.devTools')}</h1>
          <TabsList className="bg-gray-200">
            <TabsTrigger value="activity" className="gap-1.5 text-sm">
              <Activity className="w-4 h-4" />
              {t('nav.activityLog')}
            </TabsTrigger>
            <TabsTrigger value="schema" className="gap-1.5 text-sm">
              <FileCode className="w-4 h-4" />
              {t('nav.schema')}
            </TabsTrigger>
            <TabsTrigger value="dependencies" className="gap-1.5 text-sm">
              <Network className="w-4 h-4" />
              {t('nav.dependencies')}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="activity" className="mt-0">
          <ActivityLog />
        </TabsContent>
        <TabsContent value="schema" className="mt-0">
          <SchemaGuide />
        </TabsContent>
        <TabsContent value="dependencies" className="mt-0">
          <DependencyTracker />
        </TabsContent>
      </Tabs>
    </div>
  );
}
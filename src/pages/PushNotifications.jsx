/**
 * PushNotifications — Admin page for push notification management.
 * 2026-03-17: Created to track notification history, analytics, and send custom broadcasts.
 *
 * Tabs:
 *   1. History — List of sent notifications with PE stats (sent, viewed, clicked)
 *   2. Analytics — 30-day subscriber and delivery summary
 *   3. Send — Custom broadcast form with character limits and confirmation
 *
 * Admin-only. All PE API calls go through pushNotificationAdmin backend function.
 */
import React, { useState } from "react";
import { useLanguage } from "@/components/utils/i18n.jsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, BarChart3, Send } from "lucide-react";
import NotificationHistoryTab from "@/components/notifications/NotificationHistoryTab";
import AnalyticsTab from "@/components/notifications/AnalyticsTab";
import SendPushTab from "@/components/notifications/SendPushTab";

export default function PushNotifications() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('history');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="brand-gradient text-white py-6 px-6 md:px-8 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl md:text-3xl text-white uppercase tracking-wide mb-1">
            {t('push.pageTitle')}
          </h1>
          <p className="text-white/80 text-sm">{t('push.pageSubtitle')}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 w-full mb-6">
            <TabsTrigger value="history" className="flex items-center gap-1.5 text-sm">
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">{t('push.tabHistory')}</span>
              <span className="sm:hidden">{t('push.tabHistoryShort')}</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-1.5 text-sm">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">{t('push.tabAnalytics')}</span>
              <span className="sm:hidden">{t('push.tabAnalyticsShort')}</span>
            </TabsTrigger>
            <TabsTrigger value="send" className="flex items-center gap-1.5 text-sm">
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">{t('push.tabSend')}</span>
              <span className="sm:hidden">{t('push.tabSendShort')}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="history">
            <NotificationHistoryTab />
          </TabsContent>
          <TabsContent value="analytics">
            <AnalyticsTab />
          </TabsContent>
          <TabsContent value="send">
            <SendPushTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
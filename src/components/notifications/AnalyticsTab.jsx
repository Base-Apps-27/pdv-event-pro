/**
 * AnalyticsTab — PushEngage subscriber analytics and delivery stats.
 * 2026-03-17: Created for PushNotifications admin page.
 * Shows 30-day summary: subscribers, views, clicks, CTR.
 */
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/utils/i18n.jsx";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Eye, MousePointerClick, TrendingUp, UserMinus, Send, AlertTriangle } from "lucide-react";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

function getDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

function StatCard({ icon: Icon, label, value, color = 'text-gray-900', bgColor = 'bg-gray-100' }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`${bgColor} p-2.5 rounded-lg`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsTab() {
  const { t } = useLanguage();
  const { from, to } = getDateRange();

  const { data, isLoading, error } = useQuery({
    queryKey: ['push-analytics', from, to],
    queryFn: () => base44.functions.invoke('pushNotificationAdmin', {
      action: 'analytics',
      from,
      to,
    }).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <div className="flex justify-center py-12"><LoadingSpinner size="md" /></div>;

  if (error || !data?.success) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6 text-center text-red-700">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
          <p>{t('push.loadError')}</p>
        </CardContent>
      </Card>
    );
  }

  // Aggregate all days in the response
  const entries = data.data || [];
  const totals = entries.reduce((acc, d) => ({
    subscribers: acc.subscribers + (d.subscriber_count || 0),
    unsubscribed: acc.unsubscribed + (d.unsubscribed_count || 0),
    sent: acc.sent + (d.notification_sent || 0),
    views: acc.views + (d.view_count || 0),
    clicks: acc.clicks + (d.click_count || 0),
  }), { subscribers: 0, unsubscribed: 0, sent: 0, views: 0, clicks: 0 });

  const ctr = totals.views > 0 ? ((totals.clicks / totals.views) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        {t('push.analyticsRange')}: {from} → {to}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard icon={Users} label={t('push.newSubscribers')} value={totals.subscribers.toLocaleString()} color="text-green-600" bgColor="bg-green-100" />
        <StatCard icon={UserMinus} label={t('push.unsubscribed')} value={totals.unsubscribed.toLocaleString()} color="text-red-500" bgColor="bg-red-50" />
        <StatCard icon={Send} label={t('push.totalSent')} value={totals.sent.toLocaleString()} color="text-blue-600" bgColor="bg-blue-100" />
        <StatCard icon={Eye} label={t('push.totalViews')} value={totals.views.toLocaleString()} color="text-indigo-600" bgColor="bg-indigo-100" />
        <StatCard icon={MousePointerClick} label={t('push.totalClicks')} value={totals.clicks.toLocaleString()} color="text-emerald-600" bgColor="bg-emerald-100" />
        <StatCard icon={TrendingUp} label={t('push.ctr')} value={`${ctr}%`} color="text-amber-600" bgColor="bg-amber-100" />
      </div>
    </div>
  );
}
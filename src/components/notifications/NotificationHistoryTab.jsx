/**
 * NotificationHistoryTab — Lists sent push notifications with PE stats.
 * 2026-03-17: Created for PushNotifications admin page.
 */
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/utils/i18n.jsx";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Send, Eye, MousePointerClick, AlertTriangle } from "lucide-react";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

const PAGE_SIZE = 15;

export default function NotificationHistoryTab() {
  const { t } = useLanguage();
  const [offset, setOffset] = React.useState(0);

  const { data, isLoading, error } = useQuery({
    queryKey: ['push-history', offset],
    queryFn: () => base44.functions.invoke('pushNotificationAdmin', {
      action: 'list',
      limit: PAGE_SIZE,
      offset,
    }).then(r => r.data),
    staleTime: 30 * 1000,
  });

  const notifications = data?.notifications || [];
  const totalCount = data?.count || 0;

  if (isLoading) return <div className="flex justify-center py-12"><LoadingSpinner size="md" /></div>;

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6 text-center text-red-700">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
          <p>{t('push.loadError')}</p>
        </CardContent>
      </Card>
    );
  }

  if (notifications.length === 0 && offset === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-gray-500">
          <Send className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p>{t('push.noNotifications')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {notifications.map((n) => {
        const stats = n.statistics || n.Statistics || {};
        const sentTime = n.sent_time ? new Date(n.sent_time) : null;

        return (
          <Card key={n.notification_id} className="border border-gray-200">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{n.notification_title}</p>
                  <p className="text-sm text-gray-600 mt-0.5">{n.notification_message}</p>
                  {sentTime && (
                    <p className="text-xs text-gray-400 mt-1">
                      {sentTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {' '}
                      {sentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-1 text-xs text-gray-500" title={t('push.sent')}>
                    <Send className="w-3.5 h-3.5" />
                    <span>{stats.sent_count || 0}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-blue-600" title={t('push.viewed')}>
                    <Eye className="w-3.5 h-3.5" />
                    <span>{stats.read_count || 0}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-green-600" title={t('push.clicked')}>
                    <MousePointerClick className="w-3.5 h-3.5" />
                    <span>{stats.click_count || 0}</span>
                  </div>
                  {(parseInt(stats.failed_count) || 0) > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {stats.failed_count} {t('push.failed')}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Pagination */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          size="sm"
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          {t('push.prev')}
        </Button>
        <span className="text-xs text-gray-500">
          {offset + 1}–{Math.min(offset + PAGE_SIZE, totalCount)} / {totalCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={offset + PAGE_SIZE >= totalCount}
          onClick={() => setOffset(offset + PAGE_SIZE)}
        >
          {t('push.next')}
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
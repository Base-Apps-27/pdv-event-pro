import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/components/utils/i18n';

/**
 * NotificationTrigger
 * 
 * Observes segment actions and segments in real-time.
 * Triggers bilingual notifications when:
 * 1. New action is created (isPrep=true or urgent)
 * 2. Segment transitions to "active"
 * 
 * Mounted at session level (EventProgramView, DirectorConsole, etc.)
 * 
 * 2026-03-10: Desktop Notification API integration
 * 2026-03-11: Fixed ReferenceError — use window.Notification to guard
 *             against environments (WebKit/iOS) where Notification is not
 *             in lexical scope even when the API is partially supported.
 */

// Safe helper — avoids bare `Notification` which throws ReferenceError in WebKit
const notifPermission = () => ('Notification' in window ? window.Notification.permission : 'denied');

export default function NotificationTrigger({ sessionId, segments = [], language = 'en' }) {
  const { language: userLanguage } = useLanguage();
  const lang = language || userLanguage;

  useEffect(() => {
    if (!sessionId || notifPermission() !== 'granted') return;

    // Monitor segments for state changes (active → trigger start alert)
    const unsubSegments = base44.entities.Segment.subscribe((event) => {
      if (event.type !== 'update') return;

      const segment = event.data;
      const wasActive = segments.find(s => s.id === segment.id)?.live_status === 'active';
      const isNowActive = segment.live_status === 'active';

      if (!wasActive && isNowActive) {
        triggerNotification('segment_starting', {
          segmentTitle: segment.title,
          segmentId: segment.id,
          sessionId,
        });
      }
    });

    return () => unsubSegments();
  }, [sessionId, segments, lang]);

  useEffect(() => {
    if (!sessionId || notifPermission() !== 'granted') return;

    // Monitor segment actions (new actions → trigger alert)
    const unsubActions = base44.entities.SegmentAction.subscribe((event) => {
      if (event.type !== 'create') return;

      const action = event.data;
      const segment = segments.find(s => s.id === action.segment_id);

      if (segment && (action.timing === 'before_start' || action.timing === 'before_end')) {
        triggerNotification('action', {
          actionLabel: action.label,
          segmentTitle: segment.title,
          segmentId: segment.id,
          sessionId,
          actionTime: action.absolute_time,
        });
      }
    });

    return () => unsubActions();
  }, [sessionId, segments, lang]);

  const triggerNotification = async (type, data) => {
    try {
      const response = await base44.functions.invoke('sendNotification', {
        type,
        language: lang,
        ...data,
      });

      if (response?.data?.notification && notifPermission() === 'granted') {
        const { title, body } = response.data.notification;
        new window.Notification(title, {
          body,
          icon: '/logo_v2.svg',
          tag: `${type}-${data.segmentId}`,
        });
      }
    } catch (error) {
      console.error('[NOTIF_ERROR]', error);
    }
  };

  return null; // Headless trigger component
}
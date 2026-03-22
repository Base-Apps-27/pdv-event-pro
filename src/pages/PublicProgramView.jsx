/**
 * PublicProgramView — Live View Page
 * 
 * P3 DEV-1 (2026-03-02): Decomposed from 1027 lines into ~250 lines of orchestration.
 * Extracted components: ProgramSelectorBar, ProgramInfoBanner, LiveAdjustmentControls,
 * useSegmentTiming. Existing ServiceProgramView + EventProgramView unchanged.
 * 
 * Auth: Required (Layout enforces redirect + defense-in-depth guard here).
 * Data: Cache-first via useActiveProgramCache, background revalidation via getPublicProgramData.
 * Real-time: ActiveProgramCache subscription (via hook) + entity subs for explicit fetch.
 */
import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import useActiveProgramCache from "@/components/myprogram/useActiveProgramCache";
import { Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatDateET } from "../components/utils/timeFormat";
import StructuredVersesModal from "@/components/service/StructuredVersesModal";
import VerseParserDialog from "@/components/service/VerseParserDialog";
import LiveTimeAdjustmentModal from "@/components/service/LiveTimeAdjustmentModal";
import TimeAdjustmentHistoryModal from "@/components/service/TimeAdjustmentHistoryModal";
import { hasPermission } from "@/components/utils/permissions";
import { useSegmentNotifications } from "@/components/service/useSegmentNotifications";
import ServiceProgramView from "@/components/service/ServiceProgramView";
import EventProgramView from "@/components/service/EventProgramView";
import LiveOperationsChat from "@/components/live/LiveOperationsChat";
import { useLanguage } from "@/components/utils/i18n.jsx";
import LiveViewSkeleton from "@/components/service/LiveViewSkeleton";
import OfflineBanner from "@/components/ui/OfflineBanner";

// DEV-1 extracted components
import ProgramSelectorBar from "@/components/liveview/ProgramSelectorBar";
import ProgramInfoBanner from "@/components/liveview/ProgramInfoBanner";
import LiveAdjustmentControls from "@/components/liveview/LiveAdjustmentControls";
import useSegmentTiming from "@/components/liveview/useSegmentTiming";
import CacheStalenessIndicator from "@/components/liveview/CacheStalenessIndicator";
import { useNotificationPermissionPrompt } from "@/components/notifications/useNotificationPermissionPrompt";
import PushEngageLoader from "@/components/notifications/PushEngageLoader";
import PostSessionFeedbackBanner from "@/components/feedback/PostSessionFeedbackBanner";
import FeedbackBottomSection from "@/components/feedback/FeedbackBottomSection";
import SlidesMaterialBanner from "@/components/liveview/SlidesMaterialBanner";

export default function PublicProgramView() {
  const queryClient = useQueryClient();
  const { language, t } = useLanguage();
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Prompt for notification permission on this page (subscribers receive push alerts)
  // Not on MyProgram (volunteers) or PublicCountdownDisplay (TV).
  useNotificationPermissionPrompt();

  // 2026-03-13: PushEngage SDK now loaded ONLY on Live View and Director Console,
  // not globally in Layout. This prevents MyProgram-only users from subscribing.
  // PushEngageLoader is idempotent — safe to mount on multiple pages.

  // AUTH GATE (2026-02-14): defense-in-depth
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const [authenticated, user] = await Promise.all([
          base44.auth.isAuthenticated(),
          base44.auth.me().catch(() => null),
        ]);
        if (authenticated && user) { setCurrentUser(user); }
        else { base44.auth.redirectToLogin(window.location.href); return; }
      } catch (e) { base44.auth.redirectToLogin(window.location.href); return; }
      setAuthChecked(true);
    };
    fetchUser();
  }, []);

  const gradientStyle = { background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)' };

  // URL params
  const urlParams = new URLSearchParams(window.location.search);
  const preloadedEventId = urlParams.get('eventId') || "";
  const preloadedServiceId = urlParams.get('serviceId') || "";
  const preloadedDate = urlParams.get('date') || "";
  const preloadedSlug = urlParams.get('slug');
  const isStreamMode = urlParams.get('view') === 'livestream';
  const overrideServiceId = urlParams.get('override_service_id');
  const overrideEventId = urlParams.get('override_event_id');
  const mockTimeParam = urlParams.get('mock_time');

  // State
  const [viewType, setViewType] = useState(preloadedServiceId || preloadedDate ? "service" : "event");
  const [selectedEventId, setSelectedEventId] = useState(preloadedEventId);
  const [selectedServiceId, setSelectedServiceId] = useState(preloadedServiceId);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [versesModalOpen, setVersesModalOpen] = useState(false);
  const [versesModalData, setVersesModalData] = useState({ parsedData: null, rawText: "" });
  const [verseParserOpen, setVerseParserOpen] = useState(false);
  const [verseParserInitial, setVerseParserInitial] = useState("");
  const [verseParserSegment, setVerseParserSegment] = useState(null);
  const [expandedSegments, setExpandedSegments] = useState({});
  const [timeAdjustmentModalOpen, setTimeAdjustmentModalOpen] = useState(false);
  const [adjustmentModalTimeSlot, setAdjustmentModalTimeSlot] = useState(null);
  const [currentAdjustment, setCurrentAdjustment] = useState(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);

  // Clock tick (or mock time)
  useEffect(() => {
    if (mockTimeParam) {
      const [h, m] = mockTimeParam.split(':').map(Number);
      const d = new Date(); d.setHours(h, m, 0, 0); setCurrentTime(d); return;
    }
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [mockTimeParam]);

  useEffect(() => { if (preloadedEventId) setSelectedEventId(preloadedEventId); }, [preloadedEventId]);

  // ── CACHE-FIRST DATA LAYER ──
  const programCacheKey = useMemo(() => {
    if (viewType === 'event' && selectedEventId) return `event_${selectedEventId}`;
    if (viewType === 'service' && selectedServiceId) return `service_${selectedServiceId}`;
    return 'current_display';
  }, [viewType, selectedEventId, selectedServiceId]);

  const { contextType: cacheContextType, contextId: cacheContextId, programData: defaultCacheProgramData, selectorOptions: cacheSelectorOptions, isLoading: isCacheLoading, _isOverride, cacheRecord } = useActiveProgramCache({ overrideServiceId, overrideEventId });
  const { programData: warmCacheProgramData, isLoading: isWarmCacheLoading } = useActiveProgramCache({ programCacheKey: programCacheKey !== 'current_display' ? programCacheKey : undefined });
  const cacheProgramData = warmCacheProgramData || defaultCacheProgramData;
  const publicEvents = cacheSelectorOptions?.events || [];
  const services = cacheSelectorOptions?.services || [];

  // Auto-detect from cache
  const [autoDetected, setAutoDetected] = useState(false);
  useEffect(() => {
    if (autoDetected || isCacheLoading) return;
    if (preloadedEventId || preloadedServiceId || preloadedDate || preloadedSlug) { setAutoDetected(true); return; }
    if (cacheContextType && cacheContextId) {
      if (cacheContextType === 'event') { setSelectedEventId(cacheContextId); setViewType('event'); }
      else if (cacheContextType === 'service') { setSelectedServiceId(cacheContextId); setViewType('service'); }
      setAutoDetected(true);
    }
  }, [cacheContextType, cacheContextId, isCacheLoading, autoDetected, preloadedEventId, preloadedServiceId, preloadedDate, preloadedSlug]);

  const isCachedSelection = useMemo(() => {
    if (warmCacheProgramData) return true;
    if (!cacheContextId || !defaultCacheProgramData) return false;
    if (viewType === 'event' && selectedEventId === cacheContextId) return true;
    if (viewType === 'service' && selectedServiceId === cacheContextId) return true;
    return false;
  }, [viewType, selectedEventId, selectedServiceId, cacheContextId, defaultCacheProgramData, warmCacheProgramData]);

  // Background revalidation fetch
  const { data: explicitFetchData, isLoading: isExplicitLoading, refetch: refetchExplicit } = useQuery({
    queryKey: ['publicProgramData-explicit', selectedEventId, selectedServiceId, viewType, preloadedDate, preloadedSlug],
    queryFn: async () => {
      const payload = { includeOptions: false };
      if (viewType === 'event' && selectedEventId) payload.eventId = selectedEventId;
      else if (viewType === 'service' && selectedServiceId) payload.serviceId = selectedServiceId;
      else if (preloadedDate) payload.date = preloadedDate;
      else payload.detectActive = true;
      const response = await base44.functions.invoke('getPublicProgramData', payload);
      if (response.status >= 400) throw new Error("Failed to fetch program data");
      return response.data;
    },
    enabled: !!(selectedEventId || selectedServiceId || preloadedDate),
    staleTime: 30 * 1000, refetchInterval: 30000,
  });

  // Merged program data
  const programData = useMemo(() => {
    if (explicitFetchData) return explicitFetchData;
    if (isCachedSelection && cacheProgramData) return cacheProgramData;
    if (warmCacheProgramData) return warmCacheProgramData;
    return null;
  }, [explicitFetchData, isCachedSelection, cacheProgramData, warmCacheProgramData]);

  const isLoadingProgram = isCachedSelection ? (isCacheLoading && !cacheProgramData) : (isExplicitLoading && !explicitFetchData);

  // Derived data
  const sessions = programData?.sessions || [];
  const allSegments = programData?.segments || [];
  const rooms = programData?.rooms || [];
  const preSessionDetails = programData?.preSessionDetails || [];
  const rawServiceData = viewType === 'service' ? programData?.program : null;
  const actualServiceData = rawServiceData ? { ...rawServiceData } : null;
  const liveAdjustments = programData?.liveAdjustments || [];
  const selectedEvent = publicEvents.find(e => e.id === selectedEventId);
  const selectedService = services.find(s => s.id === selectedServiceId);

  // ── REAL-TIME SUBSCRIPTIONS ──
  const explicitDebounceRef = React.useRef(null);
  useEffect(() => {
    if (!currentUser) return;
    const unsubs = [];
    const debouncedInvalidate = () => {
      if (explicitDebounceRef.current) clearTimeout(explicitDebounceRef.current);
      explicitDebounceRef.current = setTimeout(() => { queryClient.invalidateQueries({ queryKey: ['publicProgramData-explicit'] }); explicitDebounceRef.current = null; }, 800);
    };
    unsubs.push(base44.entities.Segment.subscribe(() => debouncedInvalidate()));
    unsubs.push(base44.entities.Session.subscribe(() => debouncedInvalidate()));
    unsubs.push(base44.entities.SegmentAction.subscribe(() => debouncedInvalidate()));
    unsubs.push(base44.entities.PreSessionDetails.subscribe(() => debouncedInvalidate()));
    if (viewType === 'service' && selectedServiceId) unsubs.push(base44.entities.Service.subscribe(() => debouncedInvalidate()));
    if (viewType === 'event' && selectedEventId) {
      unsubs.push(base44.entities.Event.subscribe(() => debouncedInvalidate()));
      unsubs.push(base44.entities.StreamBlock.subscribe(() => { debouncedInvalidate(); queryClient.invalidateQueries({ queryKey: ['streamBlocksForStatusCard'] }); }));
    }
    return () => { if (explicitDebounceRef.current) clearTimeout(explicitDebounceRef.current); unsubs.forEach(u => { if (typeof u === 'function') u(); }); };
  }, [viewType, selectedServiceId, selectedEventId, queryClient, currentUser]);

  // Adjustment history logs
  const { data: adjustmentLogs = [] } = useQuery({
    queryKey: ['adjustmentLogs', selectedServiceId, rawServiceData?.date],
    queryFn: async () => {
      if (!selectedServiceId || !rawServiceData?.date) return [];
      return await base44.entities.TimeAdjustmentLog.filter({ date: rawServiceData.date, service_id: selectedServiceId }, '-created_date');
    },
    enabled: viewType === "service" && !!selectedServiceId && !!rawServiceData?.date,
    staleTime: 15000, refetchInterval: 30000,
  });

  // LiveTimeAdjustment subscription
  useEffect(() => {
    if (!currentUser || viewType !== "service" || !selectedServiceId || !rawServiceData?.date) return;
    return base44.entities.LiveTimeAdjustment.subscribe((event) => {
      if (event.data?.date === rawServiceData.date && event.data?.service_id === selectedServiceId) {
        queryClient.invalidateQueries({ queryKey: ['publicProgramData-explicit'] });
      }
    });
  }, [viewType, selectedServiceId, rawServiceData?.date, queryClient, currentUser]);

  // ── SEGMENT TIMING (extracted hook) ──
  const { isSegmentCurrent, isSegmentUpcoming, scrollToSegment } = useSegmentTiming({
    currentTime, viewType, serviceDate: actualServiceData?.date, sessions,
  });

  // Helpers
  const getRoomName = (roomId) => rooms.find(r => r.id === roomId)?.name || "";
  const toggleSegmentExpanded = (segId) => setExpandedSegments(p => ({ ...p, [segId]: !p[segId] }));

  // Notification hook
  useSegmentNotifications(allSegments, viewType === "event" ? sessions[0] : null);

  // Time adjustment handlers
  const handleSaveTimeAdjustment = async (offsetMinutes, authorizedBy) => {
    if (!selectedServiceId || !rawServiceData?.date || !adjustmentModalTimeSlot) return;
    const isCustom = adjustmentModalTimeSlot === "custom";
    const adjustmentType = isCustom ? "global" : "time_slot";
    const existing = liveAdjustments.find(a => isCustom ? a.adjustment_type === 'global' : a.time_slot === adjustmentModalTimeSlot);
    const previousOffset = existing?.offset_minutes || 0;
    const action = offsetMinutes === 0 ? 'clear' : (existing ? 'update' : 'set');
    await base44.entities.TimeAdjustmentLog.create({ date: rawServiceData.date, service_id: selectedServiceId, time_slot: isCustom ? 'custom' : adjustmentModalTimeSlot, previous_offset: previousOffset, new_offset: offsetMinutes, authorized_by: authorizedBy, performed_by_name: currentUser?.full_name || '', performed_by_email: currentUser?.email || '', action });
    if (existing) await base44.entities.LiveTimeAdjustment.update(existing.id, { offset_minutes: offsetMinutes, authorized_by: authorizedBy, updated_at: new Date().toISOString() });
    else await base44.entities.LiveTimeAdjustment.create({ date: rawServiceData.date, adjustment_type: adjustmentType, service_id: selectedServiceId, time_slot: isCustom ? null : adjustmentModalTimeSlot, offset_minutes: offsetMinutes, authorized_by: authorizedBy });
    // GRO-1 (2026-03-02): Track live timing adjustments
    base44.analytics.track({ eventName: 'live_timing_adjusted', properties: { offset: offsetMinutes, time_slot: adjustmentModalTimeSlot, action } });
    const { toast } = await import("sonner");
    toast.success(t('adjustments.saveSuccess'));
  };

  const openAdjustmentModal = (timeSlot) => {
    const existing = timeSlot === "custom" ? liveAdjustments.find(a => a.adjustment_type === 'global') : liveAdjustments.find(a => a.time_slot === timeSlot);
    setCurrentAdjustment(existing || null);
    setAdjustmentModalTimeSlot(timeSlot);
    setTimeAdjustmentModalOpen(true);
  };

  // ── RENDER ──
  if (!authChecked) return <LiveViewSkeleton />;
  const isContentLoading = !programData && isLoadingProgram && (selectedEventId || selectedServiceId);
  if (isContentLoading) return <LiveViewSkeleton />;

  const hasSelection = (selectedEventId && selectedEvent) || (selectedServiceId && selectedService);
  const canAccessLiveOps = !!(currentUser && hasPermission(currentUser, 'view_live_chat'));

  return (
    <div className="min-h-screen bg-[#F0F1F3]">
      {/* 2026-03-13: PushEngage SDK gated to Live View only (not global Layout) */}
      <PushEngageLoader />
      {/* GRO-5 (2026-03-02): Offline banner */}
      <OfflineBanner language={language} />

      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* DEV-1: Extracted selector bar */}
        <ProgramSelectorBar
          viewType={viewType} setViewType={setViewType}
          selectedEventId={selectedEventId} setSelectedEventId={setSelectedEventId}
          selectedServiceId={selectedServiceId} setSelectedServiceId={setSelectedServiceId}
          publicEvents={publicEvents} services={services}
        />

        {hasSelection && (
          <>
            {/* 2026-03-16: Post-session feedback banner — gentle nudge after all segments end */}
            <PostSessionFeedbackBanner
              segments={allSegments}
              sessions={sessions}
              currentTime={currentTime}
              serviceDate={actualServiceData?.date}
              contextEventId={viewType === 'event' ? selectedEventId : undefined}
              contextServiceId={viewType === 'service' ? selectedServiceId : undefined}
            />

            {/* 2026-03-22: Slides/Presentation Material Banner — highest priority visual.
                 Distinct indigo/purple gradient separates it from amber (timing) and green (feedback). */}
            <SlidesMaterialBanner allSegments={allSegments} sessions={sessions} />

            {/* DEV-1: Extracted info banner */}
            <ProgramInfoBanner viewType={viewType} selectedEvent={selectedEvent} selectedService={selectedService} isOverride={_isOverride} />

            {/* CacheStalenessIndicator removed 2026-03-12:
                The timestamp created more confusion than value — age text goes stale between renders,
                the Refresh button silently skips on concurrency guard, and non-admins see a number
                they can't act on. Real-time subscription + 2-min safety poll handle freshness silently. */}

            {/* DEV-1: Extracted adjustment controls (service only) */}
            {viewType === "service" && (
              <LiveAdjustmentControls
                liveAdjustments={liveAdjustments} actualServiceData={actualServiceData}
                sessions={sessions} currentUser={currentUser}
                openAdjustmentModal={openAdjustmentModal} setHistoryModalOpen={setHistoryModalOpen}
              />
            )}

            {/* Service Program View */}
            {viewType === "service" && actualServiceData && (
              <ServiceProgramView
                actualServiceData={actualServiceData} allSegments={allSegments} sessions={sessions}
                liveAdjustments={liveAdjustments}
                preSessionData={preSessionDetails.find(p => sessions[0] && p.session_id === sessions[0].id) || null}
                allPreSessionDetails={preSessionDetails} currentTime={currentTime}
                isSegmentCurrent={isSegmentCurrent} isSegmentUpcoming={isSegmentUpcoming}
                toggleSegmentExpanded={toggleSegmentExpanded}
                onOpenVerses={(data) => { setVersesModalData({ parsedData: data.parsedData, rawText: data.rawText }); setVersesModalOpen(true); }}
                scrollToSegment={scrollToSegment}
                canAccessLiveOps={canAccessLiveOps} onToggleChat={() => setChatOpen(!chatOpen)}
                chatUnreadCount={chatUnreadCount} chatOpen={chatOpen}
              />
            )}

            {/* Event Program View */}
            {viewType === "event" && selectedEvent && (
              <EventProgramView
                selectedEvent={selectedEvent} eventSessions={sessions}
                allSegments={allSegments} preSessionDetails={preSessionDetails}
                currentUser={currentUser} currentTime={currentTime}
                isSegmentCurrent={isSegmentCurrent} isSegmentUpcoming={isSegmentUpcoming}
                onOpenVerses={(data) => { setVersesModalData({ parsedData: data.parsedData, rawText: data.rawText }); setVersesModalOpen(true); }}
                scrollToSegment={scrollToSegment} refetchData={() => refetchExplicit()}
                getRoomName={getRoomName}
                onOpenVerseParser={({ segment, initialText }) => { setVerseParserSegment(segment); setVerseParserInitial(initialText || ""); setVerseParserOpen(true); }}
                canAccessLiveOps={canAccessLiveOps} onToggleChat={() => setChatOpen(!chatOpen)}
                chatUnreadCount={chatUnreadCount} chatOpen={chatOpen}
                isStreamMode={isStreamMode}
              />
            )}

            {viewType === "event" && sessions.length === 0 && (
              <Card className="p-12 text-center bg-white border-2 border-gray-300">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">{t('public.noSessions')}</p>
              </Card>
            )}
          </>
        )}

        {!selectedEventId && !selectedServiceId && (
          <Card className="p-12 text-center bg-white border-dashed border-2 border-gray-400">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">{viewType === 'event' ? t('public.selectPromptEvent') : t('public.selectPromptService')}</p>
          </Card>
        )}
      </div>

      {/* Modals */}
      <StructuredVersesModal open={versesModalOpen} onOpenChange={setVersesModalOpen} parsedData={versesModalData.parsedData} rawText={versesModalData.rawText} language={language} />
      <VerseParserDialog open={verseParserOpen} onOpenChange={setVerseParserOpen} initialText={verseParserInitial} onSave={async ({ parsed_data, verse }) => { if (!verseParserSegment) return; await base44.entities.Segment.update(verseParserSegment.id, { scripture_references: verse, parsed_verse_data: parsed_data }); setVersesModalData({ parsedData: parsed_data, rawText: verse }); setVersesModalOpen(true); refetchExplicit(); }} language={language} />
      <LiveTimeAdjustmentModal isOpen={timeAdjustmentModalOpen} onClose={() => { setTimeAdjustmentModalOpen(false); setAdjustmentModalTimeSlot(null); setCurrentAdjustment(null); }} timeSlot={adjustmentModalTimeSlot} currentOffset={currentAdjustment?.offset_minutes || 0} onSave={handleSaveTimeAdjustment} serviceTime={actualServiceData?.time} />
      <TimeAdjustmentHistoryModal isOpen={historyModalOpen} onClose={() => setHistoryModalOpen(false)} logs={adjustmentLogs} selectedDate={rawServiceData?.date ? formatDateET(rawServiceData.date) : ''} />
      {currentUser && hasPermission(currentUser, 'view_live_chat') && (viewType === "event" ? selectedEvent : selectedService) && (
        <LiveOperationsChat currentUser={currentUser} contextType={viewType} contextId={viewType === "event" ? selectedEventId : selectedServiceId} contextDate={viewType === "event" ? selectedEvent?.end_date : rawServiceData?.date} contextName={viewType === "event" ? selectedEvent?.name : selectedService?.name} isOpen={chatOpen} onToggle={setChatOpen} onUnreadCountChange={setChatUnreadCount} hideTrigger={true} />
      )}

      {/* 2026-03-16: Static feedback section — scroll-to-bottom CTA replaces floating FAB
           to avoid overlap with StickyOpsDeck. Always accessible at end of program content. */}
      {currentUser && hasPermission(currentUser, 'access_live_view') && hasSelection && (
        <FeedbackBottomSection
          contextEventId={viewType === 'event' ? selectedEventId : undefined}
          contextServiceId={viewType === 'service' ? selectedServiceId : undefined}
          contextSessionId={sessions[0]?.id}
          sessions={sessions}
        />
      )}

      {/* Footer */}
      <div style={gradientStyle} className="mt-12 py-6">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691b19c064436ea35f171ca3/e75f54157_image.png" alt="Logo" className="w-12 h-12 mx-auto mb-3" />
          <p className="text-white font-semibold text-lg tracking-wide uppercase">{t('public.footer.motto')}</p>
          <p className="text-white text-sm mt-2">{t('public.footer.name')}</p>
        </div>
      </div>
    </div>
  );
}
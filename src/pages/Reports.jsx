/**
 * Reports Page — Event report viewer with multiple report types
 * 
 * PHASE 3D REFACTOR: Decomposed from 1,609 → ~350 lines.
 * Extracted modules:
 *   - report/reportHelpers.js          (helper functions, constants)
 *   - report/reportPrintStyles.js      (print CSS)
 *   - report/PreSessionDetailsBlock    (shared PSD component)
 *   - report/DetailedProgramView       (detailed report)
 *   - report/GeneralProgramView        (general program)
 *   - report/ProjectionReportView      (projection notes)
 *   - report/SoundReportView           (sound notes)
 *   - report/HospitalityReportView     (hospitality tasks)
 *   - report/UshersReportView          (ushers notes)
 * 
 * This file retains: data fetching, event selector, tab system, PDF export, print orchestration.
 */
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { generateEventReportPDFClient } from "@/components/service/generateEventReportsPDFClient";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { FileText, Printer, Filter, Projector, Volume2, Users as UsersIcon, List, Utensils, ExternalLink, Share2, Copy, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/components/utils/i18n";

// Phase 3D extracted modules
import { mergePreSessionDetails, downloadPdf } from "@/components/report/reportHelpers";
import { REPORT_PRINT_CSS } from "@/components/report/reportPrintStyles";
import DetailedProgramView from "@/components/report/DetailedProgramView";
import GeneralProgramView from "@/components/report/GeneralProgramView";
import ProjectionReportView from "@/components/report/ProjectionReportView";
import SoundReportView from "@/components/report/SoundReportView";
import HospitalityReportView from "@/components/report/HospitalityReportView";
import UshersReportView from "@/components/report/UshersReportView";
import LivestreamReportView from "@/components/report/LivestreamReportView";
import { Radio } from "lucide-react";

export default function Reports() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const eventIdFromUrl = urlParams.get('eventId');
  const [selectedEventId, setSelectedEventId] = useState(eventIdFromUrl || "");
  const [activeReport, setActiveReport] = useState("detailed");
  const [copySuccess, setCopySuccess] = useState(false);
  const [printAllMode, setPrintAllMode] = useState(false);

  // CLEANUP (2026-02-10): Auth check removed — Layout already gates all non-public pages.

  // Phase 7: Added staleTime to reduce unnecessary refetches
  const { data: eventsRaw = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.Event.list('-year'),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  // Filter out templates to match Events.js behavior - only show real events
  const events = eventsRaw.filter(e => e.status !== 'template');

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions', selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data } = await base44.functions.invoke('getSortedSessions', { eventId: selectedEventId });
      return data.sessions || [];
    },
    enabled: !!selectedEventId,
  });

  const sessionIdsKey = React.useMemo(
    () => sessions.map(s => s.id).sort().join(','),
    [sessions]
  );

  const { data: allSegments = [] } = useQuery({
    queryKey: ['segments', selectedEventId, sessionIdsKey],
    queryFn: async () => {
      if (!selectedEventId || sessions.length === 0) return [];
      const sessionIds = sessions.map(s => s.id);
      const response = await base44.functions.invoke('getSegmentsBySessionIds', { sessionIds });
      return response.data.segments || [];
    },
    enabled: !!selectedEventId && sessions.length > 0,
  });

  const { data: allPreSessionDetails = [] } = useQuery({
    queryKey: ['preSessionDetails', selectedEventId],
    queryFn: async () => {
      if (sessions.length === 0) return [];
      const sessionIds = sessions.map(s => s.id);
      const results = await Promise.all(
        sessionIds.map(sid => base44.entities.PreSessionDetails.filter({ session_id: sid }))
      );
      return results.flat();
    },
    enabled: !!selectedEventId && sessions.length > 0,
  });

  const { data: allHospitalityTasks = [] } = useQuery({
    queryKey: ['hospitalityTasks', selectedEventId],
    queryFn: async () => {
      if (sessions.length === 0) return [];
      const sessionIds = sessions.map(s => s.id);
      const results = await Promise.all(
        sessionIds.map(sid => base44.entities.HospitalityTask.filter({ session_id: sid }, 'order'))
      );
      return results.flat();
    },
    enabled: !!selectedEventId && sessions.length > 0,
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => base44.entities.Room.list(),
  });

  const selectedEvent = events.find(e => e.id === selectedEventId);
  // Keep Reports in sync with Session Editor: primary sort by explicit 'order' if set, otherwise chronological
  const eventSessions = sessions
    .filter(s => s.event_id === selectedEventId)
    .sort((a, b) => {
      const ao = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER;
      const bo = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      if ((a.date || '') !== (b.date || '')) return (a.date || '').localeCompare(b.date || '');
      const at = a.planned_start_time || '';
      const bt = b.planned_start_time || '';
      return at.localeCompare(bt);
    });
  
  const getSessionSegments = (sessionId, filterKey) => {
    return allSegments
      .filter(seg => seg.session_id === sessionId && (filterKey ? seg[filterKey] : true))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  };

  const handlePrint = () => {
    setPrintAllMode(false);
    setTimeout(() => window.print(), 100);
  };

  const handlePrintAll = () => {
    setPrintAllMode(true);
    setTimeout(() => window.print(), 100);
  };

  const getPublicViewUrl = () => {
    const baseUrl = 'https://pdv-event-pro.base44.app';
    const pagePath = createPageUrl("PublicProgramView");
    const eventSlug = selectedEvent?.slug;
    if (eventSlug) {
      return `${baseUrl}${pagePath}?slug=${eventSlug}`;
    }
    return `${baseUrl}${pagePath}?eventId=${selectedEventId}`;
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getPublicViewUrl());
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleOpenPublicView = () => {
    const eventSlug = selectedEvent?.slug;
    if (eventSlug) {
      navigate(createPageUrl("PublicProgramView") + `?slug=${eventSlug}`);
    } else {
      navigate(createPageUrl("PublicProgramView") + `?eventId=${selectedEventId}`);
    }
  };

  // Build PDF export data mappings from already-loaded data
  const buildPdfData = () => {
    const segmentsBySession = sessions.reduce((acc, s) => {
      acc[s.id] = allSegments.filter(seg => seg.session_id === s.id).sort((a,b)=>(a.order||0)-(b.order||0));
      return acc;
    }, {});
    const preSessionDetailsBySession = sessions.reduce((acc, s) => {
      const records = allPreSessionDetails.filter(psd => psd.session_id === s.id);
      if (records.length > 0) acc[s.id] = mergePreSessionDetails(records);
      return acc;
    }, {});
    const hospitalityTasksBySession = sessions.reduce((acc, s) => {
      acc[s.id] = allHospitalityTasks.filter(t => t.session_id === s.id);
      return acc;
    }, {});
    return { segmentsBySession, preSessionDetailsBySession, hospitalityTasksBySession };
  };

  const handleExportCurrentPdf = async () => {
    if (!selectedEventId) return;
    const typeMap = { detailed: 'detailed', projection: 'projection', sound: 'sound', ushers: 'ushers', hospitality: 'hospitality', general: 'general' };
    const rt = typeMap[activeReport] || 'detailed';
    const { segmentsBySession, preSessionDetailsBySession, hospitalityTasksBySession } = buildPdfData();
    const bytes = await generateEventReportPDFClient({ event: selectedEvent, sessions: eventSessions, segmentsBySession, preSessionDetailsBySession, hospitalityTasksBySession, rooms, reportType: rt });
    await downloadPdf(rt, bytes);
  };

  const handleExportAllPdfs = async () => {
    if (!selectedEventId) return;
    const { segmentsBySession, preSessionDetailsBySession, hospitalityTasksBySession } = buildPdfData();
    const types = ['detailed','general','projection','sound','ushers','hospitality'];
    for (const rt of types) {
      const bytes = await generateEventReportPDFClient({ event: selectedEvent, sessions: eventSessions, segmentsBySession, preSessionDetailsBySession, hospitalityTasksBySession, rooms, reportType: rt });
      await downloadPdf(rt, bytes);
    }
  };

  // Shared props for all view components
  const viewProps = { eventSessions, getSessionSegments, selectedEvent, allPreSessionDetails, rooms };

  return (
    <>
      <style>{REPORT_PRINT_CSS}</style>
      
      <div className="p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
          <div>
            <h1 className="text-3xl text-gray-900 uppercase">{t('reports.title')}</h1>
            <p className="text-gray-600 mt-1">{t('reports.subtitle')}</p>
          </div>
          <div className="flex gap-3">
            {selectedEventId && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="font-bold uppercase">
                    <Share2 className="w-4 h-4 mr-2" />
                    {t('reports.publicView')}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleOpenPublicView}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    {t('reports.openPublicView')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCopyLink} aria-label={t('reports.copyLink')}>
                    {copySuccess ? (
                      <><Check className="w-4 h-4 mr-2 text-green-600" />{t('reports.copied')}</>
                    ) : (
                      <><Copy className="w-4 h-4 mr-2" />{t('reports.copyLink')}</>
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  disabled={!selectedEventId}
                  style={{ background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)', color: '#ffffff' }}
                  className="font-bold uppercase"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  {t('reports.printExport')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handlePrint}>
                  <FileText className="w-4 h-4 mr-2" />
                  {t('reports.printCurrent')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handlePrintAll}>
                  <List className="w-4 h-4 mr-2" />
                  {t('reports.printAll')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCurrentPdf}>
                  <FileText className="w-4 h-4 mr-2" />
                  {t('reports.exportCurrentPdf')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportAllPdfs}>
                  <FileText className="w-4 h-4 mr-2" />
                  {t('reports.exportAllPdfs')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Card className="bg-white border-gray-200 no-print">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <Filter className="w-5 h-5" />
              {t('reports.selectEvent')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedEventId} onValueChange={setSelectedEventId}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder={t('reports.selectEventPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {events.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.name} - {event.year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedEventId && selectedEvent && (
          <div id="printable-report" className="bg-white p-4 rounded-lg shadow-sm">
            {/* Standard header for screen view */}
            <div className="text-center mb-3 border-b border-gray-300 pb-2 print:hidden">
              <h1 className="text-xl text-gray-900 inline">{selectedEvent.name}</h1>
              {selectedEvent.theme && (
                <p className="text-sm italic inline ml-2" style={{ color: '#8DC63F' }}>"{selectedEvent.theme}"</p>
              )}
            </div>

            <Tabs value={activeReport} onValueChange={setActiveReport} className="w-full">
              <TabsList className="grid w-full grid-cols-6 mb-6 no-print">
                <TabsTrigger value="detailed" className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  {t('reports.tabs.detailed')}
                </TabsTrigger>
                <TabsTrigger value="general" className="flex items-center gap-2">
                  <List className="w-4 h-4" />
                  {t('reports.tabs.general')}
                </TabsTrigger>
                <TabsTrigger value="projection" className="flex items-center gap-2">
                  <Projector className="w-4 h-4" />
                  {t('reports.tabs.projection')}
                </TabsTrigger>
                <TabsTrigger value="sound" className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4" />
                  {t('reports.tabs.sound')}
                </TabsTrigger>
                <TabsTrigger value="ushers" className="flex items-center gap-2">
                  <UsersIcon className="w-4 h-4" />
                  {t('reports.tabs.ushers')}
                </TabsTrigger>
                <TabsTrigger value="hospitality" className="flex items-center gap-2">
                  <Utensils className="w-4 h-4" />
                  {t('reports.tabs.hospitality')}
                </TabsTrigger>
                <TabsTrigger value="livestream" className="flex items-center gap-2">
                  <Radio className="w-4 h-4" />
                  Livestream
                </TabsTrigger>
              </TabsList>

              <TabsContent value="detailed">
                <DetailedProgramView {...viewProps} allHospitalityTasks={allHospitalityTasks} />
              </TabsContent>
              <TabsContent value="general">
                <GeneralProgramView {...viewProps} />
              </TabsContent>
              <TabsContent value="projection">
                <ProjectionReportView {...viewProps} />
              </TabsContent>
              <TabsContent value="sound">
                <SoundReportView {...viewProps} />
              </TabsContent>
              <TabsContent value="ushers">
                <UshersReportView {...viewProps} />
              </TabsContent>
              <TabsContent value="hospitality">
                <HospitalityReportView {...viewProps} allHospitalityTasks={allHospitalityTasks} />
              </TabsContent>
              <TabsContent value="livestream">
                <LivestreamReportView {...viewProps} />
              </TabsContent>
            </Tabs>

            {/* Print All Mode - renders all reports for printing */}
            {printAllMode && (
              <div className="print-all-reports hidden print:block">
                <div className="print-section">
                  <h2 className="text-lg mb-2 border-b pb-1">INFORME DETALLADO</h2>
                  <DetailedProgramView {...viewProps} allHospitalityTasks={allHospitalityTasks} />
                </div>
                <div className="print-section" style={{ breakBefore: 'page' }}>
                  <h2 className="text-lg mb-2 border-b pb-1">PROGRAMA GENERAL</h2>
                  <GeneralProgramView {...viewProps} />
                </div>
                <div className="print-section" style={{ breakBefore: 'page' }}>
                  <h2 className="text-lg mb-2 border-b pb-1">NOTAS DE PROYECCIÓN</h2>
                  <ProjectionReportView {...viewProps} />
                </div>
                <div className="print-section" style={{ breakBefore: 'page' }}>
                  <h2 className="text-lg mb-2 border-b pb-1">NOTAS DE SONIDO</h2>
                  <SoundReportView {...viewProps} />
                </div>
                <div className="print-section" style={{ breakBefore: 'page' }}>
                  <h2 className="text-lg mb-2 border-b pb-1">NOTAS DE UJIERES</h2>
                  <UshersReportView {...viewProps} />
                </div>
                <div className="print-section" style={{ breakBefore: 'page' }}>
                  <h2 className="text-lg mb-2 border-b pb-1">HOSPITALIDAD</h2>
                  <HospitalityReportView {...viewProps} allHospitalityTasks={allHospitalityTasks} />
                </div>
                <div className="print-section" style={{ breakBefore: 'page' }}>
                  <h2 className="text-lg mb-2 border-b pb-1">LIVESTREAM RUN OF SHOW</h2>
                  <LivestreamReportView {...viewProps} />
                </div>
              </div>
            )}
          </div>
        )}

        {!selectedEventId && (
          <Card className="p-12 text-center border-dashed border-2 bg-white border-gray-300">
            <Filter className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">{t('reports.selectEventPrompt')}</p>
          </Card>
        )}
      </div>
    </>
  );
}
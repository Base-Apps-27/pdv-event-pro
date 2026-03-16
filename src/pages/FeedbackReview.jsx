/**
 * FeedbackReview — Admin page for browsing and triaging session feedback
 * 
 * 2026-03-16: Phase 1 of Feedback & Institutional Knowledge system.
 * Decision: "SessionFeedback entity — elevated users only, LiveView surface"
 * 
 * Filters: event, service, department, category, follow_up_status.
 * Inline editing of follow_up_status and follow_up_notes.
 * Permission: hasDashboardAccess (enforced by nav gating + Layout redirect).
 */
import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/components/utils/i18n.jsx";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquarePlus, Filter, ChevronDown, ChevronUp, CheckCircle2, Clock, Eye, XCircle } from "lucide-react";
import { formatDateET } from "@/components/utils/timeFormat";

const CATEGORY_COLORS = {
  observation: "bg-blue-100 text-blue-700",
  improvement: "bg-amber-100 text-amber-700",
  issue_encountered: "bg-red-100 text-red-700",
  what_went_well: "bg-green-100 text-green-700",
  follow_up_needed: "bg-purple-100 text-purple-700",
};

const STATUS_CONFIG = {
  pending: { icon: Clock, color: "bg-slate-100 text-slate-600", label: "Pending" },
  reviewed: { icon: Eye, color: "bg-blue-100 text-blue-600", label: "Reviewed" },
  actioned: { icon: CheckCircle2, color: "bg-green-100 text-green-600", label: "Actioned" },
  dismissed: { icon: XCircle, color: "bg-slate-100 text-slate-400", label: "Dismissed" },
};

export default function FeedbackReview() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  // Filters
  const [filterDepartment, setFilterDepartment] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

  // Fetch all feedback
  const { data: allFeedback = [], isLoading } = useQuery({
    queryKey: ['sessionFeedback'],
    queryFn: () => base44.entities.SessionFeedback.list('-created_date', 200),
  });

  // Fetch events and services for display names
  const { data: events = [] } = useQuery({
    queryKey: ['feedbackEvents'],
    queryFn: () => base44.entities.Event.list('-start_date', 50),
  });
  const { data: services = [] } = useQuery({
    queryKey: ['feedbackServices'],
    queryFn: () => base44.entities.Service.list('-date', 50),
  });

  const eventMap = useMemo(() => Object.fromEntries(events.map(e => [e.id, e.name])), [events]);
  const serviceMap = useMemo(() => Object.fromEntries(services.map(s => [s.id, s.name])), [services]);

  // Filter feedback
  const filtered = useMemo(() => {
    return allFeedback.filter(fb => {
      if (filterDepartment !== "all" && fb.department !== filterDepartment) return false;
      if (filterCategory !== "all" && fb.category !== filterCategory) return false;
      if (filterStatus !== "all" && fb.follow_up_status !== filterStatus) return false;
      return true;
    });
  }, [allFeedback, filterDepartment, filterCategory, filterStatus]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SessionFeedback.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessionFeedback'] }),
  });

  const departments = [...new Set(allFeedback.map(f => f.department).filter(Boolean))];

  return (
    <div className="min-h-screen bg-[#F0F1F3]">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl tracking-wider text-slate-800">{t('feedback.reviewTitle')}</h1>
            <p className="text-sm text-slate-500 mt-1 font-sans normal-case">{t('feedback.reviewSubtitle')}</p>
          </div>
          <Badge variant="outline" className="text-sm">
            {filtered.length} {t('feedback.entries')}
          </Badge>
        </div>

        {/* Filters */}
        <Card className="border-slate-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-slate-400" />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('feedback.allStatuses')}</SelectItem>
                  <SelectItem value="pending">{t('feedback.status.pending')}</SelectItem>
                  <SelectItem value="reviewed">{t('feedback.status.reviewed')}</SelectItem>
                  <SelectItem value="actioned">{t('feedback.status.actioned')}</SelectItem>
                  <SelectItem value="dismissed">{t('feedback.status.dismissed')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('feedback.allCategories')}</SelectItem>
                  <SelectItem value="observation">{t('feedback.cat.observation')}</SelectItem>
                  <SelectItem value="improvement">{t('feedback.cat.improvement')}</SelectItem>
                  <SelectItem value="issue_encountered">{t('feedback.cat.issue_encountered')}</SelectItem>
                  <SelectItem value="what_went_well">{t('feedback.cat.what_went_well')}</SelectItem>
                  <SelectItem value="follow_up_needed">{t('feedback.cat.follow_up_needed')}</SelectItem>
                </SelectContent>
              </Select>
              {departments.length > 0 && (
                <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                  <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('feedback.allDepartments')}</SelectItem>
                    {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Feedback list */}
        {isLoading ? (
          <div className="text-center py-12 text-slate-400">{t('common.loading')}</div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center border-dashed border-2 border-slate-300">
            <MessageSquarePlus className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">{t('feedback.noFeedback')}</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(fb => {
              const isExpanded = expandedId === fb.id;
              const statusCfg = STATUS_CONFIG[fb.follow_up_status || 'pending'];
              const StatusIcon = statusCfg.icon;
              const contextName = fb.event_id ? eventMap[fb.event_id] : fb.service_id ? serviceMap[fb.service_id] : null;

              return (
                <Card key={fb.id} className="border-slate-200 overflow-hidden">
                  <CardContent className="p-4">
                    {/* Top row: badges + meta */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge className={CATEGORY_COLORS[fb.category] || "bg-slate-100"}>
                          {t(`feedback.cat.${fb.category}`)}
                        </Badge>
                        {fb.department && (
                          <Badge variant="outline" className="text-xs">{fb.department}</Badge>
                        )}
                        <Badge className={statusCfg.color + " text-xs gap-1"}>
                          <StatusIcon className="w-3 h-3" />
                          {t(`feedback.status.${fb.follow_up_status || 'pending'}`)}
                        </Badge>
                      </div>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : fb.id)}
                        className="text-slate-400 hover:text-slate-600 p-1 flex-shrink-0"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Feedback text */}
                    <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{fb.feedback_text}</p>

                    {/* Meta line */}
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-400">
                      {contextName && <span>{contextName}</span>}
                      <span>{fb.created_by}</span>
                      <span>{formatDateET(fb.created_date)}</span>
                    </div>

                    {/* Expanded: admin controls */}
                    {isExpanded && (
                      <div className="mt-4 pt-3 border-t border-slate-100 space-y-3">
                        <div className="flex gap-2 items-center">
                          <span className="text-xs font-medium text-slate-500">{t('feedback.status.label')}:</span>
                          <Select
                            value={fb.follow_up_status || "pending"}
                            onValueChange={(val) => updateMutation.mutate({ id: fb.id, data: { follow_up_status: val } })}
                          >
                            <SelectTrigger className="w-[130px] h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">{t('feedback.status.pending')}</SelectItem>
                              <SelectItem value="reviewed">{t('feedback.status.reviewed')}</SelectItem>
                              <SelectItem value="actioned">{t('feedback.status.actioned')}</SelectItem>
                              <SelectItem value="dismissed">{t('feedback.status.dismissed')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Textarea
                            defaultValue={fb.follow_up_notes || ""}
                            placeholder={t('feedback.followUpPlaceholder')}
                            className="text-sm min-h-[60px]"
                            onBlur={(e) => {
                              const val = e.target.value.trim();
                              if (val !== (fb.follow_up_notes || "")) {
                                updateMutation.mutate({ id: fb.id, data: { follow_up_notes: val } });
                              }
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
/**
 * DataHealingPanel — Admin tool for fixing segment order and time data (2026-04-15)
 * 
 * Provides dry-run preview and execute modes for the healSegmentData backend function.
 * Mounted in DevTools as a tab.
 */
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/components/utils/i18n.jsx";
import { Wrench, Play, Eye, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export default function DataHealingPanel() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState(null); // 'dry_run' | 'execute'

  const runHeal = async (dryRun) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setMode(dryRun ? 'dry_run' : 'execute');

    try {
      const response = await base44.functions.invoke('healSegmentData', { dry_run: dryRun });
      setResult(response.data);
    } catch (err) {
      setError(err.message || 'Failed to run data healing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Wrench className="w-5 h-5" />
          {t('heal.title')}
        </h2>
        <p className="text-sm text-gray-500 mt-1">{t('heal.description')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('heal.segmentOrderTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-gray-600 space-y-1">
            <p>• {t('heal.step1')}</p>
            <p>• {t('heal.step2')}</p>
            <p>• {t('heal.step3')}</p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => runHeal(true)}
              disabled={loading}
              className="gap-2"
            >
              {loading && mode === 'dry_run' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
              {t('heal.dryRun')}
            </Button>

            <Button
              onClick={() => runHeal(false)}
              disabled={loading}
              className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {loading && mode === 'execute' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {t('heal.execute')}
            </Button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {result.dry_run ? (
                  <Badge variant="outline" className="text-blue-700 bg-blue-50">
                    {t('heal.dryRunLabel')}
                  </Badge>
                ) : (
                  <Badge className="bg-green-100 text-green-800">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    {t('heal.executedLabel')}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-gray-50 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-gray-900">{result.summary.total_sessions_scanned}</div>
                  <div className="text-xs text-gray-500">{t('heal.sessionsScanned')}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-amber-600">{result.summary.sessions_fixed}</div>
                  <div className="text-xs text-gray-500">{t('heal.sessionsFixed')}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-amber-600">{result.summary.segment_orders_fixed}</div>
                  <div className="text-xs text-gray-500">{t('heal.ordersFixed')}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-600">{result.summary.segment_times_fixed}</div>
                  <div className="text-xs text-gray-500">{t('heal.timesFixed')}</div>
                </div>
              </div>

              {result.details?.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-gray-700">{t('heal.colSession')}</th>
                        <th className="text-center px-3 py-2 font-medium text-gray-700">{t('heal.colSegments')}</th>
                        <th className="text-center px-3 py-2 font-medium text-gray-700">{t('heal.colOrders')}</th>
                        <th className="text-center px-3 py-2 font-medium text-gray-700">{t('heal.colTimes')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {result.details.map((d, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-gray-900">{d.session_name || d.session_id}</td>
                          <td className="px-3 py-2 text-center text-gray-600">{d.parent_count}</td>
                          <td className="px-3 py-2 text-center">
                            <Badge variant={d.orders_fixed > 0 ? "default" : "outline"} className={d.orders_fixed > 0 ? "bg-amber-100 text-amber-800" : ""}>
                              {d.orders_fixed}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Badge variant={d.times_fixed > 0 ? "default" : "outline"} className={d.times_fixed > 0 ? "bg-blue-100 text-blue-800" : ""}>
                              {d.times_fixed}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {result.details?.length === 0 && (
                <div className="text-sm text-green-700 bg-green-50 p-3 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {t('heal.noIssuesFound')}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
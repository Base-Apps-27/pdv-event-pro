import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { CheckCircle2, XCircle, Play, ChevronDown, ChevronRight } from 'lucide-react';
import { runAll, runSuite } from './TestRunner';
import { ALL_SUITES } from './tests';

export default function TestResultsUI() {
  const [results, setResults] = useState(null);
  const [expandedSuites, setExpandedSuites] = useState(new Set());

  const handleRunAll = useCallback(() => {
    const suiteResults = runAll(ALL_SUITES.map(s => s.run));
    setResults(suiteResults);
    // Auto-expand failed suites
    const failed = new Set();
    suiteResults.forEach((suite, i) => {
      if (suite.failed > 0) failed.add(i);
    });
    setExpandedSuites(failed);
  }, []);

  const handleRunSingle = useCallback((suiteFn, index) => {
    const singleResult = runSuite(suiteFn);
    setResults(prev => {
      if (!prev) {
        // Fill with placeholders and set this one
        const full = ALL_SUITES.map(() => null);
        singleResult.forEach((s, i) => { full[index] = s; });
        // Actually runSuite returns array of suites from that fn — could be multiple describes
        // Replace at index with merged result
        return full.map((s, i) => i === index ? mergeDescribes(singleResult) : s);
      }
      const next = [...prev];
      next[index] = mergeDescribes(singleResult);
      return next;
    });
    if (singleResult.some(s => s.failed > 0)) {
      setExpandedSuites(prev => new Set([...prev, index]));
    }
  }, []);

  const toggleSuite = (index) => {
    setExpandedSuites(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  // Aggregate stats
  const totalPassed = results ? results.reduce((sum, s) => sum + (s?.passed || 0), 0) : 0;
  const totalFailed = results ? results.reduce((sum, s) => sum + (s?.failed || 0), 0) : 0;
  const totalTests = totalPassed + totalFailed;
  const allPass = results && totalFailed === 0;

  return (
    <div className="space-y-4">
      {/* Summary + Run Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {results && (
            <>
              <Badge variant={allPass ? 'default' : 'destructive'} className={allPass ? 'bg-green-600' : ''}>
                {totalPassed} passed
              </Badge>
              {totalFailed > 0 && (
                <Badge variant="destructive">{totalFailed} failed</Badge>
              )}
              <span className="text-sm text-gray-500">{totalTests} total</span>
            </>
          )}
          {!results && <span className="text-sm text-gray-500">Click "Run All" to execute unit tests</span>}
        </div>
        <Button onClick={handleRunAll} size="sm">
          <Play className="w-4 h-4 mr-1" />
          Run All
        </Button>
      </div>

      {/* Suite Cards */}
      {results && results.map((suite, idx) => {
        if (!suite) return null;
        const isExpanded = expandedSuites.has(idx);
        const suiteName = ALL_SUITES[idx]?.name || suite.name;
        const hasFails = suite.failed > 0;

        return (
          <Collapsible key={idx} open={isExpanded} onOpenChange={() => toggleSuite(idx)}>
            <Card className={hasFails ? 'border-red-300' : 'border-green-300'}>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <CardTitle className="text-sm font-mono">{suiteName}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={hasFails ? 'destructive' : 'default'} className={!hasFails ? 'bg-green-600' : ''}>
                        {suite.passed}/{suite.passed + suite.failed}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={(e) => { e.stopPropagation(); handleRunSingle(ALL_SUITES[idx].run, idx); }}
                      >
                        <Play className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 pb-3 px-4">
                  <div className="space-y-1">
                    {suite.tests.map((test, tIdx) => (
                      <div key={tIdx} className="flex items-start gap-2 text-sm">
                        {test.status === 'pass' ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                        )}
                        <div>
                          <span className={test.status === 'fail' ? 'text-red-700 font-medium' : 'text-gray-700'}>
                            {test.name}
                          </span>
                          {test.error && (
                            <pre className="mt-1 p-2 bg-red-50 text-red-800 text-xs font-mono rounded overflow-x-auto whitespace-pre-wrap">
                              {test.error.message}
                            </pre>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
}

/** Merge multiple describe blocks from a single suite file into one summary */
function mergeDescribes(suiteResults) {
  if (!suiteResults || suiteResults.length === 0) return { name: '?', tests: [], passed: 0, failed: 0 };
  const merged = {
    name: suiteResults.map(s => s.name).join(' + '),
    tests: suiteResults.flatMap(s => s.tests),
    passed: suiteResults.reduce((sum, s) => sum + s.passed, 0),
    failed: suiteResults.reduce((sum, s) => sum + s.failed, 0),
  };
  return merged;
}

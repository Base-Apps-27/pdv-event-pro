/**
 * Test Functions Page
 * 
 * PURPOSE: UI for testing backend functions without console access
 * Provides one-click testing with result display
 * 
 * DELETE: Remove this page once testing is complete
 */

import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function TestFunctions() {
  const [testResults, setTestResults] = useState({});
  const [loading, setLoading] = useState({});

  /**
   * Test react-pdf generation
   * EXPECTED: Downloads a PDF file with test content
   * FAILURE: Returns JSON error object
   */
  const testReactPDF = async () => {
    setLoading(prev => ({ ...prev, reactPDF: true }));
    setTestResults(prev => ({ ...prev, reactPDF: null }));
    
    try {
      const response = await base44.functions.invoke('testReactPDF');
      
      // Check if response is PDF (binary) or error (JSON)
      const contentType = response.headers?.['content-type'] || '';
      
      if (contentType.includes('application/pdf')) {
        // Success - trigger download
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'react-pdf-test.pdf';
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        a.remove();
        
        setTestResults(prev => ({ 
          ...prev, 
          reactPDF: { success: true, message: 'PDF downloaded successfully' }
        }));
      } else {
        // Error returned as JSON
        setTestResults(prev => ({ 
          ...prev, 
          reactPDF: { success: false, message: JSON.stringify(response.data, null, 2) }
        }));
      }
    } catch (error) {
      setTestResults(prev => ({ 
        ...prev, 
        reactPDF: { success: false, message: error.message }
      }));
    } finally {
      setLoading(prev => ({ ...prev, reactPDF: false }));
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-5xl font-bold text-gray-900 uppercase tracking-tight font-['Bebas_Neue']">
          Test Functions
        </h1>
        <p className="text-gray-500 mt-2">Backend function testing interface</p>
        <Badge variant="outline" className="mt-2 bg-yellow-50 border-yellow-300 text-yellow-800">
          ⚠️ Delete this page after testing is complete
        </Badge>
      </div>

      {/* React-PDF Test */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-pdv-teal" />
            React-PDF Generation Test
          </CardTitle>
          <CardDescription>
            Tests if @react-pdf/renderer works in Base44 Deno environment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="text-sm space-y-1">
              <p className="font-semibold text-gray-700">Expected Outcome:</p>
              <p className="text-gray-600">• Downloads "react-pdf-test.pdf"</p>
              <p className="text-gray-600">• PDF contains test content with branding</p>
              <p className="text-gray-600">• No errors in result display below</p>
            </div>
          </div>

          <Button
            onClick={testReactPDF}
            disabled={loading.reactPDF}
            className="w-full bg-pdv-teal hover:bg-pdv-teal/90 text-white"
          >
            {loading.reactPDF ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Run Test
              </>
            )}
          </Button>

          {/* Result Display */}
          {testResults.reactPDF && (
            <div className={`p-4 rounded-lg border ${
              testResults.reactPDF.success 
                ? 'bg-green-50 border-green-300' 
                : 'bg-red-50 border-red-300'
            }`}>
              <div className="flex items-start gap-2">
                {testResults.reactPDF.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className={`font-semibold text-sm ${
                    testResults.reactPDF.success ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {testResults.reactPDF.success ? 'Success' : 'Failed'}
                  </p>
                  <pre className={`text-xs mt-1 whitespace-pre-wrap ${
                    testResults.reactPDF.success ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {testResults.reactPDF.message}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Next Steps */}
          {testResults.reactPDF?.success && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm font-semibold text-blue-900 mb-2">✅ Next Steps:</p>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Verify PDF looks correct on iOS/Android/Desktop</li>
                <li>Build production ServiceProgramPDF component</li>
                <li>Replace html2canvas approach in CustomServiceBuilder</li>
                <li>Delete functions/testReactPDF.js</li>
                <li>Delete this test page</li>
              </ol>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
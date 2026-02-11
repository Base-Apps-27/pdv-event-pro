import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * ErrorBoundary — Phase 1 Stability (2026-02-11)
 * 
 * Catches uncaught render errors in any child component tree.
 * Prevents white-screen crashes by showing a branded fallback UI.
 * 
 * Usage: Wraps all page content in Layout.js.
 * 
 * IMPORTANT: This does NOT catch errors in:
 * - Event handlers (use try/catch or toast for those)
 * - Async code (Promises, setTimeout)
 * - Server-side rendering (N/A for Base44)
 * 
 * Decision Log: "Add ErrorBoundary to prevent white-screen crashes" (2026-02-11)
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Log to console for debugging — breadcrumb for ops
    console.error("[ErrorBoundary] Uncaught render error:", {
      error: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F0F1F3] p-6">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-gray-200 p-8 text-center space-y-6">
            {/* Brand gradient accent */}
            <div
              className="h-1.5 w-full rounded-full -mt-4 mb-4"
              style={{
                background:
                  "linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)",
              }}
            />

            <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>

            <div>
              <h2
                className="text-2xl text-gray-900 uppercase tracking-wide"
                style={{ fontFamily: "'Anton', sans-serif" }}
              >
                Algo salió mal
              </h2>
              <p className="text-gray-600 text-sm mt-2">
                Something went wrong. Please try refreshing the page.
              </p>
            </div>

            {/* Error detail (collapsed by default, visible for debugging) */}
            {this.state.error && (
              <details className="text-left bg-gray-50 rounded-lg p-3 text-xs text-gray-500 border border-gray-200">
                <summary className="cursor-pointer font-semibold text-gray-700">
                  Detalles técnicos / Technical details
                </summary>
                <pre className="mt-2 overflow-auto max-h-40 whitespace-pre-wrap break-words">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-3 justify-center">
              <Button
                onClick={this.handleReload}
                style={{
                  background:
                    "linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)",
                  color: "#ffffff",
                }}
                className="font-semibold"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Recargar / Reload
              </Button>
              <Button variant="outline" onClick={this.handleGoHome}>
                Inicio / Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
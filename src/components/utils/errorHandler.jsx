/**
 * Centralized Error Handler — Phase 2 Foundation Code Quality (2026-02-11)
 * 
 * Provides consistent error reporting patterns across the app:
 * - User-facing: toast notifications (sonner) 
 * - Developer-facing: structured console logs with context
 * - Non-blocking: never throws, never interrupts UI flow
 * 
 * Replaces scattered try/catch + console.error + toast patterns.
 * 
 * IMPORTANT: This does NOT replace ErrorBoundary (Phase 1).
 * ErrorBoundary catches render errors. This handles operational errors
 * (API calls, mutations, integrations, PDF generation, etc.)
 * 
 * Decision: "Create centralized error handler" — Phase 2 utility.
 * 
 * USAGE:
 *   import { handleError, handleMutationError, handlePDFError } from '@/components/utils/errorHandler';
 *   
 *   // Generic operational error
 *   handleError(error, { context: 'loading events', userMessage: 'Error al cargar eventos' });
 *   
 *   // Mutation error (for onError callbacks)
 *   saveServiceMutation = useMutation({ ..., onError: handleMutationError('guardar servicio') });
 *   
 *   // PDF generation error
 *   try { await generatePDF(...) } catch (e) { handlePDFError(e, 'programa') }
 */

import { toast } from "sonner";

/**
 * Core error handler — logs structured error + shows user-facing toast.
 * 
 * @param {Error|string} error - The error object or message
 * @param {Object} options
 * @param {string} options.context - Developer context (e.g., 'loading events', 'saving segment')
 * @param {string} options.userMessage - User-facing message (bilingual preferred)
 * @param {'error'|'warning'|'info'} options.severity - Toast severity (default: 'error')
 * @param {boolean} options.silent - If true, skip toast (log only)
 * @param {Object} options.metadata - Additional context for console log
 */
export function handleError(error, options = {}) {
  const {
    context = 'unknown',
    userMessage,
    severity = 'error',
    silent = false,
    metadata = {},
  } = options;

  const errorMessage = error instanceof Error ? error.message : String(error || 'Unknown error');
  const errorStack = error instanceof Error ? error.stack : undefined;

  // ── Structured console log ──
  console[severity === 'warning' ? 'warn' : 'error'](
    `[ErrorHandler] ${context}`,
    {
      message: errorMessage,
      stack: errorStack,
      context,
      severity,
      timestamp: new Date().toISOString(),
      ...metadata,
    }
  );

  // ── User-facing toast ──
  if (!silent) {
    const displayMessage = userMessage || `Error: ${errorMessage}`;
    if (severity === 'warning') {
      toast.warning(displayMessage);
    } else if (severity === 'info') {
      toast.info(displayMessage);
    } else {
      toast.error(displayMessage);
    }
  }
}

/**
 * Returns an onError callback for useMutation hooks.
 * Provides consistent error handling for all mutations.
 * 
 * @param {string} operationName - Human-readable operation name (Spanish preferred)
 * @param {Object} extraOptions - Additional handleError options
 * @returns {function} Error handler function for mutation onError
 * 
 * USAGE:
 *   const mutation = useMutation({
 *     mutationFn: ...,
 *     onError: handleMutationError('guardar servicio'),
 *   });
 */
export function handleMutationError(operationName, extraOptions = {}) {
  return (error) => {
    handleError(error, {
      context: `mutation: ${operationName}`,
      userMessage: `Error al ${operationName}: ${error?.message || 'Error desconocido'}`,
      ...extraOptions,
    });
  };
}

/**
 * Handles PDF generation errors with PDF-specific context.
 * 
 * @param {Error} error - The error
 * @param {string} pdfType - Type of PDF (e.g., 'programa', 'anuncios', 'reporte')
 * @param {string} [toastId] - Optional toast ID to update a loading toast
 */
export function handlePDFError(error, pdfType, toastId) {
  const userMsg = `Error generando PDF de ${pdfType}: ${error?.message || 'Error desconocido'}`;
  
  if (toastId) {
    toast.error(userMsg, { id: toastId });
  }

  handleError(error, {
    context: `PDF generation: ${pdfType}`,
    userMessage: toastId ? undefined : userMsg, // Avoid double toast
    silent: !!toastId, // If toastId provided, we already showed the toast above
    metadata: { pdfType },
  });
}

/**
 * Handles integration/API call errors.
 * 
 * @param {Error} error - The error
 * @param {string} integrationName - Name of the integration (e.g., 'InvokeLLM', 'SendEmail')
 * @param {string} [userMessage] - Custom user message
 */
export function handleIntegrationError(error, integrationName, userMessage) {
  handleError(error, {
    context: `integration: ${integrationName}`,
    userMessage: userMessage || `Error en ${integrationName}: ${error?.message || 'Error desconocido'}`,
    metadata: { integration: integrationName },
  });
}
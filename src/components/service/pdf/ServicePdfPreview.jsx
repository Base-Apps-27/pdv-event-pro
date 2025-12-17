import React, { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Minus, Plus, Wand2, Printer, Check, AlertTriangle, Download, Mail, Loader2, X } from "lucide-react";
import ServicePdfPage1 from "./ServicePdfPage1";
import ServicePdfPage2 from "./ServicePdfPage2";
import PdfStyles from "./PdfStyles";
import { base44 } from "@/api/base44Client";

// US Letter at 96 DPI: 816 x 1056px, content area with 48px margins
const PAGE_HEIGHT = 1056;
const CONTENT_HEIGHT = 960; // 1056 - 96 (48px top + 48px bottom margins)

export default function ServicePdfPreview({
  open,
  onOpenChange,
  serviceData,
  selectedDate,
  fixedAnnouncements,
  dynamicAnnouncements,
  selectedAnnouncements,
  pdfScales,
  onSaveScales
}) {
  const [activeTab, setActiveTab] = useState("page1");
  const [page1Scale, setPage1Scale] = useState(pdfScales?.page1 || 100);
  const [page2Scale, setPage2Scale] = useState(pdfScales?.page2 || 100);
  const [page1Fits, setPage1Fits] = useState(true);
  const [page2Fits, setPage2Fits] = useState(true);
  const [autoFitting, setAutoFitting] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  
  const page1Ref = useRef(null);
  const page2Ref = useRef(null);
  
  // Check if both pages fit (required for output actions)
  const canOutput = page1Fits && page2Fits;

  // Check if content fits within page bounds
  const checkPageFit = useCallback((pageRef, scale) => {
    if (!pageRef.current) return true;
    const scaledHeight = pageRef.current.scrollHeight;
    const maxHeight = PAGE_HEIGHT * (scale / 100);
    return scaledHeight <= maxHeight;
  }, []);

  // Update fit status when scales change
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage1Fits(checkPageFit(page1Ref, page1Scale));
      setPage2Fits(checkPageFit(page2Ref, page2Scale));
    }, 100);
    return () => clearTimeout(timer);
  }, [page1Scale, page2Scale, checkPageFit, serviceData, selectedAnnouncements]);

  // Auto-fit algorithm: binary search for max scale that fits
  const autoFitPage = useCallback(async (pageNum) => {
    setAutoFitting(true);
    const pageRef = pageNum === 1 ? page1Ref : page2Ref;
    const setScale = pageNum === 1 ? setPage1Scale : setPage2Scale;
    
    let low = 85;
    let high = 110;
    let bestScale = 100;
    
    // Binary search for optimal scale
    for (let i = 0; i < 10; i++) {
      const mid = Math.round((low + high) / 2);
      setScale(mid);
      
      // Wait for render
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const fits = checkPageFit(pageRef, mid);
      
      if (fits) {
        bestScale = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    
    setScale(bestScale);
    setAutoFitting(false);
  }, [checkPageFit]);

  const handlePrint = () => {
    if (!canOutput) {
      alert('El contenido excede los límites de página. Ajuste la escala o reduzca el contenido.\n\nContent exceeds page limits. Adjust scale or reduce content.');
      return;
    }
    // Save scales and set CSS variables for print
    onSaveScales({ page1: page1Scale, page2: page2Scale });
    document.documentElement.style.setProperty('--pdf-page1-scale', page1Scale / 100);
    document.documentElement.style.setProperty('--pdf-page2-scale', page2Scale / 100);
    onOpenChange(false);
    setTimeout(() => window.print(), 150);
  };
  
  const handleDownloadPDF = () => {
    if (!canOutput) {
      alert('El contenido excede los límites de página. Ajuste la escala o reduzca el contenido.\n\nContent exceeds page limits. Adjust scale or reduce content.');
      return;
    }
    // Save scales and set CSS variables, then open print dialog (user selects "Save as PDF")
    onSaveScales({ page1: page1Scale, page2: page2Scale });
    document.documentElement.style.setProperty('--pdf-page1-scale', page1Scale / 100);
    document.documentElement.style.setProperty('--pdf-page2-scale', page2Scale / 100);
    onOpenChange(false);
    // Show helpful message about saving as PDF
    setTimeout(() => {
      alert('En el diálogo de impresión, seleccione "Guardar como PDF" como destino.\n\nIn the print dialog, select "Save as PDF" as the destination.');
      window.print();
    }, 150);
  };
  
  const handleSendEmail = async () => {
    if (!canOutput) {
      alert('El contenido excede los límites de página. Ajuste la escala o reduzca el contenido.\n\nContent exceeds page limits. Adjust scale or reduce content.');
      return;
    }
    
    if (!emailAddress || !emailAddress.includes('@')) {
      alert('Por favor ingrese un email válido / Please enter a valid email');
      return;
    }
    
    setSendingEmail(true);
    
    try {
      // Send email notification (actual PDF would need to be generated server-side)
      await base44.integrations.Core.SendEmail({
        to: emailAddress,
        subject: `Orden de Servicio - Domingo ${selectedDate}`,
        body: `
          <h2>Orden de Servicio / Service Order</h2>
          <p>Fecha / Date: ${selectedDate}</p>
          <p>Este documento fue generado desde el sistema de gestión de servicios de Palabras de Vida.</p>
          <p>This document was generated from the Palabras de Vida service management system.</p>
          <hr/>
          <p><em>Para ver el documento completo, por favor imprima desde la vista previa del sistema.</em></p>
          <p><em>To view the full document, please print from the system preview.</em></p>
        `
      });
      
      setEmailSent(true);
      setTimeout(() => {
        setEmailSent(false);
        setShowEmailForm(false);
        setEmailAddress("");
      }, 2000);
      
    } catch (error) {
      console.error('Email error:', error);
      alert('Error al enviar email / Error sending email: ' + error.message);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSaveAndClose = () => {
    onSaveScales({ page1: page1Scale, page2: page2Scale });
    onOpenChange(false);
  };

  const adjustScale = (pageNum, delta) => {
    if (pageNum === 1) {
      setPage1Scale(prev => Math.min(110, Math.max(85, prev + delta)));
    } else {
      setPage2Scale(prev => Math.min(110, Math.max(85, prev + delta)));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden bg-white p-0">
        <PdfStyles />
        
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <DialogTitle className="text-xl font-bold">
              Vista Previa del PDF / PDF Preview
            </DialogTitle>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                <X className="w-4 h-4 mr-2" />
                Cerrar / Close
              </Button>
              <Button 
                onClick={handleSaveAndClose} 
                variant="outline"
                className="border-pdv-teal text-pdv-teal hover:bg-pdv-teal hover:text-white"
              >
                <Check className="w-4 h-4 mr-2" />
                Guardar Escala / Save Scale
              </Button>
              <Button 
                onClick={() => setShowEmailForm(!showEmailForm)}
                variant="outline"
                disabled={!canOutput}
                className={!canOutput ? 'opacity-50 cursor-not-allowed' : ''}
              >
                <Mail className="w-4 h-4 mr-2" />
                Email
              </Button>
              <Button 
                onClick={handleDownloadPDF}
                variant="outline"
                disabled={!canOutput}
                className={!canOutput ? 'opacity-50 cursor-not-allowed' : ''}
              >
                <Download className="w-4 h-4 mr-2" />
                Descargar / Download
              </Button>
              <Button 
                onClick={handlePrint} 
                className={`bg-gray-900 text-white ${!canOutput ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={!canOutput}
              >
                <Printer className="w-4 h-4 mr-2" />
                Imprimir / Print
              </Button>
            </div>
          </div>
          
          {/* Overall fit status */}
          {!canOutput && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-800">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <div>
                <strong>El contenido excede los límites de página.</strong> Ajuste la escala o reduzca el contenido antes de imprimir o enviar.
                <br/>
                <span className="text-red-600">Content exceeds page limits. Adjust scale or reduce content before printing or sending.</span>
              </div>
            </div>
          )}
          
          {/* Email form */}
          {showEmailForm && (
            <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Label className="text-sm font-semibold text-blue-900">
                    Enviar a / Send to:
                  </Label>
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    className="mt-1"
                    disabled={sendingEmail}
                  />
                </div>
                <Button
                  onClick={handleSendEmail}
                  disabled={sendingEmail || !emailAddress || emailSent}
                  className={emailSent ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}
                >
                  {sendingEmail ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : emailSent ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      ¡Enviado! / Sent!
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Enviar / Send
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowEmailForm(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogHeader>

        <div className="flex h-[calc(95vh-140px)]">
          {/* Controls Panel */}
          <div className="w-72 border-r bg-gray-50 p-4 space-y-6 overflow-y-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="page1" className="text-xs">
                  Página 1 / Page 1
                </TabsTrigger>
                <TabsTrigger value="page2" className="text-xs">
                  Página 2 / Page 2
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Page 1 Controls */}
            {activeTab === "page1" && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">Escala / Scale</span>
                    <Badge 
                      className={page1Fits 
                        ? "bg-green-100 text-green-800" 
                        : "bg-red-100 text-red-800"
                      }
                    >
                      {page1Fits ? (
                        <><Check className="w-3 h-3 mr-1" />Ajusta / Fits</>
                      ) : (
                        <><AlertTriangle className="w-3 h-3 mr-1" />Desborda / Overflow</>
                      )}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => adjustScale(1, -5)}
                      disabled={page1Scale <= 85}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    
                    <div className="flex-1">
                      <Slider
                        value={[page1Scale]}
                        onValueChange={([v]) => setPage1Scale(v)}
                        min={85}
                        max={110}
                        step={1}
                        className="w-full"
                      />
                    </div>
                    
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => adjustScale(1, 5)}
                      disabled={page1Scale >= 110}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="text-center text-sm text-gray-600 mt-1">
                    {page1Scale}%
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => autoFitPage(1)}
                  disabled={autoFitting}
                >
                  <Wand2 className="w-4 h-4 mr-2" />
                  {autoFitting ? "Ajustando..." : "Auto-Ajustar / Auto-Fit"}
                </Button>

                <div className="text-xs text-gray-500 p-3 bg-gray-100 rounded">
                  <strong>Orden de Servicio</strong><br/>
                  Horarios de 9:30 A.M. y 11:30 A.M. en dos columnas.
                  <br/><br/>
                  <strong>Service Order</strong><br/>
                  9:30 A.M. and 11:30 A.M. schedules in two columns.
                </div>
              </div>
            )}

            {/* Page 2 Controls */}
            {activeTab === "page2" && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">Escala / Scale</span>
                    <Badge 
                      className={page2Fits 
                        ? "bg-green-100 text-green-800" 
                        : "bg-red-100 text-red-800"
                      }
                    >
                      {page2Fits ? (
                        <><Check className="w-3 h-3 mr-1" />Ajusta / Fits</>
                      ) : (
                        <><AlertTriangle className="w-3 h-3 mr-1" />Desborda / Overflow</>
                      )}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => adjustScale(2, -5)}
                      disabled={page2Scale <= 85}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    
                    <div className="flex-1">
                      <Slider
                        value={[page2Scale]}
                        onValueChange={([v]) => setPage2Scale(v)}
                        min={85}
                        max={110}
                        step={1}
                        className="w-full"
                      />
                    </div>
                    
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => adjustScale(2, 5)}
                      disabled={page2Scale >= 110}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="text-center text-sm text-gray-600 mt-1">
                    {page2Scale}%
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => autoFitPage(2)}
                  disabled={autoFitting}
                >
                  <Wand2 className="w-4 h-4 mr-2" />
                  {autoFitting ? "Ajustando..." : "Auto-Ajustar / Auto-Fit"}
                </Button>

                <div className="text-xs text-gray-500 p-3 bg-gray-100 rounded">
                  <strong>Anuncios</strong><br/>
                  {selectedAnnouncements.length} anuncios seleccionados en dos columnas.
                  <br/><br/>
                  <strong>Announcements</strong><br/>
                  {selectedAnnouncements.length} selected announcements in two columns.
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="border-t pt-4">
              <div className="text-xs font-semibold mb-2">Leyenda / Legend</div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border border-dashed border-blue-500 opacity-50" />
                  <span>Área segura / Safe area</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-0.5 bg-red-500" />
                  <span>Límite de página / Page limit</span>
                </div>
              </div>
            </div>
          </div>

          {/* Preview Area */}
          <div className="flex-1 bg-gray-200 overflow-auto p-6">
            <div className="flex justify-center">
              {activeTab === "page1" ? (
                <div className="pdf-preview-page-wrapper relative">
                  <div className="pdf-preview-safe-area" />
                  <div ref={page1Ref}>
                    <ServicePdfPage1
                      serviceData={serviceData}
                      selectedDate={selectedDate}
                      scale={page1Scale}
                    />
                  </div>
                  {!page1Fits && <div className="pdf-preview-overflow-indicator" />}
                </div>
              ) : (
                <div className="pdf-preview-page-wrapper relative">
                  <div className="pdf-preview-safe-area" />
                  <div ref={page2Ref}>
                    <ServicePdfPage2
                      selectedDate={selectedDate}
                      fixedAnnouncements={fixedAnnouncements}
                      dynamicAnnouncements={dynamicAnnouncements}
                      selectedAnnouncements={selectedAnnouncements}
                      scale={page2Scale}
                    />
                  </div>
                  {!page2Fits && <div className="pdf-preview-overflow-indicator" />}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
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
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

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

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const handlePrint = () => {
    if (!canOutput) {
      alert('El contenido excede los límites de página. Ajuste la escala o reduzca el contenido.\n\nContent exceeds page limits. Adjust scale or reduce content.');
      return;
    }
    // Save scales and set CSS variables for print
    onSaveScales({ page1: page1Scale, page2: page2Scale });
    onOpenChange(false);
    setTimeout(() => window.print(), 200);
  };
  
  const handleDownloadPDF = async () => {
    if (!canOutput) {
      alert('El contenido excede los límites de página. Ajuste la escala o reduzca el contenido.\n\nContent exceeds page limits. Adjust scale or reduce content.');
      return;
    }
    
    setIsGeneratingPDF(true);
    
    try {
      // Save scales
      onSaveScales({ page1: page1Scale, page2: page2Scale });
      
      // Store original scale styles and temporarily remove them for clean capture
      const page1Element = page1Ref.current;
      const page2Element = page2Ref.current;
      
      const originalPage1Style = page1Element?.style.transform;
      const originalPage2Style = page2Element?.style.transform;
      
      // Remove scale transforms temporarily
      if (page1Element) page1Element.style.transform = `scale(${page1Scale / 100})`;
      if (page2Element) page2Element.style.transform = `scale(${page2Scale / 100})`;
      
      // Wait for style application
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Create PDF using jsPDF - US Letter size in points (612 x 792)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'letter'
      });
      
      // Capture Page 1
      if (page1Element) {
        // Calculate actual dimensions after scale
        const scaledWidth = 816 * (page1Scale / 100);
        const scaledHeight = 1056 * (page1Scale / 100);
        
        const canvas1 = await html2canvas(page1Element, {
          scale: 2, // Higher quality
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          width: scaledWidth,
          height: scaledHeight,
          windowWidth: scaledWidth,
          windowHeight: scaledHeight
        });
        
        const imgData1 = canvas1.toDataURL('image/png');
        // Add image to fit US Letter (612 x 792 points)
        pdf.addImage(imgData1, 'PNG', 0, 0, 612, 792);
      }
      
      // Add second page
      pdf.addPage();
      
      // Temporarily switch to page 2 to capture it
      const currentTab = activeTab;
      setActiveTab('page2');
      
      // Wait for render
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Capture Page 2
      if (page2Element) {
        const scaledWidth = 816 * (page2Scale / 100);
        const scaledHeight = 1056 * (page2Scale / 100);
        
        const canvas2 = await html2canvas(page2Element, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          width: scaledWidth,
          height: scaledHeight,
          windowWidth: scaledWidth,
          windowHeight: scaledHeight
        });
        
        const imgData2 = canvas2.toDataURL('image/png');
        pdf.addImage(imgData2, 'PNG', 0, 0, 612, 792);
      }
      
      // Restore original tab
      setActiveTab(currentTab);
      
      // Restore original scale styles
      if (page1Element && originalPage1Style !== undefined) {
        page1Element.style.transform = originalPage1Style;
      }
      if (page2Element && originalPage2Style !== undefined) {
        page2Element.style.transform = originalPage2Style;
      }
      
      // Download the PDF
      const fileName = `Orden-de-Servicio-${selectedDate}.pdf`;
      pdf.save(fileName);
      
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Error al generar PDF / Error generating PDF: ' + error.message);
    } finally {
      setIsGeneratingPDF(false);
    }
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
      <DialogContent className="max-w-6xl sm:max-w-full sm:h-full sm:max-h-full md:max-w-6xl md:max-h-[95vh] overflow-hidden bg-white p-0 print:hidden">
        <PdfStyles />
        
        <DialogHeader className="px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6 pb-3 sm:pb-4 border-b">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <DialogTitle className="text-base sm:text-lg md:text-xl font-bold">
              Vista Previa / Preview
            </DialogTitle>
            <div className="flex gap-1 sm:gap-2 flex-wrap">
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="h-9 sm:h-10 px-2 sm:px-4"
              >
                <X className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Cerrar</span>
              </Button>
              <Button 
                onClick={handleSaveAndClose} 
                variant="outline"
                className="border-pdv-teal text-pdv-teal hover:bg-pdv-teal hover:text-white h-9 sm:h-10 px-2 sm:px-4"
              >
                <Check className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Guardar</span>
              </Button>
              <Button 
                onClick={() => setShowEmailForm(!showEmailForm)}
                variant="outline"
                disabled={!canOutput}
                className={`h-9 sm:h-10 px-2 sm:px-4 hidden md:flex ${!canOutput ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Mail className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Email</span>
              </Button>
              <Button 
                onClick={handleDownloadPDF}
                variant="outline"
                disabled={!canOutput || isGeneratingPDF}
                className={`h-9 sm:h-10 px-2 sm:px-4 ${!canOutput ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isGeneratingPDF ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Download className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Descargar</span>
                  </>
                )}
              </Button>
              <Button 
                onClick={handlePrint} 
                className={`bg-gray-900 text-white h-9 sm:h-10 px-2 sm:px-4 ${!canOutput ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={!canOutput}
              >
                <Printer className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Imprimir</span>
              </Button>
            </div>
          </div>
          
          {/* Overall fit status */}
          {!canOutput && (
            <div className="mt-2 p-2 sm:p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs sm:text-sm text-red-800">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Excede límites.</strong> Ajuste escala.
                <br className="sm:hidden" />
                <span className="hidden sm:inline">Ajuste la escala o reduzca el contenido antes de imprimir o enviar.</span>
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

        <div className="flex flex-col md:flex-row h-[calc(100vh-120px)] sm:h-[calc(100vh-140px)] md:h-[calc(95vh-140px)]">
          {/* Controls Panel */}
          <div className="w-full md:w-72 border-b md:border-b-0 md:border-r bg-gray-50 p-3 sm:p-4 space-y-3 sm:space-y-6 overflow-y-auto max-h-48 md:max-h-none">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="page1" className="text-xs sm:text-sm">
                  Página 1
                </TabsTrigger>
                <TabsTrigger value="page2" className="text-xs sm:text-sm">
                  Página 2
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Page 1 Controls */}
            {activeTab === "page1" && (
              <div className="space-y-2 sm:space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs sm:text-sm font-semibold">Escala</span>
                    <Badge 
                      className={page1Fits 
                        ? "bg-green-100 text-green-800 text-xs" 
                        : "bg-red-100 text-red-800 text-xs"
                      }
                    >
                      {page1Fits ? (
                        <><Check className="w-3 h-3 mr-1" />Ajusta</>
                      ) : (
                        <><AlertTriangle className="w-3 h-3 mr-1" />Excede</>
                      )}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 sm:h-8 sm:w-8 flex-shrink-0"
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
                      className="h-9 w-9 sm:h-8 sm:w-8 flex-shrink-0"
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
                  className="w-full h-9"
                  onClick={() => autoFitPage(1)}
                  disabled={autoFitting}
                >
                  <Wand2 className="w-4 h-4 mr-2" />
                  <span className="text-xs sm:text-sm">{autoFitting ? "Ajustando..." : "Auto-Ajustar"}</span>
                </Button>

                <div className="text-xs text-gray-500 p-2 sm:p-3 bg-gray-100 rounded hidden sm:block">
                  <strong>Orden de Servicio</strong><br/>
                  Horarios 9:30 y 11:30 en dos columnas.
                </div>
              </div>
            )}

            {/* Page 2 Controls */}
            {activeTab === "page2" && (
              <div className="space-y-2 sm:space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs sm:text-sm font-semibold">Escala</span>
                    <Badge 
                      className={page2Fits 
                        ? "bg-green-100 text-green-800 text-xs" 
                        : "bg-red-100 text-red-800 text-xs"
                      }
                    >
                      {page2Fits ? (
                        <><Check className="w-3 h-3 mr-1" />Ajusta</>
                      ) : (
                        <><AlertTriangle className="w-3 h-3 mr-1" />Excede</>
                      )}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 sm:h-8 sm:w-8 flex-shrink-0"
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
                      className="h-9 w-9 sm:h-8 sm:w-8 flex-shrink-0"
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
                  className="w-full h-9"
                  onClick={() => autoFitPage(2)}
                  disabled={autoFitting}
                >
                  <Wand2 className="w-4 h-4 mr-2" />
                  <span className="text-xs sm:text-sm">{autoFitting ? "Ajustando..." : "Auto-Ajustar"}</span>
                </Button>

                <div className="text-xs text-gray-500 p-2 sm:p-3 bg-gray-100 rounded hidden sm:block">
                  <strong>Anuncios</strong><br/>
                  {selectedAnnouncements.length} anuncios en dos columnas.
                </div>
              </div>
            )}

            {/* Legend - hide on mobile */}
            <div className="border-t pt-4 hidden md:block">
              <div className="text-xs font-semibold mb-2">Leyenda</div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border border-dashed border-blue-500 opacity-50" />
                  <span>Área segura</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-0.5 bg-red-500" />
                  <span>Límite de página</span>
                </div>
              </div>
            </div>
            </div>

            {/* Preview Area */}
            <div className="flex-1 bg-gray-200 overflow-auto p-2 sm:p-4 md:p-6">
            <div className="flex justify-center items-start">
              {activeTab === "page1" ? (
                <div className="pdf-preview-page-wrapper relative w-full md:w-auto" style={{ transform: 'scale(0.75) translateX(-50%)', transformOrigin: 'top left', left: '50%' }}>
                  <div className="pdf-preview-safe-area md:block" />
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
                <div className="pdf-preview-page-wrapper relative w-full md:w-auto" style={{ transform: 'scale(0.75) translateX(-50%)', transformOrigin: 'top left', left: '50%' }}>
                  <div className="pdf-preview-safe-area md:block" />
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
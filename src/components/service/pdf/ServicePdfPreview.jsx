import React, { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Minus, Plus, Wand2, Printer, Check, AlertTriangle, Download, Mail, Loader2, X, ChevronDown, ChevronUp } from "lucide-react";
import ServicePdfPage1 from "./ServicePdfPage1";
import ServicePdfPage2 from "./ServicePdfPage2";
import PdfStyles from "./PdfStyles";
import { base44 } from "@/api/base44Client";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// US Letter at 96 DPI: 816 x 1056px, content area with 48px margins
const PAGE_HEIGHT = 1056;
const CONTENT_HEIGHT = 960; // 1056 - 96 (48px top + 48px bottom margins)
const MOBILE_BREAKPOINT = 768;

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
  const [previewScale, setPreviewScale] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [controlsExpanded, setControlsExpanded] = useState(false);
  
  const page1Ref = useRef(null);
  const page2Ref = useRef(null);
  const previewContainerRef = useRef(null);
  
  // Check if both pages fit (required for output actions)
  const canOutput = page1Fits && page2Fits;

  // Detect mobile and calculate preview scale
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      
      if (!previewContainerRef.current) return;
      
      const container = previewContainerRef.current;
      const availableWidth = container.clientWidth - 16; // padding
      const availableHeight = container.clientHeight - 16;
      
      // Calculate scale to fit 816x1056 page in available space
      const scaleByWidth = availableWidth / 816;
      const scaleByHeight = availableHeight / 1056;
      const optimalScale = Math.min(scaleByWidth, scaleByHeight, 1);
      
      setPreviewScale(Math.max(0.25, optimalScale));
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    
    // Recalculate when dialog opens
    const timer = setTimeout(handleResize, 100);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [open]);

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
      
      // Get the page elements
      const page1Element = page1Ref.current;
      const page2Element = page2Ref.current;
      
      if (!page1Element || !page2Element) {
        throw new Error('Page elements not found');
      }
      
      // Find all elements with gradients and replace with solid color
      const gradientElements = [];
      [page1Element, page2Element].forEach(pageEl => {
        const els = pageEl.querySelectorAll('[style*="gradient"], .brand-gradient, .gradient-pdv, .sidebar-active-gradient, .gradient-pdv-vertical');
        els.forEach(el => {
          gradientElements.push({
            element: el,
            originalBackground: el.style.background,
            originalBackgroundImage: el.style.backgroundImage
          });
          el.style.background = '#1F8A70'; // Solid brand teal
          el.style.backgroundImage = 'none';
        });
      });
      
      // Get preview wrapper parents and store their transforms
      const page1Wrapper = page1Element.closest('.pdf-preview-page-wrapper');
      const page2Wrapper = page2Element.closest('.pdf-preview-page-wrapper');
      
      const originalPage1WrapperTransform = page1Wrapper?.style.transform;
      const originalPage2WrapperTransform = page2Wrapper?.style.transform;
      
      // Temporarily remove preview wrapper transforms for clean capture
      if (page1Wrapper) page1Wrapper.style.transform = 'none';
      if (page2Wrapper) page2Wrapper.style.transform = 'none';
      
      // Wait for style application
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Create PDF using jsPDF - US Letter size in points (612 x 792)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'letter'
      });
      
      // Capture Page 1 at its actual scaled size
      const canvas1 = await html2canvas(page1Element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 816,
        height: 1056,
        windowWidth: 816,
        windowHeight: 1056
      });
      
      const imgData1 = canvas1.toDataURL('image/png');
      pdf.addImage(imgData1, 'PNG', 0, 0, 612, 792);
      
      // Add second page
      pdf.addPage();
      
      // Capture Page 2 at its actual scaled size
      const canvas2 = await html2canvas(page2Element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 816,
        height: 1056,
        windowWidth: 816,
        windowHeight: 1056
      });
      
      const imgData2 = canvas2.toDataURL('image/png');
      pdf.addImage(imgData2, 'PNG', 0, 0, 612, 792);
      
      // Restore gradients
      gradientElements.forEach(({ element, originalBackground, originalBackgroundImage }) => {
        if (originalBackground) element.style.background = originalBackground;
        if (originalBackgroundImage) element.style.backgroundImage = originalBackgroundImage;
      });
      
      // Restore preview wrapper transforms
      if (page1Wrapper && originalPage1WrapperTransform !== undefined) {
        page1Wrapper.style.transform = originalPage1WrapperTransform;
      }
      if (page2Wrapper && originalPage2WrapperTransform !== undefined) {
        page2Wrapper.style.transform = originalPage2WrapperTransform;
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
      <DialogContent className="max-w-6xl h-[95vh] max-h-[95vh] w-[95vw] md:w-full p-0 print:hidden flex flex-col">
        <PdfStyles />
        
        <DialogHeader className="flex-shrink-0 px-3 md:px-6 py-2 md:py-3 border-b bg-white">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <DialogTitle className="text-sm md:text-xl font-bold truncate">
                Vista Previa
              </DialogTitle>
              {!canOutput && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 flex-shrink-0">
                  <AlertTriangle className="w-3 h-3" />
                </Badge>
              )}
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 p-0"
                size="sm"
              >
                <X className="w-4 h-4" />
              </Button>
              <Button 
                onClick={handleSaveAndClose} 
                variant="outline"
                className="border-pdv-teal text-pdv-teal hover:bg-pdv-teal hover:text-white h-8 w-8 p-0"
                size="sm"
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button 
                onClick={handleDownloadPDF}
                variant="outline"
                disabled={!canOutput || isGeneratingPDF}
                className={`h-8 w-8 p-0 ${!canOutput ? 'opacity-50 cursor-not-allowed' : ''}`}
                size="sm"
              >
                {isGeneratingPDF ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </Button>
              <Button 
                onClick={handlePrint} 
                className={`bg-gray-900 text-white h-8 w-8 p-0 hidden md:inline-flex ${!canOutput ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={!canOutput}
                size="sm"
              >
                <Printer className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
            {/* Mobile Controls - Always Visible, Compact */}
            {isMobile && (
              <div className="flex-shrink-0 border-b bg-gray-50 px-3 py-2">
                <div className="flex items-center gap-2 mb-2">
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
                    <TabsList className="grid w-full grid-cols-2 h-8">
                      <TabsTrigger value="page1" className="text-xs">P1</TabsTrigger>
                      <TabsTrigger value="page2" className="text-xs">P2</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Badge className={activeTab === "page1" ? (page1Fits ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800") : (page2Fits ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
                    {activeTab === "page1" ? `${page1Scale}%` : `${page2Scale}%`}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => adjustScale(activeTab === "page1" ? 1 : 2, -5)}
                    disabled={activeTab === "page1" ? page1Scale <= 85 : page2Scale <= 85}
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  <Slider
                    value={activeTab === "page1" ? [page1Scale] : [page2Scale]}
                    onValueChange={([v]) => activeTab === "page1" ? setPage1Scale(v) : setPage2Scale(v)}
                    min={85}
                    max={110}
                    step={1}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => adjustScale(activeTab === "page1" ? 1 : 2, 5)}
                    disabled={activeTab === "page1" ? page1Scale >= 110 : page2Scale >= 110}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => autoFitPage(activeTab === "page1" ? 1 : 2)}
                    disabled={autoFitting}
                  >
                    <Wand2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}

            {/* Desktop Controls Panel */}
            {!isMobile && (
              <div className="w-72 border-r bg-gray-50 p-4 space-y-4 overflow-y-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="page1">Página 1</TabsTrigger>
                <TabsTrigger value="page2">Página 2</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Page 1 Controls */}
            {activeTab === "page1" && (
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">Escala</span>
                    <Badge 
                      className={page1Fits 
                        ? "bg-green-100 text-green-800" 
                        : "bg-red-100 text-red-800"
                      }
                    >
                      {page1Fits ? <><Check className="w-3 h-3 mr-1" />OK</> : <><AlertTriangle className="w-3 h-3 mr-1" />Excede</>}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
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
                      className="h-8 w-8 flex-shrink-0"
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
                  {autoFitting ? "Ajustando..." : "Auto-Ajustar"}
                </Button>
              </div>
              )}

            {/* Page 2 Controls */}
            {activeTab === "page2" && (
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">Escala</span>
                    <Badge 
                      className={page2Fits 
                        ? "bg-green-100 text-green-800" 
                        : "bg-red-100 text-red-800"
                      }
                    >
                      {page2Fits ? <><Check className="w-3 h-3 mr-1" />OK</> : <><AlertTriangle className="w-3 h-3 mr-1" />Excede</>}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
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
                      className="h-8 w-8 flex-shrink-0"
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
                  {autoFitting ? "Ajustando..." : "Auto-Ajustar"}
                </Button>
              </div>
            )}

            {/* Legend */}
            <div className="border-t pt-4">
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
            )}

            {/* Preview Area */}
            <div 
              ref={previewContainerRef} 
              className="flex-1 bg-gray-200 overflow-auto"
            >
              <div className="flex justify-center items-start p-2 md:p-6">
                {/* Page 1 - Always rendered */}
                <div 
                  className={`pdf-preview-page-wrapper relative ${activeTab !== "page1" ? "hidden" : ""}`}
                  style={{ 
                    transform: `scale(${previewScale})`,
                    transformOrigin: 'top center',
                    marginBottom: `${(1 - previewScale) * 1056}px`
                  }}
                >
                  <div className="pdf-preview-safe-area hidden md:block" />
                  <div ref={page1Ref}>
                    <ServicePdfPage1
                      serviceData={serviceData}
                      selectedDate={selectedDate}
                      scale={page1Scale}
                    />
                  </div>
                  {!page1Fits && <div className="pdf-preview-overflow-indicator" />}
                </div>

                {/* Page 2 - Always rendered */}
                <div 
                  className={`pdf-preview-page-wrapper relative ${activeTab !== "page2" ? "hidden" : ""}`}
                  style={{ 
                    transform: `scale(${previewScale})`,
                    transformOrigin: 'top center',
                    marginBottom: `${(1 - previewScale) * 1056}px`
                  }}
                >
                  <div className="pdf-preview-safe-area hidden md:block" />
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
              </div>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
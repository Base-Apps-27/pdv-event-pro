import React, { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Minus, Plus, Wand2, Printer, Check, AlertTriangle, Download, Mail, Loader2, X, ChevronDown, ChevronUp } from "lucide-react";
import { PDFViewer, PDFDownloadLink, pdf } from '@react-pdf/renderer';
import ServiceProgramPdf from "./ServiceProgramPdf";
import { base44 } from "@/api/base44Client";

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
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Detect mobile
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(mobile);
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePrint = async () => {
    setIsGeneratingPDF(true);
    try {
      onSaveScales({ page1: page1Scale, page2: page2Scale });
      
      const doc = (
        <ServiceProgramPdf
          serviceData={serviceData}
          selectedDate={selectedDate}
          fixedAnnouncements={fixedAnnouncements}
          dynamicAnnouncements={dynamicAnnouncements}
          selectedAnnouncements={selectedAnnouncements}
          page1Scale={page1Scale}
          page2Scale={page2Scale}
        />
      );
      
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = url;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        iframe.contentWindow.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(url);
        }, 100);
      };
    } catch (error) {
      console.error('Print error:', error);
      alert('Error al imprimir / Error printing: ' + error.message);
    } finally {
      setIsGeneratingPDF(false);
    }
  };
  
  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      onSaveScales({ page1: page1Scale, page2: page2Scale });
      
      const doc = (
        <ServiceProgramPdf
          serviceData={serviceData}
          selectedDate={selectedDate}
          fixedAnnouncements={fixedAnnouncements}
          dynamicAnnouncements={dynamicAnnouncements}
          selectedAnnouncements={selectedAnnouncements}
          page1Scale={page1Scale}
          page2Scale={page2Scale}
        />
      );
      
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Orden-de-Servicio-${selectedDate}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
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
        
        <DialogHeader className="flex-shrink-0 px-3 md:px-6 py-2 md:py-3 border-b bg-white">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <DialogTitle className="text-sm md:text-xl font-bold truncate">
                Vista Previa / Preview
              </DialogTitle>
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
                disabled={isGeneratingPDF}
                className="h-8 w-8 p-0"
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
                className="bg-gray-900 text-white h-8 w-8 p-0 hidden md:inline-flex"
                disabled={isGeneratingPDF}
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
                      <TabsTrigger value="page1" className="text-xs">Página 1</TabsTrigger>
                      <TabsTrigger value="page2" className="text-xs">Página 2</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Badge variant="outline">
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
                    <span className="text-sm font-semibold">Escala / Scale</span>
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

                </div>
                )}

            {/* Page 2 Controls */}
            {activeTab === "page2" && (
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">Escala / Scale</span>
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

                </div>
                )}
            </div>
            )}

            {/* Preview Area */}
            <div 
              ref={previewContainerRef} 
              className="flex-1 bg-gray-200 overflow-auto"
            >
              <div className="h-full w-full">
                <PDFViewer 
                  width="100%" 
                  height="100%"
                  showToolbar={false}
                >
                  <ServiceProgramPdf
                    serviceData={serviceData}
                    selectedDate={selectedDate}
                    fixedAnnouncements={fixedAnnouncements}
                    dynamicAnnouncements={dynamicAnnouncements}
                    selectedAnnouncements={selectedAnnouncements}
                    page1Scale={page1Scale}
                    page2Scale={page2Scale}
                  />
                </PDFViewer>
              </div>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Minus, Plus, Printer, Check, Download, Mail, Loader2, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";

const MOBILE_BREAKPOINT = 768;

export default function ServicePdfPreview({
  open,
  onOpenChange,
  serviceData,
  selectedDate,
  selectedAnnouncements,
  pdfScales,
  onSaveScales
}) {
  const [page1Scale, setPage1Scale] = useState(pdfScales?.page1 || 100);
  const [page2Scale, setPage2Scale] = useState(pdfScales?.page2 || 100);
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePrint = async () => {
    setPdfLoading(true);
    try {
      const response = await base44.functions.invoke('generateServiceProgramPdf', {
        serviceData,
        selectedDate,
        selectedAnnouncements,
        page1Scale,
        page2Scale
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Error generando PDF / Error generating PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    setPdfLoading(true);
    try {
      const response = await base44.functions.invoke('generateServiceProgramPdf', {
        serviceData,
        selectedDate,
        selectedAnnouncements,
        page1Scale,
        page2Scale
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Orden-de-Servicio-${selectedDate}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('PDF download error:', error);
      alert('Error descargando PDF / Error downloading PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailAddress || !emailAddress.includes('@')) {
      alert('Por favor ingrese un email válido / Please enter a valid email');
      return;
    }
    
    setSendingEmail(true);
    
    try {
      const liveViewUrl = window.location.origin + createPageUrl('PublicProgramView') + `?date=${selectedDate}`;
      
      await base44.integrations.Core.SendEmail({
        to: emailAddress,
        subject: `Orden de Servicio - Domingo ${selectedDate}`,
        body: `
          <h2>Orden de Servicio / Service Order</h2>
          <p><strong>Fecha / Date:</strong> ${selectedDate}</p>
          <p>Puede ver el programa de servicio completo en línea aquí:</p>
          <p><a href="${liveViewUrl}" style="color: #1FBA70; font-weight: 600;">${liveViewUrl}</a></p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #E6E6E6;"/>
          <p style="color: #666666; font-size: 14px;">Este documento fue generado desde el sistema de gestión de servicios de Palabras de Vida.</p>
          <p style="color: #666666; font-size: 14px;">This document was generated from the Palabras de Vida service management system.</p>
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

  // Don't render dialog on mobile
  if (isMobile) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[95vh] max-h-[95vh] w-[95vw] md:w-full p-0 print:hidden flex flex-col">
        
        <DialogHeader className="flex-shrink-0 px-6 py-3 border-b bg-white">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <DialogTitle className="text-xl font-bold truncate">
                Vista Previa PDF / PDF Preview
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
              {!showEmailForm && (
                <>
                  <Button 
                    onClick={handleDownloadPDF}
                    variant="outline"
                    disabled={pdfLoading}
                    className="h-8 px-3 text-sm"
                    size="sm"
                    title="Download PDF"
                  >
                    {pdfLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <Download className="w-4 h-4 mr-1" />
                    )}
                    Descargar
                  </Button>
                  <Button 
                    onClick={() => setShowEmailForm(true)}
                    variant="outline"
                    disabled={pdfLoading}
                    className="h-8 px-3 text-sm"
                    size="sm"
                    title="Email PDF"
                  >
                    <Mail className="w-4 h-4 mr-1" />
                    Email
                  </Button>
                  <Button 
                    onClick={handlePrint} 
                    className="bg-gray-900 text-white h-8 px-3 text-sm"
                    disabled={pdfLoading}
                    size="sm"
                    title="Print PDF"
                  >
                    <Printer className="w-4 h-4 mr-1" />
                    Imprimir
                  </Button>
                </>
              )}
            </div>
          </div>
          
          {showEmailForm && (
            <div className="flex items-center gap-2 mt-3">
              <Input
                type="email"
                placeholder="email@ejemplo.com"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleSendEmail}
                disabled={sendingEmail || emailSent}
                className="bg-pdv-teal hover:bg-pdv-green"
              >
                {sendingEmail ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : emailSent ? (
                  <Check className="w-4 h-4" />
                ) : (
                  'Enviar'
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowEmailForm(false);
                  setEmailAddress("");
                }}
              >
                Cancelar
              </Button>
            </div>
          )}
        </DialogHeader>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Desktop Controls Panel */}
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
                    <Badge variant="outline">{page1Scale}%</Badge>
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
                </div>
              </div>
            )}

            {/* Page 2 Controls */}
            {activeTab === "page2" && (
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">Escala / Scale</span>
                    <Badge variant="outline">{page2Scale}%</Badge>
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
                </div>
              </div>
            )}
          </div>

          {/* PDF Viewer Area */}
          <div className="flex-1 bg-gray-200 overflow-hidden">
            {pdfLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-pdv-teal" />
                <span className="ml-3">Generando PDF...</span>
              </div>
            ) : (
              <PDFViewer style={{ width: '100%', height: '100%', border: 'none' }}>
                <ServiceProgramPdf
                  serviceData={serviceData}
                  selectedDate={selectedDate}
                  selectedAnnouncements={selectedAnnouncements}
                  page1Scale={page1Scale}
                  page2Scale={page2Scale}
                />
              </PDFViewer>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
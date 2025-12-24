import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { BookOpen, List, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function StructuredVersesModal({ 
  open, 
  onOpenChange, 
  parsedData,
  rawText,
  language = 'es' 
}) {
  const texts = {
    es: {
      title: "Versos y Bosquejo del Mensaje",
      verseList: "Lista de Versos",
      outline: "Bosquejo del Mensaje",
      text: "Texto",
      close: "Cerrar",
      noData: "No hay versos disponibles"
    },
    en: {
      title: "Message Verses and Outline",
      verseList: "Verse List",
      outline: "Message Outline",
      text: "Text",
      close: "Close",
      noData: "No verses available"
    }
  };

  const t = texts[language] || texts.es;

  if (!parsedData) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-pdv-teal" />
              {t.title}
            </DialogTitle>
          </DialogHeader>
          <div className="py-12 text-center">
            <p className="text-gray-500">{t.noData}</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const renderContent = () => {
    if (parsedData.type === 'verse_list') {
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-pdv-teal" />
            <h4 className="font-bold text-lg text-gray-900">{t.verseList}</h4>
            <Badge variant="outline" className="ml-2">{parsedData.sections.length} {parsedData.sections.length === 1 ? 'verso' : 'versos'}</Badge>
          </div>
          {parsedData.sections.map((item, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <span className="text-pdv-teal font-bold text-lg">{idx + 1}.</span>
              <span className="text-gray-800 text-base leading-relaxed flex-1">{item.content}</span>
            </div>
          ))}
        </div>
      );
    }

    if (parsedData.type === 'outline') {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <List className="w-5 h-5 text-pdv-green" />
            <h4 className="font-bold text-lg text-gray-900">{t.outline}</h4>
            <Badge variant="outline" className="ml-2">{parsedData.sections.length} {parsedData.sections.length === 1 ? 'sección' : 'secciones'}</Badge>
          </div>
          {parsedData.sections.map((section, idx) => (
            <div key={idx} className="border-l-4 border-pdv-teal pl-4 pb-3">
              <h5 className="font-bold text-gray-900 text-lg mb-3">{section.title}</h5>
              
              {section.verses && section.verses.length > 0 && (
                <div className="space-y-2 ml-2 mb-3">
                  {section.verses.map((verse, vIdx) => (
                    <div key={vIdx} className="text-sm text-gray-700 flex gap-2 items-start">
                      <span className="text-pdv-green font-bold">•</span>
                      <span className="flex-1">{verse}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {section.subsections && section.subsections.length > 0 && (
                <div className="ml-6 space-y-3">
                  {section.subsections.map((subsection, sIdx) => (
                    <div key={sIdx} className="border-l-2 border-gray-400 pl-3">
                      <h6 className="font-semibold text-gray-800 mb-2">{subsection.title}</h6>
                      {subsection.verses && subsection.verses.length > 0 && (
                        <div className="space-y-1 ml-2">
                          {subsection.verses.map((verse, vIdx) => (
                            <div key={vIdx} className="text-sm text-gray-600 flex gap-2 items-start">
                              <span className="text-gray-400">–</span>
                              <span className="flex-1">{verse}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }

    // Fallback plain text
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-gray-600" />
          <h4 className="font-bold text-sm text-gray-900">{t.text}</h4>
        </div>
        <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg border border-gray-200">{rawText}</p>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] bg-white">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-pdv-teal" />
              {t.title}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          {renderContent()}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
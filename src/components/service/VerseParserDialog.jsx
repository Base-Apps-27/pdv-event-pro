import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, BookOpen, List, FileText } from "lucide-react";

// Client-side parser for verses and outlines
function parseVersesAndOutline(rawText) {
  if (!rawText || rawText.trim() === '') return { type: 'empty', sections: [] };

  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l);
  
  // Pattern matching for verses (e.g., Juan 3:16, Mateo 5:1-10, 1 Corintios 13:1)
  const versePattern = /^(\d?\s?[A-ZÁ-Ú][a-zá-ú]+\.?\s)?(\d+):(\d+(-\d+)?)/;
  const bookPattern = /^(\d?\s?[A-ZÁ-Ú][a-zá-ú]+\.?)/;
  
  // Detect if it's primarily verses or an outline
  const verseLines = lines.filter(line => versePattern.test(line));
  const isSimpleVerseList = verseLines.length / lines.length > 0.6;
  
  if (isSimpleVerseList) {
    // Simple verse list - just return verses as flat items
    return {
      type: 'verse_list',
      sections: verseLines.map(verse => ({
        type: 'verse',
        content: verse.trim()
      }))
    };
  }
  
  // Complex outline detection - look for Roman numerals, numbers, letters
  const outlineMarkers = /^(I{1,3}V?|IV|V|VI{1,3}|[IVXLCDM]+|[0-9]+\.|[A-Z]\.|[a-z]\.|[-•*])\s+/;
  const sections = [];
  let currentSection = null;
  let currentSubsection = null;
  
  for (let line of lines) {
    // Check if it's an outline marker
    const markerMatch = line.match(outlineMarkers);
    
    if (markerMatch) {
      const marker = markerMatch[0];
      const content = line.replace(marker, '').trim();
      
      // Determine hierarchy level
      const isRoman = /^(I{1,3}V?|IV|V|VI{1,3})/.test(marker);
      const isNumeric = /^\d+\./.test(marker);
      const isLetter = /^[A-Z]\./.test(marker);
      const isBullet = /^[-•*]/.test(marker);
      
      if (isRoman || (isNumeric && !currentSection)) {
        // Main section
        if (currentSection) sections.push(currentSection);
        currentSection = {
          type: 'section',
          title: content,
          verses: [],
          subsections: []
        };
        currentSubsection = null;
      } else if ((isNumeric || isLetter) && currentSection) {
        // Subsection
        if (currentSubsection) currentSection.subsections.push(currentSubsection);
        currentSubsection = {
          type: 'subsection',
          title: content,
          verses: []
        };
      } else if (isBullet && currentSubsection) {
        // Verse under subsection
        currentSubsection.verses.push(content);
      } else if (isBullet && currentSection) {
        // Verse under section
        currentSection.verses.push(content);
      }
    } else if (versePattern.test(line)) {
      // It's a verse without a bullet
      if (currentSubsection) {
        currentSubsection.verses.push(line);
      } else if (currentSection) {
        currentSection.verses.push(line);
      } else {
        // Standalone verse
        sections.push({ type: 'verse', content: line });
      }
    } else {
      // Regular text - treat as section title if nothing is open
      if (!currentSection) {
        currentSection = {
          type: 'section',
          title: line,
          verses: [],
          subsections: []
        };
      } else if (currentSubsection) {
        currentSubsection.verses.push(line);
      } else if (currentSection) {
        currentSection.verses.push(line);
      }
    }
  }
  
  // Close remaining sections
  if (currentSubsection) currentSection.subsections.push(currentSubsection);
  if (currentSection) sections.push(currentSection);
  
  return {
    type: sections.length > 0 ? 'outline' : 'text',
    sections: sections.length > 0 ? sections : [{ type: 'text', content: rawText }]
  };
}

function VerseParserDialog({ 
  open, 
  onOpenChange, 
  initialText = "", 
  onSave,
  language = 'es' 
}) {
  const [rawText, setRawText] = useState(initialText);
  const [parsedData, setParsedData] = useState(null);
  const [isParsing, setIsParsing] = useState(false);

  const texts = {
    es: {
      title: "Analizar Versos y Bosquejo",
      inputLabel: "Pega tu texto aquí",
      inputPlaceholder: "Copia y pega versos bíblicos o el bosquejo completo del mensaje...\n\nEjemplo de versos:\nJuan 3:16\nRomanos 8:28\n1 Corintios 13:4-7\n\nO un bosquejo completo con secciones y versos.",
      parseBtn: "Analizar",
      parsing: "Analizando...",
      saveBtn: "Guardar",
      cancelBtn: "Cancelar",
      resultTitle: "Resultado del Análisis",
      verseList: "Lista de Versos",
      outline: "Bosquejo Estructurado",
      text: "Texto",
      noData: "Pega texto y presiona 'Analizar'",
    },
    en: {
      title: "Parse Verses and Outline",
      inputLabel: "Paste your text here",
      inputPlaceholder: "Copy and paste Bible verses or complete message outline...\n\nVerse example:\nJohn 3:16\nRomans 8:28\n1 Corinthians 13:4-7\n\nOr a complete outline with sections and verses.",
      parseBtn: "Parse",
      parsing: "Parsing...",
      saveBtn: "Save",
      cancelBtn: "Cancel",
      resultTitle: "Analysis Result",
      verseList: "Verse List",
      outline: "Structured Outline",
      text: "Text",
      noData: "Paste text and press 'Parse'",
    }
  };

  const t = texts[language] || texts.es;

  const handleParse = () => {
    setIsParsing(true);
    // Simulate brief processing time for UX
    setTimeout(() => {
      const result = parseVersesAndOutline(rawText);
      setParsedData(result);
      setIsParsing(false);
    }, 300);
  };

  const handleSave = () => {
    if (parsedData && onSave) {
      onSave({
        raw_text: rawText,
        parsed_data: parsedData
      });
    }
    onOpenChange(false);
  };

  const renderParsedContent = () => {
    if (!parsedData) return <p className="text-gray-500 text-sm italic text-center py-8">{t.noData}</p>;

    if (parsedData.type === 'empty') {
      return <p className="text-gray-500 text-sm italic text-center py-8">{t.noData}</p>;
    }

    if (parsedData.type === 'verse_list') {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-pdv-teal" />
            <h4 className="font-bold text-sm text-gray-900">{t.verseList}</h4>
            <Badge variant="outline" className="text-xs">{parsedData.sections.length} {parsedData.sections.length === 1 ? 'verso' : 'versos'}</Badge>
          </div>
          {parsedData.sections.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2 text-sm">
              <span className="text-pdv-teal font-bold">{idx + 1}.</span>
              <span className="text-gray-800">{item.content}</span>
            </div>
          ))}
        </div>
      );
    }

    if (parsedData.type === 'outline') {
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <List className="w-4 h-4 text-pdv-green" />
            <h4 className="font-bold text-sm text-gray-900">{t.outline}</h4>
            <Badge variant="outline" className="text-xs">{parsedData.sections.length} {parsedData.sections.length === 1 ? 'sección' : 'secciones'}</Badge>
          </div>
          {parsedData.sections.map((section, idx) => (
            <div key={idx} className="border-l-4 border-pdv-teal pl-3 pb-2">
              <h5 className="font-bold text-gray-900 mb-2">{section.title}</h5>
              
              {section.verses && section.verses.length > 0 && (
                <div className="space-y-1 ml-2">
                  {section.verses.map((verse, vIdx) => (
                    <div key={vIdx} className="text-xs text-gray-700 flex gap-2">
                      <span className="text-pdv-green">•</span>
                      <span>{verse}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {section.subsections && section.subsections.length > 0 && (
                <div className="ml-4 mt-2 space-y-2">
                  {section.subsections.map((subsection, sIdx) => (
                    <div key={sIdx} className="border-l-2 border-gray-300 pl-2">
                      <h6 className="font-semibold text-gray-800 text-sm">{subsection.title}</h6>
                      {subsection.verses && subsection.verses.length > 0 && (
                        <div className="space-y-0.5 ml-2 mt-1">
                          {subsection.verses.map((verse, vIdx) => (
                            <div key={vIdx} className="text-xs text-gray-600 flex gap-2">
                              <span className="text-gray-400">–</span>
                              <span>{verse}</span>
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

    // Fallback for plain text
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-gray-600" />
          <h4 className="font-bold text-sm text-gray-900">{t.text}</h4>
        </div>
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{rawText}</p>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] bg-white overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-pdv-teal" />
            {t.title}
          </DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-4 flex-1 overflow-hidden">
          {/* Input Side */}
          <div className="flex flex-col gap-2 min-h-0">
            <label className="text-sm font-semibold text-gray-900">{t.inputLabel}</label>
            <Textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={t.inputPlaceholder}
              className="flex-1 min-h-[200px] text-sm font-mono"
            />
            <Button
              onClick={handleParse}
              disabled={!rawText.trim() || isParsing}
              style={{ backgroundColor: '#1F8A70', color: '#ffffff' }}
              className="w-full font-semibold"
            >
              {isParsing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t.parsing}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  {t.parseBtn}
                </>
              )}
            </Button>
          </div>

          {/* Preview Side */}
          <div className="flex flex-col gap-2 min-h-0">
            <label className="text-sm font-semibold text-gray-900">{t.resultTitle}</label>
            <ScrollArea className="flex-1 border-2 border-gray-300 rounded-lg p-4 bg-gray-50 min-h-[200px]">
              {renderParsedContent()}
            </ScrollArea>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="border-2 border-gray-400"
          >
            {t.cancelBtn}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!parsedData || parsedData.type === 'empty'}
            style={{ backgroundColor: '#8DC63F', color: '#ffffff' }}
            className="font-semibold"
          >
            <BookOpen className="w-4 h-4 mr-2" />
            {t.saveBtn}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default VerseParserDialog;
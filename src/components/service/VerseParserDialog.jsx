import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, BookOpen } from "lucide-react";

// Client-side parser for scripture references - ONLY extracts verse citations
function parseScriptureReferences(rawText) {
  if (!rawText || rawText.trim() === '') return { type: 'empty', sections: [] };

  // Strict pattern: ONLY match book + chapter:verse format
  // Examples: Rom 8:28 | S. Mar 3:16 | 1 Cor 13:4-7 | Juan 3:16-18 | Gen 1:1-2:3
  const versePattern = /\b([1-3]\s)?(S\.\s)?([A-ZÁ-Úa-zá-ú][a-zá-ú]{1,10}\.?)\s+(\d{1,3}):(\d{1,3})(-(\d{1,3}))?(:(\d{1,3}))?\b/gi;
  
  const verses = [];
  const seenRefs = new Set(); // Deduplicate
  
  // Search entire text for verse patterns
  const matches = [...rawText.matchAll(versePattern)];
  
  matches.forEach(match => {
    const fullMatch = match[0].trim();
    
    // Filter out false positives (common words that look like book names)
    const bookPart = (match[1] || '') + (match[2] || '') + match[3];
    const lowerBook = bookPart.toLowerCase().trim();
    
    // Blacklist common Spanish/English words that match the pattern
    const blacklist = ['y', 'es', 'en', 'el', 'la', 'de', 'a', 'por', 'con', 'sin'];
    if (blacklist.includes(lowerBook)) return;
    
    // Only add if not already seen
    if (!seenRefs.has(fullMatch)) {
      seenRefs.add(fullMatch);
      verses.push({
        type: 'verse',
        content: fullMatch
      });
    }
  });
  
  return {
    type: verses.length > 0 ? 'verse_list' : 'empty',
    sections: verses
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

  // Reset state when initialText changes (e.g., different segment selected)
  useEffect(() => {
    setRawText(initialText);
    setParsedData(null);
  }, [initialText]);

  const texts = {
    es: {
      title: "Extraer Referencias Bíblicas",
      inputLabel: "Pega tus referencias aquí",
      inputPlaceholder: "Copia y pega las referencias bíblicas del mensaje...\n\nEjemplos:\nJuan 3:16\nRomanos 8:28-30\n1 Corintios 13:4-7\nGénesis 1:1-2:3\nMateo 5:1-12",
      parseBtn: "Extraer Referencias",
      parsing: "Extrayendo...",
      saveBtn: "Guardar",
      cancelBtn: "Cancelar",
      resultTitle: "Referencias Encontradas",
      verseList: "Referencias Bíblicas",
      noData: "Pega las referencias y presiona 'Extraer'",
    },
    en: {
      title: "Extract Scripture References",
      inputLabel: "Paste your references here",
      inputPlaceholder: "Copy and paste scripture references from the message...\n\nExamples:\nJohn 3:16\nRomans 8:28-30\n1 Corinthians 13:4-7\nGenesis 1:1-2:3\nMatthew 5:1-12",
      parseBtn: "Extract References",
      parsing: "Extracting...",
      saveBtn: "Save",
      cancelBtn: "Cancel",
      resultTitle: "References Found",
      verseList: "Scripture References",
      noData: "Paste references and press 'Extract'",
    }
  };

  const t = texts[language] || texts.es;

  const handleParse = () => {
    setIsParsing(true);
    // Simulate brief processing time for UX
    setTimeout(() => {
      const result = parseScriptureReferences(rawText);
      setParsedData(result);
      setIsParsing(false);
    }, 300);
  };

  const handleSave = () => {
    if (parsedData && onSave) {
      // Only save parsed structure - do NOT overwrite original text field
      onSave({
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

    if (parsedData.type === 'verse_list' && parsedData.sections.length > 0) {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-pdv-teal" />
            <h4 className="font-bold text-sm text-gray-900">{t.verseList}</h4>
            <Badge variant="outline" className="text-xs">{parsedData.sections.length} {language === 'es' ? (parsedData.sections.length === 1 ? 'referencia' : 'referencias') : (parsedData.sections.length === 1 ? 'reference' : 'references')}</Badge>
          </div>
          {parsedData.sections.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2 p-2 bg-white rounded border border-gray-200 hover:border-pdv-teal transition-colors">
              <span className="text-pdv-teal font-bold text-sm">{idx + 1}.</span>
              <span className="text-gray-800 text-sm">{item.content}</span>
            </div>
          ))}
        </div>
      );
    }

    // No verses found
    return (
      <div className="text-center py-8">
        <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">
          {language === 'es' ? 'No se encontraron referencias bíblicas' : 'No scripture references found'}
        </p>
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
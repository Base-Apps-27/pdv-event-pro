import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, BookOpen } from "lucide-react";

// Client-side parser for scripture references
function parseScriptureReferences(rawText) {
  if (!rawText || rawText.trim() === '') return { type: 'empty', verses: [] };

  // Comprehensive verse pattern matching common citation formats:
  // John 3:16 | Juan 3:16 | 1 Corinthians 13:4-7 | Romans 8:28-30 | Genesis 1:1-2:3
  const versePattern = /(\d\s)?([1-3]\s)?([A-ZÁ-Úa-zá-ú]+\.?\s?[A-ZÁ-Úa-zá-ú]*\.?)\s+(\d+):(\d+)(-(\d+))?(:(\d+))?/gi;
  
  const verses = [];
  const lines = rawText.split('\n');
  
  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Try to match verse patterns in the line
    const matches = [...trimmed.matchAll(versePattern)];
    
    if (matches.length > 0) {
      // Extract all verse references from this line
      matches.forEach(match => {
        const fullMatch = match[0].trim();
        verses.push({
          reference: fullMatch,
          original: trimmed
        });
      });
    } else if (trimmed.length > 0 && trimmed.length < 150) {
      // Check if line contains common book names even without full pattern
      const bookNames = /\b(Genesis|Génesis|Exodus|Éxodo|Leviticus|Levítico|Numbers|Números|Deuteronomy|Deuteronomio|Joshua|Josué|Judges|Jueces|Ruth|Rut|Samuel|Kings|Reyes|Chronicles|Crónicas|Ezra|Esdras|Nehemiah|Nehemías|Esther|Ester|Job|Psalms?|Salmos?|Proverbs|Proverbios|Ecclesiastes|Eclesiastés|Song|Cantares|Isaiah|Isaías|Jeremiah|Jeremías|Lamentations|Lamentaciones|Ezekiel|Ezequiel|Daniel|Hosea|Oseas|Joel|Amos|Amós|Obadiah|Abdías|Jonah|Jonás|Micah|Miqueas|Nahum|Nahúm|Habakkuk|Habacuc|Zephaniah|Sofonías|Haggai|Hageo|Zechariah|Zacarías|Malachi|Malaquías|Matthew|Mateo|Mark|Marcos|Luke|Lucas|John|Juan|Acts|Hechos|Romans|Romanos|Corinthians|Corintios|Galatians|Gálatas|Ephesians|Efesios|Philippians|Filipenses|Colossians|Colosenses|Thessalonians|Tesalonicenses|Timothy|Timoteo|Titus|Tito|Philemon|Filemón|Hebrews|Hebreos|James|Santiago|Peter|Pedro|Jude|Judas|Revelation|Apocalipsis)\b/i;
      
      if (bookNames.test(trimmed)) {
        verses.push({
          reference: trimmed,
          original: trimmed
        });
      }
    }
  }
  
  return {
    type: verses.length > 0 ? 'verse_list' : 'empty',
    verses: verses
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

    if (parsedData.type === 'verse_list' && parsedData.verses.length > 0) {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-pdv-teal" />
            <h4 className="font-bold text-sm text-gray-900">{t.verseList}</h4>
            <Badge variant="outline" className="text-xs">{parsedData.verses.length} {language === 'es' ? (parsedData.verses.length === 1 ? 'referencia' : 'referencias') : (parsedData.verses.length === 1 ? 'reference' : 'references')}</Badge>
          </div>
          {parsedData.verses.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2 p-2 bg-white rounded border border-gray-200 hover:border-pdv-teal transition-colors">
              <span className="text-pdv-teal font-bold text-sm">{idx + 1}.</span>
              <span className="text-gray-800 text-sm">{item.reference}</span>
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
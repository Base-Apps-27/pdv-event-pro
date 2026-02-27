import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, BookOpen } from "lucide-react";
import { base44 } from "@/api/base44Client";

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  VERSE PARSING LOGIC — CANONICAL CLIENT-SIDE COPY                   ║
// ║                                                                      ║
// ║  This logic (BIBLE_BOOKS + parseScriptureReferences) is duplicated   ║
// ║  in 4 locations due to platform constraints (no shared imports       ║
// ║  between frontend and backend, no imports between backend functions). ║
// ║                                                                      ║
// ║  ALL COPIES MUST BE KEPT IN SYNC. If you change one, change all:    ║
// ║    1. components/service/VerseParserDialog  (this file — frontend)   ║
// ║    2. functions/submitWeeklyServiceContent  (backend — inline)       ║
// ║    3. functions/processNewSubmissionVersion (backend — automation)   ║
// ║    4. functions/processPendingSubmissions   (backend — safety net)   ║
// ║                                                                      ║
// ║  Decision: "Verse Parsing Logic Anti-Drift Protocol" (2026-02-05)   ║
// ╚══════════════════════════════════════════════════════════════════════╝
const BIBLE_BOOKS = {
  // Old Testament
  "gn": { en: "Genesis", es: "Génesis" }, "gen": { en: "Genesis", es: "Génesis" }, "genesis": { en: "Genesis", es: "Génesis" }, "génesis": { en: "Genesis", es: "Génesis" }, "gén": { en: "Genesis", es: "Génesis" },
  "ex": { en: "Exodus", es: "Éxodo" }, "exo": { en: "Exodus", es: "Éxodo" }, "exod": { en: "Exodus", es: "Éxodo" }, "exodus": { en: "Exodus", es: "Éxodo" }, "éxodo": { en: "Exodus", es: "Éxodo" }, "éx": { en: "Exodus", es: "Éxodo" },
  "lv": { en: "Leviticus", es: "Levítico" }, "lev": { en: "Leviticus", es: "Levítico" }, "leviticus": { en: "Leviticus", es: "Levítico" }, "levítico": { en: "Leviticus", es: "Levítico" },
  "nm": { en: "Numbers", es: "Números" }, "num": { en: "Numbers", es: "Números" }, "numb": { en: "Numbers", es: "Números" }, "numbers": { en: "Numbers", es: "Números" }, "números": { en: "Numbers", es: "Números" }, "núm": { en: "Numbers", es: "Números" },
  "dt": { en: "Deuteronomy", es: "Deuteronomio" }, "deut": { en: "Deuteronomy", es: "Deuteronomio" }, "deuteronomy": { en: "Deuteronomy", es: "Deuteronomio" }, "deuteronomio": { en: "Deuteronomy", es: "Deuteronomio" },
  "js": { en: "Joshua", es: "Josué" }, "jos": { en: "Joshua", es: "Josué" }, "josh": { en: "Joshua", es: "Josué" }, "joshua": { en: "Joshua", es: "Josué" }, "josué": { en: "Joshua", es: "Josué" },
  "jue": { en: "Judges", es: "Jueces" }, "judg": { en: "Judges", es: "Jueces" }, "judges": { en: "Judges", es: "Jueces" }, "jueces": { en: "Judges", es: "Jueces" },
  "rt": { en: "Ruth", es: "Rut" }, "rut": { en: "Ruth", es: "Rut" }, "ruth": { en: "Ruth", es: "Rut" },
  "1 sm": { en: "1 Samuel", es: "1 Samuel" }, "1 sa": { en: "1 Samuel", es: "1 Samuel" }, "1 sam": { en: "1 Samuel", es: "1 Samuel" }, "1 samuel": { en: "1 Samuel", es: "1 Samuel" }, "i sam": { en: "1 Samuel", es: "1 Samuel" }, "1sam": { en: "1 Samuel", es: "1 Samuel" },
  "2 sm": { en: "2 Samuel", es: "2 Samuel" }, "2 sa": { en: "2 Samuel", es: "2 Samuel" }, "2 sam": { en: "2 Samuel", es: "2 Samuel" }, "2 samuel": { en: "2 Samuel", es: "2 Samuel" }, "ii sam": { en: "2 Samuel", es: "2 Samuel" }, "2sam": { en: "2 Samuel", es: "2 Samuel" },
  "1 re": { en: "1 Kings", es: "1 Reyes" }, "1 kgs": { en: "1 Kings", es: "1 Reyes" }, "1 ki": { en: "1 Kings", es: "1 Reyes" }, "1 kings": { en: "1 Kings", es: "1 Reyes" }, "1 reyes": { en: "1 Kings", es: "1 Reyes" }, "i rey": { en: "1 Kings", es: "1 Reyes" }, "1rey": { en: "1 Kings", es: "1 Reyes" },
  "2 re": { en: "2 Kings", es: "2 Reyes" }, "2 kgs": { en: "2 Kings", es: "2 Reyes" }, "2 ki": { en: "2 Kings", es: "2 Reyes" }, "2 kings": { en: "2 Kings", es: "2 Reyes" }, "2 reyes": { en: "2 Kings", es: "2 Reyes" }, "ii rey": { en: "2 Kings", es: "2 Reyes" }, "2rey": { en: "2 Kings", es: "2 Reyes" },
  "1 cr": { en: "1 Chronicles", es: "1 Crónicas" }, "1 chr": { en: "1 Chronicles", es: "1 Crónicas" }, "1 chron": { en: "1 Chronicles", es: "1 Crónicas" }, "1 chronicles": { en: "1 Chronicles", es: "1 Crónicas" }, "1 crónicas": { en: "1 Chronicles", es: "1 Crónicas" }, "i cron": { en: "1 Chronicles", es: "1 Crónicas" }, "1cron": { en: "1 Chronicles", es: "1 Crónicas" },
  "2 cr": { en: "2 Chronicles", es: "2 Crónicas" }, "2 chr": { en: "2 Chronicles", es: "2 Crónicas" }, "2 chron": { en: "2 Chronicles", es: "2 Crónicas" }, "2 chronicles": { en: "2 Chronicles", es: "2 Crónicas" }, "2 crónicas": { en: "2 Chronicles", es: "2 Crónicas" }, "ii cron": { en: "2 Chronicles", es: "2 Crónicas" }, "2cron": { en: "2 Chronicles", es: "2 Crónicas" },
  "esd": { en: "Ezra", es: "Esdras" }, "ezr": { en: "Ezra", es: "Esdras" }, "ezra": { en: "Ezra", es: "Esdras" }, "esdras": { en: "Ezra", es: "Esdras" },
  "neh": { en: "Nehemiah", es: "Nehemías" }, "nehemiah": { en: "Nehemiah", es: "Nehemías" }, "nehemías": { en: "Nehemiah", es: "Nehemías" },
  "est": { en: "Esther", es: "Ester" }, "esth": { en: "Esther", es: "Ester" }, "esther": { en: "Esther", es: "Ester" }, "ester": { en: "Esther", es: "Ester" },
  "job": { en: "Job", es: "Job" },
  "sal": { en: "Psalms", es: "Salmos" }, "ps": { en: "Psalms", es: "Salmos" }, "psa": { en: "Psalms", es: "Salmos" }, "psalms": { en: "Psalms", es: "Salmos" }, "salmos": { en: "Psalms", es: "Salmos" },
  "pr": { en: "Proverbs", es: "Proverbios" }, "prov": { en: "Proverbs", es: "Proverbios" }, "pro": { en: "Proverbs", es: "Proverbios" }, "proverbs": { en: "Proverbs", es: "Proverbios" }, "proverbios": { en: "Proverbs", es: "Proverbios" },
  "ec": { en: "Ecclesiastes", es: "Eclesiastés" }, "eccl": { en: "Ecclesiastes", es: "Eclesiastés" }, "ecclesiastes": { en: "Ecclesiastes", es: "Eclesiastés" }, "eclesiastés": { en: "Ecclesiastes", es: "Eclesiastés" }, "ecl": { en: "Ecclesiastes", es: "Eclesiastés" },
  "cnt": { en: "Song of Solomon", es: "Cantares" }, "cant": { en: "Song of Solomon", es: "Cantares" }, "song": { en: "Song of Solomon", es: "Cantares" }, "cantares": { en: "Song of Solomon", es: "Cantares" }, "songs": { en: "Song of Solomon", es: "Cantares" }, "sos": { en: "Song of Solomon", es: "Cantares" },
  "is": { en: "Isaiah", es: "Isaías" }, "isa": { en: "Isaiah", es: "Isaías" }, "isaiah": { en: "Isaiah", es: "Isaías" }, "isaías": { en: "Isaiah", es: "Isaías" },
  "jer": { en: "Jeremiah", es: "Jeremías" }, "jeremiah": { en: "Jeremiah", es: "Jeremías" }, "jeremías": { en: "Jeremiah", es: "Jeremías" },
  "lm": { en: "Lamentations", es: "Lamentaciones" }, "lam": { en: "Lamentations", es: "Lamentaciones" }, "lamentations": { en: "Lamentations", es: "Lamentaciones" }, "lamentaciones": { en: "Lamentations", es: "Lamentaciones" },
  "ez": { en: "Ezekiel", es: "Ezequiel" }, "ezek": { en: "Ezekiel", es: "Ezequiel" }, "ezekiel": { en: "Ezekiel", es: "Ezequiel" }, "ezequiel": { en: "Ezekiel", es: "Ezequiel" },
  "dn": { en: "Daniel", es: "Daniel" }, "dan": { en: "Daniel", es: "Daniel" }, "daniel": { en: "Daniel", es: "Daniel" },
  "os": { en: "Hosea", es: "Oseas" }, "hos": { en: "Hosea", es: "Oseas" }, "hosea": { en: "Hosea", es: "Oseas" }, "oseas": { en: "Hosea", es: "Oseas" },
  "jl": { en: "Joel", es: "Joel" }, "joel": { en: "Joel", es: "Joel" },
  "am": { en: "Amos", es: "Amós" }, "amos": { en: "Amos", es: "Amós" }, "amós": { en: "Amos", es: "Amós" },
  "abd": { en: "Obadiah", es: "Abdías" }, "obad": { en: "Obadiah", es: "Abdías" }, "obadiah": { en: "Obadiah", es: "Abdías" }, "abdías": { en: "Obadiah", es: "Abdías" },
  "jon": { en: "Jonah", es: "Jonás" }, "jona": { en: "Jonah", es: "Jonás" }, "jonah": { en: "Jonah", es: "Jonás" }, "jonás": { en: "Jonah", es: "Jonás" },
  "miq": { en: "Micah", es: "Miqueas" }, "mic": { en: "Micah", es: "Miqueas" }, "micah": { en: "Micah", es: "Miqueas" }, "miqueas": { en: "Micah", es: "Miqueas" },
  "nah": { en: "Nahum", es: "Nahúm" }, "nahum": { en: "Nahum", es: "Nahúm" }, "nahúm": { en: "Nahum", es: "Nahúm" },
  "hab": { en: "Habakkuk", es: "Habacuc" }, "habakkuk": { en: "Habakkuk", es: "Habacuc" }, "habacuc": { en: "Habakkuk", es: "Habacuc" },
  "sof": { en: "Zephaniah", es: "Sofonías" }, "zeph": { en: "Zephaniah", es: "Sofonías" }, "zephaniah": { en: "Zephaniah", es: "Sofonías" }, "sofonías": { en: "Zephaniah", es: "Sofonías" },
  "hag": { en: "Haggai", es: "Hageo" }, "hagg": { en: "Haggai", es: "Hageo" }, "haggai": { en: "Haggai", es: "Hageo" }, "hageo": { en: "Haggai", es: "Hageo" },
  "zac": { en: "Zechariah", es: "Zacarías" }, "zech": { en: "Zechariah", es: "Zacarías" }, "zechariah": { en: "Zechariah", es: "Zacarías" }, "zacarías": { en: "Zechariah", es: "Zacarías" },
  "mal": { en: "Malachi", es: "Malaquías" }, "malachi": { en: "Malachi", es: "Malaquías" }, "malaquías": { en: "Malachi", es: "Malaquías" },

  // New Testament
  "mt": { en: "Matthew", es: "Mateo" }, "matt": { en: "Matthew", es: "Mateo" }, "matthew": { en: "Matthew", es: "Mateo" }, "mateo": { en: "Matthew", es: "Mateo" }, "mat": { en: "Matthew", es: "Mateo" },
  "mr": { en: "Mark", es: "Marcos" }, "mk": { en: "Mark", es: "Marcos" }, "mark": { en: "Mark", es: "Marcos" }, "marcos": { en: "Mark", es: "Marcos" }, "mar": { en: "Mark", es: "Marcos" },
  "lc": { en: "Luke", es: "Lucas" }, "lk": { en: "Luke", es: "Lucas" }, "luke": { en: "Luke", es: "Lucas" }, "lucas": { en: "Luke", es: "Lucas" }, "luc": { en: "Luke", es: "Lucas" }, "luk": { en: "Luke", es: "Lucas" },
  "jn": { en: "John", es: "Juan" }, "jhn": { en: "John", es: "Juan" }, "john": { en: "John", es: "Juan" }, "juan": { en: "John", es: "Juan" },
  "hch": { en: "Acts", es: "Hechos" }, "acts": { en: "Acts", es: "Hechos" }, "hechos": { en: "Acts", es: "Hechos" }, "hech": { en: "Acts", es: "Hechos" },
  "rom": { en: "Romans", es: "Romanos" }, "ro": { en: "Romans", es: "Romanos" }, "romans": { en: "Romans", es: "Romanos" }, "romanos": { en: "Romans", es: "Romanos" }, "rm": { en: "Romans", es: "Romanos" },
  "1 cor": { en: "1 Corinthians", es: "1 Corintios" }, "1 co": { en: "1 Corinthians", es: "1 Corintios" }, "1 corinthians": { en: "1 Corinthians", es: "1 Corintios" }, "1 corintios": { en: "1 Corinthians", es: "1 Corintios" }, "i cor": { en: "1 Corinthians", es: "1 Corintios" },
  "2 cor": { en: "2 Corinthians", es: "2 Corintios" }, "2 co": { en: "2 Corinthians", es: "2 Corintios" }, "2 corinthians": { en: "2 Corinthians", es: "2 Corintios" }, "2 corintios": { en: "2 Corinthians", es: "2 Corintios" }, "ii cor": { en: "2 Corinthians", es: "2 Corintios" },
  "gal": { en: "Galatians", es: "Gálatas" }, "ga": { en: "Galatians", es: "Gálatas" }, "galatians": { en: "Galatians", es: "Gálatas" }, "gálatas": { en: "Galatians", es: "Gálatas" }, "gál": { en: "Galatians", es: "Gálatas" },
  "ef": { en: "Ephesians", es: "Efesios" }, "eph": { en: "Ephesians", es: "Efesios" }, "ephesians": { en: "Ephesians", es: "Efesios" }, "efesios": { en: "Ephesians", es: "Efesios" },
  "fil": { en: "Philippians", es: "Filipenses" }, "php": { en: "Philippians", es: "Filipenses" }, "philippians": { en: "Philippians", es: "Filipenses" }, "filipenses": { en: "Philippians", es: "Filipenses" }, "fili": { en: "Philippians", es: "Filipenses" },
  "col": { en: "Colossians", es: "Colosenses" }, "colossians": { en: "Colossians", es: "Colosenses" }, "colosenses": { en: "Colossians", es: "Colosenses" },
  "1 tes": { en: "1 Thessalonians", es: "1 Tesalonicenses" }, "1 th": { en: "1 Thessalonians", es: "1 Tesalonicenses" }, "1 thess": { en: "1 Thessalonians", es: "1 Tesalonicenses" }, "1 thessalonians": { en: "1 Thessalonians", es: "1 Tesalonicenses" }, "1 tesalonicenses": { en: "1 Thessalonians", es: "1 Tesalonicenses" }, "1tes": { en: "1 Thessalonians", es: "1 Tesalonicenses" },
  "2 tes": { en: "2 Thessalonians", es: "2 Tesalonicenses" }, "2 th": { en: "2 Thessalonians", es: "2 Tesalonicenses" }, "2 thess": { en: "2 Thessalonians", es: "2 Tesalonicenses" }, "2 thessalonians": { en: "2 Thessalonians", es: "2 Tesalonicenses" }, "2 tesalonicenses": { en: "2 Thessalonians", es: "2 Tesalonicenses" }, "2tes": { en: "2 Thessalonians", es: "2 Tesalonicenses" },
  "1 tim": { en: "1 Timothy", es: "1 Timoteo" }, "1 ti": { en: "1 Timothy", es: "1 Timoteo" }, "1 timothy": { en: "1 Timothy", es: "1 Timoteo" }, "1 timoteo": { en: "1 Timothy", es: "1 Timoteo" }, "1tim": { en: "1 Timothy", es: "1 Timoteo" },
  "2 tim": { en: "2 Timothy", es: "2 Timoteo" }, "2 ti": { en: "2 Timothy", es: "2 Timoteo" }, "2 timothy": { en: "2 Timothy", es: "2 Timoteo" }, "2 timoteo": { en: "2 Timothy", es: "2 Timoteo" }, "2tim": { en: "2 Timothy", es: "2 Timoteo" },
  "tit": { en: "Titus", es: "Tito" }, "titus": { en: "Titus", es: "Tito" }, "tito": { en: "Titus", es: "Tito" },
  "flm": { en: "Philemon", es: "Filemón" }, "phm": { en: "Philemon", es: "Filemón" }, "philemon": { en: "Philemon", es: "Filemón" }, "filemón": { en: "Philemon", es: "Filemón" }, "filemon": { en: "Philemon", es: "Filemón" },
  "heb": { en: "Hebrews", es: "Hebreos" }, "hebrews": { en: "Hebrews", es: "Hebreos" }, "hebreos": { en: "Hebrews", es: "Hebreos" },
  "snt": { en: "James", es: "Santiago" }, "jas": { en: "James", es: "Santiago" }, "james": { en: "James", es: "Santiago" }, "santiago": { en: "James", es: "Santiago" }, "stgo": { en: "James", es: "Santiago" }, "stg": { en: "James", es: "Santiago" }, "san": { en: "James", es: "Santiago" },
  "1 pe": { en: "1 Peter", es: "1 Pedro" }, "1 pt": { en: "1 Peter", es: "1 Pedro" }, "1 pet": { en: "1 Peter", es: "1 Pedro" }, "1 peter": { en: "1 Peter", es: "1 Pedro" }, "1 pedro": { en: "1 Peter", es: "1 Pedro" }, "1pe": { en: "1 Peter", es: "1 Pedro" },
  "2 pe": { en: "2 Peter", es: "2 Pedro" }, "2 pt": { en: "2 Peter", es: "2 Pedro" }, "2 pet": { en: "2 Peter", es: "2 Pedro" }, "2 peter": { en: "2 Peter", es: "2 Pedro" }, "2 pedro": { en: "2 Peter", es: "2 Pedro" }, "2pe": { en: "2 Peter", es: "2 Pedro" },
  "1 jn": { en: "1 John", es: "1 Juan" }, "1 jhn": { en: "1 John", es: "1 Juan" }, "1 john": { en: "1 John", es: "1 Juan" }, "1 juan": { en: "1 John", es: "1 Juan" }, "1jn": { en: "1 John", es: "1 Juan" },
  "2 jn": { en: "2 John", es: "2 Juan" }, "2 jhn": { en: "2 John", es: "2 Juan" }, "2 john": { en: "2 John", es: "2 Juan" }, "2 juan": { en: "2 John", es: "2 Juan" }, "2jn": { en: "2 John", es: "2 Juan" },
  "3 jn": { en: "3 John", es: "3 Juan" }, "3 jhn": { en: "3 John", es: "3 Juan" }, "3 john": { en: "3 John", es: "3 Juan" }, "3 juan": { en: "3 John", es: "3 Juan" }, "3jn": { en: "3 John", es: "3 Juan" },
  "jud": { en: "Jude", es: "Judas" }, "jude": { en: "Jude", es: "Judas" }, "judas": { en: "Jude", es: "Judas" }, "jda": { en: "Jude", es: "Judas" },
  "ap": { en: "Revelation", es: "Apocalipsis" }, "rev": { en: "Revelation", es: "Apocalipsis" }, "revelation": { en: "Revelation", es: "Apocalipsis" }, "apocalipsis": { en: "Revelation", es: "Apocalipsis" }, "apoc": { en: "Revelation", es: "Apocalipsis" }
};

// Client-side parser for scripture references - Extracts and Formats verses
function parseScriptureReferences(rawText) {
  if (!rawText || rawText.trim() === '') return { type: 'empty', sections: [] };

  // Improved Pattern:
  // - Handles optional leading numbers (1 Cor)
  // - Handles "S." prefix (S. Juan)
  // - Handles optional trailing dot in book name
  // - Handles en-dash (–), em-dash (—) and hyphen (-) for ranges
  // - EXHAUSTIVE MODE: Matches globally (/g) and case-insensitive (/i)
  const versePattern = /\b(([1-3]\s)?(?:S\.\s)?(?:[A-ZÁ-Úa-zá-ú][a-zá-ú]{1,10}\.?))\s+(\d{1,3}):(\d{1,3})([–—-](\d{1,3}))?(:(\d{1,3}))?/gi;
  
  const verses = [];
  const seenRefs = new Set(); // Deduplicate
  
  // Search entire text for verse patterns
  const matches = [...rawText.matchAll(versePattern)];
  
  matches.forEach(match => {
    // Clean up the matched reference - strip any trailing words that aren't part of the verse
    // The regex may capture trailing characters; we only want Book Chapter:Verse[-Verse]
    const fullMatch = match[0].trim();
    const bookRaw = match[1].trim().replace(/\.$/, ''); // Remove trailing dot
    
    // Extract only the chapter:verse portion (with optional range), discard anything else
    const chapterVerseMatch = fullMatch.substring(match[1].length).trim().match(/^(\d{1,3}:\d{1,3}(?:[–—-]\d{1,3})?(?::\d{1,3})?)/);
    if (!chapterVerseMatch) return; // Skip if no valid chapter:verse found
    
    const restOfRef = chapterVerseMatch[1].replace(/[–—]/g, '-'); 
    
    // Normalize book name to find in map
    const bookLower = bookRaw.toLowerCase().replace(/\./g, '');
    
    // Filter out false positives (common words that look like book names)
    const blacklist = ['y', 'es', 'en', 'el', 'la', 'de', 'a', 'por', 'con', 'sin', 'mi', 'tu', 'su', 'nos', 'os'];
    if (blacklist.includes(bookLower)) return;

    let formattedContent = fullMatch.replace(/[–—]/g, '-'); // Default to cleaned up original
    let foundMatch = false;

    // 1. Exact Match Lookup
    if (BIBLE_BOOKS[bookLower]) {
      const { en, es } = BIBLE_BOOKS[bookLower];
      formattedContent = `${en} ${restOfRef} | ${es} ${restOfRef}`;
      foundMatch = true;
    } 
    // 2. Fuzzy / Starts-with Lookup (Fallback)
    else {
      // Find a key that starts with the input (for cases like "Génes" -> "Génesis")
      // Only do this for inputs >= 3 chars to avoid false positives on short abbreviations
      if (bookLower.length >= 3) {
        const matchedKey = Object.keys(BIBLE_BOOKS).find(key => key.startsWith(bookLower) || bookLower.startsWith(key));
        if (matchedKey) {
          const { en, es } = BIBLE_BOOKS[matchedKey];
          formattedContent = `${en} ${restOfRef} | ${es} ${restOfRef}`;
          foundMatch = true;
        }
      }
    }
    
    // If it doesn't match any known book, discard it (fixes "Domingo 9:30" bug)
    if (!foundMatch) return;

    // Create clean reference key for deduplication (Book + chapter:verse)
    const cleanRef = `${bookRaw} ${restOfRef}`;
    
    // Only add if not already seen
    if (!seenRefs.has(cleanRef)) {
      seenRefs.add(cleanRef);
      verses.push({
        type: 'verse',
        content: formattedContent,
        original: cleanRef
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

  // Reset state when initialText changes
  useEffect(() => {
    setRawText(initialText);
    setParsedData(null);
  }, [initialText]);

  const texts = {
    es: {
      title: "Procesar Contenido del Mensaje",
      inputLabel: "Contenido a procesar (Texto o Referencias)",
      inputPlaceholder: "Pega aquí las notas del orador o las referencias bíblicas...\n\nLa IA extraerá:\n1. Los puntos clave del mensaje\n2. Las referencias bíblicas estructuradas",
      parseBtn: "Extraer Puntos Clave y Versículos",
      parsing: "Analizando contenido...",
      saveBtn: "Guardar Contenido Procesado",
      cancelBtn: "Cerrar",
      resultTitle: "Resultado del Análisis",
      verseList: "Referencias Bíblicas Extraídas",
      noData: "Haz clic en 'Extraer' para analizar el texto.",
    },
    en: {
      title: "Process Message Content",
      inputLabel: "Content to process (Text or References)",
      inputPlaceholder: "Paste speaker notes or scripture references here...\n\nAI will extract:\n1. Key takeaways from the message\n2. Structured scripture references",
      parseBtn: "Extract Key Points & Verses",
      parsing: "Analyzing content...",
      saveBtn: "Save Processed Content",
      cancelBtn: "Close",
      resultTitle: "Analysis Result",
      verseList: "Extracted Scripture References",
      noData: "Click 'Extract' to analyze the text.",
    }
  };

  const t = texts[language] || texts.es;

  const handleParse = async () => {
    setIsParsing(true);
    
    // Provide immediate feedback with local regex
    const localResult = parseScriptureReferences(rawText);
    setParsedData(localResult);
    
    try {
      const prompt = `
        You are an expert sermon analysis assistant. Analyze the following speaker notes.
        
        1. Extract the main key takeaways (3-5 bullet points). Language: ${language === 'es' ? 'Spanish' : 'English'}.
        2. Identify all actual biblical scripture references mentioned. 
           IGNORE times, dates, or random numbers (e.g., "Domingo 9:30", "11:30").
           Format the scripture references EXACTLY as "Book Chapter:Verse | Libro Capítulo:Versículo" (English | Spanish).
           If there are no verses, return an empty array for verses.
        
        Notes to analyze:
        """
        ${rawText}
        """
      `;

      const aiResponse = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        response_json_schema: {
          type: "object",
          properties: {
            verses: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  content: { type: "string", description: "Format: English Book Ch:Vs | Spanish Book Ch:Vs" }
                }
              }
            },
            key_takeaways: {
              type: "array",
              items: { type: "string" }
            }
          },
          required: ["verses", "key_takeaways"]
        }
      });

      const aiVerses = aiResponse?.verses?.map(v => ({ type: 'verse', content: v.content })) || [];
      const aiTakeaways = aiResponse?.key_takeaways || [];
      
      const finalVerses = aiVerses.length > 0 ? aiVerses : localResult.sections;

      setParsedData({
        type: finalVerses.length > 0 ? 'verse_list' : (aiTakeaways.length > 0 ? 'empty' : 'empty'),
        sections: finalVerses,
        key_takeaways: aiTakeaways
      });

    } catch (error) {
      console.error("AI parsing failed:", error);
      // Keep localResult if AI fails
    } finally {
      setIsParsing(false);
    }
  };

  const handleSave = () => {
    if (parsedData && onSave) {
      // Create a formatted string for the main verse field too, 
      // by joining all formatted sections with newlines
      const formattedString = parsedData.sections.map(s => s.content).join('\n');
      
      onSave({
        parsed_data: parsedData,
        // Optionally update the raw verse text field with the formatted version if desired by the caller
        // usually passed as `verse` or `scripture_references`
        verse: formattedString 
      });
    }
    onOpenChange(false);
  };

  const renderParsedContent = () => {
    if (!parsedData) return <p className="text-gray-500 text-sm italic text-center py-8">{t.noData}</p>;

    if (parsedData.type === 'empty') {
      if (parsedData.key_takeaways && parsedData.key_takeaways.length > 0) {
        return (
          <div className="text-center py-4 mb-2 border-b border-gray-100 pb-4">
            <p className="text-gray-500 text-sm italic">
              {language === 'es' ? 'No se encontraron referencias bíblicas, pero sí puntos clave.' : 'No scripture references found, but key points were extracted.'}
            </p>
          </div>
        );
      }
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
            <div key={idx} className="flex flex-col items-start gap-1 p-3 bg-green-50/50 rounded border border-green-100 hover:border-pdv-teal transition-colors shadow-sm">
               <div className="flex items-start gap-2 w-full">
                <span className="text-pdv-teal font-bold text-sm mt-0.5">{idx + 1}.</span>
                <span className="text-gray-900 text-sm flex-1 leading-relaxed">{item.content}</span>
               </div>
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

  // Render Key Takeaways if present
  const renderKeyTakeaways = () => {
    if (!parsedData || !parsedData.key_takeaways || parsedData.key_takeaways.length === 0) return null;

    return (
      <div className="mt-6 border-t pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <h4 className="font-bold text-sm text-gray-900">
            {language === 'es' ? 'Puntos Clave (IA)' : 'Key Takeaways (AI)'}
          </h4>
        </div>
        <div className="space-y-2">
          {parsedData.key_takeaways.map((point, idx) => (
            <div key={idx} className="flex items-start gap-2 p-2 bg-amber-50 rounded border border-amber-100 text-sm text-amber-900">
              <span className="font-bold text-amber-600 select-none">•</span>
              <span>{point}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-white overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-pdv-teal" />
            {t.title}
          </DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6 flex-1 overflow-hidden p-1">
          {/* Input Side */}
          <div className="flex flex-col gap-2 min-h-0">
            <label className="text-sm font-semibold text-gray-900">{t.inputLabel}</label>
            <div className="flex-1 relative flex flex-col min-h-0">
              <Textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={t.inputPlaceholder}
                className="flex-1 min-h-[200px] text-sm p-4 resize-none bg-gray-50 border-gray-200 focus:bg-white transition-colors"
              />
              {initialText && rawText === initialText && (
                <div className="absolute bottom-3 left-3 right-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-2 flex gap-2 items-start shadow-sm">
                    <span className="text-blue-500 text-lg leading-none">💡</span>
                    <p className="text-[10px] text-blue-700 leading-snug">
                      {language === 'es' 
                        ? 'Este es el contenido original enviado por el orador. Puedes editarlo antes de procesarlo, o simplemente presionar "Extraer y Formatear".' 
                        : 'This is the original content submitted by the speaker. You can edit it before processing, or just click "Extract & Format".'}
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            <Button
              onClick={handleParse}
              disabled={!rawText.trim() || isParsing}
              style={{ backgroundColor: '#1F8A70', color: '#ffffff' }}
              className="w-full font-semibold shadow-sm mt-2"
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
            <ScrollArea className="flex-1 border-2 border-gray-200 rounded-lg p-4 bg-gray-50 min-h-[200px]">
              {renderParsedContent()}
              {renderKeyTakeaways()}
            </ScrollArea>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t mt-2">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="border-2 border-gray-300 hover:bg-gray-100 text-gray-700"
          >
            {t.cancelBtn}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!parsedData || parsedData.type === 'empty'}
            style={{ backgroundColor: '#8DC63F', color: '#ffffff' }}
            className="font-semibold shadow-sm hover:brightness-110"
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
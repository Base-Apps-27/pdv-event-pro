import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// SAFETY NET: Scheduled job that processes any SpeakerSubmissionVersion records stuck in 'pending'.
// Catches submissions where the primary automation (processNewSubmissionVersion) failed to trigger.
// Handles both Event (numeric Segment ID) and Weekly (composite ID) paths.
//
// BIBLE_BOOKS + parseScriptureReferences: inline copy (Deno Deploy cannot share modules)
// CANONICAL SOURCE: parseScriptureShared.ts
// SYNC: If you change the parser, update all 3 copies + parseScriptureShared.
// Files: processNewSubmissionVersion.ts, processPendingSubmissions.ts, processSegmentSubmission.ts
const BIBLE_BOOKS = {
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

function parseScriptureReferences(rawText) {
  if (!rawText || rawText.trim() === '') return { type: 'empty', sections: [] };
  const versePattern = /\b(([1-3]\s)?(?:S\.\s)?(?:[A-ZÁ-Úa-zá-ú][a-zá-ú]{1,10}\.?))\s+(\d{1,3})\s*:\s*(\d{1,3})([–—-](\d{1,3}))?(:(\d{1,3}))?/gi;
  const verses = [];
  const seenRefs = new Set();
  const matches = [...rawText.matchAll(versePattern)];
  
  matches.forEach(match => {
    const fullMatch = match[0].trim();
    const bookRaw = match[1].trim().replace(/\.$/, '');
    const numbersPart = fullMatch.substring(match[1].length).trim().replace(/\s*:\s*/g, ':');
    const chapterVerseMatch = numbersPart.match(/^(\d{1,3}:\d{1,3}(?:[–—-]\d{1,3})?(?::\d{1,3})?)/);
    if (!chapterVerseMatch) return;
    
    const restOfRef = chapterVerseMatch[1].replace(/[–—]/g, '-'); 
    const bookLower = bookRaw.toLowerCase().replace(/\./g, '');
    const blacklist = ['y', 'es', 'en', 'el', 'la', 'de', 'a', 'por', 'con', 'sin', 'mi', 'tu', 'su', 'nos', 'os'];
    if (blacklist.includes(bookLower)) return;

    let formattedContent = fullMatch.replace(/[–—]/g, '-');
    
    if (BIBLE_BOOKS[bookLower]) {
      const { en, es } = BIBLE_BOOKS[bookLower];
      formattedContent = `${en} ${restOfRef} | ${es} ${restOfRef}`;
    } else {
      if (bookLower.length >= 3) {
        const matchedKey = Object.keys(BIBLE_BOOKS).find(key => key.startsWith(bookLower) || bookLower.startsWith(key));
        if (matchedKey) {
          const { en, es } = BIBLE_BOOKS[matchedKey];
          formattedContent = `${en} ${restOfRef} | ${es} ${restOfRef}`;
        }
      }
    }
    
    const cleanRef = `${bookRaw} ${restOfRef}`;
    if (!seenRefs.has(cleanRef)) {
      seenRefs.add(cleanRef);
      verses.push({ type: 'verse', content: formattedContent, original: cleanRef });
    }
  });
  
  return { type: verses.length > 0 ? 'verse_list' : 'empty', sections: verses };
}
// --- END BIBLE PARSING ---

async function processSubmission(base44, submission) {
  console.log(`[PROCESS] Processing submission ${submission.id}...`);
  
  // Parse verses (Condition: Only if NOT slides only)
  let parsedData = { type: 'empty', sections: [] };
  let scriptureReferences = '';
  const isSlidesOnly = !!submission.content_is_slides_only;

  if (!isSlidesOnly) {
    parsedData = parseScriptureReferences(submission.content);
    if (parsedData.type === 'verse_list' && parsedData.sections.length > 0) {
      scriptureReferences = parsedData.sections.map(s => s.content).join('\n');
    }

    // 2026-03-01: Bilingual takeaways via LLM (safety net copy — Anti-Drift Protocol)
    // Kept in sync with submitWeeklyServiceContent + processNewSubmissionVersion.
    try {
      if (submission.content && submission.content.length > 100) {
        console.log(`[SAFETY_NET_LLM] Starting bilingual LLM extraction for ${submission.id}`);
        const prompt = `
You are an expert bilingual (English/Spanish) sermon analysis assistant.

STEP 1: Detect the primary language of the speaker notes below. It will be either English ("en") or Spanish ("es").

STEP 2: Extract the main key takeaways (3-5 bullet points) in BOTH English AND Spanish.
  - If the notes are in English, write the English takeaways first, then translate them to Spanish.
  - If the notes are in Spanish, write the Spanish takeaways first, then translate them to English.
  - Each takeaway should be a concise, complete sentence.

STEP 3: Identify all actual biblical scripture references mentioned.
   IGNORE times, dates, or random numbers (e.g., "Domingo 9:30", "11:30").
   Format each scripture reference EXACTLY as "Book Chapter:Verse | Libro Capítulo:Versículo" (English | Spanish).
   If there are no verses, return an empty array for verses.

Text to analyze:
${submission.content.substring(0, 15000)}`;

        const llmResponse = await base44.integrations.Core.InvokeLLM({
          prompt: prompt,
          response_json_schema: {
            type: "object",
            properties: {
              source_language: { type: "string", description: "Detected language: 'en' or 'es'" },
              key_takeaways_en: { type: "array", items: { type: "string" }, description: "Key takeaways in English" },
              key_takeaways_es: { type: "array", items: { type: "string" }, description: "Key takeaways in Spanish" },
              verses: { type: "array", items: { type: "object", properties: { content: { type: "string" } } } }
            },
            required: ["source_language", "key_takeaways_en", "key_takeaways_es", "verses"]
          }
        });

        const aiVerses = llmResponse?.verses?.map(v => ({ type: 'verse', content: v.content })) || [];
        const aiTakeawaysEn = llmResponse?.key_takeaways_en || [];
        const aiTakeawaysEs = llmResponse?.key_takeaways_es || [];
        const detectedLang = llmResponse?.source_language || 'es';

        // 2026-03-04 FIX: Only use LLM verses as FALLBACK when regex found nothing.
        // Regex produces properly bilingual output; LLM frequently duplicates same language.
        if (aiVerses.length > 0 && parsedData.sections.length === 0) {
          parsedData.sections = aiVerses;
          parsedData.type = 'verse_list';
          scriptureReferences = aiVerses.map(v => v.content).join('\n');
          console.log(`[SAFETY_NET_LLM] LLM provided ${aiVerses.length} verses (regex found none)`);
        } else if (aiVerses.length > 0) {
          console.log(`[SAFETY_NET_LLM] LLM found ${aiVerses.length} verses but regex has ${parsedData.sections.length} — keeping regex`);
        }
        parsedData.source_language = detectedLang;
        parsedData.key_takeaways_en = aiTakeawaysEn;
        parsedData.key_takeaways_es = aiTakeawaysEs;
        parsedData.key_takeaways = detectedLang === 'en' ? aiTakeawaysEn : aiTakeawaysEs;
        console.log(`[SAFETY_NET_LLM] lang=${detectedLang}, EN=${aiTakeawaysEn.length}, ES=${aiTakeawaysEs.length}`);
      }
    } catch (llmErr) {
      console.error(`[SAFETY_NET_LLM] Failed: ${llmErr.message}`);
    }
  }

  const segmentId = submission.segment_id;

  const PLENARIA_TYPES = ['message', 'plenaria', 'predica', 'mensaje'];
  const updateData = {
    submission_status: 'processed',
    parsed_verse_data: parsedData,
    scripture_references: scriptureReferences,
    presentation_url: submission.presentation_url || "",
    notes_url: submission.notes_url || "",
    content_is_slides_only: isSlidesOnly,
    ...(submission.title && submission.title.trim() !== "" ? { message_title: submission.title.trim() } : {}),
  };

  if (segmentId.startsWith('weekly_service|')) {
    // Use pre-resolved entity ID when available (set by submit function).
    // Falls back to composite ID resolution for older submissions.
    let resolvedEntityId = submission.resolved_segment_entity_id;
    let targetSegment;

    if (resolvedEntityId) {
      console.log(`[PROCESS] Using pre-resolved entity ID: ${resolvedEntityId}`);
      targetSegment = await base44.asServiceRole.entities.Segment.get(resolvedEntityId);
      if (!targetSegment) {
        console.warn(`[PROCESS] Pre-resolved entity ${resolvedEntityId} not found, falling back to composite resolution`);
        resolvedEntityId = null;
      }
    }

    if (!resolvedEntityId) {
      // Fallback: resolve from composite ID (3 queries)
      const parts = segmentId.split('|');
      const serviceId = parts[1];
      const timeSlot = parts[2];
      const segmentIdx = parseInt(parts[3]);

      const sessions = await base44.asServiceRole.entities.Session.filter({ service_id: serviceId });
      const targetSession = sessions.find(s => s.name === timeSlot);
      if (!targetSession) {
        await base44.asServiceRole.entities.SpeakerSubmissionVersion.update(submission.id, {
          processing_status: 'failed',
          processing_error: `Session not found for timeSlot ${timeSlot}`
        });
        return { success: false, id: submission.id, error: 'Session not found' };
      }

      const sessionSegments = await base44.asServiceRole.entities.Segment.filter(
        { session_id: targetSession.id }, 'order'
      );
      const candidate = sessionSegments[segmentIdx];
      targetSegment = (candidate && PLENARIA_TYPES.includes((candidate.segment_type || '').toLowerCase()))
        ? candidate
        : sessionSegments.find(s => PLENARIA_TYPES.includes((s.segment_type || '').toLowerCase())) || null;
    }

    if (!targetSegment) {
      await base44.asServiceRole.entities.SpeakerSubmissionVersion.update(submission.id, {
        processing_status: 'failed',
        processing_error: 'No message-type Segment found in session'
      });
      return { success: false, id: submission.id, error: 'Segment not found' };
    }

    // STALENESS GUARD: Before writing to Segment, check if a newer submission
    // for this same segment was already processed. Prevents an older pending record
    // from overwriting content written by a newer submission (race condition fix).
    // Check both resolved_segment_entity_id AND segment_id to catch legacy rows
    // and mirror records where resolved_segment_entity_id may be unset.
    const newerByResolved = await base44.asServiceRole.entities.SpeakerSubmissionVersion.filter(
      { resolved_segment_entity_id: targetSegment.id, processing_status: 'processed' },
      '-submitted_at', 1
    );
    // Use the original composite segment_id (e.g. "weekly_service|..."), NOT the
    // resolved entity ID — weekly SpeakerSubmissionVersion rows store the composite key.
    const newerBySegmentId = await base44.asServiceRole.entities.SpeakerSubmissionVersion.filter(
      { segment_id: segmentId, processing_status: 'processed' },
      '-submitted_at', 1
    );
    const newerCandidates = [...newerByResolved, ...newerBySegmentId]
      .filter(r => r.id !== submission.id && r.submitted_at && submission.submitted_at && r.submitted_at > submission.submitted_at);
    if (newerCandidates.length > 0) {
      console.log(`[PROCESS] SUPERSEDED: submission ${submission.id} (${submission.submitted_at}) is older than already-processed ${newerCandidates[0].id} (${newerCandidates[0].submitted_at}) — skipping Segment write`);
      await base44.asServiceRole.entities.SpeakerSubmissionVersion.update(submission.id, {
        parsed_data_snapshot: parsedData,
        processing_status: 'superseded'
      });
      return { success: true, id: submission.id, superseded: true };
    }

    await base44.asServiceRole.entities.Segment.update(targetSegment.id, updateData);
    console.log(`[PROCESS] Updated Segment entity ${targetSegment.id} for weekly submission ${submission.id}`);

  } else {
    // Event: direct Segment entity update
    const currentSegment = await base44.asServiceRole.entities.Segment.get(segmentId);
    if (currentSegment) {
      // STALENESS GUARD: check both segment_id and resolved_segment_entity_id
      const newerBySegId = await base44.asServiceRole.entities.SpeakerSubmissionVersion.filter(
        { segment_id: segmentId, processing_status: 'processed' },
        '-submitted_at', 1
      );
      const newerByResId = await base44.asServiceRole.entities.SpeakerSubmissionVersion.filter(
        { resolved_segment_entity_id: segmentId, processing_status: 'processed' },
        '-submitted_at', 1
      );
      const newerEventCandidates = [...newerBySegId, ...newerByResId]
        .filter(r => r.id !== submission.id && r.submitted_at && submission.submitted_at && r.submitted_at > submission.submitted_at);
      if (newerEventCandidates.length > 0) {
        console.log(`[PROCESS] SUPERSEDED: submission ${submission.id} (${submission.submitted_at}) is older than already-processed ${newerEventCandidates[0].id} (${newerEventCandidates[0].submitted_at}) — skipping Segment write`);
        await base44.asServiceRole.entities.SpeakerSubmissionVersion.update(submission.id, {
          parsed_data_snapshot: parsedData,
          processing_status: 'superseded'
        });
        return { success: true, id: submission.id, superseded: true };
      }

      await base44.asServiceRole.entities.Segment.update(segmentId, updateData);
      console.log(`[PROCESS] Updated Segment ${segmentId} for submission ${submission.id}`);
    }
  }

  // Update the submission record
  await base44.asServiceRole.entities.SpeakerSubmissionVersion.update(submission.id, {
    parsed_data_snapshot: parsedData,
    processing_status: 'processed'
  });

  return { success: true, id: submission.id };
}

Deno.serve(async (req) => {
  try {
    console.log("[SCHEDULED] Processing pending submissions...");
    const base44 = createClientFromRequest(req);

    // Fetch all pending submissions
    const pendingSubmissions = await base44.asServiceRole.entities.SpeakerSubmissionVersion.filter({
      processing_status: 'pending'
    });

    console.log(`[SCHEDULED] Found ${pendingSubmissions.length} pending submissions`);

    if (pendingSubmissions.length === 0) {
      return Response.json({ message: 'No pending submissions', processed: 0 });
    }

    const results = [];
    for (const submission of pendingSubmissions) {
      try {
        const result = await processSubmission(base44, submission);
        results.push(result);
      } catch (err) {
        console.error(`[SCHEDULED] Error processing ${submission.id}:`, err.message);
        results.push({ success: false, id: submission.id, error: err.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[SCHEDULED] Processed ${successCount}/${pendingSubmissions.length} submissions`);

    return Response.json({
      message: 'Processing complete',
      processed: successCount,
      failed: pendingSubmissions.length - successCount,
      results
    });

  } catch (error) {
    console.error("[SCHEDULED] Fatal error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
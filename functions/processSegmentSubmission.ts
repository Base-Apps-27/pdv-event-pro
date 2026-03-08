import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ADMIN REPROCESSING ENDPOINT for speaker submissions.
// Called on-demand from MessageProcessing.jsx admin UI (NOT by entity automation).
// Use case: admin manually reprocesses a submission after edits, or retries a failed one.
// The primary processing automation is processNewSubmissionVersion (on SpeakerSubmissionVersion.create).
//
// Accepts two invocation patterns:
//   1. Direct invoke: { segmentId } — looks up latest SpeakerSubmissionVersion for content
//   2. Legacy entity automation: { event: { entity_id }, data } — still handled for backward compat
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
  "fil": { en: "Philippians", es: "Filipenses" }, "php": { en: "Philippians", es: "Filipenses" }, "philippians": { en: "Philippians", es: "Filipenses" }, "filipenses": { en: "Philippians", es: "Filipenses" }, "fili": { en: "Philippians", es: "Filipenses" }, "filip": { en: "Philippians", es: "Filipenses" },
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

// Admin reprocessing endpoint for speaker submissions.
// Accepts: { segmentId } (direct invoke) or { event: { entity_id } } (legacy automation compat)
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    // Resolve segmentId from either invocation pattern
    const segmentId = payload.segmentId || payload.event?.entity_id;
    if (!segmentId) {
      return Response.json({ error: 'Missing segmentId' }, { status: 400 });
    }

    // Always fetch fresh segment data
    const liveSegment = await base44.asServiceRole.entities.Segment.get(segmentId);
    if (!liveSegment) {
      return Response.json({ error: `Segment ${segmentId} not found` }, { status: 404 });
    }

    console.log(`[PROCESS_SEGMENT] Processing segment ${segmentId} (unified weekly + event speaker pipeline)`);

    let parsedData = { type: 'empty', sections: [] };
    let scriptureReferences = '';

    // Only parse if NOT slides-only mode AND has submitted_content (from SpeakerSubmissionVersion or Segment)
    if (!liveSegment.content_is_slides_only) {
      // Fetch audit record to get original content (speaker submission path)
      const auditRecords = await base44.asServiceRole.entities.SpeakerSubmissionVersion.filter(
        { segment_id: segmentId, processing_status: 'pending' },
        '-submitted_at', 1
      );

      // Determine content source: SpeakerSubmissionVersion (events) OR Segment.submitted_content (weekly)
      let content = '';
      let submission = null;
      
      if (auditRecords.length > 0) {
        // Speaker submission path (public form)
        submission = auditRecords[0];
        content = submission.content || '';
      } else if (liveSegment.submitted_content) {
        // Weekly submission path (submitWeeklyServiceContent)
        content = liveSegment.submitted_content;
      }

      if (content) {

        // STEP 1: Regex verse parsing
        console.log(`[PROCESS_SEGMENT] Parsing verses via regex...`);
        parsedData = parseScriptureReferences(content);
        if (parsedData.type === 'verse_list' && parsedData.sections.length > 0) {
          scriptureReferences = parsedData.sections.map(s => s.content).join('\n');
        }

        // STEP 2: LLM extraction (bilingual takeaways + fallback verses)
        // Threshold: only call LLM if content is substantial enough to have real takeaways.
        // A bare Bible reference (~10-50 chars) should never produce takeaways.
        // 300 chars ≈ 2+ meaningful sentences — minimum viable sermon content.
        if (content.length > 300) {
          try {
            console.log(`[PROCESS_SEGMENT] Starting bilingual LLM extraction...`);
            const prompt = `
You are an expert bilingual (English/Spanish) sermon analysis assistant.
Your job is to extract information that is EXPLICITLY PRESENT in the text. Do NOT infer, interpret, or generate content that isn't clearly stated.

STEP 1: Detect the primary language of the speaker notes below. It will be either English ("en") or Spanish ("es").

STEP 2: Extract key takeaways from the text in BOTH English AND Spanish.
  CRITICAL RULES:
  - Only extract takeaways if the text contains actual sermon content (explanations, teachings, points, arguments).
  - If the text contains ONLY a Bible reference, a title, or a single short phrase with no explanatory content, return EMPTY arrays for both languages.
  - If there is enough content, extract 2-5 takeaways. If there are only 1-2 clear points, return only those — do not pad to reach a minimum count.
  - Do NOT create, infer, or synthesize points that are not explicitly in the text.
  - Each takeaway must be directly supported by the submitted text.

STEP 3: Identify all actual biblical scripture references mentioned.
   IGNORE times, dates, or random numbers (e.g., "Domingo 9:30", "11:30").
   Format each scripture reference EXACTLY as "Book Chapter:Verse | Libro Capítulo:Versículo" (English | Spanish).
   If there are no verses, return an empty array for verses.

Text to analyze:
${content.substring(0, 15000)}`;

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

            // Use LLM verses only as FALLBACK
            if (aiVerses.length > 0 && parsedData.sections.length === 0) {
              parsedData.sections = aiVerses;
              parsedData.type = 'verse_list';
              scriptureReferences = aiVerses.map(v => v.content).join('\n');
              console.log(`[PROCESS_SEGMENT] LLM provided ${aiVerses.length} verses (regex found none)`);
            }

            // Store bilingual takeaways
            parsedData.source_language = detectedLang;
            parsedData.key_takeaways_en = aiTakeawaysEn;
            parsedData.key_takeaways_es = aiTakeawaysEs;
            parsedData.key_takeaways = detectedLang === 'en' ? aiTakeawaysEn : aiTakeawaysEs;
            console.log(`[PROCESS_SEGMENT] Detected lang=${detectedLang}, EN=${aiTakeawaysEn.length}, ES=${aiTakeawaysEs.length}`);
          } catch (llmErr) {
            // FIX (2026-03-07): Log LLM failures for coordinator visibility, do NOT fail processing
            console.error(`[PROCESS_SEGMENT] LLM extraction failed: ${llmErr.message}`);
            parsedData.llm_error = llmErr.message;
            parsedData.llm_status = 'failed_fallback_to_regex';
            // Fallback to regex-only — processing continues
          }
        }

        // Update Segment entity with processed data (FIX: explicit status tracking)
        try {
          await base44.asServiceRole.entities.Segment.update(segmentId, {
            parsed_verse_data: parsedData,
            scripture_references: scriptureReferences,
            submission_status: 'processed'
          });
          console.log(`[PROCESS_SEGMENT] Segment ${segmentId} marked as processed`);
        } catch (segmentUpdateErr) {
          console.error(`[PROCESS_SEGMENT] CRITICAL: Failed to update segment status: ${segmentUpdateErr.message}`);
          // Try to mark as failed in audit trail
          try {
            await base44.asServiceRole.entities.SpeakerSubmissionVersion.update(submission.id, {
              processing_status: 'failed',
              error_message: `Segment update failed: ${segmentUpdateErr.message}`
            });
          } catch (auditErr) {
            console.error(`[PROCESS_SEGMENT] Could not record failure in audit: ${auditErr.message}`);
          }
          throw segmentUpdateErr;
        }

        // Update audit record ONLY if it exists (speaker submission path)
        if (submission) {
          try {
            await base44.asServiceRole.entities.SpeakerSubmissionVersion.update(submission.id, {
              processing_status: 'processed',
              parsed_data_snapshot: parsedData,
              processed_at: new Date().toISOString()
            });
          } catch (auditErr) {
            console.error(`[PROCESS_SEGMENT] Warning: Failed to update audit record: ${auditErr.message}`);
            // Non-critical — segment was already updated
          }
        }

        console.log(`[PROCESS_SEGMENT] Segment ${segmentId} processed successfully`);
      } else {
        console.log(`[PROCESS_SEGMENT] No content found for ${segmentId} (neither SpeakerSubmissionVersion nor submitted_content)`);
      }
    } else {
      console.log(`[PROCESS_SEGMENT] Slides-only mode — marking processed without parsing`);
      await base44.asServiceRole.entities.Segment.update(segmentId, {
        submission_status: 'processed'
      });
    }

    // Trigger cache rebuild so coordinators see updates immediately
    try {
      await base44.asServiceRole.functions.invoke('refreshActiveProgram', {
        trigger: 'segment_submission_processed',
        changedEntityType: 'Segment',
        changedEntityId: segmentId
      });
    } catch (cacheErr) {
      console.error(`[PROCESS_SEGMENT] Cache refresh failed (non-critical): ${cacheErr.message}`);
    }

    return Response.json({ success: true, processed: segmentId });
  } catch (error) {
    console.error(`[PROCESS_SEGMENT] Error: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
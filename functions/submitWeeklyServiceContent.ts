import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// v3.0 - INLINE PROCESSING: Parse verses directly in submit function.
// Eliminates dependency on unreliable entity automation (82% failure rate).
// SpeakerSubmissionVersion still created for audit trail, marked 'processed' immediately.
// Safety net (processPendingSubmissions) remains as defense-in-depth.

// Rate Limiter
const rateLimiter = new Map();

// CTO-1 (2026-03-02): Verse parsing centralized in parseScriptureShared.
// VERSION_HASH: v1.0-2026-03-02 (must match parseScriptureShared)
// DEPRECATED INLINE COPY BELOW — kept as fallback for this submission handler.
// Future work: replace inline calls with base44.asServiceRole.functions.invoke('parseScriptureShared').
// ╔══════════════════════════════════════════════════════════════════════╗
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
    let foundMatch = false;
    
    if (BIBLE_BOOKS[bookLower]) {
      const { en, es } = BIBLE_BOOKS[bookLower];
      formattedContent = `${en} ${restOfRef} | ${es} ${restOfRef}`;
      foundMatch = true;
    } else {
      if (bookLower.length >= 3) {
        const matchedKey = Object.keys(BIBLE_BOOKS).find(key => key.startsWith(bookLower) || bookLower.startsWith(key));
        if (matchedKey) {
          const { en, es } = BIBLE_BOOKS[matchedKey];
          formattedContent = `${en} ${restOfRef} | ${es} ${restOfRef}`;
          foundMatch = true;
        }
      }
    }
    
    if (!foundMatch) return;
    
    const cleanRef = `${bookRaw} ${restOfRef}`;
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
// --- BIBLE PARSING LOGIC END ---

Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    // SEC-3/4 (2026-03-02): Dual-layer rate limiting.
    // Layer 1: In-memory (fast, resets on cold start).
    // Layer 2: Entity-based (persistent, see below after base44 init).
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    if (!rateLimiter.has(clientIp)) rateLimiter.set(clientIp, []);
    const attempts = rateLimiter.get(clientIp).filter(t => now - t < 60000);
    if (attempts.length >= 5) return Response.json({ error: 'Too many requests' }, { status: 429, headers: corsHeaders });
    attempts.push(now);
    rateLimiter.set(clientIp, attempts);

    try {
        const base44 = createClientFromRequest(req);

        // ── PAYLOAD SIZE GUARD (2026-03-03: parity with submitArtsSegment) ──
        // Prevents blob injection. Weekly submissions are text + URLs, 100KB is generous.
        const rawBody = await req.text();
        const MAX_BODY_SIZE = 100_000; // 100KB
        if (rawBody.length > MAX_BODY_SIZE) {
            console.warn(`[WeeklySubmission] Payload too large: ${rawBody.length} bytes from ${clientIp}`);
            return Response.json({ error: 'Payload too large' }, { status: 413, headers: corsHeaders });
        }
        const body = JSON.parse(rawBody);

        const { segment_id, content, title, presentation_url, notes_url, content_is_slides_only, idempotencyKey, device_info } = body;
        // Dynamic mirror targets: array of composite IDs to also receive this submission
        // Backward compat: legacy apply_to_both_services boolean still works
        const mirror_target_ids = body.mirror_target_ids || [];
        const apply_to_both_services = body.apply_to_both_services || false;

        // ── HONEYPOT CHECK (2026-02-28) ──
        // Hidden "website" field that humans never fill. Bots get fake success.
        if (body.website) {
            console.warn(`[WeeklySubmission] Honeypot triggered from ${clientIp}`);
            return Response.json({ success: true }, { headers: corsHeaders });
        }

        // ── URL FIELD VALIDATION (2026-03-03: parity with submitArtsSegment SEC-6) ──
        // Only http/https schemes allowed. Blocks javascript:, data:, file: injection.
        const URL_FIELDS_TO_CHECK = { presentation_url, notes_url };
        for (const [fieldName, val] of Object.entries(URL_FIELDS_TO_CHECK)) {
            if (val && typeof val === 'string' && val.trim() !== '') {
                const trimmed = val.trim().toLowerCase();
                if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
                    return Response.json(
                        { error: `Invalid URL in field "${fieldName}". Only http/https URLs are allowed.` },
                        { status: 400, headers: corsHeaders }
                    );
                }
            }
        }

        // Layer 2: Entity-based persistent rate limit (SEC-3/4, 2026-03-02).
        // FIX (2026-03-02): Scoped to segment_id (site_id field) to prevent global false positives.
        // Originally queried ALL weekly submissions globally — 10 different users submitting
        // to 10 different segments in 2 min would trigger the limit for everyone.
        const twoMinAgo = new Date(Date.now() - 120000).toISOString();
        const recentForSegment = await base44.asServiceRole.entities.PublicFormIdempotency.filter(
            { form_type: 'weekly_service_submission', site_id: segment_id, created_date: { $gte: twoMinAgo } },
            '-created_date', 20
        );
        if (recentForSegment.length >= 5) {
            console.warn(`[WeeklySubmission] Entity rate limit hit: ${recentForSegment.length} submissions for ${segment_id} in 2min`);
            return Response.json({ error: 'Too many requests. Please wait.' }, { status: 429, headers: corsHeaders });
        }

        if (!segment_id) {
            return Response.json({ error: "Missing required fields: segment_id" }, { status: 400, headers: corsHeaders });
        }
        // Slides-only mode allows empty content (presentation URL replaces verse text)
        if (!content_is_slides_only && !content) {
            return Response.json({ error: "Missing content (required unless slides-only mode)" }, { status: 400, headers: corsHeaders });
        }

        // Idempotency Check
        if (idempotencyKey) {
            const existing = await base44.asServiceRole.entities.PublicFormIdempotency.filter({ idempotency_key: idempotencyKey });
            if (existing.length > 0 && existing[0].status === 'succeeded') {
                return Response.json(existing[0].response_payload, { headers: corsHeaders });
            }
            if (existing.length === 0) {
                await base44.asServiceRole.entities.PublicFormIdempotency.create({
                    idempotency_key: idempotencyKey,
                    form_type: 'weekly_service_submission',
                    status: 'processing',
                    site_id: segment_id
                });
            }
        }

        // Validate composite ID format
        if (!segment_id.startsWith('weekly_service|')) {
            return Response.json({ error: "Invalid ID format for this endpoint" }, { status: 400, headers: corsHeaders });
        }

        const parts = segment_id.split('|');
        if (parts.length < 5) return Response.json({ error: "Invalid composite ID" }, { status: 400, headers: corsHeaders });
        
        const [_, serviceId, timeSlot, segmentIdxStr, type] = parts;
        const segmentIdx = parseInt(segmentIdxStr);

        // Fetch Service (needed for fallback path + audit)
        const service = await base44.asServiceRole.entities.Service.get(serviceId);
        if (!service) return Response.json({ error: "Service not found" }, { status: 404, headers: corsHeaders });

        // ENTITY-FIRST SEGMENT RESOLUTION (2026-02-21)
        // Entity-backed services (post-syncWeeklyToSessions) no longer store segment data
        // in Service JSON slots — extractServiceMetadata strips them before save.
        // Primary path: resolve Segment entity via Session.
        // Legacy path: Service JSON slot (pre-entity-lift services only).
        const PLENARIA_TYPES = ['plenaria', 'message', 'predica', 'mensaje'];
        let targetSegmentEntity = null;
        let allSessionsForService = null;

        try {
            allSessionsForService = await base44.asServiceRole.entities.Session.filter({ service_id: serviceId });
            const targetSession = allSessionsForService.find(s => s.name === timeSlot);
            if (targetSession) {
                const segs = await base44.asServiceRole.entities.Segment.filter({ session_id: targetSession.id }, 'order');
                // Try exact position first (composite ID embeds the Plenaria's index in session segments)
                const candidate = segs[segmentIdx];
                if (candidate && PLENARIA_TYPES.includes((candidate.segment_type || '').toLowerCase())) {
                    targetSegmentEntity = candidate;
                } else {
                    // Position mismatch (segment reorder since form was loaded) — use first Plenaria
                    targetSegmentEntity = segs.find(s => PLENARIA_TYPES.includes((s.segment_type || '').toLowerCase())) || null;
                }
            }
        } catch (entityLookupErr) {
            console.warn("[ENTITY_FIRST] Session/Segment lookup failed, falling back to Service JSON:", entityLookupErr.message);
        }

        // Resolve segment for validation (entity path or legacy JSON fallback)
        const segment = targetSegmentEntity || service[timeSlot]?.[segmentIdx];
        if (!segment) return Response.json({ error: "Segment not found in service" }, { status: 404, headers: corsHeaders });
        const segType = (targetSegmentEntity?.segment_type || segment.type || "").toLowerCase();
        if (!PLENARIA_TYPES.includes(segType)) {
            return Response.json({ error: "Invalid segment type. Only messages accept submissions." }, { status: 400, headers: corsHeaders });
        }

        // 2026-03-07: SUBMISSION ONLY MODE (DECISION-007)
        // No inline processing. Mark for async automation.
        // Coordinators: submission marked 'pending' triggers entity automation → async processing
        // Speakers: Rapid response, no LLM wait blocking submit

        let parsedData = { type: 'empty', sections: [] };
        let scriptureReferences = '';

        // Resolve base projection_notes from entity or JSON fallback
        let projectionNotes = targetSegmentEntity?.projection_notes || service[timeSlot]?.[segmentIdx]?.projection_notes || "";

        // Mark for pending processing, no inline LLM
        console.log("[SUBMIT] Marking submission as pending — async processing will follow");

        // Shared update payload for both entity and JSON paths
        const commonFields = {
            // Mark as pending — will be processed asynchronously by entity automation
            parsed_verse_data: parsedData,
            submission_status: 'pending',
            scripture_references: scriptureReferences,
            presentation_url: presentation_url || "",
            notes_url: notes_url || "",
            content_is_slides_only: !!content_is_slides_only,
            projection_notes: projectionNotes,
            ...(title?.trim() ? { message_title: title.trim() } : {}),
        };

        // Build effective mirror list (dynamic from form checkboxes + legacy backward compat)
        const effectiveMirrors = [...mirror_target_ids];
        if (apply_to_both_services && timeSlot === '9:30am' && effectiveMirrors.length === 0) {
            effectiveMirrors.push(segment_id.replace('|9:30am|', '|11:30am|'));
        }

        if (targetSegmentEntity) {
            // ── PRIMARY PATH: Entity-backed service ──
            // Write directly to Segment entity. No Service JSON write needed.
            console.log("[ENTITY_FIRST] Writing to Segment entity (primary path)");
            await base44.asServiceRole.entities.Segment.update(targetSegmentEntity.id, commonFields);
            console.log("[ENTITY_FIRST] Segment entity updated successfully");

            // Handle entity mirrors (sibling sessions in same service)
            for (const mirrorId of effectiveMirrors) {
                const mirrorParts = mirrorId.split('|');
                if (mirrorParts.length < 5) { console.warn("[MIRROR] Invalid mirror ID:", mirrorId); continue; }
                const [, mirrorSvcId, mirrorSlotName, mirrorIdxStr] = mirrorParts;
                if (mirrorSvcId !== serviceId) { console.warn("[MIRROR] Cross-service mirror skipped"); continue; }
                try {
                    const sessions = allSessionsForService || await base44.asServiceRole.entities.Session.filter({ service_id: serviceId });
                    const mirrorSession = sessions.find(s => s.name === mirrorSlotName);
                    if (!mirrorSession) continue;
                    const mirrorSegs = await base44.asServiceRole.entities.Segment.filter({ session_id: mirrorSession.id }, 'order');
                    const mirrorIdx = parseInt(mirrorIdxStr);
                    let mirrorTarget = mirrorSegs[mirrorIdx];
                    if (!mirrorTarget || !PLENARIA_TYPES.includes((mirrorTarget.segment_type || '').toLowerCase())) {
                        mirrorTarget = mirrorSegs.find(s => PLENARIA_TYPES.includes((s.segment_type || '').toLowerCase()));
                    }
                    if (mirrorTarget) {
                        // DO NOT append raw content to projection_notes (Embargo Policy)
                        await base44.asServiceRole.entities.Segment.update(mirrorTarget.id, {
                            ...commonFields,
                            // Preserve existing notes, do not append raw content
                            projection_notes: mirrorTarget.projection_notes || "",
                        });
                        console.log(`[MIRROR] Entity mirror updated: ${mirrorSlotName}`);
                    }
                } catch (mirrorErr) {
                    console.error("[MIRROR] Mirror entity update failed:", mirrorErr.message);
                }
            }
        } else {
            // ── LEGACY PATH: Pre-entity-lift service — write to Service JSON slot ──
            console.log("[LEGACY_PATH] No entity segment found, writing to Service JSON slot");
            const currentArray = [...(service[timeSlot] || [])];
            const currentSegment = currentArray[segmentIdx] || {};
            const updatedSegment = {
                ...currentSegment,
                ...commonFields,
                data: {
                    ...(currentSegment.data || {}),
                    verse: scriptureReferences,
                    scripture_references: scriptureReferences,
                    presentation_url: presentation_url || "",
                    notes_url: notes_url || "",
                    content_is_slides_only: !!content_is_slides_only,
                    ...(title?.trim() ? { message_title: title.trim() } : {}),
                },
            };
            currentArray[segmentIdx] = updatedSegment;
            const updatePayload = { [timeSlot]: currentArray };

            for (const mirrorId of effectiveMirrors) {
                const mirrorParts = mirrorId.split('|');
                if (mirrorParts.length < 5) { console.warn("[MIRROR] Invalid mirror ID:", mirrorId); continue; }
                const [, mirrorServiceId, mirrorSlot, mirrorIdxStr] = mirrorParts;
                if (mirrorServiceId !== serviceId) { console.warn("[MIRROR] Cross-service mirror skipped"); continue; }
                const mirrorIdx = parseInt(mirrorIdxStr);
                const otherArray = [...(service[mirrorSlot] || [])];
                let targetIdx = mirrorIdx;
                if (!otherArray[targetIdx] || !PLENARIA_TYPES.includes((otherArray[targetIdx]?.type || '').toLowerCase())) {
                    targetIdx = otherArray.findIndex(s => PLENARIA_TYPES.includes((s.type || '').toLowerCase()));
                }
                if (targetIdx === -1 || !otherArray[targetIdx]) { console.warn(`[MIRROR] No message segment in ${mirrorSlot}`); continue; }
                const otherSegment = otherArray[targetIdx];
                // DO NOT append raw content to projection_notes (Embargo Policy)
                otherArray[targetIdx] = {
                    ...otherSegment,
                    ...commonFields,
                    projection_notes: otherSegment.projection_notes || "",
                    data: {
                        ...(otherSegment.data || {}),
                        verse: scriptureReferences,
                        scripture_references: scriptureReferences,
                        presentation_url: presentation_url || "",
                        notes_url: notes_url || "",
                        content_is_slides_only: !!content_is_slides_only,
                        ...(title?.trim() ? { message_title: title.trim() } : {}),
                    },
                };
                updatePayload[mirrorSlot] = otherArray;
            }

            console.log("[LEGACY_PATH] Updating Service JSON...");
            await base44.asServiceRole.entities.Service.update(serviceId, updatePayload);
            console.log("[LEGACY_PATH] Service JSON updated successfully");
        }

        // Create Version Record for audit trail — marked as pending
        // Entity automation on Segment will trigger → processSegmentSubmission function
        // that performs verse parsing + LLM, then marks as 'processed'
        // Audit trail — primary submission
        console.log("[SUBMIT] Creating audit trail record (marked pending)...");
        await base44.asServiceRole.entities.SpeakerSubmissionVersion.create({
            segment_id: segment_id,
            content: content,
            title: title || "",
            presentation_url: presentation_url || "",
            notes_url: notes_url || "",
            content_is_slides_only: !!content_is_slides_only,
            parsed_data_snapshot: parsedData,
            submitted_at: new Date().toISOString(),
            source: 'weekly_service_form',
            processing_status: 'pending',
            // Browser/device metadata for audit trail
            ...(device_info ? { device_info } : {}),
        });

        // Audit trail — mirrored submissions (dynamic)
        for (const mirrorId of effectiveMirrors) {
            console.log(`[SUBMIT] Creating audit trail for mirrored submission: ${mirrorId}`);
            await base44.asServiceRole.entities.SpeakerSubmissionVersion.create({
                segment_id: mirrorId,
                content: content,
                title: title || "",
                presentation_url: presentation_url || "",
                notes_url: notes_url || "",
                content_is_slides_only: !!content_is_slides_only,
                parsed_data_snapshot: parsedData,
                submitted_at: new Date().toISOString(),
                source: 'weekly_service_form_mirror',
                processing_status: 'pending',
                // Same device_info for mirrored audit records
                ...(device_info ? { device_info } : {}),
            });
        }
        console.log("[SUBMIT] Audit record(s) created (pending async processing)");

        // Cache refresh happens after async processing completes
        // (via entity automation trigger in processSegmentSubmission)

        // Success
        const responsePayload = { success: true };
        if (idempotencyKey) {
            const existing = await base44.asServiceRole.entities.PublicFormIdempotency.filter({ idempotency_key: idempotencyKey });
            if (existing.length) {
                await base44.asServiceRole.entities.PublicFormIdempotency.update(existing[0].id, {
                    status: 'succeeded',
                    response_payload: responsePayload
                });
            }
        }

        return Response.json(responsePayload, { headers: corsHeaders });

    } catch (error) {
        console.error("[SUBMIT_ERROR]", error.message);
        return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }
});
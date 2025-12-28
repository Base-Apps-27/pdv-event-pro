// Text normalization utilities for consistent formatting

const titleAbbreviations = {
  'pastor': 'P.',
  'pastora': 'P.',
  'apostle': 'A.',
  'apóstol': 'A.',
  'apóstola': 'A.',
  'prophet': 'Pr.',
  'profeta': 'Pr.',
  'reverend': 'Rev.',
  'reverendo': 'Rev.',
  'reverenda': 'Rev.',
  'doctor': 'Dr.',
  'doctora': 'Dra.',
  'elder': 'Eld.',
  'anciano': 'Anc.',
  'anciana': 'Anc.',
  'bishop': 'Bp.',
  'obispo': 'Ob.',
  'obispa': 'Ob.',
  'minister': 'Min.',
  'ministro': 'Min.',
  'ministra': 'Min.',
  'deacon': 'Dcn.',
  'diácono': 'Dcn.',
  'diácona': 'Dcn.',
  'evangelist': 'Ev.',
  'evangelista': 'Ev.'
};

// Normalize a person's name with proper capitalization
export function normalizeName(name) {
  if (!name || typeof name !== 'string') return name;
  
  let trimmed = name.trim();
  if (!trimmed) return '';

  // Standardize separators: replace /, &, + with comma
  trimmed = trimmed.replace(/\s*[\/&+|]\s*/g, ', ');
  
  // Normalize spacing after commas
  trimmed = trimmed.replace(/\s*,\s*/g, ', ');

  // Split by spaces to handle capitalization
  const words = trimmed.toLowerCase().split(/\s+/);
  
  const normalized = words.map(word => {
    // Skip capitalization for connector words if they appear in the middle (optional, but good for "de", "la")
    // For now, we'll capitalize everything for consistency as requested, but handle specific titles
    
    // Check if it matches a title abbreviation
    const lowerWordClean = word.toLowerCase().replace(/[.,]/g, '');
    if (titleAbbreviations[lowerWordClean]) {
      return titleAbbreviations[lowerWordClean];
    }
    
    // Handle names with apostrophes (O'Brien, D'Angelo)
    if (word.includes("'")) {
      return word.split("'").map(part => 
        part.charAt(0).toUpperCase() + part.slice(1)
      ).join("'");
    }
    
    // Handle hyphenated names (Mary-Jane)
    if (word.includes('-')) {
      return word.split('-').map(part => 
        part.charAt(0).toUpperCase() + part.slice(1)
      ).join('-');
    }
    
    // Keep commas/periods attached to the word
    const firstChar = word.charAt(0).toUpperCase();
    const rest = word.slice(1);
    return firstChar + rest;
  }).join(' ');

  // Final cleanup: ensure space after comma if missing (though split/join handles most)
  return normalized.replace(/,([^\s])/g, ', $1');
}

// Normalize song or message titles
export function normalizeTitle(title) {
  if (!title || typeof title !== 'string') return title;
  
  const trimmed = title.trim();
  if (!trimmed) return '';

  // Words that should stay lowercase in titles (unless they're the first word)
  const lowercaseWords = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'of', 'in', 'la', 'el', 'y', 'de', 'en', 'un', 'una'];

  const words = trimmed.toLowerCase().split(/\s+/);
  const normalized = words.map((word, index) => {
    // Always capitalize first and last word
    if (index === 0 || index === words.length - 1) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    }
    
    // Check if it's a lowercase word
    if (lowercaseWords.includes(word)) {
      return word;
    }
    
    // Handle words with apostrophes or hyphens
    if (word.includes("'") || word.includes('-')) {
      const separator = word.includes("'") ? "'" : '-';
      return word.split(separator).map(part => 
        part.charAt(0).toUpperCase() + part.slice(1)
      ).join(separator);
    }
    
    // Standard capitalization
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');

  return normalized;
}

// Validate that a name can be normalized into "Title FirstName LastName" format
function isValidName(name) {
  if (!name || !name.trim()) return false;
  
  const trimmed = name.trim();
  const words = trimmed.split(/\s+/);
  
  // Must have at least 2 words (First Last) or 3 with title (Title First Last)
  if (words.length < 2) return false;
  
  // Check if all words are reasonable (not just symbols or numbers)
  const allWordsValid = words.every(word => {
    const cleaned = word.replace(/[.,]/g, '');
    return /^[a-zA-ZáéíóúÁÉÍÓÚñÑ'-]+$/.test(cleaned);
  });
  
  return allWordsValid;
}

// Save a suggestion to the database
export async function saveSuggestion(base44, type, value) {
  if (!value || !value.trim()) return;
  
  // For person-related types, validate the name format
  const personTypes = ['presenter', 'translator', 'preacher', 'leader', 'worshipLeader', 'ministryLeader'];
  
  if (personTypes.includes(type)) {
    if (!isValidName(value)) {
      console.log(`Skipping invalid name format: "${value}"`);
      return;
    }
  }
  
  const normalized = type === 'songTitle' || type === 'messageTitle' 
    ? normalizeTitle(value) 
    : normalizeName(value);

  try {
    // Check if suggestion already exists
    const existing = await base44.entities.SuggestionItem.filter({ 
      type, 
      value: normalized 
    });

    if (existing.length > 0) {
      // Increment use count
      await base44.entities.SuggestionItem.update(existing[0].id, {
        use_count: (existing[0].use_count || 1) + 1
      });
    } else {
      // Create new suggestion
      await base44.entities.SuggestionItem.create({
        type,
        value: normalized,
        original_value: value,
        use_count: 1
      });
    }
  } catch (error) {
    console.error('[SUGGESTION SAVE ERROR] Failed to save autocomplete suggestion', {
      type,
      value,
      normalized,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// Fetch suggestions for a given type
export async function getSuggestions(base44, type, searchTerm = '') {
  try {
    const allSuggestions = await base44.entities.SuggestionItem.filter({ type });
    
    if (!searchTerm) {
      // Return top 10 most used
      return allSuggestions
        .sort((a, b) => (b.use_count || 0) - (a.use_count || 0))
        .slice(0, 10)
        .map(s => s.value);
    }
    
    // Filter by search term
    const filtered = allSuggestions
      .filter(s => s.value.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => (b.use_count || 0) - (a.use_count || 0))
      .slice(0, 10)
      .map(s => s.value);
    
    return filtered;
  } catch (error) {
    console.error('[SUGGESTION FETCH ERROR] Failed to retrieve autocomplete suggestions', {
      type,
      searchTerm,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    return [];
  }
}
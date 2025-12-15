// Text normalization utilities for consistent formatting

const titleAbbreviations = {
  'pastor': 'P.',
  'apostle': 'A.',
  'apóstol': 'A.',
  'prophet': 'Pr.',
  'profeta': 'Pr.',
  'reverend': 'Rev.',
  'reverendo': 'Rev.',
  'doctor': 'Dr.',
  'elder': 'Eld.',
  'anciano': 'Anc.',
  'bishop': 'Bp.',
  'obispo': 'Ob.',
  'minister': 'Min.',
  'ministro': 'Min.',
  'deacon': 'Dcn.',
  'diácono': 'Dcn.',
  'evangelist': 'Ev.',
  'evangelista': 'Ev.'
};

// Normalize a person's name with proper capitalization
export function normalizeName(name) {
  if (!name || typeof name !== 'string') return name;
  
  const trimmed = name.trim();
  if (!trimmed) return '';

  // Split by spaces and capitalize each word
  const words = trimmed.toLowerCase().split(/\s+/);
  const normalized = words.map(word => {
    // Check if it starts with a title
    const lowerWord = word.toLowerCase().replace(/[.,]/g, '');
    if (titleAbbreviations[lowerWord]) {
      return titleAbbreviations[lowerWord];
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
    
    // Standard capitalization
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');

  return normalized;
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

// Save a suggestion to the database
export async function saveSuggestion(base44, type, value) {
  if (!value || !value.trim()) return;
  
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
    console.error('Error saving suggestion:', error);
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
    console.error('Error fetching suggestions:', error);
    return [];
  }
}
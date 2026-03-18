import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

function normalizeName(name) {
  if (!name || typeof name !== 'string') return name;
  
  const trimmed = name.trim();
  if (!trimmed) return '';

  const words = trimmed.toLowerCase().split(/\s+/);
  const normalized = words.map(word => {
    const lowerWord = word.toLowerCase().replace(/[.,]/g, '');
    if (titleAbbreviations[lowerWord]) {
      return titleAbbreviations[lowerWord];
    }
    
    if (word.includes("'")) {
      return word.split("'").map(part => 
        part.charAt(0).toUpperCase() + part.slice(1)
      ).join("'");
    }
    
    if (word.includes('-')) {
      return word.split('-').map(part => 
        part.charAt(0).toUpperCase() + part.slice(1)
      ).join('-');
    }
    
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');

  return normalized;
}

function isValidName(name) {
  if (!name || !name.trim()) return false;
  
  const trimmed = name.trim();
  const words = trimmed.split(/\s+/);
  
  if (words.length < 2) return false;
  
  const allWordsValid = words.every(word => {
    const cleaned = word.replace(/[.,]/g, '');
    return /^[a-zA-ZáéíóúÁÉÍÓÚñÑ'-]+$/.test(cleaned);
  });
  
  return allWordsValid;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allSuggestions = await base44.asServiceRole.entities.SuggestionItem.list();
    
    const personTypes = ['presenter', 'translator', 'preacher', 'leader', 'worshipLeader', 'ministryLeader'];
    
    let updated = 0;
    let deleted = 0;
    let unchanged = 0;

    for (const suggestion of allSuggestions) {
      const isPersonType = personTypes.includes(suggestion.type);
      
      if (isPersonType) {
        const isValid = isValidName(suggestion.value);
        
        if (!isValid) {
          await base44.asServiceRole.entities.SuggestionItem.delete(suggestion.id);
          deleted++;
          continue;
        }
        
        const normalized = normalizeName(suggestion.value);
        
        if (normalized !== suggestion.value) {
          await base44.asServiceRole.entities.SuggestionItem.update(suggestion.id, {
            value: normalized
          });
          updated++;
        } else {
          unchanged++;
        }
      } else {
        unchanged++;
      }
    }

    return Response.json({
      success: true,
      total: allSuggestions.length,
      updated,
      deleted,
      unchanged
    });
  } catch (error) {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});
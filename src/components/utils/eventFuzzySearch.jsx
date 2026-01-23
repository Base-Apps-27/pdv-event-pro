/**
 * Simple fuzzy search for events by name/year
 * Returns top 3 closest matches with confidence scores
 */

function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function computeSimilarity(query, target) {
  const maxLen = Math.max(query.length, target.length);
  const distance = levenshteinDistance(query.toLowerCase(), target.toLowerCase());
  return 1 - distance / maxLen;
}

/**
 * Search events by query string
 * @param {Array} events - Array of {id, name, year, session_count}
 * @param {String} query - User's query (e.g. "Event X")
 * @returns {Array} Top 3 matches with confidence scores
 */
export function fuzzySearchEvents(events, query) {
  if (!query || !events) return [];

  const scored = events.map(event => {
    // Score by name similarity + year mention
    let nameScore = computeSimilarity(query, event.name);
    
    // Boost if year is mentioned in query
    if (query.includes(String(event.year))) {
      nameScore = Math.min(1, nameScore + 0.15);
    }

    // Boost exact name prefix match
    if (event.name.toLowerCase().startsWith(query.toLowerCase())) {
      nameScore = Math.min(1, nameScore + 0.2);
    }

    return {
      ...event,
      confidence: nameScore
    };
  });

  // Sort by confidence, take top 3
  return scored
    .filter(e => e.confidence >= 0.4) // minimum threshold
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

/**
 * Should AI ask for clarification?
 * Returns true if confidence < 80% or multiple matches
 */
export function shouldAskClarification(matches) {
  if (matches.length === 0) return true; // no match = ask
  if (matches.length === 1 && matches[0].confidence < 0.8) return true; // uncertain match
  if (matches.length > 1 && matches[0].confidence - matches[1].confidence < 0.1) return true; // ambiguous
  return false;
}
/**
 * Normalize an artist name for deduplication and matching.
 *
 * Steps:
 * 1. Lowercase
 * 2. Decompose Unicode and strip combining diacritical marks (é → e)
 * 3. Strip common prefixes ("the ", "dj ") for matching purposes
 * 4. Remove non-alphanumeric characters (keep spaces)
 * 5. Collapse multiple spaces into one and trim
 *
 * Examples:
 *   "The Smashing Pumpkins" → "smashing pumpkins"
 *   "Beyoncé"               → "beyonce"
 *   "AC/DC"                 → "ac dc"
 *   "  DJ  Shadow "         → "shadow"
 */
export function normalizeArtistName(name: string): string {
  let normalized = name
    // Step 1: lowercase
    .toLowerCase()
    // Step 2: decompose and strip diacritics
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Step 3: strip common prefixes
    .replace(/^(the|dj)\s+/i, '')
    // Step 4: remove non-alphanumeric (keep spaces)
    .replace(/[^a-z0-9\s]/g, ' ')
    // Step 5: collapse whitespace and trim
    .replace(/\s+/g, ' ')
    .trim();

  return normalized;
}

/**
 * Check if two artist names match after normalization.
 */
export function artistNamesMatch(a: string, b: string): boolean {
  return normalizeArtistName(a) === normalizeArtistName(b);
}

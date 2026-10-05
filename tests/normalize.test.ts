import { describe, it, expect } from 'vitest';
import { normalizeArtistName, artistNamesMatch } from '@/lib/normalize';

describe('normalizeArtistName', () => {
  it('lowercases the name', () => {
    expect(normalizeArtistName('Arctic Monkeys')).toBe('arctic monkeys');
  });

  it('strips diacritics', () => {
    expect(normalizeArtistName('Beyoncé')).toBe('beyonce');
    expect(normalizeArtistName('Sigur Rós')).toBe('sigur ros');
    expect(normalizeArtistName('Mötley Crüe')).toBe('motley crue');
  });

  it('strips "The" prefix', () => {
    expect(normalizeArtistName('The Smashing Pumpkins')).toBe('smashing pumpkins');
    expect(normalizeArtistName('The The')).toBe('the'); // "The The" → strip first "the " → "the"
  });

  it('strips "DJ" prefix', () => {
    expect(normalizeArtistName('DJ Shadow')).toBe('shadow');
  });

  it('handles slashes and special characters', () => {
    expect(normalizeArtistName('AC/DC')).toBe('ac dc');
    expect(normalizeArtistName("Guns N' Roses")).toBe('guns n roses');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeArtistName('  Foo   Bar  ')).toBe('foo bar');
  });

  it('handles empty string', () => {
    expect(normalizeArtistName('')).toBe('');
  });

  it('handles single-word artist', () => {
    expect(normalizeArtistName('Adele')).toBe('adele');
  });

  it('handles numbers in names', () => {
    expect(normalizeArtistName('Blink-182')).toBe('blink 182');
    expect(normalizeArtistName('Maroon 5')).toBe('maroon 5');
  });

  it('handles all-caps names', () => {
    expect(normalizeArtistName('ABBA')).toBe('abba');
  });
});

describe('artistNamesMatch', () => {
  it('matches identical names', () => {
    expect(artistNamesMatch('Coldplay', 'Coldplay')).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(artistNamesMatch('coldplay', 'COLDPLAY')).toBe(true);
  });

  it('matches with/without "The"', () => {
    expect(artistNamesMatch('The Beatles', 'Beatles')).toBe(true);
  });

  it('matches with/without diacritics', () => {
    expect(artistNamesMatch('Beyoncé', 'Beyonce')).toBe(true);
  });

  it('does not match different artists', () => {
    expect(artistNamesMatch('Coldplay', 'Radiohead')).toBe(false);
  });
});

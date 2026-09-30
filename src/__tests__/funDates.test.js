import { describe, it, expect } from 'vitest';
import { CARDS, matchesFilters } from '../funDates/cards.js';

const card = (over) => ({ location: 'indoor', duration: 30, food: 'none', ...over });
const all = { locations: ['indoor', 'outdoor', 'both'], durations: [30, 60, null], foods: ['warm', 'snacks', 'none'] };

describe('matchesFilters', () => {
  it('kürzere Dates passen bei mehr Zeit mit', () => {
    expect(matchesFilters(card({ duration: 30 }), { ...all, durations: [60] })).toBe(true);
    expect(matchesFilters(card({ duration: 60 }), { ...all, durations: [30] })).toBe(false);
  });

  it('unbegrenzte Dates nur bei „Unbegrenzt“, dort aber alle', () => {
    expect(matchesFilters(card({ duration: null }), { ...all, durations: [30, 60] })).toBe(false);
    expect(matchesFilters(card({ duration: null }), { ...all, durations: [null] })).toBe(true);
    expect(matchesFilters(card({ duration: 30 }), { ...all, durations: [null] })).toBe(true);
  });

  it('Ort: „Beides“-Dates passen nur, wenn Indoor und Outdoor gewählt sind', () => {
    expect(matchesFilters(card({ location: 'both' }), { ...all, locations: ['indoor'] })).toBe(false);
    expect(matchesFilters(card({ location: 'both' }), { ...all, locations: ['indoor', 'outdoor'] })).toBe(true);
    expect(matchesFilters(card({ location: 'outdoor' }), { ...all, locations: ['indoor', 'outdoor'] })).toBe(true);
  });

  it('Essen: eine gewählte Antwort reicht, „Egal“ passt immer', () => {
    expect(matchesFilters(card({ food: 'snacks' }), { ...all, foods: ['warm'] })).toBe(false);
    expect(matchesFilters(card({ food: 'snacks' }), { ...all, foods: ['warm', 'snacks'] })).toBe(true);
    expect(matchesFilters(card({ food: 'snacks' }), { ...all, foods: ['any'] })).toBe(true);
  });

  it('Karten-IDs sind eindeutig', () => {
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
  });
});

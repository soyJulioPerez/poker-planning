import { AVAILABLE_DECKS } from './decks';

describe('AVAILABLE_DECKS', () => {
  it('exposes at least Fibonacci, powers of two, and t-shirt decks', () => {
    const ids = AVAILABLE_DECKS.map((deck) => deck.id);
    expect(ids).toEqual(
      expect.arrayContaining(['fibonacci', 'powers-of-two', 'tshirt'])
    );
  });

  it('every deck has unique, non-empty values', () => {
    for (const deck of AVAILABLE_DECKS) {
      expect(deck.values.length).toBeGreaterThan(0);
      expect(new Set(deck.values).size).toBe(deck.values.length);
    }
  });
});

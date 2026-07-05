import { DeckOption } from './domain';

export const FIBONACCI_DECK: DeckOption = {
  id: 'fibonacci',
  label: 'Fibonacci',
  values: ['0', '1', '2', '3', '5', '8', '13', '21', '34', '?', '☕'],
};

export const POWERS_OF_TWO_DECK: DeckOption = {
  id: 'powers-of-two',
  label: 'Powers of 2',
  values: ['0', '1', '2', '4', '8', '16', '32', '64', '?', '☕'],
};

export const TSHIRT_DECK: DeckOption = {
  id: 'tshirt',
  label: 'T-Shirt Sizes',
  values: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕'],
};

export const AVAILABLE_DECKS: DeckOption[] = [
  FIBONACCI_DECK,
  POWERS_OF_TWO_DECK,
  TSHIRT_DECK,
];

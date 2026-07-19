import { DeckOption } from './domain';

export const FIBONACCI_DECK: DeckOption = {
  id: 'fibonacci',
  label: 'Fibonacci',
  values: ['0', '1', '2', '3', '5', '8', '13', '21', '34', '?', '☕', '🧉'],
};

export const POWERS_OF_TWO_DECK: DeckOption = {
  id: 'powers-of-two',
  label: 'Powers of 2',
  values: ['0', '1', '2', '4', '8', '16', '32', '64', '?', '☕', '🧉'],
};

const TSHIRT_NUMERIC_VALUES: Record<string, number> = { XS: 1, S: 2, M: 4, L: 8, XL: 16, XXL: 32 };

export const TSHIRT_DECK: DeckOption = {
  id: 'tshirt',
  label: 'T-Shirt Sizes',
  values: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕', '🧉'],
  numericValues: TSHIRT_NUMERIC_VALUES,
};

export const HAND_FIBONACCI_DECK: DeckOption = {
  id: 'fibonacci-hands',
  label: 'Fibonacci con manos',
  values: ['0', '1', '2', '3', '5', '8', '13', '21', '34', '?', '☕', '🧉'],
  displayValues: [
    '✊ 0',
    '☝ 1',
    '✌ 2',
    '🤟 3',
    '✋ 5',
    '✋🤟 8',
    '👣🤟 13',
    '🧍☝ 21',
    '🧍👣🤟☝ 34',
    '?',
    '☕',
    '🧉',
  ],
};

export const TSHIRT_WITH_ICONS_DECK: DeckOption = {
  id: 'tshirt-icons',
  label: 'T-Shirt con iconos',
  values: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕', '🧉'],
  displayValues: ['🍼 XS', '🧒 S', '🧑‍🦱 M', '🧑 L', '🧔 XL', '👴 XXL', '?', '☕', '🧉'],
  numericValues: TSHIRT_NUMERIC_VALUES,
};

export const AVAILABLE_DECKS: DeckOption[] = [
  FIBONACCI_DECK,
  POWERS_OF_TWO_DECK,
  TSHIRT_DECK,
  HAND_FIBONACCI_DECK,
  TSHIRT_WITH_ICONS_DECK,
];

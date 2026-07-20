import { IconGroup } from './domain';

export const HOBBIES_ICON_GROUP: IconGroup = {
  id: 'hobbies',
  label: 'Hobbies',
  icons: ['⚽', '🏀', '🎾', '🏓', '🎮', '🎨', '🎸', '🎣', '🚴', '🏋️', '📷', '♟️'],
};

export const EMOTIONS_ICON_GROUP: IconGroup = {
  id: 'emotions',
  label: 'Emociones',
  icons: ['😀', '😢', '😡', '😱', '😍', '😌', '🤔', '😴', '🤩', '😕', '🥳', '🥶'],
};

export const ANIMALS_ICON_GROUP: IconGroup = {
  id: 'animals',
  label: 'Animales',
  icons: ['🐶', '🐱', '🦊', '🐼', '🐸', '🦁', '🐧', '🐢', '🦄', '🐝', '🐨', '🐙'],
};

export const AVAILABLE_ICON_GROUPS: IconGroup[] = [
  HOBBIES_ICON_GROUP,
  EMOTIONS_ICON_GROUP,
  ANIMALS_ICON_GROUP,
];

export const GROWTH_STAGES = {
  SEED:    { min: 0,   max: 6,   emoji: '🌱', name: 'Seed' },
  SPROUT:  { min: 7,   max: 20,  emoji: '🌿', name: 'Sprout' },
  PLANT:   { min: 21,  max: 49,  emoji: '🪴', name: 'Plant' },
  TREE:    { min: 50,  max: 364, emoji: '🌳', name: 'Tree' },
  LEGACY:  { min: 365, max: Infinity, emoji: '🏆', name: 'Legacy' }
};

export const STORAGE_KEYS = {
  HABITS: 'cultiva-habits',
  SETTINGS: 'cultiva-settings'
};

export const MAX_ACTIVE_HABITS = 9;
export const LEGACY_THRESHOLD = 365;
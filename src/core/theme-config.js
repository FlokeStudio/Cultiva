/* ============================================
   Single source of truth: themes & ambient BGs
   ============================================ */

/** Body uses class theme-{id} for these palette ids (includes light / dark). */
export const THEME_BODY_IDS = [
  'light', 'dark', 'pink', 'moon', 'evergreen', 'blossom', 'ocean', 'sunset',
  'frost', 'cedar', 'dusk', 'meadow',
  'orchard', 'honeycrisp', 'inkwell', 'sequoia', 'cypress'
];

/** Light appearance presets (optgroup). */
export const THEMES_LIGHT_GROUP = [
  'light', 'blossom', 'frost', 'cedar', 'meadow', 'orchard', 'honeycrisp'
];

/** Dark appearance presets (optgroup). */
export const THEMES_DARK_GROUP = [
  'dark', 'evergreen', 'ocean', 'sunset', 'pink', 'moon', 'dusk', 'inkwell', 'sequoia', 'cypress'
];

/** Layer elements #bg-{id} (animated + custom). */
export const AMBIENT_BG_LAYER_IDS = [
  'aurora', 'rainfall', 'starlight', 'snowfall', 'fireflies',
  'petal', 'mist', 'ember', 'breeze',
  'cypress-drift', 'dew', 'sunbeam'
];

export const LS_CUSTOM_BG_DATA = 'cultiva-custom-bg-data';

/** Values for #bg-select (order in UI). */
export const BG_SELECT_ORDER = ['none', ...AMBIENT_BG_LAYER_IDS, 'custom'];

export function getThemeBodyClassList() {
  return THEME_BODY_IDS.map((id) => `theme-${id}`);
}

export function getWithBgClassList() {
  return BG_SELECT_ORDER.filter((x) => x !== 'none').map((x) => `with-bg-${x}`);
}

export function resolveThemeBodyId(themeSetting) {
  if (!themeSetting || themeSetting === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return themeSetting;
}

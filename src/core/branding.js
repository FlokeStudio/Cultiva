/* ============================================
   CULTIVA BRANDING & NOMENCLATURE
   ============================================ */

export const BRANDING = {
  APP_NAME: 'Cultiva',
  CORE_ENGINE: 'CoreV2',         
  HABIT_ENGINE: 'GrowthKit2',      
  DATABASE: 'IBD2',               
  
  VERSION: '0.3.0',
  CODENAME: 'Sequoia',
  
  KEYS: {
    SESSION: 'cultiva_current_session',
    SETTINGS: 'cultiva-settings',
    HABITS: 'cultiva-habits',
    MIGRATION_FLAG: 'cultiva_migrated_to_idb_v1'
  },
  
  TAGLINE: 'Grow your habits, grow yourself.',
  FOOTER_VERSION: `[${BRANDING.VERSION}] ${BRANDING.CODENAME} 2026`
};

export const formatVersion = () => `${BRANDING.APP_NAME} ${BRANDING.VERSION} "${BRANDING.CODENAME}" [${BRANDING.CORE_ENGINE}]`;
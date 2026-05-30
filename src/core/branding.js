/* ============================================
   CULTIVA BRANDING & NOMENCLATURE
   ============================================ */

export const BRANDING = {
  APP_NAME: 'Cultiva',
  CORE_ENGINE: 'CoreV5',         
  HABIT_ENGINE: 'GrowthKit2',      
  DATABASE: 'IDB2',               
  VERSION: '1.1.0',
  CODENAME: 'Cypress',
  
  KEYS: {
    SESSION: 'cultiva_current_session',
    SETTINGS: 'cultiva-settings',
    HABITS: 'cultiva-habits',
    MIGRATION_FLAG: 'cultiva_migrated_to_idb_v2'
  },
  
  TAGLINE: 'Grow your habits, grow yourself.',
  
  get FOOTER_TEXT() {
    return `[${this.VERSION}] ${this.CODENAME} Desktop`; 
  },
  get APP_TITLE() { return this.APP_NAME; },
  get BACKUP_PREFIX() { return `${this.APP_NAME.toLowerCase()}-backup`; }
};

export const formatVersion = () => `${BRANDING.APP_NAME} ${BRANDING.VERSION} "${BRANDING.CODENAME}" [${BRANDING.CORE_ENGINE}]`;
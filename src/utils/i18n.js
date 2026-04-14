// ═══════════════════════════════════════════════════════════════
//  NicoDev Discord Bot – i18n (Internazionalizzazione)
//  Utility per la traduzione delle stringhe del bot
// ═══════════════════════════════════════════════════════════════

const { getGuildSettings } = require('../database/db');

// ─── Caricamento locali ─────────────────────────────────────
const locales = {
  it: require('../locales/it'),
  en: require('../locales/en'),
  es: require('../locales/es'),
};

const SUPPORTED_LANGUAGES = Object.keys(locales);
const DEFAULT_LANGUAGE = 'it';

// ─── Cache lingua per guild (evita query DB ripetute) ───────
const langCache = new Map();
const CACHE_TTL = 60_000; // 1 minuto

/**
 * Restituisce la lingua configurata per un server
 * @param {string} guildId
 * @returns {string}
 */
function getLanguage(guildId) {
  if (!guildId) return DEFAULT_LANGUAGE;

  const cached = langCache.get(guildId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.lang;

  const settings = getGuildSettings(guildId);
  const lang = SUPPORTED_LANGUAGES.includes(settings?.language) ? settings.language : DEFAULT_LANGUAGE;

  langCache.set(guildId, { lang, ts: Date.now() });
  return lang;
}

/**
 * Invalida la cache lingua per un server (da chiamare dopo il cambio lingua)
 */
function invalidateLanguageCache(guildId) {
  langCache.delete(guildId);
}

/**
 * Ottieni una stringa tradotta
 * @param {string} guildId  – ID del server (o null per default)
 * @param {string} key      – Chiave dot-notation, es. 'common.error' o 'moderation.ban_success'
 * @param {Object} [vars]   – Variabili da sostituire, es. { user: 'Nico', reason: 'spam' }
 * @returns {string}
 */
function t(guildId, key, vars = {}) {
  const lang = getLanguage(guildId);
  const locale = locales[lang] || locales[DEFAULT_LANGUAGE];
  const fallback = locales[DEFAULT_LANGUAGE];

  // Naviga la chiave (es. 'moderation.ban_success')
  const parts = key.split('.');
  let value = locale;
  let fbValue = fallback;

  for (const part of parts) {
    value = value?.[part];
    fbValue = fbValue?.[part];
  }

  // Se non è una stringa, prova il fallback
  if (typeof value !== 'string') {
    // Potrebbe essere un oggetto (es. verification_levels) — restituilo così
    if (value !== undefined && value !== null && typeof value === 'object') return value;
    if (typeof fbValue === 'string') value = fbValue;
    else if (fbValue !== undefined && fbValue !== null && typeof fbValue === 'object') return fbValue;
    else return key; // Chiave non trovata
  }

  // Sostituisci le variabili {nome}
  let result = value;
  for (const [k, v] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }

  return result;
}

/**
 * Mappa nomi lingua leggibili
 */
const LANGUAGE_NAMES = {
  it: '🇮🇹 Italiano',
  en: '🇬🇧 English',
  es: '🇪🇸 Español',
};

module.exports = {
  t,
  getLanguage,
  invalidateLanguageCache,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  LANGUAGE_NAMES,
};

// ═══════════════════════════════════════════════════════════════
//  NicoDev Discord Bot – Premium Check Utility
//  Controlla se una guild ha accesso a una funzionalità premium
// ═══════════════════════════════════════════════════════════════

const { getPremiumGuild } = require('../database/db');

const BOT_OWNER_ID = '790685206142124063';

// Moduli premium disponibili
const PREMIUM_FEATURES = {
  tickets:       '🎫 Ticket System',
  newsletter:    '📨 Newsletter',
  assistenza:    '🆘 Assistenza',
  reactionroles: '🎭 Reaction Roles',
  verify:        '✅ Verifica Captcha',
  serverbuilder: '🏗️ Server Builder',
  utility_plus:  '🔧 Utility Avanzate',
  twitch:        '📺 Twitch Notifications',
  whitelist:     '📝 Whitelist System',
  giveaway:      '🎉 Giveaway System',
};

/**
 * Controlla se una guild ha accesso a una funzionalità premium.
 * Il proprietario del bot bypassa sempre il controllo.
 * @param {string} guildId
 * @param {string} feature - nome del modulo premium
 * @param {string} [userId] - se è il bot owner, bypassa
 * @returns {boolean}
 */
function hasPremium(guildId, feature, userId = null) {
  // Il proprietario del bot bypassa sempre
  if (userId === BOT_OWNER_ID) return true;

  const premium = getPremiumGuild(guildId);
  if (!premium) return false;

  // "all" sblocca tutto
  if (premium.features.includes('all')) return true;

  return premium.features.includes(feature);
}

module.exports = {
  hasPremium,
  PREMIUM_FEATURES,
  BOT_OWNER_ID,
};

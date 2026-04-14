// ═══════════════════════════════════════════════════════════════
//  NicoDev Discord Bot – Embed Builder
//  Utility per creare embed consistenti e personalizzabili
// ═══════════════════════════════════════════════════════════════

const { EmbedBuilder } = require('discord.js');
const { getGuildSettings } = require('../database/db');

/**
 * Crea un embed con il colore e il footer personalizzati per il server
 */
function createEmbed(guildId, options = {}) {
  const settings = guildId ? getGuildSettings(guildId) : null;
  const color = options.color || settings?.embed_color || '#5865F2';
  const botName = settings?.bot_name || process.env.BOT_NAME || 'NicoDev Bot';
  const botIcon = settings?.bot_icon || null;

  const footerOptions = { text: `${botName} • by NicoDev` };
  if (botIcon) footerOptions.iconURL = botIcon;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTimestamp()
    .setFooter(footerOptions);

  if (options.title) embed.setTitle(options.title);
  if (options.description) embed.setDescription(options.description);
  if (options.thumbnail) embed.setThumbnail(options.thumbnail);
  if (options.image) embed.setImage(options.image);
  if (options.author) embed.setAuthor(options.author);
  if (options.fields) embed.addFields(options.fields);
  if (options.url) embed.setURL(options.url);

  return embed;
}

/**
 * Embed di successo (verde)
 */
function successEmbed(guildId, title, description) {
  return createEmbed(guildId, {
    title: `✅ ${title}`,
    description,
    color: '#57F287',
  });
}

/**
 * Embed di errore (rosso)
 */
function errorEmbed(guildId, title, description) {
  return createEmbed(guildId, {
    title: `❌ ${title}`,
    description,
    color: '#ED4245',
  });
}

/**
 * Embed di warning (giallo)
 */
function warnEmbed(guildId, title, description) {
  return createEmbed(guildId, {
    title: `⚠️ ${title}`,
    description,
    color: '#FEE75C',
  });
}

/**
 * Embed informativo (blu)
 */
function infoEmbed(guildId, title, description) {
  return createEmbed(guildId, {
    title: `ℹ️ ${title}`,
    description,
    color: '#5865F2',
  });
}

module.exports = {
  createEmbed,
  successEmbed,
  errorEmbed,
  warnEmbed,
  infoEmbed,
};

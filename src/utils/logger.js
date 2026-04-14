// ═══════════════════════════════════════════════════════════════
//  NicoDev Discord Bot – Logger
//  Invia log embed nei canali configurati
// ═══════════════════════════════════════════════════════════════

const { getGuildSettings } = require('../database/db');
const { createEmbed } = require('./embed');

/**
 * Invia un log nel canale log generale
 */
async function sendLog(guild, options) {
  const settings = getGuildSettings(guild.id);
  if (!settings?.log_channel_id) return;

  try {
    const channel = await guild.channels.fetch(settings.log_channel_id);
    if (!channel) return;

    const embed = createEmbed(guild.id, options);
    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('[Logger] Errore invio log:', error.message);
  }
}

/**
 * Invia un log nel canale moderazione
 */
async function sendModLog(guild, options) {
  const settings = getGuildSettings(guild.id);
  const channelId = settings?.mod_log_channel_id || settings?.log_channel_id;
  if (!channelId) return;

  try {
    const channel = await guild.channels.fetch(channelId);
    if (!channel) return;

    const embed = createEmbed(guild.id, {
      color: '#ED4245',
      ...options,
    });
    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('[Logger] Errore invio mod log:', error.message);
  }
}

/**
 * Invia un log nel canale ticket
 */
async function sendTicketLog(guild, options) {
  const settings = getGuildSettings(guild.id);
  if (!settings?.ticket_log_channel_id) return;

  try {
    const channel = await guild.channels.fetch(settings.ticket_log_channel_id);
    if (!channel) return;

    const embed = createEmbed(guild.id, options);
    return { channel, embed };
  } catch (error) {
    console.error('[Logger] Errore invio ticket log:', error.message);
    return null;
  }
}

module.exports = {
  sendLog,
  sendModLog,
  sendTicketLog,
};

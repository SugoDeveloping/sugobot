// ═══════════════════════════════════════════════════════════════
//  NicoDev Discord Bot – Webhook Sender
//  Invia messaggi tramite webhook con avatar/nome personalizzati
//  per server, simulando un "logo bot diverso" per ogni guild.
// ═══════════════════════════════════════════════════════════════

const { getGuildSettings } = require('../database/db');

// Cache webhook per canale (channelId -> webhook)
const webhookCache = new Map();

/**
 * Ottiene o crea un webhook gestito dal bot in un canale.
 * Se ne esiste già uno creato dal bot, lo riutilizza.
 */
async function getOrCreateWebhook(channel, client) {
  // Controlla la cache
  if (webhookCache.has(channel.id)) {
    const cached = webhookCache.get(channel.id);
    try {
      // Verifica che esista ancora
      await cached.fetch();
      return cached;
    } catch {
      webhookCache.delete(channel.id);
    }
  }

  try {
    // Cerca un webhook esistente creato dal bot
    const webhooks = await channel.fetchWebhooks();
    const existing = webhooks.find(wh => wh.owner?.id === client.user.id && wh.name === 'NicoDev Bot');

    if (existing) {
      webhookCache.set(channel.id, existing);
      return existing;
    }

    // Creane uno nuovo
    const webhook = await channel.createWebhook({
      name: 'NicoDev Bot',
      reason: 'Webhook per avatar personalizzato del bot',
    });

    webhookCache.set(channel.id, webhook);
    return webhook;
  } catch (error) {
    console.error('[Webhook] Errore creazione/recupero webhook:', error.message);
    return null;
  }
}

/**
 * Invia un messaggio in un canale con l'avatar e il nome personalizzati per il server.
 * Se il server ha un bot_icon configurato, usa un webhook.
 * Altrimenti invia normalmente tramite channel.send().
 *
 * @param {TextChannel} channel  – Il canale dove inviare
 * @param {object}      payload  – Il payload del messaggio (content, embeds, components, files, ecc.)
 * @param {Client}      client   – Il client Discord
 * @param {string}      guildId  – ID del guild (per recuperare le impostazioni)
 * @returns {Promise<Message>}   – Il messaggio inviato
 */
async function sendAsBot(channel, payload, client, guildId) {
  const settings = guildId ? getGuildSettings(guildId) : null;
  const botIcon = settings?.bot_icon;
  const botName = settings?.bot_name || 'NicoDev Bot';

  // Se non c'è un'icona personalizzata, invia normalmente
  if (!botIcon) {
    return channel.send(payload);
  }

  // Usa webhook con avatar personalizzato
  try {
    const webhook = await getOrCreateWebhook(channel, client);
    if (!webhook) {
      // Fallback: invio normale
      return channel.send(payload);
    }

    return webhook.send({
      ...payload,
      username: botName,
      avatarURL: botIcon,
    });
  } catch (error) {
    console.error('[Webhook] Errore invio:', error.message);
    // Fallback: invio normale
    return channel.send(payload);
  }
}

/**
 * Modifica un messaggio inviato tramite webhook.
 * Se il messaggio è stato inviato da webhook, lo edita via webhook.
 * Altrimenti edita normalmente.
 */
async function editAsBotMessage(message, payload, client, guildId) {
  const settings = guildId ? getGuildSettings(guildId) : null;
  const botIcon = settings?.bot_icon;

  // Se il messaggio è stato inviato da webhook
  if (message.webhookId) {
    try {
      const webhook = await getOrCreateWebhook(message.channel, client);
      if (webhook) {
        return webhook.editMessage(message.id, payload);
      }
    } catch (error) {
      console.error('[Webhook] Errore edit:', error.message);
    }
  }

  // Fallback: edit normale
  return message.edit(payload);
}

module.exports = {
  sendAsBot,
  editAsBotMessage,
  getOrCreateWebhook,
};

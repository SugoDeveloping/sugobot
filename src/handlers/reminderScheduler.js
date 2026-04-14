// ═══════════════════════════════════════════════════════════════
//  NicoDev Discord Bot – Reminder Scheduler
//  Invia promemoria periodici per ticket e assistenze aperte
// ═══════════════════════════════════════════════════════════════

const {
  getAllOpenTickets,
  getAllOpenAssistenza,
  getGuildSettings,
  getAssistenzaSettings,
  updateTicketReminder,
  updateAssistenzaReminder,
  getAllGuildSettings,
  getAllAssistenzaSettings,
} = require('../database/db');
const { createEmbed } = require('../utils/embed');
const { t } = require('../utils/i18n');

// Controlla ogni 15 minuti
const CHECK_INTERVAL_MS = 15 * 60 * 1000;

let reminderInterval = null;

/**
 * Avvia lo scheduler dei promemoria
 */
function startReminderScheduler(client) {
  if (reminderInterval) clearInterval(reminderInterval);

  console.log('  🔔 Reminder scheduler avviato (check ogni 15 min)');

  // Prima esecuzione dopo 60 secondi dal boot (per dare tempo al bot di essere pronto)
  setTimeout(() => {
    runReminderCheck(client);
  }, 60000);

  // Poi ogni 15 minuti
  reminderInterval = setInterval(() => {
    runReminderCheck(client);
  }, CHECK_INTERVAL_MS);
}

/**
 * Esegue il check dei promemoria
 */
async function runReminderCheck(client) {
  try {
    await checkTicketReminders(client);
    await checkAssistenzaReminders(client);
  } catch (error) {
    console.error('[Reminder] Errore durante il check:', error);
  }
}

/**
 * Controlla i ticket aperti e invia promemoria
 */
async function checkTicketReminders(client) {
  // Prendi tutte le impostazioni guild con reminder attivo
  const allSettings = getAllGuildSettings();
  const guildsWithReminder = allSettings.filter(s => s.ticket_reminder_hours > 0);

  if (guildsWithReminder.length === 0) return;

  const guildReminderMap = new Map();
  for (const s of guildsWithReminder) {
    guildReminderMap.set(s.guild_id, s.ticket_reminder_hours);
  }

  // Prendi tutti i ticket aperti
  const openTickets = getAllOpenTickets();

  for (const ticket of openTickets) {
    const reminderHours = guildReminderMap.get(ticket.guild_id);
    if (!reminderHours) continue;

    const reminderMs = reminderHours * 60 * 60 * 1000;
    const now = Date.now();

    // Determina l'ultimo riferimento temporale (ultimo reminder o creazione)
    const lastRef = ticket.last_reminder_at
      ? new Date(ticket.last_reminder_at).getTime()
      : new Date(ticket.created_at).getTime();

    const elapsed = now - lastRef;

    if (elapsed < reminderMs) continue;

    // È ora di inviare un promemoria
    try {
      const guild = await client.guilds.fetch(ticket.guild_id).catch(() => null);
      if (!guild) continue;

      const settings = getGuildSettings(ticket.guild_id);
      const openSince = `<t:${Math.floor(new Date(ticket.created_at).getTime() / 1000)}:R>`;
      const channelMention = `<#${ticket.channel_id}>`;

      // DM al player
      try {
        const user = await client.users.fetch(ticket.user_id).catch(() => null);
        if (user) {
          await user.send({
            embeds: [createEmbed(ticket.guild_id, {
              title: t(ticket.guild_id, 'reminder.ticket_title'),
              description: t(ticket.guild_id, 'reminder.ticket_desc', { server: guild.name }),
              fields: [
                { name: '📋 Oggetto', value: ticket.subject || 'Assistenza Generale', inline: true },
                { name: '📅 Aperto', value: openSince, inline: true },
                { name: '✋ Assegnato a', value: ticket.claimed_by ? `<@${ticket.claimed_by}>` : 'Nessuno', inline: true },
              ],
              color: '#FEE75C',
            })],
          }).catch(() => {});
        }
      } catch (e) {
        // DM chiusi, ignora
      }

      // DM allo staffer (se il ticket è stato preso in carico)
      if (ticket.claimed_by) {
        try {
          const staffer = await client.users.fetch(ticket.claimed_by).catch(() => null);
          if (staffer) {
            await staffer.send({
              embeds: [createEmbed(ticket.guild_id, {
                title: t(ticket.guild_id, 'reminder.ticket_claimed_title'),
                description: t(ticket.guild_id, 'reminder.ticket_claimed_desc', { server: guild.name }),
                fields: [
                  { name: '👤 Utente', value: `<@${ticket.user_id}>`, inline: true },
                  { name: '📋 Oggetto', value: ticket.subject || 'Assistenza Generale', inline: true },
                  { name: '📅 Aperto', value: openSince, inline: true },
                  { name: '📍 Canale', value: channelMention, inline: true },
                ],
                color: '#FEE75C',
              })],
            }).catch(() => {});
          }
        } catch (e) {
          // DM chiusi
        }
      }

      // Aggiorna timestamp ultimo reminder
      updateTicketReminder(ticket.channel_id);

    } catch (error) {
      console.error(`[Reminder] Errore ticket #${ticket.id}:`, error.message);
    }
  }
}

/**
 * Controlla le richieste assistenza aperte e invia promemoria
 */
async function checkAssistenzaReminders(client) {
  // Prendi tutte le impostazioni assistenza con reminder attivo
  const allSettings = getAllAssistenzaSettings();
  const withReminder = allSettings.filter(s => s.reminder_hours > 0);

  if (withReminder.length === 0) return;

  const guildReminderMap = new Map();
  for (const s of withReminder) {
    guildReminderMap.set(s.guild_id, s.reminder_hours);
  }

  // Prendi tutte le assistenze aperte
  const openRequests = getAllOpenAssistenza();

  for (const request of openRequests) {
    const reminderHours = guildReminderMap.get(request.guild_id);
    if (!reminderHours) continue;

    const reminderMs = reminderHours * 60 * 60 * 1000;
    const now = Date.now();

    const lastRef = request.last_reminder_at
      ? new Date(request.last_reminder_at).getTime()
      : new Date(request.created_at).getTime();

    const elapsed = now - lastRef;

    if (elapsed < reminderMs) continue;

    try {
      const guild = await client.guilds.fetch(request.guild_id).catch(() => null);
      if (!guild) continue;

      const openSince = `<t:${Math.floor(new Date(request.created_at).getTime() / 1000)}:R>`;
      const statusLabel = request.status === 'pending' ? '⏳ In attesa' : '🔧 In gestione';

      // DM al player
      try {
        const user = await client.users.fetch(request.user_id).catch(() => null);
        if (user) {
          await user.send({
            embeds: [createEmbed(request.guild_id, {
              title: t(request.guild_id, 'reminder.assistenza_title'),
              description: t(request.guild_id, 'reminder.assistenza_desc', { id: request.id, server: guild.name }),
              fields: [
                { name: '📋 Oggetto', value: request.subject || 'N/A', inline: true },
                { name: '📌 Stato', value: statusLabel, inline: true },
                { name: '📅 Aperta', value: openSince, inline: true },
                { name: '✋ Gestita da', value: request.claimed_by ? `<@${request.claimed_by}>` : 'Nessuno ancora', inline: true },
              ],
              color: '#FEE75C',
            })],
          }).catch(() => {});
        }
      } catch (e) {}

      // DM allo staffer (se presa in carico)
      if (request.claimed_by) {
        try {
          const staffer = await client.users.fetch(request.claimed_by).catch(() => null);
          if (staffer) {
            await staffer.send({
              embeds: [createEmbed(request.guild_id, {
                title: t(request.guild_id, 'reminder.assistenza_claimed_title'),
                description: t(request.guild_id, 'reminder.assistenza_claimed_desc', { server: guild.name }),
                fields: [
                  { name: '🆔 ID', value: `#${request.id}`, inline: true },
                  { name: '👤 Utente', value: `<@${request.user_id}>`, inline: true },
                  { name: '📋 Oggetto', value: request.subject || 'N/A', inline: true },
                  { name: '📅 Aperta', value: openSince, inline: true },
                ],
                color: '#FEE75C',
              })],
            }).catch(() => {});
          }
        } catch (e) {}
      }

      // Aggiorna timestamp
      updateAssistenzaReminder(request.id);

    } catch (error) {
      console.error(`[Reminder] Errore assistenza #${request.id}:`, error.message);
    }
  }
}

module.exports = {
  startReminderScheduler,
};

// ═══════════════════════════════════════════════════════════════
//  /twitch-config – Gestisci le notifiche live di Twitch
//  Aggiungi, rimuovi e visualizza gli streamer monitorati
// ═══════════════════════════════════════════════════════════════

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const {
  addTwitchStreamer,
  removeTwitchStreamer,
  getTwitchStreamers,
} = require('../../database/db');
const { createEmbed, errorEmbed } = require('../../utils/embed');
const { t } = require('../../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('twitch-config')
    .setDescription('📺 Gestisci le notifiche live di Twitch')
    .addSubcommand(sub =>
      sub.setName('aggiungi')
        .setDescription('Aggiungi uno streamer da monitorare')
        .addStringOption(opt =>
          opt.setName('username')
            .setDescription('Username Twitch dello streamer')
            .setRequired(true))
        .addChannelOption(opt =>
          opt.setName('canale')
            .setDescription('Canale dove inviare le notifiche live')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true))
        .addRoleOption(opt =>
          opt.setName('ruolo-ping')
            .setDescription('Ruolo da pingare quando lo streamer va live')
            .setRequired(false))
        .addStringOption(opt =>
          opt.setName('messaggio')
            .setDescription('Messaggio personalizzato ({username} {title} {game} {url})')
            .setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('rimuovi')
        .setDescription('Rimuovi uno streamer monitorato')
        .addStringOption(opt =>
          opt.setName('username')
            .setDescription('Username Twitch dello streamer')
            .setRequired(true)
            .setAutocomplete(true)))
    .addSubcommand(sub =>
      sub.setName('lista')
        .setDescription('Mostra tutti gli streamer monitorati'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  premium: 'twitch',

  // ── Autocomplete per username streamer ────────────────────────
  async autocomplete(interaction) {
    const guildId = interaction.guild?.id;
    if (!guildId) return interaction.respond([]);

    const focused = interaction.options.getFocused().toLowerCase();
    const streamers = getTwitchStreamers(guildId);

    const filtered = streamers
      .filter(s => s.twitch_username.toLowerCase().includes(focused))
      .slice(0, 25)
      .map(s => ({ name: s.twitch_username, value: s.twitch_username }));

    return interaction.respond(filtered);
  },

  async execute(interaction) {
    const { guild } = interaction;
    const guildId = guild.id;
    const sub = interaction.options.getSubcommand();

    // ── Aggiungi streamer ──────────────────────────────────────
    if (sub === 'aggiungi') {
      const username = interaction.options.getString('username').toLowerCase().trim();
      const channel = interaction.options.getChannel('canale');
      const pingRole = interaction.options.getRole('ruolo-ping');
      const customMessage = interaction.options.getString('messaggio');

      // Validazione username (solo caratteri alfanumerici e underscore)
      if (!/^[a-z0-9_]{1,25}$/i.test(username)) {
        return interaction.reply({
          embeds: [errorEmbed(guildId, 'Username non valido', 'L\'username Twitch può contenere solo lettere, numeri e underscore (max 25 caratteri).')],
          ephemeral: true,
        });
      }

      try {
        addTwitchStreamer(guildId, username, channel.id, pingRole?.id || null, customMessage || null);
      } catch (err) {
        if (err.message?.includes('UNIQUE constraint')) {
          return interaction.reply({
            embeds: [errorEmbed(guildId, 'Streamer già presente', `**${username}** è già monitorato in questo server.`)],
            ephemeral: true,
          });
        }
        throw err;
      }

      const fields = [
        { name: '📺 Streamer', value: `[${username}](https://twitch.tv/${username})`, inline: true },
        { name: '📢 Canale', value: `<#${channel.id}>`, inline: true },
      ];
      if (pingRole) {
        fields.push({ name: '🔔 Ruolo Ping', value: `<@&${pingRole.id}>`, inline: true });
      }
      if (customMessage) {
        fields.push({ name: '💬 Messaggio Personalizzato', value: customMessage, inline: false });
      }

      return interaction.reply({
        embeds: [createEmbed(guildId, {
          title: '✅ Streamer aggiunto',
          description: `Le notifiche live per **${username}** verranno inviate in <#${channel.id}>.`,
          fields,
          color: '#9146FF',
        })],
        ephemeral: true,
      });
    }

    // ── Rimuovi streamer ───────────────────────────────────────
    if (sub === 'rimuovi') {
      const username = interaction.options.getString('username').toLowerCase().trim();

      const result = removeTwitchStreamer(guildId, username);

      if (result.changes === 0) {
        return interaction.reply({
          embeds: [errorEmbed(guildId, 'Streamer non trovato', `**${username}** non è tra gli streamer monitorati.`)],
          ephemeral: true,
        });
      }

      return interaction.reply({
        embeds: [createEmbed(guildId, {
          title: '🗑️ Streamer rimosso',
          description: `**${username}** non verrà più monitorato.`,
          color: '#9146FF',
        })],
        ephemeral: true,
      });
    }

    // ── Lista streamer ─────────────────────────────────────────
    if (sub === 'lista') {
      const streamers = getTwitchStreamers(guildId);

      if (streamers.length === 0) {
        return interaction.reply({
          embeds: [createEmbed(guildId, {
            title: '📺 Streamer Monitorati',
            description: 'Nessuno streamer configurato.\nUsa `/twitch-config aggiungi` per aggiungerne uno.',
            color: '#9146FF',
          })],
          ephemeral: true,
        });
      }

      const lines = streamers.map((s, i) => {
        let line = `**${i + 1}.** [${s.twitch_username}](https://twitch.tv/${s.twitch_username}) → <#${s.channel_id}>`;
        if (s.ping_role_id) line += ` | Ping: <@&${s.ping_role_id}>`;
        if (s.is_live) line += ' 🔴 LIVE';
        return line;
      });

      return interaction.reply({
        embeds: [createEmbed(guildId, {
          title: '📺 Streamer Monitorati',
          description: lines.join('\n'),
          color: '#9146FF',
          fields: [
            { name: '📊 Totale', value: `${streamers.length} streamer`, inline: true },
          ],
        })],
        ephemeral: true,
      });
    }
  },
};

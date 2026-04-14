// ═══════════════════════════════════════════════════════════════
//  /botadmin – Comandi riservati al proprietario del bot
//  Blocca/sblocca server, lista server bloccati
// ═══════════════════════════════════════════════════════════════

const { SlashCommandBuilder } = require('discord.js');
const { blockGuild, unblockGuild, isGuildBlocked, getBlockedGuilds } = require('../../database/db');
const { createEmbed, successEmbed, errorEmbed } = require('../../utils/embed');

const BOT_OWNER_ID = '790685206142124063';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('botadmin')
    .setDescription('🔐 Comandi riservati al proprietario del bot')
    .addSubcommand(sub =>
      sub.setName('blocca')
        .setDescription('Blocca un server dall\'utilizzo del bot')
        .addStringOption(opt =>
          opt.setName('server-id')
            .setDescription('ID del server da bloccare')
            .setRequired(true))
        .addStringOption(opt =>
          opt.setName('motivo')
            .setDescription('Motivo del blocco')))
    .addSubcommand(sub =>
      sub.setName('sblocca')
        .setDescription('Sblocca un server')
        .addStringOption(opt =>
          opt.setName('server-id')
            .setDescription('ID del server da sbloccare')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('lista')
        .setDescription('Mostra tutti i server bloccati')),

  async execute(interaction) {
    // Solo il proprietario del bot può usare questo comando
    if (interaction.user.id !== BOT_OWNER_ID) {
      return interaction.reply({
        embeds: [errorEmbed(interaction.guild?.id, '🔐 Accesso Negato', 'Questo comando è riservato al proprietario del bot.')],
        ephemeral: true,
      });
    }

    const sub = interaction.options.getSubcommand();

    switch (sub) {
      case 'blocca': {
        const guildId = interaction.options.getString('server-id');
        const reason = interaction.options.getString('motivo') || null;

        if (isGuildBlocked(guildId)) {
          return interaction.reply({
            embeds: [errorEmbed(interaction.guild?.id, '⚠️ Già Bloccato', `Il server \`${guildId}\` è già bloccato.`)],
            ephemeral: true,
          });
        }

        blockGuild(guildId, reason);

        const guild = interaction.client.guilds.cache.get(guildId);
        const guildName = guild ? guild.name : 'Sconosciuto';

        await interaction.reply({
          embeds: [successEmbed(interaction.guild?.id,
            '🔒 Server Bloccato',
            `**Server:** ${guildName} (\`${guildId}\`)\n**Motivo:** ${reason || 'Nessun motivo specificato'}`,
          )],
          ephemeral: true,
        });
        break;
      }

      case 'sblocca': {
        const guildId = interaction.options.getString('server-id');

        if (!isGuildBlocked(guildId)) {
          return interaction.reply({
            embeds: [errorEmbed(interaction.guild?.id, '⚠️ Non Bloccato', `Il server \`${guildId}\` non è bloccato.`)],
            ephemeral: true,
          });
        }

        unblockGuild(guildId);

        const guild = interaction.client.guilds.cache.get(guildId);
        const guildName = guild ? guild.name : 'Sconosciuto';

        await interaction.reply({
          embeds: [successEmbed(interaction.guild?.id,
            '🔓 Server Sbloccato',
            `**Server:** ${guildName} (\`${guildId}\`)`,
          )],
          ephemeral: true,
        });
        break;
      }

      case 'lista': {
        const blocked = getBlockedGuilds();

        if (blocked.length === 0) {
          return interaction.reply({
            embeds: [createEmbed(interaction.guild?.id, {
              title: '📋 Server Bloccati',
              description: 'Nessun server bloccato.',
            })],
            ephemeral: true,
          });
        }

        const lines = blocked.map((b, i) => {
          const guild = interaction.client.guilds.cache.get(b.guild_id);
          const name = guild ? guild.name : 'Non in cache';
          return `**${i + 1}.** ${name} (\`${b.guild_id}\`)\n> 📝 ${b.reason || 'Nessun motivo'} • <t:${Math.floor(new Date(b.blocked_at).getTime() / 1000)}:R>`;
        });

        await interaction.reply({
          embeds: [createEmbed(interaction.guild?.id, {
            title: `🔒 Server Bloccati (${blocked.length})`,
            description: lines.join('\n\n'),
          })],
          ephemeral: true,
        });
        break;
      }
    }
  },
};

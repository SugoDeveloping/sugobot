// ═══════════════════════════════════════════════════════════════
//  /ticket-stats – Statistiche del sistema ticket
// ═══════════════════════════════════════════════════════════════

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { getTicketStats } = require('../../database/db');
const { createEmbed } = require('../../utils/embed');
const { t } = require('../../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-stats')
    .setDescription('📊 Mostra le statistiche dei ticket')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  premium: 'tickets',

  async execute(interaction) {
    const { guild } = interaction;
    const stats = getTicketStats(guild.id);

    const embed = createEmbed(guild.id, {
      title: t(guild.id, 'tickets.stats_title'),
      thumbnail: guild.iconURL({ dynamic: true }),
      fields: [
        { name: t(guild.id, 'tickets.stats_total'), value: `\`${stats.total}\``, inline: true },
        { name: t(guild.id, 'tickets.stats_open'), value: `\`${stats.open}\``, inline: true },
        { name: t(guild.id, 'tickets.stats_closed'), value: `\`${stats.closed}\``, inline: true },
      ],
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

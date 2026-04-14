// ═══════════════════════════════════════════════════════════════
//  /assistenza-stats – Statistiche del sistema assistenza
// ═══════════════════════════════════════════════════════════════

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { getAssistenzaStats } = require('../../database/db');
const { createEmbed } = require('../../utils/embed');
const { t } = require('../../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('assistenza-stats')
    .setDescription('📊 Visualizza le statistiche del sistema assistenza')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  premium: 'assistenza',

  async execute(interaction) {
    const { guild } = interaction;
    const stats = getAssistenzaStats(guild.id);

    const embed = createEmbed(guild.id, {
      title: t(guild.id, 'assistenza.stats_title'),
      fields: [
        { name: t(guild.id, 'assistenza.stats_total'), value: `${stats.total}`, inline: true },
        { name: t(guild.id, 'assistenza.stats_pending'), value: `${stats.pending}`, inline: true },
        { name: t(guild.id, 'assistenza.stats_in_progress'), value: `${stats.inProgress}`, inline: true },
        { name: t(guild.id, 'assistenza.stats_closed'), value: `${stats.closed}`, inline: true },
        { name: t(guild.id, 'assistenza.stats_resolution_rate'), value: stats.total > 0 ? `${Math.round((stats.closed / stats.total) * 100)}%` : 'N/A', inline: true },
      ],
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

// ═══════════════════════════════════════════════════════════════
//  /clearwarns – Rimuovi avvertimenti di un utente
// ═══════════════════════════════════════════════════════════════

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embed');
const { clearWarnings, removeWarning, getWarnings, logModAction } = require('../../database/db');
const { t } = require('../../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearwarns')
    .setDescription('🗑️ Rimuovi avvertimenti di un utente')
    .addUserOption(opt =>
      opt.setName('utente')
        .setDescription('Utente di cui rimuovere gli avvertimenti')
        .setRequired(true))
    .addIntegerOption(opt =>
      opt.setName('id')
        .setDescription('ID specifico dell\'avvertimento da rimuovere (lascia vuoto per rimuoverli tutti)')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const { guild, member } = interaction;
    const targetUser = interaction.options.getUser('utente');
    const warningId = interaction.options.getInteger('id');

    if (warningId) {
      const result = removeWarning(warningId);
      if (result.changes === 0) {
        return interaction.reply({
          embeds: [errorEmbed(guild.id, t(guild.id, 'moderation.clearwarns_not_found'), t(guild.id, 'moderation.clearwarns_not_found_desc', { id: warningId }))],
          ephemeral: true,
        });
      }

      logModAction(guild.id, targetUser.id, member.id, 'REMOVE_WARN', `Rimosso warn #${warningId}`);

      return interaction.reply({
        embeds: [successEmbed(guild.id, t(guild.id, 'moderation.clearwarns_removed'), t(guild.id, 'moderation.clearwarns_removed_desc', { id: warningId }))],
      });
    }

    const warnings = getWarnings(guild.id, targetUser.id);
    if (warnings.length === 0) {
      return interaction.reply({
        embeds: [errorEmbed(guild.id, t(guild.id, 'moderation.clearwarns_none'), t(guild.id, 'moderation.clearwarns_none_desc', { user: targetUser.tag }))],
        ephemeral: true,
      });
    }

    clearWarnings(guild.id, targetUser.id);
    logModAction(guild.id, targetUser.id, member.id, 'CLEAR_WARNS', `Rimossi ${warnings.length} avvertimenti`);

    await interaction.reply({
      embeds: [successEmbed(guild.id, t(guild.id, 'moderation.clearwarns_all'), t(guild.id, 'moderation.clearwarns_all_desc', { user: targetUser.tag, count: warnings.length }))],
    });
  },
};

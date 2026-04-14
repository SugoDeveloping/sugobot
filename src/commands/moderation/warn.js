// ═══════════════════════════════════════════════════════════════
//  /warn – Avverti un utente
// ═══════════════════════════════════════════════════════════════

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embed');
const { canModerate } = require('../../utils/permissions');
const { addWarning, getWarnings, logModAction } = require('../../database/db');
const { sendModLog } = require('../../utils/logger');
const { t } = require('../../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('⚠️ Avverti un utente')
    .addUserOption(opt =>
      opt.setName('utente')
        .setDescription('Utente da avvertire')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('motivo')
        .setDescription('Motivo dell\'avvertimento')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const { guild, member } = interaction;
    const target = interaction.options.getMember('utente');
    const targetUser = interaction.options.getUser('utente');
    const reason = interaction.options.getString('motivo') || t(guild.id, 'common.reason_default');

    if (!target) {
      return interaction.reply({
        embeds: [errorEmbed(guild.id, t(guild.id, 'common.error'), t(guild.id, 'common.user_not_found'))],
        ephemeral: true,
      });
    }

    if (!canModerate(member, target)) {
      return interaction.reply({
        embeds: [errorEmbed(guild.id, t(guild.id, 'common.insufficient_perms'), t(guild.id, 'moderation.warn_no_perms'))],
        ephemeral: true,
      });
    }

    addWarning(guild.id, targetUser.id, member.id, reason);
    logModAction(guild.id, targetUser.id, member.id, 'WARN', reason);

    const warnings = getWarnings(guild.id, targetUser.id);
    const warnCount = warnings.length;

    // Notifica DM all'utente
    try {
      await targetUser.send({
        embeds: [errorEmbed(guild.id, t(guild.id, 'moderation.warn_dm'), t(guild.id, 'moderation.warn_dm_desc', { server: guild.name, reason, count: warnCount }))],
      });
    } catch (e) { /* DM chiusi */ }

    await sendModLog(guild, {
      title: t(guild.id, 'moderation.warn_log'),
      color: '#FEE75C',
      fields: [
        { name: t(guild.id, 'common.user'), value: `${targetUser.tag} (${targetUser.id})`, inline: true },
        { name: t(guild.id, 'common.moderator'), value: `<@${member.id}>`, inline: true },
        { name: t(guild.id, 'common.total'), value: `${warnCount}`, inline: true },
        { name: t(guild.id, 'common.reason'), value: reason, inline: false },
      ],
    });

    await interaction.reply({
      embeds: [successEmbed(guild.id, t(guild.id, 'moderation.warn_success'), t(guild.id, 'moderation.warn_success_desc', { user: targetUser.tag, reason, count: warnCount }))],
    });
  },
};

// ═══════════════════════════════════════════════════════════════
//  /kick – Espelli un utente dal server
// ═══════════════════════════════════════════════════════════════

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embed');
const { canModerate } = require('../../utils/permissions');
const { logModAction } = require('../../database/db');
const { sendModLog } = require('../../utils/logger');
const { t } = require('../../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('👢 Espelli un utente dal server')
    .addUserOption(opt =>
      opt.setName('utente')
        .setDescription('Utente da espellere')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('motivo')
        .setDescription('Motivo dell\'espulsione')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

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
        embeds: [errorEmbed(guild.id, t(guild.id, 'common.insufficient_perms'), t(guild.id, 'moderation.kick_no_perms'))],
        ephemeral: true,
      });
    }

    if (!target.kickable) {
      return interaction.reply({
        embeds: [errorEmbed(guild.id, t(guild.id, 'common.error'), t(guild.id, 'moderation.kick_bot_no_perms'))],
        ephemeral: true,
      });
    }

    try {
      await targetUser.send({
        embeds: [errorEmbed(guild.id, t(guild.id, 'moderation.kick_dm'), t(guild.id, 'moderation.kick_dm_desc', { server: guild.name, reason }))],
      });
    } catch (e) { /* DM chiusi */ }

    await target.kick(reason);
    logModAction(guild.id, targetUser.id, member.id, 'KICK', reason);

    await sendModLog(guild, {
      title: t(guild.id, 'moderation.kick_log'),
      fields: [
        { name: t(guild.id, 'common.user'), value: `${targetUser.tag} (${targetUser.id})`, inline: true },
        { name: t(guild.id, 'common.moderator'), value: `<@${member.id}>`, inline: true },
        { name: t(guild.id, 'common.reason'), value: reason, inline: false },
      ],
    });

    await interaction.reply({
      embeds: [successEmbed(guild.id, t(guild.id, 'moderation.kick_success'), t(guild.id, 'moderation.kick_success_desc', { user: targetUser.tag, reason }))],
    });
  },
};

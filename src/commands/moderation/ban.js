// ═══════════════════════════════════════════════════════════════
//  /ban – Banna un utente dal server
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
    .setName('ban')
    .setDescription('🔨 Banna un utente dal server')
    .addUserOption(opt =>
      opt.setName('utente')
        .setDescription('Utente da bannare')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('motivo')
        .setDescription('Motivo del ban')
        .setRequired(false))
    .addIntegerOption(opt =>
      opt.setName('giorni-messaggi')
        .setDescription('Elimina messaggi degli ultimi X giorni (0-7)')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const { guild, member } = interaction;
    const target = interaction.options.getMember('utente');
    const targetUser = interaction.options.getUser('utente');
    const reason = interaction.options.getString('motivo') || t(guild.id, 'common.reason_default');
    const days = interaction.options.getInteger('giorni-messaggi') || 0;

    if (!target) {
      // L'utente non è nel server, ban per ID
      try {
        await guild.members.ban(targetUser.id, { reason, deleteMessageDays: days });
        logModAction(guild.id, targetUser.id, member.id, 'BAN', reason);

        await sendModLog(guild, {
          title: t(guild.id, 'moderation.ban_log'),
          fields: [
            { name: t(guild.id, 'common.user'), value: `${targetUser.tag} (${targetUser.id})`, inline: true },
            { name: t(guild.id, 'common.moderator'), value: `<@${member.id}>`, inline: true },
            { name: t(guild.id, 'common.reason'), value: reason, inline: false },
          ],
        });

        return interaction.reply({
          embeds: [successEmbed(guild.id, t(guild.id, 'moderation.ban_success'), t(guild.id, 'moderation.ban_success_desc', { user: targetUser.tag, reason }))],
        });
      } catch (e) {
        return interaction.reply({
          embeds: [errorEmbed(guild.id, t(guild.id, 'common.error'), t(guild.id, 'moderation.ban_error'))],
          ephemeral: true,
        });
      }
    }

    if (!canModerate(member, target)) {
      return interaction.reply({
        embeds: [errorEmbed(guild.id, t(guild.id, 'common.insufficient_perms'), t(guild.id, 'moderation.ban_no_perms'))],
        ephemeral: true,
      });
    }

    if (!target.bannable) {
      return interaction.reply({
        embeds: [errorEmbed(guild.id, t(guild.id, 'common.error'), t(guild.id, 'moderation.ban_bot_no_perms'))],
        ephemeral: true,
      });
    }

    // DM all'utente
    try {
      await targetUser.send({
        embeds: [errorEmbed(guild.id, t(guild.id, 'moderation.ban_dm'), t(guild.id, 'moderation.ban_dm_desc', { server: guild.name, reason }))],
      });
    } catch (e) { /* DM chiusi */ }

    await target.ban({ reason, deleteMessageSeconds: days * 86400 });
    logModAction(guild.id, targetUser.id, member.id, 'BAN', reason);

    await sendModLog(guild, {
      title: t(guild.id, 'moderation.ban_log'),
      fields: [
        { name: t(guild.id, 'common.user'), value: `${targetUser.tag} (${targetUser.id})`, inline: true },
        { name: t(guild.id, 'common.moderator'), value: `<@${member.id}>`, inline: true },
        { name: t(guild.id, 'common.reason'), value: reason, inline: false },
      ],
    });

    await interaction.reply({
      embeds: [successEmbed(guild.id, t(guild.id, 'moderation.ban_success'), t(guild.id, 'moderation.ban_success_desc', { user: targetUser.tag, reason }))],
    });
  },
};

// ═══════════════════════════════════════════════════════════════
//  /mute – Muta un utente (timeout)
// ═══════════════════════════════════════════════════════════════

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const ms = require('ms');
const { successEmbed, errorEmbed } = require('../../utils/embed');
const { canModerate } = require('../../utils/permissions');
const { logModAction } = require('../../database/db');
const { sendModLog } = require('../../utils/logger');
const { t } = require('../../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('🔇 Muta un utente (timeout)')
    .addUserOption(opt =>
      opt.setName('utente')
        .setDescription('Utente da mutare')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('durata')
        .setDescription('Durata del muto (es. 10m, 1h, 1d, 7d)')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('motivo')
        .setDescription('Motivo del muto')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const { guild, member } = interaction;
    const target = interaction.options.getMember('utente');
    const targetUser = interaction.options.getUser('utente');
    const durationStr = interaction.options.getString('durata');
    const reason = interaction.options.getString('motivo') || t(guild.id, 'common.reason_default');

    if (!target) {
      return interaction.reply({
        embeds: [errorEmbed(guild.id, t(guild.id, 'common.error'), t(guild.id, 'common.user_not_found'))],
        ephemeral: true,
      });
    }

    const duration = ms(durationStr);
    if (!duration || duration < 1000 || duration > 28 * 24 * 60 * 60 * 1000) {
      return interaction.reply({
        embeds: [errorEmbed(guild.id, t(guild.id, 'moderation.mute_invalid_duration'), t(guild.id, 'moderation.mute_invalid_duration_desc'))],
        ephemeral: true,
      });
    }

    if (!canModerate(member, target)) {
      return interaction.reply({
        embeds: [errorEmbed(guild.id, t(guild.id, 'common.insufficient_perms'), t(guild.id, 'moderation.mute_no_perms'))],
        ephemeral: true,
      });
    }

    if (!target.moderatable) {
      return interaction.reply({
        embeds: [errorEmbed(guild.id, t(guild.id, 'common.error'), t(guild.id, 'moderation.mute_bot_no_perms'))],
        ephemeral: true,
      });
    }

    try {
      await targetUser.send({
        embeds: [errorEmbed(guild.id, t(guild.id, 'moderation.mute_dm'), t(guild.id, 'moderation.mute_dm_desc', { server: guild.name, duration: durationStr, reason }))],
      });
    } catch (e) { /* DM chiusi */ }

    await target.timeout(duration, reason);
    logModAction(guild.id, targetUser.id, member.id, 'MUTE', reason, durationStr);

    await sendModLog(guild, {
      title: t(guild.id, 'moderation.mute_log'),
      fields: [
        { name: t(guild.id, 'common.user'), value: `${targetUser.tag} (${targetUser.id})`, inline: true },
        { name: t(guild.id, 'common.moderator'), value: `<@${member.id}>`, inline: true },
        { name: t(guild.id, 'common.duration'), value: durationStr, inline: true },
        { name: t(guild.id, 'common.reason'), value: reason, inline: false },
      ],
    });

    await interaction.reply({
      embeds: [successEmbed(guild.id, t(guild.id, 'moderation.mute_success'), t(guild.id, 'moderation.mute_success_desc', { user: targetUser.tag, duration: durationStr, reason }))],
    });
  },
};

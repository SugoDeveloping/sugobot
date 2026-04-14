// ═══════════════════════════════════════════════════════════════
//  /unban – Rimuovi il ban di un utente
// ═══════════════════════════════════════════════════════════════

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embed');
const { logModAction } = require('../../database/db');
const { sendModLog } = require('../../utils/logger');
const { t } = require('../../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('🔓 Rimuovi il ban di un utente')
    .addStringOption(opt =>
      opt.setName('user-id')
        .setDescription('ID dell\'utente da sbannare')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('motivo')
        .setDescription('Motivo dello sban')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const { guild, member } = interaction;
    const userId = interaction.options.getString('user-id');
    const reason = interaction.options.getString('motivo') || t(guild.id, 'common.reason_default');

    try {
      const ban = await guild.bans.fetch(userId);
      await guild.members.unban(userId, reason);
      logModAction(guild.id, userId, member.id, 'UNBAN', reason);

      await sendModLog(guild, {
        title: t(guild.id, 'moderation.unban_log'),
        color: '#57F287',
        fields: [
          { name: t(guild.id, 'common.user'), value: `${ban.user.tag} (${userId})`, inline: true },
          { name: t(guild.id, 'common.moderator'), value: `<@${member.id}>`, inline: true },
          { name: t(guild.id, 'common.reason'), value: reason, inline: false },
        ],
      });

      await interaction.reply({
        embeds: [successEmbed(guild.id, t(guild.id, 'moderation.unban_success'), t(guild.id, 'moderation.unban_success_desc', { user: ban.user.tag, reason }))],
      });
    } catch (e) {
      await interaction.reply({
        embeds: [errorEmbed(guild.id, t(guild.id, 'common.error'), t(guild.id, 'moderation.unban_error'))],
        ephemeral: true,
      });
    }
  },
};

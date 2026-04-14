// ═══════════════════════════════════════════════════════════════
//  /unmute – Rimuovi il muto da un utente
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
    .setName('unmute')
    .setDescription('🔊 Rimuovi il muto da un utente')
    .addUserOption(opt =>
      opt.setName('utente')
        .setDescription('Utente da smutare')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('motivo')
        .setDescription('Motivo dello smuto')
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

    if (!target.isCommunicationDisabled()) {
      return interaction.reply({
        embeds: [errorEmbed(guild.id, t(guild.id, 'moderation.unmute_not_muted'), t(guild.id, 'moderation.unmute_not_muted_desc'))],
        ephemeral: true,
      });
    }

    await target.timeout(null, reason);
    logModAction(guild.id, targetUser.id, member.id, 'UNMUTE', reason);

    await sendModLog(guild, {
      title: t(guild.id, 'moderation.unmute_log'),
      color: '#57F287',
      fields: [
        { name: t(guild.id, 'common.user'), value: `${targetUser.tag} (${targetUser.id})`, inline: true },
        { name: t(guild.id, 'common.moderator'), value: `<@${member.id}>`, inline: true },
        { name: t(guild.id, 'common.reason'), value: reason, inline: false },
      ],
    });

    await interaction.reply({
      embeds: [successEmbed(guild.id, t(guild.id, 'moderation.unmute_success'), t(guild.id, 'moderation.unmute_success_desc', { user: targetUser.tag, reason }))],
    });
  },
};

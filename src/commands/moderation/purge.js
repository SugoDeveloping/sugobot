// ═══════════════════════════════════════════════════════════════
//  /purge – Elimina messaggi in massa
// ═══════════════════════════════════════════════════════════════

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embed');
const { sendModLog } = require('../../utils/logger');
const { t } = require('../../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('🗑️ Elimina messaggi in massa')
    .addIntegerOption(opt =>
      opt.setName('quantità')
        .setDescription('Numero di messaggi da eliminare (1-100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true))
    .addUserOption(opt =>
      opt.setName('utente')
        .setDescription('Elimina solo i messaggi di questo utente')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const { guild, channel, member } = interaction;
    const amount = interaction.options.getInteger('quantità');
    const targetUser = interaction.options.getUser('utente');

    await interaction.deferReply({ ephemeral: true });

    try {
      let deleted;

      if (targetUser) {
        // Fetch messaggi e filtra per utente
        const messages = await channel.messages.fetch({ limit: 100 });
        const filtered = messages.filter(m => m.author.id === targetUser.id).first(amount);
        deleted = await channel.bulkDelete(filtered, true);
      } else {
        deleted = await channel.bulkDelete(amount, true);
      }

      await sendModLog(guild, {
        title: t(guild.id, 'moderation.purge_log'),
        fields: [
          { name: t(guild.id, 'moderation.purge_log_channel'), value: `${channel}`, inline: true },
          { name: t(guild.id, 'moderation.purge_log_count'), value: `${deleted.size}`, inline: true },
          { name: t(guild.id, 'common.moderator'), value: `<@${member.id}>`, inline: true },
          ...(targetUser ? [{ name: t(guild.id, 'moderation.purge_log_filtered'), value: `${targetUser.tag}`, inline: true }] : []),
        ],
      });

      await interaction.editReply({
        embeds: [successEmbed(guild.id, t(guild.id, 'moderation.purge_success'), t(guild.id, 'moderation.purge_success_desc', { count: deleted.size, user: targetUser ? ` (${targetUser.tag})` : '' }))],
      });
    } catch (error) {
      await interaction.editReply({
        embeds: [errorEmbed(guild.id, t(guild.id, 'common.error'), t(guild.id, 'moderation.purge_error'))],
      });
    }
  },
};

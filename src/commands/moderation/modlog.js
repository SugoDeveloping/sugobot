// ═══════════════════════════════════════════════════════════════
//  /modlog – Visualizza lo storico azioni moderazione
// ═══════════════════════════════════════════════════════════════

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { createEmbed } = require('../../utils/embed');
const { getModActions } = require('../../database/db');
const { t } = require('../../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('modlog')
    .setDescription('📜 Visualizza lo storico delle azioni di moderazione su un utente')
    .addUserOption(opt =>
      opt.setName('utente')
        .setDescription('Utente di cui vedere lo storico')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const { guild } = interaction;
    const targetUser = interaction.options.getUser('utente');
    const actions = getModActions(guild.id, targetUser.id);

    if (actions.length === 0) {
      return interaction.reply({
        embeds: [createEmbed(guild.id, {
          title: t(guild.id, 'moderation.modlog_title'),
          description: t(guild.id, 'moderation.modlog_none', { user: targetUser.tag }),
          color: '#57F287',
        })],
        ephemeral: true,
      });
    }

    const actionEmojis = {
      BAN: '🔨', UNBAN: '🔓', KICK: '👢', MUTE: '🔇', UNMUTE: '🔊',
      WARN: '⚠️', REMOVE_WARN: '🗑️', CLEAR_WARNS: '🧹',
    };

    const list = actions.slice(0, 15).map(a =>
      `${actionEmojis[a.action] || '📌'} **${a.action}** – <t:${Math.floor(new Date(a.created_at).getTime() / 1000)}:R>\n> ${t(guild.id, 'moderation.modlog_moderator')}: <@${a.moderator_id}>\n> ${t(guild.id, 'common.reason')}: ${a.reason || 'N/A'}${a.duration ? `\n> ${t(guild.id, 'moderation.modlog_duration')}: ${a.duration}` : ''}`
    ).join('\n\n');

    const embed = createEmbed(guild.id, {
      title: t(guild.id, 'moderation.modlog_title_user', { user: targetUser.tag }),
      description: `**${t(guild.id, 'moderation.modlog_total')}:** ${actions.length}\n\n${list}`,
      thumbnail: targetUser.displayAvatarURL({ dynamic: true }),
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

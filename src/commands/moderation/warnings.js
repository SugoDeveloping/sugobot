// ═══════════════════════════════════════════════════════════════
//  /warnings – Mostra avvertimenti di un utente
// ═══════════════════════════════════════════════════════════════

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { createEmbed } = require('../../utils/embed');
const { getWarnings } = require('../../database/db');
const { t } = require('../../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('📋 Mostra gli avvertimenti di un utente')
    .addUserOption(opt =>
      opt.setName('utente')
        .setDescription('Utente di cui vedere gli avvertimenti')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const { guild } = interaction;
    const targetUser = interaction.options.getUser('utente');
    const warnings = getWarnings(guild.id, targetUser.id);

    if (warnings.length === 0) {
      return interaction.reply({
        embeds: [createEmbed(guild.id, {
          title: t(guild.id, 'moderation.warnings_title'),
          description: t(guild.id, 'moderation.warnings_none', { user: targetUser.tag }),
          color: '#57F287',
        })],
        ephemeral: true,
      });
    }

    const list = warnings.slice(0, 15).map((w, i) =>
      `**#${w.id}** – <t:${Math.floor(new Date(w.created_at).getTime() / 1000)}:R>\n> ${t(guild.id, 'moderation.warnings_moderator')}: <@${w.moderator_id}>\n> ${t(guild.id, 'moderation.warnings_reason')}: ${w.reason}`
    ).join('\n\n');

    const embed = createEmbed(guild.id, {
      title: t(guild.id, 'moderation.warnings_title_user', { user: targetUser.tag }),
      description: `**${t(guild.id, 'moderation.warnings_total')}:** ${warnings.length}\n\n${list}`,
      thumbnail: targetUser.displayAvatarURL({ dynamic: true }),
      color: warnings.length >= 3 ? '#ED4245' : '#FEE75C',
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

// ═══════════════════════════════════════════════════════════════
//  /slowmode – Imposta la modalità lenta del canale
// ═══════════════════════════════════════════════════════════════

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { successEmbed } = require('../../utils/embed');
const { t } = require('../../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('🐌 Imposta la modalità lenta del canale')
    .addIntegerOption(opt =>
      opt.setName('secondi')
        .setDescription('Secondi di cooldown (0 per disattivare)')
        .setMinValue(0)
        .setMaxValue(21600)
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const { guild, channel } = interaction;
    const seconds = interaction.options.getInteger('secondi');

    await channel.setRateLimitPerUser(seconds);

    const message = seconds === 0
      ? t(guild.id, 'moderation.slowmode_off')
      : t(guild.id, 'moderation.slowmode_on', { seconds });

    await interaction.reply({
      embeds: [successEmbed(guild.id, 'Slowmode', message)],
    });
  },
};

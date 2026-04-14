// ═══════════════════════════════════════════════════════════════
//  /ping – Latenza del bot
// ═══════════════════════════════════════════════════════════════

const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embed');
const { t } = require('../../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('🏓 Mostra la latenza del bot'),

  async execute(interaction) {
    const sent = await interaction.deferReply({ ephemeral: true, fetchReply: true });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const apiLatency = Math.round(interaction.client.ws.ping);

    const embed = createEmbed(interaction.guild?.id, {
      title: t(interaction.guild?.id, 'utility.ping_title'),
      fields: [
        { name: t(interaction.guild?.id, 'utility.ping_bot_latency'), value: `\`${latency}ms\``, inline: true },
        { name: t(interaction.guild?.id, 'utility.ping_api_latency'), value: `\`${apiLatency}ms\``, inline: true },
        { name: t(interaction.guild?.id, 'utility.ping_uptime'), value: `<t:${Math.floor((Date.now() - interaction.client.uptime) / 1000)}:R>`, inline: true },
      ],
    });

    await interaction.editReply({ embeds: [embed] });
  },
};

// ═══════════════════════════════════════════════════════════════
//  /whitelist-panel – Invia il pannello application whitelist
//  Crea un embed con bottone per applicare
// ═══════════════════════════════════════════════════════════════

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');
const {
  getWhitelistSettings,
  updateWhitelistSetting,
  getWhitelistQuestions,
} = require('../../database/db');
const { successEmbed, errorEmbed } = require('../../utils/embed');
const { t } = require('../../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whitelist-panel')
    .setDescription('📝 Invia il pannello application whitelist')
    .addChannelOption(opt =>
      opt.setName('canale')
        .setDescription('Canale dove inviare il pannello (default: canale corrente)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  premium: 'whitelist',

  async execute(interaction) {
    const { guild } = interaction;
    const gid = guild.id;
    const settings = getWhitelistSettings(gid);

    // Verifica che ci siano domande configurate
    const questions = getWhitelistQuestions(gid);
    if (questions.length === 0) {
      return interaction.reply({
        embeds: [errorEmbed(gid, t(gid, 'whitelist.panel_no_questions'), t(gid, 'whitelist.panel_no_questions_desc'))],
        ephemeral: true,
      });
    }

    // Verifica che il canale review sia configurato
    if (!settings.review_channel_id) {
      return interaction.reply({
        embeds: [errorEmbed(gid, t(gid, 'whitelist.panel_incomplete'), t(gid, 'whitelist.panel_incomplete_desc'))],
        ephemeral: true,
      });
    }

    const channel = interaction.options.getChannel('canale') || interaction.channel;

    // Crea l'embed del pannello
    const panelEmbed = new EmbedBuilder()
      .setTitle(settings.panel_title || 'Application')
      .setDescription(settings.panel_description || 'Click the button below to apply!')
      .setColor(settings.panel_color || '#5865F2')
      .setTimestamp();

    // Crea il bottone
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('whitelist_apply')
        .setLabel(t(gid, 'whitelist.panel_btn_apply'))
        .setStyle(ButtonStyle.Primary),
    );

    // Invia il pannello
    const panelMessage = await channel.send({
      embeds: [panelEmbed],
      components: [row],
    });

    // Salva le info del pannello
    updateWhitelistSetting(gid, 'panel_channel_id', channel.id);
    updateWhitelistSetting(gid, 'panel_message_id', panelMessage.id);

    return interaction.reply({
      embeds: [successEmbed(gid, t(gid, 'whitelist.panel_sent'), t(gid, 'whitelist.panel_sent_desc', { channel: channel.id }))],
      ephemeral: true,
    });
  },
};

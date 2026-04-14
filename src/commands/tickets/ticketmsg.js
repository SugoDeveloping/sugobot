// ═══════════════════════════════════════════════════════════════
//  /ticketmsg – Invia il pannello ticket con bottoni nel canale
//  Ogni bottone corrisponde a una categoria ticket configurata
// ═══════════════════════════════════════════════════════════════

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { createEmbed, successEmbed, errorEmbed } = require('../../utils/embed');
const { t } = require('../../utils/i18n');
const { getTicketCategories, updateGuildSetting } = require('../../database/db');
const { sendAsBot } = require('../../utils/webhook');

const BUTTON_STYLES = {
  Primary: ButtonStyle.Primary,
  Secondary: ButtonStyle.Secondary,
  Success: ButtonStyle.Success,
  Danger: ButtonStyle.Danger,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticketmsg')
    .setDescription('📋 Invia il pannello ticket con i bottoni delle categorie nel canale corrente')
    .addStringOption(opt =>
      opt.setName('titolo')
        .setDescription('Titolo del pannello (default: Sistema Ticket)')
        .setRequired(false))
    .addStringOption(opt =>
      opt.setName('descrizione')
        .setDescription('Descrizione del pannello')
        .setRequired(false))
    .addStringOption(opt =>
      opt.setName('colore')
        .setDescription('Colore dell\'embed (hex, es. #5865F2)')
        .setRequired(false))
    .addStringOption(opt =>
      opt.setName('immagine')
        .setDescription('URL immagine embed (opzionale)')
        .setRequired(false))
    .addStringOption(opt =>
      opt.setName('thumbnail')
        .setDescription('URL thumbnail embed (opzionale)')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  premium: 'tickets',

  async execute(interaction) {
    const { guild, channel } = interaction;

    // Prendi le categorie configurate
    const categories = getTicketCategories(guild.id);

    if (categories.length === 0) {
      return interaction.reply({
        embeds: [errorEmbed(guild.id, t(guild.id, 'tickets.panel_no_categories'), t(guild.id, 'tickets.panel_no_categories_desc'))],
        ephemeral: true,
      });
    }

    const categoriesList = categories.map(cat => `${cat.emoji} **${cat.name}**${cat.description ? ` – ${cat.description}` : ''}`).join('\n');
    const title = interaction.options.getString('titolo') || t(guild.id, 'tickets.panel_title');
    const description = interaction.options.getString('descrizione') || t(guild.id, 'tickets.panel_desc', { categories: categoriesList });
    const color = interaction.options.getString('colore') || undefined;
    const image = interaction.options.getString('immagine') || undefined;
    const thumbnail = interaction.options.getString('thumbnail') || guild.iconURL({ dynamic: true, size: 256 });

    // Crea embed
    const embed = createEmbed(guild.id, {
      title,
      description,
      color,
      image,
      thumbnail,
    });

    // Crea bottoni (max 5 per riga, max 5 righe = 25 bottoni)
    const rows = [];
    let currentRow = new ActionRowBuilder();
    let btnCount = 0;

    for (const cat of categories) {
      if (btnCount > 0 && btnCount % 5 === 0) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder();
      }

      const style = BUTTON_STYLES[cat.button_color] || ButtonStyle.Primary;

      const button = new ButtonBuilder()
        .setCustomId(`ticket_open_${cat.id}`)
        .setLabel(cat.name)
        .setStyle(style);

      // Aggiungi emoji solo se presente e valida
      if (cat.emoji) {
        try {
          button.setEmoji(cat.emoji);
        } catch (e) {
          // emoji non valida, skip
        }
      }

      currentRow.addComponents(button);
      btnCount++;

      // Max 25 bottoni (5 righe x 5)
      if (rows.length >= 4 && btnCount % 5 === 0) break;
    }

    if (currentRow.components.length > 0) {
      rows.push(currentRow);
    }

    // Invia il messaggio
    const panelMessage = await sendAsBot(channel, { embeds: [embed], components: rows }, interaction.client, guild.id);

    // Salva riferimento al pannello
    updateGuildSetting(guild.id, 'ticket_panel_channel_id', channel.id);
    updateGuildSetting(guild.id, 'ticket_panel_message_id', panelMessage.id);

    await interaction.reply({
      embeds: [successEmbed(guild.id, t(guild.id, 'tickets.panel_sent'), t(guild.id, 'tickets.panel_sent_desc', { channel, count: categories.length }))],
      ephemeral: true,
    });
  },
};

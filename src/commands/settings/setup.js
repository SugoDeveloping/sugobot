// ═══════════════════════════════════════════════════════════════
//  /setup – Configurazione generale del bot
// ═══════════════════════════════════════════════════════════════

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const { updateGuildSetting, getGuildSettings } = require('../../database/db');
const { successEmbed, createEmbed } = require('../../utils/embed');
const { t, SUPPORTED_LANGUAGES, LANGUAGE_NAMES, invalidateLanguageCache } = require('../../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('⚙️ Configurazione generale del bot')
    .addSubcommand(sub =>
      sub.setName('log-channel')
        .setDescription('Imposta il canale per i log generali')
        .addChannelOption(opt =>
          opt.setName('canale')
            .setDescription('Canale per i log')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('mod-log-channel')
        .setDescription('Imposta il canale per i log di moderazione')
        .addChannelOption(opt =>
          opt.setName('canale')
            .setDescription('Canale per i log moderazione')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('welcome')
        .setDescription('Configura il sistema di benvenuto')
        .addChannelOption(opt =>
          opt.setName('canale')
            .setDescription('Canale per i messaggi di benvenuto')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true))
        .addBooleanOption(opt =>
          opt.setName('abilitato')
            .setDescription('Abilita/disabilita il benvenuto')
            .setRequired(true))
        .addStringOption(opt =>
          opt.setName('messaggio')
            .setDescription('Messaggio ({user}, {username}, {server}, {membercount})')
            .setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('colore')
        .setDescription('Imposta il colore predefinito degli embed')
        .addStringOption(opt =>
          opt.setName('hex')
            .setDescription('Colore in formato hex (es. #5865F2)')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('nome-bot')
        .setDescription('Imposta il nome del bot nel footer degli embed')
        .addStringOption(opt =>
          opt.setName('nome')
            .setDescription('Nome del bot')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('icona')
        .setDescription('Imposta il logo/avatar del bot per questo server (appare nei messaggi)')
        .addStringOption(opt =>
          opt.setName('url')
            .setDescription('URL dell\'immagine (png/jpg/gif). Senza parametri = rimuovi logo.')
            .setRequired(false))
        .addAttachmentOption(opt =>
          opt.setName('immagine')
            .setDescription('Carica un\'immagine come logo del bot')
            .setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('lingua')
        .setDescription('🌐 Imposta la lingua del bot')
        .addStringOption(opt =>
          opt.setName('lingua')
            .setDescription('Lingua da impostare')
            .setRequired(true)
            .addChoices(
              ...SUPPORTED_LANGUAGES.map(l => ({ name: LANGUAGE_NAMES[l], value: l }))
            )))
    .addSubcommand(sub =>
      sub.setName('visualizza')
        .setDescription('Mostra tutte le impostazioni attuali'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const { guild } = interaction;
    const gid = guild.id;
    const sub = interaction.options.getSubcommand();

    switch (sub) {
      case 'log-channel': {
        const channel = interaction.options.getChannel('canale');
        updateGuildSetting(gid, 'log_channel_id', channel.id);
        await interaction.reply({
          embeds: [successEmbed(gid, t(gid, 'common.configured'), t(gid, 'setup.log_channel_set', { channel }))],
          ephemeral: true,
        });
        break;
      }

      case 'mod-log-channel': {
        const channel = interaction.options.getChannel('canale');
        updateGuildSetting(gid, 'mod_log_channel_id', channel.id);
        await interaction.reply({
          embeds: [successEmbed(gid, t(gid, 'common.configured'), t(gid, 'setup.mod_log_channel_set', { channel }))],
          ephemeral: true,
        });
        break;
      }

      case 'welcome': {
        const channel = interaction.options.getChannel('canale');
        const enabled = interaction.options.getBoolean('abilitato');
        const message = interaction.options.getString('messaggio');

        updateGuildSetting(gid, 'welcome_channel_id', channel.id);
        updateGuildSetting(gid, 'welcome_enabled', enabled ? 1 : 0);
        if (message) updateGuildSetting(gid, 'welcome_message', message);

        await interaction.reply({
          embeds: [successEmbed(gid, t(gid, 'setup.welcome_configured'), t(gid, 'setup.welcome_configured_desc', {
            channel,
            enabled: enabled ? t(gid, 'common.yes') : t(gid, 'common.no'),
            message: message ? `\n${t(gid, 'common.reason')}: ${message}` : '',
          }))],
          ephemeral: true,
        });
        break;
      }

      case 'colore': {
        const hex = interaction.options.getString('hex');
        if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
          return interaction.reply({
            embeds: [require('../../utils/embed').errorEmbed(gid, t(gid, 'setup.color_invalid'), t(gid, 'setup.color_invalid_desc'))],
            ephemeral: true,
          });
        }
        updateGuildSetting(gid, 'embed_color', hex);
        await interaction.reply({
          embeds: [successEmbed(gid, t(gid, 'setup.color_updated'), t(gid, 'setup.color_updated_desc', { hex }))],
          ephemeral: true,
        });
        break;
      }

      case 'nome-bot': {
        const name = interaction.options.getString('nome');
        updateGuildSetting(gid, 'bot_name', name);
        await interaction.reply({
          embeds: [successEmbed(gid, t(gid, 'setup.name_updated'), t(gid, 'setup.name_updated_desc', { name }))],
          ephemeral: true,
        });
        break;
      }

      case 'icona': {
        const url = interaction.options.getString('url');
        const attachment = interaction.options.getAttachment('immagine');

        let iconUrl = null;
        if (attachment) {
          if (!attachment.contentType?.startsWith('image/')) {
            return interaction.reply({
              embeds: [require('../../utils/embed').errorEmbed(gid, t(gid, 'setup.icon_invalid_format'), t(gid, 'setup.icon_invalid_format_desc'))],
              ephemeral: true,
            });
          }
          iconUrl = attachment.url;
        } else if (url) {
          if (!/^https?:\/\/.+\..+/.test(url)) {
            return interaction.reply({
              embeds: [require('../../utils/embed').errorEmbed(gid, t(gid, 'setup.icon_invalid_url'), t(gid, 'setup.icon_invalid_url_desc'))],
              ephemeral: true,
            });
          }
          iconUrl = url;
        }

        if (iconUrl) {
          updateGuildSetting(gid, 'bot_icon', iconUrl);
          const embed = successEmbed(gid, t(gid, 'setup.icon_updated'), t(gid, 'setup.icon_updated_desc'));
          embed.setThumbnail(iconUrl);
          await interaction.reply({ embeds: [embed], ephemeral: true });
        } else {
          updateGuildSetting(gid, 'bot_icon', null);
          await interaction.reply({
            embeds: [successEmbed(gid, t(gid, 'setup.icon_removed'), t(gid, 'setup.icon_removed_desc'))],
            ephemeral: true,
          });
        }
        break;
      }

      case 'lingua': {
        const lang = interaction.options.getString('lingua');
        updateGuildSetting(gid, 'language', lang);
        invalidateLanguageCache(gid);
        await interaction.reply({
          embeds: [successEmbed(gid, t(gid, 'setup.language_updated'), t(gid, 'setup.language_updated_desc', { lang: LANGUAGE_NAMES[lang] }))],
          ephemeral: true,
        });
        break;
      }

      case 'visualizza': {
        const settings = getGuildSettings(gid);
        const lang = LANGUAGE_NAMES[settings.language] || settings.language || 'it';
        const embed = createEmbed(gid, {
          title: t(gid, 'setup.settings_title'),
          thumbnail: guild.iconURL({ dynamic: true }),
          fields: [
            { name: t(gid, 'setup.general_log'), value: settings.log_channel_id ? `<#${settings.log_channel_id}>` : t(gid, 'common.not_set'), inline: true },
            { name: t(gid, 'setup.mod_log'), value: settings.mod_log_channel_id ? `<#${settings.mod_log_channel_id}>` : t(gid, 'common.not_set'), inline: true },
            { name: t(gid, 'setup.welcome'), value: settings.welcome_enabled ? `✅ <#${settings.welcome_channel_id}>` : t(gid, 'common.disabled'), inline: true },
            { name: t(gid, 'setup.embed_color'), value: settings.embed_color || '#5865F2', inline: true },
            { name: t(gid, 'setup.bot_name'), value: settings.bot_name || 'NicoDev Bot', inline: true },
            { name: t(gid, 'setup.bot_icon'), value: settings.bot_icon ? `[${t(gid, 'common.set_label')}](${settings.bot_icon})` : t(gid, 'common.not_set'), inline: true },
            { name: t(gid, 'setup.language'), value: lang, inline: true },
            { name: t(gid, 'setup.ticket_log'), value: settings.ticket_log_channel_id ? `<#${settings.ticket_log_channel_id}>` : t(gid, 'common.not_set'), inline: true },
            { name: t(gid, 'setup.support_role'), value: settings.ticket_support_role_id ? `<@&${settings.ticket_support_role_id}>` : t(gid, 'common.not_set'), inline: true },
            { name: t(gid, 'setup.transcript'), value: settings.auto_transcript ? '✅' : '❌', inline: true },
          ],
        });

        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }
    }
  },
};

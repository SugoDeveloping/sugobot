// ═══════════════════════════════════════════════════════════════
//  /verify-config – Configura il sistema di verifica captcha
// ═══════════════════════════════════════════════════════════════

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const { getVerifySettings, updateVerifySetting } = require('../../database/db');
const { successEmbed, errorEmbed, createEmbed } = require('../../utils/embed');
const { t } = require('../../utils/i18n');
const { sendVerifyPanel } = require('../../handlers/verifyHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify-config')
    .setDescription('🔒 Configura il sistema di verifica captcha')
    .addSubcommand(sub =>
      sub.setName('abilita')
        .setDescription('Abilita o disabilita il sistema di verifica')
        .addBooleanOption(opt =>
          opt.setName('stato')
            .setDescription('Abilitare il sistema?')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('ruolo')
        .setDescription('Imposta il ruolo da assegnare dopo la verifica')
        .addRoleOption(opt =>
          opt.setName('ruolo')
            .setDescription('Ruolo per gli utenti verificati')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('canale')
        .setDescription('Imposta il canale dove inviare il captcha')
        .addChannelOption(opt =>
          opt.setName('canale')
            .setDescription('Canale per la verifica')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('log-channel')
        .setDescription('Imposta il canale log per le verifiche')
        .addChannelOption(opt =>
          opt.setName('canale')
            .setDescription('Canale per i log delle verifiche')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('timeout')
        .setDescription('Imposta il tempo massimo per risolvere il captcha (secondi)')
        .addIntegerOption(opt =>
          opt.setName('secondi')
            .setDescription('Secondi disponibili (15-300)')
            .setMinValue(15)
            .setMaxValue(300)
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('kick-fallimento')
        .setDescription('Kicka automaticamente chi fallisce la verifica')
        .addBooleanOption(opt =>
          opt.setName('abilitato')
            .setDescription('Kickare al fallimento?')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('pannello')
        .setDescription('Invia il pannello di verifica nel canale configurato'))
    .addSubcommand(sub =>
      sub.setName('visualizza')
        .setDescription('Mostra la configurazione attuale del sistema di verifica'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  premium: 'verify',

  async execute(interaction) {
    const { guild } = interaction;
    const gid = guild.id;
    const sub = interaction.options.getSubcommand();

    switch (sub) {
      case 'abilita': {
        const enabled = interaction.options.getBoolean('stato');
        updateVerifySetting(gid, 'enabled', enabled ? 1 : 0);
        await interaction.reply({
          embeds: [successEmbed(gid, t(gid, 'verify.config_enabled'), t(gid, 'verify.config_enabled_desc', { enabled: enabled ? t(gid, 'common.enabled') : t(gid, 'common.disabled') }))],
          ephemeral: true,
        });
        break;
      }

      case 'ruolo': {
        const role = interaction.options.getRole('ruolo');
        updateVerifySetting(gid, 'role_id', role.id);
        await interaction.reply({
          embeds: [successEmbed(gid, t(gid, 'verify.config_role_set'), t(gid, 'verify.config_role_set_desc', { role: `<@&${role.id}>` }))],
          ephemeral: true,
        });
        break;
      }

      case 'canale': {
        const channel = interaction.options.getChannel('canale');
        updateVerifySetting(gid, 'channel_id', channel.id);
        await interaction.reply({
          embeds: [successEmbed(gid, t(gid, 'verify.config_channel_set'), t(gid, 'verify.config_channel_set_desc', { channel: `<#${channel.id}>` }))],
          ephemeral: true,
        });
        break;
      }

      case 'log-channel': {
        const channel = interaction.options.getChannel('canale');
        updateVerifySetting(gid, 'log_channel_id', channel.id);
        await interaction.reply({
          embeds: [successEmbed(gid, t(gid, 'verify.config_log_set'), t(gid, 'verify.config_log_set_desc', { channel: `<#${channel.id}>` }))],
          ephemeral: true,
        });
        break;
      }

      case 'timeout': {
        const seconds = interaction.options.getInteger('secondi');
        updateVerifySetting(gid, 'timeout_seconds', seconds);
        await interaction.reply({
          embeds: [successEmbed(gid, t(gid, 'verify.config_timeout_set'), t(gid, 'verify.config_timeout_set_desc', { seconds }))],
          ephemeral: true,
        });
        break;
      }

      case 'kick-fallimento': {
        const enabled = interaction.options.getBoolean('abilitato');
        updateVerifySetting(gid, 'kick_on_fail', enabled ? 1 : 0);
        await interaction.reply({
          embeds: [successEmbed(gid, t(gid, 'verify.config_kick_set'), t(gid, 'verify.config_kick_set_desc', { enabled: enabled ? t(gid, 'common.enabled') : t(gid, 'common.disabled') }))],
          ephemeral: true,
        });
        break;
      }

      case 'pannello': {
        await sendVerifyPanel(interaction);
        break;
      }

      case 'visualizza': {
        const settings = getVerifySettings(gid);
        const embed = createEmbed(gid, {
          title: t(gid, 'verify.config_title'),
          fields: [
            { name: t(gid, 'verify.config_view_status'), value: settings.enabled ? t(gid, 'verify.config_view_enabled') : t(gid, 'verify.config_view_disabled'), inline: true },
            { name: t(gid, 'verify.config_view_role'), value: settings.role_id ? `<@&${settings.role_id}>` : t(gid, 'verify.config_view_not_set'), inline: true },
            { name: t(gid, 'verify.config_view_channel'), value: settings.channel_id ? `<#${settings.channel_id}>` : t(gid, 'verify.config_view_not_set'), inline: true },
            { name: t(gid, 'verify.config_view_log'), value: settings.log_channel_id ? `<#${settings.log_channel_id}>` : t(gid, 'verify.config_view_not_set'), inline: true },
            { name: t(gid, 'verify.config_view_timeout'), value: `**${settings.timeout_seconds}s**`, inline: true },
            { name: t(gid, 'verify.config_view_kick'), value: settings.kick_on_fail ? t(gid, 'verify.config_view_enabled') : t(gid, 'verify.config_view_disabled'), inline: true },
          ],
        });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }
    }
  },
};

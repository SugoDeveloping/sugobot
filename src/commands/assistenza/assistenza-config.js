// ═══════════════════════════════════════════════════════════════
//  /assistenza-config – Configura il sistema assistenza
//  Solo per amministratori
// ═══════════════════════════════════════════════════════════════

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const { getAssistenzaSettings, updateAssistenzaSetting } = require('../../database/db');
const { successEmbed, errorEmbed, createEmbed } = require('../../utils/embed');
const { t } = require('../../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('assistenza-config')
    .setDescription('⚙️ Configura il sistema di richiesta assistenza')
    .addSubcommand(sub =>
      sub.setName('abilita')
        .setDescription('Abilita o disabilita il sistema assistenza')
        .addBooleanOption(opt =>
          opt.setName('stato')
            .setDescription('Abilitare il sistema?')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('canale')
        .setDescription('Imposta il canale dove arrivano le richieste di assistenza')
        .addChannelOption(opt =>
          opt.setName('canale')
            .setDescription('Canale per le richieste')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('log-channel')
        .setDescription('Imposta il canale log per le assistenze chiuse')
        .addChannelOption(opt =>
          opt.setName('canale')
            .setDescription('Canale per i log')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('ruolo-staff')
        .setDescription('Imposta il ruolo dello staff che gestisce le assistenze')
        .addRoleOption(opt =>
          opt.setName('ruolo')
            .setDescription('Ruolo staff assistenza')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('max-richieste')
        .setDescription('Numero massimo di richieste aperte per utente')
        .addIntegerOption(opt =>
          opt.setName('numero')
            .setDescription('Max richieste aperte (1-5)')
            .setMinValue(1)
            .setMaxValue(5)
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('messaggio')
        .setDescription('Imposta il messaggio di conferma per l\'utente')
        .addStringOption(opt =>
          opt.setName('testo')
            .setDescription('Messaggio ({user}, {username}, {server}, {subject})')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('cooldown')
        .setDescription('Imposta il cooldown tra le richieste (in minuti)')
        .addIntegerOption(opt =>
          opt.setName('minuti')
            .setDescription('Minuti di cooldown (0 = disabilitato)')
            .setMinValue(0)
            .setMaxValue(60)
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('promemoria')
        .setDescription('Imposta ogni quante ore inviare un promemoria per le richieste aperte')
        .addIntegerOption(opt =>
          opt.setName('ore')
            .setDescription('Ore tra un promemoria e l\'altro (0 = disabilitato)')
            .setMinValue(0)
            .setMaxValue(168)
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('visualizza')
        .setDescription('Mostra la configurazione attuale del sistema assistenza'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  premium: 'assistenza',

  async execute(interaction) {
    const { guild } = interaction;
    const sub = interaction.options.getSubcommand();

    switch (sub) {
      case 'abilita': {
        const enabled = interaction.options.getBoolean('stato');
        updateAssistenzaSetting(guild.id, 'enabled', enabled ? 1 : 0);
        await interaction.reply({
          embeds: [successEmbed(guild.id, t(guild.id, 'assistenza.config_enabled'), t(guild.id, 'assistenza.config_enabled_desc', { enabled }))],
          ephemeral: true,
        });
        break;
      }

      case 'canale': {
        const channel = interaction.options.getChannel('canale');
        updateAssistenzaSetting(guild.id, 'channel_id', channel.id);
        await interaction.reply({
          embeds: [successEmbed(guild.id, t(guild.id, 'assistenza.config_channel_set'), t(guild.id, 'assistenza.config_channel_set_desc', { channel }))],
          ephemeral: true,
        });
        break;
      }

      case 'log-channel': {
        const channel = interaction.options.getChannel('canale');
        updateAssistenzaSetting(guild.id, 'log_channel_id', channel.id);
        await interaction.reply({
          embeds: [successEmbed(guild.id, t(guild.id, 'assistenza.config_log_set'), t(guild.id, 'assistenza.config_log_set_desc', { channel }))],
          ephemeral: true,
        });
        break;
      }

      case 'ruolo-staff': {
        const role = interaction.options.getRole('ruolo');
        updateAssistenzaSetting(guild.id, 'staff_role_id', role.id);
        await interaction.reply({
          embeds: [successEmbed(guild.id, t(guild.id, 'assistenza.config_role_set'), t(guild.id, 'assistenza.config_role_set_desc', { role }))],
          ephemeral: true,
        });
        break;
      }

      case 'max-richieste': {
        const max = interaction.options.getInteger('numero');
        updateAssistenzaSetting(guild.id, 'max_open_per_user', max);
        await interaction.reply({
          embeds: [successEmbed(guild.id, t(guild.id, 'assistenza.config_max_set'), t(guild.id, 'assistenza.config_max_set_desc', { max }))],
          ephemeral: true,
        });
        break;
      }

      case 'messaggio': {
        const text = interaction.options.getString('testo');
        updateAssistenzaSetting(guild.id, 'welcome_message', text);
        const preview = text
          .replace(/{user}/g, `<@${interaction.user.id}>`)
          .replace(/{username}/g, interaction.user.username)
          .replace(/{server}/g, guild.name)
          .replace(/{subject}/g, 'Esempio oggetto');
        await interaction.reply({
          embeds: [successEmbed(guild.id, t(guild.id, 'assistenza.config_message_set'), t(guild.id, 'assistenza.config_message_set_desc', { preview }))],
          ephemeral: true,
        });
        break;
      }

      case 'cooldown': {
        const minutes = interaction.options.getInteger('minuti');
        updateAssistenzaSetting(guild.id, 'cooldown_minutes', minutes);
        await interaction.reply({
          embeds: [successEmbed(guild.id, t(guild.id, 'assistenza.config_cooldown_set'), t(guild.id, 'assistenza.config_cooldown_set_desc', { minutes }))],
          ephemeral: true,
        });
        break;
      }

      case 'promemoria': {
        const hours = interaction.options.getInteger('ore');
        updateAssistenzaSetting(guild.id, 'reminder_hours', hours);
        const msg = hours === 0
          ? t(guild.id, 'assistenza.config_reminder_off')
          : t(guild.id, 'assistenza.config_reminder_set_desc', { hours });
        await interaction.reply({
          embeds: [successEmbed(guild.id, t(guild.id, 'assistenza.config_reminder_set'), msg)],
          ephemeral: true,
        });
        break;
      }

      case 'visualizza': {
        const settings = getAssistenzaSettings(guild.id);
        const embed = createEmbed(guild.id, {
          title: t(guild.id, 'assistenza.config_title'),
          fields: [
            { name: t(guild.id, 'assistenza.config_view_status'), value: settings.enabled ? t(guild.id, 'assistenza.config_view_enabled') : t(guild.id, 'assistenza.config_view_disabled'), inline: true },
            { name: t(guild.id, 'assistenza.config_view_channel'), value: settings.channel_id ? `<#${settings.channel_id}>` : t(guild.id, 'assistenza.config_view_not_set'), inline: true },
            { name: t(guild.id, 'assistenza.config_view_log'), value: settings.log_channel_id ? `<#${settings.log_channel_id}>` : t(guild.id, 'assistenza.config_view_not_set'), inline: true },
            { name: t(guild.id, 'assistenza.config_view_role'), value: settings.staff_role_id ? `<@&${settings.staff_role_id}>` : t(guild.id, 'assistenza.config_view_not_set'), inline: true },
            { name: t(guild.id, 'assistenza.config_view_max'), value: `${settings.max_open_per_user}`, inline: true },
            { name: t(guild.id, 'assistenza.config_view_cooldown'), value: t(guild.id, 'assistenza.config_view_cooldown_val', { minutes: settings.cooldown_minutes }), inline: true },
            { name: t(guild.id, 'assistenza.config_view_reminder'), value: settings.reminder_hours ? t(guild.id, 'assistenza.config_view_reminder_val', { hours: settings.reminder_hours }) : t(guild.id, 'assistenza.config_view_disabled'), inline: true },
            { name: t(guild.id, 'assistenza.config_view_message'), value: `\`\`\`${settings.welcome_message || 'Default'}\`\`\``, inline: false },
          ],
        });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }
    }
  },
};

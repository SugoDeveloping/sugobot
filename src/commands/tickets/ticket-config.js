// ═══════════════════════════════════════════════════════════════
//  /ticket-config – Configura il sistema ticket
// ═══════════════════════════════════════════════════════════════

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const { updateGuildSetting, getGuildSettings } = require('../../database/db');
const { successEmbed, errorEmbed, createEmbed } = require('../../utils/embed');
const { t } = require('../../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-config')
    .setDescription('⚙️ Configura il sistema ticket')
    .addSubcommand(sub =>
      sub.setName('log-channel')
        .setDescription('Imposta il canale dove inviare le trascrizioni')
        .addChannelOption(opt =>
          opt.setName('canale')
            .setDescription('Canale per i log dei ticket')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('categoria')
        .setDescription('Imposta la categoria Discord per i ticket')
        .addChannelOption(opt =>
          opt.setName('categoria')
            .setDescription('Categoria per i canali ticket')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('ruolo-supporto')
        .setDescription('Imposta il ruolo dello staff di supporto')
        .addRoleOption(opt =>
          opt.setName('ruolo')
            .setDescription('Ruolo dello staff')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('messaggio')
        .setDescription('Imposta il messaggio di benvenuto nei ticket')
        .addStringOption(opt =>
          opt.setName('testo')
            .setDescription('Messaggio ({user}, {username}, {server}, {category})')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('trascrizione')
        .setDescription('Abilita/disabilita la trascrizione automatica')
        .addBooleanOption(opt =>
          opt.setName('abilitata')
            .setDescription('Abilita trascrizione automatica')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('dm-trascrizione')
        .setDescription('Abilita/disabilita invio trascrizione in DM all\'utente')
        .addBooleanOption(opt =>
          opt.setName('abilitata')
            .setDescription('Invia trascrizione in DM')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('promemoria')
        .setDescription('Imposta ogni quante ore inviare un promemoria per i ticket aperti')
        .addIntegerOption(opt =>
          opt.setName('ore')
            .setDescription('Ore tra un promemoria e l\'altro (0 = disabilitato)')
            .setMinValue(0)
            .setMaxValue(168)
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('formato-nome')
        .setDescription('Imposta il formato del nome dei canali ticket')
        .addStringOption(opt =>
          opt.setName('formato')
            .setDescription('{emoji} {categoria} {username} {numero} {id} – vuoto = reset default')
            .setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('visualizza')
        .setDescription('Mostra la configurazione attuale del sistema ticket'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  premium: 'tickets',

  async execute(interaction) {
    const { guild } = interaction;
    const sub = interaction.options.getSubcommand();

    switch (sub) {
      case 'log-channel': {
        const channel = interaction.options.getChannel('canale');
        updateGuildSetting(guild.id, 'ticket_log_channel_id', channel.id);
        await interaction.reply({
          embeds: [successEmbed(guild.id, t(guild.id, 'tickets.config_log_set'), t(guild.id, 'tickets.config_log_set_desc', { channel }))],
          ephemeral: true,
        });
        break;
      }

      case 'categoria': {
        const category = interaction.options.getChannel('categoria');
        updateGuildSetting(guild.id, 'ticket_category_id', category.id);
        await interaction.reply({
          embeds: [successEmbed(guild.id, t(guild.id, 'tickets.config_category_set'), t(guild.id, 'tickets.config_category_set_desc', { category: category.name }))],
          ephemeral: true,
        });
        break;
      }

      case 'ruolo-supporto': {
        const role = interaction.options.getRole('ruolo');
        updateGuildSetting(guild.id, 'ticket_support_role_id', role.id);
        await interaction.reply({
          embeds: [successEmbed(guild.id, t(guild.id, 'tickets.config_role_set'), t(guild.id, 'tickets.config_role_set_desc', { role }))],
          ephemeral: true,
        });
        break;
      }

      case 'messaggio': {
        const text = interaction.options.getString('testo');
        updateGuildSetting(guild.id, 'ticket_message', text);
        const preview = text.replace('{user}', `<@${interaction.user.id}>`).replace('{username}', interaction.user.username).replace('{server}', guild.name).replace('{category}', 'Esempio');
        await interaction.reply({
          embeds: [successEmbed(guild.id, t(guild.id, 'tickets.config_message_set'), t(guild.id, 'tickets.config_message_set_desc', { preview }))],
          ephemeral: true,
        });
        break;
      }

      case 'trascrizione': {
        const enabled = interaction.options.getBoolean('abilitata');
        updateGuildSetting(guild.id, 'auto_transcript', enabled ? 1 : 0);
        await interaction.reply({
          embeds: [successEmbed(guild.id, t(guild.id, 'tickets.config_transcript_set'), t(guild.id, 'tickets.config_transcript_set_desc', { enabled }))],
          ephemeral: true,
        });
        break;
      }

      case 'dm-trascrizione': {
        const enabled = interaction.options.getBoolean('abilitata');
        updateGuildSetting(guild.id, 'dm_transcript', enabled ? 1 : 0);
        await interaction.reply({
          embeds: [successEmbed(guild.id, t(guild.id, 'tickets.config_dm_set'), t(guild.id, 'tickets.config_dm_set_desc', { enabled }))],
          ephemeral: true,
        });
        break;
      }

      case 'promemoria': {
        const hours = interaction.options.getInteger('ore');
        updateGuildSetting(guild.id, 'ticket_reminder_hours', hours);
        const msg = hours === 0
          ? t(guild.id, 'tickets.config_reminder_off')
          : t(guild.id, 'tickets.config_reminder_set_desc', { hours });
        await interaction.reply({
          embeds: [successEmbed(guild.id, t(guild.id, 'tickets.config_reminder_set'), msg)],
          ephemeral: true,
        });
        break;
      }

      case 'formato-nome': {
        const format = interaction.options.getString('formato');
        if (!format) {
          updateGuildSetting(guild.id, 'ticket_name_format', null);
          await interaction.reply({
            embeds: [successEmbed(guild.id, t(guild.id, 'tickets.config_name_set'), t(guild.id, 'tickets.config_name_reset'))],
            ephemeral: true,
          });
        } else {
          updateGuildSetting(guild.id, 'ticket_name_format', format);
          const preview = format
            .replace(/{emoji}/g, '🎫')
            .replace(/{categoria}/g, 'supporto')
            .replace(/{username}/g, interaction.user.username)
            .replace(/{numero}/g, 'A1B2')
            .replace(/{id}/g, '42')
            .toLowerCase()
            .replace(/[^a-z0-9\-┃_]/g, '-')
            .replace(/-+/g, '-')
            .slice(0, 100);
          await interaction.reply({
            embeds: [successEmbed(guild.id, t(guild.id, 'tickets.config_name_set'), t(guild.id, 'tickets.config_name_set_desc', { format, preview }))],
            ephemeral: true,
          });
        }
        break;
      }

      case 'visualizza': {
        const settings = getGuildSettings(guild.id);
        const embed = createEmbed(guild.id, {
          title: t(guild.id, 'tickets.config_title'),
          fields: [
            { name: t(guild.id, 'tickets.config_view_log'), value: settings.ticket_log_channel_id ? `<#${settings.ticket_log_channel_id}>` : t(guild.id, 'tickets.config_view_not_set'), inline: true },
            { name: t(guild.id, 'tickets.config_view_category'), value: settings.ticket_category_id ? `<#${settings.ticket_category_id}>` : t(guild.id, 'tickets.config_view_not_set'), inline: true },
            { name: t(guild.id, 'tickets.config_view_role'), value: settings.ticket_support_role_id ? `<@&${settings.ticket_support_role_id}>` : t(guild.id, 'tickets.config_view_not_set'), inline: true },
            { name: t(guild.id, 'tickets.config_view_transcript'), value: settings.auto_transcript ? t(guild.id, 'tickets.config_view_enabled') : t(guild.id, 'tickets.config_view_disabled'), inline: true },
            { name: t(guild.id, 'tickets.config_view_dm'), value: settings.dm_transcript ? t(guild.id, 'tickets.config_view_enabled') : t(guild.id, 'tickets.config_view_disabled'), inline: true },
            { name: t(guild.id, 'tickets.config_view_reminder'), value: settings.ticket_reminder_hours ? t(guild.id, 'tickets.config_view_reminder_val', { hours: settings.ticket_reminder_hours }) : t(guild.id, 'tickets.config_view_disabled'), inline: true },
            { name: t(guild.id, 'tickets.config_view_name_format'), value: settings.ticket_name_format ? `\`${settings.ticket_name_format}\`` : 'Default', inline: true },
            { name: t(guild.id, 'tickets.config_view_message'), value: `\`\`\`${settings.ticket_message || 'Default'}\`\`\``, inline: false },
          ],
        });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }
    }
  },
};

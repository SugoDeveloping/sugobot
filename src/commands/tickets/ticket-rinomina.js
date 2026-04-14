// ═══════════════════════════════════════════════════════════════
//  /ticket-rinomina – Rinomina un canale ticket
// ═══════════════════════════════════════════════════════════════

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { getTicketByChannel, getGuildSettings } = require('../../database/db');
const { successEmbed, errorEmbed } = require('../../utils/embed');
const { t } = require('../../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-rinomina')
    .setDescription('✏️ Rinomina il canale del ticket corrente')
    .addStringOption(opt =>
      opt.setName('nome')
        .setDescription('Nuovo nome per il canale ticket')
        .setRequired(true)
        .setMaxLength(100))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  premium: 'tickets',

  async execute(interaction) {
    const { guild, channel, member } = interaction;
    const ticket = getTicketByChannel(channel.id);

    if (!ticket) {
      return interaction.reply({
        embeds: [errorEmbed(guild.id, t(guild.id, 'tickets.not_a_ticket'), t(guild.id, 'tickets.not_a_ticket_desc'))],
        ephemeral: true,
      });
    }

    if (ticket.status !== 'open') {
      return interaction.reply({
        embeds: [errorEmbed(guild.id, t(guild.id, 'tickets.rename_closed'), t(guild.id, 'tickets.rename_closed_desc'))],
        ephemeral: true,
      });
    }

    // Verifica permessi: staff o creatore del ticket
    const settings = getGuildSettings(guild.id);
    const isStaff = member.permissions.has(PermissionFlagsBits.ManageChannels) ||
      (settings.ticket_support_role_id && member.roles.cache.has(settings.ticket_support_role_id));

    if (!isStaff && ticket.user_id !== member.id) {
      return interaction.reply({
        embeds: [errorEmbed(guild.id, t(guild.id, 'tickets.rename_no_perms'), t(guild.id, 'tickets.rename_no_perms_desc'))],
        ephemeral: true,
      });
    }

    const newName = interaction.options.getString('nome');

    // Sanitizza il nome
    const sanitized = newName
      .toLowerCase()
      .replace(/[^a-z0-9\-┃_]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 100);

    if (!sanitized || sanitized.length < 1) {
      return interaction.reply({
        embeds: [errorEmbed(guild.id, t(guild.id, 'tickets.rename_invalid'), t(guild.id, 'tickets.rename_invalid_desc'))],
        ephemeral: true,
      });
    }

    const oldName = channel.name;

    try {
      await channel.setName(sanitized, `Rinominato da ${interaction.user.tag}`);
      await interaction.reply({
        embeds: [successEmbed(guild.id, t(guild.id, 'tickets.rename_success'), t(guild.id, 'tickets.rename_success_desc', { oldName, newName: sanitized }))],
      });
    } catch (error) {
      console.error('[Ticket] Errore rinomina:', error);
      await interaction.reply({
        embeds: [errorEmbed(guild.id, t(guild.id, 'common.error'), t(guild.id, 'tickets.rename_error'))],
        ephemeral: true,
      });
    }
  },
};

// ═══════════════════════════════════════════════════════════════
//  /ticket-add – Aggiungi/Rimuovi utente da un ticket
// ═══════════════════════════════════════════════════════════════

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { getTicketByChannel } = require('../../database/db');
const { successEmbed, errorEmbed } = require('../../utils/embed');
const { t } = require('../../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-add')
    .setDescription('👤 Aggiungi o rimuovi un utente dal ticket')
    .addSubcommand(sub =>
      sub.setName('aggiungi')
        .setDescription('Aggiungi un utente al ticket')
        .addUserOption(opt =>
          opt.setName('utente')
            .setDescription('Utente da aggiungere')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('rimuovi')
        .setDescription('Rimuovi un utente dal ticket')
        .addUserOption(opt =>
          opt.setName('utente')
            .setDescription('Utente da rimuovere')
            .setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  premium: 'tickets',

  async execute(interaction) {
    const { guild, channel } = interaction;
    const ticket = getTicketByChannel(channel.id);

    if (!ticket) {
      return interaction.reply({
        embeds: [errorEmbed(guild.id, t(guild.id, 'common.error'), t(guild.id, 'tickets.not_a_ticket'))],
        ephemeral: true,
      });
    }

    const user = interaction.options.getUser('utente');
    const sub = interaction.options.getSubcommand();

    if (sub === 'aggiungi') {
      await channel.permissionOverwrites.edit(user.id, {
        ViewChannel: true,
        SendMessages: true,
        AttachFiles: true,
        ReadMessageHistory: true,
      });

      await interaction.reply({
        embeds: [successEmbed(guild.id, t(guild.id, 'tickets.user_added'), t(guild.id, 'tickets.user_added_desc', { user: user.id }))],
      });
    } else {
      await channel.permissionOverwrites.delete(user.id);

      await interaction.reply({
        embeds: [successEmbed(guild.id, t(guild.id, 'tickets.user_removed'), t(guild.id, 'tickets.user_removed_desc', { user: user.id }))],
      });
    }
  },
};

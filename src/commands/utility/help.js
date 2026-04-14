// ═══════════════════════════════════════════════════════════════
//  /help – Mostra tutti i comandi del bot
// ═══════════════════════════════════════════════════════════════

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');
const { createEmbed } = require('../../utils/embed');
const { t } = require('../../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('📖 Mostra tutti i comandi disponibili'),

  async execute(interaction) {
    const { guild } = interaction;

    const mainEmbed = createEmbed(guild.id, {
      title: t(guild.id, 'utility.help_title'),
      description: t(guild.id, 'utility.help_desc'),
      thumbnail: interaction.client.user.displayAvatarURL({ dynamic: true }),
      fields: [
        { name: t(guild.id, 'utility.help_cat_tickets'), value: t(guild.id, 'utility.help_cat_tickets_desc'), inline: true },
        { name: t(guild.id, 'utility.help_cat_moderation'), value: t(guild.id, 'utility.help_cat_moderation_desc'), inline: true },
        { name: t(guild.id, 'utility.help_cat_newsletter'), value: t(guild.id, 'utility.help_cat_newsletter_desc'), inline: true },
        { name: t(guild.id, 'utility.help_cat_settings'), value: t(guild.id, 'utility.help_cat_settings_desc'), inline: true },
        { name: t(guild.id, 'utility.help_cat_reactionrole'), value: t(guild.id, 'utility.help_cat_reactionrole_desc'), inline: true },
        { name: t(guild.id, 'utility.help_cat_verify'), value: t(guild.id, 'utility.help_cat_verify_desc'), inline: true },
        { name: t(guild.id, 'utility.help_cat_utility'), value: t(guild.id, 'utility.help_cat_utility_desc'), inline: true },
      ],
    });

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('help_menu')
        .setPlaceholder(t(guild.id, 'utility.help_placeholder'))
        .addOptions([
          { label: t(guild.id, 'utility.help_cat_tickets'), value: 'help_ticket', emoji: '🎫', description: t(guild.id, 'utility.help_cat_tickets_desc') },
          { label: t(guild.id, 'utility.help_cat_moderation'), value: 'help_moderation', emoji: '🛡️', description: t(guild.id, 'utility.help_cat_moderation_desc') },
          { label: t(guild.id, 'utility.help_cat_newsletter'), value: 'help_newsletter', emoji: '📨', description: t(guild.id, 'utility.help_cat_newsletter_desc') },
          { label: t(guild.id, 'utility.help_cat_settings'), value: 'help_settings', emoji: '⚙️', description: t(guild.id, 'utility.help_cat_settings_desc') },
          { label: t(guild.id, 'utility.help_cat_reactionrole'), value: 'help_reactionrole', emoji: '🎭', description: t(guild.id, 'utility.help_cat_reactionrole_desc') },
          { label: t(guild.id, 'utility.help_cat_verify'), value: 'help_verify', emoji: '✅', description: t(guild.id, 'utility.help_cat_verify_desc') },
          { label: t(guild.id, 'utility.help_cat_utility'), value: 'help_utility', emoji: '🔧', description: t(guild.id, 'utility.help_cat_utility_desc') },
        ])
    );

    const reply = await interaction.reply({
      embeds: [mainEmbed],
      components: [row],
      ephemeral: true,
      fetchReply: true,
    });

    const collector = reply.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: 120000,
    });

    collector.on('collect', async (menuInteraction) => {
      const categories = {
        help_ticket: {
          title: t(guild.id, 'utility.help_ticket_title'),
          commands: [
            { name: '/ticket-category aggiungi', value: t(guild.id, 'utility.help_ticket_cat_add') },
            { name: '/ticket-category lista', value: t(guild.id, 'utility.help_ticket_cat_list') },
            { name: '/ticket-category rimuovi', value: t(guild.id, 'utility.help_ticket_cat_remove') },
            { name: '/ticketmsg', value: t(guild.id, 'utility.help_ticket_msg') },
            { name: '/ticket-config log-channel', value: t(guild.id, 'utility.help_ticket_log') },
            { name: '/ticket-config categoria', value: t(guild.id, 'utility.help_ticket_category') },
            { name: '/ticket-config ruolo-supporto', value: t(guild.id, 'utility.help_ticket_role') },
            { name: '/ticket-config messaggio', value: t(guild.id, 'utility.help_ticket_message') },
            { name: '/ticket-config trascrizione', value: t(guild.id, 'utility.help_ticket_transcript') },
            { name: '/ticket-config dm-trascrizione', value: t(guild.id, 'utility.help_ticket_dm_transcript') },
            { name: '/ticket-config visualizza', value: t(guild.id, 'utility.help_ticket_view') },
            { name: '/ticket-add aggiungi/rimuovi', value: t(guild.id, 'utility.help_ticket_add_remove') },
          ],
        },
        help_moderation: {
          title: t(guild.id, 'utility.help_mod_title'),
          commands: [
            { name: '/ban', value: t(guild.id, 'utility.help_mod_ban') },
            { name: '/unban', value: t(guild.id, 'utility.help_mod_unban') },
            { name: '/kick', value: t(guild.id, 'utility.help_mod_kick') },
            { name: '/mute', value: t(guild.id, 'utility.help_mod_mute') },
            { name: '/unmute', value: t(guild.id, 'utility.help_mod_unmute') },
            { name: '/warn', value: t(guild.id, 'utility.help_mod_warn') },
            { name: '/warnings', value: t(guild.id, 'utility.help_mod_warnings') },
            { name: '/clearwarns', value: t(guild.id, 'utility.help_mod_clearwarns') },
            { name: '/purge', value: t(guild.id, 'utility.help_mod_purge') },
            { name: '/slowmode', value: t(guild.id, 'utility.help_mod_slowmode') },
            { name: '/modlog', value: t(guild.id, 'utility.help_mod_modlog') },
          ],
        },
        help_newsletter: {
          title: t(guild.id, 'utility.help_newsletter_title'),
          commands: [
            { name: '/newsletter', value: t(guild.id, 'utility.help_newsletter_send') },
            { name: '/newsletter-history', value: t(guild.id, 'utility.help_newsletter_history') },
          ],
        },
        help_settings: {
          title: t(guild.id, 'utility.help_settings_title'),
          commands: [
            { name: '/setup log-channel', value: t(guild.id, 'utility.help_setup_log') },
            { name: '/setup mod-log-channel', value: t(guild.id, 'utility.help_setup_modlog') },
            { name: '/setup welcome', value: t(guild.id, 'utility.help_setup_welcome') },
            { name: '/setup colore', value: t(guild.id, 'utility.help_setup_color') },
            { name: '/setup nome-bot', value: t(guild.id, 'utility.help_setup_botname') },
            { name: '/setup lingua', value: t(guild.id, 'utility.help_setup_lang') },
            { name: '/setup visualizza', value: t(guild.id, 'utility.help_setup_view') },
          ],
        },
        help_reactionrole: {
          title: t(guild.id, 'utility.help_reactionrole_title'),
          commands: [
            { name: '/reactionrole aggiungi', value: t(guild.id, 'utility.help_rr_add') },
            { name: '/reactionrole pannello', value: t(guild.id, 'utility.help_rr_panel') },
            { name: '/reactionrole rimuovi', value: t(guild.id, 'utility.help_rr_remove') },
            { name: '/reactionrole lista', value: t(guild.id, 'utility.help_rr_list') },
          ],
        },
        help_verify: {
          title: t(guild.id, 'utility.help_verify_title'),
          commands: [
            { name: '/verify-config abilita', value: t(guild.id, 'utility.help_verify_enable') },
            { name: '/verify-config ruolo', value: t(guild.id, 'utility.help_verify_role') },
            { name: '/verify-config canale', value: t(guild.id, 'utility.help_verify_channel') },
            { name: '/verify-config log-channel', value: t(guild.id, 'utility.help_verify_log') },
            { name: '/verify-config timeout', value: t(guild.id, 'utility.help_verify_timeout') },
            { name: '/verify-config kick-fallimento', value: t(guild.id, 'utility.help_verify_kick') },
            { name: '/verify-config pannello', value: t(guild.id, 'utility.help_verify_panel') },
            { name: '/verify-config visualizza', value: t(guild.id, 'utility.help_verify_view') },
          ],
        },
        help_utility: {
          title: t(guild.id, 'utility.help_utility_title'),
          commands: [
            { name: '/help', value: t(guild.id, 'utility.help_utility_help') },
            { name: '/ping', value: t(guild.id, 'utility.help_utility_ping') },
            { name: '/userinfo', value: t(guild.id, 'utility.help_utility_userinfo') },
            { name: '/serverinfo', value: t(guild.id, 'utility.help_utility_serverinfo') },
          ],
        },
      };

      const category = categories[menuInteraction.values[0]];
      const embed = createEmbed(guild.id, {
        title: category.title,
        description: category.commands.map(c => `\`${c.name}\`\n> ${c.value}`).join('\n\n'),
      });

      await menuInteraction.update({ embeds: [embed], components: [row] });
    });
  },
};

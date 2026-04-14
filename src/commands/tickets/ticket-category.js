// ═══════════════════════════════════════════════════════════════
//  /ticket-category – Gestisci le categorie ticket
//  Ogni categoria diventa un bottone nel pannello /ticketmsg
// ═══════════════════════════════════════════════════════════════

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const { addTicketCategory, getTicketCategories, removeTicketCategory } = require('../../database/db');
const { successEmbed, errorEmbed, createEmbed } = require('../../utils/embed');
const { t } = require('../../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-category')
    .setDescription('📂 Gestisci le categorie del sistema ticket (ogni categoria = un bottone)')
    .addSubcommand(sub =>
      sub.setName('aggiungi')
        .setDescription('Aggiungi una nuova categoria ticket')
        .addStringOption(opt =>
          opt.setName('nome')
            .setDescription('Nome della categoria (sarà il testo del bottone)')
            .setRequired(true))
        .addRoleOption(opt =>
          opt.setName('ruolo1')
            .setDescription('Ruolo che può vedere i ticket di questa categoria')
            .setRequired(true))
        .addStringOption(opt =>
          opt.setName('emoji')
            .setDescription('Emoji del bottone (es. 🎫)')
            .setRequired(false))
        .addStringOption(opt =>
          opt.setName('descrizione')
            .setDescription('Descrizione della categoria')
            .setRequired(false))
        .addRoleOption(opt =>
          opt.setName('ruolo2')
            .setDescription('Secondo ruolo che può vedere i ticket (opzionale)')
            .setRequired(false))
        .addRoleOption(opt =>
          opt.setName('ruolo3')
            .setDescription('Terzo ruolo che può vedere i ticket (opzionale)')
            .setRequired(false))
        .addChannelOption(opt =>
          opt.setName('sezione')
            .setDescription('Categoria Discord dove creare i ticket')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(false))
        .addStringOption(opt =>
          opt.setName('messaggio')
            .setDescription('Messaggio automatico ({user}, {username}, {server}, {category})')
            .setRequired(false))
        .addStringOption(opt =>
          opt.setName('colore-bottone')
            .setDescription('Colore del bottone')
            .addChoices(
              { name: '🔵 Blu (Primary)', value: 'Primary' },
              { name: '⚪ Grigio (Secondary)', value: 'Secondary' },
              { name: '🟢 Verde (Success)', value: 'Success' },
              { name: '🔴 Rosso (Danger)', value: 'Danger' },
            )
            .setRequired(false))
        .addIntegerOption(opt =>
          opt.setName('max-aperti')
            .setDescription('Max ticket aperti per utente (default: 3)')
            .setMinValue(1)
            .setMaxValue(10)
            .setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('rimuovi')
        .setDescription('Rimuovi una categoria ticket')
        .addIntegerOption(opt =>
          opt.setName('id')
            .setDescription('ID della categoria da rimuovere (vedi /ticket-category lista)')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('lista')
        .setDescription('Mostra tutte le categorie ticket configurate'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  premium: 'tickets',

  async execute(interaction) {
    const { guild } = interaction;
    const sub = interaction.options.getSubcommand();

    switch (sub) {
      case 'aggiungi': {
        const name = interaction.options.getString('nome');
        const emoji = interaction.options.getString('emoji') || '🎫';
        const description = interaction.options.getString('descrizione') || null;
        const message = interaction.options.getString('messaggio') || null;
        const buttonColor = interaction.options.getString('colore-bottone') || 'Primary';
        const maxOpen = interaction.options.getInteger('max-aperti') || 3;
        const section = interaction.options.getChannel('sezione');

        // Raccogli tutti i ruoli
        const roles = [];
        const role1 = interaction.options.getRole('ruolo1');
        const role2 = interaction.options.getRole('ruolo2');
        const role3 = interaction.options.getRole('ruolo3');
        if (role1) roles.push(role1.id);
        if (role2) roles.push(role2.id);
        if (role3) roles.push(role3.id);

        addTicketCategory(
          guild.id, name, emoji, description, roles,
          message, section?.id || null, buttonColor, maxOpen
        );

        const rolesText = roles.map(r => `<@&${r}>`).join(', ');

        await interaction.reply({
          embeds: [successEmbed(guild.id, t(guild.id, 'tickets.cat_added'), t(guild.id, 'tickets.cat_added_desc', { emoji, name, rolesText, section: section ? section.name : 'Default', buttonColor, maxOpen }))],
          ephemeral: true,
        });
        break;
      }

      case 'rimuovi': {
        const id = interaction.options.getInteger('id');
        const result = removeTicketCategory(id);

        if (result.changes === 0) {
          return interaction.reply({
            embeds: [errorEmbed(guild.id, t(guild.id, 'tickets.cat_not_found'), t(guild.id, 'tickets.cat_not_found_desc', { id }))],
            ephemeral: true,
          });
        }

        await interaction.reply({
          embeds: [successEmbed(guild.id, t(guild.id, 'tickets.cat_removed'), t(guild.id, 'tickets.cat_removed_desc', { id }))],
          ephemeral: true,
        });
        break;
      }

      case 'lista': {
        const categories = getTicketCategories(guild.id);

        if (categories.length === 0) {
          return interaction.reply({
            embeds: [createEmbed(guild.id, {
              title: t(guild.id, 'tickets.cat_list_title'),
              description: t(guild.id, 'tickets.cat_list_none'),
            })],
            ephemeral: true,
          });
        }

        const list = categories.map(cat => {
          const roles = cat.support_roles.length > 0
            ? cat.support_roles.map(r => `<@&${r}>`).join(', ')
            : 'Nessuno';
          const colorEmoji = { Primary: '🔵', Secondary: '⚪', Success: '🟢', Danger: '🔴' };
          return (
            `**ID ${cat.id}** – ${cat.emoji} **${cat.name}**\n` +
            `> ${cat.description || 'Nessuna descrizione'}\n` +
            `> 👥 Ruoli: ${roles}\n` +
            `> 📂 Sezione: ${cat.discord_category_id ? `<#${cat.discord_category_id}>` : 'Default'}\n` +
            `> ${colorEmoji[cat.button_color] || '🔵'} Bottone: ${cat.button_color} | Max: ${cat.max_open_per_user}/utente`
          );
        }).join('\n\n');

        await interaction.reply({
          embeds: [createEmbed(guild.id, {
            title: t(guild.id, 'tickets.cat_list_title'),
            description: list + '\n\n*' + t(guild.id, 'tickets.cat_list_footer') + '*',
          })],
          ephemeral: true,
        });
        break;
      }
    }
  },
};

// ═══════════════════════════════════════════════════════════════
//  /whitelist-richieste – Visualizza le application in attesa
//  Solo il ruolo reviewer può usare questo comando
// ═══════════════════════════════════════════════════════════════

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const {
  getWhitelistSettings,
  getPendingWhitelistApplications,
  getWhitelistApplication,
} = require('../../database/db');
const { createEmbed, errorEmbed } = require('../../utils/embed');
const { t } = require('../../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whitelist-richieste')
    .setDescription('📋 Visualizza le application whitelist in attesa di revisione')
    .addSubcommand(sub =>
      sub.setName('lista')
        .setDescription('Mostra tutte le application in attesa'))
    .addSubcommand(sub =>
      sub.setName('dettaglio')
        .setDescription('Mostra le risposte di una specifica application')
        .addIntegerOption(opt =>
          opt.setName('id')
            .setDescription('ID della application')
            .setRequired(true)
            .setAutocomplete(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  premium: 'whitelist',

  async execute(interaction) {
    const { guild } = interaction;
    const gid = guild.id;
    const sub = interaction.options.getSubcommand();
    const settings = getWhitelistSettings(gid);

    // ─── Controllo ruolo reviewer ──────────────────────────────
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const hasReviewerRole = settings.reviewer_role_id
      && interaction.member.roles.cache.has(settings.reviewer_role_id);

    if (!isAdmin && !hasReviewerRole) {
      return interaction.reply({
        embeds: [errorEmbed(gid, t(gid, 'whitelist.no_perms_title'), t(gid, 'whitelist.req_no_perms'))],
        ephemeral: true,
      });
    }

    switch (sub) {
      // ─── Lista ──────────────────────────────────────────────
      case 'lista': {
        const applications = getPendingWhitelistApplications(gid);

        if (applications.length === 0) {
          return interaction.reply({
            embeds: [createEmbed(gid, {
              title: t(gid, 'whitelist.req_none_title'),
              description: t(gid, 'whitelist.req_none_desc'),
              color: '#5865F2',
            })],
            ephemeral: true,
          });
        }

        // Costruisci la lista (max 25 righe per non sforare il limite embed)
        const shown = applications.slice(0, 25);
        const lines = shown.map(app => {
          const ts = Math.floor(new Date(app.created_at).getTime() / 1000);
          return `> **#${app.id}** — <@${app.user_id}> — <t:${ts}:R>`;
        });

        if (applications.length > 25) {
          lines.push(`*... e altre ${applications.length - 25} richieste*`);
        }

        const embed = createEmbed(gid, {
          title: t(gid, 'whitelist.req_list_title'),
          description: [
            t(gid, 'whitelist.req_list_count', { count: applications.length }),
            '',
            lines.join('\n'),
          ].join('\n'),
        });

        embed.setFooter({ text: t(gid, 'whitelist.req_list_footer') });

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // ─── Dettaglio ──────────────────────────────────────────
      case 'dettaglio': {
        const id = interaction.options.getInteger('id');
        const application = getWhitelistApplication(id);

        if (!application || application.guild_id !== gid) {
          return interaction.reply({
            embeds: [errorEmbed(gid, t(gid, 'whitelist.not_found_title'), t(gid, 'whitelist.req_detail_not_found'))],
            ephemeral: true,
          });
        }

        if (application.status !== 'pending') {
          return interaction.reply({
            embeds: [errorEmbed(gid, t(gid, 'whitelist.already_processed_title'), t(gid, 'whitelist.req_detail_not_pending', { status: application.status }))],
            ephemeral: true,
          });
        }

        const ts = Math.floor(new Date(application.created_at).getTime() / 1000);

        const fields = [
          {
            name: t(gid, 'whitelist.req_detail_submitted'),
            value: `<t:${ts}:F>`,
            inline: false,
          },
          ...application.answers.map(a => ({
            name: a.question,
            value: a.answer || t(gid, 'whitelist.req_no_answer'),
            inline: false,
          })),
        ];

        const embed = createEmbed(gid, {
          title: t(gid, 'whitelist.req_detail_title', { id: application.id, user: `<@${application.user_id}>` }),
          fields,
        });

        // Bottoni approve/reject collegati al sistema esistente
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`whitelist_approve_${application.id}`)
            .setLabel(t(gid, 'whitelist.req_btn_approve'))
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`whitelist_reject_${application.id}`)
            .setLabel(t(gid, 'whitelist.req_btn_reject'))
            .setStyle(ButtonStyle.Danger),
        );

        return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      }
    }
  },

  // ─── Autocomplete per dettaglio ───────────────────────────
  async autocomplete(interaction) {
    const gid = interaction.guild.id;
    const settings = getWhitelistSettings(gid);

    // Stesso controllo ruolo anche sull'autocomplete
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const hasReviewerRole = settings.reviewer_role_id
      && interaction.member.roles.cache.has(settings.reviewer_role_id);

    if (!isAdmin && !hasReviewerRole) {
      return interaction.respond([]);
    }

    const applications = getPendingWhitelistApplications(gid);
    const focused = interaction.options.getFocused();

    const choices = applications
      .map(app => ({
        name: `#${app.id} — ${app.user_id}`.substring(0, 100),
        value: app.id,
      }))
      .filter(c => focused === '' || c.name.includes(focused));

    await interaction.respond(choices.slice(0, 25));
  },
};

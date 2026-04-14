// ═══════════════════════════════════════════════════════════════
//  /newsletter-history – Storico newsletter inviate
// ═══════════════════════════════════════════════════════════════

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { createEmbed } = require('../../utils/embed');
const { t } = require('../../utils/i18n');
const { getNewsletterHistory } = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('newsletter-history')
    .setDescription('📜 Mostra lo storico delle newsletter inviate')
    .addIntegerOption(opt =>
      opt.setName('limite')
        .setDescription('Numero massimo di risultati (default: 10)')
        .setMinValue(1)
        .setMaxValue(25)
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  premium: 'newsletter',

  async execute(interaction) {
    const { guild } = interaction;
    const limit   = interaction.options.getInteger('limite') || 10;
    const history = getNewsletterHistory(guild.id, limit);

    if (history.length === 0) {
      return interaction.reply({
        embeds: [createEmbed(guild.id, {
          title: t(guild.id, 'newsletter.history_title'),
          description: t(guild.id, 'newsletter.history_none'),
        })],
        ephemeral: true,
      });
    }

    // ── Paginazione (10 per pagina) ────────────────────────────
    const pages    = [];
    const perPage  = 5;
    for (let i = 0; i < history.length; i += perPage) {
      pages.push(history.slice(i, i + perPage));
    }

    let currentPage = 0;

    const buildPage = (pageIdx) => {
      const items = pages[pageIdx];
      const list  = items.map((n) => {
        const ts   = Math.floor(new Date(n.created_at).getTime() / 1000);
        const mode = n.target_channel_id
          ? `📢 <#${n.target_channel_id}>`
          : t(guild.id, 'newsletter.history_mode_dm');
        const ttl  = n.title || '—';
        return [
          `**#${n.id}** · ${ttl} · <t:${ts}:R>`,
          `> ${mode} | Ruolo: <@&${n.role_id}> | Da: <@${n.sent_by}>`,
          `> ✅ ${n.recipients_count} inviati · ❌ ${n.failed_count} falliti`,
          `> 📝 *${n.message.slice(0, 80)}${n.message.length > 80 ? '…' : ''}*`,
        ].join('\n');
      }).join('\n\n');

      return createEmbed(guild.id, {
        title: t(guild.id, 'newsletter.history_title'),
        description: list,
        footer: { text: `Pagina ${pageIdx + 1}/${pages.length} · ${history.length} risultati` },
      });
    };

    // Se una sola pagina, niente bottoni
    if (pages.length === 1) {
      return interaction.reply({ embeds: [buildPage(0)], ephemeral: true });
    }

    const navRow = () => new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('nh_prev')
        .setEmoji('◀️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === 0),
      new ButtonBuilder()
        .setCustomId('nh_next')
        .setEmoji('▶️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === pages.length - 1),
    );

    const reply = await interaction.reply({
      embeds: [buildPage(0)],
      components: [navRow()],
      ephemeral: true,
      fetchReply: true,
    });

    const collector = reply.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: 120_000,
    });

    collector.on('collect', async (btn) => {
      if (btn.customId === 'nh_prev' && currentPage > 0) currentPage--;
      if (btn.customId === 'nh_next' && currentPage < pages.length - 1) currentPage++;
      await btn.update({ embeds: [buildPage(currentPage)], components: [navRow()] });
    });

    collector.on('end', () => {
      interaction.editReply({ components: [] }).catch(() => {});
    });
  },
};

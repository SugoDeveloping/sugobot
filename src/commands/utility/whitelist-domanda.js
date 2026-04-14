// ═══════════════════════════════════════════════════════════════
//  /whitelist-domanda – Gestisci le domande del form whitelist
//  Aggiungi, rimuovi, lista, reset domande
// ═══════════════════════════════════════════════════════════════

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const {
  addWhitelistQuestion,
  getWhitelistQuestions,
  removeWhitelistQuestion,
  clearWhitelistQuestions,
} = require('../../database/db');
const { createEmbed, successEmbed, errorEmbed } = require('../../utils/embed');
const { t } = require('../../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whitelist-domanda')
    .setDescription('📝 Gestisci le domande del form whitelist')
    .addSubcommand(sub =>
      sub.setName('aggiungi')
        .setDescription('Aggiungi una domanda al form')
        .addStringOption(opt =>
          opt.setName('domanda')
            .setDescription('Testo della domanda')
            .setRequired(true))
        .addStringOption(opt =>
          opt.setName('tipo')
            .setDescription('Tipo di domanda')
            .setRequired(true)
            .addChoices(
              { name: 'Aperta (testo libero)', value: 'open' },
              { name: 'Chiusa (scelta tra opzioni)', value: 'closed' },
            ))
        .addStringOption(opt =>
          opt.setName('opzioni')
            .setDescription('Opzioni separate da virgola (solo per tipo chiusa, es. "Si, No, Forse")')
            .setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('rimuovi')
        .setDescription('Rimuovi una domanda dal form')
        .addIntegerOption(opt =>
          opt.setName('id')
            .setDescription('ID della domanda da rimuovere')
            .setRequired(true)
            .setAutocomplete(true)))
    .addSubcommand(sub =>
      sub.setName('lista')
        .setDescription('Mostra tutte le domande del form'))
    .addSubcommand(sub =>
      sub.setName('reset')
        .setDescription('Rimuovi tutte le domande del form'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  premium: 'whitelist',

  async execute(interaction) {
    const { guild } = interaction;
    const gid = guild.id;
    const sub = interaction.options.getSubcommand();

    switch (sub) {
      // ─── Aggiungi Domanda ───────────────────────────────────
      case 'aggiungi': {
        const questions = getWhitelistQuestions(gid);
        if (questions.length >= 5) {
          return interaction.reply({
            embeds: [errorEmbed(gid, t(gid, 'whitelist.q_limit_title'), t(gid, 'whitelist.q_limit_desc'))],
            ephemeral: true,
          });
        }

        const domanda = interaction.options.getString('domanda');
        const tipo = interaction.options.getString('tipo');
        const opzioniRaw = interaction.options.getString('opzioni');

        if (tipo === 'closed' && !opzioniRaw) {
          return interaction.reply({
            embeds: [errorEmbed(gid, t(gid, 'whitelist.q_missing_options'), t(gid, 'whitelist.q_missing_options_desc'))],
            ephemeral: true,
          });
        }

        const options = tipo === 'closed' && opzioniRaw
          ? opzioniRaw.split(',').map(o => o.trim()).filter(o => o.length > 0)
          : null;

        if (tipo === 'closed' && (!options || options.length < 2)) {
          return interaction.reply({
            embeds: [errorEmbed(gid, t(gid, 'whitelist.q_insufficient_options'), t(gid, 'whitelist.q_insufficient_options_desc'))],
            ephemeral: true,
          });
        }

        addWhitelistQuestion(gid, domanda, tipo, options);

        const desc = tipo === 'closed'
          ? t(gid, 'whitelist.q_added_closed', { question: domanda, options: options.join(', ') })
          : t(gid, 'whitelist.q_added_open', { question: domanda });

        return interaction.reply({
          embeds: [successEmbed(gid, t(gid, 'whitelist.q_added'), desc)],
          ephemeral: true,
        });
      }

      // ─── Rimuovi Domanda ────────────────────────────────────
      case 'rimuovi': {
        const id = interaction.options.getInteger('id');
        const result = removeWhitelistQuestion(id);

        if (result.changes === 0) {
          return interaction.reply({
            embeds: [errorEmbed(gid, t(gid, 'whitelist.q_not_found'), t(gid, 'whitelist.q_not_found_desc', { id }))],
            ephemeral: true,
          });
        }

        return interaction.reply({
          embeds: [successEmbed(gid, t(gid, 'whitelist.q_removed'), t(gid, 'whitelist.q_removed_desc', { id }))],
          ephemeral: true,
        });
      }

      // ─── Lista Domande ──────────────────────────────────────
      case 'lista': {
        const questions = getWhitelistQuestions(gid);

        if (questions.length === 0) {
          return interaction.reply({
            embeds: [errorEmbed(gid, t(gid, 'whitelist.q_none_title'), t(gid, 'whitelist.q_none_desc'))],
            ephemeral: true,
          });
        }

        const fields = questions.map((q, i) => ({
          name: `#${q.id} - Domanda ${i + 1} (${q.type === 'open' ? t(gid, 'whitelist.q_type_open') : t(gid, 'whitelist.q_type_closed')})`,
          value: q.type === 'closed'
            ? `${q.question}\n*Opzioni: ${q.options.join(', ')}*`
            : q.question,
          inline: false,
        }));

        const embed = createEmbed(gid, {
          title: t(gid, 'whitelist.q_list_title'),
          description: t(gid, 'whitelist.q_list_count', { count: questions.length }),
          fields,
        });

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // ─── Reset Domande ──────────────────────────────────────
      case 'reset': {
        clearWhitelistQuestions(gid);

        return interaction.reply({
          embeds: [successEmbed(gid, t(gid, 'whitelist.q_reset'), t(gid, 'whitelist.q_reset_desc'))],
          ephemeral: true,
        });
      }
    }
  },

  // ─── Autocomplete per rimuovi ─────────────────────────────
  async autocomplete(interaction) {
    const gid = interaction.guild.id;
    const questions = getWhitelistQuestions(gid);
    const focused = interaction.options.getFocused();

    const choices = questions
      .map(q => ({
        name: `#${q.id} - ${q.question}`.substring(0, 100),
        value: q.id,
      }))
      .filter(c => focused === '' || c.name.toLowerCase().includes(focused.toLowerCase()));

    await interaction.respond(choices.slice(0, 25));
  },
};

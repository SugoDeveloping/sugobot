const {
  ActionRowBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const {
  deleteGuildBuilderConfig,
  saveGuildBuilderConfig,
} = require('../../database/db');
const { successEmbed, errorEmbed } = require('../../utils/embed');
const {
  BUILDER_MODAL_ID,
  BUILDER_PRESETS,
  getBuilderPresetPayload,
  getSavedBuilderPayload,
  serializeBuilderStructure,
  createBuilderPreviewEmbed,
  createBuilderGuideEmbed,
  buildServerStructure,
  createBuilderResultEmbed,
  createNoConfigEmbed,
} = require('../../handlers/serverBuilderHandler');

function addPresetChoices(optionBuilder) {
  return optionBuilder.addChoices(
    ...Object.entries(BUILDER_PRESETS).map(([value, preset]) => ({
      name: preset.label,
      value,
    })),
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('server-builder')
    .setDescription('Crea rapidamente categorie, canali e permessi del server')
    .addSubcommand(sub =>
      sub.setName('preset')
        .setDescription('Salva un preset pronto all uso')
        .addStringOption(option =>
          addPresetChoices(
            option.setName('template')
              .setDescription('Preset da usare')
              .setRequired(true),
          ))
        .addBooleanOption(option =>
          option.setName('crea-subito')
            .setDescription('Applica subito il preset dopo averlo salvato')
            .setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('configura')
        .setDescription('Apri un modal per definire categorie, canali e permessi'))
    .addSubcommand(sub =>
      sub.setName('crea')
        .setDescription('Crea la struttura del server dalla configurazione salvata'))
    .addSubcommand(sub =>
      sub.setName('anteprima')
        .setDescription('Mostra la configurazione builder attualmente salvata'))
    .addSubcommand(sub =>
      sub.setName('guida')
        .setDescription('Mostra il formato rapido per categorie, canali e permessi'))
    .addSubcommand(sub =>
      sub.setName('reset')
        .setDescription('Rimuove la configurazione salvata del builder'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  premium: 'serverbuilder',

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    switch (subcommand) {
      case 'preset': {
        const presetKey = interaction.options.getString('template');
        const createNow = interaction.options.getBoolean('crea-subito') ?? false;
        const payload = getBuilderPresetPayload(presetKey);

        if (!payload) {
          await interaction.reply({
            embeds: [errorEmbed(guildId, 'Preset non trovato', 'Il preset selezionato non e disponibile.')],
            ephemeral: true,
          });
          return;
        }

        saveGuildBuilderConfig(guildId, payload, interaction.user.id);

        if (!createNow) {
          await interaction.reply({
            embeds: [
              successEmbed(guildId, 'Preset salvato', `Il preset ${payload.name} e ora la configurazione attiva.`),
              createBuilderPreviewEmbed(guildId, payload, 'Usa `/server-builder crea` per creare i canali.'),
            ],
            ephemeral: true,
          });
          return;
        }

        await interaction.deferReply({ ephemeral: true });

        try {
          const summary = await buildServerStructure(interaction.guild, payload);
          await interaction.editReply({
            embeds: [
              createBuilderResultEmbed(guildId, payload, summary, true),
              createBuilderPreviewEmbed(guildId, payload),
            ],
          });
        } catch (error) {
          await interaction.editReply({
            embeds: [errorEmbed(guildId, 'Builder fallito', error.message)],
          });
        }
        return;
      }

      case 'configura': {
        const savedPayload = getSavedBuilderPayload(guildId);
        const modal = new ModalBuilder()
          .setCustomId(BUILDER_MODAL_ID)
          .setTitle('Configura server builder');

        const templateNameInput = new TextInputBuilder()
          .setCustomId('builder_template_name')
          .setLabel('Nome template')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(100)
          .setRequired(false)
          .setPlaceholder('Esempio: Community personalizzata');

        if (savedPayload?.name) {
          templateNameInput.setValue(savedPayload.name.slice(0, 100));
        }

        const structureInput = new TextInputBuilder()
          .setCustomId('builder_structure')
          .setLabel('Struttura builder')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(4000)
          .setPlaceholder('[Info]\n# regole readonly\n\n[Staff] private\n# mod-log\n+ Meeting Staff');

        const serialized = serializeBuilderStructure(savedPayload?.config);
        if (serialized) {
          structureInput.setValue(serialized.slice(0, 4000));
        }

        modal.addComponents(
          new ActionRowBuilder().addComponents(templateNameInput),
          new ActionRowBuilder().addComponents(structureInput),
        );

        await interaction.showModal(modal);
        return;
      }

      case 'crea': {
        const savedPayload = getSavedBuilderPayload(guildId);
        if (!savedPayload) {
          await interaction.reply({
            embeds: [createNoConfigEmbed(guildId)],
            ephemeral: true,
          });
          return;
        }

        await interaction.deferReply({ ephemeral: true });

        try {
          const summary = await buildServerStructure(interaction.guild, savedPayload);
          await interaction.editReply({
            embeds: [
              createBuilderResultEmbed(guildId, savedPayload, summary),
              createBuilderPreviewEmbed(guildId, savedPayload),
            ],
          });
        } catch (error) {
          await interaction.editReply({
            embeds: [errorEmbed(guildId, 'Builder fallito', error.message)],
          });
        }
        return;
      }

      case 'anteprima': {
        const savedPayload = getSavedBuilderPayload(guildId);
        if (!savedPayload) {
          await interaction.reply({
            embeds: [createNoConfigEmbed(guildId)],
            ephemeral: true,
          });
          return;
        }

        await interaction.reply({
          embeds: [createBuilderPreviewEmbed(guildId, savedPayload)],
          ephemeral: true,
        });
        return;
      }

      case 'guida': {
        await interaction.reply({
          embeds: [createBuilderGuideEmbed(guildId)],
          ephemeral: true,
        });
        return;
      }

      case 'reset': {
        deleteGuildBuilderConfig(guildId);
        await interaction.reply({
          embeds: [successEmbed(guildId, 'Builder resettato', 'La configurazione salvata del server builder e stata rimossa.')],
          ephemeral: true,
        });
        return;
      }
    }
  },
};

// ═══════════════════════════════════════════════════════════════
//  /activate – Attiva funzionalità premium con una chiave
// ═══════════════════════════════════════════════════════════════

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { createEmbed, errorEmbed } = require('../../utils/embed');
const { PREMIUM_FEATURES } = require('../../utils/premium');
const {
  getPremiumKey,
  usePremiumKey,
  getPremiumGuild,
  setPremiumGuild,
  addPremiumFeature,
} = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('activate')
    .setDescription('🔑 Attiva funzionalità premium con una chiave di licenza')
    .addStringOption(opt =>
      opt.setName('key')
        .setDescription('La chiave di attivazione (es. NICO-XXXX-XXXX-XXXX)')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const { guild } = interaction;
    if (!guild) {
      return interaction.reply({
        embeds: [errorEmbed(null, 'Errore', 'Questo comando può essere usato solo in un server.')],
        ephemeral: true,
      });
    }

    const keyInput = interaction.options.getString('key').toUpperCase().trim();

    // ── Cerca la chiave ──────────────────────────────────────
    const keyData = getPremiumKey(keyInput);
    if (!keyData) {
      return interaction.reply({
        embeds: [errorEmbed(guild.id, '❌ Chiave non valida', 'La chiave inserita non esiste o è già stata utilizzata.')],
        ephemeral: true,
      });
    }

    // ── Attiva le funzionalità ───────────────────────────────
    const features = keyData.features;
    const isAll = features.includes('all');

    const existing = getPremiumGuild(guild.id);
    if (isAll) {
      setPremiumGuild(guild.id, ['all'], interaction.user.id, `Attivato con chiave ${keyInput}`);
    } else if (existing) {
      // Aggiungi le nuove funzionalità a quelle esistenti
      for (const feat of features) {
        addPremiumFeature(guild.id, feat);
      }
    } else {
      setPremiumGuild(guild.id, features, interaction.user.id, `Attivato con chiave ${keyInput}`);
    }

    // ── Marca la chiave come usata ───────────────────────────
    usePremiumKey(keyInput, guild.id, interaction.user.id);

    // ── Risposta ─────────────────────────────────────────────
    const featureList = isAll
      ? '⭐ **Tutte le funzionalità**'
      : features.map(f => `✅ ${PREMIUM_FEATURES[f] || f}`).join('\n');

    return interaction.reply({
      embeds: [createEmbed(guild.id, {
        title: '🎉 Premium attivato!',
        description: `La chiave è stata applicata con successo a **${guild.name}**!\n\n**Funzionalità sbloccate:**\n${featureList}\n\n*Grazie per aver scelto NicoDev Bot Premium!*`,
        color: '#FFD700',
      })],
      ephemeral: true,
    });
  },
};

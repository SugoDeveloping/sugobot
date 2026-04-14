// ═══════════════════════════════════════════════════════════════
//  /gestione – Gestione sistema premium (solo bot owner)
// ═══════════════════════════════════════════════════════════════

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { createEmbed, errorEmbed } = require('../../utils/embed');
const { PREMIUM_FEATURES, BOT_OWNER_ID } = require('../../utils/premium');
const {
  getPremiumGuild,
  setPremiumGuild,
  removePremiumGuild,
  getAllPremiumGuilds,
  addPremiumFeature,
  removePremiumFeature,
  createPremiumKey,
  getUnusedPremiumKeys,
  getAllPremiumKeys,
  deletePremiumKey,
} = require('../../database/db');
const crypto = require('crypto');

// ── Scelte funzionalità per autocomplete ─────────────────────
const featureChoices = [
  { name: '⭐ Tutte le funzionalità', value: 'all' },
  ...Object.entries(PREMIUM_FEATURES).map(([key, label]) => ({ name: label, value: key })),
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gestione')
    .setDescription('⭐ Gestione sistema premium (solo proprietario bot)')

    // ── /gestione abilita ────────────────────────────────────
    .addSubcommand(sub => sub
      .setName('abilita')
      .setDescription('Abilita una funzionalità premium per una guild')
      .addStringOption(opt =>
        opt.setName('guild')
          .setDescription('ID della guild')
          .setRequired(true))
      .addStringOption(opt =>
        opt.setName('funzione')
          .setDescription('Funzionalità da abilitare')
          .setRequired(true)
          .addChoices(...featureChoices)))

    // ── /gestione disabilita ─────────────────────────────────
    .addSubcommand(sub => sub
      .setName('disabilita')
      .setDescription('Disabilita una funzionalità premium per una guild')
      .addStringOption(opt =>
        opt.setName('guild')
          .setDescription('ID della guild')
          .setRequired(true))
      .addStringOption(opt =>
        opt.setName('funzione')
          .setDescription('Funzionalità da disabilitare (o "all" per rimuovere tutto)')
          .setRequired(true)
          .addChoices(...featureChoices)))

    // ── /gestione stato ──────────────────────────────────────
    .addSubcommand(sub => sub
      .setName('stato')
      .setDescription('Mostra lo stato premium di una guild')
      .addStringOption(opt =>
        opt.setName('guild')
          .setDescription('ID della guild (default: guild corrente)')
          .setRequired(false)))

    // ── /gestione lista ──────────────────────────────────────
    .addSubcommand(sub => sub
      .setName('lista')
      .setDescription('Mostra tutte le guild premium'))

    // ── /gestione genera-key ─────────────────────────────────
    .addSubcommand(sub => sub
      .setName('genera-key')
      .setDescription('Genera una chiave di attivazione premium')
      .addStringOption(opt =>
        opt.setName('funzione')
          .setDescription('Funzionalità da sbloccare con la chiave')
          .setRequired(true)
          .addChoices(...featureChoices))
      .addIntegerOption(opt =>
        opt.setName('quantita')
          .setDescription('Quante chiavi generare (default: 1)')
          .setMinValue(1)
          .setMaxValue(25)
          .setRequired(false)))

    // ── /gestione lista-key ──────────────────────────────────
    .addSubcommand(sub => sub
      .setName('lista-key')
      .setDescription('Mostra tutte le chiavi generate'))

    // ── /gestione elimina-key ────────────────────────────────
    .addSubcommand(sub => sub
      .setName('elimina-key')
      .setDescription('Elimina una chiave non usata')
      .addStringOption(opt =>
        opt.setName('key')
          .setDescription('La chiave da eliminare')
          .setRequired(true)))

    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    // ── Solo il proprietario del bot ──────────────────────────
    if (interaction.user.id !== BOT_OWNER_ID) {
      return interaction.reply({
        embeds: [errorEmbed(interaction.guild?.id, '⛔ Accesso negato', 'Solo il proprietario del bot può usare questo comando.')],
        ephemeral: true,
      });
    }

    const sub = interaction.options.getSubcommand();

    // ══════════════════════════════════════════════════════════
    //  ABILITA
    // ══════════════════════════════════════════════════════════
    if (sub === 'abilita') {
      const guildId = interaction.options.getString('guild');
      const feature = interaction.options.getString('funzione');

      if (feature === 'all') {
        setPremiumGuild(guildId, ['all'], interaction.user.id);
      } else {
        const existing = getPremiumGuild(guildId);
        if (existing) {
          addPremiumFeature(guildId, feature);
        } else {
          setPremiumGuild(guildId, [feature], interaction.user.id);
        }
      }

      const label = feature === 'all' ? '⭐ Tutte' : (PREMIUM_FEATURES[feature] || feature);
      const guild = interaction.client.guilds.cache.get(guildId);
      const guildName = guild ? guild.name : guildId;

      return interaction.reply({
        embeds: [createEmbed(interaction.guild?.id, {
          title: '✅ Premium abilitato',
          description: `**Guild:** ${guildName} (\`${guildId}\`)\n**Funzionalità:** ${label}`,
          color: '#57F287',
        })],
        ephemeral: true,
      });
    }

    // ══════════════════════════════════════════════════════════
    //  DISABILITA
    // ══════════════════════════════════════════════════════════
    if (sub === 'disabilita') {
      const guildId = interaction.options.getString('guild');
      const feature = interaction.options.getString('funzione');

      if (feature === 'all') {
        removePremiumGuild(guildId);
      } else {
        removePremiumFeature(guildId, feature);
      }

      const label = feature === 'all' ? '⭐ Tutte (rimosso premium)' : (PREMIUM_FEATURES[feature] || feature);
      return interaction.reply({
        embeds: [createEmbed(interaction.guild?.id, {
          title: '❌ Premium disabilitato',
          description: `**Guild:** \`${guildId}\`\n**Rimosso:** ${label}`,
          color: '#ED4245',
        })],
        ephemeral: true,
      });
    }

    // ══════════════════════════════════════════════════════════
    //  STATO
    // ══════════════════════════════════════════════════════════
    if (sub === 'stato') {
      const guildId = interaction.options.getString('guild') || interaction.guild?.id;
      if (!guildId) {
        return interaction.reply({
          embeds: [errorEmbed(interaction.guild?.id, 'Errore', 'Specifica un ID guild.')],
          ephemeral: true,
        });
      }

      const premium = getPremiumGuild(guildId);
      const guild = interaction.client.guilds.cache.get(guildId);
      const guildName = guild ? guild.name : guildId;

      if (!premium) {
        return interaction.reply({
          embeds: [createEmbed(interaction.guild?.id, {
            title: '📋 Stato Premium',
            description: `**${guildName}** (\`${guildId}\`)\n\n**Piano:** 🆓 Base (gratuito)\n\n**Funzionalità incluse:**\n> ✅ Messaggi di benvenuto\n> ✅ Sistema moderazione\n\n**Funzionalità premium (bloccate):**\n${Object.values(PREMIUM_FEATURES).map(f => `> 🔒 ${f}`).join('\n')}`,
          })],
          ephemeral: true,
        });
      }

      const isAll = premium.features.includes('all');
      const featureList = isAll
        ? Object.values(PREMIUM_FEATURES).map(f => `> ✅ ${f}`).join('\n')
        : Object.entries(PREMIUM_FEATURES).map(([key, label]) =>
            premium.features.includes(key) ? `> ✅ ${label}` : `> 🔒 ${label}`
          ).join('\n');

      return interaction.reply({
        embeds: [createEmbed(interaction.guild?.id, {
          title: '📋 Stato Premium',
          description: `**${guildName}** (\`${guildId}\`)\n\n**Piano:** ${isAll ? '⭐ Premium Completo' : '⭐ Premium Parziale'}\n**Attivato da:** <@${premium.activated_by}>\n**Data:** <t:${Math.floor(new Date(premium.activated_at).getTime() / 1000)}:R>\n${premium.notes ? `**Note:** ${premium.notes}\n` : ''}\n**Funzionalità base (sempre attive):**\n> ✅ Messaggi di benvenuto\n> ✅ Sistema moderazione\n\n**Funzionalità premium:**\n${featureList}`,
          color: '#FFD700',
        })],
        ephemeral: true,
      });
    }

    // ══════════════════════════════════════════════════════════
    //  LISTA
    // ══════════════════════════════════════════════════════════
    if (sub === 'lista') {
      const guilds = getAllPremiumGuilds();

      if (guilds.length === 0) {
        return interaction.reply({
          embeds: [createEmbed(interaction.guild?.id, {
            title: '⭐ Guild Premium',
            description: 'Nessuna guild premium registrata.',
          })],
          ephemeral: true,
        });
      }

      const list = guilds.map(g => {
        const guild = interaction.client.guilds.cache.get(g.guild_id);
        const name = guild ? guild.name : '???';
        const isAll = g.features.includes('all');
        const feats = isAll ? 'Tutte' : g.features.map(f => PREMIUM_FEATURES[f] || f).join(', ');
        return `**${name}** (\`${g.guild_id}\`)\n> ${isAll ? '⭐' : '📦'} ${feats}`;
      }).join('\n\n');

      return interaction.reply({
        embeds: [createEmbed(interaction.guild?.id, {
          title: `⭐ Guild Premium (${guilds.length})`,
          description: list.slice(0, 4000),
          color: '#FFD700',
        })],
        ephemeral: true,
      });
    }

    // ══════════════════════════════════════════════════════════
    //  GENERA-KEY
    // ══════════════════════════════════════════════════════════
    if (sub === 'genera-key') {
      const feature = interaction.options.getString('funzione');
      const qty     = interaction.options.getInteger('quantita') || 1;

      const features = feature === 'all' ? ['all'] : [feature];
      const keys = [];

      for (let i = 0; i < qty; i++) {
        const key = generateKey();
        createPremiumKey(key, features, interaction.user.id);
        keys.push(key);
      }

      const label = feature === 'all' ? '⭐ Tutte' : (PREMIUM_FEATURES[feature] || feature);

      return interaction.reply({
        embeds: [createEmbed(interaction.guild?.id, {
          title: `🔑 ${qty} Chiav${qty > 1 ? 'i' : 'e'} generat${qty > 1 ? 'e' : 'a'}`,
          description: `**Funzionalità:** ${label}\n\n${keys.map(k => `\`${k}\``).join('\n')}\n\n*Le chiavi possono essere usate con \`/activate\`*`,
          color: '#FFD700',
        })],
        ephemeral: true,
      });
    }

    // ══════════════════════════════════════════════════════════
    //  LISTA-KEY
    // ══════════════════════════════════════════════════════════
    if (sub === 'lista-key') {
      const allKeys = getAllPremiumKeys();

      if (allKeys.length === 0) {
        return interaction.reply({
          embeds: [createEmbed(interaction.guild?.id, {
            title: '🔑 Chiavi Premium',
            description: 'Nessuna chiave generata.',
          })],
          ephemeral: true,
        });
      }

      const unused = allKeys.filter(k => !k.used_at);
      const used   = allKeys.filter(k => k.used_at);

      let desc = '';
      if (unused.length > 0) {
        desc += `**📬 Non usate (${unused.length}):**\n`;
        desc += unused.map(k => {
          const feats = k.features.includes('all') ? 'Tutte' : k.features.map(f => PREMIUM_FEATURES[f] || f).join(', ');
          return `\`${k.key}\` → ${feats}`;
        }).join('\n');
      }

      if (used.length > 0) {
        desc += `\n\n**📭 Usate (${used.length}):**\n`;
        desc += used.slice(0, 10).map(k => {
          const feats = k.features.includes('all') ? 'Tutte' : k.features.map(f => PREMIUM_FEATURES[f] || f).join(', ');
          const ts = Math.floor(new Date(k.used_at).getTime() / 1000);
          return `~~\`${k.key}\`~~ → ${feats}\n> Usata da <@${k.used_by_user}> in \`${k.used_by_guild}\` <t:${ts}:R>`;
        }).join('\n');
        if (used.length > 10) desc += `\n*...e altre ${used.length - 10}*`;
      }

      return interaction.reply({
        embeds: [createEmbed(interaction.guild?.id, {
          title: `🔑 Chiavi Premium (${allKeys.length})`,
          description: desc.slice(0, 4000),
          color: '#FFD700',
        })],
        ephemeral: true,
      });
    }

    // ══════════════════════════════════════════════════════════
    //  ELIMINA-KEY
    // ══════════════════════════════════════════════════════════
    if (sub === 'elimina-key') {
      const key = interaction.options.getString('key');
      const result = deletePremiumKey(key);

      if (result.changes === 0) {
        return interaction.reply({
          embeds: [errorEmbed(interaction.guild?.id, 'Chiave non trovata', `La chiave \`${key}\` non esiste.`)],
          ephemeral: true,
        });
      }

      return interaction.reply({
        embeds: [createEmbed(interaction.guild?.id, {
          title: '🗑️ Chiave eliminata',
          description: `Chiave \`${key}\` rimossa con successo.`,
          color: '#ED4245',
        })],
        ephemeral: true,
      });
    }
  },
};

// ── Helper: genera chiave formato NICO-XXXX-XXXX-XXXX ───────
function generateKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segment = () => {
    let s = '';
    for (let i = 0; i < 4; i++) {
      s += chars[crypto.randomInt(chars.length)];
    }
    return s;
  };
  return `NICO-${segment()}-${segment()}-${segment()}`;
}

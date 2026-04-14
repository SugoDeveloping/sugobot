// ═══════════════════════════════════════════════════════════════
//  /scanuser – Scansiona utenti e crea liste riusabili per /newsletter
// ═══════════════════════════════════════════════════════════════

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  AttachmentBuilder,
} = require('discord.js');
const { createEmbed, errorEmbed } = require('../../utils/embed');
const {
  createScanList,
  getScanList,
  getAllScanLists,
  deleteScanList,
  updateScanListCount,
  addScanListUser,
  getScanListUsers,
  clearScanListUsers,
} = require('../../database/db');

const BOT_OWNER_ID = '790685206142124063';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('scanuser')
    .setDescription('🔍 Gestisci liste utenti per la newsletter')

    // ── /scanuser scansiona ──────────────────────────────────
    .addSubcommand(sub => sub
      .setName('scansiona')
      .setDescription('Scansiona tutti gli utenti di una guild e salvali in una lista')
      .addStringOption(opt =>
        opt.setName('nome')
          .setDescription('Nome della lista (es. "tutti", "clienti-vip")')
          .setRequired(true))
      .addStringOption(opt =>
        opt.setName('guildid')
          .setDescription('ID della guild da scansionare (default: guild corrente)')
          .setRequired(false))
      .addBooleanOption(opt =>
        opt.setName('includi-bot')
          .setDescription('Includi anche i bot nella lista (default: no)')
          .setRequired(false)))

    // ── /scanuser liste ──────────────────────────────────────
    .addSubcommand(sub => sub
      .setName('liste')
      .setDescription('Mostra tutte le liste salvate'))

    // ── /scanuser vedi ───────────────────────────────────────
    .addSubcommand(sub => sub
      .setName('vedi')
      .setDescription('Visualizza gli utenti di una lista ed esporta in JSON')
      .addStringOption(opt =>
        opt.setName('nome')
          .setDescription('Nome della lista')
          .setRequired(true)
          .setAutocomplete(true)))

    // ── /scanuser elimina ────────────────────────────────────
    .addSubcommand(sub => sub
      .setName('elimina')
      .setDescription('Elimina una lista salvata')
      .addStringOption(opt =>
        opt.setName('nome')
          .setDescription('Nome della lista da eliminare')
          .setRequired(true)
          .setAutocomplete(true)))

    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  premium: 'newsletter',

  // ── Autocomplete per nome lista ────────────────────────────
  async autocomplete(interaction) {
    const guildId = interaction.guildId;
    if (!guildId) return interaction.respond([]);

    const focused = interaction.options.getFocused().toLowerCase();
    const lists = getAllScanLists(guildId);

    const filtered = lists
      .filter(l => l.name.toLowerCase().includes(focused))
      .slice(0, 25)
      .map(l => ({ name: `${l.name} (${l.user_count} utenti)`, value: l.name }));

    return interaction.respond(filtered);
  },

  async execute(interaction) {
    const guildId = interaction.guildId;

    if (!guildId) {
      return interaction.reply({
        embeds: [errorEmbed(null, 'Comando non disponibile in DM', 'Usa `/scanuser` direttamente nel server in cui vuoi salvare la lista newsletter.')],
        ephemeral: true,
      });
    }
    // ── Solo il proprietario del bot ──────────────────────────
    if (interaction.user.id !== BOT_OWNER_ID) {
      return interaction.reply({
        embeds: [errorEmbed(interaction.guild?.id, '⛔ Accesso negato', 'Solo il proprietario del bot può usare questo comando.')],
        ephemeral: true,
      });
    }

    const sub = interaction.options.getSubcommand();

    // ══════════════════════════════════════════════════════════
    //  SCANSIONA
    // ══════════════════════════════════════════════════════════
    if (sub === 'scansiona') {
      const listName      = interaction.options.getString('nome').toLowerCase().trim();
      const targetGuildId = interaction.options.getString('guildid') || guildId;
      const includeBots   = interaction.options.getBoolean('includi-bot') ?? false;

      if (!targetGuildId) {
        return interaction.reply({
          embeds: [errorEmbed(guildId, 'Errore', 'Devi specificare un ID guild o usare il comando in un server.')],
          ephemeral: true,
        });
      }

      if (!/^[a-z0-9_-]+$/.test(listName)) {
        return interaction.reply({
          embeds: [errorEmbed(guildId, 'Nome non valido', 'Il nome della lista puo contenere solo lettere minuscole, numeri, trattini e underscore.')],
          ephemeral: true,
        });
      }

      await interaction.deferReply({ ephemeral: true });

      const targetGuild = await interaction.client.guilds.fetch(targetGuildId).catch(() => null);
      if (!targetGuild) {
        return interaction.editReply({
          embeds: [errorEmbed(guildId, 'Guild non trovata', `Il bot non e presente nella guild \`${targetGuildId}\`.`)],
        });
      }

      await interaction.editReply({
        embeds: [createEmbed(guildId, {
          title: '🔍 Scansione in corso...',
          description: `Recupero membri da **${targetGuild.name}**...\nLista: \`${listName}\``,
        })],
      });

      try {
        // Crea/aggiorna la lista
        createScanList(listName, guildId, targetGuildId, interaction.user.id);
        const list = getScanList(guildId, listName);

        // Pulisci utenti vecchi (riscansione)
        clearScanListUsers(list.id);

        // Fetch di tutti i membri
        const members = await targetGuild.members.fetch();
        let saved = 0;
        let skippedBots = 0;

        for (const [, member] of members) {
          if (!includeBots && member.user.bot) {
            skippedBots++;
            continue;
          }

          addScanListUser(
            list.id,
            member.user.id,
            member.user.username,
            member.displayName || member.user.username,
            member.user.bot,
          );
          saved++;
        }

        // Aggiorna conteggio
        updateScanListCount(list.id, saved);

        await interaction.editReply({
          embeds: [createEmbed(guildId, {
            title: '✅ Lista creata',
            description: `La lista **\`${listName}\`** e pronta per l'uso con \`/newsletter\`!`,
            fields: [
              { name: '📋 Lista',           value: `\`${listName}\``,       inline: true },
              { name: '🏠 Guild sorgente',  value: targetGuild.name,        inline: true },
              { name: '👥 Utenti salvati',  value: `${saved}`,              inline: true },
              { name: '🤖 Bot saltati',     value: `${skippedBots}`,        inline: true },
            ],
            color: '#57F287',
            footer: { text: 'Usa /newsletter lista:' + listName + ' per inviare a questa lista' },
          })],
        });

      } catch (err) {
        await interaction.editReply({
          embeds: [errorEmbed(guildId, 'Errore scansione', `Errore: ${err.message}`)],
        });
      }
    }

    // ══════════════════════════════════════════════════════════
    //  LISTE
    // ══════════════════════════════════════════════════════════
    if (sub === 'liste') {
      const lists = getAllScanLists(guildId);

      if (lists.length === 0) {
        return interaction.reply({
          embeds: [createEmbed(guildId, {
            title: '📋 Liste salvate',
            description: 'Nessuna lista salvata.\nUsa `/scanuser scansiona nome:<nome>` per crearne una.',
          })],
          ephemeral: true,
        });
      }

      const desc = lists.map(l => {
        const sourceGuild = interaction.client.guilds.cache.get(l.source_guild_id);
        const sourceName = sourceGuild ? sourceGuild.name : l.source_guild_id;
        const ts = Math.floor(new Date(l.created_at).getTime() / 1000);
        return `**\`${l.name}\`** — ${l.user_count} utenti\n> Sorgente: ${sourceName} · Creata <t:${ts}:R>`;
      }).join('\n\n');

      return interaction.reply({
        embeds: [createEmbed(guildId, {
          title: `📋 Liste salvate (${lists.length})`,
          description: desc.slice(0, 4000),
          color: '#5865F2',
          footer: { text: 'Usa /newsletter lista:<nome> per inviare a una lista' },
        })],
        ephemeral: true,
      });
    }

    // ══════════════════════════════════════════════════════════
    //  VEDI
    // ══════════════════════════════════════════════════════════
    if (sub === 'vedi') {
      const listName = interaction.options.getString('nome').toLowerCase().trim();
      const list = getScanList(guildId, listName);

      if (!list) {
        return interaction.reply({
          embeds: [errorEmbed(guildId, 'Lista non trovata', `La lista \`${listName}\` non esiste. Usa \`/scanuser liste\` per vedere quelle disponibili.`)],
          ephemeral: true,
        });
      }

      const users = getScanListUsers(list.id, false);
      const jsonData = JSON.stringify(users.map(u => ({
        user_id: u.user_id,
        username: u.username,
        display_name: u.display_name,
        is_bot: !!u.is_bot,
      })), null, 2);

      const attachment = new AttachmentBuilder(Buffer.from(jsonData, 'utf-8'), {
        name: `lista_${listName}.json`,
      });

      const preview = users.slice(0, 15).map(u => `\`${u.username}\` (${u.user_id})`).join('\n');
      const more = users.length > 15 ? `\n*...e altri ${users.length - 15}*` : '';

      return interaction.reply({
        embeds: [createEmbed(guildId, {
          title: `📋 Lista: ${listName}`,
          description: `**Utenti:** ${users.length}\n\n${preview}${more}`,
          color: '#5865F2',
        })],
        files: [attachment],
        ephemeral: true,
      });
    }

    // ══════════════════════════════════════════════════════════
    //  ELIMINA
    // ══════════════════════════════════════════════════════════
    if (sub === 'elimina') {
      const listName = interaction.options.getString('nome').toLowerCase().trim();
      const result = deleteScanList(guildId, listName);

      if (!result) {
        return interaction.reply({
          embeds: [errorEmbed(guildId, 'Lista non trovata', `La lista \`${listName}\` non esiste.`)],
          ephemeral: true,
        });
      }

      return interaction.reply({
        embeds: [createEmbed(guildId, {
          title: '🗑️ Lista eliminata',
          description: `La lista **\`${listName}\`** e stata eliminata.`,
          color: '#ED4245',
        })],
        ephemeral: true,
      });
    }
  },
};

// ═══════════════════════════════════════════════════════════════
//  /reactionrole – Gestisci i reaction roles
//  Aggiungi, rimuovi, lista e crea pannelli reaction role
// ═══════════════════════════════════════════════════════════════

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const {
  addReactionRole,
  removeReactionRolesByMessage,
  getReactionRolesByMessage,
  getReactionRolesByGuild,
} = require('../../database/db');
const { createEmbed, successEmbed, errorEmbed } = require('../../utils/embed');
const { sendAsBot } = require('../../utils/webhook');
const { t } = require('../../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('🎭 Gestisci i reaction roles')
    .addSubcommand(sub =>
      sub.setName('aggiungi')
        .setDescription('Aggiungi un reaction role ad un messaggio esistente')
        .addStringOption(opt =>
          opt.setName('message-id')
            .setDescription('ID del messaggio a cui aggiungere la reazione')
            .setRequired(true))
        .addRoleOption(opt =>
          opt.setName('ruolo')
            .setDescription('Ruolo da assegnare')
            .setRequired(true))
        .addStringOption(opt =>
          opt.setName('emoji')
            .setDescription('Emoji della reazione')
            .setRequired(true))
        .addStringOption(opt =>
          opt.setName('modalita')
            .setDescription('Modalità di assegnazione')
            .setRequired(false)
            .addChoices(
              { name: '🔄 Toggle (aggiungi/rimuovi)', value: 'toggle' },
              { name: '➕ Solo aggiungi', value: 'add' },
              { name: '🔒 Unico (rimuove altri del pannello)', value: 'unique' },
            )))
    .addSubcommand(sub =>
      sub.setName('pannello')
        .setDescription('Crea un nuovo pannello reaction roles con embed')
        .addStringOption(opt =>
          opt.setName('titolo')
            .setDescription('Titolo del pannello')
            .setRequired(true))
        .addStringOption(opt =>
          opt.setName('ruoli')
            .setDescription('Ruoli e emoji: emoji1=@Ruolo1, emoji2=@Ruolo2 (menziona i ruoli)')
            .setRequired(true))
        .addChannelOption(opt =>
          opt.setName('canale')
            .setDescription('Canale dove inviare il pannello')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false))
        .addStringOption(opt =>
          opt.setName('descrizione')
            .setDescription('Descrizione del pannello')
            .setRequired(false))
        .addStringOption(opt =>
          opt.setName('colore')
            .setDescription('Colore hex del pannello (es. #FF5733)')
            .setRequired(false))
        .addStringOption(opt =>
          opt.setName('modalita')
            .setDescription('Modalità per tutti i ruoli')
            .setRequired(false)
            .addChoices(
              { name: '🔄 Toggle (aggiungi/rimuovi)', value: 'toggle' },
              { name: '➕ Solo aggiungi', value: 'add' },
              { name: '🔒 Unico (un solo ruolo alla volta)', value: 'unique' },
            ))
        .addStringOption(opt =>
          opt.setName('immagine')
            .setDescription('URL immagine del pannello')
            .setRequired(false))
        .addStringOption(opt =>
          opt.setName('tipo')
            .setDescription('Tipo di interazione')
            .setRequired(false)
            .addChoices(
              { name: '🔘 Bottoni', value: 'buttons' },
              { name: '😀 Reazioni emoji', value: 'reactions' },
            )))
    .addSubcommand(sub =>
      sub.setName('rimuovi')
        .setDescription('Rimuovi tutti i reaction roles da un messaggio')
        .addStringOption(opt =>
          opt.setName('message-id')
            .setDescription('ID del messaggio')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('lista')
        .setDescription('Mostra tutti i reaction roles del server'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  premium: 'reactionroles',

  async execute(interaction) {
    const { guild } = interaction;
    const gid = guild.id;
    const sub = interaction.options.getSubcommand();

    switch (sub) {
      // ─── Aggiungi reaction role a messaggio esistente ──────
      case 'aggiungi': {
        const messageId = interaction.options.getString('message-id');
        const role = interaction.options.getRole('ruolo');
        const emoji = interaction.options.getString('emoji').trim();
        const mode = interaction.options.getString('modalita') || 'toggle';

        // Trova il messaggio nel canale corrente
        let targetMsg;
        try {
          targetMsg = await interaction.channel.messages.fetch(messageId);
        } catch {
          return interaction.reply({
            embeds: [errorEmbed(gid, t(gid, 'reactionrole.error'), t(gid, 'reactionrole.message_not_found'))],
            ephemeral: true,
          });
        }

        // Verifica che il ruolo sia assegnabile
        if (role.managed || role.id === guild.id) {
          return interaction.reply({
            embeds: [errorEmbed(gid, t(gid, 'reactionrole.error'), t(gid, 'reactionrole.role_not_assignable'))],
            ephemeral: true,
          });
        }

        // Salva nel DB
        addReactionRole(gid, interaction.channel.id, messageId, emoji, role.id, mode);

        // Aggiungi la reazione al messaggio
        try {
          await targetMsg.react(emoji);
        } catch {
          // Emoji custom o non valida — ignora
        }

        await interaction.reply({
          embeds: [successEmbed(gid, t(gid, 'reactionrole.added'), t(gid, 'reactionrole.added_desc', { emoji, role: `<@&${role.id}>`, mode }))],
          ephemeral: true,
        });
        break;
      }

      // ─── Crea pannello reaction roles ──────────────────────
      case 'pannello': {
        const title = interaction.options.getString('titolo');
        const rolesRaw = interaction.options.getString('ruoli');
        const channel = interaction.options.getChannel('canale') || interaction.channel;
        const description = interaction.options.getString('descrizione') || '';
        const color = interaction.options.getString('colore') || undefined;
        const mode = interaction.options.getString('modalita') || 'toggle';
        const image = interaction.options.getString('immagine') || undefined;
        const type = interaction.options.getString('tipo') || 'buttons';

        // Parsea ruoli: "emoji1=<@&id1>, emoji2=<@&id2>"
        const entries = rolesRaw.split(',').map(e => e.trim()).filter(Boolean);
        const parsed = [];

        for (const entry of entries) {
          const match = entry.match(/^(.+?)\s*=\s*<@&(\d+)>$/);
          if (!match) {
            return interaction.reply({
              embeds: [errorEmbed(gid, t(gid, 'reactionrole.error'), t(gid, 'reactionrole.invalid_format', { entry }))],
              ephemeral: true,
            });
          }
          const [, emojiStr, roleId] = match;
          const role = guild.roles.cache.get(roleId);
          if (!role || role.managed) {
            return interaction.reply({
              embeds: [errorEmbed(gid, t(gid, 'reactionrole.error'), t(gid, 'reactionrole.role_not_found', { id: roleId }))],
              ephemeral: true,
            });
          }
          parsed.push({ emoji: emojiStr.trim(), role });
        }

        if (parsed.length === 0 || parsed.length > 25) {
          return interaction.reply({
            embeds: [errorEmbed(gid, t(gid, 'reactionrole.error'), t(gid, 'reactionrole.invalid_count'))],
            ephemeral: true,
          });
        }

        await interaction.deferReply({ ephemeral: true });

        // Costruisci descrizione con i ruoli
        const rolesList = parsed.map(p => `${p.emoji} — <@&${p.role.id}>`).join('\n');
        const fullDesc = description
          ? `${description.replace(/\\n/g, '\n')}\n\n${rolesList}`
          : rolesList;

        const embed = createEmbed(gid, {
          title,
          description: fullDesc,
          color,
          image,
        });

        let sentMessage;

        if (type === 'buttons') {
          // Crea bottoni (max 5 per riga)
          const rows = [];
          let currentRow = new ActionRowBuilder();
          let btnCount = 0;

          for (const p of parsed) {
            if (btnCount > 0 && btnCount % 5 === 0) {
              rows.push(currentRow);
              currentRow = new ActionRowBuilder();
            }

            const btn = new ButtonBuilder()
              .setCustomId(`rr_${p.role.id}`)
              .setLabel(p.role.name)
              .setStyle(ButtonStyle.Secondary);

            // Prova ad aggiungere emoji
            try { btn.setEmoji(p.emoji); } catch { /* emoji invalida */ }

            currentRow.addComponents(btn);
            btnCount++;
          }
          if (btnCount > 0) rows.push(currentRow);

          sentMessage = await sendAsBot(channel, { embeds: [embed], components: rows }, interaction.client, gid);
        } else {
          // Tipo reazioni
          sentMessage = await sendAsBot(channel, { embeds: [embed] }, interaction.client, gid);

          // Aggiungi reazioni
          for (const p of parsed) {
            try { await sentMessage.react(p.emoji); } catch { /* ignora */ }
          }
        }

        // Salva nel DB
        for (const p of parsed) {
          addReactionRole(gid, channel.id, sentMessage.id, p.emoji, p.role.id, mode);
        }

        await interaction.editReply({
          embeds: [successEmbed(gid, t(gid, 'reactionrole.panel_sent'), t(gid, 'reactionrole.panel_sent_desc', { channel: `<#${channel.id}>`, count: parsed.length }))],
        });
        break;
      }

      // ─── Rimuovi reaction roles ────────────────────────────
      case 'rimuovi': {
        const messageId = interaction.options.getString('message-id');
        const result = removeReactionRolesByMessage(messageId);

        if (result.changes === 0) {
          return interaction.reply({
            embeds: [errorEmbed(gid, t(gid, 'reactionrole.error'), t(gid, 'reactionrole.none_found'))],
            ephemeral: true,
          });
        }

        await interaction.reply({
          embeds: [successEmbed(gid, t(gid, 'reactionrole.removed'), t(gid, 'reactionrole.removed_desc', { count: result.changes }))],
          ephemeral: true,
        });
        break;
      }

      // ─── Lista reaction roles ──────────────────────────────
      case 'lista': {
        const all = getReactionRolesByGuild(gid);

        if (all.length === 0) {
          return interaction.reply({
            embeds: [createEmbed(gid, {
              title: t(gid, 'reactionrole.list_title'),
              description: t(gid, 'reactionrole.list_none'),
            })],
            ephemeral: true,
          });
        }

        // Raggruppa per messaggio
        const grouped = {};
        for (const rr of all) {
          if (!grouped[rr.message_id]) grouped[rr.message_id] = [];
          grouped[rr.message_id].push(rr);
        }

        const lines = [];
        for (const [msgId, rrs] of Object.entries(grouped)) {
          const ch = rrs[0].channel_id;
          lines.push(`**<#${ch}> — \`${msgId}\`**`);
          for (const rr of rrs) {
            lines.push(`> ${rr.emoji} → <@&${rr.role_id}> (\`${rr.mode}\`)`);
          }
          lines.push('');
        }

        await interaction.reply({
          embeds: [createEmbed(gid, {
            title: t(gid, 'reactionrole.list_title'),
            description: lines.join('\n').slice(0, 4096),
          })],
          ephemeral: true,
        });
        break;
      }
    }
  },
};

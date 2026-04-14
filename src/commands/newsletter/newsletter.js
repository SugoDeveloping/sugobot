// ═══════════════════════════════════════════════════════════════
//  /newsletter – Invia un messaggio personalizzato a un ruolo, canale o lista
// ═══════════════════════════════════════════════════════════════

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelType,
} = require('discord.js');
const { createEmbed, errorEmbed, warnEmbed } = require('../../utils/embed');
const { t } = require('../../utils/i18n');
const {
  logNewsletter,
  getGuildSettings,
  getScanList,
  getScanListUsers,
  getAllScanLists,
} = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('newsletter')
    .setDescription('📨 Invia un messaggio personalizzato a un ruolo, canale o lista scansionata')
    .addStringOption(opt =>
      opt.setName('messaggio')
        .setDescription('Corpo del messaggio (usa \\n per andare a capo)')
        .setRequired(true))
    .addRoleOption(opt =>
      opt.setName('ruolo')
        .setDescription('Ruolo destinatario (alternativo a lista)')
        .setRequired(false))
    .addStringOption(opt =>
      opt.setName('lista')
        .setDescription('Nome di una lista salvata con /scanuser (alternativo a ruolo)')
        .setRequired(false)
        .setAutocomplete(true))
    .addStringOption(opt =>
      opt.setName('titolo')
        .setDescription('Titolo dell\'embed')
        .setRequired(false))
    .addStringOption(opt =>
      opt.setName('colore')
        .setDescription('Colore embed in esadecimale (es. #FF5733)')
        .setRequired(false))
    .addStringOption(opt =>
      opt.setName('immagine')
        .setDescription('URL immagine grande nell\'embed')
        .setRequired(false))
    .addStringOption(opt =>
      opt.setName('thumbnail')
        .setDescription('URL immagine piccola nell\'embed (in alto a destra)')
        .setRequired(false))
    .addStringOption(opt =>
      opt.setName('footer')
        .setDescription('Testo footer personalizzato')
        .setRequired(false))
    .addChannelOption(opt =>
      opt.setName('canale')
        .setDescription('Canale dove inviare (se omesso, invia in DM ai membri)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false))
    .addStringOption(opt =>
      opt.setName('url')
        .setDescription('URL cliccabile sul titolo dell\'embed')
        .setRequired(false))
    .addBooleanOption(opt =>
      opt.setName('menzione')
        .setDescription('Menziona il ruolo nel canale (solo modalità canale + ruolo)')
        .setRequired(false))
    .addBooleanOption(opt =>
      opt.setName('embed')
        .setDescription('Invia come embed decorato (default: sì)')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  premium: 'newsletter',

  // ── Autocomplete per nome lista ────────────────────────────
  async autocomplete(interaction) {
    const guildId = interaction.guild?.id;
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
    const { guild, member } = interaction;

    // Defer subito per evitare timeout (guild.members.fetch può essere lento)
    await interaction.deferReply({ ephemeral: true });

    // ── Parse opzioni ──────────────────────────────────────────
    const role       = interaction.options.getRole('ruolo');
    const listName   = interaction.options.getString('lista')?.toLowerCase().trim() || null;
    const rawMessage = interaction.options.getString('messaggio');
    const message    = rawMessage.replace(/\\n/g, '\n');
    const title      = interaction.options.getString('titolo') || '📨 Newsletter';
    const color      = interaction.options.getString('colore') || null;
    const imageUrl   = interaction.options.getString('immagine') || null;
    const thumbUrl   = interaction.options.getString('thumbnail') || null;
    const footerText = interaction.options.getString('footer') || null;
    const targetCh   = interaction.options.getChannel('canale') || null;
    const url        = interaction.options.getString('url') || null;
    const mention    = interaction.options.getBoolean('menzione') ?? false;
    const useEmbed   = interaction.options.getBoolean('embed') ?? true;

    // ── Validazione: serve almeno ruolo o lista ──────────────
    if (!role && !listName) {
      return interaction.editReply({
        embeds: [errorEmbed(guild.id, 'Destinatario mancante', 'Devi specificare almeno un **ruolo** o una **lista** (creata con `/scanuser`).')],
      });
    }

    if (role && listName) {
      return interaction.editReply({
        embeds: [errorEmbed(guild.id, 'Troppi destinatari', 'Scegli **o** un ruolo **o** una lista, non entrambi.')],
      });
    }

    // ── Validazioni formato ──────────────────────────────────
    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return interaction.editReply({
        embeds: [errorEmbed(guild.id, t(guild.id, 'newsletter.invalid_color'), t(guild.id, 'newsletter.invalid_color_desc'))],
      });
    }
    const urlRe = /^https?:\/\/.+/i;
    for (const [label, val] of [['immagine', imageUrl], ['thumbnail', thumbUrl], ['url', url]]) {
      if (val && !urlRe.test(val)) {
        return interaction.editReply({
          embeds: [errorEmbed(guild.id, t(guild.id, 'newsletter.invalid_url', { label }), t(guild.id, 'newsletter.invalid_url_desc'))],
        });
      }
    }

    // ── Risolvi lista se usata ───────────────────────────────
    let scanList = null;
    let listUsers = [];
    if (listName) {
      scanList = getScanList(guild.id, listName);
      if (!scanList) {
        return interaction.editReply({
          embeds: [errorEmbed(guild.id, 'Lista non trovata', `La lista \`${listName}\` non esiste.\nUsa \`/scanuser liste\` per vedere quelle disponibili.`)],
        });
      }
      listUsers = getScanListUsers(scanList.id, true); // escludi bot
      if (listUsers.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed(guild.id, t(guild.id, 'newsletter.no_recipients'), `La lista \`${listName}\` non contiene utenti (non-bot).`)],
        });
      }
    }

    const isChannelMode = !!targetCh;
    const isListMode    = !!scanList;
    const settings      = getGuildSettings(guild.id);
    const embedColor    = color || settings?.embed_color || '#5865F2';

    // ── Fetch membri per modalità ruolo ───────────────────────
    let membersWithRole = null;
    let memberCount = 0;

    if (role) {
      if (!isChannelMode) await guild.members.fetch();
      membersWithRole = role.members.filter(m => !m.user.bot);
      memberCount = membersWithRole.size;

      if (!isChannelMode && memberCount === 0) {
        return interaction.editReply({
          embeds: [errorEmbed(guild.id, t(guild.id, 'newsletter.no_recipients'), t(guild.id, 'newsletter.no_recipients_desc'))],
        });
      }
    } else {
      memberCount = listUsers.length;
    }

    // ── Builder helpers ────────────────────────────────────────
    const buildEmbed = () => {
      const e = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(title)
        .setDescription(message)
        .setAuthor({ name: guild.name, iconURL: guild.iconURL({ dynamic: true }) })
        .setTimestamp();
      if (url)      e.setURL(url);
      if (imageUrl) e.setImage(imageUrl);
      if (thumbUrl) e.setThumbnail(thumbUrl);

      if (footerText) {
        e.setFooter({ text: footerText });
      } else {
        const botName = settings?.bot_name || 'NicoDev Bot';
        const botIcon = settings?.bot_icon || null;
        const f = { text: `${botName} • ${guild.name}` };
        if (botIcon) f.iconURL = botIcon;
        e.setFooter(f);
      }
      return e;
    };

    const buildText = () => {
      let txt = `**${title}**\n\n${message}`;
      if (url) txt += `\n\n🔗 ${url}`;
      txt += `\n\n*– ${guild.name}*`;
      return txt;
    };

    // ── Anteprima ──────────────────────────────────────────────
    const targetLabel = isListMode
      ? `📋 Lista: **\`${listName}\`** (${memberCount} utenti)`
      : `${role}`;

    const modeLabel = isChannelMode
      ? t(guild.id, 'newsletter.mode_channel', { channel: targetCh })
      : isListMode
        ? `📬 DM a ${memberCount} utenti dalla lista \`${listName}\``
        : t(guild.id, 'newsletter.mode_dm', { count: memberCount });

    const previewLines = [
      `**${t(guild.id, 'newsletter.mode_label')}:** ${modeLabel}`,
      `**Destinatario:** ${targetLabel}`,
      `**${t(guild.id, 'newsletter.sent_by_label')}:** ${member}`,
      `**${t(guild.id, 'newsletter.format_label')}:** ${useEmbed ? t(guild.id, 'newsletter.format_embed') : t(guild.id, 'newsletter.format_text')}`,
      isChannelMode && mention && role ? `**${t(guild.id, 'newsletter.mention_role_label')}:** ✅` : '',
      color   ? `**${t(guild.id, 'newsletter.color_label')}:** \`${color}\`` : '',
      imageUrl ? `**${t(guild.id, 'newsletter.image_label')}:** ✅` : '',
      thumbUrl ? `**${t(guild.id, 'newsletter.thumbnail_label')}:** ✅` : '',
      url     ? `**${t(guild.id, 'newsletter.url_label')}:** [link](${url})` : '',
      footerText ? `**${t(guild.id, 'newsletter.footer_label')}:** ${footerText}` : '',
    ].filter(Boolean).join('\n');

    const previewEmbed = createEmbed(guild.id, {
      title: t(guild.id, 'newsletter.preview_title'),
      description: previewLines,
      color: '#5865F2',
    });

    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('newsletter_confirm')
        .setLabel(isChannelMode
          ? t(guild.id, 'newsletter.send_channel_btn')
          : `📨 Invia DM a ${memberCount} utenti`)
        .setEmoji('📨')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('newsletter_cancel')
        .setLabel(t(guild.id, 'newsletter.cancel_btn'))
        .setEmoji('❌')
        .setStyle(ButtonStyle.Secondary),
    );

    // Mostra anteprima + embed di esempio
    const embeds = [previewEmbed];
    if (useEmbed) embeds.push(buildEmbed());

    const textPreview = !useEmbed
      ? `**Anteprima testo:**\n>>> ${buildText().slice(0, 300)}`
      : undefined;

    await interaction.editReply({
      content: textPreview,
      embeds,
      components: [confirmRow],
    });
    const reply = await interaction.fetchReply();

    // ── Collector ──────────────────────────────────────────────
    const collector = reply.createMessageComponentCollector({
      filter: i => i.user.id === member.id,
      time: 120_000,
      max: 1,
    });

    collector.on('collect', async (btn) => {
      if (btn.customId === 'newsletter_cancel') {
        return btn.update({
          embeds: [warnEmbed(guild.id, t(guild.id, 'common.cancelled'), t(guild.id, 'newsletter.cancelled'))],
          components: [],
          content: null,
        });
      }

      // ────── Modalità Canale ──────────────────────────────────
      if (isChannelMode) {
        await btn.update({
          embeds: [createEmbed(guild.id, {
            title: t(guild.id, 'newsletter.sending'),
            description: t(guild.id, 'newsletter.sending_channel', { channel: targetCh }),
          })],
          components: [],
          content: null,
        });

        try {
          const payload = {};
          if (useEmbed) {
            payload.embeds = [buildEmbed()];
          } else {
            payload.content = buildText();
          }
          if (mention && role) {
            payload.content = `${role}` + (payload.content ? `\n${payload.content}` : '');
          }

          await targetCh.send(payload);
          logNewsletter(guild.id, role?.id || `lista:${listName}`, member.id, message, 1, 0, title, targetCh.id);

          return btn.editReply({
            embeds: [createEmbed(guild.id, {
              title: t(guild.id, 'newsletter.sent_channel'),
              description: t(guild.id, 'newsletter.sent_channel_desc', { channel: targetCh }),
              fields: [
                { name: t(guild.id, 'newsletter.field_channel'), value: `${targetCh}`,    inline: true },
                { name: 'Destinatario', value: role ? `${role}` : `📋 \`${listName}\``,   inline: true },
                { name: t(guild.id, 'newsletter.field_sent_by'), value: `${member}`,       inline: true },
              ],
              color: '#57F287',
            })],
            components: [],
            content: null,
          });
        } catch (err) {
          logNewsletter(guild.id, role?.id || `lista:${listName}`, member.id, message, 0, 1, title, targetCh.id);
          return btn.editReply({
            embeds: [errorEmbed(guild.id, t(guild.id, 'newsletter.send_error'), t(guild.id, 'newsletter.send_error_desc', { error: err.message }))],
            components: [],
            content: null,
          });
        }
      }

      // ────── Modalità DM ──────────────────────────────────────
      // Costruisci il payload UNA VOLTA sola (evita errori embed nascosti nel loop)
      let dmPayload;
      try {
        dmPayload = useEmbed ? { embeds: [buildEmbed()] } : { content: buildText() };
      } catch (err) {
        console.error('[Newsletter] Errore costruzione payload DM:', err);
        return btn.update({
          embeds: [errorEmbed(guild.id, 'Errore embed', `Impossibile costruire il messaggio: ${err.message}`)],
          components: [],
          content: null,
        });
      }

      await btn.update({
        embeds: [createEmbed(guild.id, {
          title: t(guild.id, 'newsletter.sending'),
          description: `${progressBar(0, memberCount)}\n\n📨 Invio DM a ${memberCount} utenti...`,
        })],
        components: [],
        content: null,
      });

      let sent   = 0;
      let failed = 0;
      const updateEvery = Math.max(1, Math.floor(memberCount / 20));

      // ── Costruisci iteratore dei destinatari ─────────────────
      if (isListMode) {
        // Modalità lista: fetch utenti per ID e invia DM
        for (const entry of listUsers) {
          try {
            const user = await interaction.client.users.fetch(entry.user_id);
            await user.send(dmPayload);
            sent++;
          } catch (err) {
            console.error(`[Newsletter] DM fallito per ${entry.user_id}:`, err.message);
            failed++;
          }

          const done = sent + failed;
          if (done % updateEvery === 0 || done === memberCount) {
            await btn.editReply({
              embeds: [createEmbed(guild.id, {
                title: t(guild.id, 'newsletter.sending'),
                description: `${progressBar(done, memberCount)}\n\n✅ **${sent}** inviati · ❌ **${failed}** falliti · 📊 **${done}/${memberCount}**`,
              })],
            }).catch(() => {});
          }

          await new Promise(r => setTimeout(r, 750));
        }
      } else {
        // Modalità ruolo
        for (const [, target] of membersWithRole) {
          try {
            await target.send(dmPayload);
            sent++;
          } catch (err) {
            console.error(`[Newsletter] DM fallito per ${target.id}:`, err.message);
            failed++;
          }

          const done = sent + failed;
          if (done % updateEvery === 0 || done === memberCount) {
            await btn.editReply({
              embeds: [createEmbed(guild.id, {
                title: t(guild.id, 'newsletter.sending'),
                description: `${progressBar(done, memberCount)}\n\n✅ **${sent}** ${t(guild.id, 'newsletter.field_sent')} · ❌ **${failed}** ${t(guild.id, 'newsletter.field_failed')} · 📊 **${done}/${memberCount}**`,
              })],
            }).catch(() => {});
          }

          await new Promise(r => setTimeout(r, 750));
        }
      }

      logNewsletter(guild.id, role?.id || `lista:${listName}`, member.id, message, sent, failed, title, null);

      await btn.editReply({
        embeds: [createEmbed(guild.id, {
          title: t(guild.id, 'newsletter.sent_dm'),
          description: `${progressBar(memberCount, memberCount)}\n\n${t(guild.id, 'newsletter.sent_dm_completed')}`,
          fields: [
            { name: t(guild.id, 'newsletter.field_sent'),    value: `${sent}`,        inline: true },
            { name: t(guild.id, 'newsletter.field_failed'),  value: `${failed}`,      inline: true },
            { name: t(guild.id, 'newsletter.field_total'),   value: `${memberCount}`, inline: true },
            { name: 'Destinatario', value: role ? `${role}` : `📋 \`${listName}\``,   inline: true },
            { name: t(guild.id, 'newsletter.field_title'),   value: title,             inline: true },
            { name: t(guild.id, 'newsletter.field_sent_by'), value: `${member}`,      inline: true },
          ],
          color: failed === 0 ? '#57F287' : '#FEE75C',
        })],
        components: [],
        content: null,
      });
    });

    collector.on('end', (collected) => {
      if (collected.size === 0) {
        interaction.editReply({
          embeds: [warnEmbed(guild.id, t(guild.id, 'common.expired'), t(guild.id, 'newsletter.expired'))],
          components: [],
          content: null,
        }).catch(() => {});
      }
    });
  },
};

// ── Helper: barra di progresso ─────────────────────────────────
function progressBar(current, total) {
  const pct    = Math.round((current / total) * 100);
  const filled = Math.round(pct / 5);
  const empty  = 20 - filled;
  return `\`${'▓'.repeat(filled)}${'░'.repeat(empty)}\` **${pct}%**`;
}

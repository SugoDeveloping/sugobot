// ═══════════════════════════════════════════════════════════════
//  NicoDev Discord Bot – Comando /giveaway
//  Gestione completa dei giveaway con subcomandi
// ═══════════════════════════════════════════════════════════════

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const ms = require('ms');
const {
  createGiveaway,
  getGiveaway,
  getActiveGiveaways,
  getGiveawaysByGuild,
  getGiveawayEntries,
  getGiveawayEntryCount,
  updateGiveaway,
  deleteGiveaway,
  endGiveaway,
} = require('../../database/db');
const { createEmbed, successEmbed, errorEmbed, infoEmbed } = require('../../utils/embed');
const { t } = require('../../utils/i18n');
const {
  buildGiveawayEmbed,
  buildGiveawayButtons,
  pickWinners,
  finishGiveaway,
} = require('../../handlers/giveawayHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Gestisci i giveaway del server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    // ─── Crea ─────────────────────────────────────────────
    .addSubcommand(sub => sub
      .setName('crea')
      .setDescription('Crea un nuovo giveaway')
      .addStringOption(opt => opt.setName('premio').setDescription('Il premio del giveaway').setRequired(true))
      .addStringOption(opt => opt.setName('durata').setDescription('Durata (es. 10m, 1h, 1d, 7d)').setRequired(true))
      .addChannelOption(opt => opt.setName('canale').setDescription('Canale dove pubblicare').addChannelTypes(ChannelType.GuildText))
      .addIntegerOption(opt => opt.setName('vincitori').setDescription('Numero di vincitori (default: 1)').setMinValue(1).setMaxValue(50))
      .addStringOption(opt => opt.setName('descrizione').setDescription('Descrizione aggiuntiva'))
      .addRoleOption(opt => opt.setName('ruolo-richiesto').setDescription('Ruolo richiesto per partecipare'))
      .addStringOption(opt => opt.setName('emoji').setDescription('Emoji del giveaway (default: 🎉)'))
      .addStringOption(opt => opt.setName('colore').setDescription('Colore embed (hex, es. #FF5733)'))
      .addStringOption(opt => opt.setName('immagine').setDescription('URL immagine grande'))
      .addStringOption(opt => opt.setName('thumbnail').setDescription('URL immagine piccola'))
    )

    // ─── Termina ──────────────────────────────────────────
    .addSubcommand(sub => sub
      .setName('termina')
      .setDescription('Termina un giveaway manualmente')
      .addIntegerOption(opt => opt.setName('id').setDescription('ID del giveaway').setRequired(true))
    )

    // ─── Reroll ───────────────────────────────────────────
    .addSubcommand(sub => sub
      .setName('reroll')
      .setDescription('Riestrai i vincitori di un giveaway terminato')
      .addIntegerOption(opt => opt.setName('id').setDescription('ID del giveaway').setRequired(true))
      .addIntegerOption(opt => opt.setName('vincitori').setDescription('Nuovo numero di vincitori').setMinValue(1).setMaxValue(50))
    )

    // ─── Lista ────────────────────────────────────────────
    .addSubcommand(sub => sub
      .setName('lista')
      .setDescription('Mostra tutti i giveaway del server')
    )

    // ─── Elimina ──────────────────────────────────────────
    .addSubcommand(sub => sub
      .setName('elimina')
      .setDescription('Elimina un giveaway')
      .addIntegerOption(opt => opt.setName('id').setDescription('ID del giveaway').setRequired(true))
    ),

  premium: 'giveaway',

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    switch (sub) {

      // ═══════════════════════════════════════════════════════
      //  CREA
      // ═══════════════════════════════════════════════════════
      case 'crea': {
        const prize = interaction.options.getString('premio');
        const durationStr = interaction.options.getString('durata');
        const channel = interaction.options.getChannel('canale') || interaction.channel;
        const winnersCount = interaction.options.getInteger('vincitori') || 1;
        const description = interaction.options.getString('descrizione');
        const requiredRole = interaction.options.getRole('ruolo-richiesto');
        const emoji = interaction.options.getString('emoji') || '🎉';
        const color = interaction.options.getString('colore');
        const imageUrl = interaction.options.getString('immagine');
        const thumbnailUrl = interaction.options.getString('thumbnail');

        // Valida durata
        const duration = ms(durationStr);
        if (!duration || duration < 60000 || duration > 30 * 24 * 60 * 60 * 1000) {
          return interaction.reply({
            embeds: [errorEmbed(guildId, t(guildId, 'common.error'), t(guildId, 'giveaway.invalid_duration'))],
            ephemeral: true,
          });
        }

        // Valida colore
        if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
          return interaction.reply({
            embeds: [errorEmbed(guildId, t(guildId, 'common.error'), t(guildId, 'giveaway.invalid_color'))],
            ephemeral: true,
          });
        }

        const endsAt = new Date(Date.now() + duration).toISOString().replace('T', ' ').replace('Z', '').split('.')[0];

        // Crea nel database
        const result = createGiveaway(
          guildId,
          channel.id,
          interaction.user.id,
          prize,
          description,
          winnersCount,
          requiredRole?.id || null,
          emoji,
          color || null,
          imageUrl || null,
          thumbnailUrl || null,
          endsAt,
        );

        const giveawayId = result.lastInsertRowid;
        const giveaway = getGiveaway(giveawayId);

        // Costruisci e invia embed
        const embed = buildGiveawayEmbed(guildId, giveaway, 0);
        const buttons = buildGiveawayButtons(guildId, giveawayId);

        const msg = await channel.send({ embeds: [embed], components: buttons });
        updateGiveaway(giveawayId, 'message_id', msg.id);

        return interaction.reply({
          embeds: [successEmbed(guildId, t(guildId, 'giveaway.created'), t(guildId, 'giveaway.created_desc', { channel: `<#${channel.id}>` }))],
          ephemeral: true,
        });
      }

      // ═══════════════════════════════════════════════════════
      //  TERMINA
      // ═══════════════════════════════════════════════════════
      case 'termina': {
        const id = interaction.options.getInteger('id');
        const giveaway = getGiveaway(id);

        if (!giveaway || giveaway.guild_id !== guildId) {
          return interaction.reply({
            embeds: [errorEmbed(guildId, t(guildId, 'giveaway.not_found'), t(guildId, 'giveaway.not_found_desc', { id }))],
            ephemeral: true,
          });
        }

        if (giveaway.status === 'ended') {
          return interaction.reply({
            embeds: [errorEmbed(guildId, t(guildId, 'common.error'), t(guildId, 'giveaway.already_ended'))],
            ephemeral: true,
          });
        }

        await interaction.deferReply({ ephemeral: true });
        await finishGiveaway(interaction.client, giveaway);

        return interaction.editReply({
          embeds: [successEmbed(guildId, t(guildId, 'giveaway.ended'), t(guildId, 'giveaway.ended_desc', { prize: giveaway.prize }))],
        });
      }

      // ═══════════════════════════════════════════════════════
      //  REROLL
      // ═══════════════════════════════════════════════════════
      case 'reroll': {
        const id = interaction.options.getInteger('id');
        const giveaway = getGiveaway(id);

        if (!giveaway || giveaway.guild_id !== guildId) {
          return interaction.reply({
            embeds: [errorEmbed(guildId, t(guildId, 'giveaway.not_found'), t(guildId, 'giveaway.not_found_desc', { id }))],
            ephemeral: true,
          });
        }

        if (giveaway.status !== 'ended') {
          return interaction.reply({
            embeds: [errorEmbed(guildId, t(guildId, 'common.error'), t(guildId, 'giveaway.not_ended'))],
            ephemeral: true,
          });
        }

        const newWinnersCount = interaction.options.getInteger('vincitori') || giveaway.winners_count;
        const entries = getGiveawayEntries(giveaway.id);

        if (entries.length === 0) {
          return interaction.reply({
            embeds: [errorEmbed(guildId, t(guildId, 'giveaway.no_entries'), t(guildId, 'giveaway.no_entries_desc', { prize: giveaway.prize }))],
            ephemeral: true,
          });
        }

        const newWinnerIds = pickWinners(entries, newWinnersCount);
        endGiveaway(giveaway.id, newWinnerIds);

        // Aggiorna messaggio
        try {
          const channel = await interaction.client.channels.fetch(giveaway.channel_id);
          if (channel && giveaway.message_id) {
            const message = await channel.messages.fetch(giveaway.message_id);
            const embed = buildGiveawayEmbed(guildId, { ...giveaway, status: 'ended' }, entries.length, newWinnerIds);
            await message.edit({ embeds: [embed], components: [] });

            const winnersText = newWinnerIds.map(id => `<@${id}>`).join(', ');
            await channel.send({
              content: `🎉 **${t(guildId, 'giveaway.winners')}:** ${winnersText}`,
              embeds: [successEmbed(guildId,
                t(guildId, 'giveaway.rerolled'),
                t(guildId, 'giveaway.rerolled_desc', { prize: giveaway.prize })
              )],
            });

            // DM ai nuovi vincitori
            for (const userId of newWinnerIds) {
              try {
                const user = await interaction.client.users.fetch(userId);
                await user.send({
                  embeds: [successEmbed(guildId, '🎉',
                    t(guildId, 'giveaway.dm_winner', { prize: giveaway.prize, server: interaction.guild.name })
                  )],
                });
              } catch (e) { /* DM chiusi */ }
            }
          }
        } catch (e) {
          console.error('[Giveaway] Errore reroll:', e);
        }

        return interaction.reply({
          embeds: [successEmbed(guildId, t(guildId, 'giveaway.rerolled'), t(guildId, 'giveaway.rerolled_desc', { prize: giveaway.prize }))],
          ephemeral: true,
        });
      }

      // ═══════════════════════════════════════════════════════
      //  LISTA
      // ═══════════════════════════════════════════════════════
      case 'lista': {
        const giveaways = getGiveawaysByGuild(guildId, 20);

        if (giveaways.length === 0) {
          return interaction.reply({
            embeds: [infoEmbed(guildId, t(guildId, 'giveaway.list_title'), t(guildId, 'giveaway.list_none'))],
            ephemeral: true,
          });
        }

        const lines = giveaways.map(g => {
          const status = g.status === 'active'
            ? t(guildId, 'giveaway.list_active')
            : t(guildId, 'giveaway.list_ended');
          const entryCount = getGiveawayEntryCount(g.id);
          const dateLabel = g.status === 'active'
            ? `${t(guildId, 'giveaway.list_ends_at')}: <t:${Math.floor(new Date(g.ends_at + 'Z').getTime() / 1000)}:R>`
            : `${t(guildId, 'giveaway.list_ended_at')}: <t:${Math.floor(new Date(g.ended_at + 'Z').getTime() / 1000)}:R>`;

          let winnersLine = '';
          if (g.status === 'ended' && g.winner_ids.length > 0) {
            winnersLine = `\n   ${t(guildId, 'giveaway.list_winners')}: ${g.winner_ids.map(id => `<@${id}>`).join(', ')}`;
          }

          return `**#${g.id}** ${status} — **${g.prize}**\n   ${t(guildId, 'giveaway.list_entries')}: ${entryCount} | ${dateLabel}${winnersLine}`;
        });

        return interaction.reply({
          embeds: [createEmbed(guildId, {
            title: t(guildId, 'giveaway.list_title'),
            description: lines.join('\n\n'),
          })],
          ephemeral: true,
        });
      }

      // ═══════════════════════════════════════════════════════
      //  ELIMINA
      // ═══════════════════════════════════════════════════════
      case 'elimina': {
        const id = interaction.options.getInteger('id');
        const giveaway = getGiveaway(id);

        if (!giveaway || giveaway.guild_id !== guildId) {
          return interaction.reply({
            embeds: [errorEmbed(guildId, t(guildId, 'giveaway.not_found'), t(guildId, 'giveaway.not_found_desc', { id }))],
            ephemeral: true,
          });
        }

        // Prova a rimuovere il messaggio dal canale
        try {
          const channel = await interaction.client.channels.fetch(giveaway.channel_id);
          if (channel && giveaway.message_id) {
            const message = await channel.messages.fetch(giveaway.message_id);
            await message.delete();
          }
        } catch (e) { /* messaggio già eliminato */ }

        deleteGiveaway(id);

        return interaction.reply({
          embeds: [successEmbed(guildId, t(guildId, 'giveaway.deleted'), t(guildId, 'giveaway.deleted_desc', { id }))],
          ephemeral: true,
        });
      }
    }
  },

  autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (['id'].includes(focused.name)) {
      const giveaways = getActiveGiveaways(interaction.guild.id);
      const all = getGiveawaysByGuild(interaction.guild.id, 25);
      const list = focused.name === 'id' ? all : giveaways;
      const filtered = list
        .filter(g => `#${g.id} ${g.prize}`.toLowerCase().includes(focused.value.toLowerCase()))
        .slice(0, 25);
      return interaction.respond(
        filtered.map(g => ({
          name: `#${g.id} — ${g.prize} (${g.status})`.slice(0, 100),
          value: g.id,
        }))
      );
    }
  },
};

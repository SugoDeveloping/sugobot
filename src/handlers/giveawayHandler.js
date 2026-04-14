// ═══════════════════════════════════════════════════════════════
//  NicoDev Discord Bot – Giveaway Handler
//  Gestisce partecipazione, estrazione vincitori e reroll
// ═══════════════════════════════════════════════════════════════

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const {
  getGiveaway,
  getGiveawayByMessage,
  getGiveawayEntries,
  getGiveawayEntryCount,
  addGiveawayEntry,
  removeGiveawayEntry,
  hasEnteredGiveaway,
  endGiveaway,
  updateGiveaway,
} = require('../database/db');
const { createEmbed, successEmbed, errorEmbed } = require('../utils/embed');
const { t } = require('../utils/i18n');

/**
 * Costruisce l'embed del giveaway (attivo o terminato)
 */
function buildGiveawayEmbed(guildId, giveaway, entryCount, winners = null) {
  const ended = giveaway.status === 'ended';
  const color = giveaway.color || '#5865F2';
  const emoji = giveaway.emoji || '🎉';

  const title = ended
    ? t(guildId, 'giveaway.embed_ended_title')
    : `${emoji} ${t(guildId, 'giveaway.embed_title')}`;

  const fields = [
    { name: t(guildId, 'giveaway.embed_prize'), value: giveaway.prize, inline: true },
    { name: t(guildId, 'giveaway.embed_host'), value: `<@${giveaway.host_id}>`, inline: true },
    { name: t(guildId, 'giveaway.embed_winners_count'), value: `${giveaway.winners_count}`, inline: true },
  ];

  if (!ended) {
    const endsTimestamp = Math.floor(new Date(giveaway.ends_at + 'Z').getTime() / 1000);
    fields.push({ name: t(guildId, 'giveaway.embed_ends'), value: `<t:${endsTimestamp}:R> (<t:${endsTimestamp}:f>)`, inline: false });
  }

  fields.push({ name: t(guildId, 'giveaway.embed_entries'), value: `${entryCount}`, inline: true });

  if (giveaway.required_role_id) {
    fields.push({ name: t(guildId, 'giveaway.embed_required_role'), value: `<@&${giveaway.required_role_id}>`, inline: true });
  }

  if (ended && winners) {
    if (winners.length > 0) {
      fields.push({
        name: `${t(guildId, 'giveaway.winners')}`,
        value: winners.map(id => `<@${id}>`).join(', '),
        inline: false,
      });
    } else {
      fields.push({
        name: `${t(guildId, 'giveaway.winners')}`,
        value: t(guildId, 'giveaway.embed_no_winner'),
        inline: false,
      });
    }
  }

  const embed = createEmbed(guildId, {
    title,
    description: giveaway.description || undefined,
    color,
    fields,
  });

  if (giveaway.image_url) embed.setImage(giveaway.image_url);
  if (giveaway.thumbnail_url) embed.setThumbnail(giveaway.thumbnail_url);

  return embed;
}

/**
 * Costruisce i bottoni del giveaway
 */
function buildGiveawayButtons(guildId, giveawayId, ended = false) {
  const row = new ActionRowBuilder();

  if (!ended) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`giveaway_join_${giveawayId}`)
        .setLabel(t(guildId, 'giveaway.btn_join'))
        .setEmoji('🎉')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`giveaway_leave_${giveawayId}`)
        .setLabel(t(guildId, 'giveaway.btn_leave'))
        .setStyle(ButtonStyle.Secondary),
    );
  }

  return ended ? [] : [row];
}

/**
 * Seleziona vincitori casualmente tra i partecipanti
 */
function pickWinners(entries, count) {
  const shuffled = [...entries].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(e => e.user_id);
}

/**
 * Gestisce il click su "Partecipa"
 */
async function handleGiveawayJoin(interaction, giveawayId) {
  const giveaway = getGiveaway(parseInt(giveawayId));
  if (!giveaway || giveaway.status !== 'active') {
    return interaction.reply({
      embeds: [errorEmbed(interaction.guild.id, t(interaction.guild.id, 'common.error'), t(interaction.guild.id, 'giveaway.already_ended'))],
      ephemeral: true,
    });
  }

  // Controlla ruolo richiesto
  if (giveaway.required_role_id) {
    if (!interaction.member.roles.cache.has(giveaway.required_role_id)) {
      return interaction.reply({
        embeds: [errorEmbed(interaction.guild.id, t(interaction.guild.id, 'giveaway.missing_role'), t(interaction.guild.id, 'giveaway.missing_role_desc', { role: `<@&${giveaway.required_role_id}>` }))],
        ephemeral: true,
      });
    }
  }

  if (hasEnteredGiveaway(giveaway.id, interaction.user.id)) {
    return interaction.reply({
      embeds: [errorEmbed(interaction.guild.id, t(interaction.guild.id, 'common.error'), t(interaction.guild.id, 'giveaway.already_joined'))],
      ephemeral: true,
    });
  }

  addGiveawayEntry(giveaway.id, interaction.user.id);
  const entryCount = getGiveawayEntryCount(giveaway.id);

  // Aggiorna embed con conteggio partecipanti
  try {
    const embed = buildGiveawayEmbed(interaction.guild.id, giveaway, entryCount);
    await interaction.message.edit({ embeds: [embed] });
  } catch (e) { /* ignora errori di edit */ }

  return interaction.reply({
    embeds: [successEmbed(interaction.guild.id, t(interaction.guild.id, 'giveaway.joined'), t(interaction.guild.id, 'giveaway.joined_desc', { prize: giveaway.prize }))],
    ephemeral: true,
  });
}

/**
 * Gestisce il click su "Ritirati"
 */
async function handleGiveawayLeave(interaction, giveawayId) {
  const giveaway = getGiveaway(parseInt(giveawayId));
  if (!giveaway || giveaway.status !== 'active') {
    return interaction.reply({
      embeds: [errorEmbed(interaction.guild.id, t(interaction.guild.id, 'common.error'), t(interaction.guild.id, 'giveaway.already_ended'))],
      ephemeral: true,
    });
  }

  if (!hasEnteredGiveaway(giveaway.id, interaction.user.id)) {
    return interaction.reply({
      embeds: [errorEmbed(interaction.guild.id, t(interaction.guild.id, 'common.error'), t(interaction.guild.id, 'giveaway.already_joined'))],
      ephemeral: true,
    });
  }

  removeGiveawayEntry(giveaway.id, interaction.user.id);
  const entryCount = getGiveawayEntryCount(giveaway.id);

  // Aggiorna embed con conteggio partecipanti
  try {
    const embed = buildGiveawayEmbed(interaction.guild.id, giveaway, entryCount);
    await interaction.message.edit({ embeds: [embed] });
  } catch (e) { /* ignora errori di edit */ }

  return interaction.reply({
    embeds: [successEmbed(interaction.guild.id, t(interaction.guild.id, 'giveaway.left'), t(interaction.guild.id, 'giveaway.left_desc', { prize: giveaway.prize }))],
    ephemeral: true,
  });
}

/**
 * Termina un giveaway ed estrae i vincitori
 */
async function finishGiveaway(client, giveaway) {
  const entries = getGiveawayEntries(giveaway.id);
  const winnerIds = pickWinners(entries, giveaway.winners_count);

  endGiveaway(giveaway.id, winnerIds);

  // Aggiorna il messaggio del giveaway
  try {
    const channel = await client.channels.fetch(giveaway.channel_id);
    if (channel && giveaway.message_id) {
      const message = await channel.messages.fetch(giveaway.message_id);
      const entryCount = entries.length;
      const embed = buildGiveawayEmbed(giveaway.guild_id, { ...giveaway, status: 'ended' }, entryCount, winnerIds);

      await message.edit({ embeds: [embed], components: [] });

      // Annuncia vincitori nel canale
      if (winnerIds.length > 0) {
        const winnersText = winnerIds.map(id => `<@${id}>`).join(', ');
        await channel.send({
          content: `🎉 **${t(giveaway.guild_id, 'giveaway.winners')}:** ${winnersText}`,
          embeds: [successEmbed(giveaway.guild_id,
            t(giveaway.guild_id, 'giveaway.ended'),
            t(giveaway.guild_id, 'giveaway.winners_desc', { prize: giveaway.prize })
          )],
        });

        // DM ai vincitori
        for (const userId of winnerIds) {
          try {
            const user = await client.users.fetch(userId);
            const guild = await client.guilds.fetch(giveaway.guild_id);
            await user.send({
              embeds: [successEmbed(giveaway.guild_id, '🎉',
                t(giveaway.guild_id, 'giveaway.dm_winner', { prize: giveaway.prize, server: guild.name })
              )],
            });
          } catch (e) { /* DM chiusi, ignora */ }
        }
      } else {
        await channel.send({
          embeds: [createEmbed(giveaway.guild_id, {
            title: t(giveaway.guild_id, 'giveaway.ended'),
            description: t(giveaway.guild_id, 'giveaway.no_entries_desc', { prize: giveaway.prize }),
          })],
        });
      }
    }
  } catch (e) {
    console.error('[Giveaway] Errore durante la chiusura:', e);
  }
}

module.exports = {
  buildGiveawayEmbed,
  buildGiveawayButtons,
  pickWinners,
  handleGiveawayJoin,
  handleGiveawayLeave,
  finishGiveaway,
};

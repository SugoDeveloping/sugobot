// ═══════════════════════════════════════════════════════════════
//  NicoDev Discord Bot – Ticket Handler
//  Gestione interazioni bottoni/menu del sistema ticket
// ═══════════════════════════════════════════════════════════════

const {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  UserSelectMenuBuilder,
} = require('discord.js');
const {
  getGuildSettings,
  createTicket,
  getNextTicketNumber,
  getTicketByChannel,
  getOpenTicketsByUser,
  closeTicket,
  updateTicket,
  getTicketCategoryById,
  getTicketCategories,
  updateGuildSetting,
} = require('../database/db');
const { createEmbed, successEmbed, errorEmbed } = require('../utils/embed');
const { generateTranscript } = require('../utils/transcript');
const { sendAsBot } = require('../utils/webhook');
const { t } = require('../utils/i18n');

/**
 * Gestisce il click su un bottone ticket (ticket_open_<categoryId>)
 * Ogni bottone è collegato a una specifica categoria
 */
async function handleTicketOpenByCategory(interaction, categoryId) {
  const { guild, user } = interaction;
  const settings = getGuildSettings(guild.id);
  const category = getTicketCategoryById(parseInt(categoryId));

  if (!category) {
    return interaction.reply({
      embeds: [errorEmbed(guild.id, t(guild.id, 'common.error'), t(guild.id, 'tickets.category_not_found'))],
      ephemeral: true,
    });
  }

  // Controlla ticket già aperti per questa categoria
  const openTickets = getOpenTicketsByUser(guild.id, user.id);
  const maxOpen = category.max_open_per_user || 3;
  if (openTickets.length >= maxOpen) {
    return interaction.reply({
      embeds: [errorEmbed(guild.id, t(guild.id, 'common.error'), t(guild.id, 'tickets.limit_reached', { count: openTickets.length, max: maxOpen }))],
      ephemeral: true,
    });
  }

  await createTicketChannel(interaction, settings, category);
}

/**
 * Gestisce il bottone generico "Apri Ticket" (senza categoria)
 */
async function handleTicketOpen(interaction) {
  const { guild, user } = interaction;
  const settings = getGuildSettings(guild.id);

  const openTickets = getOpenTicketsByUser(guild.id, user.id);
  if (openTickets.length >= 3) {
    return interaction.reply({
      embeds: [errorEmbed(guild.id, t(guild.id, 'common.error'), t(guild.id, 'tickets.limit_reached_3'))],
      ephemeral: true,
    });
  }

  await createTicketChannel(interaction, settings, null);
}

/**
 * Crea il canale ticket con permessi basati sulla categoria
 */
async function createTicketChannel(interaction, settings, category = null) {
  const { guild, user } = interaction;

  await interaction.deferReply({ ephemeral: true });

  try {
    // Determina la categoria Discord (canale parent)
    //  1. Usa discord_category_id della categoria ticket se configurata
    //  2. Altrimenti usa ticket_category_id dalle impostazioni globali
    //  3. Se nessuna esiste, creane una nuova
    let parentId = category?.discord_category_id || settings.ticket_category_id;
    if (!parentId) {
      const cat = await guild.channels.create({
        name: '🎫 Ticket',
        type: ChannelType.GuildCategory,
      });
      parentId = cat.id;
      updateGuildSetting(guild.id, 'ticket_category_id', parentId);
    }

    // Contatore ticket
    const ticketNumber = Date.now().toString(36).slice(-4).toUpperCase();
    const ticketId = getNextTicketNumber(guild.id);
    const emoji = category?.emoji || '🎫';
    const catName = category?.name?.toLowerCase() || 'ticket';

    let channelName;
    if (settings.ticket_name_format) {
      // Formato personalizzato
      channelName = settings.ticket_name_format
        .replace(/{emoji}/g, emoji)
        .replace(/{categoria}/g, catName)
        .replace(/{username}/g, user.username)
        .replace(/{numero}/g, ticketNumber)
        .replace(/{id}/g, String(ticketId));
    } else {
      // Formato default
      channelName = category
        ? `${emoji}┃${catName}-${user.username}-${ticketNumber}`
        : `🎫┃ticket-${user.username}-${ticketNumber}`;
    }

    // Sanitizza il nome canale (Discord accetta solo a-z, 0-9, - e _)
    channelName = channelName
      .toLowerCase()
      .replace(/[^a-z0-9\-┃_]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 100);

    // ─── Permessi canale ─────────────────────────────────────
    const permissionOverwrites = [
      // Nascondi a tutti
      {
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      // Creatore del ticket
      {
        id: user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
      // Il bot stesso
      {
        id: interaction.client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ManageMessages,
        ],
      },
    ];

    // ─── Ruoli che possono vedere il ticket ──────────────────
    // Prima: ruoli specifici della categoria (se configurati)
    const categoryRoles = category?.support_roles || [];
    // Poi: ruolo supporto globale dal setup (fallback)
    const globalSupportRole = settings.ticket_support_role_id;

    const rolesToAdd = categoryRoles.length > 0 ? categoryRoles : (globalSupportRole ? [globalSupportRole] : []);

    for (const roleId of rolesToAdd) {
      permissionOverwrites.push({
        id: roleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages,
        ],
      });
    }

    // ─── Crea canale ─────────────────────────────────────────
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: parentId,
      permissionOverwrites,
      topic: `Ticket di ${user.tag} | Categoria: ${category?.name || 'Generale'} | Aperto il ${new Date().toLocaleDateString('it-IT')}`,
    });

    // Salva nel database
    const subject = category?.name || 'Assistenza Generale';
    createTicket(guild.id, channel.id, user.id, subject);

    // ─── Messaggio di benvenuto ──────────────────────────────
    const welcomeMessage = category?.auto_message || settings.ticket_message || t(guild.id, 'tickets.welcome_msg');
    const formattedMessage = welcomeMessage
      .replace(/{user}/g, `<@${user.id}>`)
      .replace(/{username}/g, user.username)
      .replace(/{server}/g, guild.name)
      .replace(/{category}/g, subject);

    const ticketEmbed = createEmbed(guild.id, {
      title: `🎫 Ticket – ${subject}`,
      description: formattedMessage,
      fields: [
        { name: '👤 Aperto da', value: `<@${user.id}>`, inline: true },
        { name: '📂 Categoria', value: subject, inline: true },
        { name: '📅 Data', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
      ],
    });

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_close')
        .setLabel(t(guild.id, 'tickets.close_btn'))
        .setEmoji('🔒')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('ticket_claim')
        .setLabel(t(guild.id, 'tickets.claim_btn'))
        .setEmoji('✋')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('ticket_add_user')
        .setLabel(t(guild.id, 'tickets.add_user_btn'))
        .setEmoji('➕')
        .setStyle(ButtonStyle.Secondary),
    );

    // Ping i ruoli configurati
    const roleMentions = rolesToAdd.map(r => `<@&${r}>`).join(' ');

    await sendAsBot(channel, {
      content: roleMentions || undefined,
      embeds: [ticketEmbed],
      components: [actionRow],
    }, interaction.client, guild.id);

    // Risposta all'utente
    await interaction.editReply({
      embeds: [successEmbed(guild.id, t(guild.id, 'tickets.created'), t(guild.id, 'tickets.created_desc', { channel }))],
    });

  } catch (error) {
    console.error('[Ticket] Errore creazione:', error);
    await interaction.editReply({
      embeds: [errorEmbed(guild.id, t(guild.id, 'common.error'), t(guild.id, 'tickets.create_error'))],
    });
  }
}

/**
 * Gestisce il bottone "Chiudi Ticket"
 */
async function handleTicketClose(interaction) {
  const { guild, channel, user } = interaction;
  const ticket = getTicketByChannel(channel.id);

  if (!ticket) {
    return interaction.reply({
      embeds: [errorEmbed(guild.id, t(guild.id, 'common.error'), t(guild.id, 'tickets.not_a_ticket'))],
      ephemeral: true,
    });
  }

  if (ticket.status === 'closed') {
    return interaction.reply({
      embeds: [errorEmbed(guild.id, t(guild.id, 'common.error'), t(guild.id, 'tickets.already_closing'))],
      ephemeral: true,
    });
  }

  // Conferma chiusura
  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_confirm_close')
      .setLabel(t(guild.id, 'tickets.close_confirm_btn'))
      .setEmoji('✅')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('ticket_cancel_close')
      .setLabel(t(guild.id, 'tickets.close_cancel_btn'))
      .setEmoji('❌')
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.reply({
    embeds: [createEmbed(guild.id, {
      title: '🔒 ' + t(guild.id, 'tickets.close_confirm'),
      description: t(guild.id, 'tickets.close_confirm_desc'),
      color: '#FEE75C',
    })],
    components: [confirmRow],
  });
}

/**
 * Conferma chiusura ticket
 */
async function handleTicketConfirmClose(interaction) {
  const { guild, channel, user } = interaction;
  const ticket = getTicketByChannel(channel.id);
  const settings = getGuildSettings(guild.id);

  if (!ticket) return;

  await interaction.update({
    embeds: [createEmbed(guild.id, {
      title: '🔒 ' + t(guild.id, 'tickets.closing'),
      description: t(guild.id, 'tickets.closing_desc'),
    })],
    components: [],
  });

  try {
    // Genera trascrizione
    let transcript = null;
    if (settings.auto_transcript) {
      transcript = await generateTranscript(channel);
    }

    // Chiudi nel database
    closeTicket(channel.id, user.id);

    // Invia trascrizione nel canale log
    if (transcript && settings.ticket_log_channel_id) {
      try {
        const logChannel = await guild.channels.fetch(settings.ticket_log_channel_id);
        if (logChannel) {
          const logEmbed = createEmbed(guild.id, {
            title: t(guild.id, 'tickets.transcript_title'),
            description: t(guild.id, 'tickets.transcript_closed_by', { user: `<@${user.id}>` }),
            fields: [
              { name: '👤 Utente', value: `<@${ticket.user_id}>`, inline: true },
              { name: '📂 Oggetto', value: ticket.subject || 'N/A', inline: true },
              { name: '🔒 Chiuso da', value: `<@${user.id}>`, inline: true },
              { name: '📅 Aperto il', value: `<t:${Math.floor(new Date(ticket.created_at).getTime() / 1000)}:F>`, inline: true },
              { name: '📅 Chiuso il', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
            ],
            color: '#ED4245',
          });

          await sendAsBot(logChannel, { embeds: [logEmbed], files: [transcript] }, interaction.client, guild.id);
        }
      } catch (e) {
        console.error('[Ticket] Errore invio log:', e.message);
      }
    }

    // Invia trascrizione in DM all'utente
    if (transcript && settings.dm_transcript) {
      try {
        const ticketUser = await interaction.client.users.fetch(ticket.user_id);
        const dmEmbed = createEmbed(guild.id, {
          title: t(guild.id, 'tickets.transcript_title'),
          description: t(guild.id, 'tickets.transcript_dm_desc', { server: guild.name }),
          fields: [
            { name: '📂 Oggetto', value: ticket.subject || 'Assistenza Generale', inline: true },
            { name: '🔒 Chiuso da', value: `<@${user.id}>`, inline: true },
          ],
        });

        await ticketUser.send({ embeds: [dmEmbed], files: [transcript] }).catch(() => {});
      } catch (e) {
        console.error('[Ticket] Errore invio DM trascrizione:', e.message);
      }
    }

    // Elimina canale dopo 5 secondi
    await sendAsBot(channel, {
      embeds: [createEmbed(guild.id, {
        title: '🔒 ' + t(guild.id, 'tickets.closed'),
        description: t(guild.id, 'tickets.closed_deleting'),
        color: '#ED4245',
      })],
    }, interaction.client, guild.id);

    setTimeout(async () => {
      try {
        await channel.delete();
      } catch (e) {
        console.error('[Ticket] Errore eliminazione canale:', e.message);
      }
    }, 5000);

  } catch (error) {
    console.error('[Ticket] Errore chiusura:', error);
    await sendAsBot(channel, {
      embeds: [errorEmbed(guild.id, t(guild.id, 'common.error'), t(guild.id, 'tickets.close_error'))],
    }, interaction.client, guild.id);
  }
}

/**
 * Annulla chiusura ticket
 */
async function handleTicketCancelClose(interaction) {
  await interaction.update({
    embeds: [successEmbed(interaction.guild.id, t(interaction.guild.id, 'common.cancelled'), t(interaction.guild.id, 'tickets.close_cancelled'))],
    components: [],
  });
}

/**
 * Prendi in carico il ticket
 */
async function handleTicketClaim(interaction) {
  const { guild, channel, user, member } = interaction;
  const ticket = getTicketByChannel(channel.id);

  if (!ticket) {
    return interaction.reply({
      embeds: [errorEmbed(guild.id, t(guild.id, 'common.error'), t(guild.id, 'tickets.not_a_ticket'))],
      ephemeral: true,
    });
  }

  if (ticket.claimed_by) {
    return interaction.reply({
      embeds: [errorEmbed(guild.id, t(guild.id, 'common.error'), t(guild.id, 'tickets.already_claimed', { user: ticket.claimed_by }))],
      ephemeral: true,
    });
  }

  // Controlla se è staff (controlla ruoli categoria + ruolo globale)
  const settings = getGuildSettings(guild.id);
  const categories = getTicketCategories(guild.id);
  const ticketCategory = categories.find(c => ticket.subject === c.name);
  const categoryRoles = ticketCategory?.support_roles || [];
  const allStaffRoles = [...categoryRoles, settings.ticket_support_role_id].filter(Boolean);
  const isStaff = member.permissions.has(PermissionFlagsBits.ManageMessages) ||
    allStaffRoles.some(roleId => member.roles.cache.has(roleId));

  if (!isStaff) {
    return interaction.reply({
      embeds: [errorEmbed(guild.id, t(guild.id, 'common.insufficient_perms'), t(guild.id, 'tickets.claim_no_perms'))],
      ephemeral: true,
    });
  }

  updateTicket(channel.id, 'claimed_by', user.id);

  await interaction.reply({
    embeds: [successEmbed(guild.id, t(guild.id, 'tickets.claimed'), t(guild.id, 'tickets.claimed_desc', { user: `<@${user.id}>` }))],
  });
}

/**
 * Gestisce il bottone "Aggiungi Utente" – mostra un menu selezione utente
 */
async function handleTicketAddUser(interaction) {
  const { guild, member } = interaction;
  const ticket = getTicketByChannel(interaction.channel.id);

  if (!ticket) {
    return interaction.reply({
      embeds: [errorEmbed(guild.id, t(guild.id, 'common.error'), t(guild.id, 'tickets.not_a_ticket'))],
      ephemeral: true,
    });
  }

  // Solo admin/staff possono aggiungere utenti via bottone
  const settings = getGuildSettings(guild.id);
  const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageChannels) ||
    (settings.ticket_support_role_id && member.roles.cache.has(settings.ticket_support_role_id));

  if (!isAdmin) {
    return interaction.reply({
      embeds: [errorEmbed(guild.id, t(guild.id, 'common.insufficient_perms'), t(guild.id, 'tickets.add_user_no_perms'))],
      ephemeral: true,
    });
  }

  const selectRow = new ActionRowBuilder().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId('ticket_add_user_select')
      .setPlaceholder(t(guild.id, 'tickets.add_user_placeholder'))
      .setMinValues(1)
      .setMaxValues(5),
  );

  await interaction.reply({
    embeds: [createEmbed(guild.id, {
      title: '➕ ' + t(guild.id, 'tickets.add_user_title'),
      description: t(guild.id, 'tickets.add_user_desc'),
      color: '#5865F2',
    })],
    components: [selectRow],
    ephemeral: true,
  });
}

/**
 * Gestisce la selezione utente dal menu
 */
async function handleTicketAddUserSelect(interaction) {
  const { guild, channel } = interaction;
  const ticket = getTicketByChannel(channel.id);

  if (!ticket) {
    return interaction.update({
      embeds: [errorEmbed(guild.id, t(guild.id, 'common.error'), t(guild.id, 'tickets.not_a_ticket'))],
      components: [],
    });
  }

  const selectedUsers = interaction.values; // array di user IDs
  const added = [];

  for (const userId of selectedUsers) {
    try {
      await channel.permissionOverwrites.edit(userId, {
        ViewChannel: true,
        SendMessages: true,
        AttachFiles: true,
        EmbedLinks: true,
        ReadMessageHistory: true,
      });
      added.push(`<@${userId}>`);
    } catch (e) {
      console.error(`[Ticket] Errore aggiunta utente ${userId}:`, e.message);
    }
  }

  if (added.length > 0) {
    await interaction.update({
      embeds: [successEmbed(guild.id, t(guild.id, 'tickets.user_added'), t(guild.id, 'tickets.user_added_desc', { user: added.join(', ') }))],
      components: [],
    });

    // Messaggio visibile nel canale per tutti
    const { sendAsBot } = require('../utils/webhook');
    await sendAsBot(channel, {
      embeds: [successEmbed(guild.id, t(guild.id, 'tickets.users_added'), t(guild.id, 'tickets.users_added_desc', { user: `<@${interaction.user.id}>`, added: added.join(', ') }))],
    }, interaction.client, guild.id);
  } else {
    await interaction.update({
      embeds: [errorEmbed(guild.id, t(guild.id, 'common.error'), t(guild.id, 'tickets.add_user_none'))],
      components: [],
    });
  }
}

module.exports = {
  handleTicketOpen,
  handleTicketOpenByCategory,
  handleTicketClose,
  handleTicketConfirmClose,
  handleTicketCancelClose,
  handleTicketClaim,
  handleTicketAddUser,
  handleTicketAddUserSelect,
};

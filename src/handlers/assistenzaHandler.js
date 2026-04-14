// ═══════════════════════════════════════════════════════════════
//  NicoDev Discord Bot – Assistenza Handler
//  Gestione interazioni bottoni del sistema assistenza
// ═══════════════════════════════════════════════════════════════

const {
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const {
  getAssistenzaSettings,
  getAssistenzaRequestById,
  claimAssistenzaRequest,
  closeAssistenzaRequest,
  addAssistenzaFeedback,
  updateAssistenzaRequest,
} = require('../database/db');
const { createEmbed, successEmbed, errorEmbed } = require('../utils/embed');
const { sendAsBot, editAsBotMessage } = require('../utils/webhook');
const { t } = require('../utils/i18n');

/**
 * Verifica se l'utente è staff assistenza
 */
function isAssistenzaStaff(member, settings) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (settings.staff_role_id && member.roles.cache.has(settings.staff_role_id)) return true;
  return false;
}

/**
 * Aggiorna l'embed del messaggio della richiesta
 */
async function updateRequestMessage(interaction, request, settings) {
  try {
    const channel = await interaction.guild.channels.fetch(settings.channel_id).catch(() => null);
    if (!channel || !request.message_id) return;

    const message = await channel.messages.fetch(request.message_id).catch(() => null);
    if (!message) return;

    const priorityMap = {
      bassa: { emoji: '🟢', color: '#57F287', label: 'Bassa' },
      normale: { emoji: '🟡', color: '#FEE75C', label: 'Normale' },
      alta: { emoji: '🔴', color: '#ED4245', label: 'Alta' },
    };
    const prio = priorityMap[request.priority] || priorityMap.normale;

    const statusMap = {
      pending: { emoji: '⏳', label: 'In attesa' },
      in_progress: { emoji: '🔧', label: 'In gestione' },
      closed: { emoji: '🔒', label: 'Chiusa' },
    };
    const status = statusMap[request.status] || statusMap.pending;

    const fields = [
      { name: '👤 Utente', value: `<@${request.user_id}>`, inline: true },
      { name: `${prio.emoji} Priorità`, value: prio.label, inline: true },
      { name: '📌 Stato', value: `${status.emoji} ${status.label}`, inline: true },
      { name: '📋 Oggetto', value: request.subject || 'N/A', inline: false },
      { name: '📝 Descrizione', value: request.description || 'N/A', inline: false },
    ];

    if (request.claimed_by) {
      fields.push({ name: '✋ Preso da', value: `<@${request.claimed_by}>`, inline: true });
    }
    if (request.claimed_at) {
      fields.push({ name: '🕐 Preso il', value: `<t:${Math.floor(new Date(request.claimed_at).getTime() / 1000)}:F>`, inline: true });
    }
    if (request.feedback) {
      fields.push({ name: '📝 Feedback', value: request.feedback, inline: false });
      if (request.feedback_by) {
        fields.push({ name: '👤 Feedback di', value: `<@${request.feedback_by}>`, inline: true });
      }
    }
    if (request.closed_by) {
      fields.push({ name: '🔒 Chiusa da', value: `<@${request.closed_by}>`, inline: true });
    }
    if (request.closed_at) {
      fields.push({ name: '📅 Chiusa il', value: `<t:${Math.floor(new Date(request.closed_at).getTime() / 1000)}:F>`, inline: true });
    }

    const color = request.status === 'closed' ? '#ED4245' : request.status === 'in_progress' ? '#5865F2' : prio.color;

    const updatedEmbed = createEmbed(interaction.guild.id, {
      title: `🆘 Richiesta Assistenza #${request.id}${request.status === 'closed' ? ' – CHIUSA' : ''}`,
      description: request.status === 'closed'
        ? 'Questa richiesta è stata chiusa.'
        : request.status === 'in_progress'
          ? `Questa richiesta è in gestione da <@${request.claimed_by}>.`
          : 'Un utente ha richiesto assistenza.',
      fields,
      color,
    });

    // Aggiorna i bottoni in base allo stato
    let components = [];
    if (request.status !== 'closed') {
      const buttons = [];

      if (!request.claimed_by) {
        buttons.push(
          new ButtonBuilder()
            .setCustomId(`assistenza_claim_${request.id}`)
            .setLabel('Prendi in gestione')
            .setEmoji('✋')
            .setStyle(ButtonStyle.Primary)
        );
      }

      buttons.push(
        new ButtonBuilder()
          .setCustomId(`assistenza_close_${request.id}`)
          .setLabel('Chiudi')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`assistenza_feedback_${request.id}`)
          .setLabel('Scrivi Feedback')
          .setEmoji('📝')
          .setStyle(ButtonStyle.Secondary)
      );

      components = [new ActionRowBuilder().addComponents(...buttons)];
    }

    await editAsBotMessage(message, { embeds: [updatedEmbed], components }, interaction.client, interaction.guild.id);
  } catch (error) {
    console.error('[Assistenza] Errore aggiornamento messaggio:', error);
  }
}

/**
 * Gestisce il bottone "Prendi in gestione"
 */
async function handleAssistenzaClaim(interaction, requestId) {
  const { guild, member, user } = interaction;
  const settings = getAssistenzaSettings(guild.id);

  if (!isAssistenzaStaff(member, settings)) {
    return interaction.reply({
      embeds: [errorEmbed(guild.id, t(guild.id, 'common.insufficient_perms'), t(guild.id, 'assistenza.claim_no_perms'))],
      ephemeral: true,
    });
  }

  const request = getAssistenzaRequestById(parseInt(requestId));
  if (!request) {
    return interaction.reply({
      embeds: [errorEmbed(guild.id, t(guild.id, 'common.error'), t(guild.id, 'assistenza.request_not_found'))],
      ephemeral: true,
    });
  }

  if (request.status === 'closed') {
    return interaction.reply({
      embeds: [errorEmbed(guild.id, t(guild.id, 'common.error'), t(guild.id, 'assistenza.already_closed'))],
      ephemeral: true,
    });
  }

  if (request.claimed_by) {
    return interaction.reply({
      embeds: [errorEmbed(guild.id, t(guild.id, 'common.error'), t(guild.id, 'assistenza.already_claimed', { user: request.claimed_by }))],
      ephemeral: true,
    });
  }

  // Prendi in gestione
  claimAssistenzaRequest(request.id, user.id);
  const updated = getAssistenzaRequestById(request.id);

  await interaction.reply({
    embeds: [successEmbed(guild.id, t(guild.id, 'assistenza.claimed'), t(guild.id, 'assistenza.claimed_desc', { user: `<@${user.id}>` }))],
  });

  // Aggiorna l'embed del messaggio
  await updateRequestMessage(interaction, updated, settings);

  // Notifica l'utente in DM
  try {
    const requestUser = await interaction.client.users.fetch(request.user_id);
    await requestUser.send({
      embeds: [createEmbed(guild.id, {
        title: '🔔 Richiesta Assistenza Aggiornata',
        description: t(guild.id, 'assistenza.dm_claim_desc', { id: request.id, server: guild.name, user: `<@${user.id}>` }),
        fields: [
          { name: '📋 Oggetto', value: request.subject || 'N/A', inline: true },
          { name: '✋ Staff', value: `<@${user.id}>`, inline: true },
        ],
        color: '#5865F2',
      })],
    }).catch(() => {});
  } catch (e) {
    // DM chiusi, ignora
  }
}

/**
 * Gestisce il bottone "Chiudi"
 */
async function handleAssistenzaClose(interaction, requestId) {
  const { guild, member, user } = interaction;
  const settings = getAssistenzaSettings(guild.id);

  if (!isAssistenzaStaff(member, settings)) {
    return interaction.reply({
      embeds: [errorEmbed(guild.id, t(guild.id, 'common.insufficient_perms'), t(guild.id, 'assistenza.close_no_perms'))],
      ephemeral: true,
    });
  }

  const request = getAssistenzaRequestById(parseInt(requestId));
  if (!request) {
    return interaction.reply({
      embeds: [errorEmbed(guild.id, t(guild.id, 'common.error'), t(guild.id, 'assistenza.request_not_found'))],
      ephemeral: true,
    });
  }

  if (request.status === 'closed') {
    return interaction.reply({
      embeds: [errorEmbed(guild.id, t(guild.id, 'common.error'), t(guild.id, 'assistenza.already_closed'))],
      ephemeral: true,
    });
  }

  // Conferma chiusura
  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`assistenza_confirm_close_${requestId}`)
      .setLabel(t(guild.id, 'assistenza.close_confirm_btn'))
      .setEmoji('✅')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`assistenza_cancel_close_${requestId}`)
      .setLabel(t(guild.id, 'assistenza.close_cancel_btn'))
      .setEmoji('❌')
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.reply({
    embeds: [createEmbed(guild.id, {
      title: '🔒 ' + t(guild.id, 'assistenza.close_confirm'),
      description: t(guild.id, 'assistenza.close_confirm_desc'),
      color: '#FEE75C',
    })],
    components: [confirmRow],
    ephemeral: true,
  });
}

/**
 * Conferma chiusura richiesta
 */
async function handleAssistenzaConfirmClose(interaction, requestId) {
  const { guild, user } = interaction;
  const settings = getAssistenzaSettings(guild.id);

  const request = getAssistenzaRequestById(parseInt(requestId));
  if (!request || request.status === 'closed') {
    return interaction.update({
      embeds: [errorEmbed(guild.id, t(guild.id, 'common.error'), t(guild.id, 'assistenza.request_not_found'))],
      components: [],
    });
  }

  closeAssistenzaRequest(request.id, user.id);
  const updated = getAssistenzaRequestById(request.id);

  await interaction.update({
    embeds: [successEmbed(guild.id, t(guild.id, 'assistenza.closed'), t(guild.id, 'assistenza.closed_desc', { user: `<@${user.id}>` }))],
    components: [],
  });

  // Aggiorna l'embed nel canale
  await updateRequestMessage(interaction, updated, settings);

  // Log nel canale log
  if (settings.log_channel_id) {
    try {
      const logChannel = await guild.channels.fetch(settings.log_channel_id).catch(() => null);
      if (logChannel) {
        const logEmbed = createEmbed(guild.id, {
          title: '📋 Assistenza Chiusa',
          fields: [
            { name: '🆔 ID', value: `#${request.id}`, inline: true },
            { name: '👤 Utente', value: `<@${request.user_id}>`, inline: true },
            { name: '🔒 Chiusa da', value: `<@${user.id}>`, inline: true },
            { name: '📋 Oggetto', value: request.subject || 'N/A', inline: false },
            { name: '✋ Gestita da', value: request.claimed_by ? `<@${request.claimed_by}>` : 'Nessuno', inline: true },
            { name: '📝 Feedback', value: request.feedback || 'Nessuno', inline: false },
            { name: '📅 Aperta il', value: `<t:${Math.floor(new Date(request.created_at).getTime() / 1000)}:F>`, inline: true },
            { name: '📅 Chiusa il', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
          ],
          color: '#ED4245',
        });
        await sendAsBot(logChannel, { embeds: [logEmbed] }, interaction.client, guild.id);
      }
    } catch (e) {
      console.error('[Assistenza] Errore invio log:', e.message);
    }
  }

  // Notifica l'utente in DM
  try {
    const requestUser = await interaction.client.users.fetch(request.user_id);
    const dmEmbed = createEmbed(guild.id, {
      title: '🔒 Richiesta Assistenza Chiusa',
      description: t(guild.id, 'assistenza.dm_closed_desc', { id: request.id, server: guild.name }),
      fields: [
        { name: '📋 Oggetto', value: request.subject || 'N/A', inline: true },
        { name: '🔒 Chiusa da', value: `<@${user.id}>`, inline: true },
        { name: '📝 Feedback', value: updated.feedback || 'Nessun feedback lasciato', inline: false },
      ],
      color: '#ED4245',
    });
    await requestUser.send({ embeds: [dmEmbed] }).catch(() => {});
  } catch (e) {
    // DM chiusi
  }
}

/**
 * Annulla chiusura
 */
async function handleAssistenzaCancelClose(interaction) {
  await interaction.update({
    embeds: [successEmbed(interaction.guild.id, t(interaction.guild.id, 'common.cancelled'), t(interaction.guild.id, 'assistenza.close_cancelled'))],
    components: [],
  });
}

/**
 * Gestisce il bottone "Scrivi Feedback" – apre un Modal
 */
async function handleAssistenzaFeedback(interaction, requestId) {
  const { guild, member } = interaction;
  const settings = getAssistenzaSettings(guild.id);

  if (!isAssistenzaStaff(member, settings)) {
    return interaction.reply({
      embeds: [errorEmbed(guild.id, t(guild.id, 'common.insufficient_perms'), t(guild.id, 'assistenza.feedback_no_perms'))],
      ephemeral: true,
    });
  }

  const request = getAssistenzaRequestById(parseInt(requestId));
  if (!request) {
    return interaction.reply({
      embeds: [errorEmbed(guild.id, t(guild.id, 'common.error'), t(guild.id, 'assistenza.request_not_found'))],
      ephemeral: true,
    });
  }

  if (request.status === 'closed') {
    return interaction.reply({
      embeds: [errorEmbed(guild.id, t(guild.id, 'common.error'), t(guild.id, 'assistenza.feedback_closed'))],
      ephemeral: true,
    });
  }

  // Crea il Modal
  const modal = new ModalBuilder()
    .setCustomId(`assistenza_feedback_modal_${requestId}`)
    .setTitle(t(guild.id, 'assistenza.feedback_title') + ` #${requestId}`);

  const feedbackInput = new TextInputBuilder()
    .setCustomId('feedback_text')
    .setLabel(t(guild.id, 'assistenza.feedback_label'))
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder(t(guild.id, 'assistenza.feedback_placeholder'))
    .setRequired(true)
    .setMaxLength(1024);

  if (request.feedback) {
    feedbackInput.setValue(request.feedback);
  }

  const row = new ActionRowBuilder().addComponents(feedbackInput);
  modal.addComponents(row);

  await interaction.showModal(modal);
}

/**
 * Gestisce la submission del Modal feedback
 */
async function handleAssistenzaFeedbackSubmit(interaction, requestId) {
  const { guild, user } = interaction;
  const settings = getAssistenzaSettings(guild.id);

  const feedback = interaction.fields.getTextInputValue('feedback_text');
  const request = getAssistenzaRequestById(parseInt(requestId));

  if (!request) {
    return interaction.reply({
      embeds: [errorEmbed(guild.id, t(guild.id, 'common.error'), t(guild.id, 'assistenza.feedback_not_found'))],
      ephemeral: true,
    });
  }

  addAssistenzaFeedback(request.id, feedback, user.id);
  const updated = getAssistenzaRequestById(request.id);

  await interaction.reply({
    embeds: [successEmbed(guild.id, t(guild.id, 'assistenza.feedback_saved'), t(guild.id, 'assistenza.feedback_saved_desc'))],
    ephemeral: true,
  });

  // Aggiorna l'embed
  await updateRequestMessage(interaction, updated, settings);

  // Notifica l'utente in DM
  try {
    const requestUser = await interaction.client.users.fetch(request.user_id);
    await requestUser.send({
      embeds: [createEmbed(guild.id, {
        title: '📝 ' + t(guild.id, 'assistenza.feedback_title'),
        description: t(guild.id, 'assistenza.dm_feedback_desc', { id: request.id, server: guild.name }),
        fields: [
          { name: '📋 Oggetto', value: request.subject || 'N/A', inline: true },
          { name: '📝 Feedback', value: feedback, inline: false },
          { name: '👤 Da', value: `<@${user.id}>`, inline: true },
        ],
        color: '#5865F2',
      })],
    }).catch(() => {});
  } catch (e) {
    // DM chiusi
  }
}

module.exports = {
  handleAssistenzaClaim,
  handleAssistenzaClose,
  handleAssistenzaConfirmClose,
  handleAssistenzaCancelClose,
  handleAssistenzaFeedback,
  handleAssistenzaFeedbackSubmit,
};

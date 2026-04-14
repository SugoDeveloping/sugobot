// ═══════════════════════════════════════════════════════════════
//  NicoDev Discord Bot – Whitelist Handler
//  Gestisce bottoni e modal del sistema whitelist/application
// ═══════════════════════════════════════════════════════════════

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
} = require('discord.js');
const {
  getWhitelistSettings,
  getWhitelistQuestions,
  getWhitelistApplicationByUser,
  createWhitelistApplication,
  getWhitelistApplication,
  updateWhitelistApplication,
  updateWhitelistApplicationMessage,
} = require('../database/db');
const { createEmbed, successEmbed, errorEmbed } = require('../utils/embed');
const { t } = require('../utils/i18n');

// ─── Bottone "Apply" sul pannello ─────────────────────────────
/**
 * Utente clicca "Apply" sul pannello → mostra il modal con le domande
 */
async function handleWhitelistApply(interaction) {
  const gid = interaction.guild.id;
  const settings = getWhitelistSettings(gid);

  // Controlla se l'utente ha già una application pendente
  const existing = getWhitelistApplicationByUser(gid, interaction.user.id);
  if (existing) {
    return interaction.reply({
      embeds: [errorEmbed(gid, t(gid, 'whitelist.pending_title'), t(gid, 'whitelist.pending_desc'))],
      ephemeral: true,
    });
  }

  // Controlla se ci sono domande configurate
  const questions = getWhitelistQuestions(gid);
  if (questions.length === 0) {
    return interaction.reply({
      embeds: [errorEmbed(gid, t(gid, 'whitelist.no_form_title'), t(gid, 'whitelist.no_form_desc'))],
      ephemeral: true,
    });
  }

  // Costruisci il modal
  const modal = new ModalBuilder()
    .setCustomId('whitelist_submit')
    .setTitle((settings.panel_title || 'Application').substring(0, 45));

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const input = new TextInputBuilder()
      .setCustomId(`wl_q_${i}`)
      .setLabel(q.question.substring(0, 45))
      .setRequired(q.required === 1);

    if (q.type === 'open') {
      input.setStyle(TextInputStyle.Paragraph);
    } else {
      input.setStyle(TextInputStyle.Short);
      if (q.options && q.options.length > 0) {
        input.setPlaceholder(`Options: ${q.options.join(', ')}`.substring(0, 100));
      }
    }

    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }

  await interaction.showModal(modal);
}

// ─── Submit del modal application ─────────────────────────────
/**
 * Utente invia il modal → salva application e invia in review channel
 */
async function handleWhitelistSubmit(interaction) {
  const gid = interaction.guild.id;
  const settings = getWhitelistSettings(gid);
  const questions = getWhitelistQuestions(gid);

  if (questions.length === 0) {
    return interaction.reply({
      embeds: [errorEmbed(gid, t(gid, 'whitelist.no_form_title'), t(gid, 'whitelist.form_not_configured'))],
      ephemeral: true,
    });
  }

  // Raccogli le risposte
  const answers = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const answer = interaction.fields.getTextInputValue(`wl_q_${i}`);

    // Valida domande chiuse
    if (q.type === 'closed' && q.options && q.options.length > 0) {
      const valid = q.options.some(opt => opt.toLowerCase() === answer.toLowerCase());
      if (!valid) {
        return interaction.reply({
          embeds: [errorEmbed(gid, t(gid, 'whitelist.invalid_answer_title'), t(gid, 'whitelist.invalid_answer_desc', { question: q.question, options: q.options.join(', ') }))],
          ephemeral: true,
        });
      }
    }

    answers.push({ question: q.question, answer });
  }

  // Crea application nel DB
  const result = createWhitelistApplication(gid, interaction.user.id, answers);
  const appId = result.lastInsertRowid;

  // Invia nel canale review
  if (settings.review_channel_id) {
    try {
      const reviewChannel = await interaction.guild.channels.fetch(settings.review_channel_id).catch(() => null);
      if (reviewChannel) {
        const fields = answers.map(a => ({
          name: a.question,
          value: a.answer || t(gid, 'whitelist.no_answer'),
          inline: false,
        }));

        const reviewEmbed = createEmbed(gid, {
          title: t(gid, 'whitelist.review_title', { id: appId }),
          author: {
            name: interaction.user.tag,
            iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
          },
          fields,
        });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`whitelist_approve_${appId}`)
            .setLabel(t(gid, 'whitelist.btn_approve'))
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`whitelist_reject_${appId}`)
            .setLabel(t(gid, 'whitelist.btn_reject'))
            .setStyle(ButtonStyle.Danger),
        );

        const reviewMessage = await reviewChannel.send({
          embeds: [reviewEmbed],
          components: [row],
        });

        updateWhitelistApplicationMessage(appId, reviewMessage.id);
      }
    } catch (error) {
      console.error('[Whitelist] Errore invio review:', error.message);
    }
  }

  // DM all'utente (se abilitato)
  if (settings.dm_on_submit) {
    try {
      const submitMsg = settings.msg_submit
        ? settings.msg_submit.replace(/\{user\}/g, interaction.user.username).replace(/\{server\}/g, interaction.guild.name)
        : t(gid, 'whitelist.dm_submitted_default', { server: interaction.guild.name });
      await interaction.user.send({
        embeds: [createEmbed(gid, {
          title: t(gid, 'whitelist.dm_submitted_title'),
          description: submitMsg,
          color: '#5865F2',
        })],
      }).catch(() => {});
    } catch { /* DM chiusi */ }
  }

  return interaction.reply({
    embeds: [successEmbed(gid, t(gid, 'whitelist.submitted_title'), t(gid, 'whitelist.submitted_desc'))],
    ephemeral: true,
  });
}

// ─── Bottone "Approve" ────────────────────────────────────────
/**
 * Reviewer approva una application
 */
async function handleWhitelistApprove(interaction, applicationId) {
  const gid = interaction.guild.id;
  const settings = getWhitelistSettings(gid);

  // Controlla se l'utente ha il ruolo reviewer
  if (settings.reviewer_role_id && !interaction.member.roles.cache.has(settings.reviewer_role_id)) {
    return interaction.reply({
      embeds: [errorEmbed(gid, t(gid, 'whitelist.no_perms_title'), t(gid, 'whitelist.no_perms_approve'))],
      ephemeral: true,
    });
  }

  const application = getWhitelistApplication(applicationId);
  if (!application) {
    return interaction.reply({
      embeds: [errorEmbed(gid, t(gid, 'whitelist.not_found_title'), t(gid, 'whitelist.not_found_desc'))],
      ephemeral: true,
    });
  }

  if (application.status !== 'pending') {
    return interaction.reply({
      embeds: [errorEmbed(gid, t(gid, 'whitelist.already_processed_title'), t(gid, 'whitelist.already_processed_desc', { status: application.status }))],
      ephemeral: true,
    });
  }

  // Aggiorna lo stato
  updateWhitelistApplication(applicationId, 'approved', interaction.user.id);

  // Assegna il ruolo approvato
  if (settings.approved_role_id) {
    try {
      const member = await interaction.guild.members.fetch(application.user_id).catch(() => null);
      if (member) {
        await member.roles.add(settings.approved_role_id).catch(() => {});
      }
    } catch (error) {
      console.error('[Whitelist] Errore assegnazione ruolo:', error.message);
    }
  }

  // Aggiorna l'embed di review
  try {
    const oldEmbed = interaction.message.embeds[0];
    const updatedEmbed = EmbedBuilder.from(oldEmbed)
      .setColor('#57F287')
      .addFields({ name: t(gid, 'whitelist.status_field'), value: t(gid, 'whitelist.approved_status', { user: interaction.user.id }), inline: false });

    await interaction.message.edit({
      embeds: [updatedEmbed],
      components: [], // Rimuovi i bottoni
    });
  } catch (error) {
    console.error('[Whitelist] Errore aggiornamento embed:', error.message);
  }

  // DM all'applicante (se abilitato)
  if (settings.dm_on_approve) {
    try {
      const applicant = await interaction.client.users.fetch(application.user_id).catch(() => null);
      if (applicant) {
        const approveMsg = settings.msg_approved
          ? settings.msg_approved.replace(/\{user\}/g, applicant.username).replace(/\{server\}/g, interaction.guild.name)
          : t(gid, 'whitelist.dm_approved_default', { server: interaction.guild.name });
        await applicant.send({
          embeds: [createEmbed(gid, {
            title: t(gid, 'whitelist.dm_approved_title'),
            description: approveMsg,
            color: '#57F287',
          })],
        }).catch(() => {});
      }
    } catch { /* DM chiusi */ }
  }

  return interaction.reply({
    embeds: [successEmbed(gid, t(gid, 'whitelist.approved_title'), t(gid, 'whitelist.approved_desc', { id: applicationId }))],
    ephemeral: true,
  });
}

// ─── Bottone "Reject" ─────────────────────────────────────────
/**
 * Reviewer rifiuta una application
 */
async function handleWhitelistReject(interaction, applicationId) {
  const gid = interaction.guild.id;
  const settings = getWhitelistSettings(gid);

  // Controlla se l'utente ha il ruolo reviewer
  if (settings.reviewer_role_id && !interaction.member.roles.cache.has(settings.reviewer_role_id)) {
    return interaction.reply({
      embeds: [errorEmbed(gid, t(gid, 'whitelist.no_perms_title'), t(gid, 'whitelist.no_perms_reject'))],
      ephemeral: true,
    });
  }

  const application = getWhitelistApplication(applicationId);
  if (!application) {
    return interaction.reply({
      embeds: [errorEmbed(gid, t(gid, 'whitelist.not_found_title'), t(gid, 'whitelist.not_found_desc'))],
      ephemeral: true,
    });
  }

  if (application.status !== 'pending') {
    return interaction.reply({
      embeds: [errorEmbed(gid, t(gid, 'whitelist.already_processed_title'), t(gid, 'whitelist.already_processed_desc', { status: application.status }))],
      ephemeral: true,
    });
  }

  // Aggiorna lo stato
  updateWhitelistApplication(applicationId, 'rejected', interaction.user.id);

  // Aggiorna l'embed di review
  try {
    const oldEmbed = interaction.message.embeds[0];
    const updatedEmbed = EmbedBuilder.from(oldEmbed)
      .setColor('#ED4245')
      .addFields({ name: t(gid, 'whitelist.status_field'), value: t(gid, 'whitelist.rejected_status', { user: interaction.user.id }), inline: false });

    await interaction.message.edit({
      embeds: [updatedEmbed],
      components: [], // Rimuovi i bottoni
    });
  } catch (error) {
    console.error('[Whitelist] Errore aggiornamento embed:', error.message);
  }

  // DM all'applicante (se abilitato)
  if (settings.dm_on_reject) {
    try {
      const applicant = await interaction.client.users.fetch(application.user_id).catch(() => null);
      if (applicant) {
        const rejectMsg = settings.msg_rejected
          ? settings.msg_rejected.replace(/\{user\}/g, applicant.username).replace(/\{server\}/g, interaction.guild.name)
          : t(gid, 'whitelist.dm_rejected_default', { server: interaction.guild.name });
        await applicant.send({
          embeds: [createEmbed(gid, {
            title: t(gid, 'whitelist.dm_rejected_title'),
            description: rejectMsg,
            color: '#ED4245',
          })],
        }).catch(() => {});
      }
    } catch { /* DM chiusi */ }
  }

  return interaction.reply({
    embeds: [successEmbed(gid, t(gid, 'whitelist.rejected_title'), t(gid, 'whitelist.rejected_desc', { id: applicationId }))],
    ephemeral: true,
  });
}

module.exports = {
  handleWhitelistApply,
  handleWhitelistSubmit,
  handleWhitelistApprove,
  handleWhitelistReject,
};

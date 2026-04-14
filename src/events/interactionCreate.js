// ═══════════════════════════════════════════════════════════════
//  NicoDev Discord Bot – InteractionCreate Event
//  Gestisce comandi slash, bottoni e menu di selezione
// ═══════════════════════════════════════════════════════════════

const { errorEmbed } = require('../utils/embed');
const { t } = require('../utils/i18n');
const {
  handleTicketOpen,
  handleTicketOpenByCategory,
  handleTicketClose,
  handleTicketConfirmClose,
  handleTicketCancelClose,
  handleTicketClaim,
  handleTicketAddUser,
  handleTicketAddUserSelect,
} = require('../handlers/ticketHandler');
const {
  handleAssistenzaClaim,
  handleAssistenzaClose,
  handleAssistenzaConfirmClose,
  handleAssistenzaCancelClose,
  handleAssistenzaFeedback,
  handleAssistenzaFeedbackSubmit,
} = require('../handlers/assistenzaHandler');
const {
  handleVerifyStart,
  handleVerifySubmit,
  handleVerifyRefresh,
  handleVerifyModalSubmit,
} = require('../handlers/verifyHandler');
const {
  BUILDER_CREATE_NOW_BUTTON_ID,
  BUILDER_MODAL_ID,
  handleServerBuilderConfigModal,
  handleServerBuilderCreateNow,
} = require('../handlers/serverBuilderHandler');
const {
  handleWhitelistApply,
  handleWhitelistSubmit,
  handleWhitelistApprove,
  handleWhitelistReject,
} = require('../handlers/whitelistHandler');
const {
  handleGiveawayJoin,
  handleGiveawayLeave,
} = require('../handlers/giveawayHandler');
const { getReactionRole, getReactionRolesByMessage, isGuildBlocked } = require('../database/db');
const { hasPremium, PREMIUM_FEATURES } = require('../utils/premium');

const BOT_OWNER_ID = '790685206142124063';

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {

    // ─── Blocco server (solo owner può bypassare) ────────────
    if (interaction.guild && interaction.user.id !== BOT_OWNER_ID && isGuildBlocked(interaction.guild.id)) {
      if (interaction.isRepliable()) {
        await interaction.reply({ content: '🚫 Il bot è stato disattivato su questo server. Per info contatta il proprietario del bot.', ephemeral: true }).catch(() => {});
      }
      return;
    }

    // ─── Gestione Comandi Slash ──────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) {
        console.error(`[Comandi] Comando non trovato: ${interaction.commandName}`);
        return;
      }

      // ── Controllo Premium ──────────────────────────────────────
      if (command.premium && interaction.guild) {
        if (!hasPremium(interaction.guild.id, command.premium, interaction.user.id)) {
          const featureLabel = PREMIUM_FEATURES[command.premium] || command.premium;
          return interaction.reply({
            embeds: [errorEmbed(interaction.guild.id,
              '⭐ Premium Feature',
              `The **${featureLabel}** module is not active on this server.\n\n` +
              `To unlock it, use \`/activate\` with a valid license key.\n\n` +
              `**Need a key?** Join our support server or contact us:\n` +
              `> 🔗 [discord.gg/jYfCpbSTAH](https://discord.gg/jYfCpbSTAH)\n` +
              `> 💬 Contact **@sugenwa** on Discord`
            )],
            ephemeral: true,
          });
        }
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(`[Comandi] Errore in /${interaction.commandName}:`, error);

        const reply = {
          embeds: [errorEmbed(interaction.guild?.id, t(interaction.guild?.id, 'common.error'), t(interaction.guild?.id, 'events.command_error'))],
          ephemeral: true,
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply).catch(() => {});
        } else {
          await interaction.reply(reply).catch(() => {});
        }
      }
    }

    // ─── Gestione Bottoni ────────────────────────────────────
    else if (interaction.isButton()) {
      try {
        const customId = interaction.customId;

        // Bottoni ticket per categoria: ticket_open_<categoryId>
        if (customId.startsWith('ticket_open_')) {
          const categoryId = customId.replace('ticket_open_', '');
          await handleTicketOpenByCategory(interaction, categoryId);
          return;
        }

        // Bottoni assistenza: assistenza_claim_<id>, assistenza_close_<id>, ecc.
        if (customId.startsWith('assistenza_claim_')) {
          const reqId = customId.replace('assistenza_claim_', '');
          await handleAssistenzaClaim(interaction, reqId);
          return;
        }
        if (customId.startsWith('assistenza_close_')) {
          const reqId = customId.replace('assistenza_close_', '');
          await handleAssistenzaClose(interaction, reqId);
          return;
        }
        if (customId.startsWith('assistenza_confirm_close_')) {
          const reqId = customId.replace('assistenza_confirm_close_', '');
          await handleAssistenzaConfirmClose(interaction, reqId);
          return;
        }
        if (customId.startsWith('assistenza_cancel_close_')) {
          await handleAssistenzaCancelClose(interaction);
          return;
        }
        if (customId.startsWith('assistenza_feedback_')) {
          const reqId = customId.replace('assistenza_feedback_', '');
          await handleAssistenzaFeedback(interaction, reqId);
          return;
        }

        // Bottoni verifica captcha
        if (customId === 'verify_start') {
          await handleVerifyStart(interaction);
          return;
        }
        if (customId.startsWith('verify_submit_')) {
          await handleVerifySubmit(interaction);
          return;
        }
        if (customId.startsWith('verify_refresh_')) {
          await handleVerifyRefresh(interaction);
          return;
        }

        // Bottoni reaction role: rr_<roleId>
        if (customId.startsWith('rr_')) {
          const roleId = customId.replace('rr_', '');
          const messageId = interaction.message.id;

          // Trova l'emoji associata a questo ruolo in questo messaggio
          const allRR = getReactionRolesByMessage(messageId);
          const rr = allRR.find(r => r.role_id === roleId);
          if (!rr) return interaction.reply({ content: '❌', ephemeral: true });

          const member = interaction.member;
          const role = interaction.guild.roles.cache.get(roleId);
          if (!role) return interaction.reply({ content: '❌', ephemeral: true });

          if (rr.mode === 'unique') {
            // Rimuovi tutti gli altri ruoli dello stesso pannello
            for (const other of allRR) {
              if (other.role_id !== roleId && member.roles.cache.has(other.role_id)) {
                await member.roles.remove(other.role_id).catch(() => {});
              }
            }
            await member.roles.add(role).catch(() => {});
            return interaction.reply({
              content: `✅ ${t(interaction.guild.id, 'reactionrole.role_assigned', { role: role.name })}`,
              ephemeral: true,
            });
          }

          if (member.roles.cache.has(roleId)) {
            if (rr.mode === 'add') {
              return interaction.reply({
                content: `ℹ️ ${t(interaction.guild.id, 'reactionrole.already_have', { role: role.name })}`,
                ephemeral: true,
              });
            }
            await member.roles.remove(role).catch(() => {});
            return interaction.reply({
              content: `❌ ${t(interaction.guild.id, 'reactionrole.role_removed', { role: role.name })}`,
              ephemeral: true,
            });
          } else {
            await member.roles.add(role).catch(() => {});
            return interaction.reply({
              content: `✅ ${t(interaction.guild.id, 'reactionrole.role_assigned', { role: role.name })}`,
              ephemeral: true,
            });
          }
        }

        // Bottoni giveaway: giveaway_join_<id>, giveaway_leave_<id>
        if (customId.startsWith('giveaway_join_')) {
          const giveawayId = customId.replace('giveaway_join_', '');
          await handleGiveawayJoin(interaction, giveawayId);
          return;
        }
        if (customId.startsWith('giveaway_leave_')) {
          const giveawayId = customId.replace('giveaway_leave_', '');
          await handleGiveawayLeave(interaction, giveawayId);
          return;
        }

        // Whitelist apply button
        if (customId === 'whitelist_apply') {
          await handleWhitelistApply(interaction);
          return;
        }
        if (customId.startsWith('whitelist_approve_')) {
          const appId = customId.replace('whitelist_approve_', '');
          await handleWhitelistApprove(interaction, appId);
          return;
        }
        if (customId.startsWith('whitelist_reject_')) {
          const appId = customId.replace('whitelist_reject_', '');
          await handleWhitelistReject(interaction, appId);
          return;
        }

        if (customId === BUILDER_CREATE_NOW_BUTTON_ID) {
          await handleServerBuilderCreateNow(interaction);
          return;
        }

        switch (customId) {
          case 'ticket_open':
            await handleTicketOpen(interaction);
            break;
          case 'ticket_close':
            await handleTicketClose(interaction);
            break;
          case 'ticket_confirm_close':
            await handleTicketConfirmClose(interaction);
            break;
          case 'ticket_cancel_close':
            await handleTicketCancelClose(interaction);
            break;
          case 'ticket_claim':
            await handleTicketClaim(interaction);
            break;
          case 'ticket_add_user':
            await handleTicketAddUser(interaction);
            break;
        }
      } catch (error) {
        console.error('[Bottoni] Errore:', error);
        await interaction.reply({
          embeds: [errorEmbed(interaction.guild?.id, t(interaction.guild?.id, 'common.error'), t(interaction.guild?.id, 'events.button_error'))],
          ephemeral: true,
        }).catch(() => {});
      }
    }

    // ─── Gestione Modal Submit ───────────────────────────────
    else if (interaction.isModalSubmit()) {
      try {
        const customId = interaction.customId;

        // Modal feedback assistenza: assistenza_feedback_modal_<id>
        if (customId.startsWith('assistenza_feedback_modal_')) {
          const reqId = customId.replace('assistenza_feedback_modal_', '');
          await handleAssistenzaFeedbackSubmit(interaction, reqId);
          return;
        }

        // Modal captcha verifica: verify_modal_<userId>
        if (customId.startsWith('verify_modal_')) {
          await handleVerifyModalSubmit(interaction);
          return;
        }

        // Whitelist modal submit
        if (customId === 'whitelist_submit') {
          await handleWhitelistSubmit(interaction);
          return;
        }

        if (customId === BUILDER_MODAL_ID) {
          await handleServerBuilderConfigModal(interaction);
          return;
        }
      } catch (error) {
        console.error('[Modal] Errore:', error);
        await interaction.reply({
          embeds: [errorEmbed(interaction.guild?.id, t(interaction.guild?.id, 'common.error'), t(interaction.guild?.id, 'events.button_error'))],
          ephemeral: true,
        }).catch(() => {});
      }
    }

    // ─── Gestione Menu di Selezione ──────────────────────────
    else if (interaction.isStringSelectMenu()) {
      // Gestito inline dai collector dei comandi
    }

    // ─── Gestione User Select Menu ─────────────────────────
    else if (interaction.isUserSelectMenu()) {
      try {
        const customId = interaction.customId;

        if (customId === 'ticket_add_user_select') {
          await handleTicketAddUserSelect(interaction);
          return;
        }
      } catch (error) {
        console.error('[UserSelect] Errore:', error);
        await interaction.reply({
          embeds: [errorEmbed(interaction.guild?.id, t(interaction.guild?.id, 'common.error'), t(interaction.guild?.id, 'events.button_error'))],
          ephemeral: true,
        }).catch(() => {});
      }
    }

    // ─── Gestione Autocomplete ───────────────────────────────
    else if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (command?.autocomplete) {
        try {
          await command.autocomplete(interaction);
        } catch (error) {
          console.error('[Autocomplete] Errore:', error);
        }
      }
    }
  },
};

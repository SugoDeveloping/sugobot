// ═══════════════════════════════════════════════════════════════
//  /assistenza – Invia una richiesta di assistenza
//  Utilizzabile da tutti i membri del server
// ═══════════════════════════════════════════════════════════════

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const {
  getAssistenzaSettings,
  createAssistenzaRequest,
  getOpenAssistenzaByUser,
  getRecentAssistenzaRequests,
  updateAssistenzaRequest,
} = require('../../database/db');
const { createEmbed, successEmbed, errorEmbed } = require('../../utils/embed');
const { t } = require('../../utils/i18n');
const { sendAsBot } = require('../../utils/webhook');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('assistenza')
    .setDescription('🆘 Invia una richiesta di assistenza allo staff')
    .addStringOption(opt =>
      opt.setName('oggetto')
        .setDescription('Breve oggetto della richiesta')
        .setRequired(true)
        .setMaxLength(100))
    .addStringOption(opt =>
      opt.setName('descrizione')
        .setDescription('Descrivi il tuo problema in dettaglio')
        .setRequired(true)
        .setMaxLength(1024))
    .addStringOption(opt =>
      opt.setName('priorita')
        .setDescription('Priorità della richiesta')
        .setRequired(false)
        .addChoices(
          { name: '🟢 Bassa', value: 'bassa' },
          { name: '🟡 Normale', value: 'normale' },
          { name: '🔴 Alta', value: 'alta' },
        )),

  premium: 'assistenza',

  async execute(interaction) {
    const { guild, user } = interaction;
    const settings = getAssistenzaSettings(guild.id);

    // ─── Verifiche ───────────────────────────────────────────

    // Sistema abilitato?
    if (!settings.enabled) {
      return interaction.reply({
        embeds: [errorEmbed(guild.id, t(guild.id, 'assistenza.disabled'), t(guild.id, 'assistenza.disabled_desc'))],
        ephemeral: true,
      });
    }

    // Canale configurato?
    if (!settings.channel_id) {
      return interaction.reply({
        embeds: [errorEmbed(guild.id, t(guild.id, 'assistenza.not_configured'), t(guild.id, 'assistenza.not_configured_desc'))],
        ephemeral: true,
      });
    }

    // Max richieste aperte?
    const openRequests = getOpenAssistenzaByUser(guild.id, user.id);
    if (openRequests.length >= settings.max_open_per_user) {
      return interaction.reply({
        embeds: [errorEmbed(guild.id, t(guild.id, 'assistenza.limit_reached'), t(guild.id, 'assistenza.limit_reached_desc', { count: openRequests.length, max: settings.max_open_per_user }))],
        ephemeral: true,
      });
    }

    // Cooldown
    if (settings.cooldown_minutes > 0) {
      const recent = getRecentAssistenzaRequests(guild.id, 50);
      const userRecent = recent.find(r => r.user_id === user.id);
      if (userRecent) {
        const createdAt = new Date(userRecent.created_at).getTime();
        const cooldownMs = settings.cooldown_minutes * 60 * 1000;
        const elapsed = Date.now() - createdAt;
        if (elapsed < cooldownMs) {
          const remainingSec = Math.ceil((cooldownMs - elapsed) / 1000);
          const remainingMin = Math.ceil(remainingSec / 60);
          return interaction.reply({
            embeds: [errorEmbed(guild.id, t(guild.id, 'assistenza.cooldown_active'), t(guild.id, 'assistenza.cooldown_active_desc', { minutes: remainingMin }))],
            ephemeral: true,
          });
        }
      }
    }

    // ─── Crea la richiesta ───────────────────────────────────
    const subject = interaction.options.getString('oggetto');
    const description = interaction.options.getString('descrizione');
    const priority = interaction.options.getString('priorita') || 'normale';

    await interaction.deferReply({ ephemeral: true });

    try {
      // Salva nel database
      const result = createAssistenzaRequest(guild.id, user.id, subject, description, priority);
      const requestId = result.lastInsertRowid;

      // Emoji e colore in base alla priorità
      const priorityMap = {
        bassa: { emoji: '🟢', color: '#57F287', label: t(guild.id, 'assistenza.priority_low') },
        normale: { emoji: '🟡', color: '#FEE75C', label: t(guild.id, 'assistenza.priority_normal') },
        alta: { emoji: '🔴', color: '#ED4245', label: t(guild.id, 'assistenza.priority_high') },
      };
      const prio = priorityMap[priority] || priorityMap.normale;

      // ─── Invia nel canale staff ────────────────────────────
      const assistenzaChannel = await guild.channels.fetch(settings.channel_id).catch(() => null);
      if (!assistenzaChannel) {
        return interaction.editReply({
          embeds: [errorEmbed(guild.id, t(guild.id, 'common.error'), t(guild.id, 'assistenza.channel_error'))],
        });
      }

      const requestEmbed = createEmbed(guild.id, {
        title: t(guild.id, 'assistenza.request_title', { id: requestId }),
        description: t(guild.id, 'assistenza.request_desc'),
        fields: [
          { name: t(guild.id, 'assistenza.field_user'), value: `<@${user.id}> (${user.username})`, inline: true },
          { name: `${prio.emoji} ${t(guild.id, 'assistenza.field_priority')}`, value: prio.label, inline: true },
          { name: t(guild.id, 'assistenza.field_status'), value: t(guild.id, 'assistenza.status_pending'), inline: true },
          { name: t(guild.id, 'assistenza.field_subject'), value: subject, inline: false },
          { name: t(guild.id, 'assistenza.field_description'), value: description, inline: false },
          { name: t(guild.id, 'assistenza.field_date'), value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
        ],
        color: prio.color,
      });

      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`assistenza_claim_${requestId}`)
          .setLabel(t(guild.id, 'assistenza.btn_claim'))
          .setEmoji('✋')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`assistenza_close_${requestId}`)
          .setLabel(t(guild.id, 'assistenza.btn_close'))
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`assistenza_feedback_${requestId}`)
          .setLabel(t(guild.id, 'assistenza.btn_feedback'))
          .setEmoji('📝')
          .setStyle(ButtonStyle.Secondary),
      );

      // Ping ruolo staff se configurato
      const staffMention = settings.staff_role_id ? `<@&${settings.staff_role_id}>` : '';

      const sentMessage = await sendAsBot(assistenzaChannel, {
        content: staffMention || undefined,
        embeds: [requestEmbed],
        components: [actionRow],
      }, interaction.client, guild.id);

      // Salva message_id per riferimento
      updateAssistenzaRequest(requestId, 'message_id', sentMessage.id);

      // ─── Conferma all'utente ───────────────────────────────
      const welcomeMsg = (settings.welcome_message || t(guild.id, 'assistenza.default_welcome'))
        .replace(/{user}/g, `<@${user.id}>`)
        .replace(/{username}/g, user.username)
        .replace(/{server}/g, guild.name)
        .replace(/{subject}/g, subject);

      await interaction.editReply({
        embeds: [successEmbed(guild.id, t(guild.id, 'assistenza.request_sent'), t(guild.id, 'assistenza.request_sent_desc', { welcomeMsg, requestId, subject, priority: `${prio.emoji} ${prio.label}` }))],
      });

    } catch (error) {
      console.error('[Assistenza] Errore creazione richiesta:', error);
      await interaction.editReply({
        embeds: [errorEmbed(guild.id, t(guild.id, 'common.error'), t(guild.id, 'assistenza.request_error'))],
      });
    }
  },
};

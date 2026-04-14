// ═══════════════════════════════════════════════════════════════
//  /whitelist-config – Configura il sistema whitelist/application
//  Imposta canale review, ruoli, pannello embed
// ═══════════════════════════════════════════════════════════════

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const {
  getWhitelistSettings,
  updateWhitelistSetting,
} = require('../../database/db');
const { createEmbed, successEmbed, errorEmbed } = require('../../utils/embed');
const { t } = require('../../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whitelist-config')
    .setDescription('📝 Configura il sistema whitelist/application')
    .addSubcommand(sub =>
      sub.setName('canale-review')
        .setDescription('Imposta il canale dove vengono inviate le application per la review')
        .addChannelOption(opt =>
          opt.setName('canale')
            .setDescription('Canale per le review')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('ruolo-reviewer')
        .setDescription('Imposta il ruolo che può accettare/rifiutare le application')
        .addRoleOption(opt =>
          opt.setName('ruolo')
            .setDescription('Ruolo reviewer')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('ruolo-approvato')
        .setDescription('Imposta il ruolo assegnato agli utenti approvati')
        .addRoleOption(opt =>
          opt.setName('ruolo')
            .setDescription('Ruolo da assegnare')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('pannello')
        .setDescription('Personalizza l\'embed del pannello application')
        .addStringOption(opt =>
          opt.setName('titolo')
            .setDescription('Titolo del pannello')
            .setRequired(false))
        .addStringOption(opt =>
          opt.setName('descrizione')
            .setDescription('Descrizione del pannello')
            .setRequired(false))
        .addStringOption(opt =>
          opt.setName('colore')
            .setDescription('Colore hex del pannello (es. #FF5733)')
            .setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('notifiche')
        .setDescription('Configura le notifiche DM per gli utenti')
        .addBooleanOption(opt =>
          opt.setName('dm-invio')
            .setDescription('Invia DM quando l\'application viene inviata')
            .setRequired(false))
        .addBooleanOption(opt =>
          opt.setName('dm-approvato')
            .setDescription('Invia DM quando l\'application viene approvata')
            .setRequired(false))
        .addBooleanOption(opt =>
          opt.setName('dm-rifiutato')
            .setDescription('Invia DM quando l\'application viene rifiutata')
            .setRequired(false))
        .addStringOption(opt =>
          opt.setName('messaggio-invio')
            .setDescription('Messaggio DM invio ({user} {server})')
            .setRequired(false))
        .addStringOption(opt =>
          opt.setName('messaggio-approvato')
            .setDescription('Messaggio DM approvazione ({user} {server})')
            .setRequired(false))
        .addStringOption(opt =>
          opt.setName('messaggio-rifiutato')
            .setDescription('Messaggio DM rifiuto ({user} {server})')
            .setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('visualizza')
        .setDescription('Mostra la configurazione attuale del sistema whitelist'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  premium: 'whitelist',

  async execute(interaction) {
    const { guild } = interaction;
    const gid = guild.id;
    const sub = interaction.options.getSubcommand();

    switch (sub) {
      // ─── Canale Review ──────────────────────────────────────
      case 'canale-review': {
        const channel = interaction.options.getChannel('canale');
        updateWhitelistSetting(gid, 'review_channel_id', channel.id);

        return interaction.reply({
          embeds: [successEmbed(gid, t(gid, 'whitelist.config_review_channel'), t(gid, 'whitelist.config_review_channel_desc', { channel: channel.id }))],
          ephemeral: true,
        });
      }

      // ─── Ruolo Reviewer ─────────────────────────────────────
      case 'ruolo-reviewer': {
        const role = interaction.options.getRole('ruolo');
        updateWhitelistSetting(gid, 'reviewer_role_id', role.id);

        return interaction.reply({
          embeds: [successEmbed(gid, t(gid, 'whitelist.config_reviewer_role'), t(gid, 'whitelist.config_reviewer_role_desc', { role: role.id }))],
          ephemeral: true,
        });
      }

      // ─── Ruolo Approvato ────────────────────────────────────
      case 'ruolo-approvato': {
        const role = interaction.options.getRole('ruolo');
        updateWhitelistSetting(gid, 'approved_role_id', role.id);

        return interaction.reply({
          embeds: [successEmbed(gid, t(gid, 'whitelist.config_approved_role'), t(gid, 'whitelist.config_approved_role_desc', { role: role.id }))],
          ephemeral: true,
        });
      }

      // ─── Pannello ───────────────────────────────────────────
      case 'pannello': {
        const titolo = interaction.options.getString('titolo');
        const descrizione = interaction.options.getString('descrizione');
        const colore = interaction.options.getString('colore');

        if (!titolo && !descrizione && !colore) {
          return interaction.reply({
            embeds: [errorEmbed(gid, t(gid, 'whitelist.config_no_changes'), t(gid, 'whitelist.config_no_changes_panel_desc'))],
            ephemeral: true,
          });
        }

        const changes = [];
        if (titolo) {
          updateWhitelistSetting(gid, 'panel_title', titolo);
          changes.push(`${t(gid, 'whitelist.config_panel_title_label')} ${titolo}`);
        }
        if (descrizione) {
          updateWhitelistSetting(gid, 'panel_description', descrizione);
          changes.push(`${t(gid, 'whitelist.config_panel_desc_label')} ${descrizione}`);
        }
        if (colore) {
          // Validate hex color
          if (!/^#[0-9A-Fa-f]{6}$/.test(colore)) {
            return interaction.reply({
              embeds: [errorEmbed(gid, t(gid, 'whitelist.config_invalid_color'), t(gid, 'whitelist.config_invalid_color_desc'))],
              ephemeral: true,
            });
          }
          updateWhitelistSetting(gid, 'panel_color', colore);
          changes.push(`${t(gid, 'whitelist.config_panel_color_label')} ${colore}`);
        }

        return interaction.reply({
          embeds: [successEmbed(gid, t(gid, 'whitelist.config_panel_updated'), changes.join('\n'))],
          ephemeral: true,
        });
      }

      // ─── Notifiche ──────────────────────────────────────────
      case 'notifiche': {
        const dmSubmit   = interaction.options.getBoolean('dm-invio');
        const dmApprove  = interaction.options.getBoolean('dm-approvato');
        const dmReject   = interaction.options.getBoolean('dm-rifiutato');
        const msgSubmit  = interaction.options.getString('messaggio-invio');
        const msgApprove = interaction.options.getString('messaggio-approvato');
        const msgReject  = interaction.options.getString('messaggio-rifiutato');

        if (dmSubmit === null && dmApprove === null && dmReject === null && !msgSubmit && !msgApprove && !msgReject) {
          return interaction.reply({
            embeds: [errorEmbed(gid, t(gid, 'whitelist.config_no_changes'), t(gid, 'whitelist.config_no_changes_desc'))],
            ephemeral: true,
          });
        }

        const changes = [];
        if (dmSubmit !== null) {
          updateWhitelistSetting(gid, 'dm_on_submit', dmSubmit ? 1 : 0);
          changes.push(t(gid, 'whitelist.config_dm_submit_label', { value: dmSubmit ? t(gid, 'whitelist.config_dm_active') : t(gid, 'whitelist.config_dm_inactive') }));
        }
        if (dmApprove !== null) {
          updateWhitelistSetting(gid, 'dm_on_approve', dmApprove ? 1 : 0);
          changes.push(t(gid, 'whitelist.config_dm_approve_label', { value: dmApprove ? t(gid, 'whitelist.config_dm_active') : t(gid, 'whitelist.config_dm_inactive') }));
        }
        if (dmReject !== null) {
          updateWhitelistSetting(gid, 'dm_on_reject', dmReject ? 1 : 0);
          changes.push(t(gid, 'whitelist.config_dm_reject_label', { value: dmReject ? t(gid, 'whitelist.config_dm_active') : t(gid, 'whitelist.config_dm_inactive') }));
        }
        if (msgSubmit) {
          updateWhitelistSetting(gid, 'msg_submit', msgSubmit);
          changes.push(t(gid, 'whitelist.config_msg_submit_label', { value: msgSubmit }));
        }
        if (msgApprove) {
          updateWhitelistSetting(gid, 'msg_approved', msgApprove);
          changes.push(t(gid, 'whitelist.config_msg_approve_label', { value: msgApprove }));
        }
        if (msgReject) {
          updateWhitelistSetting(gid, 'msg_rejected', msgReject);
          changes.push(t(gid, 'whitelist.config_msg_reject_label', { value: msgReject }));
        }

        return interaction.reply({
          embeds: [successEmbed(gid, t(gid, 'whitelist.config_notifs_updated'), changes.join('\n'))],
          ephemeral: true,
        });
      }

      // ─── Visualizza ─────────────────────────────────────────
      case 'visualizza': {
        const settings = getWhitelistSettings(gid);

        const embed = createEmbed(gid, {
          title: t(gid, 'whitelist.config_view_title'),
          fields: [
            {
              name: t(gid, 'whitelist.config_view_review_channel'),
              value: settings.review_channel_id ? `<#${settings.review_channel_id}>` : t(gid, 'whitelist.config_view_not_set'),
              inline: true,
            },
            {
              name: t(gid, 'whitelist.config_view_reviewer_role'),
              value: settings.reviewer_role_id ? `<@&${settings.reviewer_role_id}>` : t(gid, 'whitelist.config_view_not_set'),
              inline: true,
            },
            {
              name: t(gid, 'whitelist.config_view_approved_role'),
              value: settings.approved_role_id ? `<@&${settings.approved_role_id}>` : t(gid, 'whitelist.config_view_not_set'),
              inline: true,
            },
            {
              name: t(gid, 'whitelist.config_view_panel_title'),
              value: settings.panel_title || 'Application',
              inline: true,
            },
            {
              name: t(gid, 'whitelist.config_view_panel_color'),
              value: settings.panel_color || '#5865F2',
              inline: true,
            },
            {
              name: t(gid, 'whitelist.config_view_panel'),
              value: settings.panel_channel_id && settings.panel_message_id
                ? `<#${settings.panel_channel_id}>`
                : t(gid, 'whitelist.config_view_not_sent'),
              inline: true,
            },
            {
              name: t(gid, 'whitelist.config_view_panel_desc_label'),
              value: settings.panel_description || 'Click the button below to apply!',
              inline: false,
            },
            {
              name: t(gid, 'whitelist.config_view_dm_section'),
              value: [
                `${t(gid, 'whitelist.config_view_dm_submit')} ${settings.dm_on_submit ? '✅' : '❌'}${settings.msg_submit ? ` — *${settings.msg_submit}*` : ''}`,
                `${t(gid, 'whitelist.config_view_dm_approve')} ${settings.dm_on_approve ? '✅' : '❌'}${settings.msg_approved ? ` — *${settings.msg_approved}*` : ''}`,
                `${t(gid, 'whitelist.config_view_dm_reject')} ${settings.dm_on_reject ? '✅' : '❌'}${settings.msg_rejected ? ` — *${settings.msg_rejected}*` : ''}`,
              ].join('\n'),
              inline: false,
            },
          ],
        });

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }
  },
};

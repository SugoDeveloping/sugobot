// ═══════════════════════════════════════════════════════════════
//  NicoDev Discord Bot – Verify Handler
//  Gestisce la verifica captcha tramite pannello con pulsante
// ═══════════════════════════════════════════════════════════════

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { getVerifySettings } = require('../database/db');
const { createEmbed, successEmbed, errorEmbed } = require('../utils/embed');
const { sendAsBot } = require('../utils/webhook');
const { t } = require('../utils/i18n');
const sharp = require('sharp');

/**
 * Genera un captcha PNG (6 caratteri alfanumerici)
 * @returns {Promise<{ code: string, buffer: Buffer, filename: string }>}
 */
async function generateCaptcha() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const width = 280;
  const height = 80;

  const svgChars = code.split('').map((ch, i) => {
    const x = 20 + i * 42 + Math.floor(Math.random() * 8);
    const y = 45 + Math.floor(Math.random() * 16) - 8;
    const rot = Math.floor(Math.random() * 30) - 15;
    const fontSize = 32 + Math.floor(Math.random() * 10);
    const colors = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    return `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-weight="bold" font-size="${fontSize}" fill="${color}" transform="rotate(${rot}, ${x}, ${y})">${ch}</text>`;
  }).join('');

  let lines = '';
  for (let i = 0; i < 6; i++) {
    const x1 = Math.floor(Math.random() * width);
    const y1 = Math.floor(Math.random() * height);
    const x2 = Math.floor(Math.random() * width);
    const y2 = Math.floor(Math.random() * height);
    const lc = ['#555', '#888', '#AAA', '#CCC'];
    lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${lc[Math.floor(Math.random() * lc.length)]}" stroke-width="2"/>`;
  }

  let dots = '';
  for (let i = 0; i < 40; i++) {
    const cx = Math.floor(Math.random() * width);
    const cy = Math.floor(Math.random() * height);
    const r = 1 + Math.floor(Math.random() * 2);
    dots += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#999" opacity="0.5"/>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="#2B2D31" rx="8"/>
    ${lines}${dots}${svgChars}
  </svg>`;

  const buffer = await sharp(Buffer.from(svg, 'utf-8')).png().toBuffer();
  return { code, buffer, filename: 'captcha.png' };
}

// ─── Helper: invia pannello statico di verifica ──────────────
/**
 * Invia il pannello di verifica nel canale configurato.
 * Chiamato da /verify-config pannello
 */
async function sendVerifyPanel(interaction) {
  const gid = interaction.guild.id;
  const settings = getVerifySettings(gid);

  if (!settings.enabled || !settings.role_id || !settings.channel_id) {
    return interaction.reply({
      embeds: [errorEmbed(gid, t(gid, 'verify.error'), t(gid, 'verify.panel_missing_config'))],
      ephemeral: true,
    });
  }

  const channel = await interaction.guild.channels.fetch(settings.channel_id).catch(() => null);
  if (!channel) {
    return interaction.reply({
      embeds: [errorEmbed(gid, t(gid, 'verify.error'), t(gid, 'verify.panel_channel_not_found'))],
      ephemeral: true,
    });
  }

  const embed = createEmbed(gid, {
    title: t(gid, 'verify.panel_title'),
    description: t(gid, 'verify.panel_desc'),
    color: '#5865F2',
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('verify_start')
      .setLabel(t(gid, 'verify.btn_start'))
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success),
  );

  await sendAsBot(channel, { embeds: [embed], components: [row] }, interaction.client, gid);

  return interaction.reply({
    embeds: [successEmbed(gid, t(gid, 'verify.panel_sent'), t(gid, 'verify.panel_sent_desc', { channel: `<#${channel.id}>` }))],
    ephemeral: true,
  });
}

// ─── Bottone "Verifica" sul pannello statico ─────────────────
/**
 * Utente clicca "Verifica" sul pannello → captcha ephemeral
 */
async function handleVerifyStart(interaction) {
  const gid = interaction.guild.id;
  const settings = getVerifySettings(gid);

  if (!settings.enabled || !settings.role_id) {
    return interaction.reply({
      embeds: [errorEmbed(gid, t(gid, 'verify.error'), t(gid, 'verify.system_disabled'))],
      ephemeral: true,
    });
  }

  // Se ha già il ruolo → avvisa
  if (interaction.member.roles.cache.has(settings.role_id)) {
    return interaction.reply({
      embeds: [successEmbed(gid, t(gid, 'verify.already_verified'), t(gid, 'verify.already_verified_desc'))],
      ephemeral: true,
    });
  }

  // Se ha già un captcha attivo → avvisa
  const store = interaction.client._captchaStore;
  if (store?.has(interaction.user.id)) {
    return interaction.reply({
      embeds: [errorEmbed(gid, t(gid, 'verify.error'), t(gid, 'verify.already_pending'))],
      ephemeral: true,
    });
  }

  // Genera captcha e rispondi ephemeral
  const { code, buffer, filename } = await generateCaptcha();
  const attachment = new AttachmentBuilder(buffer, { name: filename });

  const embed = createEmbed(gid, {
    title: t(gid, 'verify.captcha_title'),
    description: t(gid, 'verify.captcha_desc', { timeout: settings.timeout_seconds }),
    image: `attachment://${filename}`,
    color: '#FEE75C',
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`verify_submit_${interaction.user.id}`)
      .setLabel(t(gid, 'verify.btn_verify'))
      .setEmoji('📝')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`verify_refresh_${interaction.user.id}`)
      .setLabel(t(gid, 'verify.btn_refresh'))
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.reply({
    embeds: [embed],
    files: [attachment],
    components: [row],
    ephemeral: true,
  });

  // Salva il captcha nello store
  if (!interaction.client._captchaStore) interaction.client._captchaStore = new Map();
  interaction.client._captchaStore.set(interaction.user.id, {
    code,
    guildId: gid,
    attempts: 0,
  });

  // Timeout automatico
  setTimeout(() => {
    const s = interaction.client._captchaStore?.get(interaction.user.id);
    if (!s || s.guildId !== gid) return;
    interaction.client._captchaStore.delete(interaction.user.id);

    // Kick se configurato
    if (settings.kick_on_fail) {
      interaction.guild.members.fetch(interaction.user.id)
        .then(m => m.kick(t(gid, 'verify.kick_reason')).catch(() => {}))
        .then(() => logVerify(interaction.user, 'timeout_kick', settings, gid, interaction.guild))
        .catch(() => {});
    } else {
      logVerify(interaction.user, 'timeout', settings, gid, interaction.guild);
    }
  }, settings.timeout_seconds * 1000);
}

// ─── Bottone "Inserisci Codice" (ephemeral) ──────────────────
/**
 * Apre il modal per inserire il codice captcha
 */
async function handleVerifySubmit(interaction) {
  const gid = interaction.guild.id;
  const targetUserId = interaction.customId.replace('verify_submit_', '');

  if (interaction.user.id !== targetUserId) {
    return interaction.reply({
      embeds: [errorEmbed(gid, t(gid, 'verify.error'), t(gid, 'verify.not_yours'))],
      ephemeral: true,
    });
  }

  const store = interaction.client._captchaStore?.get(targetUserId);
  if (!store) {
    return interaction.reply({
      embeds: [errorEmbed(gid, t(gid, 'verify.error'), t(gid, 'verify.expired'))],
      ephemeral: true,
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(`verify_modal_${targetUserId}`)
    .setTitle(t(gid, 'verify.modal_title'));

  const input = new TextInputBuilder()
    .setCustomId('captcha_code')
    .setLabel(t(gid, 'verify.modal_label'))
    .setPlaceholder(t(gid, 'verify.modal_placeholder'))
    .setStyle(TextInputStyle.Short)
    .setMinLength(6)
    .setMaxLength(6)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
}

// ─── Bottone "Nuovo Captcha" (ephemeral) ─────────────────────
/**
 * Rigenera il captcha e aggiorna il messaggio ephemeral
 */
async function handleVerifyRefresh(interaction) {
  const gid = interaction.guild.id;
  const targetUserId = interaction.customId.replace('verify_refresh_', '');

  if (interaction.user.id !== targetUserId) {
    return interaction.reply({
      embeds: [errorEmbed(gid, t(gid, 'verify.error'), t(gid, 'verify.not_yours'))],
      ephemeral: true,
    });
  }

  const store = interaction.client._captchaStore?.get(targetUserId);
  if (!store) {
    return interaction.reply({
      embeds: [errorEmbed(gid, t(gid, 'verify.error'), t(gid, 'verify.expired'))],
      ephemeral: true,
    });
  }

  const settings = getVerifySettings(gid);

  // Genera nuovo captcha
  const { code, buffer, filename } = await generateCaptcha();
  store.code = code;
  store.attempts = 0;

  const attachment = new AttachmentBuilder(buffer, { name: filename });
  const embed = createEmbed(gid, {
    title: t(gid, 'verify.captcha_title'),
    description: t(gid, 'verify.captcha_desc', { timeout: settings.timeout_seconds }),
    image: `attachment://${filename}`,
    color: '#FEE75C',
  });

  await interaction.update({
    embeds: [embed],
    files: [attachment],
  });
}

/**
 * Gestione submit del modal captcha
 */
async function handleVerifyModalSubmit(interaction) {
  const gid = interaction.guild.id;
  const targetUserId = interaction.customId.replace('verify_modal_', '');

  if (interaction.user.id !== targetUserId) {
    return interaction.reply({
      embeds: [errorEmbed(gid, t(gid, 'verify.error'), t(gid, 'verify.not_yours'))],
      ephemeral: true,
    });
  }

  const store = interaction.client._captchaStore?.get(targetUserId);
  if (!store) {
    return interaction.reply({
      embeds: [errorEmbed(gid, t(gid, 'verify.error'), t(gid, 'verify.expired'))],
      ephemeral: true,
    });
  }

  const settings = getVerifySettings(gid);
  const answer = interaction.fields.getTextInputValue('captcha_code').toUpperCase().trim();

  if (answer === store.code) {
    // ✅ Verifica riuscita!
    interaction.client._captchaStore.delete(targetUserId);

    const member = await interaction.guild.members.fetch(targetUserId).catch(() => null);
    if (member && settings.role_id) {
      await member.roles.add(settings.role_id).catch(() => {});
    }

    await interaction.reply({
      embeds: [successEmbed(gid, t(gid, 'verify.success'), t(gid, 'verify.success_desc', { role: `<@&${settings.role_id}>` }))],
      ephemeral: true,
    });

    await logVerify(member || interaction.user, 'success', settings, gid, interaction.guild);
  } else {
    // ❌ Codice errato
    store.attempts++;

    if (store.attempts >= 3) {
      // Troppi tentativi
      interaction.client._captchaStore.delete(targetUserId);

      await interaction.reply({
        embeds: [errorEmbed(gid, t(gid, 'verify.failed'), t(gid, 'verify.failed_desc'))],
        ephemeral: true,
      });

      const member = await interaction.guild.members.fetch(targetUserId).catch(() => null);
      if (settings.kick_on_fail && member) {
        await member.kick(t(gid, 'verify.kick_reason')).catch(() => {});
        await logVerify(member || interaction.user, 'fail_kick', settings, gid, interaction.guild);
      } else {
        await logVerify(member || interaction.user, 'fail', settings, gid, interaction.guild);
      }
    } else {
      await interaction.reply({
        embeds: [errorEmbed(gid, t(gid, 'verify.wrong_code'), t(gid, 'verify.wrong_code_desc', { remaining: 3 - store.attempts }))],
        ephemeral: true,
      });
    }
  }
}

/**
 * Log di verifica nel canale log
 */
async function logVerify(member, action, settings, guildId, guild) {
  if (!settings.log_channel_id) return;

  try {
    const g = guild || member.guild;
    if (!g) return;

    const logChannel = await g.channels.fetch(settings.log_channel_id).catch(() => null);
    if (!logChannel) return;

    const actionLabels = {
      success: `✅ ${t(guildId, 'verify.log_success')}`,
      fail: `❌ ${t(guildId, 'verify.log_fail')}`,
      fail_kick: `🦵 ${t(guildId, 'verify.log_fail_kick')}`,
      timeout: `⏰ ${t(guildId, 'verify.log_timeout')}`,
      timeout_kick: `⏰🦵 ${t(guildId, 'verify.log_timeout_kick')}`,
    };

    const embed = createEmbed(guildId, {
      title: t(guildId, 'verify.log_title'),
      fields: [
        { name: t(guildId, 'common.user'), value: `<@${member.id}> (${member.user?.tag || member.tag || member.id})`, inline: true },
        { name: t(guildId, 'verify.log_action'), value: actionLabels[action] || action, inline: true },
      ],
    });

    await logChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error('[Verify] Errore log:', error.message);
  }
}

module.exports = {
  sendVerifyPanel,
  handleVerifyStart,
  handleVerifySubmit,
  handleVerifyRefresh,
  handleVerifyModalSubmit,
};

// ═══════════════════════════════════════════════════════════════
//  NicoDev Discord Bot – GuildMemberAdd Event
//  Sistema di benvenuto personalizzabile
// ═══════════════════════════════════════════════════════════════

const { getGuildSettings, isGuildBlocked } = require('../database/db');
const { createEmbed } = require('../utils/embed');
const { sendAsBot } = require('../utils/webhook');
const { t } = require('../utils/i18n');
module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    if (isGuildBlocked(member.guild.id)) return;

    const settings = getGuildSettings(member.guild.id);

    if (!settings.welcome_enabled || !settings.welcome_channel_id) return;

    try {
      const channel = await member.guild.channels.fetch(settings.welcome_channel_id);
      if (!channel) return;

      const message = (settings.welcome_message || 'Benvenuto nel server, {user}! 🎉')
        .replace('{user}', `<@${member.id}>`)
        .replace('{username}', member.user.username)
        .replace('{server}', member.guild.name)
        .replace('{membercount}', member.guild.memberCount.toString());

      const embed = createEmbed(member.guild.id, {
        title: t(member.guild.id, 'events.welcome_title'),
        description: message,
        thumbnail: member.user.displayAvatarURL({ dynamic: true, size: 256 }),
        fields: [
          { name: t(member.guild.id, 'events.welcome_user'), value: `${member.user.tag}`, inline: true },
          { name: t(member.guild.id, 'events.welcome_member_number'), value: `${member.guild.memberCount}`, inline: true },
          { name: t(member.guild.id, 'events.welcome_account_created'), value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
        ],
      });

      await sendAsBot(channel, { embeds: [embed] }, member.client, member.guild.id);
    } catch (error) {
      console.error('[Welcome] Errore:', error.message);
    }

  },
};

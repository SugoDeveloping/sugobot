// ═══════════════════════════════════════════════════════════════
//  /serverinfo – Informazioni sul server
// ═══════════════════════════════════════════════════════════════

const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embed');
const { t } = require('../../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('📡 Mostra informazioni sul server'),

  async execute(interaction) {
    const { guild } = interaction;

    await guild.members.fetch();

    const verificationLevels = t(guild.id, 'utility.serverinfo_verification_levels');

    const embed = createEmbed(guild.id, {
      title: `📡 ${guild.name}`,
      thumbnail: guild.iconURL({ dynamic: true, size: 512 }),
      image: guild.bannerURL({ dynamic: true, size: 1024 }) || undefined,
      fields: [
        { name: t(guild.id, 'utility.serverinfo_id'), value: `\`${guild.id}\``, inline: true },
        { name: t(guild.id, 'utility.serverinfo_owner'), value: `<@${guild.ownerId}>`, inline: true },
        { name: t(guild.id, 'utility.serverinfo_created'), value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: true },
        { name: t(guild.id, 'utility.serverinfo_members'), value: `${t(guild.id, 'utility.serverinfo_total')} **${guild.memberCount}**\n${t(guild.id, 'utility.serverinfo_online')} **${guild.members.cache.filter(m => m.presence?.status !== 'offline').size}**\n${t(guild.id, 'utility.serverinfo_bots')} **${guild.members.cache.filter(m => m.user.bot).size}**`, inline: true },
        { name: t(guild.id, 'utility.serverinfo_channels'), value: `${t(guild.id, 'utility.serverinfo_text')} **${guild.channels.cache.filter(c => c.type === 0).size}**\n${t(guild.id, 'utility.serverinfo_voice')} **${guild.channels.cache.filter(c => c.type === 2).size}**\n${t(guild.id, 'utility.serverinfo_categories')} **${guild.channels.cache.filter(c => c.type === 4).size}**`, inline: true },
        { name: t(guild.id, 'utility.serverinfo_roles'), value: `**${guild.roles.cache.size}**`, inline: true },
        { name: t(guild.id, 'utility.serverinfo_emojis'), value: `**${guild.emojis.cache.size}**`, inline: true },
        { name: t(guild.id, 'utility.serverinfo_verification'), value: verificationLevels[guild.verificationLevel] || t(guild.id, 'utility.serverinfo_unknown'), inline: true },
        { name: t(guild.id, 'utility.serverinfo_boost'), value: `${t(guild.id, 'utility.serverinfo_level')} **${guild.premiumTier}**\n${t(guild.id, 'utility.serverinfo_boosts')} **${guild.premiumSubscriptionCount || 0}**`, inline: true },
      ],
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

// ═══════════════════════════════════════════════════════════════
//  /userinfo – Informazioni su un utente
// ═══════════════════════════════════════════════════════════════

const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embed');
const { t } = require('../../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('👤 Mostra informazioni su un utente')
    .addUserOption(opt =>
      opt.setName('utente')
        .setDescription('Utente di cui vedere le info')
        .setRequired(false)),

  async execute(interaction) {
    const { guild } = interaction;
    const user = interaction.options.getUser('utente') || interaction.user;
    const member = await guild.members.fetch(user.id).catch(() => null);

    const fields = [
      { name: t(guild.id, 'utility.userinfo_id'), value: `\`${user.id}\``, inline: true },
      { name: t(guild.id, 'utility.userinfo_tag'), value: user.tag, inline: true },
      { name: t(guild.id, 'utility.userinfo_bot'), value: user.bot ? '✅' : '❌', inline: true },
      { name: t(guild.id, 'utility.userinfo_created'), value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>\n(<t:${Math.floor(user.createdTimestamp / 1000)}:R>)`, inline: true },
    ];

    if (member) {
      fields.push(
        { name: t(guild.id, 'utility.userinfo_joined'), value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>\n(<t:${Math.floor(member.joinedTimestamp / 1000)}:R>)`, inline: true },
        { name: t(guild.id, 'utility.userinfo_roles'), value: member.roles.cache.filter(r => r.id !== guild.id).map(r => r.toString()).join(', ') || t(guild.id, 'utility.userinfo_no_roles'), inline: false },
        { name: t(guild.id, 'utility.userinfo_highest_role'), value: member.roles.highest.toString(), inline: true },
        { name: t(guild.id, 'utility.userinfo_color'), value: member.displayHexColor || 'Default', inline: true },
      );
    }

    const embed = createEmbed(guild.id, {
      title: t(guild.id, 'utility.userinfo_title', { user: user.username }),
      thumbnail: user.displayAvatarURL({ dynamic: true, size: 512 }),
      fields,
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

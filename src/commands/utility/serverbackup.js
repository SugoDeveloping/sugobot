const {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require('discord.js');
const {
  saveGuildBackup,
  getGuildBackup,
  getGuildBackups,
  deleteGuildBackup,
} = require('../../database/db');
const {
  createEmbed,
  successEmbed,
  errorEmbed,
  infoEmbed,
} = require('../../utils/embed');

const BOT_OWNER_ID = '790685206142124063';
const SUPPORTED_CHANNEL_TYPES = new Set([
  ChannelType.GuildCategory,
  ChannelType.GuildText,
  ChannelType.GuildVoice,
]);

function ensureOwner(interaction) {
  if (interaction.user.id === BOT_OWNER_ID) {
    return true;
  }

  interaction.reply({
    embeds: [errorEmbed(interaction.guild?.id, 'Accesso negato', 'Questo comando e riservato al proprietario del bot.')],
    ephemeral: true,
  }).catch(() => {});
  return false;
}

function normalizeBackupName(value) {
  return String(value || '').trim().slice(0, 80);
}

function sortByPosition(items) {
  return [...items].sort((left, right) => {
    const leftPos = left.rawPosition ?? left.position ?? 0;
    const rightPos = right.rawPosition ?? right.position ?? 0;
    if (leftPos !== rightPos) return leftPos - rightPos;
    return left.name.localeCompare(right.name);
  });
}

function capturePermissionOverwrites(channel) {
  return Array.from(channel.permissionOverwrites.cache.values()).map(overwrite => ({
    id: overwrite.id,
    kind: overwrite.type === 1 ? 'member' : 'role',
    allow: overwrite.allow.bitfield.toString(),
    deny: overwrite.deny.bitfield.toString(),
  }));
}

async function captureGuildBackup(guild) {
  await guild.roles.fetch();
  await guild.channels.fetch();

  const roles = guild.roles.cache
    .filter(role => role.id !== guild.id && !role.managed)
    .sort((left, right) => left.position - right.position)
    .map(role => ({
      oldId: role.id,
      name: role.name,
      color: role.color,
      hoist: role.hoist,
      mentionable: role.mentionable,
      permissions: role.permissions.bitfield.toString(),
      position: role.position,
    }));

  const categories = sortByPosition(
    guild.channels.cache.filter(channel => channel.type === ChannelType.GuildCategory).values(),
  ).map(channel => ({
    oldId: channel.id,
    type: 'category',
    name: channel.name,
    position: channel.rawPosition,
    permissionOverwrites: capturePermissionOverwrites(channel),
  }));

  const channels = sortByPosition(
    guild.channels.cache.filter(channel =>
      SUPPORTED_CHANNEL_TYPES.has(channel.type) && channel.type !== ChannelType.GuildCategory,
    ).values(),
  ).map(channel => ({
    oldId: channel.id,
    parentId: channel.parentId,
    position: channel.rawPosition,
    type: channel.type === ChannelType.GuildText ? 'text' : 'voice',
    name: channel.name,
    topic: channel.type === ChannelType.GuildText ? channel.topic || null : null,
    nsfw: channel.type === ChannelType.GuildText ? Boolean(channel.nsfw) : false,
    rateLimitPerUser: channel.type === ChannelType.GuildText ? channel.rateLimitPerUser || 0 : 0,
    bitrate: channel.type === ChannelType.GuildVoice ? channel.bitrate || null : null,
    userLimit: channel.type === ChannelType.GuildVoice ? channel.userLimit || 0 : 0,
    permissionOverwrites: capturePermissionOverwrites(channel),
  }));

  return {
    version: 1,
    sourceGuildId: guild.id,
    sourceGuildName: guild.name,
    capturedAt: new Date().toISOString(),
    roles,
    categories,
    channels,
  };
}

function mapPermissionOverwrites(permissionOverwrites, snapshot, roleMap, targetGuild, summary) {
  const mapped = [];

  for (const overwrite of permissionOverwrites || []) {
    if (overwrite.kind === 'member') {
      summary.skippedMemberOverwrites++;
      continue;
    }

    let targetId = null;
    if (overwrite.id === snapshot.sourceGuildId) {
      targetId = targetGuild.id;
    } else {
      targetId = roleMap.get(overwrite.id) || null;
    }

    if (!targetId) {
      summary.skippedRoleOverwrites++;
      continue;
    }

    mapped.push({
      id: targetId,
      allow: BigInt(overwrite.allow),
      deny: BigInt(overwrite.deny),
    });
  }

  return mapped;
}

async function clearTargetGuild(guild) {
  await guild.channels.fetch();
  await guild.roles.fetch();

  let deletedChannels = 0;
  let deletedRoles = 0;

  const channels = sortByPosition(guild.channels.cache.values()).reverse();
  for (const channel of channels) {
    const deleted = await channel.delete('Restore server backup').then(() => true).catch(() => false);
    if (deleted) {
      deletedChannels++;
    }
  }

  const roles = [...guild.roles.cache.values()]
    .filter(role => role.id !== guild.id && !role.managed && role.editable)
    .sort((left, right) => right.position - left.position);

  for (const role of roles) {
    const deleted = await role.delete('Restore server backup').then(() => true).catch(() => false);
    if (deleted) {
      deletedRoles++;
    }
  }

  return { deletedChannels, deletedRoles };
}

async function restoreGuildBackup(guild, snapshot, options = {}) {
  const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
  if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
    throw new Error('Mi serve il permesso "Gestisci canali" per ripristinare il backup.');
  }

  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    throw new Error('Mi serve il permesso "Gestisci ruoli" per ripristinare il backup.');
  }

  const summary = {
    deletedChannels: 0,
    deletedRoles: 0,
    rolesCreated: 0,
    rolesUpdated: 0,
    categoriesCreated: 0,
    categoriesUpdated: 0,
    textCreated: 0,
    textUpdated: 0,
    voiceCreated: 0,
    voiceUpdated: 0,
    skippedRoleOverwrites: 0,
    skippedMemberOverwrites: 0,
  };

  if (options.clearFirst) {
    const cleared = await clearTargetGuild(guild);
    summary.deletedChannels = cleared.deletedChannels;
    summary.deletedRoles = cleared.deletedRoles;
    await guild.channels.fetch();
    await guild.roles.fetch();
  }

  const roleMap = new Map();
  for (const roleSnapshot of snapshot.roles || []) {
    let role = guild.roles.cache.find(existing =>
      existing.id !== guild.id
      && !existing.managed
      && existing.name === roleSnapshot.name,
    );

    const payload = {
      name: roleSnapshot.name,
      color: roleSnapshot.color,
      hoist: Boolean(roleSnapshot.hoist),
      mentionable: Boolean(roleSnapshot.mentionable),
      permissions: BigInt(roleSnapshot.permissions),
    };

    if (!role) {
      role = await guild.roles.create({ ...payload, reason: 'Restore server backup' });
      summary.rolesCreated++;
      await guild.roles.fetch();
    } else {
      if (role.editable) {
        await role.edit(payload, 'Restore server backup');
        summary.rolesUpdated++;
      }
    }

    roleMap.set(roleSnapshot.oldId, role.id);
  }

  const createdRolePositions = [];
  let nextRolePosition = 1;
  for (const roleSnapshot of snapshot.roles || []) {
    const mappedId = roleMap.get(roleSnapshot.oldId);
    if (mappedId) {
      createdRolePositions.push({ role: mappedId, position: nextRolePosition });
      nextRolePosition++;
    }
  }
  if (createdRolePositions.length) {
    await guild.roles.setPositions(createdRolePositions).catch(() => null);
  }

  await guild.channels.fetch();

  const categoryMap = new Map();
  for (const categorySnapshot of snapshot.categories || []) {
    const permissionOverwrites = mapPermissionOverwrites(categorySnapshot.permissionOverwrites, snapshot, roleMap, guild, summary);
    let category = guild.channels.cache.find(channel =>
      channel.type === ChannelType.GuildCategory && channel.name === categorySnapshot.name,
    );

    if (!category) {
      category = await guild.channels.create({
        name: categorySnapshot.name,
        type: ChannelType.GuildCategory,
        permissionOverwrites,
      });
      summary.categoriesCreated++;
    } else {
      await category.edit({ permissionOverwrites });
      summary.categoriesUpdated++;
    }

    await category.setPosition(categorySnapshot.position).catch(() => null);
    categoryMap.set(categorySnapshot.oldId, category.id);
  }

  await guild.channels.fetch();

  for (const channelSnapshot of snapshot.channels || []) {
    const parent = channelSnapshot.parentId ? categoryMap.get(channelSnapshot.parentId) || null : null;
    const permissionOverwrites = mapPermissionOverwrites(channelSnapshot.permissionOverwrites, snapshot, roleMap, guild, summary);
    const type = channelSnapshot.type === 'text' ? ChannelType.GuildText : ChannelType.GuildVoice;

    let channel = guild.channels.cache.find(existing =>
      existing.type === type
      && existing.name === channelSnapshot.name
      && (existing.parentId || null) === (parent || null),
    );

    const createPayload = {
      name: channelSnapshot.name,
      type,
      parent,
      permissionOverwrites,
    };

    const editPayload = {
      name: channelSnapshot.name,
      parent,
      permissionOverwrites,
    };

    if (type === ChannelType.GuildText) {
      createPayload.topic = channelSnapshot.topic || null;
      createPayload.nsfw = Boolean(channelSnapshot.nsfw);
      createPayload.rateLimitPerUser = channelSnapshot.rateLimitPerUser || 0;
      editPayload.topic = channelSnapshot.topic || null;
      editPayload.nsfw = Boolean(channelSnapshot.nsfw);
      editPayload.rateLimitPerUser = channelSnapshot.rateLimitPerUser || 0;
    }

    if (type === ChannelType.GuildVoice) {
      createPayload.userLimit = channelSnapshot.userLimit || 0;
      editPayload.userLimit = channelSnapshot.userLimit || 0;
      if (channelSnapshot.bitrate) {
        createPayload.bitrate = channelSnapshot.bitrate;
        editPayload.bitrate = channelSnapshot.bitrate;
      }
    }

    if (!channel) {
      channel = await guild.channels.create(createPayload);
      if (type === ChannelType.GuildText) {
        summary.textCreated++;
      } else {
        summary.voiceCreated++;
      }
    } else {
      await channel.edit(editPayload);
      if (type === ChannelType.GuildText) {
        summary.textUpdated++;
      } else {
        summary.voiceUpdated++;
      }
    }

    await channel.setPosition(channelSnapshot.position).catch(() => null);
  }

  return summary;
}

function createBackupListEmbed(guildId, backups) {
  if (!backups.length) {
    return infoEmbed(guildId, 'Backup server', 'Nessun backup salvato.');
  }

  const lines = backups.slice(0, 20).map((backup, index) =>
    `**${index + 1}.** ${backup.name}\nServer: \`${backup.source_guild_id}\`\nAggiornato: <t:${Math.floor(new Date(backup.updated_at).getTime() / 1000)}:R>`);

  return createEmbed(guildId, {
    title: `Backup server (${backups.length})`,
    description: lines.join('\n\n'),
  });
}

function createRestoreSummaryEmbed(guildId, backupName, summary, clearFirst) {
  return createEmbed(guildId, {
    title: 'Backup ripristinato',
    description: [
      `Template: **${backupName}**`,
      clearFirst ? 'La guild e stata svuotata prima del ripristino.' : 'Ripristino eseguito senza svuotare la guild.',
    ].join('\n'),
    fields: [
      { name: 'Ruoli', value: `Creati: ${summary.rolesCreated}\nAggiornati: ${summary.rolesUpdated}`, inline: true },
      { name: 'Categorie', value: `Create: ${summary.categoriesCreated}\nAggiornate: ${summary.categoriesUpdated}`, inline: true },
      { name: 'Canali testuali', value: `Creati: ${summary.textCreated}\nAggiornati: ${summary.textUpdated}`, inline: true },
      { name: 'Canali vocali', value: `Creati: ${summary.voiceCreated}\nAggiornati: ${summary.voiceUpdated}`, inline: true },
      { name: 'Pulizia', value: `Canali eliminati: ${summary.deletedChannels}\nRuoli eliminati: ${summary.deletedRoles}`, inline: true },
      { name: 'Overwrite saltate', value: `Ruoli: ${summary.skippedRoleOverwrites}\nMembri: ${summary.skippedMemberOverwrites}`, inline: true },
    ],
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverbackup')
    .setDescription('Salva e ripristina backup completi del server')
    .addSubcommand(sub =>
      sub.setName('salva')
        .setDescription('Salva la struttura del server corrente come template')
        .addStringOption(option =>
          option.setName('nome')
            .setDescription('Nome del template')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('applica')
        .setDescription('Applica un template salvato al server corrente')
        .addStringOption(option =>
          option.setName('nome')
            .setDescription('Nome del template')
            .setRequired(true))
        .addBooleanOption(option =>
          option.setName('svuota-prima')
            .setDescription('Elimina canali e ruoli prima del ripristino')))
    .addSubcommand(sub =>
      sub.setName('lista')
        .setDescription('Mostra tutti i template salvati'))
    .addSubcommand(sub =>
      sub.setName('elimina')
        .setDescription('Elimina un template salvato')
        .addStringOption(option =>
          option.setName('nome')
            .setDescription('Nome del template da eliminare')
            .setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  premium: 'utility_plus',

  async execute(interaction) {
    if (!ensureOwner(interaction)) return;

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    switch (subcommand) {
      case 'salva': {
        const name = normalizeBackupName(interaction.options.getString('nome'));
        if (!name) {
          await interaction.reply({
            embeds: [errorEmbed(guildId, 'Nome non valido', 'Inserisci un nome valido per il template.')],
            ephemeral: true,
          });
          return;
        }

        await interaction.deferReply({ ephemeral: true });
        const snapshot = await captureGuildBackup(interaction.guild);
        saveGuildBackup(name, interaction.guild.id, snapshot, interaction.user.id);

        await interaction.editReply({
          embeds: [successEmbed(
            guildId,
            'Backup salvato',
            `Template **${name}** salvato.\nRuoli: ${snapshot.roles.length}\nCategorie: ${snapshot.categories.length}\nCanali: ${snapshot.channels.length}`,
          )],
        });
        return;
      }

      case 'applica': {
        const name = normalizeBackupName(interaction.options.getString('nome'));
        const clearFirst = interaction.options.getBoolean('svuota-prima') ?? false;
        const backup = getGuildBackup(name);

        if (!backup) {
          await interaction.reply({
            embeds: [errorEmbed(guildId, 'Template non trovato', `Non esiste alcun backup chiamato **${name}**.`)],
            ephemeral: true,
          });
          return;
        }

        await interaction.deferReply({ ephemeral: true });

        try {
          const summary = await restoreGuildBackup(interaction.guild, backup.snapshot, { clearFirst });
          await interaction.editReply({
            embeds: [createRestoreSummaryEmbed(guildId, name, summary, clearFirst)],
          });
        } catch (error) {
          await interaction.editReply({
            embeds: [errorEmbed(guildId, 'Ripristino fallito', error.message)],
          });
        }
        return;
      }

      case 'lista': {
        await interaction.reply({
          embeds: [createBackupListEmbed(guildId, getGuildBackups())],
          ephemeral: true,
        });
        return;
      }

      case 'elimina': {
        const name = normalizeBackupName(interaction.options.getString('nome'));
        const backup = getGuildBackup(name);
        if (!backup) {
          await interaction.reply({
            embeds: [errorEmbed(guildId, 'Template non trovato', `Non esiste alcun backup chiamato **${name}**.`)],
            ephemeral: true,
          });
          return;
        }

        deleteGuildBackup(name);
        await interaction.reply({
          embeds: [successEmbed(guildId, 'Template eliminato', `Il backup **${name}** e stato eliminato.`)],
          ephemeral: true,
        });
        return;
      }
    }
  },
};

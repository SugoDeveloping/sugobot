const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  PermissionsBitField,
} = require('discord.js');
const ms = require('ms');
const {
  getGuildBuilderConfig,
  saveGuildBuilderConfig,
} = require('../database/db');
const {
  createEmbed,
  successEmbed,
  errorEmbed,
  infoEmbed,
} = require('../utils/embed');

const BUILDER_MODAL_ID = 'server_builder_config_modal';
const BUILDER_CREATE_NOW_BUTTON_ID = 'server_builder_create_now';

const CATEGORY_HEADER_REGEX = /^\[(.+?)\](.*)$/;
const SHOW_BLOCK_REGEX = /\bshow\[(.+?)\]/gi;
const HIDE_BLOCK_REGEX = /\bhide\[(.+?)\]/gi;
const SLOWMODE_BLOCK_REGEX = /\bslowmode\[(.+?)\]/gi;
const LIMIT_BLOCK_REGEX = /\blimit\[(.+?)\]/gi;
const SLOWMODE_INLINE_REGEX = /\bslowmode:([^\s]+)\b/gi;
const LIMIT_INLINE_REGEX = /\blimit:([^\s]+)\b/gi;
const BOOLEAN_FLAGS = new Set(['public', 'private', 'readonly', 'nsfw']);

const TEXT_ACCESS_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.SendMessagesInThreads,
  PermissionFlagsBits.CreatePublicThreads,
  PermissionFlagsBits.CreatePrivateThreads,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AddReactions,
  PermissionFlagsBits.UseExternalEmojis,
  PermissionFlagsBits.UseExternalStickers,
];

const TEXT_WRITE_PERMISSIONS = [
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.SendMessagesInThreads,
  PermissionFlagsBits.CreatePublicThreads,
  PermissionFlagsBits.CreatePrivateThreads,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AddReactions,
  PermissionFlagsBits.UseExternalEmojis,
  PermissionFlagsBits.UseExternalStickers,
];

const VOICE_ACCESS_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.Connect,
  PermissionFlagsBits.Speak,
  PermissionFlagsBits.Stream,
  PermissionFlagsBits.UseVAD,
  PermissionFlagsBits.RequestToSpeak,
];

const DEFAULT_CHANNEL_ACCESS_PERMISSIONS = uniquePermissionList([
  ...TEXT_ACCESS_PERMISSIONS,
  ...VOICE_ACCESS_PERMISSIONS,
]);

const BUILDER_PRESETS = {
  community: {
    label: 'Community Base',
    categories: [
      {
        name: 'Info',
        textChannels: [
          { name: 'regole', readonly: true },
          { name: 'annunci', readonly: true },
          { name: 'faq', readonly: true },
        ],
        voiceChannels: [],
      },
      { name: 'Community', textChannels: ['chat-generale', 'presentazioni', 'media', 'bot-comandi'], voiceChannels: ['Generale', 'Musica', 'AFK'] },
    ],
  },
  gaming: {
    label: 'Gaming Hub',
    categories: [
      {
        name: 'Info',
        textChannels: [
          { name: 'regole', readonly: true },
          { name: 'news', readonly: true },
          { name: 'clip', readonly: true },
        ],
        voiceChannels: [],
      },
      { name: 'Gaming', textChannels: ['chat-generale', 'lfg', 'meme'], voiceChannels: ['Lobby', 'Ranked', 'Duo', 'AFK'] },
      { name: 'Team', textChannels: ['team-chat', 'tornei'], voiceChannels: ['Team 1', 'Team 2'] },
    ],
  },
  support: {
    label: 'Supporto e Staff',
    categories: [
      {
        name: 'Info',
        textChannels: [
          { name: 'regole', readonly: true },
          { name: 'annunci', readonly: true },
          { name: 'faq', readonly: true },
        ],
        voiceChannels: [],
      },
      { name: 'Supporto', textChannels: ['supporto-generale', 'segnalazioni', 'ticket-info'], voiceChannels: ['Waiting Room'] },
      { name: 'Staff', textChannels: ['staff-chat', { name: 'mod-log', readonly: true }], voiceChannels: ['Meeting Staff'] },
    ],
  },
  creator: {
    label: 'Creator Studio',
    categories: [
      {
        name: 'Info',
        textChannels: [
          { name: 'regole', readonly: true },
          { name: 'annunci', readonly: true },
          { name: 'partnership', readonly: true },
        ],
        voiceChannels: [],
      },
      { name: 'Community', textChannels: ['chat-generale', 'feedback', 'suggestions'], voiceChannels: ['Stage Community', 'AFK'] },
      { name: 'Produzione', textChannels: ['idee-video', 'roadmap', 'asset-share'], voiceChannels: ['Recording', 'Brainstorm'] },
    ],
  },
};

function uniquePermissionList(permissions) {
  return [...new Set(permissions)];
}

function cloneConfig(config) {
  return JSON.parse(JSON.stringify(config));
}

function normalizeSpaces(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeDisplayName(value) {
  return normalizeSpaces(value).slice(0, 100);
}

function normalizeTextChannelName(value) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-_]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100);

  return normalized || 'canale';
}

function normalizeRoleReference(value) {
  const trimmed = normalizeSpaces(String(value || ''));
  if (!trimmed) return '';

  const mentionMatch = trimmed.match(/^<@&(\d+)>$/);
  if (mentionMatch) return mentionMatch[1];

  const cleaned = trimmed.replace(/^@/, '');
  if (!cleaned) return '';
  if (cleaned.toLowerCase() === 'everyone') return '@everyone';

  return cleaned;
}

function normalizeRoleLookupKey(value) {
  return normalizeRoleReference(value).toLowerCase();
}

function uniqueRoleReferences(values) {
  const seen = new Set();
  return values.filter(value => {
    const key = normalizeRoleLookupKey(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function createEmptyTextChannel(name) {
  return {
    name: normalizeDisplayName(name),
    visibility: 'inherit',
    showRoles: [],
    hideRoles: [],
    readonly: false,
    nsfw: false,
    slowmodeSeconds: null,
  };
}

function createEmptyVoiceChannel(name) {
  return {
    name: normalizeDisplayName(name),
    visibility: 'inherit',
    showRoles: [],
    hideRoles: [],
    userLimit: null,
  };
}

function normalizeTextChannelConfig(channel) {
  if (typeof channel === 'string') {
    return createEmptyTextChannel(channel);
  }

  return {
    ...createEmptyTextChannel(channel.name || ''),
    ...channel,
    name: normalizeDisplayName(channel.name || ''),
    visibility: channel.visibility === 'private' || channel.visibility === 'public' ? channel.visibility : 'inherit',
    showRoles: uniqueRoleReferences((channel.showRoles || []).map(normalizeRoleReference)),
    hideRoles: uniqueRoleReferences((channel.hideRoles || []).map(normalizeRoleReference)),
    readonly: Boolean(channel.readonly),
    nsfw: Boolean(channel.nsfw),
    slowmodeSeconds: typeof channel.slowmodeSeconds === 'number' ? channel.slowmodeSeconds : null,
  };
}

function normalizeVoiceChannelConfig(channel) {
  if (typeof channel === 'string') {
    return createEmptyVoiceChannel(channel);
  }

  return {
    ...createEmptyVoiceChannel(channel.name || ''),
    ...channel,
    name: normalizeDisplayName(channel.name || ''),
    visibility: channel.visibility === 'private' || channel.visibility === 'public' ? channel.visibility : 'inherit',
    showRoles: uniqueRoleReferences((channel.showRoles || []).map(normalizeRoleReference)),
    hideRoles: uniqueRoleReferences((channel.hideRoles || []).map(normalizeRoleReference)),
    userLimit: typeof channel.userLimit === 'number' ? channel.userLimit : null,
  };
}

function normalizeCategoryConfig(category) {
  return {
    name: normalizeDisplayName(category.name || ''),
    visibility: category.visibility === 'private' ? 'private' : 'public',
    showRoles: uniqueRoleReferences((category.showRoles || []).map(normalizeRoleReference)),
    hideRoles: uniqueRoleReferences((category.hideRoles || []).map(normalizeRoleReference)),
    textChannels: (category.textChannels || []).map(normalizeTextChannelConfig),
    voiceChannels: (category.voiceChannels || []).map(normalizeVoiceChannelConfig),
  };
}

function normalizeBuilderConfig(config) {
  const categories = (config?.categories || [])
    .map(normalizeCategoryConfig)
    .filter(category => category.name);

  return { categories };
}

function countChannels(config) {
  return (config.categories || []).reduce(
    (total, category) => total + category.textChannels.length + category.voiceChannels.length,
    0,
  );
}

function assertConfigHasChannels(config) {
  if (!config.categories.length) {
    throw new Error('Inserisci almeno una categoria.');
  }

  if (countChannels(config) === 0) {
    throw new Error('La configurazione deve contenere almeno un canale testuale o vocale.');
  }
}

function parseList(value, formatter = normalizeDisplayName) {
  return value
    .split(',')
    .map(item => formatter(item))
    .filter(Boolean);
}

function consumeBracketList(raw, regex, receiver) {
  return raw.replace(regex, (_, value) => {
    receiver(parseList(value, normalizeRoleReference));
    return ' ';
  });
}

function consumeSingleValue(raw, regex, receiver) {
  return raw.replace(regex, (_, value) => {
    receiver(value);
    return ' ';
  });
}

function parseSlowmodeValue(value, lineNumber) {
  const normalized = normalizeSpaces(String(value || '')).toLowerCase();
  if (!normalized || normalized === 'off' || normalized === 'none' || normalized === '0') {
    return 0;
  }

  const milliseconds = ms(normalized);
  if (typeof milliseconds !== 'number' || Number.isNaN(milliseconds)) {
    throw new Error(`Riga ${lineNumber}: slowmode non valido. Usa ad esempio slowmode[30s] o slowmode[5m].`);
  }

  const seconds = Math.floor(milliseconds / 1000);
  if (seconds < 0 || seconds > 21600) {
    throw new Error(`Riga ${lineNumber}: slowmode fuori limite. Discord consente da 0 a 21600 secondi.`);
  }

  return seconds;
}

function parseUserLimitValue(value, lineNumber) {
  const normalized = normalizeSpaces(String(value || '')).toLowerCase();
  if (!normalized || normalized === 'off' || normalized === 'none' || normalized === '0' || normalized === 'unlimited') {
    return 0;
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 99) {
    throw new Error(`Riga ${lineNumber}: limit non valido. Usa un numero da 0 a 99.`);
  }

  return parsed;
}

function parseCategoryOptionString(raw, lineNumber) {
  const options = {
    visibility: 'public',
    showRoles: [],
    hideRoles: [],
  };

  let working = raw || '';
  working = consumeBracketList(working, SHOW_BLOCK_REGEX, roles => {
    options.showRoles.push(...roles);
  });
  working = consumeBracketList(working, HIDE_BLOCK_REGEX, roles => {
    options.hideRoles.push(...roles);
  });

  const tokens = normalizeSpaces(working).split(' ').filter(Boolean);
  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (lower === 'private') {
      options.visibility = 'private';
      continue;
    }
    if (lower === 'public') {
      options.visibility = 'public';
      continue;
    }

    throw new Error(`Riga ${lineNumber}: opzione categoria non riconosciuta: ${token}`);
  }

  options.showRoles = uniqueRoleReferences(options.showRoles.map(normalizeRoleReference));
  options.hideRoles = uniqueRoleReferences(options.hideRoles.map(normalizeRoleReference));
  return options;
}

function parseChannelLine(line, lineNumber, kind) {
  const prefix = kind === 'text' ? '#' : '+';
  const content = normalizeSpaces(line.slice(prefix.length));
  if (!content) {
    throw new Error(`Riga ${lineNumber}: manca il nome del canale.`);
  }

  const channel = kind === 'text' ? createEmptyTextChannel('') : createEmptyVoiceChannel('');
  let working = content;

  working = consumeBracketList(working, SHOW_BLOCK_REGEX, roles => {
    channel.showRoles.push(...roles);
  });
  working = consumeBracketList(working, HIDE_BLOCK_REGEX, roles => {
    channel.hideRoles.push(...roles);
  });
  working = consumeSingleValue(working, SLOWMODE_BLOCK_REGEX, value => {
    if (kind !== 'text') {
      throw new Error(`Riga ${lineNumber}: slowmode e disponibile solo per i canali testuali.`);
    }
    channel.slowmodeSeconds = parseSlowmodeValue(value, lineNumber);
  });
  working = consumeSingleValue(working, LIMIT_BLOCK_REGEX, value => {
    if (kind !== 'voice') {
      throw new Error(`Riga ${lineNumber}: limit e disponibile solo per i canali vocali.`);
    }
    channel.userLimit = parseUserLimitValue(value, lineNumber);
  });
  working = consumeSingleValue(working, SLOWMODE_INLINE_REGEX, value => {
    if (kind !== 'text') {
      throw new Error(`Riga ${lineNumber}: slowmode e disponibile solo per i canali testuali.`);
    }
    channel.slowmodeSeconds = parseSlowmodeValue(value, lineNumber);
  });
  working = consumeSingleValue(working, LIMIT_INLINE_REGEX, value => {
    if (kind !== 'voice') {
      throw new Error(`Riga ${lineNumber}: limit e disponibile solo per i canali vocali.`);
    }
    channel.userLimit = parseUserLimitValue(value, lineNumber);
  });

  const tokens = normalizeSpaces(working).split(' ').filter(Boolean);
  const allowedFlags = kind === 'text'
    ? new Set(['public', 'private', 'readonly', 'nsfw'])
    : new Set(['public', 'private']);

  while (tokens.length) {
    const candidate = tokens[tokens.length - 1].toLowerCase();
    if (!allowedFlags.has(candidate)) {
      if (BOOLEAN_FLAGS.has(candidate)) {
        throw new Error(`Riga ${lineNumber}: l opzione ${candidate} non e valida per questo tipo di canale.`);
      }
      break;
    }

    tokens.pop();
    if (candidate === 'public' || candidate === 'private') {
      channel.visibility = candidate;
    }
    if (candidate === 'readonly') {
      channel.readonly = true;
    }
    if (candidate === 'nsfw') {
      channel.nsfw = true;
    }
  }

  channel.name = normalizeDisplayName(tokens.join(' '));
  if (!channel.name) {
    throw new Error(`Riga ${lineNumber}: manca il nome del canale.`);
  }

  channel.showRoles = uniqueRoleReferences(channel.showRoles.map(normalizeRoleReference));
  channel.hideRoles = uniqueRoleReferences(channel.hideRoles.map(normalizeRoleReference));

  return kind === 'text' ? normalizeTextChannelConfig(channel) : normalizeVoiceChannelConfig(channel);
}

function parseLegacyStructureInput(input) {
  const lines = input
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    throw new Error('Inserisci almeno una riga di struttura.');
  }

  const categories = [];

  for (const [index, line] of lines.entries()) {
    const parts = line.split('|').map(part => part.trim());
    if (parts.length > 3) {
      throw new Error(`Riga ${index + 1} non valida. Usa il formato Categoria | testuale1, testuale2 | vocale1, vocale2`);
    }

    const categoryName = normalizeDisplayName(parts[0] || '');
    if (!categoryName) {
      throw new Error(`Riga ${index + 1}: manca il nome della categoria.`);
    }

    const textChannels = parts[1] ? parseList(parts[1], normalizeDisplayName).map(name => createEmptyTextChannel(name)) : [];
    const voiceChannels = parts[2] ? parseList(parts[2], normalizeDisplayName).map(name => createEmptyVoiceChannel(name)) : [];

    const existing = categories.find(category => category.name.toLowerCase() === categoryName.toLowerCase());
    if (existing) {
      const existingTextNames = new Set(existing.textChannels.map(channel => channel.name.toLowerCase()));
      const existingVoiceNames = new Set(existing.voiceChannels.map(channel => channel.name.toLowerCase()));

      for (const channel of textChannels) {
        if (!existingTextNames.has(channel.name.toLowerCase())) {
          existing.textChannels.push(channel);
          existingTextNames.add(channel.name.toLowerCase());
        }
      }

      for (const channel of voiceChannels) {
        if (!existingVoiceNames.has(channel.name.toLowerCase())) {
          existing.voiceChannels.push(channel);
          existingVoiceNames.add(channel.name.toLowerCase());
        }
      }

      continue;
    }

    categories.push(normalizeCategoryConfig({
      name: categoryName,
      textChannels,
      voiceChannels,
    }));
  }

  const config = { categories };
  assertConfigHasChannels(config);
  return config;
}

function parseGuidedStructureInput(input) {
  const lines = input
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !line.startsWith('//'));

  if (!lines.length) {
    throw new Error('Inserisci almeno una riga di struttura.');
  }

  const categories = [];
  let currentCategory = null;

  for (const [index, rawLine] of lines.entries()) {
    const lineNumber = index + 1;
    const line = normalizeSpaces(rawLine);

    if (line.startsWith('[')) {
      const match = line.match(CATEGORY_HEADER_REGEX);
      if (!match) {
        throw new Error(`Riga ${lineNumber}: intestazione categoria non valida.`);
      }

      const name = normalizeDisplayName(match[1]);
      if (!name) {
        throw new Error(`Riga ${lineNumber}: manca il nome della categoria.`);
      }

      const duplicate = categories.find(category => category.name.toLowerCase() === name.toLowerCase());
      if (duplicate) {
        throw new Error(`Riga ${lineNumber}: la categoria ${name} e stata definita piu di una volta.`);
      }

      currentCategory = normalizeCategoryConfig({
        name,
        ...parseCategoryOptionString(match[2], lineNumber),
      });
      categories.push(currentCategory);
      continue;
    }

    if (line.startsWith('#')) {
      if (!currentCategory) {
        throw new Error(`Riga ${lineNumber}: definisci prima una categoria con [Nome Categoria].`);
      }

      const channel = parseChannelLine(line, lineNumber, 'text');
      const existing = currentCategory.textChannels.find(item => item.name.toLowerCase() === channel.name.toLowerCase());
      if (existing) {
        Object.assign(existing, channel);
      } else {
        currentCategory.textChannels.push(channel);
      }
      continue;
    }

    if (line.startsWith('+')) {
      if (!currentCategory) {
        throw new Error(`Riga ${lineNumber}: definisci prima una categoria con [Nome Categoria].`);
      }

      const channel = parseChannelLine(line, lineNumber, 'voice');
      const existing = currentCategory.voiceChannels.find(item => item.name.toLowerCase() === channel.name.toLowerCase());
      if (existing) {
        Object.assign(existing, channel);
      } else {
        currentCategory.voiceChannels.push(channel);
      }
      continue;
    }

    throw new Error(`Riga ${lineNumber}: formato non riconosciuto. Usa [Categoria], # canale o + vocale.`);
  }

  const config = normalizeBuilderConfig({ categories });
  assertConfigHasChannels(config);
  return config;
}

function parseStructureInput(input) {
  const trimmed = String(input || '').trim();
  if (!trimmed) {
    throw new Error('Inserisci almeno una riga di struttura.');
  }

  const hasGuidedSyntax = /^\s*(\[|#|\+)/m.test(trimmed);
  return hasGuidedSyntax ? parseGuidedStructureInput(trimmed) : parseLegacyStructureInput(trimmed);
}

function formatRoleList(values) {
  return values.map(role => role === '@everyone' ? '@everyone' : role).join(', ');
}

function formatChannelOptions(channel, kind) {
  const tags = [];

  if (channel.visibility === 'private') tags.push('private');
  if (channel.visibility === 'public') tags.push('public');
  if (channel.showRoles.length) tags.push(`show[${formatRoleList(channel.showRoles)}]`);
  if (channel.hideRoles.length) tags.push(`hide[${formatRoleList(channel.hideRoles)}]`);

  if (kind === 'text') {
    if (channel.readonly) tags.push('readonly');
    if (channel.nsfw) tags.push('nsfw');
    if (typeof channel.slowmodeSeconds === 'number') tags.push(`slowmode[${channel.slowmodeSeconds}s]`);
  }

  if (kind === 'voice' && typeof channel.userLimit === 'number') {
    tags.push(`limit[${channel.userLimit}]`);
  }

  return tags.length ? ` ${tags.join(' ')}` : '';
}

function serializeBuilderStructure(config) {
  return (normalizeBuilderConfig(config).categories || [])
    .map(category => {
      const headerOptions = [];
      if (category.visibility === 'private') headerOptions.push('private');
      if (category.showRoles.length) headerOptions.push(`show[${formatRoleList(category.showRoles)}]`);
      if (category.hideRoles.length) headerOptions.push(`hide[${formatRoleList(category.hideRoles)}]`);

      const lines = [`[${category.name}]${headerOptions.length ? ` ${headerOptions.join(' ')}` : ''}`];

      for (const channel of category.textChannels) {
        lines.push(`# ${channel.name}${formatChannelOptions(channel, 'text')}`);
      }

      for (const channel of category.voiceChannels) {
        lines.push(`+ ${channel.name}${formatChannelOptions(channel, 'voice')}`);
      }

      return lines.join('\n');
    })
    .join('\n\n');
}

function getBuilderPresetPayload(presetKey) {
  const preset = BUILDER_PRESETS[presetKey];
  if (!preset) return null;

  return {
    name: preset.label,
    source: 'preset',
    presetKey,
    config: normalizeBuilderConfig({ categories: cloneConfig(preset.categories) }),
  };
}

function formatCategoryValue(category) {
  const lines = [];

  if (category.visibility === 'private' || category.showRoles.length || category.hideRoles.length) {
    const permissions = [];
    if (category.visibility === 'private') permissions.push('Privata');
    if (category.showRoles.length) permissions.push(`Mostra: ${formatRoleList(category.showRoles)}`);
    if (category.hideRoles.length) permissions.push(`Nascondi: ${formatRoleList(category.hideRoles)}`);
    lines.push(`Permessi: ${permissions.join(' | ')}`);
  }

  if (category.textChannels.length) {
    const textSummary = category.textChannels
      .map(channel => {
        const options = [];
        if (channel.readonly) options.push('readonly');
        if (channel.visibility === 'private') options.push('private');
        if (channel.showRoles.length) options.push(`show:${channel.showRoles.length}`);
        if (channel.slowmodeSeconds) options.push(`slow:${channel.slowmodeSeconds}s`);
        return `#${normalizeTextChannelName(channel.name)}${options.length ? ` (${options.join(', ')})` : ''}`;
      })
      .join(', ');
    lines.push(`Text: ${textSummary}`);
  }

  if (category.voiceChannels.length) {
    const voiceSummary = category.voiceChannels
      .map(channel => {
        const options = [];
        if (channel.visibility === 'private') options.push('private');
        if (channel.showRoles.length) options.push(`show:${channel.showRoles.length}`);
        if (typeof channel.userLimit === 'number' && channel.userLimit > 0) options.push(`limit:${channel.userLimit}`);
        return `${channel.name}${options.length ? ` (${options.join(', ')})` : ''}`;
      })
      .join(', ');
    lines.push(`Voice: ${voiceSummary}`);
  }

  return lines.join('\n') || 'Vuota';
}

function createBuilderPreviewEmbed(guildId, payload, extraDescription = null) {
  const config = normalizeBuilderConfig(payload.config);
  const sourceLabel = payload.source === 'preset' ? `Preset: ${payload.name}` : `Template: ${payload.name}`;
  const description = [
    sourceLabel,
    `Categorie: ${config.categories.length} | Canali: ${countChannels(config)}`,
    extraDescription,
  ].filter(Boolean).join('\n');
  const fields = config.categories.slice(0, 25).map(category => ({
    name: category.name,
    value: formatCategoryValue(category),
    inline: false,
  }));

  return createEmbed(guildId, {
    title: 'Builder server',
    description,
    fields,
  });
}

function createBuilderGuideEmbed(guildId) {
  return createEmbed(guildId, {
    title: 'Guida builder rapido',
    description: [
      'Formato consigliato:',
      '[Categoria] private show[Staff, Admin]',
      '# regole readonly',
      '# mod-log readonly show[Staff, Admin]',
      '+ Riunione Staff limit[10]',
      '',
      'Tag utili: private, public, readonly, nsfw, show[...], hide[...], slowmode[30s], limit[5]',
      'Il formato vecchio "Categoria | testo1, testo2 | vocale1, vocale2" continua a funzionare.',
    ].join('\n'),
  });
}

function createBuilderCreateActionRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(BUILDER_CREATE_NOW_BUTTON_ID)
      .setLabel('Crea subito')
      .setStyle(ButtonStyle.Success),
  );
}

function getSavedBuilderPayload(guildId) {
  const saved = getGuildBuilderConfig(guildId);
  if (!saved) return null;

  return {
    name: saved.name,
    source: saved.source,
    presetKey: saved.preset_key,
    config: normalizeBuilderConfig(saved.config),
    updatedBy: saved.updated_by,
    updatedAt: saved.updated_at,
  };
}

function collectRoleReferences(config) {
  const collected = [];

  for (const category of config.categories || []) {
    collected.push(...category.showRoles, ...category.hideRoles);
    for (const channel of category.textChannels || []) {
      collected.push(...channel.showRoles, ...channel.hideRoles);
    }
    for (const channel of category.voiceChannels || []) {
      collected.push(...channel.showRoles, ...channel.hideRoles);
    }
  }

  return uniqueRoleReferences(collected.map(normalizeRoleReference));
}

function resolveRoleReference(guild, reference) {
  const normalized = normalizeRoleReference(reference);
  if (!normalized) return null;
  if (normalized === '@everyone') return guild.roles.everyone;
  if (/^\d+$/.test(normalized)) {
    return guild.roles.cache.get(normalized) || null;
  }

  const lookup = normalized.toLowerCase();
  return guild.roles.cache.find(role => role.name.toLowerCase() === lookup) || null;
}

function createRoleResolutionMap(guild, references) {
  const resolved = new Map();
  const missing = [];

  for (const reference of references) {
    const key = normalizeRoleLookupKey(reference);
    if (!key || resolved.has(key)) continue;

    const role = resolveRoleReference(guild, reference);
    if (!role) {
      missing.push(reference);
      continue;
    }

    resolved.set(key, role.id);
  }

  return { resolved, missing: uniqueRoleReferences(missing) };
}

function getResolvedRoleId(guild, roleMap, reference) {
  const key = normalizeRoleLookupKey(reference);
  if (!key) return null;
  if (key === '@everyone') return guild.roles.everyone.id;
  return roleMap.get(key) || null;
}

function applyPermissionOverwrite(map, id, allow = [], deny = []) {
  const key = String(id);
  const current = map.get(key) || { id: key, allow: new Set(), deny: new Set() };

  for (const permission of allow) {
    current.allow.add(permission);
    current.deny.delete(permission);
  }

  for (const permission of deny) {
    current.deny.add(permission);
    current.allow.delete(permission);
  }

  map.set(key, current);
}

function finalizePermissionOverwrites(map) {
  return Array.from(map.values())
    .map(entry => ({
      id: entry.id,
      allow: [...entry.allow],
      deny: [...entry.deny],
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function addRoleVisibilityOverwrites(map, guild, roleMap, showRoles = [], hideRoles = [], allowPermissions = DEFAULT_CHANNEL_ACCESS_PERMISSIONS) {
  for (const roleReference of showRoles) {
    const roleId = getResolvedRoleId(guild, roleMap, roleReference);
    if (roleId) {
      applyPermissionOverwrite(map, roleId, allowPermissions, []);
    }
  }

  for (const roleReference of hideRoles) {
    const roleId = getResolvedRoleId(guild, roleMap, roleReference);
    if (roleId) {
      applyPermissionOverwrite(map, roleId, [], [PermissionFlagsBits.ViewChannel]);
    }
  }
}

function buildCategoryPermissionOverwrites(guild, categoryConfig, roleMap) {
  const overwrites = new Map();

  if (categoryConfig.visibility === 'private') {
    applyPermissionOverwrite(overwrites, guild.roles.everyone.id, [], [PermissionFlagsBits.ViewChannel]);
  }

  addRoleVisibilityOverwrites(overwrites, guild, roleMap, categoryConfig.showRoles, categoryConfig.hideRoles);
  return finalizePermissionOverwrites(overwrites);
}

function hasTextSpecificOverrides(channelConfig) {
  return channelConfig.visibility !== 'inherit'
    || channelConfig.showRoles.length > 0
    || channelConfig.hideRoles.length > 0
    || channelConfig.readonly;
}

function hasVoiceSpecificOverrides(channelConfig) {
  return channelConfig.visibility !== 'inherit'
    || channelConfig.showRoles.length > 0
    || channelConfig.hideRoles.length > 0;
}

function buildTextChannelPermissionOverwrites(guild, categoryConfig, channelConfig, roleMap) {
  if (!hasTextSpecificOverrides(channelConfig)) {
    return null;
  }

  const overwrites = new Map();

  if (categoryConfig.visibility === 'private') {
    applyPermissionOverwrite(overwrites, guild.roles.everyone.id, [], [PermissionFlagsBits.ViewChannel]);
  }
  addRoleVisibilityOverwrites(overwrites, guild, roleMap, categoryConfig.showRoles, categoryConfig.hideRoles);

  if (channelConfig.visibility === 'private') {
    applyPermissionOverwrite(overwrites, guild.roles.everyone.id, [], [PermissionFlagsBits.ViewChannel]);
  }
  if (channelConfig.visibility === 'public') {
    applyPermissionOverwrite(overwrites, guild.roles.everyone.id, TEXT_ACCESS_PERMISSIONS, []);
  }

  addRoleVisibilityOverwrites(overwrites, guild, roleMap, channelConfig.showRoles, channelConfig.hideRoles, TEXT_ACCESS_PERMISSIONS);

  if (channelConfig.readonly) {
    applyPermissionOverwrite(overwrites, guild.roles.everyone.id, [], TEXT_WRITE_PERMISSIONS);
    const writerRoles = uniqueRoleReferences([...categoryConfig.showRoles, ...channelConfig.showRoles]);
    for (const roleReference of writerRoles) {
      const roleId = getResolvedRoleId(guild, roleMap, roleReference);
      if (roleId) {
        applyPermissionOverwrite(overwrites, roleId, TEXT_WRITE_PERMISSIONS, []);
      }
    }
  }

  return finalizePermissionOverwrites(overwrites);
}

function buildVoiceChannelPermissionOverwrites(guild, categoryConfig, channelConfig, roleMap) {
  if (!hasVoiceSpecificOverrides(channelConfig)) {
    return null;
  }

  const overwrites = new Map();

  if (categoryConfig.visibility === 'private') {
    applyPermissionOverwrite(overwrites, guild.roles.everyone.id, [], [PermissionFlagsBits.ViewChannel]);
  }
  addRoleVisibilityOverwrites(overwrites, guild, roleMap, categoryConfig.showRoles, categoryConfig.hideRoles);

  if (channelConfig.visibility === 'private') {
    applyPermissionOverwrite(overwrites, guild.roles.everyone.id, [], [PermissionFlagsBits.ViewChannel]);
  }
  if (channelConfig.visibility === 'public') {
    applyPermissionOverwrite(overwrites, guild.roles.everyone.id, VOICE_ACCESS_PERMISSIONS, []);
  }

  addRoleVisibilityOverwrites(overwrites, guild, roleMap, channelConfig.showRoles, channelConfig.hideRoles, VOICE_ACCESS_PERMISSIONS);
  return finalizePermissionOverwrites(overwrites);
}

function normalizePermissionOverwriteSnapshot(overwrites) {
  const collection = Array.isArray(overwrites)
    ? overwrites
    : Array.from(overwrites.values()).map(entry => ({
      id: entry.id,
      allow: entry.allow,
      deny: entry.deny,
    }));

  return JSON.stringify(collection
    .map(entry => ({
      id: String(entry.id),
      allow: PermissionsBitField.resolve(entry.allow || []).toString(),
      deny: PermissionsBitField.resolve(entry.deny || []).toString(),
    }))
    .sort((left, right) => left.id.localeCompare(right.id)));
}

function permissionOverwritesEqual(existing, desired) {
  return normalizePermissionOverwriteSnapshot(existing) === normalizePermissionOverwriteSnapshot(desired);
}

async function syncCategoryChannel(categoryChannel, desiredOverwrites) {
  if (!permissionOverwritesEqual(categoryChannel.permissionOverwrites.cache, desiredOverwrites)) {
    await categoryChannel.edit({ permissionOverwrites: desiredOverwrites });
    return true;
  }

  return false;
}

async function syncTextChannel(channel, category, categoryConfig, channelConfig, roleMap) {
  const desiredOverwrites = buildTextChannelPermissionOverwrites(channel.guild, categoryConfig, channelConfig, roleMap);
  let updated = false;

  if (channel.parentId !== category.id) {
    await channel.setParent(category.id, { lockPermissions: !desiredOverwrites });
    updated = true;
  }

  const editPayload = {};
  const desiredSlowmode = channelConfig.slowmodeSeconds ?? 0;

  if (channel.rateLimitPerUser !== desiredSlowmode) {
    editPayload.rateLimitPerUser = desiredSlowmode;
  }

  if (channel.nsfw !== Boolean(channelConfig.nsfw)) {
    editPayload.nsfw = Boolean(channelConfig.nsfw);
  }

  if (desiredOverwrites) {
    if (!permissionOverwritesEqual(channel.permissionOverwrites.cache, desiredOverwrites)) {
      editPayload.permissionOverwrites = desiredOverwrites;
    }
  } else if (channel.permissionsLocked !== true) {
    await channel.lockPermissions();
    updated = true;
  }

  if (Object.keys(editPayload).length) {
    await channel.edit(editPayload);
    updated = true;
  }

  return updated;
}

async function syncVoiceChannel(channel, category, categoryConfig, channelConfig, roleMap) {
  const desiredOverwrites = buildVoiceChannelPermissionOverwrites(channel.guild, categoryConfig, channelConfig, roleMap);
  let updated = false;

  if (channel.parentId !== category.id) {
    await channel.setParent(category.id, { lockPermissions: !desiredOverwrites });
    updated = true;
  }

  const editPayload = {};
  const desiredUserLimit = channelConfig.userLimit ?? 0;

  if (channel.userLimit !== desiredUserLimit) {
    editPayload.userLimit = desiredUserLimit;
  }

  if (desiredOverwrites) {
    if (!permissionOverwritesEqual(channel.permissionOverwrites.cache, desiredOverwrites)) {
      editPayload.permissionOverwrites = desiredOverwrites;
    }
  } else if (channel.permissionsLocked !== true) {
    await channel.lockPermissions();
    updated = true;
  }

  if (Object.keys(editPayload).length) {
    await channel.edit(editPayload);
    updated = true;
  }

  return updated;
}

async function buildServerStructure(guild, payload) {
  const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
  if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
    throw new Error('Mi serve il permesso "Gestisci canali" per creare categorie e canali.');
  }

  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    throw new Error('Mi serve anche il permesso "Gestisci ruoli" per applicare i permessi alle stanze.');
  }

  await guild.channels.fetch();
  await guild.roles.fetch();

  const normalizedPayload = {
    ...payload,
    config: normalizeBuilderConfig(payload.config),
  };
  assertConfigHasChannels(normalizedPayload.config);

  const referencedRoles = collectRoleReferences(normalizedPayload.config);
  const { resolved: roleMap, missing } = createRoleResolutionMap(guild, referencedRoles);
  if (missing.length) {
    throw new Error(`Ruoli non trovati: ${missing.join(', ')}`);
  }

  const summary = {
    createdCategories: 0,
    updatedCategories: 0,
    createdTextChannels: 0,
    updatedTextChannels: 0,
    createdVoiceChannels: 0,
    updatedVoiceChannels: 0,
    skipped: 0,
  };

  for (const categoryConfig of normalizedPayload.config.categories) {
    const desiredCategoryOverwrites = buildCategoryPermissionOverwrites(guild, categoryConfig, roleMap);
    let category = guild.channels.cache.find(channel =>
      channel.type === ChannelType.GuildCategory
      && channel.name.toLowerCase() === categoryConfig.name.toLowerCase(),
    );

    if (!category) {
      category = await guild.channels.create({
        name: categoryConfig.name,
        type: ChannelType.GuildCategory,
        permissionOverwrites: desiredCategoryOverwrites,
      });
      summary.createdCategories++;
    } else {
      const categoryUpdated = await syncCategoryChannel(category, desiredCategoryOverwrites);
      if (categoryUpdated) {
        summary.updatedCategories++;
      } else {
        summary.skipped++;
      }
    }

    for (const textConfig of categoryConfig.textChannels) {
      const channelName = normalizeTextChannelName(textConfig.name);
      const permissionOverwrites = buildTextChannelPermissionOverwrites(guild, categoryConfig, textConfig, roleMap);
      const existing = guild.channels.cache.find(channel =>
        channel.type === ChannelType.GuildText
        && channel.parentId === category.id
        && channel.name === channelName,
      );

      if (!existing) {
        await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: category.id,
          nsfw: Boolean(textConfig.nsfw),
          rateLimitPerUser: textConfig.slowmodeSeconds ?? 0,
          ...(permissionOverwrites ? { permissionOverwrites } : {}),
        });
        summary.createdTextChannels++;
        continue;
      }

      const updated = await syncTextChannel(existing, category, categoryConfig, textConfig, roleMap);
      if (updated) {
        summary.updatedTextChannels++;
      } else {
        summary.skipped++;
      }
    }

    for (const voiceConfig of categoryConfig.voiceChannels) {
      const normalizedVoiceName = normalizeDisplayName(voiceConfig.name);
      const permissionOverwrites = buildVoiceChannelPermissionOverwrites(guild, categoryConfig, voiceConfig, roleMap);
      const existing = guild.channels.cache.find(channel =>
        channel.type === ChannelType.GuildVoice
        && channel.parentId === category.id
        && channel.name.toLowerCase() === normalizedVoiceName.toLowerCase(),
      );

      if (!existing) {
        await guild.channels.create({
          name: normalizedVoiceName,
          type: ChannelType.GuildVoice,
          parent: category.id,
          userLimit: voiceConfig.userLimit ?? 0,
          ...(permissionOverwrites ? { permissionOverwrites } : {}),
        });
        summary.createdVoiceChannels++;
        continue;
      }

      const updated = await syncVoiceChannel(existing, category, categoryConfig, voiceConfig, roleMap);
      if (updated) {
        summary.updatedVoiceChannels++;
      } else {
        summary.skipped++;
      }
    }
  }

  return summary;
}

async function handleServerBuilderConfigModal(interaction) {
  const name = normalizeDisplayName(interaction.fields.getTextInputValue('builder_template_name') || 'Template personalizzato');
  const structure = interaction.fields.getTextInputValue('builder_structure');

  try {
    const config = parseStructureInput(structure);
    const payload = {
      name: name || 'Template personalizzato',
      source: 'custom',
      presetKey: null,
      config,
    };

    saveGuildBuilderConfig(interaction.guild.id, payload, interaction.user.id);

    await interaction.reply({
      embeds: [
        successEmbed(interaction.guild.id, 'Configurazione salvata', 'Il builder rapido del server e stato aggiornato.'),
        createBuilderPreviewEmbed(interaction.guild.id, payload, 'Puoi creare tutto subito con il bottone qui sotto.'),
      ],
      components: [createBuilderCreateActionRow()],
      ephemeral: true,
    });
  } catch (error) {
    await interaction.reply({
      embeds: [errorEmbed(interaction.guild.id, 'Struttura non valida', error.message)],
      ephemeral: true,
    });
  }
}

async function handleServerBuilderCreateNow(interaction) {
  const savedPayload = getSavedBuilderPayload(interaction.guild.id);
  if (!savedPayload) {
    await interaction.reply({
      embeds: [createNoConfigEmbed(interaction.guild.id)],
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const summary = await buildServerStructure(interaction.guild, savedPayload);
    await interaction.editReply({
      embeds: [
        createBuilderResultEmbed(interaction.guild.id, savedPayload, summary, true),
        createBuilderPreviewEmbed(interaction.guild.id, savedPayload),
      ],
    });
  } catch (error) {
    await interaction.editReply({
      embeds: [errorEmbed(interaction.guild.id, 'Builder fallito', error.message)],
    });
  }
}

function createBuilderResultEmbed(guildId, payload, summary, saved = false) {
  const totalCreated = summary.createdCategories + summary.createdTextChannels + summary.createdVoiceChannels;
  const totalUpdated = summary.updatedCategories + summary.updatedTextChannels + summary.updatedVoiceChannels;
  const actionText = totalCreated + totalUpdated === 0
    ? 'Tutti gli elementi erano gia allineati alla configurazione.'
    : 'La struttura e stata applicata con successo.';

  return createEmbed(guildId, {
    title: 'Builder completato',
    description: [
      saved ? `Configurazione attiva: ${payload.name}` : null,
      actionText,
    ].filter(Boolean).join('\n'),
    fields: [
      { name: 'Categorie create', value: String(summary.createdCategories), inline: true },
      { name: 'Categorie aggiornate', value: String(summary.updatedCategories), inline: true },
      { name: 'Testuali creati', value: String(summary.createdTextChannels), inline: true },
      { name: 'Testuali aggiornati', value: String(summary.updatedTextChannels), inline: true },
      { name: 'Vocali creati', value: String(summary.createdVoiceChannels), inline: true },
      { name: 'Vocali aggiornati', value: String(summary.updatedVoiceChannels), inline: true },
      { name: 'Elementi saltati', value: String(summary.skipped), inline: true },
    ],
  });
}

function createNoConfigEmbed(guildId) {
  return infoEmbed(
    guildId,
    'Nessuna configurazione salvata',
    'Usa `/server-builder guida`, `/server-builder preset` oppure `/server-builder configura` per preparare una struttura.',
  );
}

module.exports = {
  BUILDER_MODAL_ID,
  BUILDER_CREATE_NOW_BUTTON_ID,
  BUILDER_PRESETS,
  getBuilderPresetPayload,
  getSavedBuilderPayload,
  parseStructureInput,
  serializeBuilderStructure,
  createBuilderPreviewEmbed,
  createBuilderGuideEmbed,
  createBuilderCreateActionRow,
  buildServerStructure,
  handleServerBuilderConfigModal,
  handleServerBuilderCreateNow,
  createBuilderResultEmbed,
  createNoConfigEmbed,
};

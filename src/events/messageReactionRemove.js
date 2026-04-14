// ═══════════════════════════════════════════════════════════════
//  NicoDev Discord Bot – MessageReactionRemove Event
//  Gestisce la rimozione di reazioni per i reaction roles
// ═══════════════════════════════════════════════════════════════

const { getReactionRole, isGuildBlocked } = require('../database/db');

module.exports = {
  name: 'messageReactionRemove',
  async execute(reaction, user) {
    if (user.bot) return;

    if (reaction.partial) {
      try { await reaction.fetch(); } catch { return; }
    }
    if (reaction.message.partial) {
      try { await reaction.message.fetch(); } catch { return; }
    }

    const { message } = reaction;
    if (!message.guild) return;
    if (isGuildBlocked(message.guild.id)) return;

    const emoji = reaction.emoji.id
      ? `<:${reaction.emoji.name}:${reaction.emoji.id}>`
      : reaction.emoji.name;

    const emojiAlt = reaction.emoji.id
      ? `${reaction.emoji.name}:${reaction.emoji.id}`
      : reaction.emoji.name;

    const rr = getReactionRole(message.id, emoji) || getReactionRole(message.id, emojiAlt);
    if (!rr) return;

    // Mode "add" = solo aggiungi, non rimuovere
    if (rr.mode === 'add') return;

    try {
      const member = await message.guild.members.fetch(user.id);
      if (!member) return;

      const role = message.guild.roles.cache.get(rr.role_id);
      if (!role) return;

      await member.roles.remove(role).catch(() => {});
    } catch (error) {
      console.error('[ReactionRole] Errore remove:', error.message);
    }
  },
};

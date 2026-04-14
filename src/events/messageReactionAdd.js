// ═══════════════════════════════════════════════════════════════
//  NicoDev Discord Bot – MessageReactionAdd Event
//  Gestisce le reazioni per i reaction roles
// ═══════════════════════════════════════════════════════════════

const { getReactionRole, getReactionRolesByMessage, isGuildBlocked } = require('../database/db');

module.exports = {
  name: 'messageReactionAdd',
  async execute(reaction, user) {
    if (user.bot) return;

    // Gestisci partial reactions
    if (reaction.partial) {
      try { await reaction.fetch(); } catch { return; }
    }
    if (reaction.message.partial) {
      try { await reaction.message.fetch(); } catch { return; }
    }

    const { message } = reaction;
    if (!message.guild) return;
    if (isGuildBlocked(message.guild.id)) return;

    // Ottieni l'emoji come stringa (per emoji custom: <:name:id> → name:id)
    const emoji = reaction.emoji.id
      ? `<:${reaction.emoji.name}:${reaction.emoji.id}>`
      : reaction.emoji.name;

    // Controlla anche il formato senza <>
    const emojiAlt = reaction.emoji.id
      ? `${reaction.emoji.name}:${reaction.emoji.id}`
      : reaction.emoji.name;

    const rr = getReactionRole(message.id, emoji) || getReactionRole(message.id, emojiAlt);
    if (!rr) return;

    try {
      const member = await message.guild.members.fetch(user.id);
      if (!member) return;

      const role = message.guild.roles.cache.get(rr.role_id);
      if (!role) return;

      if (rr.mode === 'unique') {
        // Rimuovi tutti gli altri ruoli dello stesso pannello
        const allRR = getReactionRolesByMessage(message.id);
        for (const other of allRR) {
          if (other.role_id !== rr.role_id && member.roles.cache.has(other.role_id)) {
            await member.roles.remove(other.role_id).catch(() => {});
            // Rimuovi la reazione dell'utente dalla emoji dell'altro ruolo
            const otherReaction = message.reactions.cache.find(r => {
              const rEmoji = r.emoji.id ? `<:${r.emoji.name}:${r.emoji.id}>` : r.emoji.name;
              const rEmojiAlt = r.emoji.id ? `${r.emoji.name}:${r.emoji.id}` : r.emoji.name;
              return rEmoji === other.emoji || rEmojiAlt === other.emoji;
            });
            if (otherReaction) await otherReaction.users.remove(user.id).catch(() => {});
          }
        }
      }

      await member.roles.add(role).catch(() => {});
    } catch (error) {
      console.error('[ReactionRole] Errore add:', error.message);
    }
  },
};

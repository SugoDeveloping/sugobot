// ═══════════════════════════════════════════════════════════════
//  NicoDev Discord Bot – Permissions Check
//  Utility per controllo permessi uniforme
// ═══════════════════════════════════════════════════════════════

const { PermissionFlagsBits } = require('discord.js');

/**
 * Controlla se il membro ha il permesso di Amministratore
 */
function isAdmin(member) {
  return member.permissions.has(PermissionFlagsBits.Administrator);
}

/**
 * Controlla se il membro ha permessi di moderazione
 */
function isModerator(member) {
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ModerateMembers) ||
    member.permissions.has(PermissionFlagsBits.BanMembers) ||
    member.permissions.has(PermissionFlagsBits.KickMembers)
  );
}

/**
 * Controlla se il membro ha un ruolo specifico
 */
function hasRole(member, roleId) {
  return member.roles.cache.has(roleId);
}

/**
 * Controlla la gerarchia dei ruoli (per moderazione)
 */
function canModerate(moderator, target) {
  if (target.id === moderator.guild.ownerId) return false;
  if (moderator.id === moderator.guild.ownerId) return true;
  return moderator.roles.highest.position > target.roles.highest.position;
}

module.exports = {
  isAdmin,
  isModerator,
  hasRole,
  canModerate,
};

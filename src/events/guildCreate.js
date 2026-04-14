// ═══════════════════════════════════════════════════════════════
//  NicoDev Discord Bot – GuildCreate Event
//  Inizializza le impostazioni quando il bot entra in un server
// ═══════════════════════════════════════════════════════════════

const { getGuildSettings } = require('../database/db');

module.exports = {
  name: 'guildCreate',
  async execute(guild) {
    console.log(`[Guild] ➕ Aggiunto al server: ${guild.name} (${guild.id})`);
    getGuildSettings(guild.id); // Inizializza settings
  },
};

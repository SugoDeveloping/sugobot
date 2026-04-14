// ═══════════════════════════════════════════════════════════════
//  NicoDev Discord Bot – Ready Event
// ═══════════════════════════════════════════════════════════════

const { ActivityType } = require('discord.js');
const { startReminderScheduler } = require('../handlers/reminderScheduler');
const { startTwitchScheduler } = require('../handlers/twitchScheduler');
const { startGiveawayScheduler } = require('../handlers/giveawayScheduler');

module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log('═══════════════════════════════════════════════');
    console.log(`  🤖 ${client.user.tag} è online!`);
    console.log(`  📡 Server: ${client.guilds.cache.size}`);
    console.log(`  👥 Utenti: ${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)}`);
    console.log('═══════════════════════════════════════════════');

    // Avvia lo scheduler dei promemoria
    startReminderScheduler(client);

    // Avvia lo scheduler Twitch live notifications
    startTwitchScheduler(client);

    // Avvia lo scheduler dei giveaway
    startGiveawayScheduler(client);

    // Stato personalizzabile
    client.user.setPresence({
      activities: [
        {
          name: '🎫 /help | NicoDev Bot',
          type: ActivityType.Watching,
        },
      ],
      status: 'online',
    });

    // Ruota lo stato ogni 30 secondi
    const statuses = [
      { name: '🎫 /help | Assistenza', type: ActivityType.Watching },
      { name: `📡 ${client.guilds.cache.size} server`, type: ActivityType.Watching },
      { name: '🛡️ Moderazione attiva', type: ActivityType.Playing },
      { name: '📨 /newsletter', type: ActivityType.Listening },
    ];

    let i = 0;
    setInterval(() => {
      client.user.setActivity(statuses[i]);
      i = (i + 1) % statuses.length;
    }, 30000);
  },
};

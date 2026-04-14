// ═══════════════════════════════════════════════════════════════
//  NicoDev Discord Bot – Giveaway Scheduler
//  Controlla periodicamente i giveaway scaduti e li termina
// ═══════════════════════════════════════════════════════════════

const { getAllActiveGiveaways } = require('../database/db');
const { finishGiveaway } = require('./giveawayHandler');

const CHECK_INTERVAL = 15_000; // Controlla ogni 15 secondi

function startGiveawayScheduler(client) {
  setInterval(async () => {
    try {
      const activeGiveaways = getAllActiveGiveaways();
      const now = Date.now();

      for (const giveaway of activeGiveaways) {
        const endsAt = new Date(giveaway.ends_at + 'Z').getTime();
        if (endsAt <= now) {
          console.log(`[Giveaway] Auto-terminando giveaway #${giveaway.id} (${giveaway.prize})`);
          await finishGiveaway(client, giveaway);
        }
      }
    } catch (error) {
      console.error('[Giveaway Scheduler] Errore:', error);
    }
  }, CHECK_INTERVAL);

  console.log('[Giveaway Scheduler] Avviato – controllo ogni 15 secondi');
}

module.exports = { startGiveawayScheduler };

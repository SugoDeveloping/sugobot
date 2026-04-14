// ═══════════════════════════════════════════════════════════════
//  NicoDev Discord Bot – Event Handler
//  Carica automaticamente tutti gli eventi dalla cartella events
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

function loadEvents(client) {
  const eventsPath = path.join(__dirname, '..', 'events');
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

  let loaded = 0;

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
    loaded++;
  }

  console.log(`[Eventi] ✅ Caricati ${loaded} eventi.`);
}

module.exports = { loadEvents };

// ═══════════════════════════════════════════════════════════════
//  NicoDev Discord Bot – Command Handler
//  Carica automaticamente tutti i comandi dalle cartelle
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');

function loadCommands(client) {
  client.commands = new Collection();

  const commandsPath = path.join(__dirname, '..', 'commands');
  const commandFolders = fs.readdirSync(commandsPath);

  let loaded = 0;

  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = path.join(folderPath, file);
      const command = require(filePath);

      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        loaded++;
      } else {
        console.warn(`[Comandi] ⚠ Il comando in ${filePath} manca di "data" o "execute".`);
      }
    }
  }

  console.log(`[Comandi] ✅ Caricati ${loaded} comandi.`);
}

module.exports = { loadCommands };

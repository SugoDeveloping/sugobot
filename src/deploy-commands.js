// ═══════════════════════════════════════════════════════════════
//  NicoDev Discord Bot – Deploy Commands
//  Registra tutti i comandi slash su Discord
// ═══════════════════════════════════════════════════════════════

require('dotenv').config();

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(commandsPath);

// Carica tutti i comandi
for (const folder of commandFolders) {
  const folderPath = path.join(commandsPath, folder);
  if (!fs.statSync(folderPath).isDirectory()) continue;

  const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const command = require(path.join(folderPath, file));
    if ('data' in command) {
      commands.push(command.data.toJSON());
      console.log(`  📌 Caricato: /${command.data.name}`);
    }
  }
}

// ─── Deploy ──────────────────────────────────────────────────
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('\n═══════════════════════════════════════════════');
    console.log(`  🔄 Registrazione di ${commands.length} comandi slash...`);
    console.log('═══════════════════════════════════════════════\n');

    if (process.env.GUILD_ID) {
      // Deploy su un server specifico (istantaneo, per sviluppo)
      const data = await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands },
      );
      console.log(`  ✅ ${data.length} comandi registrati sul server ${process.env.GUILD_ID}`);
    } else {
      // Deploy globale (fino a 1 ora per propagarsi)
      const data = await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands },
      );
      console.log(`  ✅ ${data.length} comandi registrati globalmente`);
    }

    console.log('\n  🎉 Deploy completato con successo!\n');
  } catch (error) {
    console.error('  ❌ Errore durante il deploy:', error);
  }
})();

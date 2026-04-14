// ═══════════════════════════════════════════════════════════════
//  NicoDev Discord Bot – Entry Point
//  Avvia il bot e carica tutti i moduli
// ═══════════════════════════════════════════════════════════════

require('dotenv').config();

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');

// ─── Validazione configurazione ──────────────────────────────
if (!process.env.DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN mancante nel file .env');
  console.error('   Copia .env.example in .env e inserisci il token del bot.');
  process.exit(1);
}

// ─── Creazione client ────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.Reaction,
    Partials.GuildMember,
    Partials.User,
  ],
});

// ─── Caricamento moduli ──────────────────────────────────────
console.log('═══════════════════════════════════════════════');
console.log('  🚀 NicoDev Discord Bot – Avvio...');
console.log('═══════════════════════════════════════════════');

loadCommands(client);
loadEvents(client);

// ─── Gestione errori globali ─────────────────────────────────
process.on('unhandledRejection', (error) => {
  console.error('[Errore] Unhandled Rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('[Errore] Uncaught Exception:', error);
});

client.on('error', (error) => {
  console.error('[Client] Errore:', error);
});

client.on('warn', (warning) => {
  console.warn('[Client] Warning:', warning);
});

// ─── Login ───────────────────────────────────────────────────
client.login(process.env.DISCORD_TOKEN);

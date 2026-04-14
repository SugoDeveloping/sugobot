// ═══════════════════════════════════════════════════════════════
//  NicoDev Discord Bot – Twitch Live Scheduler
//  Controlla periodicamente se gli streamer monitorati sono live
//  e invia notifiche nei canali Discord configurati
// ═══════════════════════════════════════════════════════════════

const { getAllTwitchConfigs, updateTwitchLiveStatus } = require('../database/db');
const { EmbedBuilder } = require('discord.js');

// ── Costanti ───────────────────────────────────────────────────
const CHECK_INTERVAL_MS = 60 * 1000; // 60 secondi
const TWITCH_HELIX_STREAMS = 'https://api.twitch.tv/helix/streams';
const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const TWITCH_COLOR = 0x9146FF;

// ── Token cache ────────────────────────────────────────────────
let cachedToken = null;
let tokenExpiresAt = 0;

let schedulerInterval = null;

/**
 * Ottiene un access token tramite Client Credentials flow.
 * Memorizza il token in cache e lo rinnova quando scade.
 */
async function getTwitchAccessToken() {
  const now = Date.now();

  // Restituisci il token dalla cache se ancora valido (con 5 min di margine)
  if (cachedToken && now < tokenExpiresAt - 300000) {
    return cachedToken;
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  try {
    const res = await fetch(TWITCH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
      }),
    });

    if (!res.ok) {
      console.error(`[Twitch] Errore ottenimento token: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json();
    cachedToken = data.access_token;
    tokenExpiresAt = now + data.expires_in * 1000;

    return cachedToken;
  } catch (error) {
    console.error('[Twitch] Errore richiesta token:', error.message);
    return null;
  }
}

/**
 * Interroga l'API Helix per verificare se una lista di utenti è live.
 * Restituisce una Map<username_lowercase, streamData>.
 */
async function checkStreamsLive(usernames) {
  const token = await getTwitchAccessToken();
  if (!token) return new Map();

  const clientId = process.env.TWITCH_CLIENT_ID;
  const liveStreams = new Map();

  // L'API Helix supporta fino a 100 user_login per richiesta
  const batchSize = 100;
  for (let i = 0; i < usernames.length; i += batchSize) {
    const batch = usernames.slice(i, i + batchSize);
    const params = new URLSearchParams();
    for (const u of batch) {
      params.append('user_login', u);
    }

    try {
      const res = await fetch(`${TWITCH_HELIX_STREAMS}?${params.toString()}`, {
        headers: {
          'Client-ID': clientId,
          'Authorization': `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        // Token scaduto, invalida la cache e riprova al prossimo ciclo
        cachedToken = null;
        tokenExpiresAt = 0;
        console.warn('[Twitch] Token scaduto, verrà rinnovato al prossimo check.');
        return liveStreams;
      }

      if (!res.ok) {
        console.error(`[Twitch] Errore API streams: ${res.status} ${res.statusText}`);
        continue;
      }

      const data = await res.json();
      for (const stream of data.data) {
        liveStreams.set(stream.user_login.toLowerCase(), stream);
      }
    } catch (error) {
      console.error('[Twitch] Errore richiesta streams:', error.message);
    }
  }

  return liveStreams;
}

/**
 * Costruisce l'embed di notifica per uno stream live.
 */
function buildLiveEmbed(stream, config) {
  const username = stream.user_name || config.twitch_username;
  const title = stream.title || 'Nessun titolo';
  const game = stream.game_name || 'Sconosciuto';
  const url = `https://twitch.tv/${config.twitch_username}`;
  const thumbnail = stream.thumbnail_url
    ? stream.thumbnail_url.replace('{width}', '440').replace('{height}', '248')
    : null;

  // Titolo embed: messaggio personalizzato o default
  let embedTitle;
  if (config.custom_message) {
    embedTitle = config.custom_message
      .replace(/\{username\}/gi, username)
      .replace(/\{title\}/gi, title)
      .replace(/\{game\}/gi, game)
      .replace(/\{url\}/gi, url);
  } else {
    embedTitle = `🔴 ${username} è ora LIVE!`;
  }

  const embed = new EmbedBuilder()
    .setTitle(embedTitle)
    .setURL(url)
    .setDescription(title)
    .addFields({ name: '🎮 Gioco / Categoria', value: game, inline: true })
    .setColor(TWITCH_COLOR)
    .setFooter({ text: `Twitch • ${username}` })
    .setTimestamp();

  if (thumbnail) {
    embed.setImage(thumbnail);
  }

  return embed;
}

/**
 * Esegue un ciclo di controllo per tutti gli streamer configurati.
 */
async function runTwitchCheck(client) {
  try {
    const configs = getAllTwitchConfigs();
    if (configs.length === 0) return;

    // Raccogli username unici
    const uniqueUsernames = [...new Set(configs.map(c => c.twitch_username.toLowerCase()))];

    // Controlla quali sono live
    const liveStreams = await checkStreamsLive(uniqueUsernames);

    for (const config of configs) {
      const username = config.twitch_username.toLowerCase();
      const stream = liveStreams.get(username);
      const isCurrentlyLive = !!stream;
      const wasLive = !!config.is_live;

      if (isCurrentlyLive && !wasLive) {
        // ── Appena andato live → invia notifica ──────────────
        const streamId = stream.id;

        // Evita notifiche duplicate per lo stesso stream
        if (config.last_stream_id === streamId) continue;

        try {
          const channel = await client.channels.fetch(config.channel_id).catch(() => null);
          if (!channel) {
            console.warn(`[Twitch] Canale ${config.channel_id} non trovato per ${username}`);
            continue;
          }

          const embed = buildLiveEmbed(stream, config);

          const messagePayload = { embeds: [embed] };
          if (config.ping_role_id) {
            messagePayload.content = `<@&${config.ping_role_id}>`;
          }

          await channel.send(messagePayload);
          updateTwitchLiveStatus(config.id, true, streamId);

        } catch (error) {
          console.error(`[Twitch] Errore invio notifica per ${username}:`, error.message);
        }

      } else if (isCurrentlyLive && wasLive) {
        // ── Ancora live → aggiorna stream ID se cambiato ─────
        if (stream.id !== config.last_stream_id) {
          updateTwitchLiveStatus(config.id, true, stream.id);
        }

      } else if (!isCurrentlyLive && wasLive) {
        // ── Andato offline → resetta stato ───────────────────
        updateTwitchLiveStatus(config.id, false, config.last_stream_id);
      }
    }
  } catch (error) {
    console.error('[Twitch] Errore durante il check:', error);
  }
}

/**
 * Avvia lo scheduler Twitch.
 * @param {import('discord.js').Client} client
 */
function startTwitchScheduler(client) {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn('  ⚠️  Twitch scheduler non avviato: TWITCH_CLIENT_ID o TWITCH_CLIENT_SECRET mancanti');
    return;
  }

  if (schedulerInterval) clearInterval(schedulerInterval);

  console.log('  📺 Twitch scheduler avviato (check ogni 60s)');

  // Prima esecuzione dopo 30 secondi (tempo per il bot di essere pronto)
  setTimeout(() => {
    runTwitchCheck(client);
  }, 30000);

  // Poi ogni 60 secondi
  schedulerInterval = setInterval(() => {
    runTwitchCheck(client);
  }, CHECK_INTERVAL_MS);
}

module.exports = {
  startTwitchScheduler,
};

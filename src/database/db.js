// ═══════════════════════════════════════════════════════════════
//  NicoDev Discord Bot – Database SQLite
//  Gestione persistente di impostazioni, ticket, warn, ecc.
// ═══════════════════════════════════════════════════════════════

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'database.db');
const db = new Database(dbPath);

// Abilita WAL per prestazioni migliori
db.pragma('journal_mode = WAL');

// ─── Migrazioni colonne (aggiunge colonne mancanti) ──────────
try {
  db.exec(`ALTER TABLE guild_settings ADD COLUMN bot_icon TEXT`);
} catch (e) {
  // La colonna esiste già, ignora
}
try {
  db.exec(`ALTER TABLE guild_settings ADD COLUMN ticket_reminder_hours INTEGER DEFAULT 0`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE assistenza_settings ADD COLUMN reminder_hours INTEGER DEFAULT 0`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE tickets ADD COLUMN last_reminder_at DATETIME`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE assistenza_requests ADD COLUMN last_reminder_at DATETIME`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE guild_settings ADD COLUMN ticket_name_format TEXT`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE newsletters ADD COLUMN title TEXT`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE newsletters ADD COLUMN target_channel_id TEXT`);
} catch (e) {}
// Whitelist notification settings
try { db.exec(`ALTER TABLE whitelist_settings ADD COLUMN dm_on_submit INTEGER DEFAULT 1`); } catch (e) {}
try { db.exec(`ALTER TABLE whitelist_settings ADD COLUMN dm_on_approve INTEGER DEFAULT 1`); } catch (e) {}
try { db.exec(`ALTER TABLE whitelist_settings ADD COLUMN dm_on_reject INTEGER DEFAULT 1`); } catch (e) {}
try { db.exec(`ALTER TABLE whitelist_settings ADD COLUMN msg_submit TEXT`); } catch (e) {}
try { db.exec(`ALTER TABLE whitelist_settings ADD COLUMN msg_approved TEXT`); } catch (e) {}
try { db.exec(`ALTER TABLE whitelist_settings ADD COLUMN msg_rejected TEXT`); } catch (e) {}

// ─── Creazione tabelle ───────────────────────────────────────

db.exec(`
  -- Impostazioni generali per ogni server
  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT PRIMARY KEY,
    log_channel_id TEXT,
    mod_log_channel_id TEXT,
    welcome_channel_id TEXT,
    welcome_message TEXT DEFAULT 'Benvenuto nel server, {user}! 🎉',
    welcome_enabled INTEGER DEFAULT 0,
    ticket_category_id TEXT,
    ticket_log_channel_id TEXT,
    ticket_support_role_id TEXT,
    ticket_message TEXT DEFAULT 'Ciao {user}! Un membro dello staff ti assisterà a breve.',
    ticket_panel_channel_id TEXT,
    ticket_panel_message_id TEXT,
    mute_role_id TEXT,
    embed_color TEXT DEFAULT '#5865F2',
    bot_name TEXT DEFAULT 'NicoDev Bot',
    language TEXT DEFAULT 'it',
    auto_transcript INTEGER DEFAULT 1,
    dm_transcript INTEGER DEFAULT 1,
    bot_icon TEXT,
    ticket_reminder_hours INTEGER DEFAULT 0,
    ticket_name_format TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Ticket aperti e chiusi
  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT UNIQUE,
    user_id TEXT NOT NULL,
    subject TEXT,
    status TEXT DEFAULT 'open',
    claimed_by TEXT,
    last_reminder_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME,
    closed_by TEXT,
    transcript_url TEXT
  );

  -- Avvertimenti moderazione
  CREATE TABLE IF NOT EXISTS warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    reason TEXT DEFAULT 'Nessun motivo specificato',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Log azioni moderazione
  CREATE TABLE IF NOT EXISTS mod_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    action TEXT NOT NULL,
    reason TEXT,
    duration TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Newsletter inviate
  CREATE TABLE IF NOT EXISTS newsletters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    sent_by TEXT NOT NULL,
    message TEXT NOT NULL,
    title TEXT,
    target_channel_id TEXT,
    recipients_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Categorie ticket personalizzate
  CREATE TABLE IF NOT EXISTS ticket_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    emoji TEXT DEFAULT '🎫',
    description TEXT,
    support_roles TEXT DEFAULT '[]',
    auto_message TEXT,
    discord_category_id TEXT,
    button_color TEXT DEFAULT 'Primary',
    max_open_per_user INTEGER DEFAULT 3
  );

  -- Impostazioni sistema assistenza per ogni server
  CREATE TABLE IF NOT EXISTS assistenza_settings (
    guild_id TEXT PRIMARY KEY,
    enabled INTEGER DEFAULT 0,
    channel_id TEXT,
    log_channel_id TEXT,
    staff_role_id TEXT,
    category_id TEXT,
    max_open_per_user INTEGER DEFAULT 1,
    welcome_message TEXT DEFAULT 'Ciao {user}! La tua richiesta di assistenza è stata inviata. Uno staffer la prenderà in carico a breve.',
    cooldown_minutes INTEGER DEFAULT 5,
    reminder_hours INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Reaction roles
  CREATE TABLE IF NOT EXISTS reaction_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    emoji TEXT NOT NULL,
    role_id TEXT NOT NULL,
    mode TEXT DEFAULT 'toggle',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, emoji)
  );

  -- Impostazioni verifica captcha
  CREATE TABLE IF NOT EXISTS verify_settings (
    guild_id TEXT PRIMARY KEY,
    enabled INTEGER DEFAULT 0,
    role_id TEXT,
    channel_id TEXT,
    log_channel_id TEXT,
    kick_on_fail INTEGER DEFAULT 0,
    timeout_seconds INTEGER DEFAULT 60,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Configurazione rapida builder server
  CREATE TABLE IF NOT EXISTS guild_builder_configs (
    guild_id TEXT PRIMARY KEY,
    name TEXT DEFAULT 'Template personalizzato',
    source TEXT DEFAULT 'custom',
    preset_key TEXT,
    config_json TEXT NOT NULL,
    updated_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Backup server riutilizzabili tra guild
  CREATE TABLE IF NOT EXISTS guild_backups (
    name TEXT PRIMARY KEY,
    source_guild_id TEXT NOT NULL,
    snapshot_json TEXT NOT NULL,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Richieste di assistenza
  CREATE TABLE IF NOT EXISTS assistenza_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    channel_id TEXT,
    message_id TEXT,
    subject TEXT,
    description TEXT,
    status TEXT DEFAULT 'pending',
    claimed_by TEXT,
    feedback TEXT,
    feedback_by TEXT,
    priority TEXT DEFAULT 'normale',
    last_reminder_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    claimed_at DATETIME,
    closed_at DATETIME,
    closed_by TEXT
  );

  -- Server bloccati dal proprietario del bot
  CREATE TABLE IF NOT EXISTS blocked_guilds (
    guild_id TEXT PRIMARY KEY,
    reason TEXT,
    blocked_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Piano premium per guild
  CREATE TABLE IF NOT EXISTS premium_guilds (
    guild_id TEXT PRIMARY KEY,
    features TEXT NOT NULL DEFAULT '[]',
    activated_by TEXT,
    activated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
  );

  -- Chiavi di attivazione premium
  CREATE TABLE IF NOT EXISTS premium_keys (
    key TEXT PRIMARY KEY,
    features TEXT NOT NULL DEFAULT '["all"]',
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    used_by_guild TEXT,
    used_by_user TEXT,
    used_at DATETIME
  );

  -- Giveaway
  CREATE TABLE IF NOT EXISTS giveaways (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT,
    host_id TEXT NOT NULL,
    prize TEXT NOT NULL,
    description TEXT,
    winners_count INTEGER DEFAULT 1,
    required_role_id TEXT,
    emoji TEXT DEFAULT '🎉',
    color TEXT DEFAULT '#5865F2',
    image_url TEXT,
    thumbnail_url TEXT,
    ends_at DATETIME NOT NULL,
    status TEXT DEFAULT 'active',
    winner_ids TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS giveaway_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    giveaway_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    entered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(giveaway_id, user_id),
    FOREIGN KEY (giveaway_id) REFERENCES giveaways(id) ON DELETE CASCADE
  );

  -- Liste di utenti scansionati (per newsletter)
  CREATE TABLE IF NOT EXISTS scan_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    source_guild_id TEXT NOT NULL,
    user_count INTEGER DEFAULT 0,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(guild_id, name)
  );

  CREATE TABLE IF NOT EXISTS scan_list_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    display_name TEXT,
    is_bot INTEGER DEFAULT 0,
    UNIQUE(list_id, user_id),
    FOREIGN KEY (list_id) REFERENCES scan_lists(id) ON DELETE CASCADE
  );

  -- Twitch live notifications
  CREATE TABLE IF NOT EXISTS twitch_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    twitch_username TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    ping_role_id TEXT,
    custom_message TEXT,
    is_live INTEGER DEFAULT 0,
    last_stream_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(guild_id, twitch_username)
  );

  -- Whitelist / Application system
  CREATE TABLE IF NOT EXISTS whitelist_settings (
    guild_id TEXT PRIMARY KEY,
    enabled INTEGER DEFAULT 0,
    review_channel_id TEXT,
    reviewer_role_id TEXT,
    approved_role_id TEXT,
    panel_channel_id TEXT,
    panel_message_id TEXT,
    panel_title TEXT DEFAULT 'Application',
    panel_description TEXT DEFAULT 'Click the button below to apply!',
    panel_color TEXT DEFAULT '#5865F2',
    dm_on_submit INTEGER DEFAULT 1,
    dm_on_approve INTEGER DEFAULT 1,
    dm_on_reject INTEGER DEFAULT 1,
    msg_submit TEXT,
    msg_approved TEXT,
    msg_rejected TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS whitelist_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    question TEXT NOT NULL,
    type TEXT DEFAULT 'open',
    options TEXT,
    position INTEGER DEFAULT 0,
    required INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS whitelist_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    answers TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    reviewed_by TEXT,
    review_note TEXT,
    message_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME
  );
`);

// ═══════════════════════════════════════════════════════════════
//  Funzioni CRUD – Guild Settings
// ═══════════════════════════════════════════════════════════════

function getGuildSettings(guildId) {
  let settings = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
  if (!settings) {
    db.prepare('INSERT INTO guild_settings (guild_id) VALUES (?)').run(guildId);
    settings = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
  }
  return settings;
}

function updateGuildSetting(guildId, key, value) {
  getGuildSettings(guildId); // assicura che esista
  const stmt = db.prepare(`UPDATE guild_settings SET ${key} = ?, updated_at = CURRENT_TIMESTAMP WHERE guild_id = ?`);
  return stmt.run(value, guildId);
}

// ═══════════════════════════════════════════════════════════════
//  Funzioni CRUD – Tickets
// ═══════════════════════════════════════════════════════════════

function createTicket(guildId, channelId, userId, subject = null) {
  const stmt = db.prepare(
    'INSERT INTO tickets (guild_id, channel_id, user_id, subject) VALUES (?, ?, ?, ?)'
  );
  return stmt.run(guildId, channelId, userId, subject);
}

function getNextTicketNumber(guildId) {
  const result = db.prepare('SELECT COUNT(*) as count FROM tickets WHERE guild_id = ?').get(guildId);
  return (result?.count || 0) + 1;
}

function getTicketByChannel(channelId) {
  return db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(channelId);
}

function getOpenTicketsByUser(guildId, userId) {
  return db.prepare(
    'SELECT * FROM tickets WHERE guild_id = ? AND user_id = ? AND status = ?'
  ).all(guildId, userId, 'open');
}

function closeTicket(channelId, closedBy) {
  return db.prepare(
    'UPDATE tickets SET status = ?, closed_at = CURRENT_TIMESTAMP, closed_by = ? WHERE channel_id = ?'
  ).run('closed', closedBy, channelId);
}

function updateTicket(channelId, key, value) {
  const stmt = db.prepare(`UPDATE tickets SET ${key} = ? WHERE channel_id = ?`);
  return stmt.run(value, channelId);
}

function getTicketStats(guildId) {
  const total = db.prepare('SELECT COUNT(*) as count FROM tickets WHERE guild_id = ?').get(guildId);
  const open = db.prepare('SELECT COUNT(*) as count FROM tickets WHERE guild_id = ? AND status = ?').get(guildId, 'open');
  const closed = db.prepare('SELECT COUNT(*) as count FROM tickets WHERE guild_id = ? AND status = ?').get(guildId, 'closed');
  return { total: total.count, open: open.count, closed: closed.count };
}

// ═══════════════════════════════════════════════════════════════
//  Funzioni CRUD – Warnings
// ═══════════════════════════════════════════════════════════════

function addWarning(guildId, userId, moderatorId, reason) {
  return db.prepare(
    'INSERT INTO warnings (guild_id, user_id, moderator_id, reason) VALUES (?, ?, ?, ?)'
  ).run(guildId, userId, moderatorId, reason);
}

function getWarnings(guildId, userId) {
  return db.prepare(
    'SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC'
  ).all(guildId, userId);
}

function removeWarning(warningId) {
  return db.prepare('DELETE FROM warnings WHERE id = ?').run(warningId);
}

function clearWarnings(guildId, userId) {
  return db.prepare('DELETE FROM warnings WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
}

// ═══════════════════════════════════════════════════════════════
//  Funzioni CRUD – Mod Actions (Log)
// ═══════════════════════════════════════════════════════════════

function logModAction(guildId, userId, moderatorId, action, reason, duration = null) {
  return db.prepare(
    'INSERT INTO mod_actions (guild_id, user_id, moderator_id, action, reason, duration) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(guildId, userId, moderatorId, action, reason, duration);
}

function getModActions(guildId, userId) {
  return db.prepare(
    'SELECT * FROM mod_actions WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC'
  ).all(guildId, userId);
}

// ═══════════════════════════════════════════════════════════════
//  Funzioni CRUD – Newsletter
// ═══════════════════════════════════════════════════════════════

function logNewsletter(guildId, roleId, sentBy, message, recipientsCount, failedCount, title = null, targetChannelId = null) {
  return db.prepare(
    'INSERT INTO newsletters (guild_id, role_id, sent_by, message, recipients_count, failed_count, title, target_channel_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(guildId, roleId, sentBy, message, recipientsCount, failedCount, title, targetChannelId);
}

function getNewsletterHistory(guildId, limit = 10) {
  return db.prepare(
    'SELECT * FROM newsletters WHERE guild_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(guildId, limit);
}

// ═══════════════════════════════════════════════════════════════
//  Funzioni CRUD – Ticket Categories
// ═══════════════════════════════════════════════════════════════

function addTicketCategory(guildId, name, emoji, description, supportRoles, autoMessage, discordCategoryId, buttonColor, maxOpen) {
  const rolesJson = JSON.stringify(supportRoles || []);
  return db.prepare(
    'INSERT INTO ticket_categories (guild_id, name, emoji, description, support_roles, auto_message, discord_category_id, button_color, max_open_per_user) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(guildId, name, emoji, description, rolesJson, autoMessage, discordCategoryId, buttonColor || 'Primary', maxOpen || 3);
}

function getTicketCategories(guildId) {
  const cats = db.prepare('SELECT * FROM ticket_categories WHERE guild_id = ?').all(guildId);
  return cats.map(c => ({ ...c, support_roles: JSON.parse(c.support_roles || '[]') }));
}

function getTicketCategoryById(id) {
  const cat = db.prepare('SELECT * FROM ticket_categories WHERE id = ?').get(id);
  if (cat) cat.support_roles = JSON.parse(cat.support_roles || '[]');
  return cat;
}

function updateTicketCategory(id, key, value) {
  return db.prepare(`UPDATE ticket_categories SET ${key} = ? WHERE id = ?`).run(value, id);
}

function removeTicketCategory(id) {
  return db.prepare('DELETE FROM ticket_categories WHERE id = ?').run(id);
}

// ═══════════════════════════════════════════════════════════════
//  Funzioni CRUD – Assistenza Settings
// ═══════════════════════════════════════════════════════════════

function getAssistenzaSettings(guildId) {
  let settings = db.prepare('SELECT * FROM assistenza_settings WHERE guild_id = ?').get(guildId);
  if (!settings) {
    db.prepare('INSERT INTO assistenza_settings (guild_id) VALUES (?)').run(guildId);
    settings = db.prepare('SELECT * FROM assistenza_settings WHERE guild_id = ?').get(guildId);
  }
  return settings;
}

function updateAssistenzaSetting(guildId, key, value) {
  getAssistenzaSettings(guildId); // assicura che esista
  const stmt = db.prepare(`UPDATE assistenza_settings SET ${key} = ?, updated_at = CURRENT_TIMESTAMP WHERE guild_id = ?`);
  return stmt.run(value, guildId);
}

// ═══════════════════════════════════════════════════════════════
//  Funzioni CRUD – Assistenza Requests
// ═══════════════════════════════════════════════════════════════

function createAssistenzaRequest(guildId, userId, subject, description, priority = 'normale') {
  const stmt = db.prepare(
    'INSERT INTO assistenza_requests (guild_id, user_id, subject, description, priority) VALUES (?, ?, ?, ?, ?)'
  );
  return stmt.run(guildId, userId, subject, description, priority);
}

function getAssistenzaRequestById(id) {
  return db.prepare('SELECT * FROM assistenza_requests WHERE id = ?').get(id);
}

function getAssistenzaRequestByMessage(messageId) {
  return db.prepare('SELECT * FROM assistenza_requests WHERE message_id = ?').get(messageId);
}

function getOpenAssistenzaByUser(guildId, userId) {
  return db.prepare(
    "SELECT * FROM assistenza_requests WHERE guild_id = ? AND user_id = ? AND status IN ('pending', 'in_progress')"
  ).all(guildId, userId);
}

function updateAssistenzaRequest(id, key, value) {
  const stmt = db.prepare(`UPDATE assistenza_requests SET ${key} = ? WHERE id = ?`);
  return stmt.run(value, id);
}

function claimAssistenzaRequest(id, staffId) {
  return db.prepare(
    "UPDATE assistenza_requests SET status = 'in_progress', claimed_by = ?, claimed_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(staffId, id);
}

function closeAssistenzaRequest(id, closedBy) {
  return db.prepare(
    "UPDATE assistenza_requests SET status = 'closed', closed_by = ?, closed_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(closedBy, id);
}

function addAssistenzaFeedback(id, feedback, feedbackBy) {
  return db.prepare(
    'UPDATE assistenza_requests SET feedback = ?, feedback_by = ? WHERE id = ?'
  ).run(feedback, feedbackBy, id);
}

function getAssistenzaStats(guildId) {
  const total = db.prepare('SELECT COUNT(*) as count FROM assistenza_requests WHERE guild_id = ?').get(guildId);
  const pending = db.prepare("SELECT COUNT(*) as count FROM assistenza_requests WHERE guild_id = ? AND status = 'pending'").get(guildId);
  const inProgress = db.prepare("SELECT COUNT(*) as count FROM assistenza_requests WHERE guild_id = ? AND status = 'in_progress'").get(guildId);
  const closed = db.prepare("SELECT COUNT(*) as count FROM assistenza_requests WHERE guild_id = ? AND status = 'closed'").get(guildId);
  return { total: total.count, pending: pending.count, inProgress: inProgress.count, closed: closed.count };
}

function getRecentAssistenzaRequests(guildId, limit = 10) {
  return db.prepare(
    'SELECT * FROM assistenza_requests WHERE guild_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(guildId, limit);
}

// ═══════════════════════════════════════════════════════════════
//  Funzioni per Reminder
// ═══════════════════════════════════════════════════════════════

function getAllOpenTickets() {
  return db.prepare("SELECT * FROM tickets WHERE status = 'open'").all();
}

function getAllOpenAssistenza() {
  return db.prepare("SELECT * FROM assistenza_requests WHERE status IN ('pending', 'in_progress')").all();
}

function updateTicketReminder(channelId) {
  return db.prepare('UPDATE tickets SET last_reminder_at = CURRENT_TIMESTAMP WHERE channel_id = ?').run(channelId);
}

function updateAssistenzaReminder(id) {
  return db.prepare('UPDATE assistenza_requests SET last_reminder_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
}

function getAllGuildSettings() {
  return db.prepare('SELECT * FROM guild_settings').all();
}

function getAllAssistenzaSettings() {
  return db.prepare('SELECT * FROM assistenza_settings').all();
}

// ═══════════════════════════════════════════════════════════════
//  Funzioni CRUD – Reaction Roles
// ═══════════════════════════════════════════════════════════════

function addReactionRole(guildId, channelId, messageId, emoji, roleId, mode = 'toggle') {
  return db.prepare(
    'INSERT OR REPLACE INTO reaction_roles (guild_id, channel_id, message_id, emoji, role_id, mode) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(guildId, channelId, messageId, emoji, roleId, mode);
}

function removeReactionRole(messageId, emoji) {
  return db.prepare('DELETE FROM reaction_roles WHERE message_id = ? AND emoji = ?').run(messageId, emoji);
}

function removeReactionRolesByMessage(messageId) {
  return db.prepare('DELETE FROM reaction_roles WHERE message_id = ?').run(messageId);
}

function getReactionRole(messageId, emoji) {
  return db.prepare('SELECT * FROM reaction_roles WHERE message_id = ? AND emoji = ?').get(messageId, emoji);
}

function getReactionRolesByMessage(messageId) {
  return db.prepare('SELECT * FROM reaction_roles WHERE message_id = ?').all(messageId);
}

function getReactionRolesByGuild(guildId) {
  return db.prepare('SELECT * FROM reaction_roles WHERE guild_id = ?').all(guildId);
}

// ═══════════════════════════════════════════════════════════════
//  Funzioni CRUD – Verify Settings
// ═══════════════════════════════════════════════════════════════

function getVerifySettings(guildId) {
  let settings = db.prepare('SELECT * FROM verify_settings WHERE guild_id = ?').get(guildId);
  if (!settings) {
    db.prepare('INSERT INTO verify_settings (guild_id) VALUES (?)').run(guildId);
    settings = db.prepare('SELECT * FROM verify_settings WHERE guild_id = ?').get(guildId);
  }
  return settings;
}

function updateVerifySetting(guildId, key, value) {
  getVerifySettings(guildId);
  return db.prepare(`UPDATE verify_settings SET ${key} = ?, updated_at = CURRENT_TIMESTAMP WHERE guild_id = ?`).run(value, guildId);
}

// ═══════════════════════════════════════════════════════════════
//  Funzioni – Blocked Guilds
// ═══════════════════════════════════════════════════════════════

function getGuildBuilderConfig(guildId) {
  const row = db.prepare('SELECT * FROM guild_builder_configs WHERE guild_id = ?').get(guildId);
  if (!row) return null;

  return {
    ...row,
    config: JSON.parse(row.config_json),
  };
}

function saveGuildBuilderConfig(guildId, payload, updatedBy = null) {
  return db.prepare(`
    INSERT INTO guild_builder_configs (guild_id, name, source, preset_key, config_json, updated_by)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET
      name = excluded.name,
      source = excluded.source,
      preset_key = excluded.preset_key,
      config_json = excluded.config_json,
      updated_by = excluded.updated_by,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    guildId,
    payload.name,
    payload.source,
    payload.presetKey || null,
    JSON.stringify(payload.config),
    updatedBy,
  );
}

function deleteGuildBuilderConfig(guildId) {
  return db.prepare('DELETE FROM guild_builder_configs WHERE guild_id = ?').run(guildId);
}

function saveGuildBackup(name, sourceGuildId, snapshot, createdBy = null) {
  return db.prepare(`
    INSERT INTO guild_backups (name, source_guild_id, snapshot_json, created_by)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      source_guild_id = excluded.source_guild_id,
      snapshot_json = excluded.snapshot_json,
      created_by = excluded.created_by,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    name,
    sourceGuildId,
    JSON.stringify(snapshot),
    createdBy,
  );
}

function getGuildBackup(name) {
  const row = db.prepare('SELECT * FROM guild_backups WHERE name = ?').get(name);
  if (!row) return null;

  return {
    ...row,
    snapshot: JSON.parse(row.snapshot_json),
  };
}

function getGuildBackups() {
  return db.prepare('SELECT name, source_guild_id, created_by, created_at, updated_at FROM guild_backups ORDER BY updated_at DESC').all();
}

function deleteGuildBackup(name) {
  return db.prepare('DELETE FROM guild_backups WHERE name = ?').run(name);
}

// ═══════════════════════════════════════════════════════════════
//  Funzioni CRUD – Premium
// ═══════════════════════════════════════════════════════════════

function getPremiumGuild(guildId) {
  const row = db.prepare('SELECT * FROM premium_guilds WHERE guild_id = ?').get(guildId);
  if (!row) return null;
  return { ...row, features: JSON.parse(row.features || '[]') };
}

function setPremiumGuild(guildId, features, activatedBy, notes = null) {
  return db.prepare(`
    INSERT INTO premium_guilds (guild_id, features, activated_by, notes)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET
      features = excluded.features,
      activated_by = excluded.activated_by,
      activated_at = CURRENT_TIMESTAMP,
      notes = excluded.notes
  `).run(guildId, JSON.stringify(features), activatedBy, notes);
}

function removePremiumGuild(guildId) {
  return db.prepare('DELETE FROM premium_guilds WHERE guild_id = ?').run(guildId);
}

function getAllPremiumGuilds() {
  return db.prepare('SELECT * FROM premium_guilds ORDER BY activated_at DESC').all()
    .map(r => ({ ...r, features: JSON.parse(r.features || '[]') }));
}

function addPremiumFeature(guildId, feature) {
  const existing = getPremiumGuild(guildId);
  const features = existing ? existing.features : [];
  if (!features.includes(feature) && !features.includes('all')) {
    features.push(feature);
    return db.prepare('UPDATE premium_guilds SET features = ?, activated_at = CURRENT_TIMESTAMP WHERE guild_id = ?')
      .run(JSON.stringify(features), guildId);
  }
  return null;
}

function removePremiumFeature(guildId, feature) {
  const existing = getPremiumGuild(guildId);
  if (!existing) return null;
  const features = existing.features.filter(f => f !== feature);
  if (features.length === 0) {
    return removePremiumGuild(guildId);
  }
  return db.prepare('UPDATE premium_guilds SET features = ? WHERE guild_id = ?')
    .run(JSON.stringify(features), guildId);
}

// ── Premium Keys ─────────────────────────────────────────────

function createPremiumKey(key, features, createdBy) {
  return db.prepare(
    'INSERT INTO premium_keys (key, features, created_by) VALUES (?, ?, ?)'
  ).run(key, JSON.stringify(features), createdBy);
}

function getPremiumKey(key) {
  const row = db.prepare('SELECT * FROM premium_keys WHERE key = ? AND used_at IS NULL').get(key);
  if (!row) return null;
  return { ...row, features: JSON.parse(row.features || '[]') };
}

function usePremiumKey(key, guildId, userId) {
  return db.prepare(
    'UPDATE premium_keys SET used_by_guild = ?, used_by_user = ?, used_at = CURRENT_TIMESTAMP WHERE key = ?'
  ).run(guildId, userId, key);
}

function getUnusedPremiumKeys() {
  return db.prepare('SELECT * FROM premium_keys WHERE used_at IS NULL ORDER BY created_at DESC').all()
    .map(r => ({ ...r, features: JSON.parse(r.features || '[]') }));
}

function getAllPremiumKeys() {
  return db.prepare('SELECT * FROM premium_keys ORDER BY created_at DESC').all()
    .map(r => ({ ...r, features: JSON.parse(r.features || '[]') }));
}

function deletePremiumKey(key) {
  return db.prepare('DELETE FROM premium_keys WHERE key = ?').run(key);
}

// ═══════════════════════════════════════════════════════════════
//  Funzioni CRUD – Twitch Config
// ═══════════════════════════════════════════════════════════════

function addTwitchStreamer(guildId, twitchUsername, channelId, pingRoleId = null, customMessage = null) {
  return db.prepare(`
    INSERT INTO twitch_config (guild_id, twitch_username, channel_id, ping_role_id, custom_message)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(guild_id, twitch_username) DO UPDATE SET
      channel_id = excluded.channel_id,
      ping_role_id = excluded.ping_role_id,
      custom_message = excluded.custom_message
  `).run(guildId, twitchUsername.toLowerCase(), channelId, pingRoleId, customMessage);
}

function removeTwitchStreamer(guildId, twitchUsername) {
  return db.prepare('DELETE FROM twitch_config WHERE guild_id = ? AND twitch_username = ?')
    .run(guildId, twitchUsername.toLowerCase());
}

function getTwitchStreamers(guildId) {
  return db.prepare('SELECT * FROM twitch_config WHERE guild_id = ? ORDER BY twitch_username ASC').all(guildId);
}

function getAllTwitchConfigs() {
  return db.prepare('SELECT * FROM twitch_config').all();
}

function updateTwitchLiveStatus(id, isLive, lastStreamId = null) {
  return db.prepare('UPDATE twitch_config SET is_live = ?, last_stream_id = ? WHERE id = ?')
    .run(isLive ? 1 : 0, lastStreamId, id);
}

// ═══════════════════════════════════════════════════════════════
//  Funzioni CRUD – Whitelist Settings
// ═══════════════════════════════════════════════════════════════

function getWhitelistSettings(guildId) {
  let settings = db.prepare('SELECT * FROM whitelist_settings WHERE guild_id = ?').get(guildId);
  if (!settings) {
    db.prepare('INSERT INTO whitelist_settings (guild_id) VALUES (?)').run(guildId);
    settings = db.prepare('SELECT * FROM whitelist_settings WHERE guild_id = ?').get(guildId);
  }
  return settings;
}

function updateWhitelistSetting(guildId, key, value) {
  getWhitelistSettings(guildId);
  return db.prepare(`UPDATE whitelist_settings SET ${key} = ?, updated_at = CURRENT_TIMESTAMP WHERE guild_id = ?`)
    .run(value, guildId);
}

// ── Whitelist Questions ──────────────────────────────────────

function addWhitelistQuestion(guildId, question, type = 'open', options = null) {
  const pos = db.prepare('SELECT COALESCE(MAX(position), 0) + 1 as next FROM whitelist_questions WHERE guild_id = ?')
    .get(guildId).next;
  return db.prepare(
    'INSERT INTO whitelist_questions (guild_id, question, type, options, position) VALUES (?, ?, ?, ?, ?)'
  ).run(guildId, question, type, options ? JSON.stringify(options) : null, pos);
}

function getWhitelistQuestions(guildId) {
  return db.prepare('SELECT * FROM whitelist_questions WHERE guild_id = ? ORDER BY position ASC').all(guildId)
    .map(q => ({ ...q, options: q.options ? JSON.parse(q.options) : null }));
}

function removeWhitelistQuestion(id) {
  return db.prepare('DELETE FROM whitelist_questions WHERE id = ?').run(id);
}

function clearWhitelistQuestions(guildId) {
  return db.prepare('DELETE FROM whitelist_questions WHERE guild_id = ?').run(guildId);
}

// ── Whitelist Applications ───────────────────────────────────

function createWhitelistApplication(guildId, userId, answers) {
  return db.prepare(
    'INSERT INTO whitelist_applications (guild_id, user_id, answers) VALUES (?, ?, ?)'
  ).run(guildId, userId, JSON.stringify(answers));
}

function getWhitelistApplication(id) {
  const row = db.prepare('SELECT * FROM whitelist_applications WHERE id = ?').get(id);
  if (row) row.answers = JSON.parse(row.answers || '[]');
  return row;
}

function getPendingWhitelistApplications(guildId) {
  return db.prepare(
    "SELECT * FROM whitelist_applications WHERE guild_id = ? AND status = 'pending' ORDER BY created_at ASC"
  ).all(guildId).map(r => ({ ...r, answers: JSON.parse(r.answers || '[]') }));
}

function getWhitelistApplicationByUser(guildId, userId) {
  return db.prepare(
    "SELECT * FROM whitelist_applications WHERE guild_id = ? AND user_id = ? AND status = 'pending'"
  ).get(guildId, userId);
}

function updateWhitelistApplication(id, status, reviewedBy, reviewNote = null) {
  return db.prepare(
    'UPDATE whitelist_applications SET status = ?, reviewed_by = ?, review_note = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(status, reviewedBy, reviewNote, id);
}

function updateWhitelistApplicationMessage(id, messageId) {
  return db.prepare('UPDATE whitelist_applications SET message_id = ? WHERE id = ?').run(messageId, id);
}

// ═══════════════════════════════════════════════════════════════
//  Funzioni CRUD – Scan Lists (liste utenti per newsletter)
// ═══════════════════════════════════════════════════════════════

function createScanList(name, guildId, sourceGuildId, createdBy) {
  if (!guildId) {
    throw new Error('ID guild di destinazione mancante durante il salvataggio della lista.');
  }

  if (!sourceGuildId) {
    throw new Error('ID guild sorgente mancante durante il salvataggio della lista.');
  }

  return db.prepare(`
    INSERT INTO scan_lists (name, guild_id, source_guild_id, created_by)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(guild_id, name) DO UPDATE SET
      source_guild_id = excluded.source_guild_id,
      user_count = 0,
      created_by = excluded.created_by,
      created_at = CURRENT_TIMESTAMP
  `).run(name, guildId, sourceGuildId, createdBy);
}

function getScanList(guildId, name) {
  return db.prepare('SELECT * FROM scan_lists WHERE guild_id = ? AND name = ?').get(guildId, name);
}

function getScanListById(listId) {
  return db.prepare('SELECT * FROM scan_lists WHERE id = ?').get(listId);
}

function getAllScanLists(guildId) {
  return db.prepare('SELECT * FROM scan_lists WHERE guild_id = ? ORDER BY created_at DESC').all(guildId);
}

function deleteScanList(guildId, name) {
  const list = getScanList(guildId, name);
  if (!list) return null;
  db.prepare('DELETE FROM scan_list_users WHERE list_id = ?').run(list.id);
  return db.prepare('DELETE FROM scan_lists WHERE id = ?').run(list.id);
}

function updateScanListCount(listId, count) {
  return db.prepare('UPDATE scan_lists SET user_count = ? WHERE id = ?').run(count, listId);
}

// ── Scan List Users ──────────────────────────────────────────

function addScanListUser(listId, userId, username, displayName, isBot) {
  return db.prepare(`
    INSERT OR IGNORE INTO scan_list_users (list_id, user_id, username, display_name, is_bot)
    VALUES (?, ?, ?, ?, ?)
  `).run(listId, userId, username, displayName, isBot ? 1 : 0);
}

function getScanListUsers(listId, excludeBots = true) {
  const query = excludeBots
    ? 'SELECT * FROM scan_list_users WHERE list_id = ? AND is_bot = 0 ORDER BY username ASC'
    : 'SELECT * FROM scan_list_users WHERE list_id = ? ORDER BY username ASC';
  return db.prepare(query).all(listId);
}

function clearScanListUsers(listId) {
  return db.prepare('DELETE FROM scan_list_users WHERE list_id = ?').run(listId);
}

// ═══════════════════════════════════════════════════════════════
//  Funzioni CRUD – Giveaway
// ═══════════════════════════════════════════════════════════════

function createGiveaway(guildId, channelId, hostId, prize, description, winnersCount, requiredRoleId, emoji, color, imageUrl, thumbnailUrl, endsAt) {
  return db.prepare(`
    INSERT INTO giveaways (guild_id, channel_id, host_id, prize, description, winners_count, required_role_id, emoji, color, image_url, thumbnail_url, ends_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(guildId, channelId, hostId, prize, description, winnersCount || 1, requiredRoleId, emoji || '🎉', color || '#5865F2', imageUrl, thumbnailUrl, endsAt);
}

function getGiveaway(id) {
  const row = db.prepare('SELECT * FROM giveaways WHERE id = ?').get(id);
  if (row) row.winner_ids = JSON.parse(row.winner_ids || '[]');
  return row;
}

function getGiveawayByMessage(messageId) {
  const row = db.prepare('SELECT * FROM giveaways WHERE message_id = ?').get(messageId);
  if (row) row.winner_ids = JSON.parse(row.winner_ids || '[]');
  return row;
}

function getActiveGiveaways(guildId) {
  return db.prepare("SELECT * FROM giveaways WHERE guild_id = ? AND status = 'active' ORDER BY ends_at ASC")
    .all(guildId)
    .map(r => ({ ...r, winner_ids: JSON.parse(r.winner_ids || '[]') }));
}

function getAllActiveGiveaways() {
  return db.prepare("SELECT * FROM giveaways WHERE status = 'active'")
    .all()
    .map(r => ({ ...r, winner_ids: JSON.parse(r.winner_ids || '[]') }));
}

function getGiveawaysByGuild(guildId, limit = 10) {
  return db.prepare('SELECT * FROM giveaways WHERE guild_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(guildId, limit)
    .map(r => ({ ...r, winner_ids: JSON.parse(r.winner_ids || '[]') }));
}

function updateGiveaway(id, key, value) {
  return db.prepare(`UPDATE giveaways SET ${key} = ? WHERE id = ?`).run(value, id);
}

function endGiveaway(id, winnerIds) {
  return db.prepare(
    "UPDATE giveaways SET status = 'ended', winner_ids = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(JSON.stringify(winnerIds), id);
}

function deleteGiveaway(id) {
  db.prepare('DELETE FROM giveaway_entries WHERE giveaway_id = ?').run(id);
  return db.prepare('DELETE FROM giveaways WHERE id = ?').run(id);
}

function addGiveawayEntry(giveawayId, userId) {
  return db.prepare(
    'INSERT OR IGNORE INTO giveaway_entries (giveaway_id, user_id) VALUES (?, ?)'
  ).run(giveawayId, userId);
}

function removeGiveawayEntry(giveawayId, userId) {
  return db.prepare('DELETE FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?').run(giveawayId, userId);
}

function getGiveawayEntries(giveawayId) {
  return db.prepare('SELECT * FROM giveaway_entries WHERE giveaway_id = ? ORDER BY entered_at ASC').all(giveawayId);
}

function getGiveawayEntryCount(giveawayId) {
  return db.prepare('SELECT COUNT(*) as count FROM giveaway_entries WHERE giveaway_id = ?').get(giveawayId).count;
}

function hasEnteredGiveaway(giveawayId, userId) {
  return !!db.prepare('SELECT 1 FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?').get(giveawayId, userId);
}

function isGuildBlocked(guildId) {
  return !!db.prepare('SELECT 1 FROM blocked_guilds WHERE guild_id = ?').get(guildId);
}

function blockGuild(guildId, reason) {
  return db.prepare('INSERT OR REPLACE INTO blocked_guilds (guild_id, reason) VALUES (?, ?)').run(guildId, reason || null);
}

function unblockGuild(guildId) {
  return db.prepare('DELETE FROM blocked_guilds WHERE guild_id = ?').run(guildId);
}

function getBlockedGuilds() {
  return db.prepare('SELECT * FROM blocked_guilds ORDER BY blocked_at DESC').all();
}

module.exports = {
  db,
  getGuildSettings,
  updateGuildSetting,
  createTicket,
  getNextTicketNumber,
  getTicketByChannel,
  getOpenTicketsByUser,
  closeTicket,
  updateTicket,
  getTicketStats,
  addWarning,
  getWarnings,
  removeWarning,
  clearWarnings,
  logModAction,
  getModActions,
  logNewsletter,
  getNewsletterHistory,
  addTicketCategory,
  getTicketCategories,
  getTicketCategoryById,
  updateTicketCategory,
  removeTicketCategory,
  // Assistenza
  getAssistenzaSettings,
  updateAssistenzaSetting,
  createAssistenzaRequest,
  getAssistenzaRequestById,
  getAssistenzaRequestByMessage,
  getOpenAssistenzaByUser,
  updateAssistenzaRequest,
  claimAssistenzaRequest,
  closeAssistenzaRequest,
  addAssistenzaFeedback,
  getAssistenzaStats,
  getRecentAssistenzaRequests,
  // Reminder
  getAllOpenTickets,
  getAllOpenAssistenza,
  updateTicketReminder,
  updateAssistenzaReminder,
  getAllGuildSettings,
  getAllAssistenzaSettings,
  // Reaction Roles
  addReactionRole,
  removeReactionRole,
  removeReactionRolesByMessage,
  getReactionRole,
  getReactionRolesByMessage,
  getReactionRolesByGuild,
  // Verify
  getVerifySettings,
  updateVerifySetting,
  // Server Builder
  getGuildBuilderConfig,
  saveGuildBuilderConfig,
  deleteGuildBuilderConfig,
  saveGuildBackup,
  getGuildBackup,
  getGuildBackups,
  deleteGuildBackup,
  // Premium
  getPremiumGuild,
  setPremiumGuild,
  removePremiumGuild,
  getAllPremiumGuilds,
  addPremiumFeature,
  removePremiumFeature,
  createPremiumKey,
  getPremiumKey,
  usePremiumKey,
  getUnusedPremiumKeys,
  getAllPremiumKeys,
  deletePremiumKey,
  // Twitch
  addTwitchStreamer,
  removeTwitchStreamer,
  getTwitchStreamers,
  getAllTwitchConfigs,
  updateTwitchLiveStatus,
  // Whitelist
  getWhitelistSettings,
  updateWhitelistSetting,
  addWhitelistQuestion,
  getWhitelistQuestions,
  removeWhitelistQuestion,
  clearWhitelistQuestions,
  createWhitelistApplication,
  getWhitelistApplication,
  getPendingWhitelistApplications,
  getWhitelistApplicationByUser,
  updateWhitelistApplication,
  updateWhitelistApplicationMessage,
  // Scan Lists
  createScanList,
  getScanList,
  getScanListById,
  getAllScanLists,
  deleteScanList,
  updateScanListCount,
  addScanListUser,
  getScanListUsers,
  clearScanListUsers,
  // Giveaway
  createGiveaway,
  getGiveaway,
  getGiveawayByMessage,
  getActiveGiveaways,
  getAllActiveGiveaways,
  getGiveawaysByGuild,
  updateGiveaway,
  endGiveaway,
  deleteGiveaway,
  addGiveawayEntry,
  removeGiveawayEntry,
  getGiveawayEntries,
  getGiveawayEntryCount,
  hasEnteredGiveaway,
  // Blocked Guilds
  isGuildBlocked,
  blockGuild,
  unblockGuild,
  getBlockedGuilds,
};

const Database = require('better-sqlite3');
const config = require('./config');

const db = new Database(config.dbFile);
db.pragma('journal_mode = WAL');

const cols = table => db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);

// --- Eski (kullanıcı adı + şifre) veritabanını Telegram-only şemaya taşı ---
// Telegram'a bağlı hesaplar korunur (id'ler aynı kalır -> indirme geçmişi/kota da kalır).
// Telegram'a hiç bağlanmamış eski hesaplar artık giriş yapamayacağı için silinir.
const oldUserCols = cols('users');
if (oldUserCols.includes('password_hash')) {
  db.pragma('foreign_keys = OFF'); // DROP TABLE alt tablolarda CASCADE silme yapmasın
  db.exec(`
    BEGIN;
    CREATE TABLE users_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL DEFAULT '',            -- yalnızca görünen ad (Telegram'dan gelir)
      is_verified INTEGER NOT NULL DEFAULT 1,       -- Telegram ile gelen herkes doğrulanmış sayılır
      telegram_chat_id TEXT UNIQUE,                 -- bir Telegram = bir hesap
      lang TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
    INSERT INTO users_new (id, username, is_verified, telegram_chat_id, lang, created_at)
      SELECT id, username, 1, telegram_chat_id, ${oldUserCols.includes('lang') ? 'lang' : 'NULL'}, created_at
      FROM users WHERE telegram_chat_id IS NOT NULL;
    DROP TABLE users;
    ALTER TABLE users_new RENAME TO users;
    COMMIT;
  `);
  for (const t of ['sessions', 'tokens', 'downloads'])
    try { db.exec(`DELETE FROM ${t} WHERE user_id NOT IN (SELECT id FROM users)`); } catch { /* tablo yoksa geç */ }
}
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL DEFAULT '',
  is_verified INTEGER NOT NULL DEFAULT 1,
  telegram_chat_id TEXT UNIQUE,
  lang TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  sid_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS downloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quality TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE INDEX IF NOT EXISTS idx_dl_user_time ON downloads(user_id, created_at);

CREATE TABLE IF NOT EXISTS user_last_files (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  download_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

-- Telegram ile giriş/kayıt istekleri.
--  token_hash: Telegram deep-link'indeki gizli kod (t.me/Bot?start=KOD)
--  poll_hash : yalnızca isteği başlatan tarayıcının bildiği gizli kod (oturumu o tarayıcı alır)
--  status    : pending (bot bekleniyor) | confirming (Telegram'da Onayla bekleniyor)
--              | approved | denied | noaccount
CREATE TABLE IF NOT EXISTS login_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  poll_hash TEXT NOT NULL UNIQUE,
  mode TEXT NOT NULL,
  ip TEXT,
  ua TEXT,
  lang TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  user_id INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  expires_at INTEGER NOT NULL
);
`);

if (!cols('sessions').includes('ip')) db.exec('ALTER TABLE sessions ADD COLUMN ip TEXT');
// Telegram sohbetinin dil tercihi (hesaba bağlanmadan önce de çalışır)
db.exec('CREATE TABLE IF NOT EXISTS bot_chats (chat_id TEXT PRIMARY KEY, lang TEXT NOT NULL)');

module.exports = db;

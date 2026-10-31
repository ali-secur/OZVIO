const crypto = require('crypto');
const db = require('../db');

const now = () => Math.floor(Date.now() / 1000);
const sha = t => crypto.createHash('sha256').update(t).digest('hex');
const rand = n => crypto.randomBytes(n).toString('hex');

// ---- Telegram giriş/kayıt istekleri ----
const REQUEST_TTL = 10 * 60; // 10 dk

// mode: 'login' | 'register'. Döner: { token (deep-link için), pollSecret (tarayıcıda kalır) }
function createLoginRequest({ mode, ip, ua, lang }) {
  const token = rand(24);       // 48 hex karakter: t.me start parametresine uygun
  const pollSecret = rand(24);
  db.prepare(`INSERT INTO login_requests (token_hash, poll_hash, mode, ip, ua, lang, expires_at)
              VALUES (?,?,?,?,?,?,?)`)
    .run(sha(token), sha(pollSecret), mode === 'register' ? 'register' : 'login',
      String(ip || '').slice(0, 64), String(ua || '').slice(0, 200), lang === 'en' ? 'en' : 'tr', now() + REQUEST_TTL);
  return { token, pollSecret };
}
const requestByToken = token => db.prepare('SELECT * FROM login_requests WHERE token_hash=?').get(sha(String(token || '')));
const requestByPoll = secret => db.prepare('SELECT * FROM login_requests WHERE poll_hash=?').get(sha(String(secret || '')));
const requestById = id => db.prepare('SELECT * FROM login_requests WHERE id=?').get(id);
const setRequest = (id, status, userId) =>
  db.prepare('UPDATE login_requests SET status=?, user_id=COALESCE(?, user_id) WHERE id=?').run(status, userId || null, id);
const deleteRequest = id => db.prepare('DELETE FROM login_requests WHERE id=?').run(id);
const isExpired = r => r.expires_at < now();

// ---- Oturum ----
const SESSION_TTL = 7 * 24 * 3600;
function createSession(userId, ip) {
  const sid = rand(32);
  db.prepare('INSERT INTO sessions (sid_hash,user_id,expires_at,ip) VALUES (?,?,?,?)')
    .run(sha(sid), userId, now() + SESSION_TTL, ip ? String(ip).slice(0, 64) : null);
  return sid;
}
function destroySession(sid) { db.prepare('DELETE FROM sessions WHERE sid_hash=?').run(sha(sid)); }
function destroyAllSessions(userId) { db.prepare('DELETE FROM sessions WHERE user_id=?').run(userId); }
function getSessionUser(sid) {
  const row = db.prepare(`
    SELECT u.id, u.username, u.is_verified, u.telegram_chat_id, u.lang, s.ip AS session_ip
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.sid_hash=? AND s.expires_at>?`).get(sha(sid), now());
  return row ? { ...row, is_verified: !!row.is_verified } : null;
}

// ---- Kullanıcı / kota ----
const findByChatId = c => db.prepare('SELECT * FROM users WHERE telegram_chat_id=?').get(String(c));
function createUser({ chatId, name, lang }) {
  const r = db.prepare('INSERT INTO users (username, is_verified, telegram_chat_id, lang) VALUES (?,?,?,?)')
    .run(String(name || '').slice(0, 40), 1, String(chatId), lang === 'en' ? 'en' : 'tr');
  return r.lastInsertRowid;
}
const usageLast24h = userId =>
  db.prepare('SELECT COUNT(*) c FROM downloads WHERE user_id=? AND created_at>?').get(userId, now() - 86400).c;

// Süresi dolmuş istek/oturumları temizle
function purge() {
  db.prepare('DELETE FROM login_requests WHERE expires_at<?').run(now() - 3600);
  db.prepare('DELETE FROM sessions WHERE expires_at<?').run(now());
}
setInterval(() => { try { purge(); } catch { /* yoksay */ } }, 10 * 60 * 1000).unref();

module.exports = {
  createLoginRequest, requestByToken, requestByPoll, requestById, setRequest, deleteRequest, isExpired,
  createSession, destroySession, destroyAllSessions, getSessionUser,
  findByChatId, createUser, usageLast24h, purge,
};

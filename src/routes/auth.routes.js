/**
 * Telegram-only kimlik doğrulama (kullanıcı adı / şifre YOK).
 *
 *  1) Tarayıcı  POST /tg/start {mode: 'register'|'login'}  -> { url, rid }
 *     url = t.me/Bot?start=KOD (Telegram'da açılır), rid = yalnızca bu tarayıcının bildiği gizli kod
 *  2) Kullanıcı Telegram'da Başlat'a basar (kayıt) ya da isteği Onayla'r (giriş; IP + cihaz gösterilir)
 *  3) Tarayıcı  GET /tg/status?rid=...  yoklar; onaylanınca oturum çerezi BU tarayıcıya verilir
 */
const express = require('express');
const config = require('../config');
const { t, norm } = require('../i18n');
const db = require('../db');
const auth = require('../services/auth.service');
const requireAuth = require('../middleware/auth');

const router = express.Router();
const bad = (req, res, key, code = 400) => res.status(code).json({ error: t(req.lang, key) });

const setCookie = (res, sid) => res.cookie('sid', sid, {
  httpOnly: true, sameSite: 'lax', secure: config.isProd, maxAge: 7 * 24 * 3600 * 1000,
});

router.post('/tg/start', (req, res) => {
  if (!config.botToken) return bad(req, res, 'err.botOff', 503);
  const mode = (req.body || {}).mode === 'register' ? 'register' : 'login';
  const lang = norm((req.body || {}).lang || req.lang);
  const { token, pollSecret } = auth.createLoginRequest({ mode, ip: req.ip, ua: req.get('user-agent'), lang });
  res.json({ ok: true, url: `https://t.me/${config.botUsername}?start=${token}`, rid: pollSecret, ttl: 600 });
});

router.get('/tg/status', (req, res) => {
  const r = auth.requestByPoll(req.query.rid);
  if (!r) return res.json({ status: 'expired' });
  if (auth.isExpired(r)) { auth.deleteRequest(r.id); return res.json({ status: 'expired' }); }

  if (r.status === 'approved' && r.user_id) {
    auth.deleteRequest(r.id);                       // tek kullanım
    setCookie(res, auth.createSession(r.user_id, r.ip || req.ip));
    return res.json({ status: 'approved' });
  }
  if (['denied', 'noaccount'].includes(r.status)) auth.deleteRequest(r.id);
  res.json({ status: r.status });                   // pending | confirming | denied | noaccount
});

// Site dili değişince: hesabın ve Telegram botunun dili de değişir
router.post('/lang', requireAuth, (req, res) => {
  const lang = norm((req.body || {}).lang);
  db.prepare('UPDATE users SET lang=? WHERE id=?').run(lang, req.user.id);
  if (req.user.telegram_chat_id)
    db.prepare('INSERT INTO bot_chats (chat_id,lang) VALUES (?,?) ON CONFLICT(chat_id) DO UPDATE SET lang=excluded.lang')
      .run(String(req.user.telegram_chat_id), lang);
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  if (req.cookies.sid) auth.destroySession(req.cookies.sid);
  res.clearCookie('sid');
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  const u = req.user;
  const tier = config.quotas.verified; // Telegram ile giren herkes aynı katmanda
  res.json({
    username: u.username,
    is_verified: true,
    lang: u.lang || null,
    quota: { used: auth.usageLast24h(u.id), limit: tier.daily, maxHeight: tier.maxHeight },
  });
});

module.exports = router;

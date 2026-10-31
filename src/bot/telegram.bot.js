/**
 * Telegram bot: kayıt, giriş, dil seçimi ve web indirme ilerlemesi.
 */
const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');
const db = require('../db');
const auth = require('../services/auth.service');
const progress = require('../services/progress.service');
const { t, norm } = require('../i18n');

let bot = null;
let unsubscribeProgress = null;

const LANGUAGES = [
  { code: 'tr', label: '🇹🇷 Türkçe' },
  { code: 'en', label: '🇬🇧 English' },
  { code: 'ru', label: '🇷🇺 Русский' },
  { code: 'de', label: '🇩🇪 Deutsch' },
  { code: 'ar', label: '🇸🇦 العربية' },
  { code: 'ku', label: '☀️ Kurdî' },
];

const pendingStarts = new Map();
const progressMessages = new Map();
const progressLastUpdate = new Map();

function setChatLang(chatId, lang) {
  lang = norm(lang);
  db.prepare(
    'INSERT INTO bot_chats (chat_id,lang) VALUES (?,?) ON CONFLICT(chat_id) DO UPDATE SET lang=excluded.lang'
  ).run(String(chatId), lang);
  db.prepare('UPDATE users SET lang=? WHERE telegram_chat_id=?').run(lang, String(chatId));
}

function langFor(chatId, from) {
  const c = db.prepare('SELECT lang FROM bot_chats WHERE chat_id=?').get(String(chatId));
  if (c) return norm(c.lang);

  const u = auth.findByChatId(chatId);
  if (u && u.lang) return norm(u.lang);

  const code = String((from && from.language_code) || '').toLowerCase().split('-')[0];
  return ['tr', 'en', 'ru', 'de', 'ar', 'ku'].includes(code) ? code : 'en';
}

function displayName(from, chatId) {
  const raw = (from && (from.username || [from.first_name, from.last_name].filter(Boolean).join(' '))) || '';
  const clean = String(raw).replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 30);
  return clean || 'user' + String(chatId).slice(-4);
}

function shortUA(ua) {
  ua = String(ua || '');
  if (!ua) return '—';
  const br = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iOS/.test(ua) ? 'iOS'
    : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${br} · ${os}` : br;
}

function languageKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        LANGUAGES.slice(0, 3).map(x => ({ text: x.label, callback_data: `lang:${x.code}` })),
        LANGUAGES.slice(3).map(x => ({ text: x.label, callback_data: `lang:${x.code}` })),
      ],
    },
  };
}

function languagePrompt(lang) {
  const messages = {
    tr: '🌐 Lütfen dilini seç:',
    en: '🌐 Please choose your language:',
    ru: '🌐 Выберите язык:',
    de: '🌐 Bitte wähle deine Sprache:',
    ar: '🌐 اختر لغتك:',
    ku: '🌐 Ji kerema xwe zimanê xwe hilbijêre:',
  };
  return messages[norm(lang)];
}

function languageSetMessage(lang) {
  const messages = {
    tr: '✅ Dil tercihin kaydedildi.',
    en: '✅ Your language preference has been saved.',
    ru: '✅ Язык сохранён.',
    de: '✅ Deine Spracheinstellung wurde gespeichert.',
    ar: '✅ تم حفظ تفضيل اللغة.',
    ku: '✅ Hilbijartina zimanê te hate tomarkirin.',
  };
  return messages[norm(lang)];
}

function startBot() {
  if (!config.botToken) {
    console.warn('[bot] ' + t('en', 'bot.noToken'));
    return null;
  }

  if (bot) return bot;

  bot = new TelegramBot(config.botToken, { polling: true });
  bot.on('polling_error', e => console.error('[bot] polling:', e.code || e.message));

  const menu = lang => [
    { command: 'start', description: 'Start / help' },
    { command: 'status', description: 'Account status' },
    { command: 'logout', description: 'Sign out of all devices' },
    { command: 'lang', description: 'Change language' },
  ];

  bot.setMyCommands(menu('en')).catch(() => {});

  const isPrivate = msg => msg.chat.type === 'private';
  const L = msg => langFor(msg.chat.id, msg.from);
  const say = (msg, key, vars, opts) =>
    bot.sendMessage(msg.chat.id, t(L(msg), key, vars), opts);

  async function processStart(chatId, from, token, selectedLang) {
    const lang = norm(selectedLang);
    const reqRow = auth.requestByToken(token);

    if (!reqRow || reqRow.status !== 'pending' || auth.isExpired(reqRow)) {
      return bot.sendMessage(chatId, t(lang, 'bot.badToken'));
    }

    const existing = auth.findByChatId(chatId);

    if (reqRow.mode === 'register' && !existing) {
      const name = displayName(from, chatId);
      const userId = auth.createUser({ chatId, name, lang });
      setChatLang(chatId, lang);
      auth.setRequest(reqRow.id, 'approved', userId);
      return bot.sendMessage(chatId, t(lang, 'bot.registered', {
        user: name,
        ip: reqRow.ip || '—',
      }));
    }

    if (!existing) {
      auth.setRequest(reqRow.id, 'noaccount');
      return bot.sendMessage(chatId, t(lang, 'bot.noAccount'));
    }

    setChatLang(chatId, lang);
    auth.setRequest(reqRow.id, 'confirming', existing.id);

    return bot.sendMessage(
      chatId,
      t(lang, 'bot.loginAsk', {
        ip: reqRow.ip || '—',
        ua: shortUA(reqRow.ua),
      }),
      {
        reply_markup: {
          inline_keyboard: [[
            { text: t(lang, 'bot.btnOk'), callback_data: `lg:ok:${reqRow.id}` },
            { text: t(lang, 'bot.btnNo'), callback_data: `lg:no:${reqRow.id}` },
          ]],
        },
      }
    );
  }

  // /start ve /start KOD: önce dil seçilir, ardından varsa giriş/kayıt kodu işlenir.
  bot.onText(/^\/start(?:@\w+)?(?:\s+(\S+))?$/, async (msg, match) => {
    if (!isPrivate(msg)) return;

    const chatId = String(msg.chat.id);
    if (match[1]) {
      const row = auth.requestByToken(match[1]);
      if (!row || row.status !== 'pending' || auth.isExpired(row)) {
        return say(msg, 'bot.badToken');
      }
      pendingStarts.set(chatId, { token: match[1], from: msg.from });
    } else {
      pendingStarts.delete(chatId);
    }

    return bot.sendMessage(chatId, languagePrompt(langFor(chatId, msg.from)), languageKeyboard());
  });

  bot.onText(/^\/(?:durum|status)(?:@\w+)?$/, msg => {
    if (!isPrivate(msg)) return;
    const u = auth.findByChatId(msg.chat.id);
    if (!u) return say(msg, 'bot.noLinked');

    return say(msg, 'bot.status', {
      user: u.username || '—',
      used: auth.usageLast24h(u.id),
      limit: config.quotas.verified.daily === 0 ? '∞' : config.quotas.verified.daily,
    });
  });

  bot.onText(/^\/(?:cikis|logout)(?:@\w+)?$/, msg => {
    if (!isPrivate(msg)) return;
    const u = auth.findByChatId(msg.chat.id);
    if (!u) return say(msg, 'bot.noLinked');

    auth.destroyAllSessions(u.id);
    return say(msg, 'bot.signedOut');
  });

  bot.onText(/^\/(?:dil|lang)(?:@\w+)?$/, msg => {
    if (!isPrivate(msg)) return;
    return bot.sendMessage(msg.chat.id, languagePrompt(L(msg)), languageKeyboard());
  });

  // Web indirme ilerlemesini Telegram'a aktar.
  const stageText = {
    tr: { queued: 'Sıraya alındı', preparing: 'Video hazırlanıyor', merging: 'Ses ve video birleştiriliyor', sending: 'Dosya gönderiliyor', done: 'İndirme tamamlandı', error: 'İndirme başarısız', cancelled: 'İndirme iptal edildi' },
    en: { queued: 'Queued', preparing: 'Preparing video', merging: 'Merging audio and video', sending: 'Sending file', done: 'Download complete', error: 'Download failed', cancelled: 'Download cancelled' },
    ru: { queued: 'В очереди', preparing: 'Подготовка видео', merging: 'Объединение аудио и видео', sending: 'Отправка файла', done: 'Загрузка завершена', error: 'Ошибка загрузки', cancelled: 'Загрузка отменена' },
    de: { queued: 'In der Warteschlange', preparing: 'Video wird vorbereitet', merging: 'Audio und Video werden zusammengeführt', sending: 'Datei wird gesendet', done: 'Download abgeschlossen', error: 'Download fehlgeschlagen', cancelled: 'Download abgebrochen' },
    ar: { queued: 'في قائمة الانتظار', preparing: 'جارٍ تجهيز الفيديو', merging: 'جارٍ دمج الصوت والفيديو', sending: 'جارٍ إرسال الملف', done: 'اكتمل التنزيل', error: 'فشل التنزيل', cancelled: 'تم إلغاء التنزيل' },
    ku: { queued: 'Li bendê ye', preparing: 'Vîdyo tê amadekirin', merging: 'Deng û vîdyo tên yekxistin', sending: 'Pel tê şandin', done: 'Daxistin qediya', error: 'Daxistin bi ser neket', cancelled: 'Daxistin hate betalkirin' },
  };

  function progressText(job, lang) {
    const l = norm(lang);
    const stage = (stageText[l] || stageText.en)[job.stage] || job.stage;
    const pct = typeof job.pct === 'number' ? ` · ${Math.round(job.pct)}%` : '';
    const title = job.title ? `\n${job.title}` : '';
    let size = '';
    if (job.total > 0) {
      const mb = n => (Number(n || 0) / 1048576).toFixed(1);
      size = `\n${mb(job.bytes)} / ${mb(job.total)} MB`;
    }
    return `⬇️ ${stage}${pct}${title}${size}`;
  }

  if (unsubscribeProgress) unsubscribeProgress();
  unsubscribeProgress = progress.subscribe(job => {
    try {
      const user = db.prepare('SELECT telegram_chat_id, lang FROM users WHERE id=?').get(job.uid);
      if (!user || !user.telegram_chat_id) return;

      const chatId = String(user.telegram_chat_id);
      const lang = norm(user.lang || langFor(chatId));
      const now = Date.now();
      const previous = progressLastUpdate.get(job.pid) || 0;
      const terminal = ['done', 'error', 'cancelled'].includes(job.stage);

      // Telegram mesaj düzenleme sıklığını sınırla; aşama değişimleri ve son durum hemen gönderilir.
      if (!terminal && now - previous < 1500) return;
      progressLastUpdate.set(job.pid, now);

      const text = progressText(job, lang);
      const state = progressMessages.get(job.pid);

      if (!state) {
        bot.sendMessage(chatId, text).then(message => {
          progressMessages.set(job.pid, { chatId, messageId: message.message_id });
        }).catch(err => console.warn('[bot] progress message:', err.message));
      } else {
        bot.editMessageText(text, {
          chat_id: state.chatId,
          message_id: state.messageId,
        }).catch(err => {
          if (!/message is not modified/i.test(err.message || '')) {
            console.warn('[bot] progress edit:', err.message);
          }
        });
      }

      if (terminal) {
        setTimeout(() => {
          progressMessages.delete(job.pid);
          progressLastUpdate.delete(job.pid);
        }, 60 * 1000).unref();
      }
    } catch (err) {
      console.warn('[bot] progress notification skipped:', err.message);
    }
  });

  bot.on('callback_query', async q => {
    const chat = q.message && q.message.chat;
    const done = () => bot.answerCallbackQuery(q.id).catch(() => {});
    if (!chat || chat.type !== 'private') return done();

    const lm = /^lang:(tr|en|ru|de|ar|ku)$/.exec(q.data || '');
    if (lm) {
      const lang = lm[1];
      setChatLang(chat.id, lang);
      done();

      const pending = pendingStarts.get(String(chat.id));
      if (pending) {
        pendingStarts.delete(String(chat.id));
        bot.sendMessage(chat.id, languageSetMessage(lang)).catch(() => {});
        return processStart(String(chat.id), pending.from, pending.token, lang)
          .catch(err => console.error('[bot] start flow:', err.message));
      }

      bot.sendMessage(chat.id, languageSetMessage(lang)).catch(() => {});
      bot.setMyCommands(menu(lang), {
        scope: { type: 'chat', chat_id: chat.id },
      }).catch(() => {});
      return;
    }

    const gm = /^lg:(ok|no):(\d+)$/.exec(q.data || '');
    if (!gm) return done();

    const row = auth.requestById(+gm[2]);
    const user = auth.findByChatId(chat.id);
    const lang = langFor(chat.id, q.from);

    if (!row || !user || row.user_id !== user.id ||
        row.status !== 'confirming' || auth.isExpired(row)) {
      done();
      return bot.sendMessage(chat.id, t(lang, 'bot.badToken'));
    }

    auth.setRequest(row.id, gm[1] === 'ok' ? 'approved' : 'denied');
    done();

    bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: chat.id, message_id: q.message.message_id }
    ).catch(() => {});

    bot.sendMessage(chat.id, t(lang, gm[1] === 'ok' ? 'bot.loginOk' : 'bot.loginNo'))
      .catch(() => {});
  });

  console.log(`[bot] @${config.botUsername} polling started`);
  return bot;
}

module.exports = { startBot };

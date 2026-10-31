const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const config = require('./config');
require('./db');
const { t, langMiddleware } = require('./i18n');
const requireAuth = require('./middleware/auth');
const { getProgress } = require('./controllers/download.controller');
const { startBot } = require('./bot/telegram.bot');
const { startCleanup } = require('./jobs/cleanup.job');

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api', langMiddleware);

// Hız sınırı mesajı da seçilen dilde döner
const limiter = (windowMs, limit, extra = {}) => rateLimit({
  windowMs, limit, ...extra,
  handler: (req, res) => res.status(429).json({ error: t(req.lang, 'err.rate') }),
});

// Telegram giriş durumu 2 sn'de bir yoklanır: kendi limiti var, 15 dk'lık genel limite sayılmaz
app.use('/api/auth/tg/status', limiter(60 * 1000, 60));
app.use('/api/auth', limiter(15 * 60 * 1000, 100, { skip: req => req.path === '/tg/status' }), require('./routes/auth.routes'));
// İlerleme yoklaması sık olduğu için ayrı (daha geniş) limit
app.get('/api/progress/:pid', limiter(60 * 1000, 300), requireAuth, getProgress);
app.use('/api/download', limiter(60 * 1000, 30), require('./routes/download.routes'));

// Merkezi hata yakalayıcı (mesajlar i18n anahtarıdır -> istek diline çevrilir)
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status === 500) console.error(err);
  if (res.headersSent) return res.destroy();
  res.status(status).json({ error: status === 500 ? t(req.lang, 'err.server') : t(req.lang, err.message, err.vars) });
});

app.listen(config.port, '127.0.0.1', () => {
  console.log(`[server] ${config.baseUrl} (port ${config.port})`);
  startBot();
  startCleanup();
});

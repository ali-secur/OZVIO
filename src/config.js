require('dotenv').config();

module.exports = {
  port: +process.env.PORT || 3000,
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  isProd: process.env.NODE_ENV === 'production',

  botToken: process.env.TELEGRAM_BOT_TOKEN,
  botUsername: process.env.TELEGRAM_BOT_USERNAME || 'BotAdi',

  tmpDir: process.env.TMP_DIR || '/tmp/downloads',
  dbFile: process.env.DB_FILE || './data.sqlite',
  ytdlp: process.env.YTDLP_PATH || 'yt-dlp',
  ffmpeg: process.env.FFMPEG_PATH || 'ffmpeg',

  // SSRF koruması: yt-dlp yalnızca bu alan adlarına (ve alt alan adlarına) yönlendirilir.
  // .env'deki ALLOWED_HOSTS varsayılan listeyi EZMEZ, ona EKLENİR (eski .env dosyaları platformları kısıtlamasın diye).
  allowedHosts: [...new Set([
    'youtube.com', 'youtu.be', 'vimeo.com', 'dailymotion.com',
    'instagram.com', 'instagr.am', 'threads.net', 'threads.com',
    'tiktok.com', 'x.com', 'twitter.com', 't.co',
    'facebook.com', 'fb.watch', 'fb.com',
    'reddit.com', 'redd.it', 'twitch.tv', 'kick.com',
    'pinterest.com', 'pin.it', 'snapchat.com', 'linkedin.com', 'tumblr.com',
    'soundcloud.com', 'bilibili.com', 'vk.com', 'ok.ru', 'rumble.com',
    'streamable.com', 'imgur.com', 'bsky.app', 'ted.com',
    ...(process.env.ALLOWED_HOSTS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
  ])],

  // Bu sitelerde diske yazmadan akış (Strateji A) kullanılır; diğer tüm platformlar
  // (Instagram, TikTok, X...) HLS/DASH/birleşik format farklılıkları için sağlam olan Strateji B'yi kullanır.
  tunnelHosts: ['youtube.com', 'youtu.be', 'vimeo.com', 'dailymotion.com'],

  // Instagram/TikTok/X bazı videolarda giriş ister: Netscape formatında cookies.txt yolu (isteğe bağlı)
  cookiesFile: process.env.COOKIES_FILE || '',

  // Oturumu giriş yapılan IP'ye kilitle (1 = evet). Mobil ağlarda IP değişebildiği için varsayılan kapalı.
  bindSessionIp: process.env.BIND_SESSION_IP === '1',

  // Community sürümünde limitler .env üzerinden yönetilir.
  // 0 = sınırsız (eşzamanlı işlem sayısı hariç).
  maxConcurrentMux: Math.max(1, Number.parseInt(process.env.MAX_CONCURRENT_MUX, 10) || 4),
  maxFileSize: (() => {
    const value = (process.env.MAX_FILE_SIZE || '4G').trim();
    return value === '0' ? null : value;
  })(),
  maxDurationSec: Math.max(0, Number.parseInt(process.env.MAX_DURATION_SECONDS ?? '10800', 10) || 0),

  // Kota katmanları (son 24 saat); günlük 0 = sınırsız.
  quotas: {
    unverified: {
      daily: Math.max(0, Number.parseInt(process.env.UNVERIFIED_DAILY_DOWNLOAD_LIMIT ?? '3', 10) || 0),
      maxHeight: Math.max(0, Number.parseInt(process.env.UNVERIFIED_MAX_VIDEO_HEIGHT ?? '720', 10) || 0),
    },
    verified: {
      daily: Math.max(0, Number.parseInt(process.env.DAILY_DOWNLOAD_LIMIT ?? '20', 10) || 0),
      maxHeight: Math.max(0, Number.parseInt(process.env.MAX_VIDEO_HEIGHT ?? '2160', 10) || 0),
    },
  },

  // Kalite -> strateji eşlemesi
  // B = önce SSD'ye indir, birleştir ve kullanıcıya gönder
  qualities: {
    mp3:    { strategy: 'B', kind: 'audio', height: 0 },
    '144p': { strategy: 'B', kind: 'video', height: 144 },
    '240p': { strategy: 'B', kind: 'video', height: 240 },
    '360p': { strategy: 'B', kind: 'video', height: 360 },
    '480p': { strategy: 'B', kind: 'video', height: 480 },
    '720p': { strategy: 'B', kind: 'video', height: 720 },
    '1080p': { strategy: 'B', kind: 'video', height: 1080 },
    '1440p': { strategy: 'B', kind: 'video', height: 1440 },
    '2160p': { strategy: 'B', kind: 'video', height: 2160 }, // 4K
  },
};

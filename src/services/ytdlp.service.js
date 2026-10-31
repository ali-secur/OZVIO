const { spawn } = require('child_process');
const fsp = require('fs').promises;
const path = require('path');
const config = require('../config');

// Argümanlar HER ZAMAN dizi olarak verilir (shell yok) ve URL'den önce '--' gelir:
// komut / argüman enjeksiyonu mümkün değil.
// --playlist-items 1: Instagram carousel / çok videolu gönderilerde yalnızca ilk öğe.
// COOKIES_FILE verilirse (Netscape cookies.txt) giriş isteyen Instagram/TikTok/X içerikleri de çalışır.
const COOKIE_ARGS = config.cookiesFile ? ['--cookies', config.cookiesFile] : [];
const COMMON = ['--no-playlist', '--playlist-items', '1', '--no-warnings', '--quiet', '--no-progress', ...COOKIE_ARGS];

// ------- Bilgi (başlık, süre, formatlar) -------
const TIERS = [144, 240, 360, 480, 720, 1080, 1440, 2160];

// Format "kalite etiketi": YouTube'un gösterdiği gibi (dikey/sinematik videolar da doğru etiketlenir)
//  1920x1080 -> 1080, 1080x1920 (Shorts) -> 1080, 1920x800 -> 1080, 640x480 (4:3) -> 480
// lenient (YouTube dışı platformlar): 576x1024 gibi standart olmayan boyutlar bir alt kaliteye yuvarlanır.
function tierOf(w, h, lenient) {
  if (!h) return 0;
  const raw = w ? Math.max(Math.min(w, h), Math.round(Math.max(w, h) * 9 / 16)) : h;
  let best = 0, diff = Infinity;
  for (const t of TIERS) { const d = Math.abs(t - raw); if (d < diff) { diff = d; best = t; } }
  if (diff <= best * 0.1) return best; // %10'dan fazla sapıyorsa standart kalite değil
  if (!lenient) return 0;
  const floor = TIERS.filter(t => t <= raw).pop();
  return floor || TIERS[0];
}

function reduceInfo(j) {
  // Çok öğeli gönderi (Instagram carousel vb.): ilk öğeyi kullan
  if ((!j.formats || !j.formats.length) && Array.isArray(j.entries) && j.entries[0])
    j = { ...j.entries[0], title: j.entries[0].title || j.title };
  const extractor = String(j.extractor_key || j.extractor || '');
  const lenient = !/youtube/i.test(extractor);
  const formats = (j.formats || []).map(f => {
    const hasV = f.vcodec && f.vcodec !== 'none', hasA = f.acodec && f.acodec !== 'none';
    const unknown = !f.vcodec && !f.acodec && f.height > 0; // codec bilgisi yok ama video boyutu var: birleşik say
    return {
      id: String(f.format_id),
      w: f.width || 0, h: f.height || 0, fps: f.fps || 0, ext: f.ext || '',
      v: !!hasV || unknown,
      a: !!hasA || unknown || (!!hasV && !f.acodec && f.height > 0), // acodec bilinmeyen video: birleşik varsay
      tbr: f.tbr || 0,
      size: f.filesize || f.filesize_approx || 0,
    };
  }).filter(f => (f.v || f.a) && f.ext !== 'mhtml');
  formats.forEach(f => { f.tier = f.v ? tierOf(f.w, f.h, lenient) : 0; });
  return {
    title: j.title || j.description && String(j.description).slice(0, 80) || 'video',
    duration: Number(j.duration) || 0,
    thumbnail: j.thumbnail || '',
    extractor,
    formats,
  };
}

const infoCache = new Map(); // url -> { at, info }
const INFO_TTL = 10 * 60 * 1000;

function getInfo(url) {
  const hit = infoCache.get(url);
  if (hit && Date.now() - hit.at < INFO_TTL) return Promise.resolve(hit.info);
  return new Promise((resolve, reject) => {
    const p = spawn(config.ytdlp, [...COMMON, '--skip-download', '--dump-single-json', '--', url]);
    let out = '', err = '';
    const timer = setTimeout(() => p.kill('SIGKILL'), 45000);
    p.stdout.on('data', d => { if (out.length < 30e6) out += d; });
    p.stderr.on('data', d => (err += d));
    p.on('error', reject);
    p.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(err.trim().slice(-500) || 'yt-dlp hata'));
      try {
        const info = reduceInfo(JSON.parse(out));
        if (infoCache.size > 200) infoCache.delete(infoCache.keys().next().value);
        infoCache.set(url, { at: Date.now(), info });
        resolve(info);
      } catch { reject(new Error('bilgi çözümlenemedi')); }
    });
  });
}

// Videonun gerçekten sahip olduğu kaliteler (ör. [144,240,360,480,720,1080])
function availableTiers(info) {
  return [...new Set(info.formats.filter(f => f.v && f.tier).map(f => f.tier))].sort((a, b) => a - b);
}

// İstenen kalite için format seç. null => bu kalite videoda yok.
// Video-only formatlar tercih edilir (A: mp4/h264 önce; ses ayrı alınır).
function pickVideoFormat(info, height) {
  const c = info.formats.filter(f => f.v && f.tier === height);
  if (!c.length) return null;
  const rank = f => [f.a ? 0 : 1, f.ext === 'mp4' ? 1 : 0, f.fps, f.tbr];
  c.sort((x, y) => {
    const a = rank(x), b = rank(y);
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return b[i] - a[i];
    return 0;
  });
  return c[0];
}

const hasVideo = info => info.formats.some(f => f.v);

// Boyutu/yüksekliği bilinmeyen platformlarda (tier çıkmayan) en iyi video formatı (birleşik olabilir)
function pickAnyVideo(info) {
  const c = info.formats.filter(f => f.v);
  c.sort((x, y) => (y.h - x.h) || ((y.ext === 'mp4') - (x.ext === 'mp4')) || (y.tbr - x.tbr));
  return c[0] || null;
}

function bestAudio(info) {
  return info.formats.filter(f => f.a && !f.v).sort((x, y) => y.tbr - x.tbr)[0] || null;
}

// Tahmini çıktı boyutu (bayt) — ilerleme yüzdesi için. Bilinmiyorsa 0.
function estimateBytes(info, quality, fmt) {
  const dur = info.duration || 0;
  if (quality.kind === 'audio') return Math.round(dur * 192000 / 8 * 1.02);
  if (!fmt) return 0;
  const vid = fmt.size || (fmt.tbr ? fmt.tbr * 125 * dur : 0);
  if (!vid) return 0;
  const aud = fmt.a ? 0 : Math.round(dur * 160000 / 8);
  return Math.round((vid + aud) * 1.02);
}

// ------- STRATEJİ A argümanları (stdout'a yazar, disk yok) -------
const audioArgs = url => [...COMMON, '-f', 'bestaudio', '-o', '-', '--', url];
// fmt: pickVideoFormat sonucu. Video-only ise tam o format; değilse (birleşik/bilinmiyor) yükseklik filtresi.
const videoOnlyArgs = (url, h, fmt) => [
  ...COMMON, '-f',
  fmt && (!fmt.a || !fmt.h) ? fmt.id : `bv[height<=${fmt ? fmt.h : h}][ext=mp4]/bv[height<=${fmt ? fmt.h : h}]/b[height<=${fmt ? fmt.h : h}]`,
  '-o', '-', '--', url,
];
// bestaudio -> MP3 (pipe:0 -> pipe:1)
const ffmpegMp3Args = () => [
  '-hide_banner', '-loglevel', 'error', '-i', 'pipe:0',
  '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', '-f', 'mp3', 'pipe:1',
];
// video(pipe:3) + ses(pipe:4) -> fragmented MP4 (pipe:1). Seek gerektirmediği için stdout'a yazılabilir.
const ffmpegMuxPipeArgs = () => [
  '-hide_banner', '-loglevel', 'error', '-i', 'pipe:3', '-i', 'pipe:4',
  '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
  '-movflags', 'frag_keyframe+empty_moov+default_base_moof', '-f', 'mp4', 'pipe:1',
];

// ------- STRATEJİ B: geçici dosyaya indir + yt-dlp (FFmpeg) ile birleştir -------
// onProgress({ stage:'preparing'|'merging', pct, bytes, total }) — yt-dlp çıktısından ayrıştırılır
function downloadMerged({ url, height, fmt, id, estTotal, audio, onSpawn, onProgress }) {
  return new Promise((resolve, reject) => {
    let sel;
    if (audio) {
      sel = 'ba/b';
    } else if (fmt && !fmt.a) {
      sel = fmt.ext === 'mp4' ? `${fmt.id}+ba[ext=m4a]/${fmt.id}+ba` : `${fmt.id}+ba`;
    } else {
      const h = fmt ? fmt.h : height;
      sel = fmt && fmt.a ? fmt.id : `bv*[height<=${h}]+ba/b[height<=${h}]`;
    }
    const args = [
      '--no-playlist', '--playlist-items', '1', '--no-warnings', '--quiet', ...COOKIE_ARGS,
      '--progress', '--newline',
      '--progress-template', 'download:DL|%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|%(info.format_id)s',
      '--progress-template', 'postprocess:PP|%(info.id)s',
      '-f', sel,
      ...(audio ? ['-x', '--audio-format', 'mp3', '--audio-quality', '192K'] : ['--merge-output-format', 'mp4']),
      ...(config.maxFileSize ? ['--max-filesize', config.maxFileSize] : []),
      '--no-mtime',            // ÖNEMLİ: dosya mtime'ı "şimdi" olsun (cron mantığı buna dayanır)
      '-o', path.join(config.tmpDir, `${id}.%(ext)s`),
    ];
    if (config.ffmpeg !== 'ffmpeg') args.push('--ffmpeg-location', config.ffmpeg);
    args.push('--', url);

    const p = spawn(config.ytdlp, args);
    onSpawn && onSpawn(p);

    // Birden çok akış (video + ses) indirilir: akış başına bayt tutup toplamdan yüzde çıkar
    const seen = new Map();
    const feed = line => {
      if (!onProgress) return;
      if (line.startsWith('PP|')) return onProgress({ stage: 'merging', pct: 85 });
      if (!line.startsWith('DL|')) return;
      const [, d, t, e, fid] = line.split('|');
      const num = v => (Number(v) > 0 ? Number(v) : 0);
      seen.set(fid, { d: num(d), t: num(t) || num(e) });
      let sumD = 0, sumT = 0;
      for (const v of seen.values()) { sumD += v.d; sumT += v.t; }
      const total = Math.max(estTotal || 0, seen.size > 1 ? sumT : sumT * 1.08);
      onProgress({
        stage: 'preparing', bytes: sumD, total,
        pct: total ? Math.min(sumD / total, 1) * 80 : null, // hazırlık: %0-80, birleştirme: %85, gönderim: %85-100
      });
    };
    let err = '';
    const lineBuf = { o: '', e: '' };
    const onData = key => d => {
      lineBuf[key] += d;
      const parts = lineBuf[key].split(/\r?\n|\r/);
      lineBuf[key] = parts.pop();
      parts.forEach(l => feed(l.trim()));
      if (key === 'e') err = (err + d).slice(-2000);
    };
    p.stdout.on('data', onData('o'));
    p.stderr.on('data', onData('e'));
    const timer = setTimeout(() => p.kill('SIGKILL'), 45 * 60 * 1000);
    p.on('error', reject);
    p.on('close', code => {
      clearTimeout(timer);
      code === 0 ? resolve() : reject(new Error(err.trim().slice(-500) || `yt-dlp çıkış kodu ${code}`));
    });
  });
}

async function findOutput(id) {
  const files = await fsp.readdir(config.tmpDir);
  const ok = files.filter(f =>
    f.startsWith(id + '.') && !/\.(part|ytdl|temp)$/.test(f) && !/\.f\d+\./.test(f));
  const pick = ok.find(f => f.endsWith('.mp4')) || ok[0];
  return pick ? path.join(config.tmpDir, pick) : null;
}

// İlgili işin TÜM artıklarını (.part, .f137.mp4 vs.) siler. İdempotent.
async function removeById(id) {
  try {
    const files = await fsp.readdir(config.tmpDir);
    await Promise.all(files.filter(f => f.startsWith(id))
      .map(f => fsp.rm(path.join(config.tmpDir, f), { force: true })));
  } catch { /* klasör yoksa sorun değil */ }
}

// ------- TRANSKRİPT -------
const LANG_RE = /^[A-Za-z0-9-]{1,20}$/;

// Altyazı listesi + başlık (video indirilmez)
function getSubsInfo(url) {
  return new Promise((resolve, reject) => {
    const p = spawn(config.ytdlp, [...COMMON, '--skip-download', '--dump-single-json', '--', url]);
    let out = '', err = '';
    const timer = setTimeout(() => p.kill('SIGKILL'), 45000);
    p.stdout.on('data', d => { if (out.length < 30e6) out += d; });
    p.stderr.on('data', d => (err += d));
    p.on('error', reject);
    p.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(err.trim().slice(-500) || 'yt-dlp hata'));
      try { resolve(JSON.parse(out)); } catch { reject(new Error('bilgi çözümlenemedi')); }
    });
  });
}

const baseLang = l => String(l).split('-')[0].toLowerCase();

// Kullanılabilir dil listesi: manuel altyazılar + otomatik (orijinal dil) + tr/en çevirisi.
// Her parçanın benzersiz bir id'si var (aynı dilde "TR" ve "TR (otomatik)" ayrı seçilebilsin diye):
//   manuel -> "tr", otomatik -> "tr.auto", çeviri -> "en.tx"
const SITE_TRANSCRIPT_LANGS = ['tr', 'en', 'ru', 'de', 'ar', 'ku'];

function listTracks(info) {
  const allowed = lang => SITE_TRANSCRIPT_LANGS.includes(baseLang(lang));
  const manual = Object.keys(info.subtitles || {})
    .filter(k => k !== 'live_chat' && allowed(k));

  const autoMap = info.automatic_captions || {};
  const autoKeys = Object.keys(autoMap).filter(k => k !== 'live_chat');
  const orig = autoKeys.find(k => k.endsWith('-orig'));

  const tracks = manual.map(l => ({ id: l, lang: l, auto: false }));

  if (orig) {
    const l = orig.replace(/-orig$/, '');
    if (l && allowed(l) && !tracks.some(t => baseLang(t.lang) === baseLang(l))) {
      tracks.push({ id: l + '.auto', lang: l, auto: true, key: orig });
    }
  } else if (info.language && autoMap[info.language] && allowed(info.language)) {
    const l = info.language;
    if (!tracks.some(t => baseLang(t.lang) === baseLang(l))) {
      tracks.push({ id: l + '.auto', lang: l, auto: true, key: l });
    }
  }

  // Yalnızca site arayüzündeki altı dil için çeviri seçeneği oluştur.
  const sources = tracks.slice();

  for (const lang of SITE_TRANSCRIPT_LANGS) {
    if (sources.some(t => baseLang(t.lang) === lang)) continue;
    if (!sources.length && !autoMap[lang]) continue;

    tracks.push({
      id: lang + '.tx',
      lang,
      auto: true,
      translated: true,
      key: autoMap[lang] ? lang : null,
    });
  }

  return tracks;
}

// Çeviri için kaynak: videonun dilindeki yazılmış altyazı > otomatik orijinal > herhangi bir yazılmış > herhangi
function pickSource(tracks, videoLang) {
  const src = tracks.filter(t => !t.translated);
  const v = videoLang ? baseLang(videoLang) : '';
  return (v && src.find(t => !t.auto && baseLang(t.lang) === v))
    || (v && src.find(t => baseLang(t.lang) === v))
    || src.find(t => !t.auto) || src[0] || null;
}

function pickTrack(tracks, want, videoLang) {
  const exact = want && tracks.find(t => t.id === want);
  if (exact) return exact;
  const prefs = [want, videoLang, 'tr', 'en'].filter(Boolean);
  for (const l of prefs) {
    const hit = tracks.find(t => t.lang === l && !t.auto) || tracks.find(t => baseLang(t.lang) === baseLang(l) && !t.auto)
      || tracks.find(t => t.lang === l) || tracks.find(t => baseLang(t.lang) === baseLang(l));
    if (hit) return hit;
  }
  return tracks[0] || null;
}

async function downloadSubs({ url, key, id }) {
  if (!LANG_RE.test(key)) throw new Error('geçersiz dil');
  await fsp.mkdir(config.tmpDir, { recursive: true });
  await new Promise((resolve, reject) => {
    const p = spawn(config.ytdlp, [
      ...COMMON, '--skip-download', '--write-subs', '--write-auto-subs',
      '--sub-langs', key, '--sub-format', 'json3',
      '-o', path.join(config.tmpDir, `${id}.%(ext)s`), '--', url,
    ]);
    let err = '';
    const timer = setTimeout(() => p.kill('SIGKILL'), 60000);
    p.stderr.on('data', d => (err += d));
    p.on('error', reject);
    p.on('close', code => {
      clearTimeout(timer);
      code === 0 ? resolve() : reject(new Error(err.trim().slice(-500) || `yt-dlp çıkış kodu ${code}`));
    });
  });
  const files = await fsp.readdir(config.tmpDir);
  const f = files.find(n => n.startsWith(id + '.') && n.endsWith('.json3'));
  if (!f) throw new Error('altyazı dosyası yok');
  return fsp.readFile(path.join(config.tmpDir, f), 'utf8');
}

// json3 -> [{ s: saniye, d: süre, text }]
function parseJson3(raw) {
  const data = JSON.parse(raw);
  const out = [];
  for (const ev of data.events || []) {
    if (!ev.segs) continue;
    const text = ev.segs.map(g => g.utf8 || '').join('').replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text || /^\[.*\]$/.test(text) && text.length < 3) continue;
    const s = (ev.tStartMs || 0) / 1000;
    const prev = out[out.length - 1];
    if (prev && prev.text === text) continue; // yinelenen satırlar
    out.push({ s: Math.round(s * 100) / 100, d: Math.round((ev.dDurationMs || 0) / 10) / 100, text });
  }
  return out;
}

module.exports = {
  reduceInfo, getInfo, availableTiers, pickVideoFormat, pickAnyVideo, hasVideo, bestAudio, estimateBytes, tierOf, TIERS,
  audioArgs, videoOnlyArgs, ffmpegMp3Args, ffmpegMuxPipeArgs,
  downloadMerged, findOutput, removeById,
  getSubsInfo, listTracks, pickSource, pickTrack, downloadSubs, parseJson3,
};

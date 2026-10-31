/**
 * HİBRİT İNDİRME KONTROLCÜSÜ
 *  - Strateji A (MP3, 144p-720p): yt-dlp -> (ffmpeg) -> HTTP response. Diske HİÇ yazılmaz.
 *  - Strateji B (1080p+):         /tmp/downloads'a indir + mux -> stream -> close/finish'te sil.
 *
 * Ek: her indirme bir "pid" ile ilerleme kaydı tutar (services/progress.service.js);
 *     istemci /api/progress/:pid ile yüzdeyi okur.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const config = require('../config');
const db = require('../db');
const auth = require('../services/auth.service');
const yt = require('../services/ytdlp.service');
const progress = require('../services/progress.service');
const translator = require('../services/translate.service');

// message = i18n anahtarı (server.js hata yakalayıcısı çevirir), vars = yer tutucular
class HttpError extends Error {
  constructor(status, key, vars) { super(key); this.status = status; this.vars = vars; }
}

const activeUsers = new Set(); // kullanıcı başına aynı anda 1 indirme
let activeMux = 0;             // eşzamanlı Strateji B sayısı (disk/CPU koruması)

// ---------- Doğrulama + kota ----------
function checkUrl(src) {
  let u;
  try { u = new URL(String(src.url || '')); } catch { throw new HttpError(400, 'err.invalidUrl'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw new HttpError(400, 'err.invalidUrl');

  // SSRF koruması: yt-dlp'nin generic extractor'ı her adresi çekebilir -> allowlist şart.
  const host = u.hostname.toLowerCase();
  if (!config.allowedHosts.some(h => host === h || host.endsWith('.' + h)))
    throw new HttpError(400, 'err.unsupported');
  return u;
}

function parseRequest(req) {
  const src = req.method === 'GET' ? req.query : req.body;
  const u = checkUrl(src);

  const q = config.qualities[src.quality];
  if (!q) throw new HttpError(400, 'err.invalidQ');

  const tier = req.user.is_verified ? config.quotas.verified : config.quotas.unverified;
  if (tier.maxHeight > 0 && q.height > tier.maxHeight) throw new HttpError(403, 'err.needVerify');

  const used = auth.usageLast24h(req.user.id);
  if (tier.daily > 0 && used >= tier.daily) throw new HttpError(429, 'err.quota');

  const pid = progress.validPid(src.pid) ? src.pid : null;
  // A (diske yazmadan akış) yalnızca YouTube/Vimeo/Dailymotion'da; Instagram, TikTok, X vb. her zaman B (geçici dosya)
  const host = u.hostname.toLowerCase();
  const tunnelOk = config.tunnelHosts.some(h => host === h || host.endsWith('.' + h));
  const strategy = q.strategy === 'A' && tunnelOk ? 'A' : 'B';
  return { url: u.href, qualityKey: src.quality, q, tier, used, pid, strategy };
}

async function fetchInfo(url) {
  let info;
  try { info = await yt.getInfo(url); }
  catch (e) { console.error('[info]', e.message); throw new HttpError(502, 'err.info'); }
  if (config.maxDurationSec > 0 && info.duration > config.maxDurationSec) throw new HttpError(400, 'err.tooLong');
  return info;
}

// Videoda olmayan kaliteyi reddet (ör. 1080p videoda 4K isteme). Seçilen formatı döndürür.
function resolveFormat(info, q) {
  if (q.kind !== 'video') return null;
  if (!yt.hasVideo(info)) throw new HttpError(400, 'err.audioOnly');
  const tiers = yt.availableTiers(info);
  if (!tiers.length) return yt.pickAnyVideo(info); // yükseklik bilinmeyen platform: en iyi video
  const fmt = yt.pickVideoFormat(info, q.height);
  if (!fmt) throw new HttpError(400, 'err.noQuality', { q: q.height, max: tiers[tiers.length - 1] });
  return fmt;
}

function contentDisposition(title, ext) {
  const clean = (title.replace(/[^\p{L}\p{N}\s._-]/gu, '').trim().slice(0, 100)) || 'video';
  const ascii = clean.replace(/[^\x20-\x7E]/g, '_');
  return `attachment; filename="${ascii}.${ext}"; filename*=UTF-8''${encodeURIComponent(clean)}.${ext}`;
}

// ---------- Video bilgisi (yapıştırınca çağrılır): başlık, süre, desteklenen kaliteler ----------
async function info(req, res, next) {
  try {
    const url = checkUrl(req.body).href;
    const inf = await fetchInfo(url);
    const tiers = yt.availableTiers(inf);
    const hasV = yt.hasVideo(inf);
    const qualities = Object.entries(config.qualities)
      .filter(([, q]) => q.kind === 'audio' || (hasV && (!tiers.length || tiers.includes(q.height))))
      .map(([k]) => k);
    res.json({ ok: true, title: inf.title, duration: inf.duration, thumbnail: inf.thumbnail, tiers, qualities });
  } catch (e) { next(e); }
}

// ---------- Ön kontrol (UI için): indirme başlatmadan doğrular + ilerleme kaydını açar ----------
async function preflight(req, res, next) {
  try {
    const p = parseRequest(req);
    const inf = await fetchInfo(p.url);
    resolveFormat(inf, p.q);
    if (p.pid) progress.create(p.pid, req.user.id, inf.title);
    res.json({
      ok: true, title: inf.title, duration: inf.duration,
      strategy: p.strategy, remaining: p.tier.daily === 0 ? '∞' : Math.max(0, p.tier.daily - p.used),
    });
  } catch (e) { next(e); }
}

// ---------- İlerleme (istemci yoklar) ----------
function getProgress(req, res) {
  const j = progress.get(req.params.pid, req.user.id);
  if (!j) return res.status(404).json({ error: 'not_found' });
  const { t } = require('../i18n');
  res.json({
    stage: j.stage, pct: j.pct, bytes: j.bytes, total: j.total, title: j.title,
    error: j.error ? t(req.lang, j.error.key, j.error.vars) : null,
  });
}

// ---------- İptal (istemci "İptal" butonu) ----------
function cancel(req, res) {
  const pid = req.body && req.body.pid;
  if (!progress.validPid(pid)) return res.status(400).json({ error: 'bad_pid' });
  const ok = progress.requestCancel(pid, req.user.id);
  res.json({ ok });
}


// Kullanıcının önceki tamamlanmış dosyasını siler.
async function removePreviousUserFile(uid) {
  const row = db.prepare(
    'SELECT download_id FROM user_last_files WHERE user_id = ?'
  ).get(uid);

  if (!row) return;

  await yt.removeById(row.download_id);
  db.prepare('DELETE FROM user_last_files WHERE user_id = ?').run(uid);
}

// ---------- Ana endpoint: kaliteye göre A veya B'ye yönlendirir ----------
async function download(req, res, next) {
  const uid = req.user.id;
  const pid = progress.validPid(req.query.pid) ? req.query.pid : null;
  if (pid && !progress.get(pid, uid)) progress.create(pid, uid);
  const failJob = e => { if (pid) progress.fail(pid, e.status ? e.message : 'err.server', e.vars); };

  if (activeUsers.has(uid)) {
    const e = new HttpError(429, 'err.busyUser');
    failJob(e);
    return next(e);
  }
  activeUsers.add(uid);
  let freed = false;
  const free = () => { if (!freed) { freed = true; activeUsers.delete(uid); } };
  res.on('close', () => { free(); if (pid) { progress.offCancel(pid); progress.cancel(pid); } }); // done/error sonrası etkisiz
  res.on('finish', () => { if (pid) progress.done(pid); });
  // Kullanıcı "İptal"e basarsa yanıtı kes -> 'close' tetiklenir -> yt-dlp/ffmpeg öldürülür, geçici dosyalar silinir
  if (pid) progress.onCancel(pid, () => res.destroy());

  try {
    const p = parseRequest(req);
    const inf = await fetchInfo(p.url);
    if (res.destroyed) { free(); return; } // bilgi alınırken iptal edildi: süreç başlatma
    const fmt = resolveFormat(inf, p.q);

    // Yeni indirme isteğinde yalnızca bu hesabın eski dosyasını temizle.
    await removePreviousUserFile(uid);

    if (pid) progress.set(pid, { title: inf.title, stage: 'preparing', pct: 0 });
    db.prepare('INSERT INTO downloads (user_id, quality) VALUES (?,?)').run(uid, p.qualityKey);

    const est = yt.estimateBytes(inf, p.q, fmt);
    const fail = e => { failJob(e); free(); next(e); };
    if (p.strategy === 'A') tunnel(res, p, inf, fmt, est, pid, fail);   // diske yazmadan
    else await tempMux(res, p, inf, fmt, est, pid, uid);                       // indir-birleştir-yok et
  } catch (e) { failJob(e); free(); next(e); }
}

// =====================================================================
// STRATEJİ A — TÜNEL: Sunucu diskine hiçbir şey yazılmaz, pipe -> response
// =====================================================================
function tunnel(res, p, info, fmt, est, pid, next) {
  const procs = [];
  let started = false;
  let errBuf = '';
  const killAll = () => procs.forEach(pr => { try { pr.kill('SIGKILL'); } catch {} });
  const track = pr => {
    procs.push(pr);
    pr.stderr.on('data', d => { errBuf = (errBuf + d).slice(-3000); });
    return pr;
  };
  const swallow = s => s && s.on && s.on('error', () => {}); // EPIPE vb.

  // İstemci kopar/iptal ederse tüm alt süreçleri öldür (sızıntı yok)
  res.on('close', killAll);

  let last, mime, ext;
  if (p.q.kind === 'audio') {
    // yt-dlp (bestaudio) --pipe--> ffmpeg (mp3) --pipe--> response
    const y = track(spawn(config.ytdlp, yt.audioArgs(p.url)));
    const f = track(spawn(config.ffmpeg, yt.ffmpegMp3Args()));
    y.stdout.pipe(f.stdin);
    [y.stdout, f.stdin, f.stdout, y, f].forEach(swallow);
    last = f; mime = 'audio/mpeg'; ext = 'mp3';
  } else {
    // 2x yt-dlp (video-only + audio-only) --pipe:3/pipe:4--> ffmpeg (fragmented mp4) --> response
    const yv = track(spawn(config.ytdlp, yt.videoOnlyArgs(p.url, p.q.height, fmt)));
    const ya = track(spawn(config.ytdlp, yt.audioArgs(p.url)));
    const f = track(spawn(config.ffmpeg, yt.ffmpegMuxPipeArgs(),
      { stdio: ['ignore', 'pipe', 'pipe', 'pipe', 'pipe'] }));
    yv.stdout.pipe(f.stdio[3]);
    ya.stdout.pipe(f.stdio[4]);
    [yv.stdout, ya.stdout, f.stdio[3], f.stdio[4], f.stdout, yv, ya, f].forEach(swallow);
    last = f; mime = 'video/mp4'; ext = 'mp4';
  }

  // Gönderilen bayt -> yüzde (boyut tahmini yoksa pct=null: belirsiz çubuk + MB sayacı)
  let sent = 0;
  if (pid) {
    progress.set(pid, { stage: 'preparing', pct: 0, total: est });
    last.stdout.on('data', c => {
      sent += c.length;
      progress.set(pid, { stage: 'sending', bytes: sent, total: est, pct: est ? Math.min((sent / est) * 100, 99) : null });
    });
  }

  // İlk veri parçası gelene kadar header göndermiyoruz: hata olursa temiz JSON dönebiliriz.
  last.stdout.once('data', first => {
    started = true;
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Disposition': contentDisposition(info.title, ext),
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no', // nginx buffer kapat
    });
    res.write(first);
    last.stdout.pipe(res);
  });

  last.on('close', code => {
    if (res.writableEnded || res.destroyed) return;
    if (!started) {
      killAll();
      console.error('[tunnel] başlatılamadı:', errBuf);
      return next(new HttpError(502, 'err.tunnel'));
    }
    if (code !== 0) { // yarıda kesildi: istemci eksik dosyayı fark etsin
      if (pid) progress.fail(pid, 'err.tunnel');
      res.destroy();
    }
  });
}

// =====================================================================
// STRATEJİ B — İNDİR, BİRLEŞTİR, YOK ET
// =====================================================================
async function tempMux(res, p, info, fmt, est, pid, uid) {
  if (activeMux >= config.maxConcurrentMux) throw new HttpError(503, 'err.busyServer');
  activeMux++;
  await fsp.mkdir(config.tmpDir, { recursive: true });

  const id = crypto.randomUUID();
  let child = null, aborted = false, released = false, downloadComplete = false;

  const release = () => {
    if (!released) {
      released = true;
      activeMux--;
    }
  };

  // Hazırlık sırasında kullanıcı iptal ederse indirme sürecini durdur.
  const abortPreparation = () => {
    aborted = true;
    release();

    const wipe = () => yt.removeById(id);
    if (child && child.exitCode === null) {
      child.once('close', wipe);
      child.kill('SIGKILL');
    } else {
      wipe();
    }
  };

  res.on('finish', release);
  res.on('close', () => {
    release();
    // Tam dosya hazırlandıysa bağlantı kopsa bile dosyayı sakla.
    if (!res.writableFinished && !downloadComplete) abortPreparation();
  });

  try {
    if (pid) progress.set(pid, { stage: 'preparing', pct: 0, total: est });

    await yt.downloadMerged({
      url: p.url,
      height: p.q.height,
      fmt,
      id,
      estTotal: est,
      audio: p.q.kind === 'audio',
      onSpawn: c => (child = c),
      onProgress: u => pid && progress.set(pid, u),
    });

    if (aborted || res.destroyed) return;

    const file = await yt.findOutput(id);
    if (!file) throw new HttpError(502, 'err.noOutput');

    // Bu dosyayı yalnızca indirmeyi başlatan hesaba bağla.
    db.prepare(`
      INSERT INTO user_last_files (user_id, download_id, created_at)
      VALUES (?, ?, strftime('%s','now'))
      ON CONFLICT(user_id) DO UPDATE SET
        download_id = excluded.download_id,
        created_at = excluded.created_at
    `).run(uid, id);

    // 60 dakikalık saklama süresini dosyanın hazır olduğu andan başlat.
    const now = new Date();
    await fsp.utimes(file, now, now);
    downloadComplete = true;

    const st = await fsp.stat(file);
    const ext = file.split('.').pop();

    if (pid) progress.set(pid, { stage: 'sending', pct: 85, bytes: 0, total: st.size });

    res.writeHead(200, {
      'Content-Type': ext === 'mp4' ? 'video/mp4' : ext === 'mp3' ? 'audio/mpeg' : 'application/octet-stream',
      'Content-Length': st.size,
      'Content-Disposition': contentDisposition(info.title, ext),
      'Cache-Control': 'no-store',
    });

    let sent = 0;
    fs.createReadStream(file)
      .on('data', c => {
        sent += c.length;
        if (pid) progress.set(pid, { bytes: sent, pct: 85 + (sent / st.size) * 15 });
      })
      .on('error', async () => {
        await yt.removeById(id);
        if (!res.destroyed) res.destroy();
      })
      .pipe(res);

  } catch (e) {
    if (aborted) return;
    release();
    await yt.removeById(id);
    if (e instanceof HttpError) throw e;
    console.error('[mux] hata:', e.message);
    throw new HttpError(502, 'err.mux');
  }
}

// ---------- Transkript: videoyu indirmeden altyazıyı çıkarır (kotadan düşmez) ----------
const activeTranscripts = new Set();
async function transcript(req, res, next) {
  const uid = req.user.id;
  if (activeTranscripts.has(uid)) return next(new HttpError(429, 'err.trBusy'));
  activeTranscripts.add(uid);
  const id = crypto.randomUUID();
  try {
    const url = checkUrl(req.body).href;
    const want = req.body.lang ? String(req.body.lang) : '';
    if (want && !/^[A-Za-z0-9.-]{1,24}$/.test(want)) throw new HttpError(400, 'err.badLang');

    let inf;
    try { inf = await yt.getSubsInfo(url); }
    catch { throw new HttpError(502, 'err.info'); }
    if (config.maxDurationSec > 0 && inf.duration > config.maxDurationSec) throw new HttpError(400, 'err.tooLong');

    const tracks = yt.listTracks(inf);
    const track = yt.pickTrack(tracks, want, inf.language);
    if (!track) throw new HttpError(404, 'err.noSubs');

    let segments;
    try {
      if (track.translated) {
        // Çeviri: orijinal altyazıyı indir -> hedef dile çevir. Olmazsa YouTube'un çeviri parçasını dene.
        const src = yt.pickSource(tracks, inf.language);
        try {
          if (!src) throw new Error('kaynak altyazı yok');
          const base = yt.parseJson3(await yt.downloadSubs({ url, key: src.key || src.lang, id }));
          segments = await translator.translateSegments(base, track.lang, `${url}|${src.id}`);
        } catch (e) {
          console.error('[transcript] çeviri başarısız, YouTube çevirisi deneniyor:', e.message);
          if (!track.key) throw e;
          segments = yt.parseJson3(await yt.downloadSubs({ url, key: track.key, id: id + 'y' }));
        }
      } else {
        segments = yt.parseJson3(await yt.downloadSubs({ url, key: track.key || track.lang, id }));
      }
    } catch (e) { console.error('[transcript]', e.message); throw new HttpError(502, 'err.trFail'); }
    if (!segments.length) throw new HttpError(404, 'err.trEmpty');

    res.json({
      ok: true, title: inf.title || 'video', duration: inf.duration || 0,
      id: track.id, lang: track.lang, auto: track.auto, translated: !!track.translated,
      available: tracks.map(t => ({ id: t.id, lang: t.lang, auto: t.auto, translated: !!t.translated })),
      segments,
    });
  } catch (e) { next(e); }
  finally { activeTranscripts.delete(uid); yt.removeById(id); yt.removeById(id + 'y'); }
}

module.exports = { info, preflight, getProgress, download, cancel, transcript, HttpError };

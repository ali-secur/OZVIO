const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

// strategy: A = tünel (anında başlar), B = sunucuda hazırlanır (bekleme olur)
const QUALITIES = [
  { k: '144p',  label: '144p',    h: 144,  s: 'A' },
  { k: '240p',  label: '240p',    h: 240,  s: 'A' },
  { k: '360p',  label: '360p',    h: 360,  s: 'A' },
  { k: '480p',  label: '480p',    h: 480,  s: 'A' },
  { k: '720p',  label: '720p HD', h: 720,  s: 'A' },
  { k: '1080p', label: '1080p',   h: 1080, s: 'B' },
  { k: '1440p', label: '1440p',   h: 1440, s: 'B' },
  { k: '2160p', label: '4K',      h: 2160, s: 'B' },
];

let me = null, mode = 'video', quality = '720p';
let tgFlow = null; // Telegram giriş/kayıt isteği { rid, url, mode, started, state, timer }
let tr = null;     // son transkript sonucu
let vinfo = null;  // yapıştırılan videonun bilgisi { url, title, qualities, tiers, ... }

async function api(path, body, method) {
  let r;
  try {
    r = await fetch('/api/' + path, {
      method: method || (body ? 'POST' : 'GET'),
      headers: { 'Content-Type': 'application/json', 'X-Lang': LANG },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch { throw new Error(t('net_err')); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || 'Error'), { status: r.status });
  return d;
}

// ---------- küçük yardımcılar ----------
function say(text, ok = false) {
  const el = $('#msg');
  el.className = 'msg';
  el.textContent = text || '';
  if (!text) return;
  void el.offsetWidth; // animasyonu yeniden başlat
  el.className = 'msg show ' + (ok ? 'ok' : 'err');
}
const busy = (btn, on) => { btn.disabled = on; btn.classList.toggle('loading', on); };
const view = name => ['auth', 'app'].forEach(v => $('#view-' + v).classList.toggle('hidden', v !== name));
const fmtTime = s => {
  s = Math.floor(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0'), ss = String(x).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};
const fmtMB = b => (b >= 1e9 ? (b / 1e9).toFixed(2) + ' GB' : (b / 1e6).toFixed(b >= 1e8 ? 0 : 1) + ' MB');
const rid = () => [...crypto.getRandomValues(new Uint8Array(12))].map(x => (x % 36).toString(36)).join('');

// ---------- dil ----------
function renderAll() {
  applyI18n();
  setMode(mode);
  renderTg();
  if (me) renderApp();
  if (tr) renderTranscript(false);
  renderPreview();
  renderProgress();
}
$$('[data-lang]').forEach(b => (b.onclick = async () => {
  if (b.dataset.lang === LANG) return;
  setLangValue(b.dataset.lang);
  say('');
  renderAll();
  if (me) api('auth/lang', { lang: LANG }).catch(() => {}); // hesap + Telegram botu da aynı dile geçer
}));

// ---------- mod / kalite ----------
const lockedQ = q => me && me.quota.maxHeight > 0 && q.h > me.quota.maxHeight;
const missingQ = q => vinfo && vinfo.qualities && !vinfo.qualities.includes(q.k);
const usableQ = q => !lockedQ(q) && !missingQ(q);

function pickQuality() {
  const cur = QUALITIES.find(q => q.k === quality);
  if (cur && usableQ(cur)) return;
  const ok = QUALITIES.filter(usableQ);
  if (ok.length) quality = ok[ok.length - 1].k; // en yüksek kullanılabilir
}

function renderChips() {
  pickQuality();
  const box = $('#q-chips');
  box.innerHTML = '';
  QUALITIES.forEach(q => {
    const locked = lockedQ(q), missing = missingQ(q);
    const b = document.createElement('button');
    b.className = 'chip' + (q.k === quality ? ' active' : '') + (missing ? ' na' : '');
    b.disabled = locked || missing;
    b.title = missing ? t('chip_na') : locked ? t('chip_locked') : '';
    b.textContent = (locked && !missing ? '🔒 ' : '') + q.label;
    if (q.s === 'B' && !b.disabled) { const s = document.createElement('small'); s.textContent = t('chip_prep'); b.appendChild(s); }
    b.onclick = () => { quality = q.k; renderChips(); };
    box.appendChild(b);
  });
}

function setMode(m) {
  mode = m;
  $$('.tile').forEach(x => x.classList.toggle('active', x.dataset.mode === m));
  $('#q-wrap').classList.toggle('closed', m !== 'video');
  $('#btn-go .btn-label').textContent = t(m === 'transcript' ? 'btn_transcribe' : 'btn_download');
  if (m !== 'transcript') $('#tr-card').classList.add('hidden');
  else if (tr) $('#tr-card').classList.remove('hidden');
}
$$('.tile').forEach(x => (x.onclick = () => setMode(x.dataset.mode)));

function renderApp() {
  $('#u-name').textContent = me.username;
  const b = $('#u-badge');
  b.textContent = t(me.is_verified ? 'badge_ok' : 'badge_limited');
  b.className = 'badge' + (me.is_verified ? ' ok' : '');
  $('#user-chip').classList.remove('hidden');
  $('#u-quota').textContent = t('quota_line', { used: me.quota.used, limit: me.quota.limit === 0 ? '∞' : me.quota.limit, max: me.quota.maxHeight === 0 ? '∞' : me.quota.maxHeight });
  renderChips();
  view('app');
}

async function refresh() {
  try { me = await api('auth/me'); renderApp(); return true; }
  catch { me = null; $('#user-chip').classList.add('hidden'); view('auth'); return false; }
}

// ---------- Video önizleme (link yapıştırılınca) ----------
let lookupTimer, lookupSeq = 0, pvState = 'hidden'; // hidden | loading | ok | bad
let pvError = '';

function renderPreview() {
  const box = $('#preview');
  box.className = 'preview' + (pvState === 'loading' ? ' skel' : pvState === 'bad' ? ' bad' : '');
  box.classList.toggle('hidden', pvState === 'hidden');
  if (pvState === 'loading') {
    $('#pv-title').textContent = 'xxxxxxxxxxxxxxxx'; $('#pv-meta').textContent = 'xxxxxxxx'; $('#pv-q').textContent = '';
    $('#pv-img').classList.remove('on');
  } else if (pvState === 'bad') {
    $('#pv-title').textContent = pvError; $('#pv-meta').textContent = ''; $('#pv-q').textContent = '';
  } else if (pvState === 'ok' && vinfo) {
    $('#pv-title').textContent = vinfo.title;
    $('#pv-meta').textContent = vinfo.duration ? fmtTime(vinfo.duration) : '';
    const tiers = (vinfo.tiers || []).map(h => (h === 2160 ? '4K' : h + 'p'));
    $('#pv-q').textContent = tiers.length ? t('pv_avail', { list: tiers.join(' · ') }) : t('pv_audio_only');
    const img = $('#pv-img');
    if (vinfo.thumbnail) { img.onload = () => img.classList.add('on'); img.src = vinfo.thumbnail; } else img.removeAttribute('src');
  }
}

function looksLikeUrl(v) { try { const u = new URL(v); return /^https?:$/.test(u.protocol) && u.hostname.includes('.'); } catch { return false; } }

async function lookup(url) {
  const seq = ++lookupSeq;
  vinfo = null; pvState = 'loading'; renderPreview(); renderChips();
  try {
    const d = await api('download/info', { url });
    if (seq !== lookupSeq) return;
    vinfo = { ...d, url };
    pvState = 'ok';
  } catch (e) {
    if (seq !== lookupSeq) return;
    vinfo = null; pvState = 'bad'; pvError = e.message;
    if (e.status === 401) { me = null; view('auth'); }
  }
  renderPreview(); renderChips();
}

function onUrlChange() {
  clearTimeout(lookupTimer);
  const v = $('#d-url').value.trim();
  if (!looksLikeUrl(v)) { lookupSeq++; vinfo = null; pvState = 'hidden'; renderPreview(); renderChips(); return; }
  if (vinfo && vinfo.url === new URL(v).href) return;
  lookupTimer = setTimeout(() => lookup(v), 450);
}
$('#d-url').addEventListener('input', onUrlChange);
$('#d-url').addEventListener('paste', () => setTimeout(onUrlChange, 0));

// ---------- Telegram ile giriş / kayıt ----------
const tgButtons = on => ['#btn-tg-login', '#btn-tg-register'].forEach(id => ($(id).disabled = on));

function renderTg() {
  const box = $('#tg-wait');
  if (!tgFlow) { box.classList.add('hidden'); tgButtons(false); return; }
  const confirming = tgFlow.state === 'confirming';
  $('#tg-wait-title').textContent = t(confirming ? 'tg_wait_confirm' : 'tg_wait_start');
  $('#tg-wait-sub').textContent = t(confirming ? 'tg_wait_confirm_sub' : 'tg_wait_start_sub');
  $('#tg-open').href = tgFlow.url;
  box.classList.remove('hidden');
  tgButtons(true);
}

function stopTg() {
  if (tgFlow) clearTimeout(tgFlow.timer);
  tgFlow = null;
  renderTg();
}

async function tgStart(mode) {
  if (tgFlow) return;
  say('');
  // Pencereyi tıklama anında aç (aksi halde açılır pencere engelleyici devreye girer)
  const w = window.open('', '_blank');
  tgButtons(true);
  try {
    const d = await api('auth/tg/start', { mode, lang: LANG });
    tgFlow = { rid: d.rid, url: d.url, mode, started: Date.now(), state: 'pending', timer: null };
    if (w) { try { w.opener = null; } catch {} w.location.href = d.url; }
    renderTg();
    pollTg();
  } catch (e) {
    if (w) w.close();
    tgButtons(false);
    say(e.message);
  }
}

async function pollTg() {
  const f = tgFlow;
  if (!f) return;
  let d = null;
  try { d = await api('auth/tg/status?rid=' + encodeURIComponent(f.rid)); } catch { /* ağ hatası: tekrar dene */ }
  if (tgFlow !== f) return; // vazgeçildi
  if (d) {
    if (d.status === 'approved') {
      stopTg(); say('');
      if (await refresh() && me) api('auth/lang', { lang: LANG }).catch(() => {});
      return;
    }
    if (d.status === 'pending' || d.status === 'confirming') {
      if (f.state !== d.status) { f.state = d.status; renderTg(); }
    } else {
      stopTg();
      say(t({ denied: 'tg_denied', noaccount: 'tg_noaccount' }[d.status] || 'tg_expired'));
      return;
    }
  }
  if (Date.now() - f.started > 10 * 60 * 1000) { stopTg(); return say(t('tg_expired')); }
  f.timer = setTimeout(pollTg, 2000);
}

$('#btn-tg-login').onclick = () => tgStart('login');
$('#btn-tg-register').onclick = () => tgStart('register');
$('#tg-cancel').onclick = stopTg;

$('#btn-logout').onclick = async () => {
  await api('auth/logout', {}).catch(() => {});
  stopProgress(true);
  me = null; tr = null; vinfo = null; pvState = 'hidden'; renderPreview();
  $('#tr-card').classList.add('hidden');
  $('#user-chip').classList.add('hidden'); view('auth'); say('');
};

// =====================================================================
// İLERLEME (yüzde)
// =====================================================================
const P = { cancelled: false, on: false, pid: null, timer: null, frame: 0, shown: 0, target: 0, state: null, frameEl: null, miss: 0, started: 0, title: '', lastBytes: 0, lastAt: 0, speed: 0 };

function renderProgress() {
  const box = $('#prog');
  if (!P.on) return box.classList.add('hidden');
  box.classList.remove('hidden');
  const s = P.state || { stage: 'queued', pct: 0 };
  const stage = s.stage;
  box.classList.toggle('done', stage === 'done');
  box.classList.toggle('err', stage === 'error' || stage === 'cancelled');
  const indet = s.pct == null && !['done', 'error', 'cancelled'].includes(stage);
  box.classList.toggle('indet', indet);

  $('#prog-title').textContent = s.title || P.title || '';
  const label = { queued: 'st_queued', preparing: 'st_preparing', merging: 'st_merging', sending: 'st_sending',
    done: 'st_done', cancelled: 'st_cancelled', error: 'st_error' }[stage] || 'st_queued';
  $('#prog-stage').textContent = stage === 'error' && s.error ? s.error : t(label);

  let sub = '';
  if (s.total && s.bytes && stage !== 'done') sub = `${fmtMB(s.bytes)} / ~${fmtMB(s.total)}`;
  else if (s.bytes && stage === 'sending') sub = fmtMB(s.bytes);
  else if (stage === 'preparing' && P.strategyB) sub = t('prog_hint_b');

  if (stage === 'sending' && P.speed > 0) {
    const mbps = (P.speed / 1048576).toFixed(2);
    sub += `${sub ? ' · ' : ''}${mbps} MB/sn`;

    if (s.total && s.bytes < s.total) {
      const seconds = Math.ceil((s.total - s.bytes) / P.speed);
      const eta = seconds >= 60
        ? `${Math.floor(seconds / 60)} dk ${seconds % 60} sn`
        : `${seconds} sn`;
      sub += ` · ~${eta} kaldı`;
    }
  }

  $('#prog-sub').textContent = sub;
  P.target = stage === 'done' ? 100 : (typeof s.pct === 'number' ? s.pct : P.shown);
  if (!P.frame) tick();
}

// Yüzde rakamı akıcı şekilde yukarı sayar, çubuk CSS geçişiyle kayar
function tick() {
  const d = P.target - P.shown;
  P.shown = Math.abs(d) < 0.15 ? P.target : P.shown + d * 0.12;
  const v = Math.round(P.shown);
  $('#prog-pct').textContent = $('#prog').classList.contains('indet') ? '…' : v + '%';
  $('#prog-fill').style.transform = `scaleX(${Math.max(0, Math.min(1, P.shown / 100))})`;
  P.frame = P.shown === P.target ? 0 : requestAnimationFrame(tick);
}

function stopProgress(hide) {
  clearTimeout(P.timer); P.timer = null;
  if (hide) { P.on = false; P.state = null; renderProgress(); }
}

async function pollProgress() {
  if (!P.on || P.cancelled) return;
  const myPid = P.pid;
  let d = null;
  try { d = await api('progress/' + myPid); P.miss = 0; }
  catch (e) {
    if (e.status === 401) { stopProgress(true); me = null; view('auth'); return finishDownload(); }
    if (e.status === 404 && ++P.miss > 25) { stopProgress(true); return finishDownload(); }
  }
  if (P.cancelled || P.pid !== myPid) return; // yoklama sürerken iptal edildi / yeni indirme başladı
  if (d) {
    const now = Date.now();

    if (d.stage === 'sending' && Number.isFinite(d.bytes)) {
      if (!P.lastAt) {
        P.lastAt = now;
        P.lastBytes = d.bytes;
      } else if (d.bytes > P.lastBytes) {
        const elapsed = (now - P.lastAt) / 1000;
        if (elapsed > 0) {
          const sample = (d.bytes - P.lastBytes) / elapsed;
          P.speed = P.speed > 0
            ? P.speed * 0.65 + sample * 0.35
            : sample;
        }
        P.lastBytes = d.bytes;
        P.lastAt = now;
      }
    } else if (d.stage !== 'sending') {
      P.lastBytes = 0;
      P.lastAt = 0;
      P.speed = 0;
    }

    P.state = d;
    renderProgress();
    if (['done', 'error', 'cancelled'].includes(d.stage)) {
      if (d.stage === 'error' && d.error) say(d.error);
      return finishDownload();
    }
  }
  if (Date.now() - P.started > 50 * 60 * 1000) return finishDownload();
  P.timer = setTimeout(pollProgress, 600);
}

function finishDownload() {
  stopProgress(false);
  busy($('#btn-go'), false);
  setTimeout(() => { const f = $('#dl-frame'); if (f) f.remove(); }, 4000);
  refresh();
}

// ---------- İndirme ----------
async function startDownload(url) {
  const q = mode === 'mp3' ? 'mp3' : quality;
  const pid = rid();
  Object.assign(P, { cancelled: false, on: true, pid, shown: 0, target: 0, state: { stage: 'queued', pct: 0 }, miss: 0, started: Date.now(), lastBytes: 0, lastAt: 0, speed: 0, title: vinfo ? vinfo.title : '', strategyB: false });
  renderProgress();
  $('#prog-stage').textContent = t('st_checking');
  const info = await api('download/preflight', { url, quality: q, pid });
  if (P.cancelled || P.pid !== pid) return; // ön kontrol sürerken iptal edildi
  P.strategyB = info.strategy === 'B';
  P.title = info.title;

  // Gizli iframe: hata olsa bile sayfa değişmez, başarılıysa tarayıcı dosyayı indirir
  const old = $('#dl-frame'); if (old) old.remove();
  const f = document.createElement('iframe');
  f.id = 'dl-frame'; f.style.display = 'none';
  f.src = '/api/download?' + new URLSearchParams({ url, quality: q, pid });
  document.body.appendChild(f);
  clearTimeout(P.timer);
  pollProgress();
}

// ---------- İptal ----------
$('#prog-cancel').onclick = async () => {
  if (!P.on || P.cancelled) return;
  P.cancelled = true;
  const btn = $('#prog-cancel'); btn.disabled = true;
  const f = $('#dl-frame');
  if (f) { f.src = 'about:blank'; f.remove(); }                 // tarayıcı isteği keser
  api('download/cancel', { pid: P.pid }).catch(() => {});         // sunucu yt-dlp/ffmpeg'i öldürür
  P.state = { ...(P.state || {}), stage: 'cancelled' };
  renderProgress();
  finishDownload();
  btn.disabled = false;
};

// ---------- Transkript ----------
async function loadTranscript(url, lang) {
  say('');
  if (lang) say(t('tr_fetching'), true); // çeviri birkaç saniye sürebilir
  const d = await api('download/transcript', { url, lang: lang || undefined });
  say('');
  tr = { ...d, url };
  renderTranscript(true);
  $('#tr-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderTranscript(fresh) {
  if (!tr) return;
  const card = $('#tr-card');
  card.classList.remove('hidden');
  if (fresh) { card.style.animation = 'none'; void card.offsetWidth; card.style.animation = ''; }
  $('#tr-title').textContent = tr.title;
  const kind = t(tr.translated ? 'tr_kind_tr' : tr.auto ? 'tr_kind_auto' : 'tr_kind_manual');
  $('#tr-meta').textContent = t('tr_meta', { n: tr.segments.length, dur: fmtTime(tr.duration), kind });

  const sel = $('#tr-lang');
  sel.innerHTML = '';
  tr.available.forEach(x => {
    const o = document.createElement('option');
    o.value = x.id;
    o.textContent = x.lang.toUpperCase() + (x.translated ? ` (${t('tr_translated')})` : x.auto ? ` (${t('tr_auto')})` : '');
    if (x.id === tr.id) o.selected = true;
    sel.appendChild(o);
  });
  sel.classList.toggle('hidden', tr.available.length < 2);
  drawRows();
}

function tsLink(s) {
  try {
    const u = new URL(tr.url);
    if (/youtube\.com$|youtu\.be$/.test(u.hostname.replace(/^www\.|^m\./, ''))) {
      u.searchParams.set('t', Math.floor(s) + 's');
      return u.href;
    }
  } catch {}
  return null;
}

function drawRows() {
  const body = $('#tr-body');
  const q = $('#tr-search').value.trim().toLowerCase();
  body.classList.toggle('no-ts', !$('#tr-ts').checked);
  body.innerHTML = '';
  const frag = document.createDocumentFragment();
  let n = 0;
  tr.segments.forEach(seg => {
    if (q && !seg.text.toLowerCase().includes(q)) return;
    const row = document.createElement('div');
    row.className = 'row';
    row.style.setProperty('--i', Math.min(n++, 25));
    const link = tsLink(seg.s);
    const ts = document.createElement(link ? 'a' : 'span');
    ts.className = 'ts'; ts.textContent = fmtTime(seg.s);
    if (link) { ts.href = link; ts.target = '_blank'; ts.rel = 'noopener'; }
    const tx = document.createElement('span');
    if (q) {
      const i = seg.text.toLowerCase().indexOf(q);
      tx.append(seg.text.slice(0, i));
      const m = document.createElement('mark'); m.textContent = seg.text.slice(i, i + q.length);
      tx.append(m, seg.text.slice(i + q.length));
    } else tx.textContent = seg.text;
    row.append(ts, tx);
    frag.appendChild(row);
  });
  if (!n) { const e = document.createElement('div'); e.className = 'empty'; e.textContent = t('tr_none'); frag.appendChild(e); }
  body.appendChild(frag);
}

const plainText = withTs => tr.segments.map(s => (withTs ? `[${fmtTime(s.s)}] ` : '') + s.text).join('\n');
function srtTime(s) {
  const ms = Math.round((s % 1) * 1000), x = Math.floor(s);
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${p(Math.floor(x / 3600))}:${p(Math.floor((x % 3600) / 60))}:${p(x % 60)},${p(ms, 3)}`;
}
function srtText() {
  return tr.segments.map((s, i) => {
    const next = tr.segments[i + 1];
    let end = s.s + (s.d || 2);
    if (next && next.s > s.s && next.s < end) end = next.s;
    return `${i + 1}\n${srtTime(s.s)} --> ${srtTime(end)}\n${s.text}\n`;
  }).join('\n');
}
function saveFile(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name.replace(/[^\p{L}\p{N}\s._-]/gu, '').trim().slice(0, 80) || 'transcript';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

$('#tr-search').oninput = () => tr && drawRows();
$('#tr-ts').onchange = () => tr && drawRows();
$('#tr-lang').onchange = async e => {
  const sel = e.target; sel.disabled = true;
  try { await loadTranscript(tr.url, sel.value); }
  catch (err) { say(err.message); renderTranscript(false); } // hata olursa seçim eski haline döner
  finally { sel.disabled = false; }
};
$('#tr-copy').onclick = async () => {
  try { await navigator.clipboard.writeText(plainText($('#tr-ts').checked)); say(t('copied'), true); }
  catch { say(t('copy_fail')); }
};
$('#tr-txt').onclick = () => saveFile(tr.title + '.txt', plainText($('#tr-ts').checked), 'text/plain;charset=utf-8');
$('#tr-srt').onclick = () => saveFile(tr.title + '.srt', srtText(), 'application/x-subrip;charset=utf-8');

// ---------- Ana buton ----------
async function go() {
  const url = $('#d-url').value.trim();
  if (!url) return say(t('paste_url'));
  const btn = $('#btn-go');
  if (btn.disabled) return;
  busy(btn, true); say('');
  let keepBusy = false;
  try {
    if (mode === 'transcript') await loadTranscript(url);
    else { await startDownload(url); keepBusy = true; } // buton, ilerleme bitince açılır
  } catch (e) {
    stopProgress(true);
    say(e.message);
    if (e.status === 401) { me = null; view('auth'); }
  } finally { if (!keepBusy) busy(btn, false); }
}
$('#btn-go').onclick = go;
$('#d-url').addEventListener('keydown', e => e.key === 'Enter' && go());

// ---------- Başlangıç ----------
(async () => {
  applyI18n();
  setMode('video');
  await refresh();
})();

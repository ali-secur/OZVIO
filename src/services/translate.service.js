/**
 * Transkript çevirisi (TR <-> EN ve diğer diller).
 * YouTube'un kendi "çevrilmiş altyazı" parçası çoğu videoda boş/özgün dilde dönebildiği için
 * çeviri sunucuda, orijinal altyazı satırlarından yapılır. Ek API anahtarı gerekmez.
 *
 * Satırlar ~1500 karakterlik gruplar halinde "\n" ile birleştirilip çevrilir; satır sayısı
 * tutmazsa o grup satır satır çevrilir (zaman damgaları hep korunur).
 */
const ENDPOINT = 'https://translate.googleapis.com/translate_a/single';
const CHUNK_CHARS = 1500;
const CONCURRENCY = 4;
const MAX_SEGMENTS = 4000;

const cache = new Map(); // key -> { at, texts }
const CACHE_TTL = 30 * 60 * 1000;
const CACHE_MAX = 40;

async function callApi(text, target) {
  const u = new URL(ENDPOINT);
  u.search = new URLSearchParams({ client: 'gtx', sl: 'auto', tl: target, dt: 't', q: text }).toString();
  let lastErr;
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!r.ok) throw new Error('translate http ' + r.status);
      const j = await r.json();
      if (!Array.isArray(j) || !Array.isArray(j[0])) throw new Error('translate bad response');
      return j[0].map(p => (p && p[0]) || '').join('');
    } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 400)); }
  }
  throw lastErr;
}

async function translateLines(lines, target) {
  const joined = lines.join('\n');
  try {
    const out = (await callApi(joined, target)).split('\n').map(x => x.trim());
    if (out.length === lines.length) return out;
  } catch { /* satır satır dene */ }
  const res = [];
  for (const l of lines) res.push((await callApi(l, target)).replace(/\s*\n\s*/g, ' ').trim());
  return res;
}

// segments: [{ s, d, text }] -> aynı zaman damgalı, çevrilmiş [{ s, d, text }]
async function translateSegments(segments, target, cacheKey) {
  if (!/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(target)) throw new Error('bad target');
  if (segments.length > MAX_SEGMENTS) throw new Error('too many segments');
  const key = cacheKey && `${cacheKey}|${target}`;
  const hit = key && cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return segments.map((s, i) => ({ ...s, text: hit.texts[i] || s.text }));

  // gruplara böl
  const groups = []; let cur = [], len = 0;
  segments.forEach((s, i) => {
    if (len + s.text.length > CHUNK_CHARS && cur.length) { groups.push(cur); cur = []; len = 0; }
    cur.push(i); len += s.text.length + 1;
  });
  if (cur.length) groups.push(cur);

  const texts = new Array(segments.length).fill('');
  let next = 0;
  const worker = async () => {
    while (next < groups.length) {
      const idx = groups[next++];
      const out = await translateLines(idx.map(i => segments[i].text), target);
      idx.forEach((i, k) => { texts[i] = out[k] || segments[i].text; });
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, groups.length) }, worker));

  if (key) {
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(key, { at: Date.now(), texts });
  }
  return segments.map((s, i) => ({ ...s, text: texts[i] || s.text }));
}

module.exports = { translateSegments };

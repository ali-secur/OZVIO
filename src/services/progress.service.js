/**
 * İndirme ilerleme kayıtları (bellekte). İstemci pid üretir, preflight kaydı açar,
 * indirme sırasında sunucu günceller, istemci /api/progress/:pid ile okur.
 *
 * stage: queued | preparing | merging | sending | done | error | cancelled
 * pct  : 0-100 veya null (boyut bilinmiyorsa belirsiz çubuk)
 */
const jobs = new Map();
const listeners = new Set();

function publish(pid, job) {
  const snapshot = { pid, ...job };
  for (const fn of listeners) {
    try { fn(snapshot); } catch (e) {
      console.error('[progress] listener error:', e.message);
    }
  }
}

function subscribe(fn) {
  if (typeof fn !== 'function') return () => {};
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const TTL_MS = 20 * 60 * 1000;

const validPid = pid => typeof pid === 'string' && /^[a-zA-Z0-9]{8,40}$/.test(pid);

function create(pid, uid, title) {
  if (!validPid(pid)) return null;
  const j = { uid, title: title || '', stage: 'queued', pct: 0, bytes: 0, total: 0, error: null, at: Date.now() };
  jobs.set(pid, j);
  publish(pid, j);
  return j;
}

function set(pid, patch) {
  const j = jobs.get(pid);
  if (!j) return;
  // done/error/cancelled sonrası geri dönüş yok
  if (['done', 'error', 'cancelled'].includes(j.stage)) return;
  Object.assign(j, patch, { at: Date.now() });
  if (typeof j.pct === 'number') j.pct = Math.max(0, Math.min(100, Math.round(j.pct * 10) / 10));
  publish(pid, j);
}

function fail(pid, key, vars) { set(pid, { stage: 'error', error: { key, vars } }); }
function done(pid) { set(pid, { stage: 'done', pct: 100 }); }
function cancel(pid) { set(pid, { stage: 'cancelled' }); }

// Kullanıcı iptali: indirme bu pid için bir iptal fonksiyonu kaydeder (yanıtı keser -> alt süreçler ölür)
const cancelers = new Map();
function onCancel(pid, fn) { if (pid) cancelers.set(pid, fn); }
function offCancel(pid) { if (pid) cancelers.delete(pid); }
function requestCancel(pid, uid) {
  const j = get(pid, uid);
  if (!j) return false;
  if (['done', 'error', 'cancelled'].includes(j.stage)) return true;
  cancel(pid);
  const fn = cancelers.get(pid);
  cancelers.delete(pid);
  if (fn) { try { fn(); } catch { /* yoksay */ } }
  return true;
}

function get(pid, uid) {
  const j = jobs.get(pid);
  return j && j.uid === uid ? j : null;
}

setInterval(() => {
  const cut = Date.now() - TTL_MS;
  for (const [k, j] of jobs) if (j.at < cut) { jobs.delete(k); cancelers.delete(k); }
}, 60 * 1000).unref();

module.exports = { validPid, create, set, fail, done, cancel, get, onCancel, offCancel, requestCancel, subscribe };

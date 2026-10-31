/**
 * Hazır indirme dosyalarını ve yarım kalmış artıkları, son değişikliklerinden
 * 60 dakika sonra siler. Kontrol her dakika yapılır.
 */
const cron = require('node-cron');
const fsp = require('fs').promises;
const path = require('path');
const config = require('../config');

const MAX_AGE_MS = 60 * 60 * 1000;

async function sweep() {
  let entries;
  try { entries = await fsp.readdir(config.tmpDir); }
  catch { return; } // klasör henüz yok

  let removed = 0;
  for (const name of entries) {
    const full = path.join(config.tmpDir, name);
    try {
      const st = await fsp.stat(full);
      if (Date.now() - st.mtimeMs > MAX_AGE_MS) {
        await fsp.rm(full, { recursive: true, force: true });
        removed++;
      }
    } catch { /* başka süreç silmiş olabilir */ }
  }
  if (removed) console.log(`[cleanup] ${removed} eski dosya silindi`);
}

function startCleanup() {
  fsp.mkdir(config.tmpDir, { recursive: true }).catch(() => {});
  sweep();                                  // açılışta bir kez
  cron.schedule('* * * * *', sweep);     // her 30 dakikada bir
  console.log('[cleanup] cron aktif (1 dk kontrol / 60 dk saklama)');
}

module.exports = { startCleanup, sweep };

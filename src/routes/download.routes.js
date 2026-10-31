const express = require('express');
const requireAuth = require('../middleware/auth');
const ctrl = require('../controllers/download.controller');

const router = express.Router();
router.post('/info', requireAuth, ctrl.info);               // yapıştırınca: başlık + videonun desteklediği kaliteler
router.post('/preflight', requireAuth, ctrl.preflight);     // doğrula + başlık + kota + ilerleme kaydı
router.post('/cancel', requireAuth, ctrl.cancel);           // indirmeyi iptal et (pid ile)
router.post('/transcript', requireAuth, ctrl.transcript);   // altyazı -> metin
router.get('/', requireAuth, ctrl.download);                // asıl indirme (A veya B)
module.exports = router;

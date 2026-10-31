// OZVIO çok dilli arayüz. Kullanıcı seçimi saklanır; ilk açılışta tarayıcı dili algılanır.
const I18N = {
  tr: {
    page_title: 'Video İndir',
    title: 'Video İndir',
    sub: 'YouTube, Instagram, TikTok, X ve daha fazlasından videoyu indir, sesini al ya da konuşmasını metne çevir.',
    url_ph: 'Video bağlantınızı buraya yapıştırın',
    btn_download: 'İndir',
    btn_transcribe: 'Metne çevir',
    btn_cancel: 'İptal',
    quota_line: 'Bugün {used}/{limit} indirme · en yüksek kalite {max}p · transkript kotadan düşmez',
    mode_video: 'Video (MP4)',
    mode_mp3: 'Ses (MP3)',
    mode_tr: 'Transkript',
    logout: 'Çıkış',
    auth_hint: 'Şifre yok: Telegram ile giriş yaparsın.',
    tg_login: 'Telegram ile giriş yap',
    tg_register: 'Telegram ile kayıt ol',
    tg_wait_start: 'Telegram açıldı: Başlat\'a bas',
    tg_wait_start_sub: 'Bot mesajı gelince bu sayfa kendiliğinden devam eder.',
    tg_wait_confirm: 'Telegram\'da girişi onayla',
    tg_wait_confirm_sub: 'Bot sana IP ve cihaz bilgisiyle bir onay mesajı gönderdi.',
    tg_open_again: 'Telegram\'ı tekrar aç',
    tg_cancel: 'Vazgeç',
    tg_denied: 'Giriş Telegram\'da reddedildi',
    tg_noaccount: 'Bu Telegram hesabıyla kayıt yok, önce "Telegram ile kayıt ol" de',
    tg_expired: 'İstek zaman aşımına uğradı, tekrar dene',
    badge_ok: 'Doğrulanmış',
    badge_limited: 'Limitli',
    chip_prep: 'hazırlanır',
    chip_na: 'Bu videoda yok',
    chip_locked: 'Telegram doğrulaması gerekli',
    pv_checking: 'Video kontrol ediliyor…',
    pv_avail: 'Bu videoda var: {list}',
    pv_audio_only: 'Yalnızca ses indirilebilir',
    st_queued: 'Başlatılıyor…',
    st_checking: 'Kontrol ediliyor…',
    st_preparing: 'Sunucuda hazırlanıyor',
    st_merging: 'Video ve ses birleştiriliyor',
    st_sending: 'İndiriliyor',
    st_done: 'Tamamlandı — dosya tarayıcına gönderildi',
    st_cancelled: 'İptal edildi',
    st_error: 'Hata',
    prog_hint_b: 'Yüksek kalite sunucuda hazırlanıyor, bu sayfayı kapatma.',
    paste_url: 'Bağlantıyı yapıştır',
    net_err: 'Bağlantı hatası, tekrar dene',
    copied: 'Kopyalandı',
    copy_fail: 'Kopyalanamadı',
    tr_fetching: 'Altyazı alınıyor…',
    tr_search: 'Metinde ara…',
    tr_time: 'Zaman',
    tr_copy: 'Kopyala',
    tr_meta: '{n} satır · {dur} · {kind}',
    tr_kind_manual: 'yazılmış altyazı',
    tr_kind_auto: 'otomatik altyazı',
    tr_kind_tr: 'otomatik çeviri',
    tr_none: 'Sonuç yok',
    tr_auto: 'otomatik',
    tr_translated: 'çeviri',
  },
  en: {
    page_title: 'Video Downloader',
    title: 'Video Downloader',
    sub: 'Download videos from YouTube, Instagram, TikTok, X and more, grab the audio, or turn the speech into text.',
    url_ph: 'Paste your video link here',
    btn_download: 'Download',
    btn_transcribe: 'Get text',
    btn_cancel: 'Cancel',
    quota_line: 'Today {used}/{limit} downloads · max quality {max}p · transcripts are free',
    mode_video: 'Video (MP4)',
    mode_mp3: 'Audio (MP3)',
    mode_tr: 'Transcript',
    logout: 'Sign out',
    auth_hint: 'No password: you sign in with Telegram.',
    tg_login: 'Sign in with Telegram',
    tg_register: 'Sign up with Telegram',
    tg_wait_start: 'Telegram opened: press Start',
    tg_wait_start_sub: 'This page continues on its own once the bot replies.',
    tg_wait_confirm: 'Approve the sign-in in Telegram',
    tg_wait_confirm_sub: 'The bot sent you a confirmation with the IP and device details.',
    tg_open_again: 'Open Telegram again',
    tg_cancel: 'Cancel',
    tg_denied: 'The sign-in was denied in Telegram',
    tg_noaccount: 'No account for this Telegram user, use "Sign up with Telegram" first',
    tg_expired: 'The request timed out, please try again',
    badge_ok: 'Verified',
    badge_limited: 'Limited',
    chip_prep: 'prepared on server',
    chip_na: 'Not in this video',
    chip_locked: 'Telegram verification required',
    pv_checking: 'Checking video…',
    pv_avail: 'Available for this video: {list}',
    pv_audio_only: 'Only audio can be downloaded',
    st_queued: 'Starting…',
    st_checking: 'Checking…',
    st_preparing: 'Preparing on the server',
    st_merging: 'Merging video and audio',
    st_sending: 'Downloading',
    st_done: 'Done — the file was sent to your browser',
    st_cancelled: 'Cancelled',
    st_error: 'Error',
    prog_hint_b: 'High quality is prepared on the server, keep this page open.',
    paste_url: 'Paste a link first',
    net_err: 'Connection error, please try again',
    copied: 'Copied',
    copy_fail: 'Could not copy',
    tr_fetching: 'Fetching subtitles…',
    tr_search: 'Search in text…',
    tr_time: 'Time',
    tr_copy: 'Copy',
    tr_meta: '{n} lines · {dur} · {kind}',
    tr_kind_manual: 'written subtitles',
    tr_kind_auto: 'auto-generated subtitles',
    tr_kind_tr: 'auto translation',
    tr_none: 'No results',
    tr_auto: 'auto',
    tr_translated: 'translated',
  },
};

const SUPPORTED_LANGS = ['tr', 'en', 'ru', 'de', 'ar', 'ku'];

function detectLang() {
  const candidates = Array.isArray(navigator.languages) && navigator.languages.length
    ? navigator.languages
    : [navigator.language || 'tr'];

  for (const candidate of candidates) {
    const code = String(candidate).toLowerCase().split('-')[0];
    if (SUPPORTED_LANGS.includes(code)) return code;
  }
  return 'tr';
}

let LANG = '';
try { LANG = localStorage.getItem('lang') || ''; } catch {}
if (!SUPPORTED_LANGS.includes(LANG)) LANG = detectLang();

// Eksik çeviri anahtarlarında İngilizce, ardından Türkçe yedek kullanılır.
I18N.ru = {
  page_title:'OZVIO — Скачать видео', title:'Скачать видео', sub:'Быстрое скачивание видео',
  url_ph:'Вставьте ссылку на видео', btn_download:'Скачать', btn_transcribe:'Субтитры',
  btn_cancel:'Отмена', quota_line:'Оставшийся лимит', mode_video:'Видео', mode_mp3:'MP3',
  mode_tr:'Субтитры', logout:'Выйти', auth_hint:'Войдите через Telegram',
  tg_login:'Войти через Telegram', tg_register:'Регистрация через Telegram',
  tg_wait_start:'Откройте Telegram и нажмите Start', tg_wait_start_sub:'Ожидание подтверждения',
  tg_wait_confirm:'Подтвердите вход в Telegram', tg_wait_confirm_sub:'Ожидание подтверждения',
  tg_open_again:'Открыть снова', tg_cancel:'Отменить', tg_denied:'Вход отклонён',
  tg_noaccount:'Аккаунт не найден', tg_expired:'Срок действия истёк',
  badge_ok:'Активен', badge_limited:'Ограничен', chip_prep:'Подготовка',
  chip_na:'Недоступно', chip_locked:'Заблокировано', pv_checking:'Проверка видео…',
  pv_avail:'Доступно в этом видео: {list}', pv_audio_only:'Только аудио',
  st_queued:'В очереди', st_checking:'Проверка', st_preparing:'Подготовка',
  st_merging:'Обработка видео', st_sending:'Отправка', st_done:'Готово',
  st_cancelled:'Отменено', st_error:'Ошибка', prog_hint_b:'Не закрывайте эту страницу',
  paste_url:'Сначала вставьте ссылку', net_err:'Ошибка соединения, попробуйте снова',
  copied:'Скопировано', copy_fail:'Не удалось скопировать',
  tr_fetching:'Загрузка субтитров…', tr_search:'Поиск в тексте…', tr_time:'Время',
  tr_copy:'Копировать', tr_meta:'{n} строк · {dur} · {kind}',
  tr_kind_manual:'ручные субтитры', tr_kind_auto:'автоматические субтитры',
  tr_kind_tr:'автоматический перевод', tr_none:'Ничего не найдено',
  tr_auto:'авто', tr_translated:'переведено'
};

I18N.de = {
  page_title:'OZVIO — Video herunterladen', title:'Video herunterladen', sub:'Videos schnell herunterladen',
  url_ph:'Videolink einfügen', btn_download:'Herunterladen', btn_transcribe:'Untertitel',
  btn_cancel:'Abbrechen', quota_line:'Verbleibendes Kontingent', mode_video:'Video',
  mode_mp3:'MP3', mode_tr:'Untertitel', logout:'Abmelden', auth_hint:'Mit Telegram anmelden',
  tg_login:'Mit Telegram anmelden', tg_register:'Mit Telegram registrieren',
  tg_wait_start:'Telegram öffnen und Start drücken', tg_wait_start_sub:'Warte auf Bestätigung',
  tg_wait_confirm:'Anmeldung in Telegram bestätigen', tg_wait_confirm_sub:'Warte auf Bestätigung',
  tg_open_again:'Erneut öffnen', tg_cancel:'Abbrechen', tg_denied:'Anmeldung abgelehnt',
  tg_noaccount:'Konto nicht gefunden', tg_expired:'Sitzung abgelaufen',
  badge_ok:'Aktiv', badge_limited:'Eingeschränkt', chip_prep:'Vorbereitung',
  chip_na:'Nicht verfügbar', chip_locked:'Gesperrt', pv_checking:'Video wird geprüft…',
  pv_avail:'In diesem Video verfügbar: {list}', pv_audio_only:'Nur Audio',
  st_queued:'In Warteschlange', st_checking:'Wird geprüft', st_preparing:'Vorbereitung',
  st_merging:'Video wird verarbeitet', st_sending:'Wird gesendet', st_done:'Fertig',
  st_cancelled:'Abgebrochen', st_error:'Fehler', prog_hint_b:'Diese Seite nicht schließen',
  paste_url:'Bitte zuerst einen Link einfügen', net_err:'Verbindungsfehler, bitte erneut versuchen',
  copied:'Kopiert', copy_fail:'Kopieren fehlgeschlagen',
  tr_fetching:'Untertitel werden geladen…', tr_search:'Im Text suchen…', tr_time:'Zeit',
  tr_copy:'Kopieren', tr_meta:'{n} Zeilen · {dur} · {kind}',
  tr_kind_manual:'manuelle Untertitel', tr_kind_auto:'automatisch erstellte Untertitel',
  tr_kind_tr:'automatische Übersetzung', tr_none:'Keine Ergebnisse',
  tr_auto:'automatisch', tr_translated:'übersetzt'
};

I18N.ar = {
  page_title:'OZVIO — تحميل الفيديو', title:'تحميل الفيديو', sub:'تحميل الفيديو بسرعة',
  url_ph:'ألصق رابط الفيديو', btn_download:'تحميل', btn_transcribe:'الترجمة النصية',
  btn_cancel:'إلغاء', quota_line:'الحصة المتبقية', mode_video:'فيديو', mode_mp3:'MP3',
  mode_tr:'الترجمة النصية', logout:'تسجيل الخروج', auth_hint:'سجّل الدخول عبر تيليجرام',
  tg_login:'تسجيل الدخول عبر تيليجرام', tg_register:'التسجيل عبر تيليجرام',
  tg_wait_start:'افتح تيليجرام واضغط Start', tg_wait_start_sub:'بانتظار التأكيد',
  tg_wait_confirm:'أكد تسجيل الدخول في تيليجرام', tg_wait_confirm_sub:'بانتظار التأكيد',
  tg_open_again:'افتح مرة أخرى', tg_cancel:'إلغاء', tg_denied:'تم رفض تسجيل الدخول',
  tg_noaccount:'الحساب غير موجود', tg_expired:'انتهت صلاحية الجلسة',
  badge_ok:'نشط', badge_limited:'محدود', chip_prep:'جارٍ التحضير',
  chip_na:'غير متاح', chip_locked:'مقفل', pv_checking:'جارٍ فحص الفيديو…',
  pv_avail:'متاح في هذا الفيديو: {list}', pv_audio_only:'صوت فقط',
  st_queued:'في قائمة الانتظار', st_checking:'جارٍ الفحص', st_preparing:'جارٍ التحضير',
  st_merging:'جارٍ معالجة الفيديو', st_sending:'جارٍ الإرسال', st_done:'اكتمل',
  st_cancelled:'أُلغي', st_error:'خطأ', prog_hint_b:'لا تغلق هذه الصفحة',
  paste_url:'ألصق رابطًا أولاً', net_err:'خطأ في الاتصال، حاول مرة أخرى',
  copied:'تم النسخ', copy_fail:'تعذر النسخ',
  tr_fetching:'جارٍ جلب الترجمة النصية…', tr_search:'البحث في النص…', tr_time:'الوقت',
  tr_copy:'نسخ', tr_meta:'{n} سطر · {dur} · {kind}',
  tr_kind_manual:'ترجمة نصية مكتوبة', tr_kind_auto:'ترجمة نصية تلقائية',
  tr_kind_tr:'ترجمة آلية', tr_none:'لا توجد نتائج',
  tr_auto:'تلقائي', tr_translated:'مترجم'
};

I18N.ku = {
  page_title:'OZVIO — Vîdyoyê Daxîne', title:'Vîdyoyê Daxîne', sub:'Vîdyoyan bi lez daxîne',
  url_ph:'Lînka vîdyoyê lê zêde bike', btn_download:'Daxîne', btn_transcribe:'Binivîs',
  btn_cancel:'Betal bike', quota_line:'Miqdarê mayî', mode_video:'Vîdyo', mode_mp3:'MP3',
  mode_tr:'Binivîs', logout:'Derkeve', auth_hint:'Bi Telegramê têkeve',
  tg_login:'Bi Telegramê têkeve', tg_register:'Bi Telegramê tomar bibe',
  tg_wait_start:'Telegramê veke û Start bitikîne', tg_wait_start_sub:'Li benda pejirandinê ye',
  tg_wait_confirm:'Têketina xwe di Telegramê de pejirîne', tg_wait_confirm_sub:'Li benda pejirandinê ye',
  tg_open_again:'Dîsa veke', tg_cancel:'Betal bike', tg_denied:'Têketin nehate pejirandin',
  tg_noaccount:'Hesab nehat dîtin', tg_expired:'Demê wê qediya',
  badge_ok:'Çalak', badge_limited:'Sînordar', chip_prep:'Amadekirin',
  chip_na:'Ne berdest e', chip_locked:'Girtî', pv_checking:'Vîdyo tê kontrolkirin…',
  pv_avail:'Di vê vîdyoyê de heye: {list}', pv_audio_only:'Tenê deng',
  st_queued:'Di rêzê de', st_checking:'Kontrolkirin', st_preparing:'Amadekirin',
  st_merging:'Vîdyo tê amadekirin', st_sending:'Tê şandin', st_done:'Qediya',
  st_cancelled:'Hate betalkirin', st_error:'Çewtî', prog_hint_b:'Vê rûpelê negire',
  paste_url:'Pêşî lînkekê lê zêde bike', net_err:'Çewtiya girêdanê, ji kerema xwe dîsa biceribîne',
  copied:'Hat kopîkirin', copy_fail:'Kopîkirin pêk nehat',
  tr_fetching:'Binivîs tê anîn…', tr_search:'Di nivîsê de bigere…', tr_time:'Dem',
  tr_copy:'Kopî bike', tr_meta:'{n} rêz · {dur} · {kind}',
  tr_kind_manual:'binivîsa destan', tr_kind_auto:'binivîsa bixweber çêkirî',
  tr_kind_tr:'wergera bixweber', tr_none:'Tu encam nehat dîtin',
  tr_auto:'bixweber', tr_translated:'wergerandî'
};

function t(key, vars) {
  let s = (I18N[LANG] && I18N[LANG][key]) || I18N.tr[key] || key;
  if (vars) for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(String(vars[k]));
  return s;
}

function applyI18n() {
  document.documentElement.lang = LANG;
  document.documentElement.dir = LANG === 'ar' ? 'rtl' : 'ltr';
  document.title = t('page_title');
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  document.querySelectorAll('[data-lang]').forEach(b => b.classList.toggle('active', b.dataset.lang === LANG));
}

function setLangValue(l) {
  LANG = SUPPORTED_LANGS.includes(String(l).toLowerCase()) ? String(l).toLowerCase() : 'tr';
  try { localStorage.setItem('lang', LANG); } catch {}
}

/**
 * Sunucu tarafı çeviriler (API hataları + Telegram botu).
 * Anahtar -> { tr, en }. {isim} yer tutucuları vars ile doldurulur.
 */
const M = {
  // ---- genel / API ----
  'err.server':       { tr: 'Sunucu hatası', en: 'Server error' },
  'err.rate':         { tr: 'Çok fazla istek, biraz bekle', en: 'Too many requests, please wait a bit' },
  'err.authRequired': { tr: 'Giriş gerekli', en: 'Please sign in' },
  'err.invalidUrl':   { tr: 'Geçersiz URL', en: 'Invalid URL' },
  'err.unsupported':  { tr: 'Bu site desteklenmiyor', en: 'This site is not supported' },
  'err.invalidQ':     { tr: 'Geçersiz kalite', en: 'Invalid quality' },
  'err.needVerify':   { tr: 'Bu kalite için Telegram doğrulaması gerekli', en: 'This quality requires Telegram verification' },
  'err.quota':        { tr: 'Günlük indirme kotanız doldu', en: 'Your daily download quota is used up' },
  'err.info':         { tr: 'Video bilgisi alınamadı (özel/kısıtlı/geçersiz olabilir)', en: 'Could not get video info (it may be private, restricted or invalid)' },
  'err.tooLong':      { tr: 'Video çok uzun', en: 'Video is too long' },
  'err.busyUser':     { tr: 'Devam eden bir indirmeniz var', en: 'You already have a download in progress' },
  'err.noQuality':    { tr: 'Bu video {q}p kalitesinde yok. En yüksek: {max}p', en: 'This video is not available in {q}p. Best available: {max}p' },
  'err.tunnel':       { tr: 'Akış başlatılamadı', en: 'Could not start the stream' },
  'err.busyServer':   { tr: 'Sunucu şu an meşgul, biraz sonra tekrar deneyin', en: 'Server is busy right now, please try again shortly' },
  'err.noOutput':     { tr: 'Çıktı dosyası oluşturulamadı', en: 'Output file could not be created' },
  'err.mux':          { tr: 'İndirme/birleştirme başarısız', en: 'Download/merge failed' },
  'err.trBusy':       { tr: 'Devam eden bir transkript işleminiz var', en: 'You already have a transcript job running' },
  'err.badLang':      { tr: 'Geçersiz dil', en: 'Invalid language' },
  'err.noSubs':       { tr: 'Bu video için altyazı/transkript bulunamadı', en: 'No subtitles/transcript found for this video' },
  'err.trFail':       { tr: 'Transkript alınamadı', en: 'Could not fetch the transcript' },
  'err.trEmpty':      { tr: 'Transkript boş', en: 'The transcript is empty' },
  'err.cancelled':    { tr: 'İndirme iptal edildi', en: 'Download cancelled' },
  'err.botOff':      { tr: 'Telegram botu şu an kapalı, biraz sonra tekrar dene', en: 'The Telegram bot is offline right now, please try again later' },
  'err.noSubsHere':  { tr: 'Bu bağlantıda indirilecek bir şey bulunamadı', en: 'Nothing downloadable was found at this link' },
  'err.audioOnly':   { tr: 'Bu bağlantıda video yok, yalnızca ses indirilebilir', en: 'This link has no video, only audio can be downloaded' },

  // ---- Telegram botu ----
  'bot.noToken':      { tr: 'TELEGRAM_BOT_TOKEN yok — bot devre dışı', en: 'TELEGRAM_BOT_TOKEN missing — bot disabled' },
  'bot.welcome': {
    tr: 'Merhaba! 👋 Giriş ve kayıt için web sitesindeki \"Telegram ile giriş yap\" ya da \"Telegram ile kayıt ol\" butonunu kullan; bu bota otomatik yönlendirileceksin.\n\nKomutlar:\n/durum – hesap durumu\n/cikis – tüm cihazlardaki oturumları kapat\n/dil – dili değiştir (TR/EN)',
    en: 'Hi! 👋 To sign in or sign up, use the \"Sign in with Telegram\" or \"Sign up with Telegram\" button on the website; it will bring you here automatically.\n\nCommands:\n/status – account status\n/logout – sign out of all devices\n/lang – change language (TR/EN)',
  },
  'bot.badToken':     { tr: '❌ Bağlantı geçersiz veya süresi dolmuş. Siteden yeniden dene.', en: '❌ This link is invalid or has expired. Please try again from the website.' },
  'bot.registered':   { tr: '✅ Kayıt tamamlandı, hoş geldin {user}!\nSiteye dönebilirsin, giriş otomatik yapılacak.\n\n🌐 IP: {ip}\nBu sen değilsen /cikis yaz.', en: '✅ You are registered, welcome {user}!\nGo back to the site, you will be signed in automatically.\n\n🌐 IP: {ip}\nIf this was not you, send /logout.' },
  'bot.loginAsk':     { tr: '🔐 Giriş isteği\n\n🌐 IP: {ip}\n💻 Cihaz: {ua}\n\nBu sen misin? Onaylarsan bu IP/cihaz siteye alınır.', en: '🔐 Sign-in request\n\n🌐 IP: {ip}\n💻 Device: {ua}\n\nIs this you? If you approve, this IP/device is let into the site.' },
  'bot.btnOk':        { tr: '✅ Onayla', en: '✅ Approve' },
  'bot.btnNo':        { tr: '❌ Reddet', en: '❌ Deny' },
  'bot.loginOk':      { tr: '✅ Giriş onaylandı. Siteye dönebilirsin.', en: '✅ Sign-in approved. You can go back to the site.' },
  'bot.loginNo':      { tr: '🚫 Giriş reddedildi.', en: '🚫 Sign-in denied.' },
  'bot.noAccount':    { tr: '❌ Bu Telegram hesabıyla kayıtlı bir hesap yok. Önce sitede \"Telegram ile kayıt ol\" butonunu kullan.', en: '❌ There is no account for this Telegram user. Use \"Sign up with Telegram\" on the website first.' },
  'bot.status':       { tr: 'Hesap: {user}\nDurum: ✅ Telegram ile bağlı\nBugünkü indirme: {used}/{limit}', en: 'Account: {user}\nStatus: ✅ Linked with Telegram\nDownloads today: {used}/{limit}' },
  'bot.noLinked':     { tr: 'Bu Telegram hesabına bağlı bir kayıt yok. Siteden kayıt ol.', en: 'No account is linked to this Telegram user. Sign up on the website.' },
  'bot.signedOut':    { tr: '✅ Tüm cihazlardaki oturumlar kapatıldı.', en: '✅ Signed out of all devices.' },
  'bot.langAsk':      { tr: 'Dil seç / Choose language:', en: 'Choose language / Dil seç:' },
  'bot.langSet':      { tr: '✅ Dil: Türkçe', en: '✅ Language: English' },
  'bot.cmd.start':    { tr: 'Başlat / yardım', en: 'Start / help' },
  'bot.cmd.status':   { tr: 'Hesap durumu', en: 'Account status' },
  'bot.cmd.logout':   { tr: 'Tüm cihazlardan çık', en: 'Sign out of all devices' },
  'bot.cmd.lang':     { tr: 'Dili değiştir', en: 'Change language' },
};


// OZVIO_EXTRA_LANGUAGES
for (const [key, value] of Object.entries({"err.server":"Ошибка сервера","err.rate":"Слишком много запросов. Попробуйте позже","err.authRequired":"Необходимо войти в систему","err.invalidUrl":"Недействительный URL","err.unsupported":"Этот сайт не поддерживается","err.invalidQ":"Недопустимое качество","err.needVerify":"Для этого качества требуется подтверждение через Telegram","err.quota":"Дневной лимит загрузок исчерпан","err.info":"Не удалось получить информацию о видео","err.tooLong":"Видео слишком длинное","err.busyUser":"У вас уже выполняется загрузка","err.noQuality":"Видео недоступно в качестве {q}p. Максимум: {max}p","err.tunnel":"Не удалось запустить поток","err.busyServer":"Сервер занят. Попробуйте позже","err.noOutput":"Не удалось создать выходной файл","err.mux":"Ошибка загрузки или объединения","err.trBusy":"У вас уже выполняется обработка субтитров","err.badLang":"Недопустимый язык","err.noSubs":"Для этого видео субтитры не найдены","err.trFail":"Не удалось получить субтитры","err.trEmpty":"Субтитры пусты","err.cancelled":"Загрузка отменена","err.botOff":"Бот Telegram сейчас недоступен","err.noSubsHere":"По этой ссылке ничего не найдено","err.audioOnly":"По этой ссылке доступно только аудио","bot.noToken":"TELEGRAM_BOT_TOKEN отсутствует — бот отключён","bot.welcome":"Привет! 👋 Для входа или регистрации используйте соответствующую кнопку Telegram на сайте.\n\nКоманды:\n/status – статус аккаунта\n/logout – выход со всех устройств\n/lang – сменить язык","bot.badToken":"❌ Ссылка недействительна или устарела. Попробуйте снова на сайте.","bot.registered":"✅ Регистрация завершена. Добро пожаловать, {user}!\nВернитесь на сайт — вход будет выполнен автоматически.\n\n🌐 IP: {ip}\nЕсли это не вы, отправьте /logout.","bot.loginAsk":"🔐 Запрос на вход\n\n🌐 IP: {ip}\n💻 Устройство: {ua}\n\nЭто вы? Подтвердите вход для этого устройства.","bot.btnOk":"✅ Подтвердить","bot.btnNo":"❌ Отклонить","bot.loginOk":"✅ Вход подтверждён. Можете вернуться на сайт.","bot.loginNo":"🚫 Вход отклонён.","bot.noAccount":"❌ Аккаунт с этим Telegram не найден. Сначала зарегистрируйтесь на сайте.","bot.status":"Аккаунт: {user}\nСтатус: ✅ Telegram подключён\nЗагрузки сегодня: {used}/{limit}","bot.noLinked":"С этим Telegram не связан аккаунт. Зарегистрируйтесь на сайте.","bot.signedOut":"✅ Выполнен выход со всех устройств.","bot.langAsk":"Выберите язык:","bot.langSet":"✅ Язык: Русский","bot.cmd.start":"Начать / помощь","bot.cmd.status":"Статус аккаунта","bot.cmd.logout":"Выйти со всех устройств","bot.cmd.lang":"Изменить язык"})) M[key].ru = value;
for (const [key, value] of Object.entries({"err.server":"Serverfehler","err.rate":"Zu viele Anfragen. Bitte später erneut versuchen","err.authRequired":"Bitte anmelden","err.invalidUrl":"Ungültige URL","err.unsupported":"Diese Website wird nicht unterstützt","err.invalidQ":"Ungültige Qualität","err.needVerify":"Für diese Qualität ist eine Telegram-Bestätigung erforderlich","err.quota":"Das tägliche Download-Limit ist erreicht","err.info":"Videoinformationen konnten nicht abgerufen werden","err.tooLong":"Das Video ist zu lang","err.busyUser":"Ein Download läuft bereits","err.noQuality":"Dieses Video ist nicht in {q}p verfügbar. Höchste Qualität: {max}p","err.tunnel":"Stream konnte nicht gestartet werden","err.busyServer":"Der Server ist derzeit ausgelastet. Bitte später erneut versuchen","err.noOutput":"Ausgabedatei konnte nicht erstellt werden","err.mux":"Download oder Zusammenführen fehlgeschlagen","err.trBusy":"Eine Transkriptverarbeitung läuft bereits","err.badLang":"Ungültige Sprache","err.noSubs":"Für dieses Video wurden keine Untertitel gefunden","err.trFail":"Untertitel konnten nicht geladen werden","err.trEmpty":"Das Transkript ist leer","err.cancelled":"Download abgebrochen","err.botOff":"Der Telegram-Bot ist momentan nicht verfügbar","err.noSubsHere":"Unter diesem Link wurde nichts zum Herunterladen gefunden","err.audioOnly":"Unter diesem Link ist nur Audio verfügbar","bot.noToken":"TELEGRAM_BOT_TOKEN fehlt — Bot deaktiviert","bot.welcome":"Hallo! 👋 Verwenden Sie zum Anmelden oder Registrieren die entsprechende Telegram-Schaltfläche auf der Website.\n\nBefehle:\n/status – Kontostatus\n/logout – von allen Geräten abmelden\n/lang – Sprache ändern","bot.badToken":"❌ Dieser Link ist ungültig oder abgelaufen. Bitte versuchen Sie es erneut auf der Website.","bot.registered":"✅ Registrierung abgeschlossen. Willkommen, {user}!\nKehren Sie zur Website zurück. Sie werden automatisch angemeldet.\n\n🌐 IP: {ip}\nFalls Sie das nicht waren, senden Sie /logout.","bot.loginAsk":"🔐 Anmeldeanfrage\n\n🌐 IP: {ip}\n💻 Gerät: {ua}\n\nSind Sie das? Bestätigen Sie die Anmeldung für dieses Gerät.","bot.btnOk":"✅ Bestätigen","bot.btnNo":"❌ Ablehnen","bot.loginOk":"✅ Anmeldung bestätigt. Sie können zur Website zurückkehren.","bot.loginNo":"🚫 Anmeldung abgelehnt.","bot.noAccount":"❌ Für dieses Telegram-Konto gibt es kein Benutzerkonto. Registrieren Sie sich zuerst auf der Website.","bot.status":"Konto: {user}\nStatus: ✅ Mit Telegram verbunden\nHeutige Downloads: {used}/{limit}","bot.noLinked":"Mit diesem Telegram-Konto ist kein Konto verknüpft. Bitte auf der Website registrieren.","bot.signedOut":"✅ Von allen Geräten abgemeldet.","bot.langAsk":"Sprache auswählen:","bot.langSet":"✅ Sprache: Deutsch","bot.cmd.start":"Start / Hilfe","bot.cmd.status":"Kontostatus","bot.cmd.logout":"Von allen Geräten abmelden","bot.cmd.lang":"Sprache ändern"})) M[key].de = value;
for (const [key, value] of Object.entries({"err.server":"خطأ في الخادم","err.rate":"طلبات كثيرة جدًا، حاول مرة أخرى لاحقًا","err.authRequired":"يرجى تسجيل الدخول","err.invalidUrl":"رابط غير صالح","err.unsupported":"هذا الموقع غير مدعوم","err.invalidQ":"جودة غير صالحة","err.needVerify":"تأكيد Telegram مطلوب لهذه الجودة","err.quota":"لقد استنفدت حد التنزيل اليومي","err.info":"تعذر الحصول على معلومات الفيديو","err.tooLong":"الفيديو طويل جدًا","err.busyUser":"لديك عملية تنزيل قيد التنفيذ بالفعل","err.noQuality":"الفيديو غير متاح بجودة {q}p. أعلى جودة: {max}p","err.tunnel":"تعذر بدء البث","err.busyServer":"الخادم مشغول حاليًا، حاول لاحقًا","err.noOutput":"تعذر إنشاء الملف الناتج","err.mux":"فشل التنزيل أو الدمج","err.trBusy":"لديك عملية معالجة ترجمة قيد التنفيذ","err.badLang":"لغة غير صالحة","err.noSubs":"لا توجد ترجمة لهذا الفيديو","err.trFail":"تعذر جلب الترجمة","err.trEmpty":"الترجمة فارغة","err.cancelled":"تم إلغاء التنزيل","err.botOff":"بوت Telegram غير متاح حاليًا","err.noSubsHere":"لم يتم العثور على محتوى قابل للتنزيل في هذا الرابط","err.audioOnly":"يتوفر الصوت فقط في هذا الرابط","bot.noToken":"رمز TELEGRAM_BOT_TOKEN غير موجود — البوت معطّل","bot.welcome":"مرحبًا! 👋 لتسجيل الدخول أو إنشاء حساب، استخدم زر Telegram المناسب على الموقع.\n\nالأوامر:\n/status – حالة الحساب\n/logout – تسجيل الخروج من جميع الأجهزة\n/lang – تغيير اللغة","bot.badToken":"❌ الرابط غير صالح أو انتهت صلاحيته. حاول مجددًا من الموقع.","bot.registered":"✅ اكتمل التسجيل، أهلًا بك {user}!\nارجع إلى الموقع وسيتم تسجيل دخولك تلقائيًا.\n\n🌐 IP: {ip}\nإذا لم تكن أنت، أرسل /logout.","bot.loginAsk":"🔐 طلب تسجيل دخول\n\n🌐 IP: {ip}\n💻 الجهاز: {ua}\n\nهل هذا أنت؟ أكّد تسجيل الدخول لهذا الجهاز.","bot.btnOk":"✅ موافقة","bot.btnNo":"❌ رفض","bot.loginOk":"✅ تمت الموافقة على تسجيل الدخول. يمكنك العودة إلى الموقع.","bot.loginNo":"🚫 تم رفض تسجيل الدخول.","bot.noAccount":"❌ لا يوجد حساب مرتبط بهذا المستخدم على Telegram. سجّل أولًا من الموقع.","bot.status":"الحساب: {user}\nالحالة: ✅ مرتبط بـ Telegram\nتنزيلات اليوم: {used}/{limit}","bot.noLinked":"لا يوجد حساب مرتبط بحساب Telegram هذا. سجّل من الموقع.","bot.signedOut":"✅ تم تسجيل الخروج من جميع الأجهزة.","bot.langAsk":"اختر اللغة:","bot.langSet":"✅ اللغة: العربية","bot.cmd.start":"ابدأ / مساعدة","bot.cmd.status":"حالة الحساب","bot.cmd.logout":"تسجيل الخروج من جميع الأجهزة","bot.cmd.lang":"تغيير اللغة"})) M[key].ar = value;
for (const [key, value] of Object.entries({"err.server":"Çewtiya serverê","err.rate":"Pir daxwaz hatin şandin, hinekî bisekine","err.authRequired":"Divê têkevî hesabê xwe","err.invalidUrl":"URL ne derbasdar e","err.unsupported":"Ev malper nayê piştgirî kirin","err.invalidQ":"Kalîte ne derbasdar e","err.needVerify":"Ji bo vê kalîteyê erêkirina Telegramê pêwîst e","err.quota":"Sînorê daxistina rojane qediya","err.info":"Agahiyên vîdyoyê nehatin wergirtin","err.tooLong":"Vîdyo pir dirêj e","err.busyUser":"Jixwe daxistinek te heye","err.noQuality":"Ev vîdyo bi kalîteya {q}p tune ye. Herî bilind: {max}p","err.tunnel":"Destpêkirina weşanê pêk nehat","err.busyServer":"Server niha mijûl e, paşê dîsa biceribîne","err.noOutput":"Pelê derketinê nehat çêkirin","err.mux":"Daxistin an yekxistin bi ser neket","err.trBusy":"Jixwe karê nivîsa binî heye","err.badLang":"Ziman ne derbasdar e","err.noSubs":"Ji bo vê vîdyoyê jêrenivîs tune ne","err.trFail":"Jêrenivîs nehatin wergirtin","err.trEmpty":"Nivîs vala ye","err.cancelled":"Daxistin hate betalkirin","err.botOff":"Bota Telegramê niha neçalak e","err.noSubsHere":"Di vê lînkê de tiştek ji bo daxistinê nehat dîtin","err.audioOnly":"Di vê lînkê de tenê deng heye","bot.noToken":"TELEGRAM_BOT_TOKEN tune ye — bot neçalak e","bot.welcome":"Silav! 👋 Ji bo têketinê an tomarkirinê, li ser malperê bişkoja Telegramê ya guncaw bikar bîne.\n\nFerman:\n/status – rewşa hesabê\n/logout – derketina ji hemû amûran\n/lang – guhertina zimanî","bot.badToken":"❌ Ev lînk ne derbasdar e an jî dema wê qediya. Ji malperê dîsa biceribîne.","bot.registered":"✅ Tomarkirin qediya, bi xêr hatî {user}!\nVegere malperê, dê bixweber têkevî hesabê.\n\n🌐 IP: {ip}\nHeke tu nebûyî, /logout bişîne.","bot.loginAsk":"🔐 Daxwaza têketinê\n\n🌐 IP: {ip}\n💻 Amûr: {ua}\n\nEv tu yî? Ji bo vê amûrê têketinê erê bike.","bot.btnOk":"✅ Erê bike","bot.btnNo":"❌ Red bike","bot.loginOk":"✅ Têketin hate pejirandin. Tu dikarî vegerî malperê.","bot.loginNo":"🚫 Têketin hate redkirin.","bot.noAccount":"❌ Ji bo vê hesabê Telegramê hesabek tune ye. Pêşî li ser malperê xwe tomar bike.","bot.status":"Hesab: {user}\nRewş: ✅ Bi Telegramê ve girêdayî ye\nDaxistinên îro: {used}/{limit}","bot.noLinked":"Hesabek bi vê Telegramê ve girêdayî nîne. Li ser malperê tomar bike.","bot.signedOut":"✅ Ji hemû amûran derketî.","bot.langAsk":"Ziman hilbijêre:","bot.langSet":"✅ Ziman: Kurdî","bot.cmd.start":"Destpêk / alîkarî","bot.cmd.status":"Rewşa hesabê","bot.cmd.logout":"Ji hemû amûran derkeve","bot.cmd.lang":"Ziman biguherîne"})) M[key].ku = value;

const LANGS = ['tr', 'en', 'ru', 'de', 'ar', 'ku'];
const norm = l => {
  const code = String(l || '').toLowerCase().split('-')[0];
  return LANGS.includes(code) ? code : 'tr';
};

function t(lang, key, vars) {
  const e = M[key];
  if (!e) return key; // sözlükte yoksa olduğu gibi döner
  let s = e[norm(lang)] || e.en || e.tr || key;
  if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]));
  return s;
}

// İstek dili: istemci X-Lang gönderir, yoksa Accept-Language'e bakar.
function langOf(req) {
  const supported = ['tr', 'en', 'ru', 'de', 'ar', 'ku'];
  const requested = String(req.get('x-lang') || '')
    .toLowerCase().split(',')[0].trim().split('-')[0];

  if (supported.includes(requested)) return requested;

  const accepted = String(req.get('accept-language') || '').toLowerCase();
  for (const item of accepted.split(',')) {
    const code = item.trim().split(';')[0].split('-')[0];
    if (supported.includes(code)) return code;
  }
  return 'tr';
}

function langMiddleware(req, res, next) { req.lang = langOf(req); next(); }

module.exports = { t, norm, langOf, langMiddleware };

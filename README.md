# Ozvio — Video İndirici

Gereksinimler: Node 18+, `yt-dlp`, `ffmpeg` (PATH'te), bir Telegram bot token'ı (@BotFather).

    cp .env.example .env   # token, bot kullanıcı adı, BASE_URL doldur
    npm install
    npm start

Önemli: bot polling kullanır; aynı token ile aynı anda tek örnek çalıştırın. Bot olmadan giriş yapılamaz.

## Giriş / kayıt (yalnızca Telegram, şifre yok)
- **Kayıt ol**: site Telegram'ı açar -> kullanıcı **Başlat**'a basar -> hesap oluşur, tarayıcı otomatik giriş yapar.
- **Giriş yap**: site Telegram'ı açar -> bot **IP + cihaz** bilgisiyle "Onayla / Reddet" sorar -> onaylanan tarayıcı içeri alınır.
  (Başkası sana link yollayıp seni onaylatmaya çalışırsa IP'yi görüp reddedebilirsin.)
- Oturum çerezini yalnızca isteği başlatan tarayıcı alır (gizli `rid` kodu).
- Bot komutları: `/durum` `/cikis` (tüm cihazlardan çık) `/dil`.
- Eski veritabanı ilk açılışta otomatik taşınır: Telegram'a bağlı hesaplar korunur, bağlanmamış eski şifreli hesaplar silinir.
- Varsayılan günlük limit: 20 indirme / 24 saat. `.env` içindeki `DAILY_DOWNLOAD_LIMIT=0` sınırsız kota sağlar. Transkript kotadan düşmez.

## Platformlar
YouTube, Instagram, TikTok, X/Twitter, Facebook, Reddit, Twitch, Vimeo, Dailymotion, Pinterest, Snapchat, SoundCloud ve daha fazlası (`ALLOWED_HOSTS` varsayılana ekleme yapar, ezmez).
- YouTube/Vimeo/Dailymotion: <=720p ve MP3 diske yazmadan akar; diğer her şey geçici dosya (Strateji B) ile indirilir ve bitince silinir.
- Instagram/TikTok/X bazı içeriklerde giriş ister: `COOKIES_FILE` ile cookies.txt verin. `yt-dlp`'yi güncel tutun (`yt-dlp -U`), bu siteler sık değişir.
- Çok videolu gönderilerde (carousel) ilk video indirilir.

## Diğer
- Transkript: altyazı yt-dlp ile indirilmeden çekilir; TR <-> EN çeviri sunucuda yapılır. Arama, zaman damgası, kopyala, .txt/.srt.
- İlerleme + İptal: indirirken yüzde/MB gösterilir, "İptal" ile sunucu süreçleri durdurulur.
- Dil: site ve Telegram botu Türkçe/İngilizce.

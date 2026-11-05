# Danchi 🌼🍑

A little home for everything. Private life organizer for one owner, with one view only account.

**Stack:** Next.js 16 · React 19 · Tailwind 4 · PostgreSQL + Drizzle · Better Auth · PM2 · Cloudflare Tunnel

## Yang udah jalan (versi 0.5)

**Login pake Google.** Yang bisa masuk cuma `vyraruka@gmail.com` (owner, bisa ngubah semua) sama `rafiarsya.work@gmail.com` (viewer, cuma bisa liat). Akun Google lain langsung ditolak sebelum session kebentuk. Cadangannya "Email me a code" (kalau SMTP diisi). Login password mati, kecuali `ALLOW_PASSWORD_LOGIN=true`.

**Modul:**

| Bagian | Isinya |
|---|---|
| Home | Sapaan dari Chichi, Today, Little habits, School, Coming up, Needs a little love, Bills coming, Eating today, Money, Ask Chichi |
| Tasks, Reminders | Reminder sekali, harian, mingguan, atau bulanan. Task bisa dikasih ⏰ |
| Calendar | Semua yang ada tanggalnya dalam satu bulan: ujian, tugas, tagihan, task, reminder, project, menu makan |
| Habits | Streak 🔥, centang mingguan, bar 4 minggu terakhir, reminder harian yang gak bunyi kalau hari itu udah dikerjain |
| Study | Mata kuliah, tugas (reminder malam sebelumnya + pagi pas deadline), ujian (countdown + reminder 3 hari sebelum, malam sebelumnya, 2 jam sebelum), flashcard pake spaced repetition |
| Stuff, Shopping | Inventaris, tanggal expired, barang hampir abis otomatis masuk list belanja |
| Kitchen | Resep, "Cook now" (cocokin bahan sama isi kulkas), meal plan mingguan, tombol masukin bahan yang kurang ke shopping |
| Money, Bills | Pengeluaran + budget. Tagihan dan langganan diingetin sebelum jatuh tempo; tombol Paid langsung nyatet pengeluaran terus geser tanggalnya |
| Wishlist | Need, Want, Dream, harga, link. Rafi bisa liat buat ide kado 😉 |
| Projects | Task, catatan, sama pengeluaran per project |
| Notes, Journal | Catatan pake tag + pin, jurnal harian pake mood |
| Ask Chichi | Gemini yang bisa ngerjain semua di atas pake bahasa biasa, plus inget hal-hal tentang dia |
| Safety | Tombol Home safe, On my way, Need you (2x tap, bisa nyertain lokasi) yang langsung bunyi di HP Rafi walau jam tenang. Timer "harusnya udah nyampe jam X": pas waktunya Chichi nanya dia dulu, 10 menit kemudian Rafi dikabarin (push + email). Kartu darurat: golongan darah, alergi, obat, kontak darurat, tombol 999 |
| Love notes | Satu-satunya yang bisa ditulis Rafi. Muncul di home dia + notif, dia bisa kasih reaksi ❤️ |
| Mood | Check-in mood harian di home. Kalau lagi berat, ada tombol "Ask Rafi for a hug" |
| Cycle | Catatan haid, perkiraan berikutnya, fase + tips lembut. Selalu privat. Opsional: Rafi dapet kode "be extra sweet" 2 hari sebelumnya tanpa detail |
| Papers | Dokumen (paspor, IC, visa, asuransi) dengan reminder 2 bulan + 2 minggu sebelum expired, cuma nyimpen 4 digit terakhir. Aplikasi beasiswa / magang / kerja: status, deadline (reminder seminggu + sehari sebelum), checklist |
| Files | Lampiran privat (PDF, foto, Office, max 15 MB) di Papers, Notes, Projects. Disimpen di disk mini PC pake nama acak, dicek isi file-nya, cuma dibuka buat yang login dan boleh liat |
| Money+ | Utang piutang (owe and owed) + grafik 6 bulan |

**Lainnya:** realtime (Postgres NOTIFY → SSE), Chichi Island, push dengan tombol Done/Snooze, email, ringkasan pagi (ditulis AI), nudge malam, pinned status di HP, PWA. Di seluruh UI gak ada titik tengah, garis putus putus, atau tanda strip.

## Struktur

```
src/app/login/          halaman login + action sign in / sign out
src/app/(app)/          semua halaman setelah login + actions.ts (semua perubahan data)
src/components/         UI (shell, kartu, form, ikon)
src/lib/auth.ts         konfigurasi Better Auth
src/lib/session.ts      getMe() dan requireOwner()  <- kunci owner / viewer
src/lib/data.ts         semua query database
src/lib/time.ts         jam & zona waktu (reminder, repeat)
src/server/             notify (inbox+push+email), push, mail, jobs (worker), mutations, ai (Gemini), live (realtime), safety, care, files
src/lib/privacy.ts      apa yang boleh dibuka viewer (diatur dia di Settings)
src/lib/lock.ts         PIN lock
data/uploads/           file privat (gak ikut ke git / deploy)
src/components/island.tsx     Chichi Island
deploy/                 push-to-minipc.ps1, setup-minipc.sh, update.sh
src/components/mascot.tsx     Chichi
src/components/cute-icon.tsx  ikon kartun
public/sw.js            service worker buat push
scripts/worker.ts       pengirim reminder (jalan terus di PM2)
src/db/schema.ts        tabel database
drizzle/                file migrasi SQL
scripts/                seed akun, ganti password, data contoh, backup
```

Setiap Server Action di `actions.ts` manggil `requireOwner()` dulu, jadi akun viewer ditolak di server walaupun ada yang ngakalin tombolnya.

## Jalanin di laptop (Windows)

Butuh Node.js 20.9 ke atas dan PostgreSQL.

1. Bikin database (pakai `psql` atau pgAdmin):
   ```sql
   CREATE USER danchi WITH PASSWORD 'isi_password_db';
   CREATE DATABASE danchi OWNER danchi;
   ```
2. Buka `.env`, isi `DATABASE_URL` sesuai database di atas.
3. Install dan siapin database:
   ```powershell
   npm install
   npm run db:migrate
   npm run seed
   ```
   `seed` bikin dua akun dan nampilin **password sementara** sekali aja. Catat.
4. (Opsional) isi data contoh: `npm run demo`
5. Jalanin: `npm run dev`, buka http://localhost:3000

Ganti password kapan aja:

```powershell
npm run password -- owner
npm run password -- viewer
```

Di laptop, buat ngetes reminder jalanin `npm run worker` di terminal kedua (atau `npm run worker -- --once` buat sekali jalan aja).

## Deploy ke mini PC (Ubuntu)

### Cara gampang: satu perintah dari laptop

Syaratnya laptop bisa SSH ke mini PC. Di PowerShell, dari folder project:

```powershell
.\deploy\push-to-minipc.ps1 rafi@IP-MINI-PC
```

Script ini nge-pack project (tanpa `node_modules`, `.next`, `.env`), ngirim ke `~/danchi` di mini PC, terus jalanin `deploy/setup-minipc.sh`. Yang dikerjain:

1. Install Node 22, PostgreSQL, sama PM2 kalau belum ada.
2. Bikin `.env` dengan secret baru. Pertama kali dia bakal nanya email dia sama email lu.
3. Bikin user + database, migrasi (termasuk trigger realtime), akun (**password sementara cuma muncul sekali, catat!**), terus build.
4. PM2: `danchi` (web) + `danchi-worker` (reminder, push, email). Otomatis nyala lagi pas mini PC reboot.
5. Cloudflare Tunnel: nambahin `danchi.rafiarsya.com → localhost:3100` ke config cloudflared yang udah ada (dibackup dulu), route DNS, terus restart.
6. Backup database tiap malem jam 03:15.

Update ke versi berikutnya:

```powershell
.\deploy\push-to-minipc.ps1 rafi@IP-MINI-PC -Update
```

Kalau pake git di mini PC: `bash deploy/update.sh`.

### Login Google (sekali aja)

1. console.cloud.google.com → bikin project "Danchi".
2. **Google Auth Platform → Branding**: nama app Danchi, email support lu.
3. **Audience**: External. Tambahin `vyraruka@gmail.com` sama `rafiarsya.work@gmail.com` ke **Test users**.
4. **Clients → Create client → Web application**:
   * Authorized JavaScript origins: `https://danchi.rafiarsya.com`, `http://localhost:3000`
   * Authorized redirect URIs: `https://danchi.rafiarsya.com/api/auth/callback/google`, `http://localhost:3000/api/auth/callback/google`
5. Copy Client ID + Secret ke `.env` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).

### Abis itu, isi `.env` di mini PC

```bash
nano ~/danchi/.env
pm2 restart danchi danchi-worker --update-env
```

* **Email (Gmail):** nyalain 2-Step Verification, bikin App Password di myaccount.google.com/apppasswords, terus isi `SMTP_USER` sama `SMTP_PASS`. Password-nya ditulis **tanpa spasi**.
* **Gemini:** isi `GEMINI_API_KEY` (ambil di aistudio.google.com/apikey). Kalau `gemini-2.5-flash` udah gak kebuka buat key lu, app otomatis pindah ke `GEMINI_FALLBACK_MODEL`.
* **Push:** key VAPID udah dibikinin otomatis. Jangan diganti, soalnya kalau diganti semua HP harus nyalain notif lagi.

### Di HP dia (Android)

1. Buka https://danchi.rafiarsya.com di Chrome, terus login.
2. Chrome menu ⋮ → **Add to Home screen** (biar kayak app).
3. **Settings → Turn on notifications → Send me a test.**
4. (Opsional) **Settings → Pinned status on the phone**. Kalau mau tampilan pill di atas layar, install app "Dynamic Island" Android (misalnya dynamicSpot), terus kasih izin notifikasi.

Push cuma jalan lewat HTTPS (domain) atau localhost.

### Backup offsite (sangat disarankan)

Tambahin `RESTIC_REPOSITORY`, `RESTIC_PASSWORD`, plus kredensial bucket-nya (misalnya `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` buat R2) ke `.env`. `scripts/backup.sh` bakal ngirim salinan terenkripsi ke luar rumah.

## Catatan keamanan

* `.env` jangan pernah di-commit. Repo GitHub-nya sebaiknya dibikin **private**.
* Password disimpen sebagai hash (Better Auth), sesi pakai cookie httpOnly.
* Login dibatasi 6 kali gagal per 15 menit per IP + email. Kode email berlaku 10 menit, maksimal 5 kali coba.
* `/api/live` cuma ngirim "ada yang berubah", bukan isi datanya. Datanya tetep diambil lewat halaman yang dicek session-nya.
* Viewer gak bisa ngubah apa pun, dicek di server di setiap action (kecuali nulis love note).
* **Dia yang pegang kendali privasi**: di Settings, Privacy dia bisa milih bagian mana yang boleh Rafi buka. Ini dicek di server di setiap halaman, search, calendar, island, file, dan jawaban Chichi buat Rafi. Cycle dan halaman jurnal yang ditandai privat gak pernah keliatan Rafi.
* **Transparan**: tiap Rafi buka Danchi kecatat, dia bisa liat di Settings.
* **PIN lock** opsional per orang, nempel di cookie httpOnly yang ditandatangani, kekunci lagi setelah 1/5/15/60 menit gak dipake. Salah 5x jeda 5 menit, salah 10x device-nya di-sign out. Lupa PIN: login Google ulang.
* **Alert login baru** (push + email) tiap ada sesi baru, plus daftar device dengan tombol sign out jarak jauh.
* Header keamanan: CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy.
* Data dia bisa di-download kapan aja (Settings, Your data is yours). Backup malam juga nyimpen folder upload.
* Jujur aja: Rafi yang pegang server, jadi secara teknis bisa buka database. Ini ditulis juga di Settings biar dia tau dari awal.

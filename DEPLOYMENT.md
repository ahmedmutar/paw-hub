# Deployment — PawCare

Stack deploy:
- **Backend (API)**: Railway — Fastify + Prisma, persistent service (bukan serverless), Postgres managed di Railway juga.
- **Frontend (web)**: Vercel — static build hasil `vite build`, auto-deploy tiap push ke `main`.
- **Mobile**: belum di-deploy (masih tahap development). Nanti pakai EAS Build — lihat catatan di bagian akhir dokumen ini.
- **CI**: GitHub Actions (`.github/workflows/ci.yml`) — typecheck + test tiap push/PR ke `main`, sebagai gate sebelum Railway/Vercel auto-deploy jalan.

## 0. Prasyarat

- Akun GitHub, Railway, Vercel (buat sendiri — Claude tidak bisa membuat akun untuk Anda).
- Repo ini sudah di-`git init` di root project (bukan lagi ikut ke home directory) dan sudah ada commit awal.
- Push dulu ke GitHub sebelum lanjut ke langkah Railway/Vercel, karena keduanya connect via GitHub App:
  ```bash
  gh repo create <nama-repo> --private --source=. --remote=origin
  git push -u origin main
  ```
  (Ganti `<nama-repo>`, atau buat manual di github.com lalu `git remote add origin <url>` + `git push -u origin main`.)

## 1. Setup Database + Backend (Railway)

1. Buka [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → pilih repo ini.
2. Railway akan minta pilih service. Tambahkan dua service dalam satu project:
   - **PostgreSQL** (dari template Railway, satu klik) — otomatis dapat `DATABASE_URL`.
   - **API service**: pilih repo yang sama, lalu di **Settings → Root Directory**, set ke `api`. Ini penting karena repo ini monorepo (root punya `frontend/`, `api/`, `mobile/`).
3. Railway otomatis deteksi Node via Nixpacks dan baca `api/railway.toml` (sudah disiapkan) untuk build/start command:
   - Build: `npm run build` (jalanin `postinstall` → `prisma generate` dulu otomatis pas `npm install`)
   - Start: `npx prisma migrate deploy && npm run start` — migration jalan otomatis tiap deploy, jadi jangan lupa selalu commit folder `prisma/migrations/` (sudah begitu dari awal).
   - Health check: `/health`
4. Set environment variables di tab **Variables** (klik "Add Variable Reference" untuk `DATABASE_URL` supaya otomatis nyambung ke service Postgres):
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   JWT_SECRET=<generate string random minimal 32 karakter, JANGAN pakai default>
   JWT_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=7d
   NODE_ENV=production
   FRONTEND_URL=https://<domain-vercel-anda>.vercel.app
   MIDTRANS_SERVER_KEY=<dari dashboard Midtrans>
   MIDTRANS_CLIENT_KEY=<dari dashboard Midtrans>
   MIDTRANS_IS_PRODUCTION=false
   ```
   `PORT` tidak perlu diset manual — Railway inject otomatis, dan kode API sudah baca `process.env.PORT`.
5. Setelah deploy pertama sukses, jalankan seed data awal (superadmin, subscription plans) sekali lewat Railway CLI:
   ```bash
   railway run --service <nama-api-service> npm run db:seed
   railway run --service <nama-api-service> npx tsx prisma/seed-plans.ts
   ```
6. Catat domain publik API dari Railway (**Settings → Networking → Generate Domain**), contoh: `https://pawcare-api.up.railway.app`. Ini yang dipakai frontend sebagai `VITE_API_URL`.

## 2. Setup Frontend (Vercel)

1. Buka [vercel.com](https://vercel.com) → **Add New → Project** → import repo GitHub yang sama.
2. Di step konfigurasi:
   - **Root Directory**: `frontend`
   - Framework preset: Vite (biasanya otomatis terdeteksi)
   - Build command & output dir sudah dikonfigurasi lewat `frontend/vercel.json` (build: `npm run build`, output: `dist`)
3. Environment variables (tab **Settings → Environment Variables**):
   ```
   VITE_API_URL=https://<domain-api-railway-anda>.up.railway.app/api
   VITE_MIDTRANS_CLIENT_KEY=<dari dashboard Midtrans, client key>
   VITE_MIDTRANS_IS_PRODUCTION=false
   ```
4. Deploy. Vercel otomatis kasih domain `*.vercel.app`; bisa tambah custom domain nanti di **Settings → Domains**.
5. **Update balik** env `FRONTEND_URL` di Railway dengan domain final Vercel ini (langkah 1.4), supaya CORS di backend cocok. Redeploy backend setelah ubah env var.

## 3. Alur deploy sehari-hari

Setelah setup awal di atas beres, alur kerja rutinnya:

```
git push origin main
   │
   ├─→ GitHub Actions (.github/workflows/ci.yml)
   │     jalanin typecheck + test untuk api, frontend, mobile
   │     (ini gate kualitas — tidak menghentikan deploy Railway/Vercel,
   │      tapi kalau merah berarti ada bug yang harus dicek sebelum lanjut)
   │
   ├─→ Railway auto-deploy backend (kalau ada perubahan di folder api/)
   │     build → prisma migrate deploy → start
   │
   └─→ Vercel auto-deploy frontend (kalau ada perubahan di folder frontend/)
         build → publish ke CDN
```

Kedua platform mendeteksi path yang berubah, jadi push yang cuma mengubah `mobile/` tidak akan trigger rebuild backend/frontend.

## 4. Hal yang perlu diperhatikan

- **Belum ada fitur upload file** di backend saat ini (`UPLOAD_DIR` di `.env.example` masih placeholder, belum dipakai kode manapun) — jadi Railway ephemeral filesystem belum jadi masalah. **Begitu ada fitur upload (misal foto pasien/resep/gudang), setup Railway Volume dulu** (Settings → Volumes, mount ke path yang dipakai) sebelum fitur itu dipakai di production, supaya file tidak hilang tiap deploy.
- **Midtrans production**: saat siap go-live sungguhan (bukan sandbox), ganti `MIDTRANS_IS_PRODUCTION=true` + server/client key production di Railway & Vercel, dan update webhook URL di dashboard Midtrans ke `https://<domain-api>/api/billing/webhook`.
- **Backup database**: Railway Postgres punya backup otomatis di paket berbayar — cek dashboard Railway untuk aktifkan/atur retensi.
- **Secrets**: jangan commit `.env` (sudah di `.gitignore`). `JWT_SECRET` di production wajib random & kuat, jangan pakai default dari `.env.example`.

## 5. Mobile (belum di-deploy, untuk referensi nanti)

Belum ada urgensi deploy mobile karena masih tahap development bertahap. Saat siap:
- **EAS Build** (`npx eas build`) untuk compile APK/IPA — perlu akun Expo + `eas.json` (belum dibuat, dibuat nanti saat tahap ini mulai).
- `EXPO_PUBLIC_API_URL` di `mobile/.env` production diarahkan ke domain Railway yang sama dengan frontend web.
- Publish ke Google Play / App Store adalah proses submission manual terpisah (butuh akun developer masing-masing platform, biaya sekali/tahunan) — di luar scope otomatisasi CI/CD ini.

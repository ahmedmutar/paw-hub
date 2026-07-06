# Deployment — PawCare

Stack deploy:
- **Backend (API)**: Railway — Fastify + Prisma, persistent service (bukan serverless), Postgres managed di Railway juga.
- **Frontend (web)**: Vercel — static build hasil `vite build`, auto-deploy sesuai branch (lihat strategi branch di bawah).
- **Mobile**: belum di-deploy (masih tahap development). Nanti pakai EAS Build — lihat catatan di bagian akhir dokumen ini.
- **CI**: GitHub Actions (`.github/workflows/ci.yml`) — typecheck + test tiap push/PR ke `main` atau `uat`, sebagai gate sebelum Railway/Vercel auto-deploy jalan.

## 0. Prasyarat

- Akun GitHub, Railway, Vercel (buat sendiri — Claude tidak bisa membuat akun untuk Anda).
- Repo sudah dibuat di GitHub: `https://github.com/ahmedmutar/paw-hub` — sudah di-push berisi branch `main` dan `uat`.

## 0.5 Strategi Branch: UAT vs Production

Dua branch, dua environment terpisah (database, domain, env var masing-masing):

```
uat    → environment UAT (testing sebelum rilis)
main   → environment Production (yang dipakai pelanggan asli)
```

Alur kerja untuk tiap enhancement/perbaikan:

```
1. Kerjakan perubahan → commit → push ke branch "uat"
2. Railway (service UAT) + Vercel (branch uat) otomatis deploy ke environment UAT
3. Tes di environment UAT sampai yakin aman
4. Kalau sudah oke: buat Pull Request "uat → main" di GitHub, lalu merge
5. Railway (service Prod) + Vercel (production) otomatis deploy ke environment Production
```

Ini butuh **dua service Railway** (satu untuk UAT, satu untuk Prod — masing-masing dengan Postgres sendiri supaya data testing tidak campur dengan data pelanggan asli) dan **satu project Vercel** yang sudah otomatis membedakan build production (`main`) vs branch lain (`uat` dapat domain preview/alias sendiri) — detail di langkah 1 dan 2 di bawah.

## 1. Setup Database + Backend (Railway) — dua service: UAT dan Prod

Ulangi langkah ini **dua kali** — sekali untuk UAT, sekali untuk Prod. Bisa dua project Railway terpisah (lebih rapi, direkomendasikan) atau dua service dalam satu project.

1. Buka [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → pilih repo `ahmedmutar/paw-hub`.
2. Di **Settings → Source**, set **Branch** ke `uat` (untuk environment UAT) atau `main` (untuk environment Prod). Railway auto-deploy tiap kali branch itu di-push.
3. Tambahkan **PostgreSQL** (dari template Railway, satu klik) di masing-masing project/environment — **jangan pakai database yang sama untuk UAT dan Prod**, supaya data testing tidak bercampur dengan data pelanggan asli.
4. Untuk service API: di **Settings → Root Directory**, set ke `api` (penting karena repo ini monorepo).
5. Railway otomatis deteksi Node via Nixpacks dan baca `api/railway.toml` (sudah disiapkan) untuk build/start command:
   - Build: `npm run build` (jalanin `postinstall` → `prisma generate` dulu otomatis pas `npm install`)
   - Start: `npx prisma migrate deploy && npm run start` — migration jalan otomatis tiap deploy, jadi jangan lupa selalu commit folder `prisma/migrations/` (sudah begitu dari awal).
   - Health check: `/health`
6. Set environment variables di tab **Variables** (klik "Add Variable Reference" untuk `DATABASE_URL` supaya otomatis nyambung ke service Postgres di project/environment yang sama):
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   JWT_SECRET=<generate string random minimal 32 karakter, BEDA antara UAT dan Prod, JANGAN pakai default>
   JWT_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=7d
   NODE_ENV=production
   FRONTEND_URL=https://<domain-vercel-uat-atau-prod-anda>
   MIDTRANS_SERVER_KEY=<dari dashboard Midtrans>
   MIDTRANS_CLIENT_KEY=<dari dashboard Midtrans>
   MIDTRANS_IS_PRODUCTION=false
   ```
   `PORT` tidak perlu diset manual — Railway inject otomatis, dan kode API sudah baca `process.env.PORT`. **Untuk UAT, tetap pakai Midtrans sandbox** (`MIDTRANS_IS_PRODUCTION=false`) meskipun Prod nanti sudah pakai key production — supaya testing pembayaran di UAT tidak memicu transaksi asli.
7. Setelah deploy pertama sukses, jalankan seed data awal (superadmin, subscription plans) sekali per environment lewat Railway CLI:
   ```bash
   railway run --service <nama-api-service> npm run db:seed
   railway run --service <nama-api-service> npx tsx prisma/seed-plans.ts
   ```
8. Catat domain publik API dari Railway (**Settings → Networking → Generate Domain**) untuk masing-masing environment, contoh: `https://pawcare-api-uat.up.railway.app` dan `https://pawcare-api.up.railway.app`. Ini yang dipakai frontend sebagai `VITE_API_URL`.

## 2. Setup Frontend (Vercel) — satu project, dua environment lewat branch

Vercel bisa menangani UAT & Prod dalam **satu project** karena punya konsep "Production Branch" bawaan:

1. Buka [vercel.com](https://vercel.com) → **Add New → Project** → import repo `ahmedmutar/paw-hub`.
2. Di step konfigurasi:
   - **Root Directory**: `frontend`
   - Framework preset: Vite (biasanya otomatis terdeteksi)
   - Build command & output dir sudah dikonfigurasi lewat `frontend/vercel.json` (build: `npm run build`, output: `dist`)
3. Setelah project dibuat, ke **Settings → Git**: pastikan **Production Branch** di-set ke `main`. Branch lain (termasuk `uat`) otomatis dapat "Preview Deployment" dengan domain acak tiap kali di-push.
4. Supaya UAT punya **domain tetap** (bukan acak tiap deploy), ke **Settings → Domains** → tambah domain (misal `uat.pawcare.app` atau pakai subdomain vercel `pawcare-uat.vercel.app`) → saat menambah, pilih opsi "assign to a specific branch" dan pilih branch `uat`. Sekarang setiap push ke `uat` selalu update ke domain ini.
5. Environment variables (tab **Settings → Environment Variables**) — Vercel bisa beda nilai per environment (Production vs Preview). Set:
   ```
   VITE_API_URL=https://<domain-api-railway-sesuai-environment>/api
   VITE_MIDTRANS_CLIENT_KEY=<dari dashboard Midtrans, client key>
   VITE_MIDTRANS_IS_PRODUCTION=false
   ```
   Gunakan domain Railway UAT untuk environment "Preview" dan domain Railway Prod untuk environment "Production" (Vercel punya toggle environment saat isi env var).
6. Deploy. **Update balik** env `FRONTEND_URL` di masing-masing service Railway (UAT/Prod) dengan domain Vercel yang sesuai (langkah 1.6), supaya CORS di backend cocok. Redeploy backend setelah ubah env var.

## 3. Alur deploy sehari-hari

Setelah setup awal di atas beres, alur kerja rutin untuk setiap enhancement/perbaikan:

```
git push origin uat  (semua kerjaan baru masuk sini dulu)
   │
   ├─→ GitHub Actions (.github/workflows/ci.yml)
   │     jalanin typecheck + test untuk api, frontend, mobile
   │
   ├─→ Railway (service UAT) auto-deploy backend
   │     build → prisma migrate deploy → start
   │
   └─→ Vercel (branch uat) auto-deploy frontend ke domain UAT
         build → publish

        ↓  setelah ditest & dipastikan aman di UAT

Pull Request "uat → main" di GitHub → review → Merge
   │
   ├─→ GitHub Actions jalan lagi untuk main
   │
   ├─→ Railway (service Prod) auto-deploy backend
   │
   └─→ Vercel (branch main / production) auto-deploy frontend ke domain Prod
```

Kedua platform mendeteksi path yang berubah, jadi push yang cuma mengubah `mobile/` tidak akan trigger rebuild backend/frontend. **Jangan pernah push langsung ke `main`** — selalu lewat `uat` dulu, baru merge via PR, supaya ada jejak review dan production tidak pernah kena perubahan yang belum ditest.

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

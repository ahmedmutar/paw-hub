# PawCare Mobile

Aplikasi mobile PawCare (React Native + Expo). Dibangun bertahap — tahap 1: Login + Dashboard.

## Menjalankan

```bash
cd mobile
npm start
```

Scan QR code dengan aplikasi **Expo Go** (Android/iOS), atau tekan `i`/`a` di terminal untuk simulator.

## Koneksi ke API

Backend Fastify harus jalan di `api/` (`npm run dev`, default port 3001).

Secara default mobile app connect ke `http://localhost:3001/api`, yang **hanya berfungsi di simulator/emulator** (karena `localhost` di situ mengarah ke komputer dev).

Jika testing di **HP fisik lewat Expo Go**, buat file `.env` di folder `mobile/`:

```
EXPO_PUBLIC_API_URL=http://<IP-LAN-KOMPUTER>:3001/api
```

Cari IP LAN dengan `ipconfig getifaddr en0` (Mac).

## Status Tahapan

- [x] Setup project Expo + TypeScript
- [x] API client + auth store (persist via AsyncStorage)
- [x] Login
- [x] Dashboard (ringkasan hari ini, stok minim, omzet bulanan)
- [x] Navigasi bottom-tab (Beranda, Antrian, Pasien, Janji Temu, Kasir) + stack per tab
- [x] Pasien (list + search + pagination, detail + riwayat kunjungan)
- [x] Appointment (list + stats header + filter status, detail + aksi cepat: konfirmasi/tolak dengan alasan/jadwal ulang dengan pemilihan jam/jadikan antrian)
- [x] Pendaftaran/Antrian (antrian hari ini + filter status, detail + aksi cepat: terima/tolak/batalkan sesuai role)
- [x] Pemeriksaan (mulai periksa, isi vital & anamnesa & diagnosa, simpan, tandai selesai, + tambah/hapus layanan/item gudang/kelompok obat)
- [x] Kasir/Pembayaran (antrian tagihan, rincian layanan/item/obat, pilih metode bayar, diskon, proses bayar)
- [x] Rekam Medis (kartu rekam medis, riwayat berat, vaksinasi, obat cacing, tindakan, riwayat kunjungan — read-only, diakses dari detail Pasien)
- [x] Notifikasi staf (backend baru: model + endpoint + trigger stok menipis/booking baru/antrian baru; mobile: bell icon + badge di Dashboard, layar daftar notifikasi + tandai terbaca)
- [x] Gudang & Barcode (list + cari + filter menipis/habis, detail + catat mutasi stok masuk/keluar/opname, scan barcode pakai kamera untuk lookup cepat)
- [x] Jadwal Dokter (kalender mingguan per dokter/hari dengan navigasi minggu, ajukan cuti untuk dokter, approve/tolak cuti untuk admin — akses dari Dashboard)
- [x] Rawat Inap (stats + filter status + cari, daftarkan pasien baru dengan pilih pasien/dokter, detail dengan aksi terima/tolak/discharge — akses dari Dashboard)
- [x] Pet Hotel (tab Booking/Kamar/Kalender, booking dengan cek pasien+kamar+tanggal, check-in/batalkan/bayar & check-out sesuai role, tambah kamar untuk admin, catat & lihat riwayat perawatan harian per booking — akses dari Dashboard)
- [x] Grooming (tab Antrian/Riwayat/Paket, daftar sesi dengan pilih pasien+paket+groomer, aksi mulai/selesai/tandai lunas/batalkan sesuai role, tambah paket untuk admin — akses dari Dashboard, disembunyikan untuk role dokter karena backend tidak memberi akses ke modul ini)

**Tier 1 & Tier 2 selesai semua.**

Tier 3 — progres:
- ~~Booking staff inbox~~ — hasil riset: bukan gap nyata (semua Appointment memang berasal dari booking publik, tidak ada field yang membedakan "inbox" dari data yang sudah ada). Sebagai gantinya, 3 gap parity dengan web di modul Appointment sudah ditutup: stats header, jadwal ulang (pilih tanggal + slot jam), dan alasan penolakan yang sekarang benar-benar terkirim ke backend (sebelumnya dikirim kosong).
- [x] Reminder (khusus admin/superadmin — backend admin-only untuk semua endpoint-nya): stats jatuh tempo 7/30 hari + terkirim hari ini + gagal, tab Jatuh Tempo (filter tipe vaksinasi/obat cacing + rentang hari + cari, kirim manual per item), tab Log Pengiriman (filter status), tombol Jalankan Scan (pilih rentang hari, scan manual di luar cron otomatis jam 08:00) — akses dari Dashboard, disembunyikan untuk role selain admin/superadmin
- ~~Symptom Checker~~ — hasil riset: bukan fitur staf, ini alat publik/marketing tanpa auth di halaman klinik publik, keyword-matching sederhana tanpa alur kerja staf. Diputuskan skip, tidak dibangun di mobile.
- [x] Review & Loyalty:
  - **Bug backend ditemukan & diperbaiki**: endpoint `/loyalty/earn` sudah ada sejak awal tapi tidak pernah dipanggil di mana pun — pembayaran selesai tidak pernah otomatis memberi poin ke pelanggan. Sekarang di-wire ke `POST /pembayaran` (non-blocking, no-op kalau program loyalty cabang tidak aktif) lewat helper baru `api/src/lib/loyalty.ts`.
  - Mobile: kartu Poin Loyalty di layar Pembayaran (saldo poin + tier + tukar poin jadi diskon otomatis mengisi field diskon), dan layar Ulasan Pelanggan khusus admin/superadmin (daftar ulasan dengan filter rating + toggle publikasi + badge "Perlu Follow-up" untuk rating ≤2⭐, tab Statistik dengan distribusi rating & rata-rata per dokter) — akses dari Dashboard.
- [x] Telemed (bukan video call sungguhan — backend hanya wrapper booking/case-management, tidak ada integrasi SDK video/link meeting apa pun): stats bulan ini (khusus admin/superadmin), filter status, request konsultasi baru (pilih pasien+dokter+channel chat/video+jadwal), detail dengan aksi sesuai role: konfirmasi (dokter/admin), catatan dokter + e-resep + selesaikan (dokter/admin, otomatis kirim e-resep via WA), tandai lunas (admin/kasir) — akses dari Dashboard untuk semua role.

**Tier 3 selesai.**

Modul back-office (prioritas tinggi — sering dicek dari HP):
- [x] Laporan Keuangan (tab Harian: navigasi tanggal + omzet/pengeluaran/laba-rugi + breakdown metode bayar & kategori pengeluaran; tab Bulanan: navigasi bulan + growth badge vs bulan lalu + breakdown bar chart) — tidak ada export Excel/print di mobile (perilaku desktop-only, tidak relevan untuk HP) — akses dari Dashboard, semua role.
- [x] Lab (list + filter status, request lab baru dengan pilih pasien+jenis pemeriksaan dari template/bebas+prioritas, input hasil terstruktur sesuai template dengan rentang normal atau bebas teks + interpretasi dokter + toggle "siap" yang otomatis kirim notifikasi WA ke pemilik, riwayat lab lengkap per pasien dari detail Pasien) — akses dari Dashboard, semua role (backend tidak membatasi role sama sekali untuk modul ini).
- [x] User/Kelola Staf (khusus admin/superadmin — backend admin-only untuk hampir semua endpoint kecuali `/user/dokter`) — **scope dipersempit dengan sengaja karena alasan keamanan** (HP lebih rawan hilang/dicuri dibanding komputer kantor):
  - Ada di mobile: lihat daftar staf (cari + filter role/status), lihat detail, edit info kontak non-sensitif (nama/email/no.HP/alamat — TIDAK termasuk role/username/cabang meski API sebenarnya izinkan ubah role), toggle aktif/nonaktif (reversibel, low-risk), reset password (dengan konfirmasi eksplisit + peringatan bahwa sesi aktif akan terhapus).
  - **Sengaja TIDAK ada di mobile**: buat akun staf baru, hapus akun, ubah role/cabang — semua ini tetap harus lewat web. Alasan: ini aksi bernilai tinggi/sulit dibalik (privilege escalation, penerbitan kredensial baru) yang lebih aman dikerjakan di lingkungan yang lebih terkontrol.

Modul back-office prioritas sedang/rendah:
- [x] Cabang — **bug kebocoran data antar-tenant ditemukan & diperbaiki**: `GET /cabang` untuk role admin tidak filter berdasarkan tenant sama sekali (admin satu klinik bisa lihat semua cabang klinik lain), `POST /cabang` tidak set `tenantId` saat buat cabang baru, dan endpoint `PUT`/`PATCH toggle-status`/`DELETE` tidak verifikasi kepemilikan tenant sebelum ubah/hapus (IDOR). Diperbaiki di `api/src/modules/cabang/cabang.routes.ts` pakai helper `tenantFilter()` yang sudah dipakai konsisten di modul lain.
  - Mobile: **read-only** (lihat daftar cabang + detail dengan statistik & daftar staf) — sengaja tidak ada buat/edit/hapus di mobile karena itu konfigurasi tingkat tenant yang jarang diubah, lebih aman lewat web. Akses dari Dashboard, semua role (backend sudah otomatis scope non-admin ke cabang sendiri saja).
- [x] Layanan — **dikerjakan pakai TDD sungguhan** (test ditulis dulu → jalan & gagal (red) → kode diperbaiki → test lolos (green)), karena ditemukan bug IDOR yang **lebih parah dari Cabang**: semua endpoint by-id (`GET/PUT/PATCH/DELETE /layanan/:id`, `GET/PUT /layanan/kategori/:id`, `POST/GET /layanan/:id/harga`) sama sekali tidak cek kepemilikan cabang — staf cabang manapun bisa baca/ubah/hapus data harga layanan cabang lain hanya dengan menebak ID, dan modul ini sebelumnya tidak punya test sama sekali. 9 test baru ditulis di `api/src/__tests__/routes/layanan.test.ts` (memverifikasi 404 untuk akses lintas-cabang di 7 endpoint + 2 kontrol positif), lalu kode di `api/src/modules/layanan/layanan.routes.ts` diperbaiki sampai semua lolos.
  - Mobile: **read-only** (daftar layanan + filter kategori & cari + harga saat ini) — sama seperti Cabang, buat/edit/hapus tetap di web karena harga adalah data yang butuh riwayat/preview margin yang lebih nyaman diisi di layar besar. Akses dari Dashboard, semua role.
- [x] Pengeluaran — **dikerjakan pakai TDD sungguhan**, dan ditemukan bug IDOR **paling parah dari 3 modul yang sudah diaudit** karena modul ini sama sekali tidak punya `requireRole` — bukan cuma admin, staf level terendah pun bisa mengubah/menghapus catatan pengeluaran cabang lain hanya dengan menebak ID (endpoint `PUT`/`DELETE /pengeluaran/:id` sebelumnya `findUnique` langsung tanpa filter cabang/tenant sama sekali). Selain itu untuk role admin, `GET /pengeluaran/stats` dan `/pengeluaran` (list) dan `/pengeluaran/rekap-bulanan` pakai filter kosong `{}` — bocor data keuangan lintas tenant, karena model `Expense` tidak punya kolom `tenantId` langsung (cuma relasi lewat `branch`). `POST /pengeluaran` juga menerima `branchId` titipan dari admin tanpa verifikasi bahwa cabang itu benar milik tenant-nya. 7 test baru ditulis di `api/src/__tests__/routes/pengeluaran.test.ts` (RED 6/7 gagal), diperbaiki lewat helper `expenseBranchFilter()` di `api/src/modules/pengeluaran/pengeluaran.routes.ts` (GREEN 7/7, full suite 132/132).
  - Mobile: **beda dari Cabang/Layanan** — modul ini dapat fitur **catat pengeluaran baru** (bukan cuma read-only), karena riset menilai ini genuinely kasus "on-the-go" (staf bayar sesuatu di tempat — bensin, sparepart alat — langsung catat dari HP tanpa nunggu balik ke kantor). Layar menampilkan stats (hari ini/bulan ini/growth vs bulan lalu), filter kategori, daftar pengeluaran, dan tombol tambah dengan form (kategori, nama item, jumlah, harga satuan dengan preview total, catatan). Edit/hapus sengaja tidak ada di mobile (tetap di web) — dan backend belum punya field upload foto struk sama sekali, itu fitur terpisah kalau nanti dibutuhkan. Akses dari Dashboard, semua role (backend tidak punya `requireRole` untuk modul ini).
- [x] Penggajian & Pajak — **dikerjakan pakai TDD sungguhan**, murni backend security fix, **sengaja tidak ada screen mobile**. Bug IDOR ditemukan di dua modul:
  - `Penggajian`: `GET /penggajian/:id` sebelumnya **tidak punya `requireRole` sama sekali** — staf level apapun dari cabang/tenant manapun bisa lihat slip gaji lengkap (gaji pokok, tunjangan, semua komponen) orang lain hanya dengan menebak ID. `PUT`/`DELETE /penggajian/:id` punya `requireRole('admin')` tapi tidak ada cek kepemilikan cabang/tenant sama sekali. `POST /penggajian` juga menerima `branchId` titipan tanpa verifikasi bahwa cabang itu milik tenant admin tersebut (bug yang sama seperti Pengeluaran). 7 test baru + 3 test lama yang sudah ada di `api/src/__tests__/routes/penggajian.test.ts` (total 10), diperbaiki lewat helper `payrollBranchFilter()` di `api/src/modules/penggajian/penggajian.routes.ts` (pola sama seperti `expenseBranchFilter` karena model `Payroll` juga tidak punya kolom `tenantId` langsung).
  - `Pajak`: `PATCH /pajak/user/:userId/ptkp` (ubah status PTKP & NPWP karyawan untuk perhitungan pajak) melakukan `user.update` langsung tanpa cek kepemilikan tenant — admin bisa mengubah data pajak karyawan klinik lain. Diperbaiki pakai `tenantFilter()` yang sudah ada (model `User` punya kolom `tenantId` langsung, beda dari `Payroll`). 2 test baru di `api/src/__tests__/routes/pajak.test.ts`.
  - Full suite: 34 file test, 141/141 lolos. `tsc --noEmit` bersih.
  - **Kenapa tidak ada mobile**: data gaji karyawan adalah data paling sensitif yang disentuh sesi ini — bahkan setelah bug IDOR diperbaiki, siapapun yang login di cabang yang sama masih bisa lihat slip gaji kolega satu cabang (itu desain otorisasi yang sudah ada sejak awal, di luar scope perbaikan IDOR ini). Menaruh ini di HP menambah risiko besar kalau HP hilang/dicuri, sama seperti alasan kenapa scope mobile User dipersempit. Tidak ada juga kebutuhan "on-the-go" yang nyata untuk hitung/lihat gaji — ini kerja back-office yang wajar dikerjakan di komputer kantor.
- [x] Marketplace (integrasi Tokopedia/Shopee) — **dikerjakan pakai TDD sungguhan**, bug IDOR paling telanjang yang ditemukan sejauh ini: `PATCH /marketplace/orders/:id` (ubah status pesanan) melakukan `update` langsung tanpa cek kepemilikan **apapun** — bukan cuma lupa cek tenant, model `MarketplaceOrder` bahkan tidak punya kolom `branchId` sama sekali (cuma relasi lewat `integrationId -> MarketplaceIntegration.branchId`, yang tidak pernah dijoin/dicek). Admin dari cabang manapun bisa ubah/batalkan pesanan marketplace cabang lain hanya dengan menebak ID. `DELETE /:id/disconnect` dan `POST /:id/sync` juga sama — `update`/`findUnique` langsung by id tanpa filter `branchId`, padahal endpoint list/stats di modul yang sama sudah konsisten pakai `branchId`. 5 test baru ditambahkan ke `api/src/__tests__/routes/marketplace.test.ts` (RED 2/9 gagal — sebagian bug "tersamar" 200 palsu karena mock method yang salah, bukan filter yang benar), diperbaiki di `api/src/modules/marketplace/marketplace.routes.ts` dengan menambah `findFirst({ where: { id, branchId } })` (untuk integrasi) dan `findFirst({ where: { id, integration: { branchId } } })` (untuk order, lewat relasi) sebelum tiap mutasi — mengikuti pola `branchId`-langsung yang sudah dipakai modul ini (bukan tenant-wide seperti modul lain), supaya konsisten. Full suite: 34 file, 145/145 lolos.
  - Mobile: **beda dari Cabang/Layanan (read-only) dan beda juga dari Billing (tidak ada mobile sama sekali)** — modul ini dapat scope campuran. Koneksi toko baru (`connect`, butuh access token API) dan putus/sync integrasi tetap **web-only** karena itu setup akun sekali-jalan dengan kredensial sensitif. Tapi progres status pesanan (menunggu → diproses → dikirim → selesai/batalkan) adalah kerja harian genuinely on-the-go — staf bisa cek & proses pesanan marketplace dari HP tanpa perlu buka laptop. Layar mobile: stats (toko terhubung/menunggu/pendapatan), filter status, daftar pesanan dengan tombol aksi sesuai status saat ini. Akses dari Dashboard, semua role (backend tidak membatasi role selain `requireRole('admin')` di semua endpoint modul ini).
- [ ] Broadcast WA, Petshop, Audit log, Analytics/BI, Calendar sync — belum dikerjakan, lebih cocok dikerjakan di web/desktop atau menunggu prioritas eksplisit.

## Mode Ganda: Staf & Pemilik Hewan (Customer Portal)

Atas permintaan agar biaya deployment tidak dobel, app ini sekarang punya **dua mode dalam satu aplikasi** — bukan app terpisah:

- **Login screen** (`src/screens/LoginScreen.tsx`) punya toggle "Staf Klinik" / "Pemilik Hewan". Staf pakai username+password seperti biasa. Pemilik hewan pakai **login OTP via WhatsApp** (masukkan no. HP terdaftar → terima kode 6 digit → verifikasi), reuse endpoint portal yang sudah ada di backend (`/portal/request-otp`, `/portal/verify-otp`) — tidak ada perubahan backend untuk fitur ini.
- Kedua mode punya **auth store & API client terpisah** (`src/stores/portalAuth.store.ts` + `src/lib/portalApi.ts` untuk customer, terpisah dari `auth.store.ts` + `lib/api.ts` untuk staf) karena token portal (JWT `type: owner_portal`, berlaku 24 jam, tanpa refresh token) sama sekali berbeda mekanismenya dari token staf (access+refresh token).
- `App.tsx` mengecek kedua store: kalau staf login → `RootNavigator` (semua fitur di atas), kalau pemilik hewan login → `CustomerNavigator` (navigator baru, terpisah total, tidak overlap dengan menu staf).
- **Fitur mode Pemilik Hewan** (`src/screens/customer/`): daftar hewan peliharaan dengan badge pengingat jatuh tempo vaksin/obat cacing (merah kalau ≤7 hari), detail per hewan dengan 3 tab — Riwayat Kunjungan (keluhan, diagnosa, instruksi pulang), Jadwal (riwayat & jadwal berikutnya vaksinasi + obat cacing), Pembayaran (riwayat invoice + rincian item).
- Kenapa satu app: menghindari biaya build/publish ganda ke App Store/Play Store. Trade-off yang diterima: kedua "aplikasi" ini berbagi codebase & bundle yang sama meski target usernya beda total (staf vs pelanggan) — perlu diperhatikan kalau nanti mau styling/branding berbeda untuk tiap mode.

Verifikasi: `tsc --noEmit` bersih, `expo-doctor` 20/20.

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
- [ ] Layanan, Broadcast WA, Billing, Pajak, Penggajian, Pengeluaran, Marketplace, Petshop, Audit log, Analytics/BI, Calendar sync — belum dikerjakan, lebih cocok dikerjakan di web/desktop atau menunggu prioritas eksplisit.

## Mode Ganda: Staf & Pemilik Hewan (Customer Portal)

Atas permintaan agar biaya deployment tidak dobel, app ini sekarang punya **dua mode dalam satu aplikasi** — bukan app terpisah:

- **Login screen** (`src/screens/LoginScreen.tsx`) punya toggle "Staf Klinik" / "Pemilik Hewan". Staf pakai username+password seperti biasa. Pemilik hewan pakai **login OTP via WhatsApp** (masukkan no. HP terdaftar → terima kode 6 digit → verifikasi), reuse endpoint portal yang sudah ada di backend (`/portal/request-otp`, `/portal/verify-otp`) — tidak ada perubahan backend untuk fitur ini.
- Kedua mode punya **auth store & API client terpisah** (`src/stores/portalAuth.store.ts` + `src/lib/portalApi.ts` untuk customer, terpisah dari `auth.store.ts` + `lib/api.ts` untuk staf) karena token portal (JWT `type: owner_portal`, berlaku 24 jam, tanpa refresh token) sama sekali berbeda mekanismenya dari token staf (access+refresh token).
- `App.tsx` mengecek kedua store: kalau staf login → `RootNavigator` (semua fitur di atas), kalau pemilik hewan login → `CustomerNavigator` (navigator baru, terpisah total, tidak overlap dengan menu staf).
- **Fitur mode Pemilik Hewan** (`src/screens/customer/`): daftar hewan peliharaan dengan badge pengingat jatuh tempo vaksin/obat cacing (merah kalau ≤7 hari), detail per hewan dengan 3 tab — Riwayat Kunjungan (keluhan, diagnosa, instruksi pulang), Jadwal (riwayat & jadwal berikutnya vaksinasi + obat cacing), Pembayaran (riwayat invoice + rincian item).
- Kenapa satu app: menghindari biaya build/publish ganda ke App Store/Play Store. Trade-off yang diterima: kedua "aplikasi" ini berbagi codebase & bundle yang sama meski target usernya beda total (staf vs pelanggan) — perlu diperhatikan kalau nanti mau styling/branding berbeda untuk tiap mode.

Verifikasi: `tsc --noEmit` bersih, `expo-doctor` 20/20.

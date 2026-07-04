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
- [x] Appointment (list + filter status, detail + aksi cepat: konfirmasi/tolak/jadikan antrian)
- [x] Pendaftaran/Antrian (antrian hari ini + filter status, detail + aksi cepat: terima/tolak/batalkan sesuai role)
- [x] Pemeriksaan (mulai periksa, isi vital & anamnesa & diagnosa, simpan, tandai selesai, + tambah/hapus layanan/item gudang/kelompok obat)
- [x] Kasir/Pembayaran (antrian tagihan, rincian layanan/item/obat, pilih metode bayar, diskon, proses bayar)
- [x] Rekam Medis (kartu rekam medis, riwayat berat, vaksinasi, obat cacing, tindakan, riwayat kunjungan — read-only, diakses dari detail Pasien)
- [x] Notifikasi staf (backend baru: model + endpoint + trigger stok menipis/booking baru/antrian baru; mobile: bell icon + badge di Dashboard, layar daftar notifikasi + tandai terbaca)
- [x] Gudang & Barcode (list + cari + filter menipis/habis, detail + catat mutasi stok masuk/keluar/opname, scan barcode pakai kamera untuk lookup cepat)
- [x] Jadwal Dokter (kalender mingguan per dokter/hari dengan navigasi minggu, ajukan cuti untuk dokter, approve/tolak cuti untuk admin — akses dari Dashboard)
- [ ] Tier 2 lanjutan: Rawat Inap, Pet Hotel, Grooming

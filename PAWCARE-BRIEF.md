# PawCare — Product Brief (untuk kebutuhan promosi & konten)

Dokumen ini berisi fakta produk PawCare apa adanya dari kondisi aplikasi saat ini, disiapkan sebagai bahan acuan untuk sesi kerja terpisah yang fokus membuat skrip sales, konten marketing, dan strategi promosi. Semua data di bawah diambil langsung dari kode aplikasi (bukan asumsi), supaya materi promosi yang dibuat nanti akurat dan bisa dipertanggungjawabkan ke calon pelanggan.

---

## 1. Apa itu PawCare

PawCare adalah **sistem manajemen klinik hewan berbasis web (SaaS/multi-tenant)**, dengan **companion mobile app** (React Native) yang sedang dibangun bertahap. Produk ini menggantikan pencatatan manual (buku/Excel) klinik hewan dengan satu platform terpadu: rekam medis, antrian, kasir, gudang obat, sampai laporan bisnis.

**Tagline & hero copy (sudah ditulis, nada "manusiawi" bukan template AI generik):**

> **Headline:** "Capek urus klinik pakai buku & Excel?"
> **Subhead:** "PawCare ngumpulin rekam medis, antrian, kasir, gudang, sampai laporan bisnis klinik hewan kamu jadi satu tempat — biar waktu kamu lebih banyak buat pasien, bukan admin."
> **CTA:** "Coba Sekarang, Gratis" — "Nggak perlu kartu kredit. Setup sendiri, ± 5 menit."

**Cerita asal-usul (dipakai di landing page, bisa jadi bahan storytelling):**

> "Kami bikin PawCare karena sering lihat teman-teman dokter hewan masih sibuk mindahin catatan dari buku ke Excel tiap malam... biar yang di depan meja periksa bisa fokus ke hal yang memang butuh mereka: merawat hewannya."
> — Tim PawCare, dibangun sambil ngobrol langsung sama klinik-klinik kecil.

---

## 2. Siapa yang pakai (persona)

**Pembeli/pengambil keputusan (buyer persona):** pemilik/manajer klinik hewan (role `admin`) — dialah yang atur langganan & billing.

**Pengguna harian (end-user, ikut menentukan apakah produk "kepake" atau tidak):**
| Role | Peran di klinik | Modul yang paling sering dipakai |
|---|---|---|
| `admin` | Pemilik/manajer klinik | Dashboard, Laporan, Billing, User |
| `dokter` | Dokter hewan | Pemeriksaan, Rekam Medis, Jadwal Dokter |
| `resepsionis` | Front desk | Pendaftaran, Appointment, Booking |
| `kasir` | Kasir | Pembayaran |
| `karyawan` | Staf umum (groomer, gudang, dll) | Grooming, Gudang |

**Segmen target paling realistis untuk konversi awal:** klinik hewan independen/kecil-menengah yang masih pakai buku atau Excel, belum punya sistem digital — bukan chain besar yang biasanya sudah punya software sendiri.

---

## 3. Masalah yang diselesaikan (pain point → solusi)

Ini adalah kerangka pesan promosi yang sudah divalidasi di landing page — pola "sebelum → sesudah" ini efektif dipakai lagi di konten lain (Instagram carousel, script video, dll):

| Sebelum (pain) | Sesudah (dengan PawCare) |
|---|---|
| Catatan di buku, dicari 10 menit | Tinggal ketik nama/ID, langsung muncul |
| Reminder vaksin kelewat | WA reminder otomatis |
| Stok obat tiba-tiba habis | Notifikasi stok menipis |
| Rekap kas semalaman | Dashboard otomatis terhitung |
| Telepon terus untuk booking | Pemilik hewan booking sendiri dari HP |

---

## 4. Fitur unggulan (3 flagship, ditonjolkan di landing page)

1. **Rekam Medis** — riwayat kunjungan tiap hewan tersimpan otomatis, tidak pernah hilang, bisa dicari kapan saja.
2. **Booking & WhatsApp Reminder** — pemilik hewan booking sendiri lewat link, sistem kirim reminder otomatis H-1 (kontrol, vaksin ulang, dll).
3. **Laporan Bisnis** — omzet, tren kunjungan, layanan terlaris — otomatis terhitung tanpa rekap manual/Excel.

---

## 5. Daftar lengkap modul (37 modul)

Untuk konten yang butuh detail teknis (misal demo, dokumentasi, atau materi sales ke klinik yang lebih besar):

| Modul | Fungsi (sudut pandang pemilik klinik) |
|---|---|
| Dashboard | Ringkasan angka penting (pasien hari ini, omzet, antrian) dalam satu layar |
| Pasien | Database pasien hewan lengkap (profil, riwayat per hewan) |
| Appointment | Kelola jadwal janji temu/kunjungan dokter |
| Pendaftaran | Loket pendaftaran & antrian pasien datang langsung |
| Pemeriksaan | Layar kerja dokter: input diagnosa & tindakan saat periksa |
| Rekam Medis | Riwayat medis lengkap tiap hewan, tersimpan otomatis per kunjungan |
| Layanan | Master data layanan/jasa klinik (harga, jenis tindakan) |
| Gudang (+ Barcode) | Manajemen stok obat/barang, termasuk scan barcode |
| Pembayaran | Kasir — proses pembayaran transaksi pasien |
| Pengeluaran | Catat & kelola pengeluaran operasional klinik |
| Laporan | Laporan bisnis (omzet, tren kunjungan, layanan terlaris) |
| Penggajian | Modul penggajian karyawan/staf klinik |
| Pet Shop | Toko produk hewan terintegrasi klinik |
| Rawat Inap | Manajemen pasien rawat inap |
| Notifikasi | Pusat notifikasi sistem (WA reminder, stok, dll) |
| Booking | Booking online mandiri oleh pemilik hewan |
| Reminder | Pengingat otomatis (vaksin ulang, kontrol) via WhatsApp |
| Portal | Portal untuk pemilik hewan melihat data hewannya sendiri |
| Grooming | Modul jasa grooming/perawatan hewan |
| Billing | Kelola paket langganan klinik, usage, upgrade |
| Superadmin | Panel internal PawCare untuk kelola semua klinik pelanggan |
| Audit | Log audit aktivitas sistem |
| Broadcast | Kirim pesan/promosi massal ke pelanggan klinik |
| Loyalty | Program loyalitas/poin pelanggan |
| Review | Kelola ulasan/testimoni dari pelanggan |
| Jadwal Dokter | Atur jadwal praktik/shift dokter |
| Pet Hotel | Modul penitipan hewan |
| Telemed | Konsultasi dokter jarak jauh (video call) |
| Lab | Manajemen pemeriksaan laboratorium |
| Symptom | Input/cek gejala, bantu diagnosa awal |
| Obat Klinis | Master data obat |
| Halaman Klinik Publik | Profil klinik yang bisa ditemukan calon pasien di internet |
| Marketplace | Modul jual-beli produk/jasa |
| Cabang | Manajemen multi-cabang dalam satu akun |
| User | Manajemen pengguna/staf & hak akses |
| Onboarding | Alur pendaftaran awal klinik baru |
| Analytics (BI) | Analitik data lebih mendalam dari laporan biasa |
| Sinkronisasi Kalender | Sinkron jadwal ke Google Calendar |
| Pajak | Perhitungan/laporan pajak transaksi |

**Fitur tambahan (chip list di landing page, kalau butuh format ringkas):** Rawat Inap & Pet Hotel, Grooming & Pet Shop, Gudang & Inventori, Telemedicine, Manajemen Lab, Loyalty & Ulasan, Multi-Cabang, Kasir & Billing, Antrian Real-time, Business Intelligence.

---

## 6. Paket harga (Subscription Plan)

| Paket | Harga/bulan | Harga/tahun (~hemat 17%) | Max Cabang | Max User | Max Pasien | Fitur eksklusif |
|---|---|---|---|---|---|---|
| **Free** | Rp 0 | Rp 0 | 1 | 3 | 100 | WA, booking, grooming, reminder, portal — semua nonaktif |
| **Starter** | Rp 299.000 | Rp 2.990.000 | 1 | 10 | 500 | WA notif, booking online, grooming, reminder (portal off) |
| **Pro** | Rp 599.000 | Rp 5.990.000 | 5 | 50 | 5.000 | Semua fitur Starter + Owner Portal |
| **Enterprise** | Rp 1.499.000 | Rp 14.990.000 | Unlimited | Unlimited | Unlimited | Semua fitur + Priority Support |

- **Free trial tanpa kartu kredit** saat daftar (status tenant otomatis `trial`, ada `trialEndsAt`).
- Halaman Billing menampilkan usage bar (pemakaian cabang/user/pasien vs limit paket) — jadi bahan upsell alami saat mendekati limit.
- Model ini cocok untuk pesan "mulai gratis dulu, upgrade kalau makin besar" — bukan hard-sell di awal.

---

## 7. Diferensiator / selling point kuat

- **Multi-cabang dalam satu akun** — relevan untuk klinik yang mau berkembang jadi beberapa cabang, laporan bisa digabung atau per-cabang.
- **Tidak perlu install apa pun** — berjalan di browser, plus companion mobile app (lihat bagian 9).
- **WhatsApp-native** — reminder & notifikasi lewat WA, bukan email/push yang sering diabaikan.
- **Data terisolasi per klinik + backup harian** (poin kepercayaan/keamanan data, sering ditanyakan calon pelanggan).
- **Dibangun sambil ngobrol langsung dengan klinik kecil** — bukan produk generik hasil riset pasar semata, ini nilai jual "dibuat oleh yang paham keseharian klinik".

---

## 8. Testimoni contoh (nada acuan, bukan kutipan verbatim untuk dipakai ulang tanpa validasi nyata)

> "drg. Sarah Amelia — Klinik Meong Sehat, Bandung" — soal otomasi kasir
> "Hendra Wijaya — Pet Care 24, Surabaya (pemilik)" — soal reminder WA
> "drg. Rizky Pratama — Praktik Mandiri, Jakarta" — soal booking yang mengurangi telepon masuk

Catatan: ini testimoni contoh yang ditulis untuk landing page, **bukan testimoni asli dari pelanggan nyata**. Untuk materi promosi resmi (iklan, brosur, dsb), testimoni ini sebaiknya diganti dengan testimoni asli begitu ada pelanggan pertama — jangan dipakai sebagai klaim faktual ke publik.

---

## 9. Status Mobile App

Companion app React Native (Expo) sedang dibangun bertahap, progress saat ini:
- ✅ Login & Dashboard
- ✅ Pasien (list, cari, detail + riwayat kunjungan)
- ✅ Appointment (list, filter status, aksi cepat konfirmasi/tolak/jadikan antrian)
- ✅ Pendaftaran/Antrian (antrian harian, aksi terima/tolak/batalkan)
- ✅ Pemeriksaan (input vital & diagnosa dokter, tandai selesai)
- ⏳ Kasir/Pembayaran, picker layanan & obat — menyusul

Ini bisa jadi bahan pesan "PawCare bisa diakses dari HP juga" untuk klinik yang stafnya lebih sering mobile daripada di depan komputer.

---

## 10. Cara kerja onboarding (untuk skrip demo/sales)

1. **Daftar klinik** (± 5 menit) — via halaman `/daftar`, tanpa kartu kredit.
2. **Atur layanan** — isi data cabang, daftar layanan, produk, dan tim (staf).
3. **Mulai jalan** — langsung bisa dipakai operasional harian.

---

## 11. Yang perlu diperhatikan saat bikin konten promosi

- Target pesan **ke pemilik/pengelola klinik**, bukan ke pemilik hewan peliharaan (produk ini B2B, bukan konsumen langsung) — kecuali untuk konten yang sengaja menyasar portal pemilik hewan sebagai fitur tambahan.
- Testimoni di atas **fiktif/contoh**, jangan dipakai sebagai klaim ke publik sebelum ada pelanggan nyata.
- Nada komunikasi yang sudah terbukti cocok: santai, bahasa sehari-hari (bukan bahasa korporat kaku), fokus ke masalah nyata sehari-hari klinik — bukan jargon teknis fitur.

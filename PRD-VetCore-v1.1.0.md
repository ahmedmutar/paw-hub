# PRODUCT REQUIREMENTS DOCUMENT
# VetCore — Sistem Manajemen Klinik Hewan Berbasis SaaS
### *Dirancang khusus untuk pasar Indonesia*

---

| Atribut | Detail |
|---|---|
| **Versi** | 1.1.0 |
| **Tanggal** | 20 Juni 2026 |
| **Author** | Product Team |
| **Status** | DRAFT — For Review |
| **Klasifikasi** | CONFIDENTIAL |

---

## Daftar Isi

1. [Executive Summary](#1-executive-summary)
2. [Tech Stack & Arsitektur](#2-tech-stack--arsitektur)
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [Feature Inventory & Phase Mapping](#4-feature-inventory--phase-mapping)
5. [Feature Completeness Matrix](#5-feature-completeness-matrix)
6. [Release Phases & Roadmap](#6-release-phases--roadmap)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [Acceptance Criteria — Phase 3](#8-acceptance-criteria--phase-3)
9. [Open Questions & Decisions Needed](#9-open-questions--decisions-needed)
10. [Glossary](#10-glossary)
11. [Rekomendasi Fitur Tambahan — Priority Matrix](#11-rekomendasi-fitur-tambahan--priority-matrix)

---

## 1. Executive Summary

VetCore adalah platform Software-as-a-Service (SaaS) manajemen operasional klinik hewan yang dirancang khusus untuk pasar Indonesia. Sistem ini mengintegrasikan seluruh alur kerja klinik dalam satu platform terpadu.

### Visi & Misi

- **Visi:** Menjadi platform manajemen klinik hewan #1 di Indonesia yang membantu 1.000+ klinik beroperasi lebih efisien dan profitabel dalam 3 tahun.
- **Misi:** Digitalisasi operasional klinik hewan Indonesia dari pencatatan manual ke sistem terintegrasi yang mudah dipakai, terjangkau, dan dapat diandalkan.

### Target Market

- Klinik hewan skala kecil-menengah (1–10 dokter)
- Klinik dengan multi-layanan: klinik + pet shop + grooming
- Jaringan/franchise klinik hewan (multi-cabang)
- Estimasi Total Addressable Market (TAM): **3.000–5.000 klinik aktif di Indonesia**

### Business Model — Subscription SaaS

| Paket | Harga/Bulan | Target Segmen |
|---|---|---|
| **Starter** | Rp 299.000 | Klinik 1 dokter, 1 cabang, fitur dasar |
| **Pro** | Rp 599.000 | Klinik 2–5 dokter, multi-role, laporan lengkap |
| **Klinik Plus** | Rp 999.000 | Multi-cabang, gudang, pet shop, penggajian |
| **Enterprise** | Rp 2.500.000+ | Jaringan klinik/franchise, custom, SLA |

> 🎯 **Revenue Target:** Rp 50.000.000/bulan profit bersih dalam 12 bulan post-launch

---

## 2. Tech Stack & Arsitektur

### Backend
- **Runtime:** Node.js + Fastify v4
- **ORM:** Prisma v5
- **Database:** PostgreSQL
- **Auth:** JWT (access token + refresh token via httpOnly cookie)
- **API Style:** REST JSON

### Frontend
- **Framework:** React 18 + Vite + TypeScript
- **Styling:** TailwindCSS
- **State:** Zustand (auth) + React Query v5 (server state)
- **Routing:** React Router v6

### Infrastructure (Target SaaS)

| Komponen | Pilihan Teknologi |
|---|---|
| Hosting | Railway / DigitalOcean App Platform |
| Database | Managed PostgreSQL (Supabase atau Neon) |
| Media Storage | Cloudflare R2 / AWS S3 |
| WhatsApp API | Fonnte API / Wablas |
| Email Transaksional | Resend |
| Payment Gateway | Midtrans (VA, QRIS, Kartu Kredit) |
| CDN | Cloudflare |

### Multi-tenant Architecture
- **Model:** Row-level isolation dengan `tenantId` pada setiap tabel
- **Subdomain:** `namaKlinik.vetcore.id` → tenantId resolver
- **Data isolation:** Setiap klinik hanya bisa akses data miliknya sendiri
- **Middleware:** `tenantId` diekstrak dari subdomain/JWT, diinjeksi ke semua query

---

## 3. User Roles & Permissions

| Role | Deskripsi | Akses Utama |
|---|---|---|
| `super_admin` | Tim VetCore Internal | Semua klinik, billing, tenant management |
| `admin` | Owner / Manager Klinik | Semua fitur dalam satu klinik/cabang |
| `dokter` | Dokter Hewan | Pemeriksaan, rekam medis, resep obat |
| `resepsionis` | Staff Front Desk | Pendaftaran, antrian, data pasien |
| `kasir` | Staff Kasir | Pembayaran klinik & pet shop |
| `karyawan` | Staff Umum | Gudang, pengeluaran (terbatas) |

---

## 4. Feature Inventory & Phase Mapping

---

### Phase 0 — Foundation ✅ SELESAI

#### [F-01] Autentikasi & Manajemen Sesi — ✅ SELESAI

Login dengan username/password, JWT access token, refresh token (httpOnly cookie), logout.

- **Schema:** `User`, `RefreshToken`
- **API:** `POST /masuk`, `POST /refresh`, `POST /keluar`

---

#### [F-02] Manajemen Cabang — ✅ SELESAI

CRUD cabang, kode cabang unik, jam operasional, instruksi pembayaran, toggle aktif/nonaktif.

- **Schema:** `Branch`
- **API:** `GET/POST/PUT/DELETE /cabang`

---

#### [F-03] Manajemen User & Staff — ✅ SELESAI

CRUD user, multi-role, filter per cabang, toggle aktif, reset password, data personal lengkap.

- **Schema:** `User`
- **API:** `GET/POST/PUT/DELETE /user`

---

### Phase 1 — Core Clinic Workflow ✅ SELESAI

#### [F-04] Data Pasien (Hewan) — ✅ SELESAI

CRUD pasien (hewan) dan data pemilik (owner) terpisah, kategori hewan, jenis kelamin, usia, member ID, filter & search.

- **Schema:** `Patient`, `Owner`
- **API:** `GET/POST/PUT/DELETE /pasien`, `GET /pasien/:id/detail`

---

#### [F-05] Rekam Medis Permanen — ✅ SELESAI

Kartu rekam medis per hewan (1 hewan = 1 kartu), riwayat berat badan, vaksinasi dengan tanggal jatuh tempo, obat cacing, tindakan besar.

- **Schema:** `MedicalRecord`, `WeightRecord`, `VaccinationRecord`, `DewormingRecord`, `MajorProcedureRecord`
- **API:** `GET/PUT /rekam-medis/:patientId`, `/rekam-medis/:id/vaksinasi`, `/deworming`, `/prosedur`

---

#### [F-06] Pendaftaran & Manajemen Antrian — ✅ SELESAI

Pendaftaran kunjungan rawat jalan, nomor antrian otomatis, prioritas darurat, filter status antrian, accept/decline oleh dokter.

- **Schema:** `Registration`, `DoctorAcceptance`
- **API:** `GET/POST/PUT /registrasi`, `GET /registrasi/antrian`

---

#### [F-07] Pemeriksaan (SOAP Notes & Resep) — ✅ SELESAI

Input anamnesa, vital signs (berat, suhu, HR, RR), diagnosa, prognosa, instruksi pulang, resep obat, layanan/tindakan, kelompok obat.

- **Schema:** `CheckUpResult`, `DetailItemPatient`, `DetailServicePatient`, `DetailMedicineGroupResult`
- **API:** `GET/POST/PUT /pemeriksaan/:registrationId`

---

#### [F-08] Layanan & Jasa — ✅ SELESAI

CRUD kategori layanan, CRUD layanan, manajemen harga dengan riwayat harga (price history), toggle aktif/nonaktif.

- **Schema:** `ServiceCategory`, `ListOfService`, `PriceService`
- **API:** `GET/POST/PUT/DELETE /layanan/kategori`, `/layanan/layanan`, `/layanan/harga`

---

### Phase 2 — Operational Modules ✅ SELESAI

#### [F-09] Gudang & Inventori Klinik — ✅ SELESAI

CRUD kategori & satuan barang, CRUD barang (obat/supplies), manajemen harga dengan riwayat, mutasi stok, stok minimum alert.

- **Schema:** `CategoryItem`, `UnitItem`, `ListOfItem`, `PriceItem`, `StockMovement`
- **API:** `/gudang/kategori`, `/gudang/satuan`, `/gudang/barang`, `/gudang/mutasi`, `/gudang/stats`, `/gudang/low-stock`

---

#### [F-10] Kasir & Pembayaran Klinik — ✅ SELESAI

Antrian kasir pasien selesai periksa, tampilan tagihan detail (obat + layanan), diskon, metode bayar, kembalian, riwayat pembayaran.

- **Schema:** `ListOfPayment`, `ListOfPaymentItem`, `ListOfPaymentService`, `PaymentMethod`
- **API:** `/pembayaran/antrian-kasir`, `/pembayaran/tagihan/:checkUpId`, `/pembayaran`, `/pembayaran/stats`

---

#### [F-11] Pengeluaran Operasional — ✅ SELESAI

CRUD pengeluaran dengan 7 kategori, auto-kalkulasi total (qty × harga), rekap bulanan per kategori, statistik growth vs bulan lalu.

- **Schema:** `Expense`
- **API:** `/pengeluaran`, `/pengeluaran/stats`, `/pengeluaran/rekap-bulanan`

---

#### [F-12] Dashboard Eksekutif — ✅ SELESAI

6 KPI cards (registrasi, antrian aktif, checkup, pending kasir, omzet, transaksi), trend chart 7 hari, top 5 layanan, stok menipis alert, auto-refresh 60 detik.

- **Schema:** Agregat semua model
- **API:** `/dashboard/stats`

---

#### [F-13] Laporan Keuangan — ✅ SELESAI

Laporan Harian (P&L, breakdown metode bayar & kategori), Laporan Bulanan (trend harian/mingguan, growth %), Laporan Rekap custom period dengan P&L statement formal.

- **Schema:** Agregat `ListOfPayment` + `Expense`
- **API:** `/laporan/harian`, `/laporan/bulanan`, `/laporan/rekap`, `/laporan/ringkasan`

---

### Phase 3 — Extended Services ❌ BELUM DIMULAI

> *Target penyelesaian: Bulan 1–2 setelah PRD ini disetujui. Milestone: Produk feature-complete untuk satu klinik.*

#### [F-14] Penggajian Staf — ⚠️ SCHEMA ONLY `P0 — KRITIS`

Sistem perhitungan gaji karyawan dengan komponen kompleks berbasis kinerja. Dibutuhkan setiap bulan oleh admin.

**Fitur Detail:**
- Input gaji pokok per karyawan
- Tunjangan akomodasi
- Bonus berbasis omzet klinik (% dari total turnover)
- Bonus rawat inap (jumlah pasien × tarif/pasien)
- Bonus operasi/bedah (% dari nilai tindakan operasi)
- Bonus grooming (jumlah sesi × tarif/sesi)
- Pengurang/minus turnover
- Auto-kalkulasi total gaji bersih
- Slip gaji digital (print-friendly)
- Rekap penggajian per bulan & per karyawan
- Proteksi duplikasi: 1 slip per karyawan per bulan per tahun

- **Schema:** `Payroll` (sudah ada: `basicSallary`, `accomodation`, `percentageTurnover`, `amountTurnover`, `totalTurnover`, `minusTurnover`, `amountInpatient`, `countInpatient`, `totalInpatient`, `percentageSurgery`, `amountSurgery`, `totalSurgery`, `amountGrooming`, `countGrooming`, `totalGrooming`, `totalOverall`)
- **API:** `GET/POST/PUT/DELETE /penggajian`, `GET /penggajian/slip/:id`, `GET /penggajian/rekap`

---

#### [F-15] Pet Shop (Penjualan Produk) — ⚠️ SCHEMA ONLY `P0 — KRITIS`

Kasir pet shop untuk penjualan produk retail (makanan hewan, aksesoris, vitamin) yang berbeda dari stok klinik.

**Fitur Detail:**
- Manajemen produk pet shop (terpisah dari barang klinik)
- Daftar harga produk pet shop
- Kasir: pilih produk, qty, diskon, metode bayar
- Dua jenis item: retail (PaymentPetshopItem) + item klinik dijual di petshop (PaymentClinicPetshopItem)
- Riwayat transaksi pet shop
- Laporan penjualan pet shop (terpisah dari klinik)
- Manajemen stok produk pet shop

- **Schema:** `ListOfItemPetShop`, `PriceItemPetShop`, `PaymentPetshop`, `PaymentPetshopItem`, `PaymentClinicPetshopItem`, `MasterPaymentPetshop` (semua sudah ada)
- **API:** `/petshop/produk`, `/petshop/harga`, `/petshop/kasir`, `/petshop/transaksi`, `/petshop/stats`

---

#### [F-16] Rawat Inap (Inpatient) — ⚠️ SCHEMA ONLY `P1`

Manajemen pasien rawat inap dari admission hingga discharge, terintegrasi dengan sistem pembayaran.

**Fitur Detail:**
- Pendaftaran rawat inap (dari klinik atau langsung/emergensi)
- Input estimasi lama rawat (estimateDay) vs aktual (realityDay)
- Status: pending → accepted → discharged
- Monitoring daftar pasien rawat inap aktif
- Integrasi discharge dengan kasir
- Laporan kapasitas & pendapatan rawat inap

- **Schema:** `InPatient` (sudah ada: `estimateDay`, `realityDay`, `acceptanceStatus`)
- **API:** `GET/POST/PUT/DELETE /rawat-inap`, `GET /rawat-inap/aktif`

---

### Phase 4 — Smart Features ❌ BELUM DIMULAI

> *Target penyelesaian: Bulan 3–5. Milestone: Killer features yang membedakan dari kompetitor.*

#### [F-17] Notifikasi WhatsApp Otomatis — ❌ BELUM DIMULAI `P0 — KILLER FEATURE`

Pengiriman notifikasi otomatis via WhatsApp ke pemilik hewan untuk setiap event penting. Fitur yang paling sering ditanyakan oleh calon pelanggan.

**Fitur Detail:**
- Konfirmasi nomor antrian saat pendaftaran
- Notifikasi "giliran sudah tiba" ke pemilik
- Reminder vaksinasi H-7 sebelum tanggal jatuh tempo
- Reminder obat cacing H-7 sebelum tanggal jatuh tempo
- Struk/ringkasan pembayaran setelah transaksi
- Notifikasi update kondisi pasien rawat inap (harian)
- Log semua pengiriman WhatsApp

- **Schema:** `WhatsappLog` (BARU: `id`, `recipientPhone`, `type`, `message`, `status`, `sentAt`, `patientId?`, `registrationId?`)
- **API:** `POST /notif/wa/send`, `GET /notif/log` — Provider: Fonnte API / Wablas

---

#### [F-18] Sistem Booking & Appointment Online — ❌ BELUM DIMULAI `P1`

Halaman booking publik per klinik (`namaKlinik.vetcore.id/booking`) untuk pemilik hewan buat jadwal konsultasi tanpa telepon.

**Fitur Detail:**
- Halaman booking publik: pilih dokter, tanggal, jam
- Input keluhan singkat & data hewan (bisa tanpa login)
- Konfirmasi booking via WhatsApp
- Admin bisa approve/decline/reschedule booking
- Booking otomatis masuk antrian pada hari-H
- Kalender jadwal dokter (view per dokter/hari)

- **Schema:** `Appointment` (BARU: `id`, `patientId?`, `ownerName`, `ownerPhone`, `petName`, `petCategory`, `doctorUserId`, `appointmentDate`, `appointmentTime`, `complaint`, `status`, `branchId`, `notes`)
- **API:** `POST /booking` (public), `GET/PUT /appointment` (admin), `PUT /appointment/:id/approve`

---

#### [F-19] Reminder & Alert System (Cron) — ❌ BELUM DIMULAI `P1`

Sistem reminder otomatis berbasis jadwal (cron job harian) untuk vaksinasi dan obat cacing yang akan jatuh tempo.

**Fitur Detail:**
- Cron harian: scan `VaccinationRecord.nextDueAt` & `DewormingRecord.nextDueAt`
- Auto-kirim WhatsApp reminder ke nomor pemilik hewan
- Dashboard alert: daftar hewan jatuh tempo bulan ini
- Log pengiriman reminder per pasien

- **Schema:** `ReminderLog` (BARU: `id`, `type`, `patientId`, `dueDate`, `sentAt`, `status`, `channel`)
- **API:** `GET /reminder/upcoming`, `POST /reminder/send-manual`

---

#### [F-20] Owner / Pemilik Portal — ❌ BELUM DIMULAI `P2`

Portal web read-only untuk pemilik hewan melihat riwayat medis, jadwal vaksin, dan riwayat pembayaran.

**Fitur Detail:**
- Login via OTP WhatsApp (tanpa username/password)
- Lihat semua hewan peliharaan milik owner
- Lihat riwayat kunjungan & diagnosa
- Lihat jadwal vaksinasi & obat cacing berikutnya
- Download/cetak struk pembayaran

- **Schema:** `OwnerOTP` (BARU: `id`, `ownerId`, `otp`, `expiresAt`, `used`)
- **API:** `POST /portal/request-otp`, `POST /portal/verify-otp`, `GET /portal/my-pets`

---

### Phase 5 — SaaS Infrastructure ❌ BELUM DIMULAI

> *Target penyelesaian: Bulan 2–3. Milestone: Sistem siap onboard 10 klinik beta secara mandiri.*

#### [F-21] Grooming / Salon Standalone — ❌ BELUM DIMULAI `P2`

Manajemen sesi grooming yang bisa berdiri sendiri tanpa harus melalui jalur pemeriksaan klinik.

**Fitur Detail:**
- Pendaftaran sesi grooming (tidak butuh dokter)
- Paket grooming (mandi, potong kuku, cukur bulu, dll)
- Antrian grooming terpisah dari antrian klinik
- Kasir grooming (terintegrasi ke pembayaran)
- Rekap pendapatan grooming per groomer

- **Schema:** `GroomingSession` (BARU: `id`, `patientId`, `groomerId`, `packageId`, `status`, `scheduledAt`, `completedAt`, `branchId`, `notes`)
- **API:** `/grooming/antrian`, `/grooming/sesi`, `/grooming/stats`

---

#### [F-22] Multi-Tenant Architecture — ❌ BELUM DIMULAI `P0 — WAJIB SEBELUM LAUNCH SAAS`

Arsitektur yang memungkinkan ratusan klinik menggunakan satu deployment dengan isolasi data penuh antar tenant.

**Fitur Detail:**
- Tambah field `tenantId` pada semua tabel utama
- Middleware: ekstrak `tenantId` dari subdomain/JWT, injeksi ke semua Prisma query
- Subdomain routing: `namaKlinik.vetcore.id` → tenantId resolver
- Super admin dashboard: monitoring semua tenant
- Tenant onboarding flow: registrasi → setup → trial otomatis

- **Schema:** `Tenant` (BARU: `id`, `clinicName`, `subdomain`, `plan`, `billingStatus`, `trialEndsAt`), `TenantSubscription`
- **API:** `POST /tenant/register`, `GET /tenant/me`, `GET /superadmin/tenants`

---

#### [F-23] Self-Service Onboarding — ❌ BELUM DIMULAI `P0`

Alur registrasi mandiri untuk klinik baru tanpa perlu bantuan CS. Syarat utama untuk scale.

**Fitur Detail:**
- Form registrasi: nama klinik, subdomain, nama admin, email, password
- Wizard setup 3 langkah: data klinik → cabang pertama → data awal (kategori, metode bayar)
- Trial 14 hari gratis otomatis setelah registrasi
- Email welcome + link panduan memulai
- Checklist onboarding di dashboard (% completion)

- **Schema:** `Tenant`, `Branch`, `User` (setup wizard)
- **API:** `POST /register-tenant`, `GET /onboarding/checklist`, `PUT /onboarding/step/:step`

---

#### [F-24] Billing & Subscription Management — ❌ BELUM DIMULAI `P0`

Sistem pengelolaan langganan dan pembayaran SaaS terintegrasi dengan payment gateway Indonesia.

**Fitur Detail:**
- 4 paket aktif (Starter/Pro/Klinik Plus/Enterprise)
- Pembayaran via Midtrans (VA bank, QRIS, kartu kredit)
- Auto-reminder jatuh tempo H-7 dan H-3
- Grace period 3 hari setelah jatuh tempo sebelum akses dikunci
- Riwayat invoice & unduh bukti bayar PDF
- Upgrade/downgrade paket mandiri
- Super admin: extend trial & override paket manual

- **Schema:** `Invoice`, `Subscription` (BARU)
- **API:** `POST /billing/checkout`, `GET /billing/invoices`, `POST /billing/upgrade`

---

#### [F-25] Export Laporan (PDF & Excel) — ❌ BELUM DIMULAI `P1`

Kemampuan export semua laporan ke format PDF dan Excel untuk keperluan akuntansi dan arsip.

**Fitur Detail:**
- Export laporan keuangan harian/bulanan/rekap ke PDF
- Export data pasien ke Excel
- Export rekap penggajian ke Excel (format slip gaji)
- Export mutasi stok ke Excel
- Cetak struk pembayaran (format 58mm thermal printer)

- **API:** `GET /laporan/harian/export?format=pdf|xlsx`, `GET /penggajian/slip/:id/export`

---

#### [F-26] Mobile Responsive & PWA — ❌ BELUM DIMULAI `P1`

Optimisasi tampilan mobile dan Progressive Web App agar sistem bisa diakses dari smartphone.

**Fitur Detail:**
- Semua halaman responsive untuk layar 375px–768px (iPhone SE dan atas)
- PWA: bisa install di homescreen Android & iOS
- Offline mode untuk fitur antrian & pendaftaran
- Push notification via browser untuk notif antrian real-time
- Optimisasi khusus untuk dokter via tablet

- **API:** Service Worker, Web App Manifest, PWA icons

---

### Phase 7 — Value-Add Quick Wins ⭐ REKOMENDASI BARU

> *Fitur-fitur ini memiliki impact tinggi dengan effort relatif rendah dan dapat menjadi differentiator utama VetCore vs kompetitor.*

#### [F-27] Sertifikat Digital (Vaksin, Sehat, Sterilisasi) — 🆕 REKOMENDASI `P0 — DIFFERENTIATOR UTAMA`

Generate sertifikat digital resmi dengan QR code verifikasi untuk vaksinasi, kesehatan, dan tindakan medis. Tidak ada kompetitor lokal yang punya fitur ini.

**Fitur Detail:**
- Sertifikat Vaksinasi digital — dibutuhkan untuk masuk pet hotel & naik pesawat
- Surat Keterangan Sehat — wajib untuk penerbangan domestik & ekspor hewan
- Sertifikat Sterilisasi/Kastrasi — bukti resmi tindakan dengan nomor SIP dokter
- Format PDF berkop surat klinik + logo + nomor SIP + barcode unik
- QR code verifikasi keaslian dokumen — bisa discan siapa saja
- Auto-kirim via WhatsApp ke pemilik setelah pemeriksaan selesai
- Arsip digital semua sertifikat per hewan

- **Schema:** `VaccinationRecord`, `MajorProcedureRecord`, `CheckUpResult` (sudah ada)
- **API:** `GET /sertifikat/vaksin/:vaccinationId`, `GET /sertifikat/sehat/:checkUpId`, `GET /sertifikat/prosedur/:procedureId`

---

#### [F-28] Broadcast & CRM WhatsApp — 🆕 REKOMENDASI `P0 — MARKETING ENGINE`

Fitur marketing langsung dari dalam VetCore untuk kirim pesan massal ke semua pelanggan klinik berdasarkan segmentasi data.

**Fitur Detail:**
- Blast WA ke semua owner: promo, info klinik, ucapan hari raya
- Segmentasi otomatis: filter by jenis hewan, last visit > 3 bulan, area, frekuensi kunjungan
- Template pesan yang bisa dikustomisasi admin klinik
- Re-engagement campaign: "Sudah 3 bulan [Nama Hewan] belum check-up..."
- Jadwal kirim: blast langsung atau jadwalkan untuk tanggal/jam tertentu
- Analytics: jumlah terkirim, gagal, dan konversi ke booking
- Log riwayat semua broadcast

- **Schema:** `Owner`, `Patient`, `Registration` (sudah ada) + `BroadcastLog` (BARU)
- **API:** `POST /broadcast/send`, `GET /broadcast/log`, `GET /broadcast/analytics`

---

#### [F-29] Loyalty Program & Membership Digital — 🆕 REKOMENDASI `P1`

Sistem poin reward dan tier membership untuk meningkatkan retensi pelanggan klinik.

**Fitur Detail:**
- Poin reward otomatis setiap kunjungan atau transaksi (configurable oleh admin)
- Tier member: Basic, Silver, Gold berdasarkan total spend atau jumlah kunjungan
- Penukaran poin: diskon transaksi, free layanan, atau prioritas antrian
- Digital member card dengan QR code (kirim via WA saat pertama daftar)
- Dashboard owner: saldo poin, riwayat poin, benefit aktif saat ini
- Admin: konfigurasi rules poin, lihat semua member per tier

- **Schema:** `LoyaltyPoint`, `LoyaltyTier` (BARU: `id`, `ownerId`, `totalPoints`, `tierLevel`, `branchId`)
- **API:** `/loyalty/point`, `/loyalty/redeem`, `/loyalty/member/:ownerId`, `/loyalty/config`

---

#### [F-30] Rating & Ulasan Pasca-Kunjungan — 🆕 REKOMENDASI `P1`

Survey kepuasan otomatis via WhatsApp H+1 setelah kunjungan, untuk evaluasi kinerja dokter dan kualitas layanan.

**Fitur Detail:**
- Auto-kirim WA survey H+1: "Bagaimana pengalaman [Nama Hewan] kemarin? Reply 1-5"
- Owner cukup reply angka 1–5 (tidak perlu buka app)
- Admin lihat rata-rata rating per dokter, per layanan, dan per bulan
- Testimoni terbaik (rating 5) bisa dipilih untuk dipublikasikan di halaman publik
- Alert otomatis ke admin jika ada rating ≤ 2 (perlu follow-up)
- Laporan tren kepuasan bulanan

- **Schema:** `ReviewRecord` (BARU: `id`, `registrationId`, `patientId`, `doctorId`, `rating`, `comment`, `sentAt`, `repliedAt`)
- **API:** `/review/send`, `/review/list`, `/review/stats`, `/review/public/:tenantSlug`

---

#### [F-31] Manajemen Jadwal Dokter & Shift — 🆕 REKOMENDASI `P0 — PREREQUISITE BOOKING`

Sistem pengaturan jadwal kerja, shift, dan kapasitas antrian per dokter. Wajib ada sebelum fitur Booking Online (F-18) bisa berfungsi optimal.

**Fitur Detail:**
- Setup jadwal mingguan per dokter (hari kerja, jam mulai, jam selesai)
- Manajemen shift: pagi/siang/malam untuk klinik yang buka 2 shift
- Kapasitas antrian: maksimum pasien per dokter per hari/shift
- Kalender visual semua dokter dalam satu tampilan (week view)
- Dokter bisa request cuti/izin, admin approve/decline
- Integrasi dengan booking: hanya tampilkan dokter yang tersedia sesuai jadwal
- Notifikasi jadwal minggu depan dikirim ke dokter setiap Minggu malam

- **Schema:** `DoctorSchedule` (BARU: `id`, `doctorId`, `dayOfWeek`, `shiftStart`, `shiftEnd`, `maxPatients`, `branchId`), `DoctorLeave` (BARU)
- **API:** `/jadwal-dokter`, `/jadwal-dokter/:doctorId`, `/jadwal-dokter/kalender`

---

#### [F-35] Barcode / QR Scanner Gudang — 🆕 REKOMENDASI `P1`

Scan barcode/QR code untuk operasional gudang dan kasir menggunakan kamera smartphone, menghilangkan error input manual.

**Fitur Detail:**
- Generate barcode/QR unik untuk setiap barang di gudang
- Scan via kamera HP browser (tidak perlu app terpisah)
- Scan saat input mutasi stok: scan → auto-isi nama dan detail barang
- Scan saat pemeriksaan: dokter scan obat → langsung masuk DetailItemPatient
- Scan saat kasir: verifikasi obat yang diambil dari gudang sesuai resep
- Cek stok instan: scan → tampil nama, stok tersisa, harga saat ini
- Print label barcode untuk ditempel di rak stok

- **Schema:** `ListOfItem` (tambah field `barcodeId`), `BarcodeLabel` (BARU)
- **API:** `/gudang/barcode/generate/:itemId`, `/gudang/barcode/scan`, `/gudang/barcode/print`

---

#### [F-38] Halaman Publik Klinik (Landing Page) — 🆕 REKOMENDASI `P1`

Setiap klinik mendapat halaman publik SEO-ready sebagai "website klinik gratis" bagian dari langganan VetCore.

**Fitur Detail:**
- URL: `namaKlinik.vetcore.id` — subdomain unik per klinik
- Konten: nama klinik, alamat + Google Maps embed, jam operasional, daftar dokter + foto, list layanan, foto klinik
- SEO-ready: structured data (LocalBusiness schema), meta tags, sitemap otomatis
- Tombol CTA: Booking Online, WhatsApp langsung ke klinik, Telepon
- Embed ulasan terbaik (dari F-30 Rating & Ulasan)
- Direktori VetCore: `vetcore.id/klinik` → listing semua klinik terdaftar
- Admin bisa upload foto klinik & dokter langsung dari dashboard

- **Schema:** `Branch` + tambah field: `description`, `photos`, `googleMapsUrl`, `socialLinks`
- **API:** `/public/:slug` (public), `/tenant/landing-page` (admin edit)

---

### Phase 8 — Growth & Retention Features ⭐ REKOMENDASI BARU

> *Fitur yang meningkatkan nilai jangka panjang dan membuka revenue stream baru.*

#### [F-32] Pet Hotel / Penginapan Hewan — 🆕 REKOMENDASI `P1 — REVENUE STREAM BARU`

Modul manajemen penginapan hewan (pet hotel) yang lengkap dengan booking, monitoring harian, dan kasir terintegrasi.

**Fitur Detail:**
- Master kamar/kandang: daftar kamar, tipe (VIP/Reguler/Isolasi), kapasitas, harga/malam
- Booking hotel: tanggal check-in, check-out, tipe kamar, kebutuhan khusus hewan
- Kalender occupancy: visual kamar mana terisi, tersedia, atau maintenance
- Daily care log: catatan makan, minum, aktivitas, kondisi per hewan per hari
- Auto kirim foto/update kondisi hewan ke owner via WA setiap hari
- Kasir hotel: hitung otomatis total malam × tarif + layanan tambahan
- Laporan occupancy rate & pendapatan hotel per periode

- **Schema:** `HotelRoom`, `HotelBooking`, `HotelCareLog` (semua BARU)
- **API:** `/pet-hotel/kamar`, `/pet-hotel/booking`, `/pet-hotel/occupancy`, `/pet-hotel/kasir`

---

#### [F-33] Telemedicine / Konsultasi Online — 🆕 REKOMENDASI `P2`

Fitur konsultasi jarak jauh antara dokter klinik dan pemilik hewan via chat atau video call terintegrasi.

**Fitur Detail:**
- Owner request konsultasi online dari portal → dokter terima notif
- Rekam medis terintegrasi: dokter lihat riwayat pasien saat konsultasi
- E-resep digital: dokter kirim resep via WA → owner ambil di klinik atau diantar
- Billing konsultasi online: tarif terpisah, bayar via QRIS/transfer
- Rekap konsultasi online: jumlah, pendapatan, rating per dokter

- **Schema:** `TelemedSession` (BARU: `id`, `patientId`, `doctorId`, `channel`, `status`, `scheduledAt`, `fee`)
- **API:** `/telemed/request`, `/telemed/session/:id`, `/telemed/billing`

---

#### [F-34] Manajemen Lab & Hasil Pemeriksaan — 🆕 REKOMENDASI `P2`

Digitalisasi permintaan, input, dan penyimpanan hasil laboratorium sebagai bagian dari rekam medis.

**Fitur Detail:**
- Request pemeriksaan lab dari dalam SOAP notes (darah rutin, feses, rontgen, USG)
- Upload hasil lab: PDF, foto, atau input langsung di template digital
- Template hasil lab siap pakai (hematologi, kimia darah, urinalisis)
- Notifikasi owner via WA saat hasil lab sudah siap
- Riwayat lab per hewan: dokter bisa bandingkan nilai dari waktu ke waktu
- Graf tren nilai lab (hemoglobin, leukosit, dll) per kunjungan

- **Schema:** `LabRequest`, `LabResult` (BARU: `id`, `checkUpResultId`, `testType`, `resultFile`, `resultData`, `isReady`)
- **API:** `/lab/request`, `/lab/result/:id`, `/lab/history/:patientId`

---

#### [F-39] Laporan Pajak & PPh 21 Otomatis — 🆕 REKOMENDASI `P2`

Kalkulasi otomatis pajak penghasilan karyawan (PPh 21) dari data penggajian dan export ke format laporan pajak.

**Fitur Detail:**
- Hitung PPh 21 otomatis per karyawan berdasarkan total gaji dan PTKP
- Input status PTKP karyawan (TK/0, K/1, K/2, dll)
- Export laporan PPh 21 ke format Excel sesuai template e-SPT DJP
- Reminder pelaporan SPT Masa PPh 21 setiap bulan (tanggal 20)
- Rekap tahunan untuk SPT Tahunan PPh 21
- Opsi input PPN untuk klinik yang sudah PKP (Pengusaha Kena Pajak)

- **Schema:** `User` (tambah field: `ptkpStatus`, `npwp`), `Payroll` (tambah field: `pph21Amount`)
- **API:** `/pajak/pph21/rekap`, `/pajak/pph21/export`, `/pajak/pph21/reminder`

---

#### [F-40] Integrasi Google Calendar & Notifikasi Shift — 🆕 REKOMENDASI `P3`

Sinkronisasi jadwal dokter ke Google Calendar pribadi dan notifikasi jadwal mingguan.

**Fitur Detail:**
- OAuth Google: dokter otorisasi sinkronisasi kalender sekali klik
- Appointment/booking baru → langsung muncul sebagai event di Google Calendar dokter
- Dokter bisa block waktu di Google Calendar → otomatis tidak bisa dibooking
- Notifikasi WA jadwal minggu depan dikirim setiap Minggu malam
- Reminder 1 jam sebelum jadwal pertama setiap hari

- **Schema:** `DoctorCalendarSync` (BARU: `id`, `doctorId`, `googleAccessToken`, `googleRefreshToken`, `syncEnabled`)
- **API:** `/calendar/connect`, `/calendar/sync`, `/calendar/disconnect`

---

### Phase 9 — AI & Advanced Features ⭐ REKOMENDASI BARU

> *Fitur lanjutan yang memposisikan VetCore sebagai platform cerdas, bukan hanya software manajemen.*

#### [F-36] AI Symptom Checker (untuk Owner) — 🆕 REKOMENDASI `P2`

Widget AI di halaman publik klinik yang membantu pemilik hewan menilai tingkat urgensi kondisi hewan sebelum ke klinik.

**Fitur Detail:**
- Widget di `namaKlinik.vetcore.id/cek-gejala`
- Owner input gejala hewan via form/chat (gunakan Claude / GPT API)
- AI output: estimasi kondisi, tingkat urgensi (segera/dalam 24 jam/bisa tunggu/tidak perlu klinik)
- Rekomendasi: "Segera bawa ke klinik" + tombol Booking langsung
- Bukan diagnosa medis resmi — hanya panduan awal
- Data gejala yang sering dicari → insight tren penyakit untuk dokter
- Log semua konsultasi AI untuk review dokter

- **Schema:** `AiSymptomLog` (BARU: `id`, `branchId`, `inputSymptoms`, `aiResponse`, `urgencyLevel`, `createdAt`)
- **API:** `/public/symptom-checker` (public), `GET /ai/symptom-log` (admin)

---

#### [F-37] Drug Interaction & Kalkulator Dosis — 🆕 REKOMENDASI `P2`

Sistem keamanan klinis yang mendeteksi potensi interaksi obat dan membantu kalkulasi dosis berdasarkan berat hewan.

**Fitur Detail:**
- Database obat hewan umum di Indonesia dengan data interaksi
- Saat dokter tambah obat di resep, sistem auto-cek interaksi dengan obat lain dalam resep yang sama
- Alert level: kuning (perhatian) atau merah (hindari kombinasi ini)
- Kalkulator dosis: input berat hewan → sistem rekomendasikan rentang dosis aman (mg/kg)
- Catatan kontraindikasi per jenis hewan (kucing vs anjing berbeda)
- Log semua alert yang muncul (untuk audit klinis)

- **Schema:** `DrugDatabase`, `DrugInteraction` (BARU)
- **API:** `/clinical/drug-check`, `/clinical/dose-calculator`, `/clinical/drug-database` (admin)

---

#### [F-41] Business Intelligence & Analytics Lanjutan — 🆕 REKOMENDASI `P3`

Dashboard analitik mendalam untuk owner klinik memahami tren bisnis, kinerja dokter, dan prediksi stok.

**Fitur Detail:**
- Customer LTV: total spend satu owner sejak pertama daftar
- Churn detection: owner yang biasanya rutin tapi 90+ hari tidak kunjungan
- Cohort analysis: dari owner daftar bulan X, berapa % masih aktif 6 bulan kemudian
- Dokter performance: pasien per dokter, omzet per dokter, rating per dokter, perbandingan antar dokter
- Top diagnosis trend: diagnosa paling sering → insight untuk stok obat
- Forecast stok: prediksi kapan obat tertentu akan habis berdasarkan tren 90 hari
- Heatmap jam tersibuk: jam dan hari mana paling banyak pasien

- **Schema:** Agregat semua model — tidak butuh schema baru, hanya query analytics baru
- **API:** `/analytics/ltv`, `/analytics/churn`, `/analytics/doctor-performance`, `/analytics/stock-forecast`

---

#### [F-42] Integrasi Marketplace (Tokopedia/Shopee) — 🆕 REKOMENDASI `P3`

Sinkronisasi stok produk pet shop ke marketplace online, memungkinkan klinik jual produk secara online tanpa double-manage stok.

**Fitur Detail:**
- Koneksi ke Tokopedia/Shopee via Open API
- Sinkronisasi stok: saat ada pesanan online → stok di VetCore berkurang otomatis
- Sinkronisasi harga: update harga di VetCore → update otomatis di marketplace
- Dashboard pesanan: kelola semua pesanan marketplace dari satu tempat
- Laporan penjualan gabungan: klinik fisik + online dalam satu laporan
- Alert stok kritis: notif jika stok produk yang dijual online tersisa < X unit

- **Schema:** `MarketplaceIntegration` (BARU: `id`, `branchId`, `platform`, `accessToken`, `shopId`, `syncEnabled`)
- **API:** `/marketplace/connect`, `/marketplace/sync-stock`, `/marketplace/orders`

---

## 5. Feature Completeness Matrix

| Kode | Fitur | Schema | Backend | Frontend | Status |
|---|---|:---:|:---:|:---:|:---:|
| F-01 | Autentikasi | ✅ | ✅ | ✅ | **SELESAI** |
| F-02 | Manajemen Cabang | ✅ | ✅ | ✅ | **SELESAI** |
| F-03 | Manajemen User | ✅ | ✅ | ✅ | **SELESAI** |
| F-04 | Data Pasien | ✅ | ✅ | ✅ | **SELESAI** |
| F-05 | Rekam Medis | ✅ | ✅ | ✅ | **SELESAI** |
| F-06 | Pendaftaran & Antrian | ✅ | ✅ | ✅ | **SELESAI** |
| F-07 | Pemeriksaan & SOAP | ✅ | ✅ | ✅ | **SELESAI** |
| F-08 | Layanan & Jasa | ✅ | ✅ | ✅ | **SELESAI** |
| F-09 | Gudang & Inventori | ✅ | ✅ | ✅ | **SELESAI** |
| F-10 | Kasir Klinik | ✅ | ✅ | ✅ | **SELESAI** |
| F-11 | Pengeluaran | ✅ | ✅ | ✅ | **SELESAI** |
| F-12 | Dashboard | ✅ | ✅ | ✅ | **SELESAI** |
| F-13 | Laporan Keuangan | ✅ | ✅ | ✅ | **SELESAI** |
| F-14 | Penggajian | ✅ | ❌ | ❌ | ⚠️ SCHEMA ONLY |
| F-15 | Pet Shop | ✅ | ❌ | ❌ | ⚠️ SCHEMA ONLY |
| F-16 | Rawat Inap | ✅ | ❌ | ❌ | ⚠️ SCHEMA ONLY |
| F-17 | Notifikasi WhatsApp | ❌ | ❌ | ❌ | ❌ BELUM |
| F-18 | Booking & Appointment | ❌ | ❌ | ❌ | ❌ BELUM |
| F-19 | Reminder System | ❌ | ❌ | ❌ | ❌ BELUM |
| F-20 | Owner Portal | ❌ | ❌ | ❌ | ❌ BELUM |
| F-21 | Grooming Standalone | ❌ | ❌ | ❌ | ❌ BELUM |
| F-22 | Multi-Tenant | ❌ | ❌ | ❌ | ❌ BELUM |
| F-23 | Self-Service Onboarding | ❌ | ❌ | ❌ | ❌ BELUM |
| F-24 | Billing & Subscription | ❌ | ❌ | ❌ | ❌ BELUM |
| F-25 | Export PDF & Excel | ❌ | ❌ | ❌ | ❌ BELUM |
| F-26 | Mobile PWA | ❌ | ❌ | ❌ | ❌ BELUM |
| F-27 | Sertifikat Digital | ~ | ❌ | ❌ | 🆕 REKOMENDASI |
| F-28 | Broadcast & CRM WA | ~ | ❌ | ❌ | 🆕 REKOMENDASI |
| F-29 | Loyalty Program | ❌ | ❌ | ❌ | 🆕 REKOMENDASI |
| F-30 | Rating & Ulasan | ❌ | ❌ | ❌ | 🆕 REKOMENDASI |
| F-31 | Jadwal Dokter & Shift | ❌ | ❌ | ❌ | 🆕 REKOMENDASI |
| F-32 | Pet Hotel | ❌ | ❌ | ❌ | 🆕 REKOMENDASI |
| F-33 | Telemedicine | ❌ | ❌ | ❌ | 🆕 REKOMENDASI |
| F-34 | Manajemen Lab | ❌ | ❌ | ❌ | 🆕 REKOMENDASI |
| F-35 | Barcode/QR Scanner | ~ | ❌ | ❌ | 🆕 REKOMENDASI |
| F-36 | AI Symptom Checker | ❌ | ❌ | ❌ | 🆕 REKOMENDASI |
| F-37 | Drug Interaction Check | ❌ | ❌ | ❌ | 🆕 REKOMENDASI |
| F-38 | Halaman Publik Klinik | ~ | ❌ | ❌ | 🆕 REKOMENDASI |
| F-39 | Laporan Pajak PPh 21 | ~ | ❌ | ❌ | 🆕 REKOMENDASI |
| F-40 | Google Calendar Sync | ❌ | ❌ | ❌ | 🆕 REKOMENDASI |
| F-41 | Business Intelligence | ~ | ❌ | ❌ | 🆕 REKOMENDASI |
| F-42 | Integrasi Marketplace | ❌ | ❌ | ❌ | 🆕 REKOMENDASI |

**Keterangan:**
- ✅ **SELESAI** — Schema, backend API, dan frontend UI sudah selesai dan berfungsi
- ⚠️ **SCHEMA ONLY** — Schema database sudah ada, backend dan frontend belum dibangun
- ❌ **BELUM** — Belum ada di schema, backend, maupun frontend
- 🆕 **REKOMENDASI** — Fitur baru direkomendasikan (belum ada di plan awal). `~` = menggunakan schema yang sudah ada sebagian

---

## 6. Release Phases & Roadmap

### Phase Map

| Phase | Nama | Target Waktu | Fitur | Milestone |
|---|---|---|---|---|
| Phase 0 | Foundation | SELESAI ✅ | F-01, F-02, F-03 | Auth + Cabang + User |
| Phase 1 | Core Clinic | SELESAI ✅ | F-04 s/d F-08 | Alur klinik lengkap (pasien → periksa) |
| Phase 2 | Operations | SELESAI ✅ | F-09 s/d F-13 | Gudang, kasir, keuangan, laporan |
| Phase 3 | Extended Services | Bulan 1–2 | F-14, F-15, F-16 | Feature-complete untuk 1 klinik |
| Phase 4 | Smart Features | Bulan 3–5 | F-17, F-18, F-19, F-20 | WA notif, booking, reminder |
| Phase 5 | SaaS Infrastructure | Bulan 2–3 | F-22, F-23, F-24 | Siap onboard 10 klinik beta |
| Phase 6 | Scale & UX | Bulan 5–8 | F-21, F-25, F-26 | Mobile PWA, export, grooming |
| Phase 7 | Value-Add Quick Wins | Bulan 6–9 | F-27, F-28, F-30, F-31, F-35, F-38 | Sertifikat digital, CRM WA, rating, jadwal dokter |
| Phase 8 | Growth & Retention | Bulan 9–12 | F-29, F-32, F-33, F-34, F-39, F-40 | Pet hotel, telemedicine, lab, loyalty, pajak |
| Phase 9 | AI & Advanced | Tahun 2+ | F-36, F-37, F-41, F-42 | AI checker, drug interaction, BI, marketplace |

### 18-Month Revenue & Feature Roadmap

| Periode | Aktivitas Utama | Phase | Target Klinik | Est. MRR |
|---|---|---|:---:|:---:|
| Bulan 1–2 | Selesaikan Phase 3: Penggajian, Pet Shop, Rawat Inap | Phase 3 | 0 (dev) | — |
| Bulan 3 | Beta test 10 klinik gratis — collect feedback intensif | Phase 4–5 | 10 (free) | Rp 0 |
| Bulan 4 | Fix feedback → launch paket berbayar pertama | Phase 4–5 | 15–20 | Rp 7–10 Jt |
| Bulan 5–6 | WA notif + booking live. Aktifkan iklan Meta + komunitas PDHI | Phase 5 | 30–50 | Rp 15–25 Jt |
| Bulan 7–8 | Sertifikat digital (F-27) + CRM WA (F-28) — jadi highlight marketing | Phase 7 | 60–80 | Rp 30–45 Jt |
| Bulan 9 | Jadwal dokter (F-31) + Rating (F-30) + Halaman publik (F-38) | Phase 7 | 80–100 | Rp 45–55 Jt |
| Bulan 10–12 | Pet hotel (F-32) + Loyalty (F-29) + Laporan pajak (F-39) | Phase 8 | 100–150 | Rp 55–80 Jt |
| Bulan 13–15 | Lab digital (F-34) + Telemedicine (F-33) + Barcode (F-35) | Phase 8 | 150–200 | Rp 80–120 Jt |
| Bulan 16–18 | AI Symptom Checker (F-36) + BI Analytics (F-41) + Marketplace (F-42) | Phase 9 | 200+ | **Rp 120–200 Jt** |

---

## 7. Non-Functional Requirements

| Kategori | Requirement | Target |
|---|---|---|
| Performance | Response time API | < 500ms untuk 95% request |
| Performance | Page load time | < 2 detik pada koneksi 4G |
| Uptime | Availability | 99.5% per bulan (max downtime 3.6 jam/bulan) |
| Security | Autentikasi | JWT + HTTPS wajib untuk semua endpoint |
| Security | Data isolation | Tenant tidak bisa akses data tenant lain |
| Security | Password | Hashed dengan bcrypt, minimum 8 karakter |
| Scalability | Concurrent users | Hingga 20 user aktif bersamaan per klinik |
| Scalability | Database | Siap handle 1.000 klinik dengan connection pooling |
| Backup | Database backup | Daily automated backup, 30 hari retensi |
| Browser | Browser support | Chrome 90+, Firefox 90+, Safari 14+ |
| Mobile | Responsive | Minimum layar 375px (iPhone SE) |
| Compliance | Data privacy | Tidak menyimpan data sensitif medis secara plain text |

---

## 8. Acceptance Criteria — Phase 3

Berikut adalah acceptance criteria minimum untuk setiap fitur di Phase 3 sebelum dianggap selesai (Definition of Done).

### F-14: Penggajian Staf

- [ ] Admin bisa membuat slip gaji per karyawan per bulan
- [ ] Sistem menolak duplikasi: tidak bisa buat 2 slip untuk karyawan + bulan + tahun yang sama
- [ ] Total gaji dihitung otomatis: gaji pokok + tunjangan + semua komponen bonus - pengurang
- [ ] Setiap komponen bonus bisa di-input manual (override dari hitungan sistem)
- [ ] Admin bisa edit slip yang belum difinalisasi (status: draft)
- [ ] Admin bisa hapus slip yang belum difinalisasi
- [ ] Slip bisa dicetak dalam format yang rapi dan profesional
- [ ] Rekap penggajian per bulan menampilkan semua karyawan dengan total bayar

### F-15: Pet Shop

- [ ] Admin bisa tambah/edit/hapus produk pet shop (terpisah dari stok klinik)
- [ ] Admin bisa kelola daftar harga produk pet shop dengan riwayat harga
- [ ] Kasir bisa proses transaksi pet shop: pilih produk → set qty → diskon → bayar
- [ ] Transaksi pet shop mendukung dua jenis item dalam satu nota (produk retail + item klinik)
- [ ] Stok produk pet shop berkurang otomatis setiap kali ada transaksi
- [ ] Riwayat transaksi pet shop bisa difilter berdasarkan tanggal dan metode bayar
- [ ] Laporan pendapatan pet shop terpisah dari laporan pendapatan klinik

### F-16: Rawat Inap

- [ ] Resepsionis/dokter bisa mendaftarkan pasien sebagai rawat inap
- [ ] Sistem menampilkan daftar semua pasien rawat inap yang sedang aktif
- [ ] Dokter bisa update estimasi lama rawat (estimateDay)
- [ ] Dokter bisa update lama rawat aktual (realityDay) saat discharge
- [ ] Proses discharge terintegrasi dengan kasir untuk penagihan
- [ ] Laporan menampilkan jumlah pasien rawat inap per periode

---

## 9. Open Questions & Decisions Needed

Keputusan berikut perlu dibuat sebelum implementasi Phase 4 dan 5:

| # | Topik | Pertanyaan | Rekomendasi |
|:---:|---|---|---|
| 1 | Multi-tenant Strategy | Row-level isolation vs separate schema per tenant? | Row-level terlebih dahulu — lebih cepat implementasi, migrasi ke separate schema nanti jika dibutuhkan |
| 2 | WhatsApp Provider | Fonnte vs Wablas vs Meta Cloud API langsung? | Fonnte — paling populer di developer Indonesia, harga terjangkau, dokumentasi baik |
| 3 | Grooming Flow | Grooming masuk ke flow klinik (lewat Registration) atau antrian terpisah? | Antrian terpisah — groomer bukan dokter, tidak butuh SOAP notes |
| 4 | Pet Hotel | Apakah Pet Hotel masuk ke Phase 3 atau Phase 6? | Phase 6 — belum ada di schema, kompleksitas tinggi, tidak di semua klinik |
| 5 | WA Pricing | Fitur WhatsApp notif dicharge per-pesan atau flat rate per paket? | Flat rate — lebih mudah jual, tidak buat klinik takut pakai fitur |
| 6 | Product Name | "VetCore" sebagai nama produk final? | Perlu validasi ke target market sebelum launch — bisa ganti di Phase 4 |
| 7 | Export Format | Export ke PDF menggunakan puppeteer (lebih akurat) atau pdfkit (lebih ringan)? | Puppeteer — kualitas output lebih baik karena render dari HTML existing |

---

## 10. Glossary

| Istilah | Definisi |
|---|---|
| **Tenant** | Satu klinik hewan yang berlangganan VetCore. Setiap tenant punya isolasi data sendiri. |
| **Branch / Cabang** | Lokasi fisik klinik. Satu tenant bisa punya banyak cabang (multi-cabang). |
| **Patient / Pasien** | Hewan peliharaan yang terdaftar di sistem. |
| **Owner / Pemilik** | Manusia pemilik hewan. Satu owner bisa punya banyak hewan. |
| **Registration** | Satu kunjungan/sesi berobat rawat jalan. Setiap kunjungan = 1 record Registration. |
| **CheckUpResult** | Hasil pemeriksaan dokter dari satu kunjungan. Berisi SOAP notes, resep, dan tindakan. |
| **DetailItemPatient** | Obat/item yang diresepkan dalam satu pemeriksaan, beserta dosis dan harga. |
| **DetailServicePatient** | Layanan/tindakan yang dilakukan dalam satu pemeriksaan, beserta harga. |
| **ListOfPayment** | Satu transaksi pembayaran klinik. Agregasi dari item dan layanan yang dibayar. |
| **PaymentPetshop** | Satu transaksi pembayaran pet shop (terpisah dari pembayaran klinik). |
| **Payroll** | Slip gaji satu karyawan untuk satu periode bulan. |
| **Expense** | Satu catatan pengeluaran operasional klinik. |
| **StockMovement** | Satu catatan mutasi stok (masuk, keluar, atau penyesuaian). |
| **MRR** | Monthly Recurring Revenue — total pendapatan langganan per bulan. |
| **TAM** | Total Addressable Market — total pasar yang bisa dijangkau produk ini. |
| **P&L** | Profit and Loss — laporan laba rugi. |
| **SOAP** | Subjective, Objective, Assessment, Plan — format standar catatan medis. |
| **SLA** | Service Level Agreement — perjanjian tingkat layanan untuk paket Enterprise. |

---

## 11. Rekomendasi Fitur Tambahan — Priority Matrix

Analisis 16 fitur tambahan (F-27–F-42) yang direkomendasikan untuk meningkatkan nilai jual VetCore. Dikategorikan berdasarkan impact bisnis dan effort implementasi.

### Summary Matrix

| Kode | Fitur | Impact | Effort | Priority | Revenue Model | Differentiator |
|---|---|:---:|:---:|:---:|---|---|
| F-27 | Sertifikat Digital | ⭐⭐⭐⭐⭐ | Rendah | **P0** | Paket Pro+ | Tidak ada di kompetitor lokal manapun |
| F-28 | Broadcast & CRM WA | ⭐⭐⭐⭐⭐ | Sedang | **P0** | Add-on Rp 150rb/bln | Marketing engine built-in — tidak perlu tool lain |
| F-31 | Jadwal Dokter & Shift | ⭐⭐⭐⭐⭐ | Sedang | **P0** | Paket Pro+ | Wajib ada agar Booking Online bisa berfungsi |
| F-30 | Rating & Ulasan | ⭐⭐⭐⭐ | Rendah | P1 | Semua paket | Evaluasi dokter berbasis data — bukan asumsi |
| F-38 | Halaman Publik Klinik | ⭐⭐⭐⭐ | Rendah | P1 | Semua paket | Website gratis — nilai tambah nyata bagi klinik kecil |
| F-35 | Barcode/QR Scanner | ⭐⭐⭐⭐ | Sedang | P1 | Paket Pro+ | Eliminasi error input manual stok & resep |
| F-32 | Pet Hotel | ⭐⭐⭐⭐⭐ | Tinggi | P1 | Add-on Rp 299rb/bln | Revenue stream baru, belum ada software khusus di Indonesia |
| F-29 | Loyalty Program | ⭐⭐⭐⭐ | Sedang | P1 | Paket Klinik Plus+ | Retention tool — kurangi churn pelanggan klinik |
| F-34 | Manajemen Lab | ⭐⭐⭐⭐ | Sedang | P2 | Paket Pro+ | Rekam medis lebih lengkap, lebih bernilai bagi dokter |
| F-33 | Telemedicine | ⭐⭐⭐⭐ | Tinggi | P2 | Add-on Rp 199rb/bln | Jangkau pelanggan luar kota, passive income dokter |
| F-39 | Laporan Pajak PPh 21 | ⭐⭐⭐ | Sedang | P2 | Paket Pro+ | Hemat biaya akuntan Rp 500rb–2jt/bln bagi klinik |
| F-40 | Google Calendar Sync | ⭐⭐⭐ | Rendah | P3 | Semua paket | QoL dokter — adopsi sistem meningkat jika dokter nyaman |
| F-36 | AI Symptom Checker | ⭐⭐⭐⭐ | Sedang | P2 | Klinik Plus+ | Traffic magnet + lead generation organik dari Google |
| F-37 | Drug Interaction Check | ⭐⭐⭐ | Sedang | P2 | Klinik Plus+ | Patient safety — nilai klinis tinggi, kurangi risiko medis |
| F-41 | Business Intelligence | ⭐⭐⭐⭐ | Tinggi | P3 | Enterprise only | Upsell ke paket Enterprise untuk jaringan klinik besar |
| F-42 | Integrasi Marketplace | ⭐⭐⭐ | Tinggi | P3 | Add-on | Omnichannel — jual produk petshop online & offline |

---

### 🔴 Tier 1 — HIGH IMPACT, EFFORT RENDAH — Quick Win

Fitur-fitur ini memberikan dampak langsung pada daya tarik produk dan kepuasan klinik, dengan waktu implementasi relatif singkat (< 2 minggu per fitur).

#### 🏆 Top 3 Differentiator yang Harus Diprioritaskan

> **#1 F-27 Sertifikat Digital** — Tidak ada satupun software klinik hewan lokal yang punya ini. Satu fitur ini bisa jadi headline utama marketing: *"Klinik kamu bisa keluarkan sertifikat vaksin digital berbarcode yang bisa diverifikasi online."*

> **#2 F-28 Broadcast & CRM WhatsApp** — Mengubah VetCore dari "software operasional" menjadi "mesin marketing klinik." Kalimat yang langsung closing: *"Bisa blast promo ke semua pelanggan saya?" — "Bisa."*

> **#3 F-32 Pet Hotel** — Revenue stream baru yang bisa di-charge sebagai add-on terpisah. Banyak klinik punya pet hotel tapi masih catat manual di buku. ARPU meningkat Rp 299.000/bulan per klinik yang subscribe add-on ini.

---

### 🟡 Tier 2 — HIGH IMPACT, EFFORT SEDANG — Planned Investment

Fitur-fitur ini membutuhkan 2–4 minggu implementasi per fitur namun memberikan diferensiasi kompetitif jangka menengah dan membuka sumber pendapatan baru.

- **F-32 Pet Hotel:** Modul yang bisa berdiri sendiri sebagai add-on, meningkatkan ARPU signifikan
- **F-29 Loyalty Program:** Tingkatkan retention rate — klinik yang punya loyalty program rata-rata 30% lebih sedikit churn pelanggan
- **F-34 Manajemen Lab:** Rekam medis lebih lengkap = data lebih berharga = switching cost lebih tinggi bagi klinik
- **F-33 Telemedicine:** Buka segmen baru (klinik yang mau layani pelanggan jarak jauh), tambah paket premium
- **F-39 Laporan Pajak PPh 21:** Hemat biaya akuntan bulanan — ini adalah "pain point" nyata owner klinik dengan 5+ karyawan

---

### 🔵 Tier 3 — STRATEGIC LONG-TERM — Moat Builder

Fitur-fitur ini membutuhkan perencanaan lebih matang namun membangun "moat" (benteng bisnis) yang sulit ditiru kompetitor.

- **F-36 AI Symptom Checker:** Traffic magnet untuk halaman publik klinik — menghasilkan leads organik gratis dari Google
- **F-37 Drug Interaction Checker:** Memposisikan VetCore sebagai platform klinis, bukan hanya manajemen — meningkatkan persepsi kualitas di mata dokter
- **F-41 Business Intelligence:** Upsell natural ke paket Enterprise untuk jaringan/franchise klinik besar
- **F-42 Integrasi Marketplace:** Kunci ekosistem — klinik yang sudah integrasi Tokopedia/Shopee akan sangat sulit pindah ke kompetitor

---

### Proyeksi Dampak Penambahan F-27–F-42

| Metrik | Tanpa F-27–F-42 | Dengan F-27–F-42 |
|---|---|---|
| Target MRR Tahun 1 | Rp 50–70 Juta | **Rp 70–100 Juta (+30–40%)** |
| ARPU (Avg Revenue per User) | Rp 450.000/bln | **Rp 650.000/bln (+44%)** |
| Churn rate estimasi | 8–12%/bulan | **4–6%/bulan** (loyalty + lock-in) |
| Lead magnet organik | Tidak ada | AI Checker + Halaman Publik (SEO) |
| Add-on revenue stream | 0 | WA CRM + Pet Hotel + Telemedicine |
| Competitive moat | Sedang | **Tinggi** (sertifikat digital + data lock-in) |

---

*© 2026 VetCore — Hak Cipta Dilindungi | CONFIDENTIAL*

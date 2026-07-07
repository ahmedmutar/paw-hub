;(BigInt.prototype as any).toJSON = function () {
  return this.toString()
}

import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'

import prismaPlugin from './plugins/db'
import { authRoutes } from './modules/auth/auth.routes'
import { cabangRoutes } from './modules/cabang/cabang.routes'
import { userRoutes } from './modules/user/user.routes'
import { pasienRoutes } from './modules/pasien/pasien.routes'
import { rekamMedisRoutes } from './modules/rekam-medis/rekam-medis.routes'
import { registrasiRoutes } from './modules/registrasi/registrasi.routes'
import { pemeriksaanRoutes } from './modules/pemeriksaan/pemeriksaan.routes'
import { layananRoutes } from './modules/layanan/layanan.routes'
import { gudangRoutes } from './modules/gudang/gudang.routes'
import { pembayaranRoutes } from './modules/pembayaran/pembayaran.routes'
import { dashboardRoutes } from './modules/dashboard/dashboard.routes'
import { pengeluaranRoutes } from './modules/pengeluaran/pengeluaran.routes'
import { laporanRoutes } from './modules/laporan/laporan.routes'
import { penggajianRoutes } from './modules/penggajian/penggajian.routes'
import { petshopRoutes } from './modules/petshop/petshop.routes'
import { notifRoutes } from './modules/notif/notif.routes'
import { appointmentRoutes } from './modules/appointment/appointment.routes'
import { reminderRoutes } from './modules/reminder/reminder.routes'
import { startReminderCron } from './jobs/reminder.cron'
import { startTrialExpiryCron } from './jobs/trial-expiry.cron'
import { portalRoutes } from './modules/portal/portal.routes'
import { groomingRoutes } from './modules/grooming/grooming.routes'
import { tenantRoutes } from './modules/tenant/tenant.routes'
import { onboardingRoutes } from './modules/onboarding/onboarding.routes'
import { billingRoutes } from './modules/billing/billing.routes'
import { exportRoutes } from './modules/export/export.routes'
import { auditRoutes } from './modules/audit/audit.routes'
import { sertifikatRoutes } from './modules/sertifikat/sertifikat.routes'
import { broadcastRoutes } from './modules/broadcast/broadcast.routes'
import { loyaltyRoutes } from './modules/loyalty/loyalty.routes'
import { reviewRoutes } from './modules/review/review.routes'
import { jadwalDokterRoutes } from './modules/jadwal-dokter/jadwal-dokter.routes'
import { barcodeRoutes } from './modules/barcode/barcode.routes'
import { petHotelRoutes } from './modules/pet-hotel/pet-hotel.routes'
import { telemedRoutes } from './modules/telemed/telemed.routes'
import { labRoutes } from './modules/lab/lab.routes'
import { symptomRoutes } from './modules/symptom/symptom.routes'
import { clinicalRoutes } from './modules/clinical/clinical.routes'
import { publicClinicRoutes } from './modules/public-clinic/public-clinic.routes'
import { pajakRoutes } from './modules/pajak/pajak.routes'
import { calendarRoutes } from './modules/calendar/calendar.routes'
import { analyticsRoutes } from './modules/analytics/analytics.routes'
import { marketplaceRoutes } from './modules/marketplace/marketplace.routes'
import { notifikasiStaffRoutes } from './modules/notifikasi/notifikasi.routes'
import { startLowStockCron } from './jobs/low-stock.cron'

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty' }
        : undefined,
  },
})

const isProduction = process.env.NODE_ENV === 'production'

// Fail fast di production kalau secret/CORS belum dikonfigurasi dengan benar,
// daripada diam-diam fallback ke nilai yang tidak aman.
if (isProduction) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error(
      'JWT_SECRET wajib diisi (minimal 32 karakter) di production. Set env var JWT_SECRET sebelum menjalankan server.'
    )
  }
  if (!process.env.FRONTEND_URL) {
    throw new Error(
      'FRONTEND_URL wajib diisi di production supaya CORS tidak mengizinkan origin manapun. Set env var FRONTEND_URL sebelum menjalankan server.'
    )
  }
}

async function bootstrap() {
  await app.register(helmet, { contentSecurityPolicy: false })

  await app.register(cors, {
    origin: process.env.FRONTEND_URL || true,
    credentials: true,
  })

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  })

  await app.register(cookie)

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-ganti-di-production-min-32-char',
  })

  await app.register(prismaPlugin)

  // Routes
  await app.register(authRoutes, { prefix: '/api' })
  await app.register(cabangRoutes, { prefix: '/api' })
  await app.register(userRoutes, { prefix: '/api' })
  await app.register(pasienRoutes, { prefix: '/api' })
  await app.register(rekamMedisRoutes, { prefix: '/api' })
  await app.register(registrasiRoutes, { prefix: '/api' })
  await app.register(pemeriksaanRoutes, { prefix: '/api' })
  await app.register(layananRoutes, { prefix: '/api' })
  await app.register(gudangRoutes, { prefix: '/api' })
  await app.register(pembayaranRoutes, { prefix: '/api' })
  await app.register(dashboardRoutes, { prefix: '/api' })
  await app.register(pengeluaranRoutes, { prefix: '/api' })
  await app.register(laporanRoutes, { prefix: '/api' })
  await app.register(penggajianRoutes, { prefix: '/api' })
  await app.register(petshopRoutes, { prefix: '/api' })
  await app.register(notifRoutes, { prefix: '/api' })
  await app.register(appointmentRoutes, { prefix: '/api' })
  await app.register(reminderRoutes, { prefix: '/api' })
  await app.register(portalRoutes, { prefix: '/api' })
  await app.register(groomingRoutes, { prefix: '/api' })
  await app.register(tenantRoutes, { prefix: '/api' })
  await app.register(onboardingRoutes, { prefix: '/api' })
  await app.register(billingRoutes, { prefix: '/api' })
  await app.register(exportRoutes, { prefix: '/api' })
  await app.register(auditRoutes, { prefix: '/api' })
  await app.register(sertifikatRoutes, { prefix: '/api' })
  await app.register(broadcastRoutes, { prefix: '/api' })
  await app.register(loyaltyRoutes, { prefix: '/api' })
  await app.register(reviewRoutes, { prefix: '/api' })
  await app.register(jadwalDokterRoutes, { prefix: '/api' })
  await app.register(barcodeRoutes, { prefix: '/api' })
  await app.register(petHotelRoutes, { prefix: '/api' })
  await app.register(telemedRoutes, { prefix: '/api' })
  await app.register(labRoutes, { prefix: '/api' })
  await app.register(symptomRoutes, { prefix: '/api' })
  await app.register(clinicalRoutes, { prefix: '/api' })
  await app.register(publicClinicRoutes, { prefix: '/api' })
  await app.register(pajakRoutes, { prefix: '/api' })
  await app.register(calendarRoutes, { prefix: '/api' })
  await app.register(analyticsRoutes, { prefix: '/api' })
  await app.register(marketplaceRoutes, { prefix: '/api' })
  await app.register(notifikasiStaffRoutes, { prefix: '/api' })

  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }))

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error)
    if (error.statusCode === 429) {
      return reply.status(429).send({ message: 'Terlalu banyak request. Coba lagi nanti.' })
    }
    return reply.status(error.statusCode || 500).send({
      message: process.env.NODE_ENV === 'development' ? error.message : 'Terjadi kesalahan server.',
    })
  })

  const port = Number(process.env.PORT) || 3000
  await app.listen({ port, host: '0.0.0.0' })
  app.log.info(`Server berjalan di http://localhost:${port}`)

  // Jalankan cron reminder harian
  startReminderCron(app.prisma)

  // Jalankan cron pengecekan trial habis
  startTrialExpiryCron(app.prisma)

  // Jalankan cron pengecekan stok menipis
  startLowStockCron(app.prisma)
}

bootstrap().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})

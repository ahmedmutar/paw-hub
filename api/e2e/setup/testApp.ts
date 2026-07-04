import Fastify, { FastifyInstance } from 'fastify'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import fp from 'fastify-plugin'
import { PrismaClient } from '@prisma/client'

import { authRoutes } from '../../src/modules/auth/auth.routes'
import { pasienRoutes } from '../../src/modules/pasien/pasien.routes'
import { registrasiRoutes } from '../../src/modules/registrasi/registrasi.routes'
import { appointmentRoutes } from '../../src/modules/appointment/appointment.routes'
import { gudangRoutes } from '../../src/modules/gudang/gudang.routes'
import { layananRoutes } from '../../src/modules/layanan/layanan.routes'
import { pembayaranRoutes } from '../../src/modules/pembayaran/pembayaran.routes'
import { userRoutes } from '../../src/modules/user/user.routes'
import { cabangRoutes } from '../../src/modules/cabang/cabang.routes'
import { dashboardRoutes } from '../../src/modules/dashboard/dashboard.routes'
import { notifRoutes } from '../../src/modules/notif/notif.routes'
import { pemeriksaanRoutes } from '../../src/modules/pemeriksaan/pemeriksaan.routes'
import { rekamMedisRoutes } from '../../src/modules/rekam-medis/rekam-medis.routes'

const E2E_DB_URL = process.env.DATABASE_URL!

declare module 'fastify' {
  interface FastifyInstance { prisma: PrismaClient }
}

const prismaPlugin = fp(async (app) => {
  const prisma = new PrismaClient({ datasources: { db: { url: E2E_DB_URL } } })
  await prisma.$connect()
  app.decorate('prisma', prisma)
  app.addHook('onClose', async () => prisma.$disconnect())
})

export async function buildTestApp(): Promise<FastifyInstance> {
  ;(BigInt.prototype as any).toJSON = function () { return this.toString() }

  const app = Fastify({ logger: false })

  await app.register(cors, { origin: true, credentials: true })
  await app.register(cookie)
  await app.register(jwt, {
    secret: process.env.JWT_SECRET!,
  })
  await app.register(prismaPlugin)

  await app.register(authRoutes, { prefix: '/api' })
  await app.register(pasienRoutes, { prefix: '/api' })
  await app.register(registrasiRoutes, { prefix: '/api' })
  await app.register(appointmentRoutes, { prefix: '/api' })
  await app.register(gudangRoutes, { prefix: '/api' })
  await app.register(layananRoutes, { prefix: '/api' })
  await app.register(pembayaranRoutes, { prefix: '/api' })
  await app.register(userRoutes, { prefix: '/api' })
  await app.register(cabangRoutes, { prefix: '/api' })
  await app.register(dashboardRoutes, { prefix: '/api' })
  await app.register(notifRoutes, { prefix: '/api' })
  await app.register(pemeriksaanRoutes, { prefix: '/api' })
  await app.register(rekamMedisRoutes, { prefix: '/api' })

  app.get('/health', async () => ({ status: 'ok' }))

  await app.ready()
  return app
}

export async function loginAs(
  app: FastifyInstance,
  username: string,
  password = 'e2epass123',
): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/masuk',
    payload: { username, password },
  })
  if (res.statusCode !== 200) {
    throw new Error(`Login gagal (${res.statusCode}): ${res.body}`)
  }
  return res.json().data.accessToken as string
}

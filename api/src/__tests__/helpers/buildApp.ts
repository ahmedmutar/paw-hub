import Fastify, { FastifyInstance } from 'fastify'
import { vi } from 'vitest'

// Allow BigInt values to be JSON-serialized in test responses
if (!Object.prototype.hasOwnProperty.call(BigInt.prototype, 'toJSON')) {
  Object.defineProperty(BigInt.prototype, 'toJSON', {
    value: function () { return this.toString() },
    configurable: true,
    writable: true,
  })
}

/** All Prisma model names — ensures no "undefined" errors on model access */
const ALL_MODELS = [
  'user','branch','refreshToken','patient','owner','registration','checkUpResult',
  'detailItemPatient','detailServicePatient','listOfPayment','listOfPaymentItem',
  'listOfPaymentService','paymentMethod','expense','listOfItem','categoryItem',
  'unitItem','priceItem','stockMovement','serviceCategory','listOfService',
  'priceService','medicalRecord','vaccinationRecord','dewormingRecord',
  'weightRecord','majorProcedureRecord','inPatient','payroll','listOfItemPetShop',
  'priceItemPetShop','paymentPetshop','paymentPetshopItem','paymentClinicPetshopItem',
  'masterPaymentPetshop','whatsappLog','appointment','doctorSchedule','doctorLeave',
  'reminderLog','ownerOtp','groomingSession','groomingSessionService','paymentGrooming',
  'tenant','subscription','invoice','broadcastLog','broadcastRecipient',
  'loyaltyMember','loyaltyTransaction','loyaltyConfig','loyaltyPoint',
  'reviewRecord','auditLog','sertifikat','barcodeLabel',
  'hotelRoom','hotelBooking','hotelCareLog','telemedSession','labRequest','labResult',
  'aiSymptomLog','drugDatabase','drugInteraction','doctorCalendarSync',
  'marketplaceIntegration','marketplaceOrder',
  'groomingPackage','medicineGroup','detailMedicineGroupResult',
  'doctorAcceptance','subscriptionPlan','tenantSubscription',
  'ownerOTP','paymentGrooming',
] as const

export const DEFAULT_AUTH_USER = {
  userId: BigInt(1),
  username: 'testadmin',
  fullname: 'Admin Test',
  role: 'admin' as const,
  branchId: BigInt(1),
  branchName: 'Cabang Test',
  tenantId: BigInt(1),
}

/** Create a fully-mocked Prisma with all models — override specific methods as needed */
export function fullMockPrisma(overrides: Record<string, Record<string, unknown>> = {}): Record<string, unknown> {
  const prisma: Record<string, unknown> = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    $executeRaw: vi.fn().mockResolvedValue(0),
    $transaction: vi.fn().mockImplementation(async (fn: any) => (Array.isArray(fn) ? Promise.all(fn) : fn(prisma))),
  }
  for (const model of ALL_MODELS) {
    (prisma as any)[model] = { ...mockModel(), ...((overrides as any)[model] ?? {}) }
  }
  return prisma
}

/** Create a test Fastify app with mocked Prisma and auto-injected authUser */
export async function buildApp(
  routePlugin: (app: FastifyInstance) => Promise<void>,
  mockPrisma: Record<string, unknown>,
  authUser = DEFAULT_AUTH_USER,
) {
  const app = Fastify({ logger: false })

  // Inject mock prisma
  app.decorate('prisma', mockPrisma)

  // Inject authUser so protected routes work without real JWT
  app.addHook('preHandler', async (req: any) => {
    req.authUser = authUser
  })

  await app.register(routePlugin, { prefix: '/api' })
  await app.ready()
  return app
}

/** Helper to create a mock Prisma model with all common methods */
export function mockModel(overrides: Record<string, unknown> = {}) {
  return {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    findUnique: vi.fn().mockResolvedValue(null),
    findUniqueOrThrow: vi.fn().mockResolvedValue(null),
    findFirstOrThrow: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: BigInt(1) }),
    createMany: vi.fn().mockResolvedValue({ count: 1 }),
    update: vi.fn().mockResolvedValue({ id: BigInt(1) }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    upsert: vi.fn().mockResolvedValue({ id: BigInt(1) }),
    delete: vi.fn().mockResolvedValue({ id: BigInt(1) }),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    count: vi.fn().mockResolvedValue(0),
    aggregate: vi.fn().mockResolvedValue({ _sum: {}, _avg: {}, _count: { id: 0 } }),
    groupBy: vi.fn().mockResolvedValue([]),
    ...overrides,
  }
}

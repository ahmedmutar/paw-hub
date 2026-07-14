import { describe, it, expect, vi } from 'vitest'
import { fullMockPrisma } from '../helpers/buildApp'
import { runReminderScan } from '../../modules/reminder/reminder.service'

vi.mock('../../modules/notif/wa.service', () => ({
  sendWhatsapp: vi.fn().mockResolvedValue(undefined),
  msgVaccinationReminder: () => 'pesan vaksin',
  msgDewormingReminder: () => 'pesan cacing',
}))

const mockPatient = (branchId: bigint) => ({
  id: BigInt(1), petName: 'Mochi', branchId,
  owner: { ownerName: 'Budi', phoneNumber: '08123456789' },
})

describe('runReminderScan — batas fitur reminder sesuai paket klinik', () => {
  it('tidak mengirim reminder untuk klinik yang paketnya tidak punya fitur reminder', async () => {
    const { sendWhatsapp } = await import('../../modules/notif/wa.service')
    const prisma = fullMockPrisma({
      vaccinationRecord: {
        findMany: vi.fn().mockResolvedValue([
          { id: BigInt(10), patientId: BigInt(1), nextDueAt: new Date(), vaccineName: 'Rabies', patient: mockPatient(BigInt(1)) },
        ]),
      },
      dewormingRecord: { findMany: vi.fn().mockResolvedValue([]) },
      reminderLog: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn().mockResolvedValue({ id: BigInt(1) }), update: vi.fn() },
      branch: { findUnique: vi.fn().mockResolvedValue({ id: BigInt(1), tenantId: BigInt(1), branchName: 'Cabang 1' }) },
      tenantSubscription: {
        findUnique: vi.fn().mockResolvedValue({ plan: { name: 'Free', features: { reminder: false } } }),
      },
    })

    const result = await runReminderScan(prisma as any, 7)

    expect(sendWhatsapp).not.toHaveBeenCalled()
    expect(result.vaccination).toBe(0)
  })

  it('tetap mengirim reminder untuk klinik yang paketnya punya fitur reminder', async () => {
    const { sendWhatsapp } = await import('../../modules/notif/wa.service')
    vi.mocked(sendWhatsapp).mockClear()
    const prisma = fullMockPrisma({
      vaccinationRecord: {
        findMany: vi.fn().mockResolvedValue([
          { id: BigInt(11), patientId: BigInt(1), nextDueAt: new Date(), vaccineName: 'Rabies', patient: mockPatient(BigInt(1)) },
        ]),
      },
      dewormingRecord: { findMany: vi.fn().mockResolvedValue([]) },
      reminderLog: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn().mockResolvedValue({ id: BigInt(2) }), update: vi.fn() },
      branch: { findUnique: vi.fn().mockResolvedValue({ id: BigInt(1), tenantId: BigInt(1), branchName: 'Cabang 1' }) },
      tenantSubscription: {
        findUnique: vi.fn().mockResolvedValue({ plan: { name: 'Starter', features: { reminder: true } } }),
      },
    })

    const result = await runReminderScan(prisma as any, 7)

    expect(sendWhatsapp).toHaveBeenCalled()
    expect(result.vaccination).toBe(1)
  })

  it('instalasi lama tanpa tenant (branch.tenantId null) tetap dikirim, tidak dibatasi', async () => {
    const { sendWhatsapp } = await import('../../modules/notif/wa.service')
    vi.mocked(sendWhatsapp).mockClear()
    const prisma = fullMockPrisma({
      vaccinationRecord: {
        findMany: vi.fn().mockResolvedValue([
          { id: BigInt(12), patientId: BigInt(1), nextDueAt: new Date(), vaccineName: 'Rabies', patient: mockPatient(BigInt(1)) },
        ]),
      },
      dewormingRecord: { findMany: vi.fn().mockResolvedValue([]) },
      reminderLog: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn().mockResolvedValue({ id: BigInt(3) }), update: vi.fn() },
      branch: { findUnique: vi.fn().mockResolvedValue({ id: BigInt(1), tenantId: null, branchName: 'Cabang Legacy' }) },
    })

    const result = await runReminderScan(prisma as any, 7)

    expect(sendWhatsapp).toHaveBeenCalled()
    expect(result.vaccination).toBe(1)
  })
})

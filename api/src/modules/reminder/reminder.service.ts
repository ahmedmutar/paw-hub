import { PrismaClient } from '@prisma/client'
import { sendWhatsapp, msgVaccinationReminder, msgDewormingReminder } from '../notif/wa.service'

const PATIENT_INCLUDE = {
  patient: {
    select: {
      id: true,
      petName: true,
      branchId: true,
      owner: { select: { ownerName: true, phoneNumber: true } },
    },
  },
}

// Scan dan kirim reminder untuk semua record yang jatuh tempo dalam N hari ke depan
export async function runReminderScan(prisma: PrismaClient, daysAhead = 7): Promise<{
  vaccination: number; deworming: number; errors: number
}> {
  const now  = new Date()
  const from = new Date(now); from.setHours(0, 0, 0, 0)
  const to   = new Date(from); to.setDate(to.getDate() + daysAhead); to.setHours(23, 59, 59, 999)

  let vacCount = 0, dewCount = 0, errCount = 0

  // ── Vaksinasi ─────────────────────────────────────────────────────────────
  const vacRecords = await prisma.vaccinationRecord.findMany({
    where: { nextDueAt: { gte: from, lte: to } },
    include: PATIENT_INCLUDE,
  })

  for (const rec of vacRecords) {
    const owner = rec.patient?.owner
    if (!owner?.phoneNumber) continue

    // Skip jika sudah dikirim untuk record ini
    const existing = await prisma.reminderLog.findUnique({
      where: { type_recordId: { type: 'vaccination', recordId: rec.id } },
    })
    if (existing?.status === 'sent') continue

    const log = await prisma.reminderLog.upsert({
      where:  { type_recordId: { type: 'vaccination', recordId: rec.id } },
      create: { type: 'vaccination', patientId: rec.patientId, recordId: rec.id, dueDate: rec.nextDueAt!, status: 'pending' },
      update: { status: 'pending' },
    })

    try {
      const dueDate = rec.nextDueAt!.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      const branchData = await prisma.branch.findUnique({ where: { id: rec.patient.branchId } })

      await sendWhatsapp(prisma, {
        phone:         owner.phoneNumber,
        recipientName: owner.ownerName,
        message:       msgVaccinationReminder({
          petName:     rec.patient.petName,
          ownerName:   owner.ownerName,
          vaccineName: rec.vaccineName,
          dueDate,
          branchName:  branchData?.branchName ?? '',
        }),
        type:      'vaccination_reminder',
        patientId: rec.patientId,
        branchId:  rec.patient.branchId,
        userId:    BigInt(1), // system
      })

      await prisma.reminderLog.update({
        where: { id: log.id },
        data:  { status: 'sent', sentAt: new Date() },
      })
      vacCount++
    } catch (e: any) {
      await prisma.reminderLog.update({
        where: { id: log.id },
        data:  { status: 'failed', errorMsg: e?.message },
      })
      errCount++
    }
  }

  // ── Obat Cacing ───────────────────────────────────────────────────────────
  const dewRecords = await prisma.dewormingRecord.findMany({
    where: { nextDueAt: { gte: from, lte: to } },
    include: PATIENT_INCLUDE,
  })

  for (const rec of dewRecords) {
    const owner = rec.patient?.owner
    if (!owner?.phoneNumber) continue

    const existing = await prisma.reminderLog.findUnique({
      where: { type_recordId: { type: 'deworming', recordId: rec.id } },
    })
    if (existing?.status === 'sent') continue

    const log = await prisma.reminderLog.upsert({
      where:  { type_recordId: { type: 'deworming', recordId: rec.id } },
      create: { type: 'deworming', patientId: rec.patientId, recordId: rec.id, dueDate: rec.nextDueAt!, status: 'pending' },
      update: { status: 'pending' },
    })

    try {
      const dueDate = rec.nextDueAt!.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      const branchData = await prisma.branch.findUnique({ where: { id: rec.patient.branchId } })

      await sendWhatsapp(prisma, {
        phone:         owner.phoneNumber,
        recipientName: owner.ownerName,
        message:       msgDewormingReminder({
          petName:   rec.patient.petName,
          ownerName: owner.ownerName,
          dueDate,
          branchName: branchData?.branchName ?? '',
        }),
        type:      'deworming_reminder',
        patientId: rec.patientId,
        branchId:  rec.patient.branchId,
        userId:    BigInt(1),
      })

      await prisma.reminderLog.update({
        where: { id: log.id },
        data:  { status: 'sent', sentAt: new Date() },
      })
      dewCount++
    } catch (e: any) {
      await prisma.reminderLog.update({
        where: { id: log.id },
        data:  { status: 'failed', errorMsg: e?.message },
      })
      errCount++
    }
  }

  return { vaccination: vacCount, deworming: dewCount, errors: errCount }
}

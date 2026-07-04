import { PrismaClient, WaNotifType } from '@prisma/client'
import https from 'https'
import http from 'http'

export interface SendWaOptions {
  phone: string
  recipientName?: string
  message: string
  type: WaNotifType
  patientId?: bigint
  registrationId?: bigint
  branchId: bigint
  userId: bigint
}

// POST to Fonnte: https://api.fonnte.com/send
async function fonntePost(token: string, payload: Record<string, string>): Promise<{ status: boolean; reason?: string }> {
  return new Promise((resolve) => {
    const body = JSON.stringify(payload)
    const req = https.request(
      {
        hostname: 'api.fonnte.com',
        path: '/send',
        method: 'POST',
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            const json = JSON.parse(data)
            resolve({ status: json.status === true, reason: json.reason })
          } catch {
            resolve({ status: false, reason: 'Invalid JSON response' })
          }
        })
      },
    )
    req.on('error', (err) => resolve({ status: false, reason: err.message }))
    req.write(body)
    req.end()
  })
}

export async function sendWhatsapp(prisma: PrismaClient, opts: SendWaOptions): Promise<void> {
  const token = process.env.FONNTE_TOKEN

  // Create log first with pending status
  const log = await prisma.whatsappLog.create({
    data: {
      recipientPhone: opts.phone,
      recipientName: opts.recipientName,
      type: opts.type,
      message: opts.message,
      status: 'pending',
      patientId: opts.patientId,
      registrationId: opts.registrationId,
      branchId: opts.branchId,
      userId: opts.userId,
    },
  })

  if (!token) {
    // No token configured — mark as failed but don't throw (non-blocking)
    await prisma.whatsappLog.update({
      where: { id: log.id },
      data: { status: 'failed', errorMessage: 'FONNTE_TOKEN not configured' },
    })
    return
  }

  try {
    const result = await fonntePost(token, {
      target: opts.phone,
      message: opts.message,
    })

    await prisma.whatsappLog.update({
      where: { id: log.id },
      data: {
        status: result.status ? 'sent' : 'failed',
        errorMessage: result.status ? null : result.reason ?? 'Unknown error',
        sentAt: result.status ? new Date() : null,
      },
    })
  } catch (err: any) {
    await prisma.whatsappLog.update({
      where: { id: log.id },
      data: { status: 'failed', errorMessage: err?.message ?? 'Network error' },
    })
  }
}

// ── Template helpers ──────────────────────────────────────────────────────────

export function msgQueueConfirmation(opts: {
  petName: string; ownerName: string; queueNumber: string; branchName: string
}) {
  return `Halo *${opts.ownerName}*! 🐾\n\nPendaftaran *${opts.petName}* di *${opts.branchName}* berhasil.\n\n📋 Nomor Antrian: *${opts.queueNumber}*\n\nMohon hadir tepat waktu. Terima kasih telah mempercayakan perawatan hewan kesayangan Anda kepada kami! 🏥`
}

export function msgQueueCalled(opts: {
  petName: string; ownerName: string; queueNumber: string; branchName: string
}) {
  return `Halo *${opts.ownerName}*! 🔔\n\nGiliran *${opts.petName}* sudah tiba!\n\n📋 Antrian *${opts.queueNumber}* sekarang dipanggil di *${opts.branchName}*.\n\nMohon segera menuju ruang pemeriksaan. Terima kasih! 🐾`
}

export function msgVaccinationReminder(opts: {
  petName: string; ownerName: string; vaccineName: string; dueDate: string; branchName: string
}) {
  return `Halo *${opts.ownerName}*! 💉\n\nPengingat vaksinasi untuk *${opts.petName}*:\n\n🗓 Vaksin *${opts.vaccineName}* jatuh tempo pada *${opts.dueDate}*.\n\nSegera kunjungi *${opts.branchName}* untuk vaksinasi tepat waktu. Kesehatan si kecil adalah prioritas kami! 🐾`
}

export function msgDewormingReminder(opts: {
  petName: string; ownerName: string; dueDate: string; branchName: string
}) {
  return `Halo *${opts.ownerName}*! 🪱\n\nPengingat obat cacing untuk *${opts.petName}*:\n\n🗓 Jadwal cacing jatuh tempo pada *${opts.dueDate}*.\n\nKunjungi *${opts.branchName}* untuk pemberian obat cacing. Jaga kesehatan hewan kesayangan Anda! 🐾`
}

export function msgPaymentReceipt(opts: {
  ownerName: string; petName: string; invoiceNumber: string; total: string; branchName: string; date: string
}) {
  return `Halo *${opts.ownerName}*! 🧾\n\nTerima kasih atas kunjungan *${opts.petName}* di *${opts.branchName}*.\n\n📄 Invoice: *${opts.invoiceNumber}*\n📅 Tanggal: ${opts.date}\n💰 Total: *Rp ${opts.total}*\n\nSemoga ${opts.petName} lekas sembuh dan sehat selalu! 🐾`
}

export function msgInpatientUpdate(opts: {
  ownerName: string; petName: string; day: number; condition: string; branchName: string
}) {
  return `Halo *${opts.ownerName}*! 🏥\n\nUpdate kondisi *${opts.petName}* hari ke-${opts.day} di *${opts.branchName}*:\n\n📋 Kondisi: ${opts.condition}\n\nJika ada pertanyaan, silakan hubungi klinik kami. Kami terus memantau kondisi hewan kesayangan Anda! 🐾`
}

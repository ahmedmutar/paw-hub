// @ts-nocheck
import { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../../middleware/auth'

const FONNTE_TOKEN = process.env.FONNTE_TOKEN ?? ''

const LAB_TEMPLATES: Record<string, { label: string; fields: { key: string; label: string; unit: string; normalMin?: number; normalMax?: number }[] }> = {
  hematologi: {
    label: 'Hematologi (Darah Rutin)',
    fields: [
      { key: 'hemoglobin', label: 'Hemoglobin', unit: 'g/dL', normalMin: 8, normalMax: 18 },
      { key: 'leukosit', label: 'Leukosit (WBC)', unit: '×10³/µL', normalMin: 5, normalMax: 17 },
      { key: 'eritrosit', label: 'Eritrosit (RBC)', unit: '×10⁶/µL', normalMin: 4.5, normalMax: 8.5 },
      { key: 'hematokrit', label: 'Hematokrit (PCV)', unit: '%', normalMin: 25, normalMax: 55 },
      { key: 'trombosit', label: 'Trombosit', unit: '×10³/µL', normalMin: 150, normalMax: 500 },
    ],
  },
  kimia_darah: {
    label: 'Kimia Darah',
    fields: [
      { key: 'bun', label: 'BUN (Urea Nitrogen)', unit: 'mg/dL', normalMin: 7, normalMax: 25 },
      { key: 'kreatinin', label: 'Kreatinin', unit: 'mg/dL', normalMin: 0.5, normalMax: 1.8 },
      { key: 'sgpt_alt', label: 'SGPT/ALT', unit: 'U/L', normalMin: 10, normalMax: 100 },
      { key: 'sgot_ast', label: 'SGOT/AST', unit: 'U/L', normalMin: 15, normalMax: 80 },
      { key: 'glukosa', label: 'Glukosa', unit: 'mg/dL', normalMin: 60, normalMax: 120 },
      { key: 'protein_total', label: 'Protein Total', unit: 'g/dL', normalMin: 5, normalMax: 8.5 },
    ],
  },
  urinalisis: {
    label: 'Urinalisis',
    fields: [
      { key: 'warna', label: 'Warna', unit: '' },
      { key: 'kejernihan', label: 'Kejernihan', unit: '' },
      { key: 'ph', label: 'pH', unit: '', normalMin: 5.5, normalMax: 8.5 },
      { key: 'berat_jenis', label: 'Berat Jenis', unit: '' },
      { key: 'protein', label: 'Protein', unit: '' },
      { key: 'glukosa_urin', label: 'Glukosa', unit: '' },
      { key: 'sedimen', label: 'Sedimen', unit: '' },
    ],
  },
}

export async function labRoutes(app: FastifyInstance) {
  // Template list
  app.get('/lab/templates', { preHandler: [authenticate] }, async (_req, reply) => {
    return reply.send({ data: Object.entries(LAB_TEMPLATES).map(([key, v]) => ({ key, label: v.label, fields: v.fields })) })
  })

  // Request lab
  app.post('/lab/request', { preHandler: [authenticate] }, async (req: any, reply) => {
    const { branchId, tenantId, userId } = req.authUser
    const { patientId, testType, notes, priority } = req.body as any

    const request = await req.server.prisma.labRequest.create({
      data: {
        branchId, tenantId, patientId: BigInt(patientId),
        requestedById: userId, testType, notes, priority: priority ?? 'normal',
      },
      include: {
        patient: { select: { petName: true } },
        requestedBy: { select: { fullname: true } },
      },
    })
    return reply.status(201).send({ data: request })
  })

  // List requests
  app.get('/lab/request', { preHandler: [authenticate] }, async (req: any, reply) => {
    const { branchId, role } = req.authUser
    const { status, page = 1, limit = 20 } = req.query as any
    const skip = (Number(page) - 1) * Number(limit)

    const where: any = {
      ...(role !== 'superadmin' && { branchId }),
      ...(status && { status }),
    }
    const [total, requests] = await Promise.all([
      req.server.prisma.labRequest.count({ where }),
      req.server.prisma.labRequest.findMany({
        where, skip, take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          patient: { select: { petName: true, petCategory: true } },
          requestedBy: { select: { fullname: true } },
          result: { select: { isReady: true, readyAt: true } },
        },
      }),
    ])
    return reply.send({ data: requests, total, page: Number(page) })
  })

  // Input / update hasil lab
  app.patch('/lab/request/:id/result', { preHandler: [authenticate] }, async (req: any, reply) => {
    const requestId = BigInt(req.params.id)
    const { templateType, resultData, resultFile, interpretation, isReady } = req.body as any
    const { branchId, role } = req.authUser

    const labRequest = await req.server.prisma.labRequest.findFirst({
      where: { id: requestId, ...(role !== 'superadmin' && { branchId }) },
      include: { patient: { include: { owner: true } } },
    })
    if (!labRequest) return reply.status(404).send({ message: 'Request tidak ditemukan' })

    const result = await req.server.prisma.labResult.upsert({
      where: { requestId },
      create: { requestId, templateType, resultData, resultFile, interpretation, isReady: !!isReady, readyAt: isReady ? new Date() : null },
      update: { templateType, resultData, resultFile, interpretation, isReady: !!isReady, readyAt: isReady ? new Date() : null },
    })

    await req.server.prisma.labRequest.update({ where: { id: requestId }, data: { status: isReady ? 'ready' : 'processing' } })

    // Notify owner via WA
    if (isReady && FONNTE_TOKEN) {
      const owner = labRequest.patient.owner
      if (owner?.phoneNumber) {
        const phone = owner.phoneNumber.replace(/[^0-9]/g, '').replace(/^0/, '62')
        fetch('https://api.fonnte.com/send', {
          method: 'POST',
          headers: { Authorization: FONNTE_TOKEN, 'Content-Type': 'application/json' },
          body: JSON.stringify({ target: phone, message: `*Hasil Laboratorium Siap*\n\nHasil lab ${labRequest.testType} untuk ${labRequest.patient.petName} sudah siap. Silakan hubungi klinik untuk informasi lebih lanjut.` }),
        }).catch(() => {})
      }
    }

    return reply.send({ data: result })
  })

  // Riwayat lab per pasien
  app.get('/lab/history/:patientId', { preHandler: [authenticate] }, async (req: any, reply) => {
    const patientId = BigInt(req.params.patientId)
    const { branchId, role } = req.authUser
    const requests = await req.server.prisma.labRequest.findMany({
      where: { patientId, ...(role !== 'superadmin' && { branchId }) },
      orderBy: { createdAt: 'desc' },
      include: {
        requestedBy: { select: { fullname: true } },
        result: true,
      },
    })
    return reply.send({ data: requests })
  })
}

// @ts-nocheck
import { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../../middleware/auth'

export async function clinicalRoutes(app: FastifyInstance) {
  // ── Drug database ──────────────────────────────────────────────────────────
  app.get('/clinical/drug-database', { preHandler: [authenticate] }, async (req: any, reply) => {
    const { search, category, species } = req.query as any
    const drugs = await req.server.prisma.drugDatabase.findMany({
      where: {
        isActive: true,
        ...(search && { drugName: { contains: search, mode: 'insensitive' } }),
        ...(category && { category }),
        ...(species && species !== 'all' && {
          OR: [{ species: species }, { species: 'all' }],
        }),
      },
      orderBy: { drugName: 'asc' },
    })
    return reply.send({ data: drugs })
  })

  app.post('/clinical/drug-database', { preHandler: [authenticate, requireRole('admin', 'superadmin')] }, async (req: any, reply) => {
    const { drugName, genericName, category, species, dosagePerKgMin, dosagePerKgMax, unit, frequency, contraindications, sideEffects } = req.body as any
    const drug = await req.server.prisma.drugDatabase.create({
      data: {
        drugName, genericName, category: category ?? 'umum', species: species ?? 'all',
        dosagePerKgMin: dosagePerKgMin ? Number(dosagePerKgMin) : null,
        dosagePerKgMax: dosagePerKgMax ? Number(dosagePerKgMax) : null,
        unit: unit ?? 'mg', frequency, contraindications, sideEffects,
      },
    })
    return reply.status(201).send({ data: drug })
  })

  app.put('/clinical/drug-database/:id', { preHandler: [authenticate, requireRole('admin', 'superadmin')] }, async (req: any, reply) => {
    const id = BigInt(req.params.id)
    const { drugName, genericName, category, species, dosagePerKgMin, dosagePerKgMax, unit, frequency, contraindications, sideEffects, isActive } = req.body as any
    const drug = await req.server.prisma.drugDatabase.update({
      where: { id },
      data: {
        drugName, genericName, category, species,
        dosagePerKgMin: dosagePerKgMin !== undefined ? Number(dosagePerKgMin) : undefined,
        dosagePerKgMax: dosagePerKgMax !== undefined ? Number(dosagePerKgMax) : undefined,
        unit, frequency, contraindications, sideEffects, isActive,
      },
    })
    return reply.send({ data: drug })
  })

  // ── Drug interaction check ─────────────────────────────────────────────────
  app.post('/clinical/drug-check', { preHandler: [authenticate] }, async (req: any, reply) => {
    const { drugIds } = req.body as any
    if (!Array.isArray(drugIds) || drugIds.length < 2) {
      return reply.send({ data: { interactions: [], safe: true } })
    }

    const ids = drugIds.map((id: string | number) => BigInt(id))
    const interactions: any[] = []

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const interaction = await req.server.prisma.drugInteraction.findFirst({
          where: {
            OR: [
              { drugAId: ids[i], drugBId: ids[j] },
              { drugAId: ids[j], drugBId: ids[i] },
            ],
          },
          include: {
            drugA: { select: { drugName: true } },
            drugB: { select: { drugName: true } },
          },
        })
        if (interaction) interactions.push(interaction)
      }
    }

    return reply.send({
      data: {
        interactions,
        safe: interactions.length === 0,
        hasDanger: interactions.some(i => i.severity === 'danger'),
      },
    })
  })

  // Add drug interaction
  app.post('/clinical/drug-interaction', { preHandler: [authenticate, requireRole('admin', 'superadmin')] }, async (req: any, reply) => {
    const { drugAId, drugBId, severity, description } = req.body as any
    const interaction = await req.server.prisma.drugInteraction.create({
      data: {
        drugAId: BigInt(drugAId), drugBId: BigInt(drugBId),
        severity: severity ?? 'warning', description,
      },
    })
    return reply.status(201).send({ data: interaction })
  })

  // ── Dose calculator ────────────────────────────────────────────────────────
  app.post('/clinical/dose-calculator', { preHandler: [authenticate] }, async (req: any, reply) => {
    const { drugId, weightKg } = req.body as any
    if (!drugId || !weightKg) return reply.status(400).send({ message: 'drugId dan weightKg diperlukan' })

    const drug = await req.server.prisma.drugDatabase.findUnique({ where: { id: BigInt(drugId) } })
    if (!drug) return reply.status(404).send({ message: 'Obat tidak ditemukan' })

    const weight = Number(weightKg)
    const minDose = drug.dosagePerKgMin ? Number(drug.dosagePerKgMin) * weight : null
    const maxDose = drug.dosagePerKgMax ? Number(drug.dosagePerKgMax) * weight : null

    return reply.send({
      data: {
        drugName: drug.drugName, unit: drug.unit, frequency: drug.frequency,
        weightKg: weight,
        minDose: minDose ? Math.round(minDose * 100) / 100 : null,
        maxDose: maxDose ? Math.round(maxDose * 100) / 100 : null,
        recommendation: minDose && maxDose
          ? `${Math.round(minDose * 10) / 10}–${Math.round(maxDose * 10) / 10} ${drug.unit}${drug.frequency ? `, ${drug.frequency}` : ''}`
          : minDose ? `${Math.round(minDose * 10) / 10} ${drug.unit}` : 'Konsultasikan dengan dokter',
        contraindications: drug.contraindications,
        sideEffects: drug.sideEffects,
      },
    })
  })
}

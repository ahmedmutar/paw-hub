// @ts-nocheck
import { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../../middleware/auth'

// Rule-based symptom checker (AI simulation with veterinary knowledge)
function analyzeSymptoms(symptoms: string, species: string): { urgencyLevel: string; assessment: string; recommendations: string[] } {
  const s = symptoms.toLowerCase()

  const emergencyKeywords = ['tidak sadar', 'pingsan', 'kejang', 'sesak napas', 'susah napas', 'tidak bisa napas',
    'pendarahan', 'darah banyak', 'patah tulang', 'keracunan', 'muntah darah', 'berak darah', 'kencing darah',
    'lumpuh', 'tidak bisa berdiri', 'kaku seluruh tubuh', 'bola mata keluar']

  const urgent24hKeywords = ['muntah terus', 'diare terus', 'tidak mau makan 2 hari', 'demam tinggi',
    'bengkak besar', 'luka dalam', 'gigitan ular', 'cedera parah', 'lemas sekali', 'dehidrasi',
    'tidak mau minum', 'sulit buang air', 'mengeluarkan cairan dari mata', 'susah jalan']

  const canWaitKeywords = ['gatal-gatal', 'kutu', 'jamur', 'bulu rontok sedikit', 'kuku panjang',
    'tidak mau makan sehari', 'bersin sesekali', 'mata agak berair', 'telinga kotor', 'gigi kotor']

  const isEmergency = emergencyKeywords.some(k => s.includes(k))
  const isUrgent24h = urgent24hKeywords.some(k => s.includes(k))
  const isCanWait = canWaitKeywords.some(k => s.includes(k))

  if (isEmergency) {
    return {
      urgencyLevel: 'segera',
      assessment: 'Gejala yang disebutkan mengindikasikan kondisi darurat medis yang memerlukan penanganan segera.',
      recommendations: [
        'Segera bawa hewan peliharaan Anda ke klinik atau dokter hewan terdekat',
        'Jangan tunda lebih dari 30 menit',
        'Jaga hewan tetap tenang dan tidak banyak bergerak selama perjalanan',
        'Hubungi klinik terlebih dahulu jika memungkinkan',
      ],
    }
  }

  if (isUrgent24h) {
    return {
      urgencyLevel: 'dalam_24_jam',
      assessment: 'Gejala ini perlu mendapat perhatian dokter dalam waktu 24 jam untuk mencegah kondisi memburuk.',
      recommendations: [
        'Bawa ke dokter hewan dalam 24 jam ke depan',
        'Pastikan hewan tetap terhidrasi',
        'Pantau perubahan kondisi — jika memburuk, segera bawa ke klinik',
        'Hindari memberikan obat manusia tanpa anjuran dokter',
      ],
    }
  }

  if (isCanWait) {
    return {
      urgencyLevel: 'bisa_tunggu',
      assessment: 'Gejala yang disebutkan umumnya tidak mengancam jiwa namun tetap perlu pemeriksaan dokter hewan.',
      recommendations: [
        'Jadwalkan kunjungan ke dokter hewan dalam 3-7 hari',
        'Pantau perkembangan gejala',
        'Pastikan pola makan dan minum normal',
        'Jauhkan dari hewan lain jika ada gejala menular seperti kutu atau jamur',
      ],
    }
  }

  return {
    urgencyLevel: 'bisa_tunggu',
    assessment: 'Berdasarkan gejala yang disampaikan, kondisi hewan tampaknya stabil. Namun evaluasi dokter tetap disarankan untuk memastikan kesehatan hewan.',
    recommendations: [
      'Pantau kondisi hewan selama 1-2 hari',
      'Pastikan makan, minum, dan BAB/BAK normal',
      'Jika gejala berlanjut atau memburuk, segera konsultasi dokter hewan',
      'Pertimbangkan untuk membuat jadwal pemeriksaan rutin',
    ],
  }
}

export async function symptomRoutes(app: FastifyInstance) {
  // Public endpoint — no auth
  app.post('/public/symptom-checker', async (req: any, reply) => {
    const { petName, species, age, symptoms, branchId } = req.body as any
    if (!symptoms || symptoms.trim().length < 5) {
      return reply.status(400).send({ message: 'Deskripsikan gejala hewan Anda dengan lebih detail' })
    }

    const result = analyzeSymptoms(symptoms, species ?? '')

    // Save log
    await req.server.prisma.aiSymptomLog.create({
      data: {
        branchId: branchId ? BigInt(branchId) : null,
        petName, species, age: age ? Number(age) : null,
        inputSymptoms: symptoms,
        aiResponse: result.assessment,
        urgencyLevel: result.urgencyLevel as any,
      },
    }).catch(() => {})

    return reply.send({
      data: {
        urgencyLevel: result.urgencyLevel,
        assessment: result.assessment,
        recommendations: result.recommendations,
        disclaimer: 'Ini adalah panduan awal, bukan diagnosa medis resmi. Selalu konsultasikan dengan dokter hewan untuk penanganan yang tepat.',
      },
    })
  })

  // Admin — lihat log
  app.get('/ai/symptom-log', { preHandler: [authenticate, requireRole('admin', 'superadmin')] }, async (req: any, reply) => {
    const { branchId, role } = req.authUser
    const { page = 1, limit = 20, urgency } = req.query as any
    const skip = (Number(page) - 1) * Number(limit)

    const where: any = {
      ...(role !== 'superadmin' && { branchId }),
      ...(urgency && { urgencyLevel: urgency }),
    }
    const [total, logs] = await Promise.all([
      req.server.prisma.aiSymptomLog.count({ where }),
      req.server.prisma.aiSymptomLog.findMany({
        where, skip, take: Number(limit), orderBy: { createdAt: 'desc' },
      }),
    ])

    const stats = {
      segera: await req.server.prisma.aiSymptomLog.count({ where: { ...where, urgencyLevel: 'segera' } }),
      dalam_24_jam: await req.server.prisma.aiSymptomLog.count({ where: { ...where, urgencyLevel: 'dalam_24_jam' } }),
      bisa_tunggu: await req.server.prisma.aiSymptomLog.count({ where: { ...where, urgencyLevel: 'bisa_tunggu' } }),
      tidak_perlu: await req.server.prisma.aiSymptomLog.count({ where: { ...where, urgencyLevel: 'tidak_perlu' } }),
    }

    return reply.send({ data: logs, total, page: Number(page), stats })
  })
}

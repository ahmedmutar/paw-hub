import { FastifyInstance } from 'fastify'
import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import { authenticate, requireRole } from '../../middleware/auth'

const CERT_TYPES = { vaksin: 'Sertifikat Vaksinasi', sehat: 'Surat Keterangan Sehat', prosedur: 'Sertifikat Tindakan Medis' }

async function buildQRDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { width: 120, margin: 1 })
}

function drawCertPDF(opts: {
  title: string; certNumber: string; branchName: string; branchAddress?: string; branchPhone?: string
  petName: string; species: string; ownerName: string
  docBody: string[]; doctorName: string; date: string; qrDataUrl: string
}): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))

    const teal = '#0d9488'
    const dark = '#0f172a'
    const gray = '#64748b'

    // Header bar
    doc.rect(0, 0, 595, 120).fill(teal)
    doc.fillColor('white').fontSize(22).font('Helvetica-Bold').text(opts.branchName, 50, 30)
    doc.fontSize(10).font('Helvetica').text(opts.branchAddress ?? '', 50, 58)
    doc.text(`Telp: ${opts.branchPhone ?? '-'}`, 50, 72)

    // Title
    doc.fillColor(dark).fontSize(18).font('Helvetica-Bold')
      .text(opts.title, 50, 145, { align: 'center', width: 495 })
    doc.fontSize(10).fillColor(gray).font('Helvetica')
      .text(`No. Sertifikat: ${opts.certNumber}`, 50, 170, { align: 'center', width: 495 })

    // Divider
    doc.moveTo(50, 190).lineTo(545, 190).strokeColor(teal).lineWidth(2).stroke()

    // Patient info box
    doc.rect(50, 200, 495, 80).fillColor('#f0fdfa').fill()
    doc.fillColor(dark).fontSize(11).font('Helvetica-Bold').text('Data Pasien', 65, 210)
    doc.fontSize(10).font('Helvetica').fillColor(dark)
    doc.text(`Nama Hewan : ${opts.petName}`, 65, 228)
    doc.text(`Jenis       : ${opts.species}`, 65, 244)
    doc.text(`Pemilik     : ${opts.ownerName}`, 310, 228)
    doc.text(`Tanggal     : ${opts.date}`, 310, 244)

    // Body
    let y = 305
    doc.fillColor(dark).fontSize(11).font('Helvetica-Bold').text('Keterangan:', 50, y)
    y += 18
    for (const line of opts.docBody) {
      doc.fontSize(10).font('Helvetica').fillColor(dark).text(line, 65, y, { width: 440 })
      y += 18
    }

    // Footer signature area
    const footerY = 640
    doc.moveTo(50, footerY).lineTo(545, footerY).strokeColor('#e2e8f0').lineWidth(1).stroke()

    // QR code
    const qrImg = opts.qrDataUrl
    if (qrImg) doc.image(qrImg, 430, footerY + 10, { width: 100 })

    doc.fillColor(gray).fontSize(9).font('Helvetica')
      .text('Scan QR untuk verifikasi keaslian sertifikat', 390, footerY + 118, { width: 150, align: 'center' })

    // Doctor signature
    doc.fillColor(dark).fontSize(10).font('Helvetica')
      .text(`${opts.branchName}`, 60, footerY + 20)
      .text(`Jakarta, ${opts.date}`, 60, footerY + 38)
    doc.moveDown(3)
    doc.fontSize(10).font('Helvetica-Bold').text(opts.doctorName, 60, footerY + 95)
    doc.fontSize(9).font('Helvetica').fillColor(gray).text('Dokter Hewan', 60, footerY + 110)

    doc.end()
  })
}

// VaccinationRecord/MajorProcedureRecord/CheckUpResult tidak punya branchId
// langsung — cuma lewat relasi ke branch. Admin dikunci ke seluruh cabang di
// tenant-nya, non-admin dikunci ke cabang sendiri.
function certBranchFilter(user: any) {
  return user.role === 'admin'
    ? { branch: { tenantId: BigInt(user.tenantId) } }
    : { branchId: BigInt(user.branchId) }
}

export async function sertifikatRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma

  // GET /sertifikat/vaksin/:vaccinationId
  fastify.get('/sertifikat/vaksin/:vaccinationId', { preHandler: [authenticate] }, async (req: any, reply) => {
    const id = BigInt(req.params.vaccinationId)
    const rec = await prisma.vaccinationRecord.findFirst({
      where: { id, checkUpResult: { registration: certBranchFilter(req.authUser) } },
      include: {
        patient: { include: { owner: true } },
        checkUpResult: { include: { doctor: true, registration: { include: { branch: true } } } },
      },
    })
    if (!rec) return reply.status(404).send({ message: 'Record tidak ditemukan' })

    const branch = rec.checkUpResult?.registration?.branch
    const doctor = rec.checkUpResult?.doctor
    const certNum = `VAKSIN/${rec.id}/${new Date(rec.administeredAt).getFullYear()}`
    const date = new Date(rec.administeredAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
    const qrText = `${process.env.APP_URL ?? 'https://vetcore.id'}/verify/vaksin/${rec.id}`

    const body = [
      `Yang bertanda tangan di bawah ini menerangkan bahwa:`,
      `Hewan bernama "${rec.patient.petName}" telah menerima vaksinasi ${rec.vaccineName}.`,
      ...(rec.batchNumber ? [`No. Batch Vaksin : ${rec.batchNumber}`] : []),
      ...(rec.nextDueAt ? [`Jadwal Vaksin Berikutnya : ${new Date(rec.nextDueAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`] : []),
      ...(rec.notes ? [`Catatan : ${rec.notes}`] : []),
      ``,
      `Demikian sertifikat ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.`,
    ]

    const qrDataUrl = await buildQRDataUrl(qrText)
    const pdf = await drawCertPDF({
      title: CERT_TYPES.vaksin, certNumber: certNum,
      branchName: branch?.branchName ?? 'Klinik Hewan', branchAddress: branch?.address ?? undefined, branchPhone: branch?.phoneNumber ?? undefined,
      petName: rec.patient.petName, species: rec.patient.petCategory,
      ownerName: rec.patient.owner.ownerName,
      docBody: body, doctorName: doctor?.fullname ?? 'Dokter Hewan', date, qrDataUrl,
    })

    reply.header('Content-Type', 'application/pdf')
    reply.header('Content-Disposition', `attachment; filename="sertifikat-vaksin-${rec.id}.pdf"`)
    return reply.send(pdf)
  })

  // GET /sertifikat/sehat/:checkUpId
  fastify.get('/sertifikat/sehat/:checkUpId', { preHandler: [authenticate] }, async (req: any, reply) => {
    const id = BigInt(req.params.checkUpId)
    const rec = await prisma.checkUpResult.findFirst({
      where: { id, registration: certBranchFilter(req.authUser) },
      include: {
        doctor: true,
        registration: { include: { branch: true, patient: { include: { owner: true } } } },
      },
    })
    if (!rec) return reply.status(404).send({ message: 'Data tidak ditemukan' })

    const branch = rec.registration.branch
    const patient = rec.registration.patient
    const certNum = `SKS/${rec.id}/${new Date(rec.createdAt).getFullYear()}`
    const date = new Date(rec.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
    const qrText = `${process.env.APP_URL ?? 'https://vetcore.id'}/verify/sehat/${rec.id}`

    const body = [
      `Yang bertanda tangan di bawah ini menerangkan bahwa:`,
      `Hewan bernama "${patient.petName}" (${patient.petCategory}) milik ${patient.owner.ownerName}`,
      `telah diperiksa pada tanggal ${date} dan dinyatakan SEHAT.`,
      ``,
      ...(rec.diagnosa ? [`Diagnosa    : ${rec.diagnosa}`] : []),
      ...(rec.weightKg ? [`Berat Badan : ${rec.weightKg} kg`] : []),
      ...(rec.temperature ? [`Suhu Tubuh  : ${rec.temperature}°C`] : []),
      ...(rec.homeInstructions ? [`Instruksi   : ${rec.homeInstructions}`] : []),
      ``,
      `Hewan tersebut layak untuk perjalanan / keperluan sebagaimana mestinya.`,
    ]

    const qrDataUrl = await buildQRDataUrl(qrText)
    const pdf = await drawCertPDF({
      title: CERT_TYPES.sehat, certNumber: certNum,
      branchName: branch.branchName, branchAddress: branch.address ?? undefined, branchPhone: branch.phoneNumber ?? undefined,
      petName: patient.petName, species: patient.petCategory,
      ownerName: patient.owner.ownerName,
      docBody: body, doctorName: rec.doctor.fullname, date, qrDataUrl,
    })

    reply.header('Content-Type', 'application/pdf')
    reply.header('Content-Disposition', `attachment; filename="surat-sehat-${rec.id}.pdf"`)
    return reply.send(pdf)
  })

  // GET /sertifikat/prosedur/:procedureId
  fastify.get('/sertifikat/prosedur/:procedureId', { preHandler: [authenticate] }, async (req: any, reply) => {
    const id = BigInt(req.params.procedureId)
    const rec = await prisma.majorProcedureRecord.findFirst({
      where: { id, checkUpResult: { registration: certBranchFilter(req.authUser) } },
      include: {
        patient: { include: { owner: true } },
        checkUpResult: { include: { doctor: true, registration: { include: { branch: true } } } },
      },
    })
    if (!rec) return reply.status(404).send({ message: 'Record tidak ditemukan' })

    const branch = rec.checkUpResult?.registration?.branch
    const doctor = rec.checkUpResult?.doctor
    const certNum = `PROS/${rec.id}/${new Date(rec.performedAt).getFullYear()}`
    const date = new Date(rec.performedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
    const qrText = `${process.env.APP_URL ?? 'https://vetcore.id'}/verify/prosedur/${rec.id}`

    const body = [
      `Yang bertanda tangan di bawah ini menerangkan bahwa:`,
      `Hewan bernama "${rec.patient.petName}" (${rec.patient.petCategory}) milik ${rec.patient.owner.ownerName}`,
      `telah menjalani prosedur medis: ${rec.procedureName}`,
      `pada tanggal ${date}.`,
      ...(rec.notes ? [``, `Catatan : ${rec.notes}`] : []),
      ``,
      `Demikian sertifikat ini dibuat sebagai bukti resmi tindakan medis.`,
    ]

    const qrDataUrl = await buildQRDataUrl(qrText)
    const pdf = await drawCertPDF({
      title: CERT_TYPES.prosedur, certNumber: certNum,
      branchName: branch?.branchName ?? 'Klinik Hewan', branchAddress: branch?.address ?? undefined, branchPhone: branch?.phoneNumber ?? undefined,
      petName: rec.patient.petName, species: rec.patient.petCategory,
      ownerName: rec.patient.owner.ownerName,
      docBody: body, doctorName: doctor?.fullname ?? 'Dokter Hewan', date, qrDataUrl,
    })

    reply.header('Content-Type', 'application/pdf')
    reply.header('Content-Disposition', `attachment; filename="sertifikat-prosedur-${rec.id}.pdf"`)
    return reply.send(pdf)
  })
}

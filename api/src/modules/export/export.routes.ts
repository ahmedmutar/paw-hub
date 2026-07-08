import { FastifyInstance } from 'fastify'
import PDFDocument from 'pdfkit'
import ExcelJS from 'exceljs'
import { authenticate, requireRole } from '../../middleware/auth'
import { audit, getIp } from '../../lib/audit'

function formatRp(n: number | string) {
  return `Rp ${Number(n).toLocaleString('id-ID')}`
}
function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ── PDF: Struk Pembayaran ─────────────────────────────────────────────────────
function buildInvoicePdf(payment: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: 'A5', margin: 36 })
    const chunks: Buffer[] = []
    doc.on('data', c => chunks.push(c))
    doc.on('end',  () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const w = doc.page.width - 72

    // Header
    doc.font('Helvetica-Bold').fontSize(18).text('VetCore', 36, 36)
    const branch = payment.checkUpResult?.registration?.branch ?? {}
    doc.font('Helvetica').fontSize(9).fillColor('#555')
       .text(branch.branchName ?? '-', 36, 58)
       .text(branch.address    ?? '',  36, 70)
       .text(branch.phoneNumber ?? '', 36, 82)
    doc.moveTo(36, 100).lineTo(36 + w, 100).strokeColor('#e2e8f0').stroke()

    doc.font('Helvetica-Bold').fontSize(14).fillColor('#0f172a')
       .text('STRUK PEMBAYARAN', 36, 110, { align: 'center', width: w })

    doc.font('Helvetica').fontSize(9).fillColor('#334155')
    const metaY = 132
    doc.text(`No. Invoice : INV-${payment.id}`,              36, metaY)
    doc.text(`Tanggal     : ${fmtDate(payment.createdAt)}`,  36, metaY + 13)
    doc.text(`Kasir       : ${payment.createdBy?.fullname ?? '-'}`, 36, metaY + 26)

    const reg = payment.checkUpResult?.registration
    const pat = reg?.patient
    doc.text(`Pemilik     : ${pat?.owner?.ownerName ?? '-'}`, 36 + w/2, metaY)
    doc.text(`Hewan       : ${pat?.petName ?? '-'}`,          36 + w/2, metaY + 13)
    doc.text(`Jenis       : ${pat?.petCategory ?? '-'}`,      36 + w/2, metaY + 26)

    doc.moveTo(36, metaY + 46).lineTo(36 + w, metaY + 46).strokeColor('#cbd5e1').stroke()

    let y = metaY + 58
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#475569')
    doc.text('Item / Layanan', 36, y)
    doc.text('Jml',   36 + w * 0.6, y, { width: 40, align: 'right' })
    doc.text('Harga', 36 + w * 0.75, y, { width: w * 0.25, align: 'right' })
    doc.moveTo(36, y + 14).lineTo(36 + w, y + 14).strokeColor('#e2e8f0').stroke()
    y += 20
    doc.font('Helvetica').fillColor('#1e293b')
    const lineH = 14

    for (const item of payment.paymentItems ?? []) {
      const name  = item.detailItemPatient?.priceItem?.listOfItem?.itemName ?? '-'
      const qty   = Number(item.quantity ?? 1)
      const price = Number(item.detailItemPatient?.priceOverall ?? 0)
      doc.text(name, 36, y, { width: w * 0.58 })
      doc.text(String(qty),     36 + w * 0.6, y,  { width: 40, align: 'right' })
      doc.text(formatRp(price), 36 + w * 0.75, y, { width: w * 0.25, align: 'right' })
      y += lineH
    }
    for (const svc of payment.paymentServices ?? []) {
      const name  = svc.detailServicePatient?.priceService?.listOfService?.serviceName ?? '-'
      const price = Number(svc.detailServicePatient?.priceOverall ?? 0)
      doc.text(name, 36, y, { width: w * 0.58 })
      doc.text('1', 36 + w * 0.6, y, { width: 40, align: 'right' })
      doc.text(formatRp(price), 36 + w * 0.75, y, { width: w * 0.25, align: 'right' })
      y += lineH
    }
    for (const med of payment.paymentMedicineGroups ?? []) {
      const name  = med.detailMedicineGroup?.priceMedicineGroup?.medicineGroup?.groupName ?? '-'
      const price = Number(med.detailMedicineGroup?.priceOverall ?? 0)
      doc.text(name, 36, y, { width: w * 0.58 })
      doc.text('1', 36 + w * 0.6, y, { width: 40, align: 'right' })
      doc.text(formatRp(price), 36 + w * 0.75, y, { width: w * 0.25, align: 'right' })
      y += lineH
    }

    y += 4
    doc.moveTo(36, y).lineTo(36 + w, y).strokeColor('#cbd5e1').stroke()
    y += 10

    const subtotal = Number(payment._subtotal ?? 0)
    const discount = Number(payment.discount  ?? 0)
    const total    = subtotal - discount

    const lx = 36 + w * 0.5, vw = w * 0.5
    doc.font('Helvetica').fillColor('#475569')
    doc.text('Subtotal',  lx, y, { width: vw * 0.5 })
    doc.text(formatRp(subtotal), lx + vw * 0.5, y, { width: vw * 0.5, align: 'right' })
    y += lineH
    if (discount > 0) {
      doc.fillColor('#ef4444')
      doc.text('Diskon', lx, y, { width: vw * 0.5 })
      doc.text(`- ${formatRp(discount)}`, lx + vw * 0.5, y, { width: vw * 0.5, align: 'right' })
      y += lineH
    }
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a')
    doc.text('TOTAL', lx, y, { width: vw * 0.5 })
    doc.text(formatRp(total), lx + vw * 0.5, y, { width: vw * 0.5, align: 'right' })
    y += lineH + 4
    doc.font('Helvetica').fontSize(8).fillColor('#64748b')
    doc.text(`Metode: ${payment.paymentMethod?.methodName ?? '-'}`, 36, y)

    y += 20
    doc.moveTo(36, y).lineTo(36 + w, y).strokeColor('#e2e8f0').stroke()
    doc.fontSize(8).fillColor('#94a3b8')
       .text('Terima kasih telah mempercayakan kesehatan hewan kesayangan Anda.', 36, y + 8, { align: 'center', width: w })

    doc.end()
  })
}

// ── Excel: Laporan ────────────────────────────────────────────────────────────
async function buildLaporanExcel(data: { title: string; rows: any[]; payments: any[] }): Promise<Buffer> {
  const wb   = new ExcelJS.Workbook()
  wb.creator = 'VetCore'

  const ws = wb.addWorksheet('Ringkasan', { properties: { tabColor: { argb: '14B8A6' } } })
  ws.columns = [{ width: 22 }, { width: 16 }, { width: 16 }, { width: 18 }]

  ws.mergeCells('A1:D1')
  const t = ws.getCell('A1')
  t.value = `Laporan ${data.title}`; t.font = { bold: true, size: 14, color: { argb: '0F766E' } }; t.alignment = { horizontal: 'center' }

  ws.getRow(2).height = 6
  const hdr = ws.getRow(3)
  ;['Tanggal', 'Pendaftaran', 'Pembayaran', 'Pendapatan (Rp)'].forEach((v, i) => {
    const c = hdr.getCell(i + 1)
    c.value = v; c.font = { bold: true, color: { argb: 'FFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0F766E' } }; c.alignment = { horizontal: 'center' }
  })

  let grand = 0
  data.rows.forEach(r => {
    const row = ws.addRow([r.date, r.registrations ?? 0, r.payments ?? 0, r.revenue ?? 0])
    row.getCell(4).numFmt = '#,##0'
    grand += Number(r.revenue ?? 0)
  })
  ws.addRow([])
  const tot = ws.addRow(['TOTAL', '', '', grand])
  tot.font = { bold: true }; tot.getCell(4).numFmt = '#,##0'

  // Sheet 2: detail pembayaran
  const ws2 = wb.addWorksheet('Pembayaran')
  ws2.columns = [
    { width: 6, header: 'No.' }, { width: 16, header: 'No. Invoice' },
    { width: 16, header: 'Tanggal' }, { width: 20, header: 'Hewan' },
    { width: 20, header: 'Pemilik' }, { width: 14, header: 'Metode' },
    { width: 14, header: 'Diskon (Rp)' }, { width: 16, header: 'Total (Rp)' },
  ]
  ws2.getRow(1).eachCell(c => {
    c.font = { bold: true, color: { argb: 'FFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0F766E' } }
  })

  data.payments.forEach((p: any, i) => {
    const r = ws2.addRow([
      i + 1, `INV-${p.id}`, fmtDate(p.createdAt),
      p.checkUpResult?.registration?.patient?.petName ?? '-',
      p.checkUpResult?.registration?.patient?.owner?.ownerName ?? '-',
      p.paymentMethod?.methodName ?? '-',
      Number(p.discount ?? 0),
      Number((p as any)._total ?? 0),
    ])
    r.getCell(7).numFmt = '#,##0'; r.getCell(8).numFmt = '#,##0'
    if (i % 2 === 1) r.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F0FDFA' } } })
  })

  return (await wb.xlsx.writeBuffer()) as unknown as Buffer
}

// ── Routes ────────────────────────────────────────────────────────────────────
export async function exportRoutes(app: FastifyInstance) {

  // GET /export/invoice/:paymentId — PDF struk
  app.get('/export/invoice/:paymentId', {
    preHandler: [authenticate, requireRole('admin', 'kasir', 'resepsionis')],
  }, async (req: any, reply) => {
    const { paymentId } = req.params as any

    const invoiceBranchFilter = req.authUser.role === 'superadmin'
      ? {}
      : req.authUser.tenantId
        ? { checkUpResult: { registration: { branch: { tenantId: req.authUser.tenantId } } } }
        : { checkUpResult: { registration: { branchId: req.authUser.branchId } } }

    const payment: any = await app.prisma.listOfPayment.findFirst({
      where: { id: BigInt(paymentId), ...invoiceBranchFilter },
      include: {
        paymentMethod: { select: { methodName: true } },
        createdBy:     { select: { fullname: true } },
        paymentItems:  {
          include: {
            detailItemPatient: {
              select: { priceOverall: true, priceItem: { select: { listOfItem: { select: { itemName: true } } } } },
            },
          },
        },
        paymentServices: {
          include: {
            detailServicePatient: {
              select: { priceOverall: true, priceService: { select: { listOfService: { select: { serviceName: true } } } } },
            },
          },
        },
        paymentMedicineGroups: {
          include: {
            detailMedicineGroup: {
              select: { quantity: true, medicineGroup: { select: { groupName: true } } },
            },
          },
        },
        checkUpResult: {
          include: {
            registration: {
              include: {
                patient: { include: { owner: { select: { ownerName: true } } } },
                branch:  { select: { branchName: true, address: true, phoneNumber: true } },
              },
            },
          },
        },
      },
    })
    if (!payment) return reply.status(404).send({ message: 'Data pembayaran tidak ditemukan' })

    const items    = (payment.paymentItems    ?? []).reduce((s: number, i: any) => s + Number(i.detailItemPatient?.priceOverall    ?? 0), 0)
    const services = (payment.paymentServices ?? []).reduce((s: number, i: any) => s + Number(i.detailServicePatient?.priceOverall ?? 0), 0)
    payment._subtotal = items + services

    const buf = await buildInvoicePdf(payment)

    audit(app.prisma, { tenantId: req.authUser.tenantId, userId: req.authUser.userId, username: req.authUser.username, action: 'export', resource: 'invoice', resourceId: paymentId, ipAddress: getIp(req) }).catch(() => {})

    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="INV-${paymentId}.pdf"`)
      .send(buf)
  })

  // GET /export/laporan?type=harian|bulanan&date=YYYY-MM-DD — Excel laporan
  app.get('/export/laporan', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (req: any, reply) => {
    const q    = req.query as any
    const type = q.type ?? 'harian'
    const date = q.date ? new Date(q.date) : new Date()

    let from: Date, to: Date, title: string
    if (type === 'bulanan') {
      from  = new Date(date.getFullYear(), date.getMonth(), 1)
      to    = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59)
      title = `Bulanan — ${date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`
    } else {
      from  = new Date(date); from.setHours(0, 0, 0, 0)
      to    = new Date(date); to.setHours(23, 59, 59, 999)
      title = `Harian — ${fmtDate(date)}`
    }

    const branchFilter = req.authUser.role === 'superadmin'
      ? (q.branchId ? { branchId: BigInt(q.branchId) } : {})
      : req.authUser.tenantId
        ? { checkUpResult: { registration: { branch: { tenantId: req.authUser.tenantId } } } }
        : { checkUpResult: { registration: { branchId: req.authUser.branchId } } }

    const payments: any[] = await app.prisma.listOfPayment.findMany({
      where:   { ...branchFilter, createdAt: { gte: from, lte: to }, isDeleted: false },
      include: {
        paymentMethod: { select: { methodName: true } },
        checkUpResult: {
          include: { registration: { include: { patient: { include: { owner: { select: { ownerName: true } } } } } } },
        },
        paymentItems:          { include: { detailItemPatient:    { select: { priceOverall: true } } } },
        paymentServices:       { include: { detailServicePatient: { select: { priceOverall: true } } } },
        paymentMedicineGroups: { include: { detailMedicineGroup:  { select: { quantity: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    })

    const byDay = new Map<string, { payments: number; revenue: number }>()
    for (const p of payments) {
      const dayKey = new Date(p.createdAt).toLocaleDateString('id-ID')
      const entry  = byDay.get(dayKey) ?? { payments: 0, revenue: 0 }
      const items    = (p.paymentItems    ?? []).reduce((s: number, i: any) => s + Number(i.detailItemPatient?.priceOverall    ?? 0), 0)
      const services = (p.paymentServices ?? []).reduce((s: number, i: any) => s + Number(i.detailServicePatient?.priceOverall ?? 0), 0)
      const subtotal = items + services
      entry.payments += 1
      entry.revenue  += subtotal - Number(p.discount ?? 0)
      p._total = subtotal - Number(p.discount ?? 0)
      byDay.set(dayKey, entry)
    }

    const rows = Array.from(byDay.entries()).map(([date, v]) => ({ date, registrations: 0, ...v }))
    const buf  = await buildLaporanExcel({ title, rows, payments })
    const fn   = `laporan-${type}-${date.toISOString().slice(0, 10)}.xlsx`

    audit(app.prisma, { tenantId: req.authUser.tenantId, userId: req.authUser.userId, username: req.authUser.username, action: 'export', resource: 'laporan', details: { type }, ipAddress: getIp(req) }).catch(() => {})

    return reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename="${fn}"`)
      .send(buf)
  })

  // GET /export/pasien — Excel daftar pasien
  app.get('/export/pasien', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (req: any, reply) => {
    const branchFilter = req.authUser.role === 'superadmin'
      ? {}
      : req.authUser.tenantId
        ? { branch: { tenantId: req.authUser.tenantId } }
        : { branchId: req.authUser.branchId }

    const patients: any[] = await app.prisma.patient.findMany({
      where:   { ...branchFilter, isDeleted: false },
      include: {
        owner:  { select: { ownerName: true, phoneNumber: true } },
        branch: { select: { branchName: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const wb = new ExcelJS.Workbook()
    wb.creator = 'VetCore'
    const ws = wb.addWorksheet('Data Pasien')
    ws.columns = [
      { width: 6,  header: 'No.'       },
      { width: 22, header: 'Nama Hewan' },
      { width: 14, header: 'Jenis'      },
      { width: 12, header: 'Kelamin'    },
      { width: 22, header: 'Pemilik'    },
      { width: 18, header: 'No. HP'     },
      { width: 20, header: 'Cabang'     },
      { width: 16, header: 'Tgl Daftar' },
    ]
    ws.getRow(1).eachCell(c => {
      c.font = { bold: true, color: { argb: 'FFFFFF' } }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0F766E' } }
    })
    patients.forEach((p, i) => {
      const r = ws.addRow([
        i + 1, p.petName, p.petCategory, p.petGender ?? '-',
        p.owner?.ownerName ?? '-', p.owner?.phoneNumber ?? '-',
        p.branch?.branchName ?? '-', fmtDate(p.createdAt),
      ])
      if (i % 2 === 1) r.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F0FDFA' } } })
    })

    const buf = (await wb.xlsx.writeBuffer()) as unknown as Buffer
    audit(app.prisma, { tenantId: req.authUser.tenantId, userId: req.authUser.userId, username: req.authUser.username, action: 'export', resource: 'pasien', ipAddress: getIp(req) }).catch(() => {})

    return reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename="daftar-pasien-${new Date().toISOString().slice(0,10)}.xlsx"`)
      .send(buf)
  })
}

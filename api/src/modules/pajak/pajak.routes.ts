// @ts-nocheck
import { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../../middleware/auth'
import ExcelJS from 'exceljs'

// PTKP 2024 (annual in IDR)
const PTKP: Record<string, number> = {
  TK0: 54_000_000,
  TK1: 58_500_000,
  TK2: 63_000_000,
  TK3: 67_500_000,
  K0: 58_500_000,
  K1: 63_000_000,
  K2: 67_500_000,
  K3: 72_000_000,
}

// PPh 21 tarif progresif (annual)
function calcPph21Annual(brutoAnnual: number, ptkpStatus: string): number {
  const ptkp = PTKP[ptkpStatus] ?? PTKP['TK0']
  const pkp = Math.max(0, brutoAnnual - ptkp)
  let tax = 0
  if (pkp <= 60_000_000) tax = pkp * 0.05
  else if (pkp <= 250_000_000) tax = 3_000_000 + (pkp - 60_000_000) * 0.15
  else if (pkp <= 500_000_000) tax = 31_500_000 + (pkp - 250_000_000) * 0.25
  else if (pkp <= 5_000_000_000) tax = 93_750_000 + (pkp - 500_000_000) * 0.30
  else tax = 1_443_750_000 + (pkp - 5_000_000_000) * 0.35
  return Math.round(tax / 12) // monthly
}

export async function pajakRoutes(app: FastifyInstance) {
  // Rekap PPh 21 per bulan
  app.get('/pajak/pph21/rekap', { preHandler: [authenticate, requireRole('admin')] }, async (req: any, reply) => {
    const { branchId } = req.authUser
    const { month, year } = req.query as any
    const m = Number(month ?? new Date().getMonth() + 1)
    const y = Number(year ?? new Date().getFullYear())

    const payrolls = await req.server.prisma.payroll.findMany({
      where: { branchId, periodMonth: m, periodYear: y, isDeleted: false },
      include: { employee: { select: { fullname: true, ptkpStatus: true, npwp: true, role: true, staffingNumber: true } } },
    })

    const rows = payrolls.map(p => {
      const brutoMonthly = Number(p.totalOverall)
      const pph21 = calcPph21Annual(brutoMonthly * 12, p.employee.ptkpStatus ?? 'TK0')
      return {
        id: p.id,
        staffingNumber: p.employee.staffingNumber,
        fullname: p.employee.fullname,
        ptkpStatus: p.employee.ptkpStatus,
        npwp: p.employee.npwp,
        brutoMonthly, pph21,
        netSalary: brutoMonthly - pph21,
      }
    })

    const totalBruto = rows.reduce((s, r) => s + r.brutoMonthly, 0)
    const totalPph21 = rows.reduce((s, r) => s + r.pph21, 0)

    return reply.send({ data: { month: m, year: y, rows, totalBruto, totalPph21, totalNet: totalBruto - totalPph21 } })
  })

  // Update ptkpStatus & npwp di User
  app.patch('/pajak/user/:userId/ptkp', { preHandler: [authenticate, requireRole('admin')] }, async (req: any, reply) => {
    const id = BigInt(req.params.userId)
    const { ptkpStatus, npwp } = req.body as any
    const user = await req.server.prisma.user.update({ where: { id }, data: { ptkpStatus, npwp } })
    return reply.send({ data: { id: user.id, ptkpStatus: user.ptkpStatus, npwp: user.npwp } })
  })

  // Export Excel PPh 21
  app.get('/pajak/pph21/export', { preHandler: [authenticate, requireRole('admin')] }, async (req: any, reply) => {
    const { branchId } = req.authUser
    const { month, year } = req.query as any
    const m = Number(month ?? new Date().getMonth() + 1)
    const y = Number(year ?? new Date().getFullYear())

    const payrolls = await req.server.prisma.payroll.findMany({
      where: { branchId, periodMonth: m, periodYear: y, isDeleted: false },
      include: { employee: { select: { fullname: true, ptkpStatus: true, npwp: true, staffingNumber: true } } },
    })

    const workbook = new ExcelJS.Workbook()
    const ws = workbook.addWorksheet('PPh 21')

    ws.columns = [
      { header: 'No', key: 'no', width: 5 },
      { header: 'NIP', key: 'staffingNumber', width: 15 },
      { header: 'Nama Karyawan', key: 'fullname', width: 30 },
      { header: 'NPWP', key: 'npwp', width: 20 },
      { header: 'Status PTKP', key: 'ptkpStatus', width: 12 },
      { header: 'Gaji Bruto (Rp)', key: 'bruto', width: 20 },
      { header: 'PPh 21 (Rp)', key: 'pph21', width: 18 },
      { header: 'Gaji Neto (Rp)', key: 'neto', width: 20 },
    ]

    ws.getRow(1).font = { bold: true }
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6F0F0' } }

    payrolls.forEach((p, i) => {
      const bruto = Number(p.totalOverall)
      const pph21 = calcPph21Annual(bruto * 12, p.employee.ptkpStatus ?? 'TK0')
      ws.addRow({
        no: i + 1,
        staffingNumber: p.employee.staffingNumber ?? '-',
        fullname: p.employee.fullname,
        npwp: p.employee.npwp ?? '-',
        ptkpStatus: p.employee.ptkpStatus ?? 'TK0',
        bruto, pph21, neto: bruto - pph21,
      })
    })

    // Total row
    const lastRow = ws.lastRow?.number ?? 1
    ws.addRow({
      no: '', staffingNumber: '', fullname: 'TOTAL', npwp: '', ptkpStatus: '',
      bruto: { formula: `SUM(F2:F${lastRow})` },
      pph21: { formula: `SUM(G2:G${lastRow})` },
      neto: { formula: `SUM(H2:H${lastRow})` },
    })
    ws.lastRow!.font = { bold: true }

    const buf = await workbook.xlsx.writeBuffer()
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    reply.header('Content-Disposition', `attachment; filename=PPh21-${y}-${String(m).padStart(2, '0')}.xlsx`)
    return reply.send(buf)
  })

  // WA reminder
  app.post('/pajak/pph21/reminder', { preHandler: [authenticate, requireRole('admin')] }, async (req: any, reply) => {
    const { branchId } = req.authUser
    const branch = await req.server.prisma.branch.findUnique({ where: { id: branchId } })
    const FONNTE_TOKEN = process.env.FONNTE_TOKEN ?? ''
    const target = branch?.phoneNumber ?? req.body.phone
    if (FONNTE_TOKEN && target) {
      const phone = target.replace(/[^0-9]/g, '').replace(/^0/, '62')
      fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { Authorization: FONNTE_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: phone, message: `*Pengingat Laporan Pajak*\n\nBatas waktu pelaporan SPT Masa PPh 21 adalah tanggal 20 bulan ini. Silakan ekspor laporan dari sistem VetCore dan laporkan ke DJP Online.` }),
      }).catch(() => {})
    }
    return reply.send({ message: 'Reminder terkirim' })
  })
}

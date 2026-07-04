import { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import { authenticate, requireRole } from '../../middleware/auth'
import QRCode from 'qrcode'

export async function barcodeRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma

  // POST /gudang/barcode/generate/:itemId — generate/assign barcode to item
  fastify.post('/gudang/barcode/generate/:itemId', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (req: any, reply) => {
    const itemId = BigInt(req.params.itemId)
    const item = await prisma.listOfItem.findUnique({ where: { id: itemId } })
    if (!item) return reply.status(404).send({ message: 'Item tidak ditemukan' })

    const barcodeId = item.barcodeId ?? `VET-${String(itemId).padStart(6, '0')}-${randomUUID().slice(0, 4).toUpperCase()}`

    await prisma.listOfItem.update({ where: { id: itemId }, data: { barcodeId } })

    const qrDataUrl = await QRCode.toDataURL(barcodeId, { width: 200, margin: 1 })

    return reply.send({ success: true, data: { barcodeId, qrDataUrl, itemId: itemId.toString(), itemName: item.itemName } })
  })

  // GET /gudang/barcode/scan — lookup item by barcode (used by scanner)
  fastify.get('/gudang/barcode/scan', {
    preHandler: [authenticate],
  }, async (req: any, reply) => {
    const { code } = req.query as { code: string }
    if (!code) return reply.status(400).send({ message: 'code wajib diisi' })

    const { branchId } = req.authUser

    const item = await prisma.listOfItem.findFirst({
      where: { barcodeId: code, branchId, isDeleted: false },
      include: {
        unitItem: true,
        categoryItem: true,
        priceItems: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { sellingPrice: true, capitalPrice: true },
        },
      },
    })

    if (!item) return reply.status(404).send({ message: `Barang dengan kode "${code}" tidak ditemukan` })

    return reply.send({
      data: {
        id: item.id.toString(), itemName: item.itemName, barcodeId: item.barcodeId,
        totalItem: Number(item.totalItem), limitItem: item.limitItem ? Number(item.limitItem) : null,
        unitName: item.unitItem.unitName, categoryName: item.categoryItem.categoryName,
        sellingPrice: item.priceItems[0] ? Number(item.priceItems[0].sellingPrice) : null,
        expiredDate: item.expiredDate,
        isLow: item.limitItem ? Number(item.totalItem) <= Number(item.limitItem) : false,
      },
    })
  })

  // GET /gudang/barcode/print/:itemId — get printable label data
  fastify.get('/gudang/barcode/print/:itemId', {
    preHandler: [authenticate],
  }, async (req: any, reply) => {
    const itemId = BigInt(req.params.itemId)
    const item = await prisma.listOfItem.findUnique({
      where: { id: itemId },
      include: { unitItem: true, priceItems: { orderBy: { createdAt: 'desc' }, take: 1 } },
    })
    if (!item) return reply.status(404).send({ message: 'Item tidak ditemukan' })
    if (!item.barcodeId) return reply.status(400).send({ message: 'Barang belum memiliki barcode. Generate barcode terlebih dahulu.' })

    const qrDataUrl = await QRCode.toDataURL(item.barcodeId, { width: 200, margin: 1 })
    const price = item.priceItems[0] ? Number(item.priceItems[0].sellingPrice) : 0

    return reply.send({
      data: {
        itemId: item.id.toString(), itemName: item.itemName, barcodeId: item.barcodeId,
        unitName: item.unitItem.unitName, sellingPrice: price, qrDataUrl,
        stock: Number(item.totalItem),
      },
    })
  })

  // GET /gudang/barcode/items — list all items with barcode status
  fastify.get('/gudang/barcode/items', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (req: any, reply) => {
    const { branchId } = req.authUser
    const { hasBarcode, search } = req.query as any

    const where: any = { branchId, isDeleted: false }
    if (hasBarcode === 'true') where.barcodeId = { not: null }
    if (hasBarcode === 'false') where.barcodeId = null
    if (search) where.itemName = { contains: search, mode: 'insensitive' }

    const items = await prisma.listOfItem.findMany({
      where, take: 100, orderBy: { itemName: 'asc' },
      include: { unitItem: true, categoryItem: true },
    })

    return reply.send({
      data: items.map(i => ({
        id: i.id.toString(), itemName: i.itemName, barcodeId: i.barcodeId,
        hasBarcode: !!i.barcodeId, totalItem: Number(i.totalItem),
        unitName: i.unitItem.unitName, categoryName: i.categoryItem.categoryName,
      })),
    })
  })
}

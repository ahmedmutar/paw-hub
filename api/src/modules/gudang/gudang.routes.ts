import { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/auth'

export async function gudangRoutes(app: FastifyInstance) {
  // ─── STATS ──────────────────────────────────────────────────────────────────

  app.get('/gudang/stats', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as any).authUser
    const branchFilter = user.role === 'admin' ? {} : { branchId: BigInt(user.branchId) }

    const [totalItems, lowStock, outOfStock, totalCategories, totalUnits, recentMovements] =
      await Promise.all([
        app.prisma.listOfItem.count({ where: { ...branchFilter, isDeleted: false } }),
        app.prisma.listOfItem.count({
          where: {
            ...branchFilter,
            isDeleted: false,
            AND: [
              { limitItem: { not: null } },
              { totalItem: { gt: 0 } },
            ],
          },
        }),
        app.prisma.listOfItem.count({
          where: { ...branchFilter, isDeleted: false, totalItem: { lte: 0 } },
        }),
        app.prisma.categoryItem.count({ where: { ...branchFilter, isDeleted: false } }),
        app.prisma.unitItem.count({ where: { ...branchFilter, isDeleted: false } }),
        app.prisma.stockMovement.count({
          where: {
            isDeleted: false,
            listOfItem: branchFilter.branchId ? { branchId: BigInt(user.branchId) } : {},
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        }),
      ])

    return reply.send({
      data: { totalItems, lowStock, outOfStock, totalCategories, totalUnits, recentMovements },
    })
  })

  // ─── KATEGORI ───────────────────────────────────────────────────────────────

  app.get('/gudang/kategori', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as any).authUser
    const branchFilter = user.role === 'admin' ? {} : { branchId: BigInt(user.branchId) }
    const q = (req.query as any).q ?? ''

    const data = await app.prisma.categoryItem.findMany({
      where: {
        ...branchFilter,
        isDeleted: false,
        ...(q ? { categoryName: { contains: q, mode: 'insensitive' } } : {}),
      },
      include: { _count: { select: { listOfItems: { where: { isDeleted: false } } } } },
      orderBy: { categoryName: 'asc' },
    })

    return reply.send({ data })
  })

  app.post('/gudang/kategori', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as any).authUser
    const { categoryName, branchId } = req.body as any
    const targetBranchId = user.role === 'admin' ? BigInt(branchId ?? user.branchId) : BigInt(user.branchId)

    const exists = await app.prisma.categoryItem.findFirst({
      where: { categoryName: { equals: categoryName, mode: 'insensitive' }, branchId: targetBranchId, isDeleted: false },
    })
    if (exists) return reply.status(400).send({ message: 'Kategori sudah ada.' })

    const data = await app.prisma.categoryItem.create({
      data: { categoryName, branchId: targetBranchId },
    })
    return reply.status(201).send({ data })
  })

  app.put('/gudang/kategori/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as any
    const { categoryName } = req.body as any

    const item = await app.prisma.categoryItem.findUnique({ where: { id: BigInt(id) } })
    if (!item || item.isDeleted) return reply.status(404).send({ message: 'Kategori tidak ditemukan.' })

    const exists = await app.prisma.categoryItem.findFirst({
      where: { categoryName: { equals: categoryName, mode: 'insensitive' }, branchId: item.branchId, isDeleted: false, NOT: { id: BigInt(id) } },
    })
    if (exists) return reply.status(400).send({ message: 'Nama kategori sudah digunakan.' })

    const data = await app.prisma.categoryItem.update({ where: { id: BigInt(id) }, data: { categoryName } })
    return reply.send({ data })
  })

  app.delete('/gudang/kategori/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as any
    const item = await app.prisma.categoryItem.findUnique({
      where: { id: BigInt(id) },
      include: { _count: { select: { listOfItems: { where: { isDeleted: false } } } } },
    })
    if (!item || item.isDeleted) return reply.status(404).send({ message: 'Kategori tidak ditemukan.' })
    if (item._count.listOfItems > 0) return reply.status(400).send({ message: `Tidak dapat dihapus. Masih digunakan oleh ${item._count.listOfItems} barang.` })

    await app.prisma.categoryItem.update({ where: { id: BigInt(id) }, data: { isDeleted: true } })
    return reply.send({ message: 'Kategori dihapus.' })
  })

  // ─── SATUAN ─────────────────────────────────────────────────────────────────

  app.get('/gudang/satuan', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as any).authUser
    const branchFilter = user.role === 'admin' ? {} : { branchId: BigInt(user.branchId) }
    const q = (req.query as any).q ?? ''

    const data = await app.prisma.unitItem.findMany({
      where: {
        ...branchFilter,
        isDeleted: false,
        ...(q ? { unitName: { contains: q, mode: 'insensitive' } } : {}),
      },
      include: { _count: { select: { listOfItems: { where: { isDeleted: false } } } } },
      orderBy: { unitName: 'asc' },
    })

    return reply.send({ data })
  })

  app.post('/gudang/satuan', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as any).authUser
    const { unitName, branchId } = req.body as any
    const targetBranchId = user.role === 'admin' ? BigInt(branchId ?? user.branchId) : BigInt(user.branchId)

    const exists = await app.prisma.unitItem.findFirst({
      where: { unitName: { equals: unitName, mode: 'insensitive' }, branchId: targetBranchId, isDeleted: false },
    })
    if (exists) return reply.status(400).send({ message: 'Satuan sudah ada.' })

    const data = await app.prisma.unitItem.create({ data: { unitName, branchId: targetBranchId } })
    return reply.status(201).send({ data })
  })

  app.put('/gudang/satuan/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as any
    const { unitName } = req.body as any

    const item = await app.prisma.unitItem.findUnique({ where: { id: BigInt(id) } })
    if (!item || item.isDeleted) return reply.status(404).send({ message: 'Satuan tidak ditemukan.' })

    const exists = await app.prisma.unitItem.findFirst({
      where: { unitName: { equals: unitName, mode: 'insensitive' }, branchId: item.branchId, isDeleted: false, NOT: { id: BigInt(id) } },
    })
    if (exists) return reply.status(400).send({ message: 'Nama satuan sudah digunakan.' })

    const data = await app.prisma.unitItem.update({ where: { id: BigInt(id) }, data: { unitName } })
    return reply.send({ data })
  })

  app.delete('/gudang/satuan/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as any
    const item = await app.prisma.unitItem.findUnique({
      where: { id: BigInt(id) },
      include: { _count: { select: { listOfItems: { where: { isDeleted: false } } } } },
    })
    if (!item || item.isDeleted) return reply.status(404).send({ message: 'Satuan tidak ditemukan.' })
    if (item._count.listOfItems > 0) return reply.status(400).send({ message: `Tidak dapat dihapus. Masih digunakan oleh ${item._count.listOfItems} barang.` })

    await app.prisma.unitItem.update({ where: { id: BigInt(id) }, data: { isDeleted: true } })
    return reply.send({ message: 'Satuan dihapus.' })
  })

  // ─── BARANG ─────────────────────────────────────────────────────────────────

  app.get('/gudang/barang', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as any).authUser
    const branchFilter = user.role === 'admin' ? {} : { branchId: BigInt(user.branchId) }
    const { q = '', categoryId, status, page = '1', limit = '20' } = req.query as any
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where: any = {
      ...branchFilter,
      isDeleted: false,
      ...(q ? { itemName: { contains: q, mode: 'insensitive' } } : {}),
      ...(categoryId ? { categoryItemId: BigInt(categoryId) } : {}),
    }

    if (status === 'low') {
      where.AND = [{ limitItem: { not: null } }, { totalItem: { gt: 0 } }]
    } else if (status === 'out') {
      where.totalItem = { lte: 0 }
    } else if (status === 'active') {
      where.isActive = true
    } else if (status === 'inactive') {
      where.isActive = false
    }

    const [data, total] = await Promise.all([
      app.prisma.listOfItem.findMany({
        where,
        include: {
          categoryItem: true,
          unitItem: true,
          priceItems: {
            where: { isDeleted: false },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { itemName: 'asc' },
        skip,
        take: parseInt(limit),
      }),
      app.prisma.listOfItem.count({ where }),
    ])

    return reply.send({ data, total, page: parseInt(page), limit: parseInt(limit) })
  })

  app.get('/gudang/barang/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as any
    const data = await app.prisma.listOfItem.findUnique({
      where: { id: BigInt(id) },
      include: {
        categoryItem: true,
        unitItem: true,
        priceItems: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' },
        },
        stockMovements: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    })
    if (!data || data.isDeleted) return reply.status(404).send({ message: 'Barang tidak ditemukan.' })
    return reply.send({ data })
  })

  app.post('/gudang/barang', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as any).authUser
    const {
      itemName, description, limitItem, expiredDate,
      unitItemId, categoryItemId, branchId,
      sellingPrice, capitalPrice, doctorFee = 0,
    } = req.body as any
    const targetBranchId = user.role === 'admin' ? BigInt(branchId ?? user.branchId) : BigInt(user.branchId)

    const data = await app.prisma.$transaction(async (tx) => {
      const item = await tx.listOfItem.create({
        data: {
          itemName,
          description,
          totalItem: 0,
          limitItem: limitItem ? parseFloat(limitItem) : null,
          expiredDate: expiredDate ? new Date(expiredDate) : null,
          unitItemId: BigInt(unitItemId),
          categoryItemId: BigInt(categoryItemId),
          branchId: targetBranchId,
        },
      })

      if (sellingPrice != null && capitalPrice != null) {
        await tx.priceItem.create({
          data: {
            listOfItemId: item.id,
            sellingPrice: parseFloat(sellingPrice),
            capitalPrice: parseFloat(capitalPrice),
            doctorFee: parseFloat(doctorFee),
            petshopFee: 0,
          },
        })
      }

      return tx.listOfItem.findUnique({
        where: { id: item.id },
        include: {
          categoryItem: true,
          unitItem: true,
          priceItems: { where: { isDeleted: false }, orderBy: { createdAt: 'desc' }, take: 1 },
        },
      })
    })

    return reply.status(201).send({ data })
  })

  app.put('/gudang/barang/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as any
    const {
      itemName, description, limitItem, expiredDate,
      unitItemId, categoryItemId, isActive,
    } = req.body as any

    const item = await app.prisma.listOfItem.findUnique({ where: { id: BigInt(id) } })
    if (!item || item.isDeleted) return reply.status(404).send({ message: 'Barang tidak ditemukan.' })

    const data = await app.prisma.listOfItem.update({
      where: { id: BigInt(id) },
      data: {
        itemName,
        description,
        limitItem: limitItem != null ? parseFloat(limitItem) : null,
        expiredDate: expiredDate ? new Date(expiredDate) : null,
        unitItemId: unitItemId ? BigInt(unitItemId) : undefined,
        categoryItemId: categoryItemId ? BigInt(categoryItemId) : undefined,
        isActive: isActive != null ? Boolean(isActive) : undefined,
      },
      include: {
        categoryItem: true,
        unitItem: true,
        priceItems: { where: { isDeleted: false }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })
    return reply.send({ data })
  })

  app.delete('/gudang/barang/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as any
    const item = await app.prisma.listOfItem.findUnique({
      where: { id: BigInt(id) },
      include: { _count: { select: { priceItems: { where: { detailItemPatients: { some: {} } } } } } },
    })
    if (!item || item.isDeleted) return reply.status(404).send({ message: 'Barang tidak ditemukan.' })

    await app.prisma.listOfItem.update({
      where: { id: BigInt(id) },
      data: { isDeleted: true },
    })
    return reply.send({ message: 'Barang dihapus.' })
  })

  // ─── HARGA BARANG ────────────────────────────────────────────────────────────

  app.post('/gudang/barang/:id/harga', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as any
    const { sellingPrice, capitalPrice, doctorFee = 0 } = req.body as any

    const item = await app.prisma.listOfItem.findUnique({ where: { id: BigInt(id) } })
    if (!item || item.isDeleted) return reply.status(404).send({ message: 'Barang tidak ditemukan.' })

    if (parseFloat(doctorFee) > parseFloat(sellingPrice)) {
      return reply.status(400).send({ message: 'Doctor fee tidak boleh melebihi harga jual.' })
    }

    const data = await app.prisma.$transaction(async (tx) => {
      // Soft-delete harga lama
      await tx.priceItem.updateMany({
        where: { listOfItemId: BigInt(id), isDeleted: false },
        data: { isDeleted: true },
      })
      // Buat harga baru
      return tx.priceItem.create({
        data: {
          listOfItemId: BigInt(id),
          sellingPrice: parseFloat(sellingPrice),
          capitalPrice: parseFloat(capitalPrice),
          doctorFee: parseFloat(doctorFee),
          petshopFee: 0,
        },
      })
    })

    return reply.status(201).send({ data })
  })

  app.get('/gudang/barang/:id/harga/riwayat', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as any
    const data = await app.prisma.priceItem.findMany({
      where: { listOfItemId: BigInt(id) },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send({ data })
  })

  // ─── MUTASI STOK ─────────────────────────────────────────────────────────────

  app.get('/gudang/mutasi', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as any).authUser
    const { itemId, status, dateFrom, dateTo, page = '1', limit = '30' } = req.query as any
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const branchWhere = user.role === 'admin' ? {} : { branchId: BigInt(user.branchId) }

    const where: any = {
      isDeleted: false,
      listOfItem: { ...branchWhere, isDeleted: false },
      ...(itemId ? { listOfItemId: BigInt(itemId) } : {}),
      ...(status ? { status } : {}),
    }

    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = new Date(dateFrom)
      if (dateTo) {
        const end = new Date(dateTo)
        end.setDate(end.getDate() + 1)
        where.createdAt.lt = end
      }
    }

    const [data, total] = await Promise.all([
      app.prisma.stockMovement.findMany({
        where,
        include: {
          listOfItem: {
            include: { unitItem: true, categoryItem: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      app.prisma.stockMovement.count({ where }),
    ])

    return reply.send({ data, total, page: parseInt(page), limit: parseInt(limit) })
  })

  app.post('/gudang/mutasi', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as any).authUser
    const { listOfItemId, quantity, status, notes } = req.body as any

    if (!['masuk', 'keluar', 'adjustment'].includes(status)) {
      return reply.status(400).send({ message: 'Status tidak valid. Gunakan: masuk, keluar, adjustment.' })
    }
    if (parseFloat(quantity) <= 0) {
      return reply.status(400).send({ message: 'Jumlah harus lebih dari 0.' })
    }

    const item = await app.prisma.listOfItem.findUnique({ where: { id: BigInt(listOfItemId) } })
    if (!item || item.isDeleted) return reply.status(404).send({ message: 'Barang tidak ditemukan.' })

    // Cek stok cukup untuk keluar
    if (status === 'keluar' && Number(item.totalItem) < parseFloat(quantity)) {
      return reply.status(400).send({ message: `Stok tidak cukup. Stok saat ini: ${item.totalItem}` })
    }

    const data = await app.prisma.$transaction(async (tx) => {
      // Buat mutasi
      const movement = await tx.stockMovement.create({
        data: {
          listOfItemId: BigInt(listOfItemId),
          quantity: parseFloat(quantity),
          status,
          notes,
          userId: BigInt(user.userId),
        },
        include: { listOfItem: { include: { unitItem: true } } },
      })

      // Update total stok
      let newTotal = Number(item.totalItem)
      if (status === 'masuk') newTotal += parseFloat(quantity)
      else if (status === 'keluar') newTotal -= parseFloat(quantity)
      else if (status === 'adjustment') newTotal = parseFloat(quantity) // Set langsung

      await tx.listOfItem.update({
        where: { id: BigInt(listOfItemId) },
        data: { totalItem: newTotal },
      })

      return movement
    })

    return reply.status(201).send({ data })
  })

  // ─── SEARCH BARANG (untuk autocomplete di pemeriksaan) ──────────────────────

  app.get('/gudang/search', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as any).authUser
    const branchFilter = user.role === 'admin' ? {} : { branchId: BigInt(user.branchId) }
    const q = (req.query as any).q ?? ''

    const data = await app.prisma.listOfItem.findMany({
      where: {
        ...branchFilter,
        isDeleted: false,
        isActive: true,
        totalItem: { gt: 0 },
        ...(q ? { itemName: { contains: q, mode: 'insensitive' } } : {}),
      },
      include: {
        unitItem: true,
        priceItems: { where: { isDeleted: false }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
      take: 15,
      orderBy: { itemName: 'asc' },
    })

    return reply.send({ data })
  })

  // ─── LOW STOCK ALERT ─────────────────────────────────────────────────────────

  app.get('/gudang/low-stock', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as any).authUser
    const branchFilter = user.role === 'admin' ? {} : { branchId: BigInt(user.branchId) }

    const data = await app.prisma.listOfItem.findMany({
      where: {
        ...branchFilter,
        isDeleted: false,
        isActive: true,
        limitItem: { not: null },
        // Will filter in JS since Prisma can't compare two fields directly in all versions
      },
      include: { unitItem: true, categoryItem: true },
      orderBy: { totalItem: 'asc' },
    })

    // Filter: totalItem <= limitItem
    const lowStockItems = data.filter(
      (item) => item.limitItem !== null && Number(item.totalItem) <= Number(item.limitItem)
    )

    return reply.send({ data: lowStockItems })
  })
}

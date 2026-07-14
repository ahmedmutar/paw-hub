import { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../../middleware/auth'

export async function petshopRoutes(app: FastifyInstance) {

  // ─── Helper ──────────────────────────────────────────────────────────────────

  // Admin dikunci ke seluruh cabang di tenant-nya (bukan `{}` kosong — itu bocor
  // lintas tenant), non-admin dikunci ke cabang sendiri.
  function branchFilter(user: any, qBranch?: string) {
    if (user.role !== 'admin') return { branchId: BigInt(user.branchId) }
    // Instalasi lama tanpa tenant (tenantId null) — jangan crash, admin lihat semua cabang.
    if (!user.tenantId) return qBranch ? { branchId: BigInt(qBranch) } : {}
    if (qBranch) return { branchId: BigInt(qBranch), branch: { tenantId: BigInt(user.tenantId) } }
    return { branch: { tenantId: BigInt(user.tenantId) } }
  }

  // PaymentPetshop tidak punya branchId langsung — scope lewat relasi user.
  function trxUserFilter(user: any) {
    if (user.role !== 'admin') return { user: { branchId: BigInt(user.branchId) } }
    return user.tenantId ? { user: { branch: { tenantId: BigInt(user.tenantId) } } } : {}
  }

  // ─── PRODUK ──────────────────────────────────────────────────────────────────

  app.get('/petshop/produk', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as any).authUser
    const { branchId: qBranch, search, lowStock } = req.query as any

    const where: any = {
      isDeleted: false,
      ...branchFilter(user, qBranch),
      ...(search ? { itemName: { contains: search, mode: 'insensitive' } } : {}),
    }

    const products = await app.prisma.listOfItemPetShop.findMany({
      where,
      include: {
        branch: { select: { id: true, branchName: true } },
        priceItemPetShops: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { itemName: 'asc' },
    })

    let result = products.map(formatProduct)

    if (lowStock === 'true') {
      result = result.filter((p) => p.limitItem !== null && p.totalItem <= p.limitItem)
    }

    return reply.send({ data: result })
  })

  app.get('/petshop/produk/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as any).authUser
    const { id } = req.params as any

    const product = await app.prisma.listOfItemPetShop.findFirst({
      where: { id: BigInt(id), isDeleted: false, ...branchFilter(user) },
      include: {
        branch: { select: { id: true, branchName: true } },
        priceItemPetShops: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!product) return reply.status(404).send({ message: 'Produk tidak ditemukan' })
    return reply.send({ data: formatProduct(product) })
  })

  app.post('/petshop/produk', { preHandler: [authenticate, requireRole('admin')] }, async (req, reply) => {
    const user = (req as any).authUser
    const { itemName, unitItemId, categoryItemId, branchId, limitItem, expiredDate,
            sellingPrice, capitalPrice, petshopFee } = req.body as any

    if (!itemName || !unitItemId || !categoryItemId || !branchId || !sellingPrice || !capitalPrice) {
      return reply.status(400).send({ message: 'Field wajib tidak lengkap' })
    }

    const targetBranch = await app.prisma.branch.findFirst({
      where: user.tenantId ? { id: BigInt(branchId), tenantId: BigInt(user.tenantId) } : { id: BigInt(branchId) },
    })
    if (!targetBranch) return reply.status(404).send({ message: 'Cabang tidak ditemukan.' })

    const product = await app.prisma.listOfItemPetShop.create({
      data: {
        itemName,
        unitItemId: BigInt(unitItemId),
        categoryItemId: BigInt(categoryItemId),
        branchId: BigInt(branchId),
        totalItem: 0,
        limitItem: limitItem ? Number(limitItem) : null,
        expiredDate: expiredDate ? new Date(expiredDate) : null,
        priceItemPetShops: {
          create: {
            sellingPrice: Number(sellingPrice),
            capitalPrice: Number(capitalPrice),
            petshopFee: Number(petshopFee ?? 0),
          },
        },
      },
      include: {
        branch: { select: { id: true, branchName: true } },
        priceItemPetShops: { where: { isDeleted: false }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })

    return reply.status(201).send({ data: formatProduct(product), message: 'Produk berhasil ditambahkan' })
  })

  app.put('/petshop/produk/:id', { preHandler: [authenticate, requireRole('admin')] }, async (req, reply) => {
    const user = (req as any).authUser
    const { id } = req.params as any
    const { itemName, unitItemId, categoryItemId, limitItem, expiredDate } = req.body as any

    const existing = await app.prisma.listOfItemPetShop.findFirst({
      where: { id: BigInt(id), isDeleted: false, ...branchFilter(user) },
    })
    if (!existing) return reply.status(404).send({ message: 'Produk tidak ditemukan' })

    const updated = await app.prisma.listOfItemPetShop.update({
      where: { id: BigInt(id) },
      data: {
        ...(itemName ? { itemName } : {}),
        ...(unitItemId ? { unitItemId: BigInt(unitItemId) } : {}),
        ...(categoryItemId ? { categoryItemId: BigInt(categoryItemId) } : {}),
        limitItem: limitItem !== undefined ? (limitItem ? Number(limitItem) : null) : existing.limitItem,
        ...(expiredDate !== undefined ? { expiredDate: expiredDate ? new Date(expiredDate) : null } : {}),
      },
      include: {
        branch: { select: { id: true, branchName: true } },
        priceItemPetShops: { where: { isDeleted: false }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })

    return reply.send({ data: formatProduct(updated), message: 'Produk berhasil diperbarui' })
  })

  app.delete('/petshop/produk/:id', { preHandler: [authenticate, requireRole('admin')] }, async (req, reply) => {
    const user = (req as any).authUser
    const { id } = req.params as any
    const existing = await app.prisma.listOfItemPetShop.findFirst({ where: { id: BigInt(id), isDeleted: false, ...branchFilter(user) } })
    if (!existing) return reply.status(404).send({ message: 'Produk tidak ditemukan' })

    await app.prisma.listOfItemPetShop.update({
      where: { id: BigInt(id) },
      data: { isDeleted: true },
    })
    return reply.send({ message: 'Produk berhasil dihapus' })
  })

  // ─── STOK ────────────────────────────────────────────────────────────────────

  // Tambah stok masuk (mutasi manual)
  app.post('/petshop/produk/:id/stok', { preHandler: [authenticate, requireRole('admin')] }, async (req, reply) => {
    const user = (req as any).authUser
    const { id } = req.params as any
    const { qty, type } = req.body as any // type: 'masuk' | 'keluar'

    if (!qty || !type) return reply.status(400).send({ message: 'qty dan type wajib diisi' })

    const product = await app.prisma.listOfItemPetShop.findFirst({ where: { id: BigInt(id), isDeleted: false, ...branchFilter(user) } })
    if (!product) return reply.status(404).send({ message: 'Produk tidak ditemukan' })

    const delta = type === 'masuk' ? Number(qty) : -Number(qty)
    const newStock = Number(product.totalItem) + delta

    if (newStock < 0) return reply.status(400).send({ message: 'Stok tidak mencukupi' })

    await app.prisma.listOfItemPetShop.update({
      where: { id: BigInt(id) },
      data: { totalItem: newStock },
    })

    return reply.send({ data: { totalItem: newStock }, message: `Stok berhasil di-${type === 'masuk' ? 'tambahkan' : 'kurangi'}` })
  })

  // ─── HARGA ───────────────────────────────────────────────────────────────────

  app.get('/petshop/harga/:produkId', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as any).authUser
    const { produkId } = req.params as any

    const product = await app.prisma.listOfItemPetShop.findFirst({
      where: { id: BigInt(produkId), isDeleted: false, ...branchFilter(user) },
    })
    if (!product) return reply.status(404).send({ message: 'Produk tidak ditemukan' })

    const prices = await app.prisma.priceItemPetShop.findMany({
      where: { listOfItemPetShopId: BigInt(produkId), isDeleted: false },
      orderBy: { createdAt: 'desc' },
    })

    return reply.send({ data: prices.map(formatPrice) })
  })

  app.post('/petshop/harga/:produkId', { preHandler: [authenticate, requireRole('admin')] }, async (req, reply) => {
    const user = (req as any).authUser
    const { produkId } = req.params as any
    const { sellingPrice, capitalPrice, petshopFee } = req.body as any

    if (!sellingPrice || !capitalPrice) {
      return reply.status(400).send({ message: 'sellingPrice dan capitalPrice wajib diisi' })
    }

    const product = await app.prisma.listOfItemPetShop.findFirst({
      where: { id: BigInt(produkId), isDeleted: false, ...branchFilter(user) },
    })
    if (!product) return reply.status(404).send({ message: 'Produk tidak ditemukan' })

    const price = await app.prisma.priceItemPetShop.create({
      data: {
        listOfItemPetShopId: BigInt(produkId),
        sellingPrice: Number(sellingPrice),
        capitalPrice: Number(capitalPrice),
        petshopFee: Number(petshopFee ?? 0),
      },
    })

    return reply.status(201).send({ data: formatPrice(price), message: 'Harga berhasil ditambahkan' })
  })

  // ─── TRANSAKSI / KASIR ───────────────────────────────────────────────────────

  app.get('/petshop/transaksi', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as any).authUser
    const { startDate, endDate, page = '1', limit = '20' } = req.query as any

    const skip = (Number(page) - 1) * Number(limit)
    const dateFilter = startDate && endDate
      ? { createdAt: { gte: new Date(startDate), lte: new Date(endDate + 'T23:59:59') } }
      : {}

    const userFilter = trxUserFilter(user)

    const [transactions, total] = await Promise.all([
      app.prisma.paymentPetshop.findMany({
        where: { isDeleted: false, ...dateFilter, ...userFilter },
        include: {
          user: { select: { id: true, fullname: true, branch: { select: { id: true, branchName: true } } } },
          items: {
            include: {
              priceItemPetShop: {
                include: { listOfItemPetShop: { select: { id: true, itemName: true } } },
              },
            },
          },
          clinicItems: {
            include: {
              priceItemPetShop: {
                include: { listOfItemPetShop: { select: { id: true, itemName: true } } },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      app.prisma.paymentPetshop.count({ where: { isDeleted: false, ...dateFilter, ...userFilter } }),
    ])

    return reply.send({
      data: transactions.map(formatTransaction),
      meta: { total, page: Number(page), limit: Number(limit) },
    })
  })

  app.get('/petshop/transaksi/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as any).authUser
    const { id } = req.params as any

    const trx = await app.prisma.paymentPetshop.findFirst({
      where: { id: BigInt(id), isDeleted: false, ...trxUserFilter(user) },
      include: {
        user: { select: { id: true, fullname: true, branch: { select: { id: true, branchName: true } } } },
        items: {
          include: {
            priceItemPetShop: {
              include: { listOfItemPetShop: true },
            },
          },
        },
        clinicItems: {
          include: {
            priceItemPetShop: {
              include: { listOfItemPetShop: true },
            },
          },
        },
      },
    })

    if (!trx) return reply.status(404).send({ message: 'Transaksi tidak ditemukan' })
    return reply.send({ data: formatTransaction(trx) })
  })

  app.post('/petshop/transaksi', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as any).authUser
    const { paymentMethodId, discount = 0, items = [] } = req.body as any

    // items: [{ priceItemPetShopId, totalItem, amountDiscount?, type: 'retail'|'clinic' }]
    if (!items.length) return reply.status(400).send({ message: 'Tidak ada item dalam transaksi' })

    // Validate stock for all items
    for (const item of items) {
      const price = await app.prisma.priceItemPetShop.findFirst({
        where: { id: BigInt(item.priceItemPetShopId), isDeleted: false },
        include: { listOfItemPetShop: true },
      })
      if (!price) return reply.status(404).send({ message: `Harga produk tidak ditemukan` })
      if (Number(price.listOfItemPetShop.totalItem) < Number(item.totalItem)) {
        return reply.status(400).send({
          message: `Stok ${price.listOfItemPetShop.itemName} tidak mencukupi (tersisa: ${price.listOfItemPetShop.totalItem})`,
        })
      }
    }

    // Create transaction
    const retailItems = items.filter((i: any) => i.type !== 'clinic')
    const clinicItems = items.filter((i: any) => i.type === 'clinic')

    const trx = await app.prisma.paymentPetshop.create({
      data: {
        userId: BigInt(user.userId),
        discount: Number(discount),
        ...(paymentMethodId ? { paymentMethodId: BigInt(paymentMethodId) } : {}),
        items: {
          create: retailItems.map((i: any) => ({
            priceItemPetShopId: BigInt(i.priceItemPetShopId),
            totalItem: Number(i.totalItem),
            amountDiscount: Number(i.amountDiscount ?? 0),
          })),
        },
        clinicItems: {
          create: clinicItems.map((i: any) => ({
            priceItemPetShopId: BigInt(i.priceItemPetShopId),
            totalItem: Number(i.totalItem),
            amountDiscount: Number(i.amountDiscount ?? 0),
          })),
        },
      },
      include: {
        user: { select: { id: true, fullname: true, branch: { select: { id: true, branchName: true } } } },
        items: { include: { priceItemPetShop: { include: { listOfItemPetShop: true } } } },
        clinicItems: { include: { priceItemPetShop: { include: { listOfItemPetShop: true } } } },
      },
    })

    // Deduct stock for each item
    for (const item of items) {
      const price = await app.prisma.priceItemPetShop.findFirst({
        where: { id: BigInt(item.priceItemPetShopId) },
        select: { listOfItemPetShopId: true },
      })
      if (price) {
        await app.prisma.listOfItemPetShop.update({
          where: { id: price.listOfItemPetShopId },
          data: { totalItem: { decrement: Number(item.totalItem) } },
        })
      }
    }

    return reply.status(201).send({ data: formatTransaction(trx), message: 'Transaksi berhasil dibuat' })
  })

  app.delete('/petshop/transaksi/:id', { preHandler: [authenticate, requireRole('admin')] }, async (req, reply) => {
    const user = (req as any).authUser
    const { id } = req.params as any

    const trx = await app.prisma.paymentPetshop.findFirst({ where: { id: BigInt(id), isDeleted: false, ...trxUserFilter(user) } })
    if (!trx) return reply.status(404).send({ message: 'Transaksi tidak ditemukan' })

    await app.prisma.paymentPetshop.update({
      where: { id: BigInt(id) },
      data: { isDeleted: true },
    })

    return reply.send({ message: 'Transaksi berhasil dibatalkan' })
  })

  // ─── STATS ───────────────────────────────────────────────────────────────────

  app.get('/petshop/stats', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as any).authUser

    const userFilter = trxUserFilter(user)

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

    const [todayTrx, monthTrx, lowStock, totalProducts] = await Promise.all([
      app.prisma.paymentPetshop.findMany({
        where: { isDeleted: false, createdAt: { gte: todayStart, lte: todayEnd }, ...userFilter },
        include: {
          items: { include: { priceItemPetShop: true } },
          clinicItems: { include: { priceItemPetShop: true } },
        },
      }),
      app.prisma.paymentPetshop.findMany({
        where: { isDeleted: false, createdAt: { gte: monthStart, lte: monthEnd }, ...userFilter },
        include: {
          items: { include: { priceItemPetShop: true } },
          clinicItems: { include: { priceItemPetShop: true } },
        },
      }),
      app.prisma.listOfItemPetShop.count({
        where: {
          isDeleted: false,
          ...branchFilter(user),
          AND: [{ limitItem: { not: null } }],
        },
      }),
      app.prisma.listOfItemPetShop.count({
        where: {
          isDeleted: false,
          ...branchFilter(user),
        },
      }),
    ])

    const calcRevenue = (trxList: any[]) =>
      trxList.reduce((sum, t) => {
        const itemTotal = [...t.items, ...t.clinicItems].reduce(
          (s: number, i: any) => s + Number(i.priceItemPetShop.sellingPrice) * Number(i.totalItem) - Number(i.amountDiscount),
          0
        )
        return sum + itemTotal - Number(t.discount)
      }, 0)

    return reply.send({
      data: {
        today: { revenue: calcRevenue(todayTrx), count: todayTrx.length },
        month: { revenue: calcRevenue(monthTrx), count: monthTrx.length },
        totalProducts,
        lowStock,
      },
    })
  })

  // ─── KATALOG (untuk kasir) ───────────────────────────────────────────────────
  // Daftar produk dengan harga terbaru, khusus untuk tampilan kasir

  app.get('/petshop/katalog', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as any).authUser
    const { branchId: qBranch, search } = req.query as any

    const bf = user.role === 'admin' && qBranch
      ? { branchId: BigInt(qBranch) }
      : user.role !== 'admin'
      ? { branchId: BigInt(user.branchId) }
      : {}

    const products = await app.prisma.listOfItemPetShop.findMany({
      where: {
        isDeleted: false,
        ...bf,
        ...(search ? { itemName: { contains: search, mode: 'insensitive' } } : {}),
        totalItem: { gt: 0 },
      },
      include: {
        priceItemPetShops: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { itemName: 'asc' },
    })

    // Only return products that have a price
    const withPrice = products.filter((p) => p.priceItemPetShops.length > 0)
    return reply.send({ data: withPrice.map(formatProduct) })
  })

  // ─── REFERENSI (kategori, satuan, metode bayar) ───────────────────────────────

  app.get('/petshop/ref', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as any).authUser
    const bf = user.role !== 'admin' ? { branchId: BigInt(user.branchId) } : {}

    const [categories, units, paymentMethods] = await Promise.all([
      app.prisma.categoryItem.findMany({ where: { isDeleted: false, ...bf }, orderBy: { categoryName: 'asc' } }),
      app.prisma.unitItem.findMany({ where: { isDeleted: false, ...bf }, orderBy: { unitName: 'asc' } }),
      app.prisma.paymentMethod.findMany({ where: { isDeleted: false }, orderBy: { methodName: 'asc' } }),
    ])

    return reply.send({
      data: {
        categories: categories.map((c) => ({ id: c.id.toString(), name: c.categoryName })),
        units: units.map((u) => ({ id: u.id.toString(), name: u.unitName })),
        paymentMethods: paymentMethods.map((m) => ({ id: m.id.toString(), name: m.methodName })),
      },
    })
  })
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatProduct(p: any) {
  const latestPrice = p.priceItemPetShops?.[0]
  return {
    id: p.id.toString(),
    itemName: p.itemName,
    totalItem: Number(p.totalItem),
    limitItem: p.limitItem ? Number(p.limitItem) : null,
    expiredDate: p.expiredDate,
    unitItemId: p.unitItemId?.toString(),
    categoryItemId: p.categoryItemId?.toString(),
    branchId: p.branchId?.toString(),
    branch: p.branch ? { ...p.branch, id: p.branch.id.toString() } : null,
    isLowStock: p.limitItem ? Number(p.totalItem) <= Number(p.limitItem) : false,
    currentPrice: latestPrice
      ? {
          id: latestPrice.id.toString(),
          sellingPrice: Number(latestPrice.sellingPrice),
          capitalPrice: Number(latestPrice.capitalPrice),
          petshopFee: Number(latestPrice.petshopFee),
        }
      : null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }
}

function formatPrice(p: any) {
  return {
    id: p.id.toString(),
    listOfItemPetShopId: p.listOfItemPetShopId.toString(),
    sellingPrice: Number(p.sellingPrice),
    capitalPrice: Number(p.capitalPrice),
    petshopFee: Number(p.petshopFee),
    createdAt: p.createdAt,
  }
}

function formatTransaction(t: any) {
  const allItems = [
    ...(t.items ?? []).map((i: any) => ({ ...i, itemType: 'retail' })),
    ...(t.clinicItems ?? []).map((i: any) => ({ ...i, itemType: 'clinic' })),
  ]

  const subtotal = allItems.reduce((s: number, i: any) => {
    return s + Number(i.priceItemPetShop.sellingPrice) * Number(i.totalItem) - Number(i.amountDiscount)
  }, 0)
  const total = subtotal - Number(t.discount)

  return {
    id: t.id.toString(),
    userId: t.userId?.toString(),
    paymentMethodId: t.paymentMethodId?.toString() ?? null,
    discount: Number(t.discount),
    subtotal,
    total,
    user: t.user ? { id: t.user.id.toString(), fullname: t.user.fullname, branch: t.user.branch
      ? { id: t.user.branch.id.toString(), branchName: t.user.branch.branchName } : null } : null,
    items: allItems.map((i: any) => ({
      id: i.id.toString(),
      itemType: i.itemType,
      priceItemPetShopId: i.priceItemPetShopId.toString(),
      totalItem: Number(i.totalItem),
      amountDiscount: Number(i.amountDiscount),
      sellingPrice: Number(i.priceItemPetShop.sellingPrice),
      lineTotal: Number(i.priceItemPetShop.sellingPrice) * Number(i.totalItem) - Number(i.amountDiscount),
      product: i.priceItemPetShop?.listOfItemPetShop
        ? { id: i.priceItemPetShop.listOfItemPetShop.id.toString(), itemName: i.priceItemPetShop.listOfItemPetShop.itemName }
        : null,
    })),
    createdAt: t.createdAt,
  }
}

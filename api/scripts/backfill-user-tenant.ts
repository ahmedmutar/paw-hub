// One-time repair: POST /user never set tenantId on newly-created staff before
// this fix, so any user added after a tenant's initial onboarding ended up with
// tenantId = null. That breaks tenant isolation (tenantFilter() no-ops for them)
// and plan-limit enforcement. This backfills tenantId from the user's branch.
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const orphaned = await prisma.user.findMany({
    where: { tenantId: null, isDeleted: false },
    select: { id: true, username: true, branchId: true },
  })

  if (orphaned.length === 0) {
    console.log('Tidak ada user dengan tenantId null. Tidak ada yang perlu diperbaiki.')
    return
  }

  console.log(`Ditemukan ${orphaned.length} user dengan tenantId null. Memperbaiki...`)

  let fixed = 0
  let skipped = 0
  for (const user of orphaned) {
    const branch = await prisma.branch.findUnique({ where: { id: user.branchId }, select: { tenantId: true } })
    if (!branch?.tenantId) {
      // Instalasi lama tanpa tenant sama sekali — biarkan null, bukan bug.
      skipped++
      continue
    }
    await prisma.user.update({ where: { id: user.id }, data: { tenantId: branch.tenantId } })
    console.log(`  ✅ ${user.username} -> tenantId ${branch.tenantId}`)
    fixed++
  }

  console.log(`Selesai. ${fixed} user diperbaiki, ${skipped} dilewati (branch tanpa tenant / instalasi lama).`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

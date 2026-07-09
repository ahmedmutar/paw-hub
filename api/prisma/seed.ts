import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Buat cabang utama
  const branch = await prisma.branch.upsert({
    where: { branchCode: 'PUSAT' },
    update: {},
    create: {
      branchCode: 'PUSAT',
      branchName: 'Paw Hub Clinic Pusat',
      address: 'Jl. Contoh No. 1, Jakarta',
      phoneNumber: '021-12345678',
    },
  })
  console.log('✅ Cabang:', branch.branchName)

  // Buat user admin
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      fullname: 'Administrator',
      password: await bcrypt.hash('admin123', 12),
      role: 'admin',
      status: true,
      branchId: branch.id,
      staffingNumber: 'BVC-U-PUSAT-0001',
      createdBy: 'system',
    },
  })
  console.log('✅ Admin user:', admin.username)

  // Buat user dokter
  const dokter = await prisma.user.upsert({
    where: { username: 'drg.budi' },
    update: {},
    create: {
      username: 'drg.budi',
      fullname: 'drg. Budi Santoso',
      password: await bcrypt.hash('dokter123', 12),
      role: 'dokter',
      status: true,
      branchId: branch.id,
      staffingNumber: 'BVC-U-PUSAT-0002',
      createdBy: 'admin',
    },
  })
  console.log('✅ Dokter:', dokter.fullname)

  // Buat metode pembayaran default
  const methods = ['Tunai', 'Transfer Bank', 'QRIS', 'Debit', 'Kredit']
  for (const m of methods) {
    await prisma.paymentMethod.upsert({
      where: { id: (await prisma.paymentMethod.findFirst({ where: { methodName: m } }))?.id ?? 0n },
      update: {},
      create: { methodName: m },
    })
  }
  console.log('✅ Metode pembayaran:', methods.join(', '))

  console.log('\n🎉 Seeding selesai!')
  console.log('   Admin login: admin / admin123')
  console.log('   Dokter login: drg.budi / dokter123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

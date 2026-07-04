import { execSync } from 'child_process'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const E2E_DB_URL = 'postgresql://ahmadmukhtar@localhost:5432/vetclinic_e2e'

export async function setup() {
  process.env.DATABASE_URL = E2E_DB_URL
  process.env.JWT_SECRET = 'e2e-test-secret-key-minimum-32-characters!!'
  process.env.JWT_EXPIRES_IN = '1h'
  process.env.JWT_REFRESH_EXPIRES_IN = '7d'
  process.env.NODE_ENV = 'test'

  // Sync schema to test database (db push handles schema drift without migrations)
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    env: { ...process.env, DATABASE_URL: E2E_DB_URL },
    stdio: 'ignore',
  })

  // Seed test data
  const prisma = new PrismaClient({ datasources: { db: { url: E2E_DB_URL } } })
  try {
    // Truncate all tables dynamically (except prisma migrations)
    await prisma.$executeRawUnsafe(`
      DO $$
      DECLARE r RECORD;
      BEGIN
        FOR r IN (
          SELECT tablename FROM pg_tables
          WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
        ) LOOP
          EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
        END LOOP;
      END $$;
    `)

    const branch = await prisma.branch.create({
      data: {
        branchCode: 'E2E',
        branchName: 'E2E Test Clinic',
        address: 'Jl. Test No. 1',
        phoneNumber: '021-00000001',
      },
    })

    const pw = await bcrypt.hash('e2epass123', 10)

    await prisma.user.createMany({
      data: [
        {
          username: 'e2e_admin',
          fullname: 'E2E Admin',
          password: pw,
          role: 'admin',
          status: true,
          branchId: branch.id,
          createdBy: 'system',
        },
        {
          username: 'e2e_dokter',
          fullname: 'dr. E2E Dokter',
          password: pw,
          role: 'dokter',
          status: true,
          branchId: branch.id,
          createdBy: 'system',
        },
        {
          username: 'e2e_kasir',
          fullname: 'E2E Kasir',
          password: pw,
          role: 'kasir',
          status: true,
          branchId: branch.id,
          createdBy: 'system',
        },
      ],
    })

    await prisma.paymentMethod.createMany({
      data: [
        { methodName: 'Tunai' },
        { methodName: 'Transfer Bank' },
        { methodName: 'QRIS' },
      ],
      skipDuplicates: true,
    })

    console.log('\n✅ E2E database seeded — branch:', branch.branchName)
  } finally {
    await prisma.$disconnect()
  }
}

export async function teardown() {
  // Leave test DB as-is for inspection; CI can drop it separately
}

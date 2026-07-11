import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const plans = [
    {
      code:         'free' as const,
      name:         'Free',
      priceMonthly: 0,
      priceYearly:  0,
      maxBranches:  1,
      maxUsers:     2,
      maxPatients:  60,
      features:     { whatsapp: false, booking: false, grooming: false, reminder: false, portal: false },
    },
    {
      code:         'starter' as const,
      name:         'Starter',
      priceMonthly: 299000,
      priceYearly:  2990000,
      maxBranches:  1,
      maxUsers:     10,
      maxPatients:  500,
      features:     { whatsapp: true, booking: true, grooming: true, reminder: true, portal: false },
    },
    {
      code:         'pro' as const,
      name:         'Pro',
      priceMonthly: 599000,
      priceYearly:  5990000,
      maxBranches:  5,
      maxUsers:     50,
      maxPatients:  5000,
      features:     { whatsapp: true, booking: true, grooming: true, reminder: true, portal: true },
    },
    {
      code:         'enterprise' as const,
      name:         'Enterprise',
      priceMonthly: 1499000,
      priceYearly:  14990000,
      maxBranches:  999,
      maxUsers:     999,
      maxPatients:  999999,
      features:     { whatsapp: true, booking: true, grooming: true, reminder: true, portal: true, priority_support: true },
    },
  ]

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where:  { code: plan.code },
      update: plan,
      create: plan,
    })
    console.log(`✅ Plan ${plan.name} upserted`)
  }

  console.log('Seed plans selesai.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

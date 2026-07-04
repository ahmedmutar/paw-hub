-- CreateEnum
CREATE TYPE "BillingInvoiceStatus" AS ENUM ('pending', 'paid', 'failed', 'expired', 'cancelled');

-- CreateTable
CREATE TABLE "billing_invoices" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "plan_id" BIGINT NOT NULL,
    "cycle" TEXT NOT NULL DEFAULT 'monthly',
    "order_id" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "status" "BillingInvoiceStatus" NOT NULL DEFAULT 'pending',
    "snap_token" TEXT,
    "payment_type" TEXT,
    "paid_at" TIMESTAMP(3),
    "raw_notification" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_invoices_order_id_key" ON "billing_invoices"("order_id");

-- AddForeignKey
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


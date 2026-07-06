-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('trial', 'active', 'suspended', 'cancelled');

-- CreateEnum
CREATE TYPE "PlanCode" AS ENUM ('free', 'starter', 'pro', 'enterprise');

-- CreateEnum
CREATE TYPE "BillingInvoiceStatus" AS ENUM ('pending', 'paid', 'failed', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "WaLogStatus" AS ENUM ('pending', 'sent', 'failed');

-- CreateEnum
CREATE TYPE "WaNotifType" AS ENUM ('queue_confirmation', 'queue_called', 'vaccination_reminder', 'deworming_reminder', 'payment_receipt', 'inpatient_update', 'custom');

-- CreateEnum
CREATE TYPE "StaffNotificationType" AS ENUM ('low_stock', 'new_booking', 'queue_new');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('pending', 'confirmed', 'declined', 'rescheduled', 'converted', 'cancelled');

-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('vaccination', 'deworming');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('pending', 'sent', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "GroomingStatus" AS ENUM ('waiting', 'in_progress', 'done', 'cancelled');

-- CreateEnum
CREATE TYPE "BroadcastStatus" AS ENUM ('draft', 'sending', 'done', 'failed');

-- CreateEnum
CREATE TYPE "LoyaltyTxType" AS ENUM ('earn', 'redeem', 'bonus', 'adjust');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('pending', 'approved', 'declined');

-- CreateEnum
CREATE TYPE "HotelRoomType" AS ENUM ('vip', 'reguler', 'isolasi');

-- CreateEnum
CREATE TYPE "HotelBookingStatus" AS ENUM ('pending', 'checkedin', 'checkedout', 'cancelled');

-- CreateEnum
CREATE TYPE "TelemedStatus" AS ENUM ('pending', 'confirmed', 'ongoing', 'done', 'cancelled');

-- CreateEnum
CREATE TYPE "LabStatus" AS ENUM ('pending', 'processing', 'ready');

-- CreateEnum
CREATE TYPE "UrgencyLevel" AS ENUM ('segera', 'dalam_24_jam', 'bisa_tunggu', 'tidak_perlu');

-- AlterEnum
ALTER TYPE "AcceptanceStatus" ADD VALUE 'cancelled';

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'superadmin';

-- AlterTable
ALTER TABLE "branches" ADD COLUMN     "tenant_id" BIGINT;

-- AlterTable
ALTER TABLE "check_up_results" ADD COLUMN     "heart_rate" INTEGER,
ADD COLUMN     "home_instructions" TEXT,
ADD COLUMN     "prognosis" TEXT,
ADD COLUMN     "respiratory_rate" INTEGER,
ADD COLUMN     "temperature" DECIMAL(5,2),
ADD COLUMN     "weight_kg" DECIMAL(6,2);

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'Lain-lain',
ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "list_of_items" ADD COLUMN     "barcode_id" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "list_of_services" ADD COLUMN     "description" TEXT,
ADD COLUMN     "duration_minutes" INTEGER,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "payrolls" ADD COLUMN     "pph21_amount" DECIMAL(15,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "registrations" ADD COLUMN     "cancel_reason" TEXT,
ADD COLUMN     "is_priority" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "queue_number" INTEGER,
ADD COLUMN     "visit_type" TEXT NOT NULL DEFAULT 'baru';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "npwp" TEXT,
ADD COLUMN     "ptkp_status" TEXT NOT NULL DEFAULT 'TK0',
ADD COLUMN     "tenant_id" BIGINT;

-- CreateTable
CREATE TABLE "tenants" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone_number" TEXT,
    "address" TEXT,
    "logo_url" TEXT,
    "status" "TenantStatus" NOT NULL DEFAULT 'trial',
    "trial_ends_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" BIGSERIAL NOT NULL,
    "code" "PlanCode" NOT NULL,
    "name" TEXT NOT NULL,
    "price_monthly" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "price_yearly" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "max_branches" INTEGER NOT NULL DEFAULT 1,
    "max_users" INTEGER NOT NULL DEFAULT 5,
    "max_patients" INTEGER NOT NULL DEFAULT 500,
    "features" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "tenant_subscriptions" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "plan_id" BIGINT NOT NULL,
    "cycle" TEXT NOT NULL DEFAULT 'monthly',
    "status" TEXT NOT NULL DEFAULT 'trial',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_logs" (
    "id" BIGSERIAL NOT NULL,
    "recipient_phone" TEXT NOT NULL,
    "recipient_name" TEXT,
    "type" "WaNotifType" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "WaLogStatus" NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "sent_at" TIMESTAMP(3),
    "patient_id" BIGINT,
    "registration_id" BIGINT,
    "branch_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_notifications" (
    "id" BIGSERIAL NOT NULL,
    "branch_id" BIGINT NOT NULL,
    "type" "StaffNotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" BIGSERIAL NOT NULL,
    "owner_name" TEXT NOT NULL,
    "owner_phone" TEXT NOT NULL,
    "pet_name" TEXT NOT NULL,
    "pet_category" TEXT,
    "patient_id" BIGINT,
    "doctor_user_id" BIGINT NOT NULL,
    "branch_id" BIGINT NOT NULL,
    "appointment_date" DATE NOT NULL,
    "appointment_time" TEXT NOT NULL,
    "complaint" TEXT NOT NULL,
    "notes" TEXT,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'pending',
    "decline_reason" TEXT,
    "registration_id" BIGINT,
    "handled_by" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_logs" (
    "id" BIGSERIAL NOT NULL,
    "type" "ReminderType" NOT NULL,
    "patient_id" BIGINT NOT NULL,
    "record_id" BIGINT NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'pending',
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "sent_at" TIMESTAMP(3),
    "error_msg" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_otps" (
    "id" BIGSERIAL NOT NULL,
    "owner_id" BIGINT NOT NULL,
    "otp" VARCHAR(6) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "owner_otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grooming_packages" (
    "id" BIGSERIAL NOT NULL,
    "package_name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(15,2) NOT NULL,
    "duration_min" INTEGER NOT NULL DEFAULT 60,
    "branch_id" BIGINT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grooming_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grooming_sessions" (
    "id" BIGSERIAL NOT NULL,
    "queue_number" INTEGER NOT NULL,
    "patient_id" BIGINT NOT NULL,
    "groomer_id" BIGINT NOT NULL,
    "package_id" BIGINT NOT NULL,
    "branch_id" BIGINT NOT NULL,
    "status" "GroomingStatus" NOT NULL DEFAULT 'waiting',
    "scheduled_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,
    "total_price" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "user_id" BIGINT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grooming_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT,
    "user_id" BIGINT,
    "username" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resource_id" TEXT,
    "details" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcast_logs" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT,
    "branch_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "segment" JSONB,
    "status" "BroadcastStatus" NOT NULL DEFAULT 'draft',
    "total_target" INTEGER NOT NULL DEFAULT 0,
    "total_sent" INTEGER NOT NULL DEFAULT 0,
    "total_failed" INTEGER NOT NULL DEFAULT 0,
    "scheduled_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "broadcast_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcast_recipients" (
    "id" BIGSERIAL NOT NULL,
    "broadcast_id" BIGINT NOT NULL,
    "owner_id" BIGINT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sent_at" TIMESTAMP(3),
    "error_msg" TEXT,

    CONSTRAINT "broadcast_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_configs" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT,
    "branch_id" BIGINT NOT NULL,
    "points_per_rupiah" DECIMAL(10,6) NOT NULL DEFAULT 0.001,
    "silver_threshold" INTEGER NOT NULL DEFAULT 500,
    "gold_threshold" INTEGER NOT NULL DEFAULT 2000,
    "redeem_rate" DECIMAL(10,2) NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_points" (
    "id" BIGSERIAL NOT NULL,
    "owner_id" BIGINT NOT NULL,
    "branch_id" BIGINT NOT NULL,
    "tenant_id" BIGINT,
    "tx_type" "LoyaltyTxType" NOT NULL,
    "points" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "description" TEXT,
    "ref_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_members" (
    "id" BIGSERIAL NOT NULL,
    "owner_id" BIGINT NOT NULL,
    "branch_id" BIGINT NOT NULL,
    "tenant_id" BIGINT,
    "total_points" INTEGER NOT NULL DEFAULT 0,
    "tier" TEXT NOT NULL DEFAULT 'basic',
    "total_spend" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_records" (
    "id" BIGSERIAL NOT NULL,
    "registration_id" BIGINT NOT NULL,
    "patient_id" BIGINT NOT NULL,
    "doctor_id" BIGINT NOT NULL,
    "branch_id" BIGINT NOT NULL,
    "tenant_id" BIGINT,
    "rating" INTEGER,
    "comment" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "survey_token" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3),
    "replied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_schedules" (
    "id" BIGSERIAL NOT NULL,
    "doctor_id" BIGINT NOT NULL,
    "branch_id" BIGINT NOT NULL,
    "tenant_id" BIGINT,
    "day_of_week" INTEGER NOT NULL,
    "shift_start" TEXT NOT NULL,
    "shift_end" TEXT NOT NULL,
    "max_patients" INTEGER NOT NULL DEFAULT 20,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_leaves" (
    "id" BIGSERIAL NOT NULL,
    "doctor_id" BIGINT NOT NULL,
    "branch_id" BIGINT NOT NULL,
    "tenant_id" BIGINT,
    "leave_date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'pending',
    "approved_by" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_leaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_rooms" (
    "id" BIGSERIAL NOT NULL,
    "branch_id" BIGINT NOT NULL,
    "tenant_id" BIGINT,
    "room_name" TEXT NOT NULL,
    "room_type" "HotelRoomType" NOT NULL DEFAULT 'reguler',
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "price_per_night" DECIMAL(15,2) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotel_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_bookings" (
    "id" BIGSERIAL NOT NULL,
    "room_id" BIGINT NOT NULL,
    "patient_id" BIGINT NOT NULL,
    "owner_id" BIGINT NOT NULL,
    "branch_id" BIGINT NOT NULL,
    "tenant_id" BIGINT,
    "check_in" TIMESTAMP(3) NOT NULL,
    "check_out" TIMESTAMP(3) NOT NULL,
    "total_nights" INTEGER NOT NULL DEFAULT 1,
    "total_price" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "special_needs" TEXT,
    "status" "HotelBookingStatus" NOT NULL DEFAULT 'pending',
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotel_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_care_logs" (
    "id" BIGSERIAL NOT NULL,
    "booking_id" BIGINT NOT NULL,
    "staff_id" BIGINT NOT NULL,
    "log_date" TIMESTAMP(3) NOT NULL,
    "meal_note" TEXT,
    "drink_note" TEXT,
    "activity_note" TEXT,
    "condition_note" TEXT,
    "photo_url" TEXT,
    "sent_to_owner" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hotel_care_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telemed_sessions" (
    "id" BIGSERIAL NOT NULL,
    "patient_id" BIGINT NOT NULL,
    "doctor_id" BIGINT NOT NULL,
    "owner_id" BIGINT NOT NULL,
    "branch_id" BIGINT NOT NULL,
    "tenant_id" BIGINT,
    "status" "TelemedStatus" NOT NULL DEFAULT 'pending',
    "channel" TEXT NOT NULL DEFAULT 'chat',
    "scheduled_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "complaint" TEXT,
    "doctor_notes" TEXT,
    "e_prescription" TEXT,
    "fee" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "rating" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telemed_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_requests" (
    "id" BIGSERIAL NOT NULL,
    "branch_id" BIGINT NOT NULL,
    "tenant_id" BIGINT,
    "patient_id" BIGINT NOT NULL,
    "requested_by_id" BIGINT NOT NULL,
    "test_type" TEXT NOT NULL,
    "notes" TEXT,
    "status" "LabStatus" NOT NULL DEFAULT 'pending',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_results" (
    "id" BIGSERIAL NOT NULL,
    "request_id" BIGINT NOT NULL,
    "template_type" TEXT,
    "result_data" JSONB,
    "result_file" TEXT,
    "interpretation" TEXT,
    "is_ready" BOOLEAN NOT NULL DEFAULT false,
    "ready_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_symptom_logs" (
    "id" BIGSERIAL NOT NULL,
    "branch_id" BIGINT,
    "tenant_id" BIGINT,
    "pet_name" TEXT,
    "species" TEXT,
    "age" INTEGER,
    "input_symptoms" TEXT NOT NULL,
    "ai_response" TEXT NOT NULL,
    "urgency_level" "UrgencyLevel" NOT NULL,
    "booking_created" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_symptom_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drug_database" (
    "id" BIGSERIAL NOT NULL,
    "drug_name" TEXT NOT NULL,
    "generic_name" TEXT,
    "category" TEXT NOT NULL DEFAULT 'umum',
    "species" TEXT NOT NULL DEFAULT 'all',
    "dosage_per_kg_min" DECIMAL(10,4),
    "dosage_per_kg_max" DECIMAL(10,4),
    "unit" TEXT NOT NULL DEFAULT 'mg',
    "frequency" TEXT,
    "contraindications" TEXT,
    "side_effects" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drug_database_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drug_interactions" (
    "id" BIGSERIAL NOT NULL,
    "drug_a_id" BIGINT NOT NULL,
    "drug_b_id" BIGINT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drug_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_calendar_syncs" (
    "id" BIGSERIAL NOT NULL,
    "doctor_id" BIGINT NOT NULL,
    "google_access_token" TEXT,
    "google_refresh_token" TEXT,
    "google_email" TEXT,
    "sync_enabled" BOOLEAN NOT NULL DEFAULT false,
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_calendar_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_integrations" (
    "id" BIGSERIAL NOT NULL,
    "branch_id" BIGINT NOT NULL,
    "tenant_id" BIGINT,
    "platform" TEXT NOT NULL,
    "shop_id" TEXT,
    "shop_name" TEXT,
    "access_token" TEXT,
    "sync_enabled" BOOLEAN NOT NULL DEFAULT false,
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_orders" (
    "id" BIGSERIAL NOT NULL,
    "integration_id" BIGINT NOT NULL,
    "order_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "total_amount" DECIMAL(15,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "order_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_email_key" ON "tenants"("email");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_code_key" ON "subscription_plans"("code");

-- CreateIndex
CREATE UNIQUE INDEX "billing_invoices_order_id_key" ON "billing_invoices"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_subscriptions_tenant_id_key" ON "tenant_subscriptions"("tenant_id");

-- CreateIndex
CREATE INDEX "staff_notifications_branch_id_is_read_idx" ON "staff_notifications"("branch_id", "is_read");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_registration_id_key" ON "appointments"("registration_id");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_logs_type_record_id_key" ON "reminder_logs"("type", "record_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_idx" ON "audit_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_resource_action_idx" ON "audit_logs"("resource", "action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "broadcast_logs_tenant_id_idx" ON "broadcast_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "broadcast_logs_branch_id_idx" ON "broadcast_logs"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_configs_branch_id_key" ON "loyalty_configs"("branch_id");

-- CreateIndex
CREATE INDEX "loyalty_points_owner_id_idx" ON "loyalty_points"("owner_id");

-- CreateIndex
CREATE INDEX "loyalty_points_branch_id_idx" ON "loyalty_points"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_members_owner_id_branch_id_key" ON "loyalty_members"("owner_id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_records_registration_id_key" ON "review_records"("registration_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_records_survey_token_key" ON "review_records"("survey_token");

-- CreateIndex
CREATE INDEX "review_records_branch_id_idx" ON "review_records"("branch_id");

-- CreateIndex
CREATE INDEX "review_records_doctor_id_idx" ON "review_records"("doctor_id");

-- CreateIndex
CREATE INDEX "review_records_rating_idx" ON "review_records"("rating");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_schedules_doctor_id_branch_id_day_of_week_key" ON "doctor_schedules"("doctor_id", "branch_id", "day_of_week");

-- CreateIndex
CREATE INDEX "doctor_leaves_doctor_id_idx" ON "doctor_leaves"("doctor_id");

-- CreateIndex
CREATE INDEX "doctor_leaves_leave_date_idx" ON "doctor_leaves"("leave_date");

-- CreateIndex
CREATE INDEX "hotel_rooms_branch_id_idx" ON "hotel_rooms"("branch_id");

-- CreateIndex
CREATE INDEX "hotel_bookings_branch_id_idx" ON "hotel_bookings"("branch_id");

-- CreateIndex
CREATE INDEX "hotel_bookings_check_in_check_out_idx" ON "hotel_bookings"("check_in", "check_out");

-- CreateIndex
CREATE INDEX "hotel_care_logs_booking_id_idx" ON "hotel_care_logs"("booking_id");

-- CreateIndex
CREATE INDEX "telemed_sessions_branch_id_idx" ON "telemed_sessions"("branch_id");

-- CreateIndex
CREATE INDEX "telemed_sessions_doctor_id_idx" ON "telemed_sessions"("doctor_id");

-- CreateIndex
CREATE INDEX "lab_requests_patient_id_idx" ON "lab_requests"("patient_id");

-- CreateIndex
CREATE INDEX "lab_requests_branch_id_idx" ON "lab_requests"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "lab_results_request_id_key" ON "lab_results"("request_id");

-- CreateIndex
CREATE INDEX "ai_symptom_logs_branch_id_idx" ON "ai_symptom_logs"("branch_id");

-- CreateIndex
CREATE INDEX "ai_symptom_logs_urgency_level_idx" ON "ai_symptom_logs"("urgency_level");

-- CreateIndex
CREATE UNIQUE INDEX "drug_database_drug_name_key" ON "drug_database"("drug_name");

-- CreateIndex
CREATE UNIQUE INDEX "drug_interactions_drug_a_id_drug_b_id_key" ON "drug_interactions"("drug_a_id", "drug_b_id");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_calendar_syncs_doctor_id_key" ON "doctor_calendar_syncs"("doctor_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_integrations_branch_id_platform_key" ON "marketplace_integrations"("branch_id", "platform");

-- CreateIndex
CREATE INDEX "marketplace_orders_integration_id_idx" ON "marketplace_orders"("integration_id");

-- CreateIndex
CREATE UNIQUE INDEX "list_of_items_barcode_id_key" ON "list_of_items"("barcode_id");

-- AddForeignKey
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_logs" ADD CONSTRAINT "whatsapp_logs_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_logs" ADD CONSTRAINT "whatsapp_logs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_notifications" ADD CONSTRAINT "staff_notifications_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_user_id_fkey" FOREIGN KEY ("doctor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_logs" ADD CONSTRAINT "reminder_logs_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_otps" ADD CONSTRAINT "owner_otps_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grooming_packages" ADD CONSTRAINT "grooming_packages_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grooming_sessions" ADD CONSTRAINT "grooming_sessions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grooming_sessions" ADD CONSTRAINT "grooming_sessions_groomer_id_fkey" FOREIGN KEY ("groomer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grooming_sessions" ADD CONSTRAINT "grooming_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grooming_sessions" ADD CONSTRAINT "grooming_sessions_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "grooming_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grooming_sessions" ADD CONSTRAINT "grooming_sessions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_logs" ADD CONSTRAINT "broadcast_logs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_logs" ADD CONSTRAINT "broadcast_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "broadcast_logs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_configs" ADD CONSTRAINT "loyalty_configs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_points" ADD CONSTRAINT "loyalty_points_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_points" ADD CONSTRAINT "loyalty_points_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_members" ADD CONSTRAINT "loyalty_members_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_members" ADD CONSTRAINT "loyalty_members_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_records" ADD CONSTRAINT "review_records_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_records" ADD CONSTRAINT "review_records_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_records" ADD CONSTRAINT "review_records_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_records" ADD CONSTRAINT "review_records_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_schedules" ADD CONSTRAINT "doctor_schedules_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_schedules" ADD CONSTRAINT "doctor_schedules_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_leaves" ADD CONSTRAINT "doctor_leaves_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_leaves" ADD CONSTRAINT "doctor_leaves_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_leaves" ADD CONSTRAINT "doctor_leaves_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_rooms" ADD CONSTRAINT "hotel_rooms_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_bookings" ADD CONSTRAINT "hotel_bookings_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "hotel_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_bookings" ADD CONSTRAINT "hotel_bookings_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_bookings" ADD CONSTRAINT "hotel_bookings_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_bookings" ADD CONSTRAINT "hotel_bookings_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_care_logs" ADD CONSTRAINT "hotel_care_logs_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "hotel_bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_care_logs" ADD CONSTRAINT "hotel_care_logs_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telemed_sessions" ADD CONSTRAINT "telemed_sessions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telemed_sessions" ADD CONSTRAINT "telemed_sessions_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telemed_sessions" ADD CONSTRAINT "telemed_sessions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telemed_sessions" ADD CONSTRAINT "telemed_sessions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_requests" ADD CONSTRAINT "lab_requests_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_requests" ADD CONSTRAINT "lab_requests_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_requests" ADD CONSTRAINT "lab_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "lab_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drug_interactions" ADD CONSTRAINT "drug_interactions_drug_a_id_fkey" FOREIGN KEY ("drug_a_id") REFERENCES "drug_database"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drug_interactions" ADD CONSTRAINT "drug_interactions_drug_b_id_fkey" FOREIGN KEY ("drug_b_id") REFERENCES "drug_database"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_calendar_syncs" ADD CONSTRAINT "doctor_calendar_syncs_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_integrations" ADD CONSTRAINT "marketplace_integrations_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "marketplace_integrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


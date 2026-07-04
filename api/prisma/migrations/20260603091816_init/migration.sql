-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'dokter', 'resepsionis', 'kasir', 'karyawan');

-- CreateEnum
CREATE TYPE "AcceptanceStatus" AS ENUM ('pending', 'accepted', 'declined');

-- CreateEnum
CREATE TYPE "StockMovementStatus" AS ENUM ('masuk', 'keluar', 'adjustment');

-- CreateTable
CREATE TABLE "branches" (
    "id" BIGSERIAL NOT NULL,
    "branch_code" TEXT NOT NULL,
    "branch_name" TEXT NOT NULL,
    "address" TEXT,
    "phone_number" TEXT,
    "payment_instruction" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "staffing_number" TEXT,
    "username" TEXT NOT NULL,
    "fullname" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT NOT NULL,
    "gender" TEXT,
    "religion" TEXT,
    "birth_place" TEXT,
    "birthdate" TIMESTAMP(3),
    "blood_group" TEXT,
    "id_card_number" TEXT,
    "phone_number" TEXT,
    "home_number" TEXT,
    "address" TEXT,
    "image_profile" TEXT,
    "role" "UserRole" NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "branch_id" BIGINT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owners" (
    "id" BIGSERIAL NOT NULL,
    "owner_name" TEXT NOT NULL,
    "address" TEXT,
    "phone_number" TEXT,
    "branch_id" BIGINT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" BIGSERIAL NOT NULL,
    "id_member" TEXT NOT NULL,
    "pet_category" TEXT NOT NULL,
    "pet_name" TEXT NOT NULL,
    "pet_gender" TEXT,
    "pet_year_age" INTEGER,
    "pet_month_age" INTEGER,
    "owner_id" BIGINT NOT NULL,
    "branch_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registrations" (
    "id" BIGSERIAL NOT NULL,
    "id_number" TEXT NOT NULL,
    "patient_id" BIGINT NOT NULL,
    "doctor_user_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "branch_id" BIGINT NOT NULL,
    "complaint" TEXT NOT NULL,
    "registrant" TEXT NOT NULL,
    "acceptance_status" "AcceptanceStatus" NOT NULL DEFAULT 'pending',
    "is_hide_from_drop_down" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_acceptances" (
    "id" BIGSERIAL NOT NULL,
    "registration_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "in_patients" (
    "id" BIGSERIAL NOT NULL,
    "id_number" TEXT NOT NULL,
    "patient_id" BIGINT NOT NULL,
    "doctor_user_id" BIGINT NOT NULL,
    "branch_id" BIGINT NOT NULL,
    "complaint" TEXT NOT NULL,
    "registrant" TEXT NOT NULL,
    "estimate_day" INTEGER,
    "reality_day" INTEGER,
    "acceptance_status" "AcceptanceStatus" NOT NULL DEFAULT 'pending',
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "user_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "in_patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_items" (
    "id" BIGSERIAL NOT NULL,
    "category_name" TEXT NOT NULL,
    "branch_id" BIGINT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_items" (
    "id" BIGSERIAL NOT NULL,
    "unit_name" TEXT NOT NULL,
    "branch_id" BIGINT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "list_of_items" (
    "id" BIGSERIAL NOT NULL,
    "item_name" TEXT NOT NULL,
    "total_item" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "limit_item" DECIMAL(10,2),
    "expired_date" TIMESTAMP(3),
    "unit_item_id" BIGINT NOT NULL,
    "category_item_id" BIGINT NOT NULL,
    "branch_id" BIGINT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "list_of_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_items" (
    "id" BIGSERIAL NOT NULL,
    "list_of_items_id" BIGINT NOT NULL,
    "selling_price" DECIMAL(15,2) NOT NULL,
    "capital_price" DECIMAL(15,2) NOT NULL,
    "doctor_fee" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "petshop_fee" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" BIGSERIAL NOT NULL,
    "list_of_item_id" BIGINT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "status" "StockMovementStatus" NOT NULL,
    "notes" TEXT,
    "user_id" BIGINT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "list_of_item_pet_shops" (
    "id" BIGSERIAL NOT NULL,
    "item_name" TEXT NOT NULL,
    "total_item" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "limit_item" DECIMAL(10,2),
    "expired_date" TIMESTAMP(3),
    "unit_item_id" BIGINT NOT NULL,
    "category_item_id" BIGINT NOT NULL,
    "branch_id" BIGINT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "list_of_item_pet_shops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_item_pet_shops" (
    "id" BIGSERIAL NOT NULL,
    "list_of_item_pet_shop_id" BIGINT NOT NULL,
    "selling_price" DECIMAL(15,2) NOT NULL,
    "capital_price" DECIMAL(15,2) NOT NULL,
    "petshop_fee" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_item_pet_shops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_categories" (
    "id" BIGSERIAL NOT NULL,
    "category_name" TEXT NOT NULL,
    "branch_id" BIGINT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "list_of_services" (
    "id" BIGSERIAL NOT NULL,
    "service_name" TEXT NOT NULL,
    "service_category_id" BIGINT NOT NULL,
    "branch_id" BIGINT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "list_of_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_services" (
    "id" BIGSERIAL NOT NULL,
    "list_of_service_id" BIGINT NOT NULL,
    "selling_price" DECIMAL(15,2) NOT NULL,
    "capital_price" DECIMAL(15,2) NOT NULL,
    "doctor_fee" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "petshop_fee" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicine_groups" (
    "id" BIGSERIAL NOT NULL,
    "group_name" TEXT NOT NULL,
    "description" TEXT,
    "branch_id" BIGINT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medicine_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_medicine_groups" (
    "id" BIGSERIAL NOT NULL,
    "medicine_group_id" BIGINT NOT NULL,
    "selling_price" DECIMAL(15,2) NOT NULL,
    "capital_price" DECIMAL(15,2) NOT NULL,
    "doctor_fee" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "petshop_fee" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_medicine_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_up_results" (
    "id" BIGSERIAL NOT NULL,
    "patient_registration_id" BIGINT NOT NULL,
    "anamnesa" TEXT,
    "sign" TEXT,
    "diagnosa" TEXT,
    "status_outpatient_inpatient" INTEGER NOT NULL DEFAULT 0,
    "status_finish" BOOLEAN NOT NULL DEFAULT false,
    "status_paid_off" BOOLEAN NOT NULL DEFAULT false,
    "user_id" BIGINT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "check_up_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_up_images" (
    "id" BIGSERIAL NOT NULL,
    "check_up_result_id" BIGINT NOT NULL,
    "image_path" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "check_up_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detail_item_patients" (
    "id" BIGSERIAL NOT NULL,
    "check_up_result_id" BIGINT NOT NULL,
    "price_item_id" BIGINT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "price_overall" DECIMAL(15,2) NOT NULL,
    "detail_medicine_group_id" BIGINT,
    "status_paid_off" BOOLEAN NOT NULL DEFAULT false,
    "user_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "detail_item_patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detail_service_patients" (
    "id" BIGSERIAL NOT NULL,
    "check_up_result_id" BIGINT NOT NULL,
    "price_service_id" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price_overall" DECIMAL(15,2) NOT NULL,
    "status_paid_off" BOOLEAN NOT NULL DEFAULT false,
    "user_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "detail_service_patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detail_medicine_group_results" (
    "id" BIGSERIAL NOT NULL,
    "check_up_result_id" BIGINT NOT NULL,
    "medicine_group_id" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "remark" TEXT,
    "status_paid_off" BOOLEAN NOT NULL DEFAULT false,
    "user_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "detail_medicine_group_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" BIGSERIAL NOT NULL,
    "method_name" TEXT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "list_of_payments" (
    "id" BIGSERIAL NOT NULL,
    "check_up_result_id" BIGINT NOT NULL,
    "payment_method_id" BIGINT,
    "discount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "user_id" BIGINT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "list_of_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "list_of_payment_items" (
    "id" BIGSERIAL NOT NULL,
    "list_of_payment_id" BIGINT NOT NULL,
    "check_up_result_id" BIGINT NOT NULL,
    "detail_item_patient_id" BIGINT NOT NULL,
    "detail_medicine_group_check_up_result_id" BIGINT,
    "quantity" DECIMAL(10,2) NOT NULL,
    "amount_discount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "list_of_payment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "list_of_payment_services" (
    "id" BIGSERIAL NOT NULL,
    "list_of_payment_id" BIGINT NOT NULL,
    "check_up_result_id" BIGINT NOT NULL,
    "detail_service_patient_id" BIGINT NOT NULL,
    "amount_discount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "list_of_payment_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "list_of_payment_medicine_groups" (
    "id" BIGSERIAL NOT NULL,
    "list_of_payment_id" BIGINT NOT NULL,
    "medicine_group_id" BIGINT NOT NULL,
    "detail_medicine_group_result_id" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "amount_discount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "list_of_payment_medicine_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_payment_petshops" (
    "id" BIGSERIAL NOT NULL,
    "branch_id" BIGINT NOT NULL,
    "price_item_pet_shop_id" BIGINT NOT NULL,
    "payment_method_id" BIGINT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_payment_petshops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_petshops" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "payment_method_id" BIGINT,
    "discount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_petshops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_petshop_items" (
    "id" BIGSERIAL NOT NULL,
    "payment_petshop_id" BIGINT NOT NULL,
    "price_item_pet_shop_id" BIGINT NOT NULL,
    "total_item" DECIMAL(10,2) NOT NULL,
    "amount_discount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_petshop_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_clinic_petshop_items" (
    "id" BIGSERIAL NOT NULL,
    "payment_petshop_id" BIGINT NOT NULL,
    "price_item_pet_shop_id" BIGINT NOT NULL,
    "total_item" DECIMAL(10,2) NOT NULL,
    "amount_discount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_clinic_petshop_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payrolls" (
    "id" BIGSERIAL NOT NULL,
    "user_employee_id" BIGINT NOT NULL,
    "branch_id" BIGINT NOT NULL,
    "date_payed" TIMESTAMP(3) NOT NULL,
    "period_month" INTEGER NOT NULL,
    "period_year" INTEGER NOT NULL,
    "basic_sallary" DECIMAL(15,2) NOT NULL,
    "accomodation" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "percentage_turnover" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "amount_turnover" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_turnover" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "minus_turnover" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "amount_inpatient" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "count_inpatient" INTEGER NOT NULL DEFAULT 0,
    "total_inpatient" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "percentage_surgery" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "amount_surgery" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_surgery" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "amount_grooming" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "count_grooming" INTEGER NOT NULL DEFAULT 0,
    "total_grooming" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_overall" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "user_id" BIGINT NOT NULL,
    "user_update_id" BIGINT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payrolls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" BIGSERIAL NOT NULL,
    "date_spend" TIMESTAMP(3) NOT NULL,
    "user_id_spender" BIGINT NOT NULL,
    "branch_id" BIGINT NOT NULL,
    "item_name" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "amount_overall" DECIMAL(15,2) NOT NULL,
    "user_id" BIGINT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_records" (
    "id" BIGSERIAL NOT NULL,
    "patient_id" BIGINT NOT NULL,
    "blood_type" TEXT,
    "allergies" TEXT,
    "chronic_conditions" TEXT,
    "special_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weight_records" (
    "id" BIGSERIAL NOT NULL,
    "patient_id" BIGINT NOT NULL,
    "check_up_result_id" BIGINT NOT NULL,
    "weight_kg" DECIMAL(6,2) NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "user_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weight_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vaccination_records" (
    "id" BIGSERIAL NOT NULL,
    "patient_id" BIGINT NOT NULL,
    "check_up_result_id" BIGINT,
    "vaccine_name" TEXT NOT NULL,
    "batch_number" TEXT,
    "administered_at" TIMESTAMP(3) NOT NULL,
    "next_due_at" TIMESTAMP(3),
    "notes" TEXT,
    "user_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vaccination_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deworming_records" (
    "id" BIGSERIAL NOT NULL,
    "patient_id" BIGINT NOT NULL,
    "check_up_result_id" BIGINT,
    "medication_name" TEXT NOT NULL,
    "administered_at" TIMESTAMP(3) NOT NULL,
    "next_due_at" TIMESTAMP(3),
    "notes" TEXT,
    "user_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deworming_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "major_procedure_records" (
    "id" BIGSERIAL NOT NULL,
    "patient_id" BIGINT NOT NULL,
    "check_up_result_id" BIGINT,
    "procedure_name" TEXT NOT NULL,
    "performed_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "user_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "major_procedure_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "branches_branch_code_key" ON "branches"("branch_code");

-- CreateIndex
CREATE UNIQUE INDEX "users_staffing_number_key" ON "users"("staffing_number");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "patients_id_member_key" ON "patients"("id_member");

-- CreateIndex
CREATE UNIQUE INDEX "registrations_id_number_key" ON "registrations"("id_number");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_acceptances_registration_id_key" ON "doctor_acceptances"("registration_id");

-- CreateIndex
CREATE UNIQUE INDEX "in_patients_id_number_key" ON "in_patients"("id_number");

-- CreateIndex
CREATE UNIQUE INDEX "check_up_results_patient_registration_id_key" ON "check_up_results"("patient_registration_id");

-- CreateIndex
CREATE UNIQUE INDEX "payrolls_user_employee_id_period_month_period_year_key" ON "payrolls"("user_employee_id", "period_month", "period_year");

-- CreateIndex
CREATE UNIQUE INDEX "medical_records_patient_id_key" ON "medical_records"("patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "weight_records_check_up_result_id_key" ON "weight_records"("check_up_result_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owners" ADD CONSTRAINT "owners_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_doctor_user_id_fkey" FOREIGN KEY ("doctor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_acceptances" ADD CONSTRAINT "doctor_acceptances_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_acceptances" ADD CONSTRAINT "doctor_acceptances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "in_patients" ADD CONSTRAINT "in_patients_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "in_patients" ADD CONSTRAINT "in_patients_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_items" ADD CONSTRAINT "category_items_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_items" ADD CONSTRAINT "unit_items_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_of_items" ADD CONSTRAINT "list_of_items_unit_item_id_fkey" FOREIGN KEY ("unit_item_id") REFERENCES "unit_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_of_items" ADD CONSTRAINT "list_of_items_category_item_id_fkey" FOREIGN KEY ("category_item_id") REFERENCES "category_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_of_items" ADD CONSTRAINT "list_of_items_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_items" ADD CONSTRAINT "price_items_list_of_items_id_fkey" FOREIGN KEY ("list_of_items_id") REFERENCES "list_of_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_list_of_item_id_fkey" FOREIGN KEY ("list_of_item_id") REFERENCES "list_of_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_of_item_pet_shops" ADD CONSTRAINT "list_of_item_pet_shops_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_item_pet_shops" ADD CONSTRAINT "price_item_pet_shops_list_of_item_pet_shop_id_fkey" FOREIGN KEY ("list_of_item_pet_shop_id") REFERENCES "list_of_item_pet_shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_of_services" ADD CONSTRAINT "list_of_services_service_category_id_fkey" FOREIGN KEY ("service_category_id") REFERENCES "service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_of_services" ADD CONSTRAINT "list_of_services_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_services" ADD CONSTRAINT "price_services_list_of_service_id_fkey" FOREIGN KEY ("list_of_service_id") REFERENCES "list_of_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_groups" ADD CONSTRAINT "medicine_groups_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_medicine_groups" ADD CONSTRAINT "price_medicine_groups_medicine_group_id_fkey" FOREIGN KEY ("medicine_group_id") REFERENCES "medicine_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_up_results" ADD CONSTRAINT "check_up_results_patient_registration_id_fkey" FOREIGN KEY ("patient_registration_id") REFERENCES "registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_up_results" ADD CONSTRAINT "check_up_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_up_images" ADD CONSTRAINT "check_up_images_check_up_result_id_fkey" FOREIGN KEY ("check_up_result_id") REFERENCES "check_up_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detail_item_patients" ADD CONSTRAINT "detail_item_patients_check_up_result_id_fkey" FOREIGN KEY ("check_up_result_id") REFERENCES "check_up_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detail_item_patients" ADD CONSTRAINT "detail_item_patients_price_item_id_fkey" FOREIGN KEY ("price_item_id") REFERENCES "price_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detail_item_patients" ADD CONSTRAINT "detail_item_patients_detail_medicine_group_id_fkey" FOREIGN KEY ("detail_medicine_group_id") REFERENCES "detail_medicine_group_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detail_service_patients" ADD CONSTRAINT "detail_service_patients_check_up_result_id_fkey" FOREIGN KEY ("check_up_result_id") REFERENCES "check_up_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detail_service_patients" ADD CONSTRAINT "detail_service_patients_price_service_id_fkey" FOREIGN KEY ("price_service_id") REFERENCES "price_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detail_medicine_group_results" ADD CONSTRAINT "detail_medicine_group_results_check_up_result_id_fkey" FOREIGN KEY ("check_up_result_id") REFERENCES "check_up_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detail_medicine_group_results" ADD CONSTRAINT "detail_medicine_group_results_medicine_group_id_fkey" FOREIGN KEY ("medicine_group_id") REFERENCES "medicine_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_of_payments" ADD CONSTRAINT "list_of_payments_check_up_result_id_fkey" FOREIGN KEY ("check_up_result_id") REFERENCES "check_up_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_of_payments" ADD CONSTRAINT "list_of_payments_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_of_payments" ADD CONSTRAINT "list_of_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_of_payment_items" ADD CONSTRAINT "list_of_payment_items_list_of_payment_id_fkey" FOREIGN KEY ("list_of_payment_id") REFERENCES "list_of_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_of_payment_items" ADD CONSTRAINT "list_of_payment_items_detail_item_patient_id_fkey" FOREIGN KEY ("detail_item_patient_id") REFERENCES "detail_item_patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_of_payment_services" ADD CONSTRAINT "list_of_payment_services_list_of_payment_id_fkey" FOREIGN KEY ("list_of_payment_id") REFERENCES "list_of_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_of_payment_services" ADD CONSTRAINT "list_of_payment_services_detail_service_patient_id_fkey" FOREIGN KEY ("detail_service_patient_id") REFERENCES "detail_service_patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_of_payment_medicine_groups" ADD CONSTRAINT "list_of_payment_medicine_groups_list_of_payment_id_fkey" FOREIGN KEY ("list_of_payment_id") REFERENCES "list_of_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_of_payment_medicine_groups" ADD CONSTRAINT "list_of_payment_medicine_groups_medicine_group_id_fkey" FOREIGN KEY ("medicine_group_id") REFERENCES "medicine_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_of_payment_medicine_groups" ADD CONSTRAINT "list_of_payment_medicine_groups_detail_medicine_group_resu_fkey" FOREIGN KEY ("detail_medicine_group_result_id") REFERENCES "detail_medicine_group_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_payment_petshops" ADD CONSTRAINT "master_payment_petshops_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_payment_petshops" ADD CONSTRAINT "master_payment_petshops_price_item_pet_shop_id_fkey" FOREIGN KEY ("price_item_pet_shop_id") REFERENCES "price_item_pet_shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_petshops" ADD CONSTRAINT "payment_petshops_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_petshop_items" ADD CONSTRAINT "payment_petshop_items_payment_petshop_id_fkey" FOREIGN KEY ("payment_petshop_id") REFERENCES "payment_petshops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_petshop_items" ADD CONSTRAINT "payment_petshop_items_price_item_pet_shop_id_fkey" FOREIGN KEY ("price_item_pet_shop_id") REFERENCES "price_item_pet_shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_clinic_petshop_items" ADD CONSTRAINT "payment_clinic_petshop_items_payment_petshop_id_fkey" FOREIGN KEY ("payment_petshop_id") REFERENCES "payment_petshops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_clinic_petshop_items" ADD CONSTRAINT "payment_clinic_petshop_items_price_item_pet_shop_id_fkey" FOREIGN KEY ("price_item_pet_shop_id") REFERENCES "price_item_pet_shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_user_employee_id_fkey" FOREIGN KEY ("user_employee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_spender_fkey" FOREIGN KEY ("user_id_spender") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weight_records" ADD CONSTRAINT "weight_records_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weight_records" ADD CONSTRAINT "weight_records_check_up_result_id_fkey" FOREIGN KEY ("check_up_result_id") REFERENCES "check_up_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccination_records" ADD CONSTRAINT "vaccination_records_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccination_records" ADD CONSTRAINT "vaccination_records_check_up_result_id_fkey" FOREIGN KEY ("check_up_result_id") REFERENCES "check_up_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deworming_records" ADD CONSTRAINT "deworming_records_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deworming_records" ADD CONSTRAINT "deworming_records_check_up_result_id_fkey" FOREIGN KEY ("check_up_result_id") REFERENCES "check_up_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "major_procedure_records" ADD CONSTRAINT "major_procedure_records_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "major_procedure_records" ADD CONSTRAINT "major_procedure_records_check_up_result_id_fkey" FOREIGN KEY ("check_up_result_id") REFERENCES "check_up_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;

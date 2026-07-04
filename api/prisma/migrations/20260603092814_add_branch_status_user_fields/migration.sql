-- AlterTable
ALTER TABLE "branches" ADD COLUMN     "email" TEXT,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "operating_hours" TEXT;

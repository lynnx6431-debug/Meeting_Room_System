-- AlterTable
ALTER TABLE "service_counters"
ADD COLUMN "name_zh" TEXT,
ADD COLUMN "name_en" TEXT,
ADD COLUMN "name_hant" TEXT;

UPDATE "service_counters" SET "name_zh" = "name" WHERE "name_zh" IS NULL;

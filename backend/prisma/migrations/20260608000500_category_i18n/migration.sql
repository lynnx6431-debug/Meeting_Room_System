-- AlterTable
ALTER TABLE "categories"
ADD COLUMN "name_zh" TEXT,
ADD COLUMN "name_en" TEXT,
ADD COLUMN "name_hant" TEXT;

UPDATE "categories" SET "name_zh" = "name" WHERE "name_zh" IS NULL;

-- CreateTable
CREATE TABLE "service_counters" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "service_counters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_counters_name_key" ON "service_counters"("name");

-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN "service_counter_id" TEXT;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_service_counter_id_fkey" FOREIGN KEY ("service_counter_id") REFERENCES "service_counters"("id") ON DELETE SET NULL ON UPDATE CASCADE;


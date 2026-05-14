-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'completed');

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

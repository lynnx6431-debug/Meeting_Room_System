-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('active', 'suspended', 'offboarded');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'CUSTOMER_ADMIN', 'OPERATOR');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('invited', 'active', 'disabled');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'acknowledged', 'done');

-- CreateEnum
CREATE TYPE "RoomSessionStatus" AS ENUM ('occupied', 'vacant');

-- CreateEnum
CREATE TYPE "CategoryOrderMode" AS ENUM ('quantity', 'one_off');

-- CreateEnum
CREATE TYPE "CategoryLimitMode" AS ENUM ('total_per_category', 'per_item');

-- CreateEnum
CREATE TYPE "LicenseAuditChangeType" AS ENUM ('create', 'renew', 'add_rooms', 'suspend', 'activate', 'offboard');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('pending', 'activated', 'expired', 'revoked');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'active',
    "license_expiry" TIMESTAMPTZ(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Hong_Kong',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_configs" (
    "tenant_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tenant_configs_pkey" PRIMARY KEY ("tenant_id","key")
);

-- CreateTable
CREATE TABLE "licenses" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "site_id" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'standard',
    "room_limit" INTEGER NOT NULL DEFAULT 10,
    "expiry_date" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license_audit_log" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "changed_by" TEXT NOT NULL,
    "change_type" "LicenseAuditChangeType" NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "license_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "alert_timeout_sec" INTEGER NOT NULL DEFAULT 60,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_branding" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "logo_url" TEXT,
    "background_url" TEXT,
    "primary_colour" TEXT NOT NULL DEFAULT '#00845C',
    "welcome_en" TEXT,
    "welcome_tc" TEXT,
    "welcome_sc" TEXT,
    "wifi_ssid" TEXT,
    "wifi_password_encrypted" BYTEA,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "site_branding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "code" TEXT,
    "room_token" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_en" TEXT,
    "name_tc" TEXT,
    "name_sc" TEXT,
    "menu_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_sessions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "headcount" INTEGER NOT NULL,
    "status" "RoomSessionStatus" NOT NULL DEFAULT 'occupied',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reset_at" TIMESTAMPTZ(3),
    "reset_by" TEXT,
    "closed_at" TIMESTAMPTZ(3),

    CONSTRAINT "room_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_category_usage" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "item_id" TEXT,
    "quantity_used" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "session_category_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_categories" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name_en" TEXT,
    "name_tc" TEXT,
    "name_sc" TEXT,
    "image_url" TEXT,
    "order_mode" "CategoryOrderMode" NOT NULL DEFAULT 'quantity',
    "limit_mode" "CategoryLimitMode" NOT NULL DEFAULT 'total_per_category',
    "default_operator_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "menu_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "room_id" TEXT,
    "key" TEXT NOT NULL,
    "name_en" TEXT,
    "name_tc" TEXT,
    "name_sc" TEXT,
    "desc_en" TEXT,
    "desc_tc" TEXT,
    "desc_sc" TEXT,
    "image_url" TEXT,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "session_id" TEXT,
    "items" JSONB NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "acknowledged_at" TIMESTAMPTZ(3),
    "acknowledged_by" TEXT,
    "completed_at" TIMESTAMPTZ(3),
    "completed_by" TEXT,
    "ai_ready_flag" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "password_hash" TEXT,
    "sso_provider" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'OPERATOR',
    "status" "UserStatus" NOT NULL DEFAULT 'invited',
    "preferred_language" TEXT NOT NULL DEFAULT 'zh',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_site_assignments" (
    "user_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_site_assignments_pkey" PRIMARY KEY ("user_id","site_id")
);

-- CreateTable
CREATE TABLE "room_operator_assignments" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "operator_user_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_operator_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "issued_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "revoked_at" TIMESTAMPTZ(3),
    "replaced_by" TEXT,
    "user_agent" TEXT,
    "ip" TEXT,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invites" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'pending',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activated_at" TIMESTAMPTZ(3),

    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_configs" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "tenant_configs_tenant_id_idx" ON "tenant_configs"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "licenses_site_id_key" ON "licenses"("site_id");

-- CreateIndex
CREATE INDEX "licenses_tenant_id_idx" ON "licenses"("tenant_id");

-- CreateIndex
CREATE INDEX "license_audit_log_tenant_id_changed_at_idx" ON "license_audit_log"("tenant_id", "changed_at");

-- CreateIndex
CREATE INDEX "sites_tenant_id_idx" ON "sites"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "site_branding_site_id_key" ON "site_branding"("site_id");

-- CreateIndex
CREATE INDEX "site_branding_tenant_id_idx" ON "site_branding"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_room_token_key" ON "rooms"("room_token");

-- CreateIndex
CREATE INDEX "rooms_tenant_id_idx" ON "rooms"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_site_id_code_key" ON "rooms"("site_id", "code");

-- CreateIndex
CREATE INDEX "room_sessions_room_id_status_idx" ON "room_sessions"("room_id", "status");

-- CreateIndex
CREATE INDEX "room_sessions_site_id_created_at_idx" ON "room_sessions"("site_id", "created_at");

-- CreateIndex
CREATE INDEX "session_category_usage_session_id_idx" ON "session_category_usage"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_category_usage_session_id_category_id_item_id_key" ON "session_category_usage"("session_id", "category_id", "item_id");

-- CreateIndex
CREATE INDEX "menu_categories_tenant_id_idx" ON "menu_categories"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "menu_categories_site_id_key_key" ON "menu_categories"("site_id", "key");

-- CreateIndex
CREATE INDEX "menu_items_tenant_id_idx" ON "menu_items"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "menu_items_site_id_key_key" ON "menu_items"("site_id", "key");

-- CreateIndex
CREATE INDEX "orders_tenant_id_status_idx" ON "orders"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "orders_session_id_idx" ON "orders"("session_id");

-- CreateIndex
CREATE INDEX "orders_site_id_status_created_at_idx" ON "orders"("site_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE INDEX "room_operator_assignments_tenant_id_idx" ON "room_operator_assignments"("tenant_id");

-- CreateIndex
CREATE INDEX "room_operator_assignments_operator_user_id_idx" ON "room_operator_assignments"("operator_user_id");

-- CreateIndex
CREATE INDEX "room_operator_assignments_site_id_idx" ON "room_operator_assignments"("site_id");

-- CreateIndex
CREATE UNIQUE INDEX "room_operator_assignments_room_id_operator_user_id_key" ON "room_operator_assignments"("room_id", "operator_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_revoked_idx" ON "refresh_tokens"("user_id", "revoked");

-- CreateIndex
CREATE UNIQUE INDEX "invites_token_hash_key" ON "invites"("token_hash");

-- CreateIndex
CREATE INDEX "invites_tenant_id_status_idx" ON "invites"("tenant_id", "status");

-- AddForeignKey
ALTER TABLE "tenant_configs" ADD CONSTRAINT "tenant_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_audit_log" ADD CONSTRAINT "license_audit_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_branding" ADD CONSTRAINT "site_branding_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_branding" ADD CONSTRAINT "site_branding_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_sessions" ADD CONSTRAINT "room_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_sessions" ADD CONSTRAINT "room_sessions_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_sessions" ADD CONSTRAINT "room_sessions_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_category_usage" ADD CONSTRAINT "session_category_usage_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "room_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_category_usage" ADD CONSTRAINT "session_category_usage_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "menu_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_category_usage" ADD CONSTRAINT "session_category_usage_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_default_operator_id_fkey" FOREIGN KEY ("default_operator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "menu_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "room_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_site_assignments" ADD CONSTRAINT "user_site_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_site_assignments" ADD CONSTRAINT "user_site_assignments_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_operator_assignments" ADD CONSTRAINT "room_operator_assignments_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_operator_assignments" ADD CONSTRAINT "room_operator_assignments_operator_user_id_fkey" FOREIGN KEY ("operator_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_operator_assignments" ADD CONSTRAINT "room_operator_assignments_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_operator_assignments" ADD CONSTRAINT "room_operator_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Manual partial unique index for exactly one active session per room
CREATE UNIQUE INDEX "room_sessions_one_active_per_room"
ON "room_sessions" ("room_id")
WHERE "status" = 'occupied';


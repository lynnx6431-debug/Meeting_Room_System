#!/bin/sh
set -e

BASE=${BASE:-https://localhost}

TOKEN_A=$(curl -sk -X POST "$BASE/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"tenant-a-admin","password":"test123"}' | grep -oE '"token":"[^"]+"' | cut -d'"' -f4)
echo "Token A: ${TOKEN_A%${TOKEN_A#??????????????????????????????}}..."

TOKEN_B=$(curl -sk -X POST "$BASE/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"tenant-b-admin","password":"test123"}' | grep -oE '"token":"[^"]+"' | cut -d'"' -f4)
echo "Token B: ${TOKEN_B%${TOKEN_B#??????????????????????????????}}..."

TOKEN_SUPER=$(curl -sk -X POST "$BASE/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"super","password":"demo123"}' | grep -oE '"token":"[^"]+"' | cut -d'"' -f4)
echo "Token Super: ${TOKEN_SUPER%${TOKEN_SUPER#??????????????????????????????}}..."

echo ""
echo "=== Tenant A sees: ==="
curl -sk -H "Authorization: Bearer $TOKEN_A" "$BASE/api/admin/rooms"

echo ""
echo "=== Tenant B sees: ==="
curl -sk -H "Authorization: Bearer $TOKEN_B" "$BASE/api/admin/rooms"

echo ""
echo "=== SUPER_ADMIN sees: ==="
curl -sk -H "Authorization: Bearer $TOKEN_SUPER" "$BASE/api/admin/rooms"

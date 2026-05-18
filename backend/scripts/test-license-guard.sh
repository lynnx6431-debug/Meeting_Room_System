#!/bin/sh
set -e

BASE=${BASE:-https://localhost}

TOKEN_A=$(curl -sk -X POST "$BASE/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"tenant-a-admin","password":"test123"}' | grep -oE '"token":"[^"]+"' | cut -d'"' -f4)

echo "=== Test 1: GET /api/admin/rooms always allowed even after suspend ==="
docker exec meeting-room-postgres psql -U meeting -d meeting_room -c \
  "UPDATE tenants SET status='suspended' WHERE name='Tenant A';"
curl -sk -H "Authorization: Bearer $TOKEN_A" "$BASE/api/admin/rooms"
echo ""

echo "=== Test 2: POST /api/admin/rooms blocked when suspended ==="
curl -sk -X POST "$BASE/api/admin/rooms" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"name":"Should Not Create","siteId":"some-site-id"}'
echo ""

echo "=== Test 3: Restore active, then expire license, then try POST ==="
docker exec meeting-room-postgres psql -U meeting -d meeting_room -c \
  "UPDATE tenants SET status='active', license_expiry='2024-01-01' WHERE name='Tenant A';"
curl -sk -X POST "$BASE/api/admin/rooms" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"name":"Should Not Create","siteId":"some-site-id"}'
echo ""

echo "=== Test 4: Restore license_expiry, set roomLimit=1, try create 2nd room ==="
docker exec meeting-room-postgres psql -U meeting -d meeting_room -c \
  "UPDATE tenants SET license_expiry='2028-01-01' WHERE name='Tenant A';"
docker exec meeting-room-postgres psql -U meeting -d meeting_room -c \
  "INSERT INTO licenses (id, tenant_id, site_id, plan, room_limit, expiry_date, created_at, updated_at)
   SELECT 'lic-test-a', t.id, s.id, 'standard', 1, '2028-01-01', now(), now()
   FROM tenants t JOIN sites s ON s.tenant_id = t.id
   WHERE t.name='Tenant A' AND s.name='Site A'
   ON CONFLICT (site_id) DO UPDATE SET room_limit=1, expiry_date='2028-01-01', updated_at=now();"
SITE_A_ID=$(docker exec meeting-room-postgres psql -U meeting -d meeting_room -t -A -c \
  "SELECT id FROM sites WHERE name='Site A';" | tr -d '\r')
curl -sk -X POST "$BASE/api/admin/rooms" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Should Be Blocked\",\"siteId\":\"$SITE_A_ID\"}"
echo ""

echo "=== Test 5: SUPER_ADMIN bypasses (still blocked tenant) ==="
docker exec meeting-room-postgres psql -U meeting -d meeting_room -c \
  "UPDATE tenants SET status='suspended' WHERE name='Tenant A';"
TOKEN_SUPER=$(curl -sk -X POST "$BASE/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"super","password":"demo123"}' | grep -oE '"token":"[^"]+"' | cut -d'"' -f4)
curl -sk -X POST "$BASE/api/admin/rooms" \
  -H "Authorization: Bearer $TOKEN_SUPER" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Super Can Create\",\"siteId\":\"$SITE_A_ID\"}"
echo ""

echo "=== Restore Tenant A to active ==="
docker exec meeting-room-postgres psql -U meeting -d meeting_room -c \
  "UPDATE tenants SET status='active' WHERE name='Tenant A';"

#!/bin/sh
set -e

BASE=${BASE:-https://localhost}

extract_token() {
  printf '%s' "$1" | grep -oE '"token":"[^"]+"' | cut -d'"' -f4
}

SUPER_RESP=$(curl -sk -X POST "$BASE/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"super","password":"demo123"}')
SUPER_TOKEN=$(extract_token "$SUPER_RESP")

ADMIN_RESP=$(curl -sk -X POST "$BASE/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"demo123"}')
ADMIN_TOKEN=$(extract_token "$ADMIN_RESP")

OP_BEV_RESP=$(curl -sk -X POST "$BASE/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"operator-bev","password":"demo123"}')
OP_BEV_TOKEN=$(extract_token "$OP_BEV_RESP")

SITE_ID=$(docker exec meeting-room-postgres psql -U meeting -d meeting_room -t -A -c \
  "SELECT id FROM sites WHERE name='Demo Flagship' LIMIT 1;" | tr -d '\r')
TEST_ROOM_CODE="test-rbac-$(date +%s)"

echo "=== Test 1: OPERATOR cannot POST /rooms (403) ==="
curl -sk -X POST -H "Authorization: Bearer $OP_BEV_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Should Not Create\",\"siteId\":\"$SITE_ID\"}" \
  "$BASE/api/admin/rooms" -w "\nStatus: %{http_code}\n"
echo ""

echo "=== Test 2: OPERATOR cannot DELETE /rooms/:id (403) ==="
ROOM_ID=$(docker exec meeting-room-postgres psql -U meeting -d meeting_room -t -A -c \
  "SELECT id FROM rooms WHERE code='room-demo' LIMIT 1;" | tr -d '\r')
curl -sk -X DELETE -H "Authorization: Bearer $OP_BEV_TOKEN" \
  "$BASE/api/admin/rooms/$ROOM_ID" -w "\nStatus: %{http_code}\n"
echo ""

echo "=== Test 3: OPERATOR cannot POST /assignments (403) ==="
curl -sk -X POST -H "Authorization: Bearer $OP_BEV_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"roomId":"x","operatorUserId":"y"}' \
  "$BASE/api/admin/assignments" -w "\nStatus: %{http_code}\n"
echo ""

echo "=== Test 4: OPERATOR can GET /me/assignments (200) ==="
curl -sk -H "Authorization: Bearer $OP_BEV_TOKEN" \
  "$BASE/api/admin/me/assignments" -w "\nStatus: %{http_code}\n" | head -c 200
echo ""

echo "=== Test 5: OPERATOR cannot POST /invites (403) ==="
curl -sk -X POST -H "Authorization: Bearer $OP_BEV_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"x@demo.local","role":"OPERATOR"}' \
  "$BASE/api/admin/invites" -w "\nStatus: %{http_code}\n"
echo ""

echo "=== Test 6: CUSTOMER_ADMIN CAN POST /rooms (201) ==="
curl -sk -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test Room E2-04\",\"siteId\":\"$SITE_ID\",\"code\":\"$TEST_ROOM_CODE\"}" \
  "$BASE/api/admin/rooms" -w "\nStatus: %{http_code}\n"
echo ""

echo "=== Test 7: SUPER_ADMIN can do everything ==="
curl -sk -H "Authorization: Bearer $SUPER_TOKEN" \
  "$BASE/api/admin/assignments?siteId=$SITE_ID" -w "\nStatus: %{http_code}\n" | head -c 100
echo ""

echo "=== Test 8: OPERATOR PATCH /rooms/:id/headcount (404 if no active session OR 200) ==="
curl -sk -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"headcount":2}' \
  "$BASE/api/admin/rooms/$ROOM_ID/sessions" > /dev/null 2>&1 || true
curl -sk -X PATCH -H "Authorization: Bearer $OP_BEV_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"headcount":3}' \
  "$BASE/api/admin/rooms/$ROOM_ID/headcount" -w "\nStatus: %{http_code}\n"
echo ""

echo "=== Test 9: OPERATOR PATCH unpaired room headcount -> OPERATOR_NOT_ASSIGNED_TO_ROOM (403) ==="
curl -sk -X PATCH -H "Authorization: Bearer $OP_BEV_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"headcount":3}' \
  "$BASE/api/admin/rooms/nonexistent-room-id/headcount" -w "\nStatus: %{http_code}\n"
echo ""

docker exec meeting-room-postgres psql -U meeting -d meeting_room -c \
  "DELETE FROM rooms WHERE code='$TEST_ROOM_CODE';" > /dev/null

echo "=== Test 10: GET /rooms as OPERATOR — see only assigned site's rooms ==="
curl -sk -H "Authorization: Bearer $OP_BEV_TOKEN" "$BASE/api/admin/rooms" | head -c 500
echo ""

curl -sk -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$BASE/api/admin/rooms/$ROOM_ID/reset" > /dev/null 2>&1 || true

echo "Done"

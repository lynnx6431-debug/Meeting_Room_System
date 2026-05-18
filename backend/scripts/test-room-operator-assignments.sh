#!/bin/sh
set -e

BASE=${BASE:-https://localhost}

extract_token() {
  printf '%s' "$1" | grep -oE '"token":"[^"]+"' | cut -d'"' -f4
}

ADMIN_RESP=$(curl -sk -X POST "$BASE/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"demo123"}')
ADMIN_TOKEN=$(extract_token "$ADMIN_RESP")

OP_RESP=$(curl -sk -X POST "$BASE/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"operator-bev","password":"demo123"}')
OP_TOKEN=$(extract_token "$OP_RESP")

SITE_ID=$(docker exec meeting-room-postgres psql -U meeting -d meeting_room -t -A -c \
  "SELECT id FROM sites WHERE name='Demo Flagship' LIMIT 1;" | tr -d '\r')

echo "Site: $SITE_ID"
echo ""

echo "=== Test 1: List assignments (seed should have 6) ==="
curl -sk -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/admin/assignments?siteId=$SITE_ID"
echo ""
echo ""

echo "=== Test 2: Matrix view ==="
curl -sk -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/admin/assignments/matrix?siteId=$SITE_ID"
echo ""
echo ""

echo "=== Test 3: Operator views own assignments ==="
curl -sk -H "Authorization: Bearer $OP_TOKEN" "$BASE/api/admin/me/assignments"
echo ""
echo ""

echo "=== Test 4: Create duplicate -> ASSIGNMENT_EXISTS ==="
ROOM_ID=$(docker exec meeting-room-postgres psql -U meeting -d meeting_room -t -A -c \
  "SELECT room_id FROM room_operator_assignments WHERE site_id='$SITE_ID' ORDER BY room_id, operator_user_id LIMIT 1;" | tr -d '\r')
OP_ID=$(docker exec meeting-room-postgres psql -U meeting -d meeting_room -t -A -c \
  "SELECT operator_user_id FROM room_operator_assignments WHERE room_id='$ROOM_ID' ORDER BY operator_user_id LIMIT 1;" | tr -d '\r')
curl -sk -X POST "$BASE/api/admin/assignments" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"roomId\":\"$ROOM_ID\",\"operatorUserId\":\"$OP_ID\"}"
echo ""
echo ""

echo "=== Test 5: Delete then re-create ==="
curl -sk -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$BASE/api/admin/assignments/$ROOM_ID/$OP_ID" -w "Status: %{http_code}\n"
curl -sk -X POST "$BASE/api/admin/assignments" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"roomId\":\"$ROOM_ID\",\"operatorUserId\":\"$OP_ID\"}"
echo ""
echo ""

echo "=== Test 6: Delete non-existent -> 404 ==="
curl -sk -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$BASE/api/admin/assignments/nonexistent/nonexistent" -w " Status: %{http_code}\n"
echo ""
echo ""

echo "=== Test 7: Matrix replace — clear all then re-add bev to room-demo only ==="
ROOM_DEMO=$(docker exec meeting-room-postgres psql -U meeting -d meeting_room -t -A -c \
  "SELECT id FROM rooms WHERE code='room-demo' LIMIT 1;" | tr -d '\r')
OP_BEV=$(docker exec meeting-room-postgres psql -U meeting -d meeting_room -t -A -c \
  "SELECT id FROM users WHERE username='operator-bev' LIMIT 1;" | tr -d '\r')
curl -sk -X PUT "$BASE/api/admin/assignments/matrix" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"siteId\":\"$SITE_ID\",\"desired\":[{\"roomId\":\"$ROOM_DEMO\",\"operatorUserId\":\"$OP_BEV\"}]}"
echo ""
echo ""

echo "=== Test 8: After replace, only 1 assignment should remain ==="
docker exec meeting-room-postgres psql -U meeting -d meeting_room -c \
  "SELECT COUNT(*) FROM room_operator_assignments WHERE site_id='$SITE_ID';"
echo ""

echo "=== Test 9: Operator tries to call admin endpoint -> 403 ==="
curl -sk -H "Authorization: Bearer $OP_TOKEN" "$BASE/api/admin/assignments?siteId=$SITE_ID" -w " Status: %{http_code}\n"
echo ""
echo ""

echo "=== Test 10: Cross-tenant site -> SITE_NOT_FOUND ==="
echo "(skipped — uses tenant-a-admin from E1-05/06 if still in DB)"
echo ""

echo "=== Restore matrix to full 6 assignments via PUT ==="
ROOM_LIB=$(docker exec meeting-room-postgres psql -U meeting -d meeting_room -t -A -c \
  "SELECT id FROM rooms WHERE code='room-library' LIMIT 1;" | tr -d '\r')
ROOM_TAST=$(docker exec meeting-room-postgres psql -U meeting -d meeting_room -t -A -c \
  "SELECT id FROM rooms WHERE code='room-tasting' LIMIT 1;" | tr -d '\r')
OP_TIDY=$(docker exec meeting-room-postgres psql -U meeting -d meeting_room -t -A -c \
  "SELECT id FROM users WHERE username='operator-tidy' LIMIT 1;" | tr -d '\r')
curl -sk -X PUT "$BASE/api/admin/assignments/matrix" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"siteId\":\"$SITE_ID\",\"desired\":[{\"roomId\":\"$ROOM_DEMO\",\"operatorUserId\":\"$OP_BEV\"},{\"roomId\":\"$ROOM_DEMO\",\"operatorUserId\":\"$OP_TIDY\"},{\"roomId\":\"$ROOM_LIB\",\"operatorUserId\":\"$OP_BEV\"},{\"roomId\":\"$ROOM_LIB\",\"operatorUserId\":\"$OP_TIDY\"},{\"roomId\":\"$ROOM_TAST\",\"operatorUserId\":\"$OP_BEV\"},{\"roomId\":\"$ROOM_TAST\",\"operatorUserId\":\"$OP_TIDY\"}]}"
echo ""
docker exec meeting-room-postgres psql -U meeting -d meeting_room -c \
  "SELECT COUNT(*) FROM room_operator_assignments;"
echo ""
echo "Done"

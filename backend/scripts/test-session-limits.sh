#!/bin/sh
set -e

BASE=${BASE:-https://localhost}

TOKEN=$(curl -sk -X POST "$BASE/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"super","password":"demo123"}' | grep -oE '"token":"[^"]+"' | cut -d'"' -f4)

ROOM_ID=$(docker exec meeting-room-postgres psql -U meeting -d meeting_room -t -A -c \
  "SELECT id FROM rooms WHERE code='room-demo' LIMIT 1;" | tr -d '\r')
DRINK_ID=$(docker exec meeting-room-postgres psql -U meeting -d meeting_room -t -A -c \
  "SELECT id FROM menu_items WHERE key='drink-coffee' LIMIT 1;" | tr -d '\r')
SNACK_ID=$(docker exec meeting-room-postgres psql -U meeting -d meeting_room -t -A -c \
  "SELECT id FROM menu_items WHERE key='snack-chips' LIMIT 1;" | tr -d '\r')
TIDY_A_ID=$(docker exec meeting-room-postgres psql -U meeting -d meeting_room -t -A -c \
  "SELECT id FROM menu_items WHERE key='tidy-basic' LIMIT 1;" | tr -d '\r')
TIDY_B_ID=$(docker exec meeting-room-postgres psql -U meeting -d meeting_room -t -A -c \
  "SELECT id FROM menu_items WHERE key='tidy-deep' LIMIT 1;" | tr -d '\r')

docker exec meeting-room-postgres psql -U meeting -d meeting_room -c \
  "DELETE FROM orders WHERE room_id='${ROOM_ID}';
   DELETE FROM session_category_usage WHERE room_id='${ROOM_ID}';
   DELETE FROM room_sessions WHERE room_id='${ROOM_ID}';" >/dev/null

echo "Room: $ROOM_ID"

echo "=== Test 1: Create session ==="
curl -sk -X POST "$BASE/api/admin/rooms/$ROOM_ID/sessions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"headcount":2}'
echo ""

echo "=== Test 2: Create 2nd session -> ROOM_ALREADY_OCCUPIED ==="
curl -sk -X POST "$BASE/api/admin/rooms/$ROOM_ID/sessions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"headcount":3}'
echo ""

echo "=== Test 3: Reset ==="
curl -sk -X POST "$BASE/api/admin/rooms/$ROOM_ID/reset" \
  -H "Authorization: Bearer $TOKEN"
echo ""

echo "=== Test 4: New session after reset ==="
curl -sk -X POST "$BASE/api/admin/rooms/$ROOM_ID/sessions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"headcount":2}'
echo ""

echo "=== Test 5: Override headcount to 4 ==="
curl -sk -X PATCH "$BASE/api/admin/rooms/$ROOM_ID/headcount" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"headcount":4}'
echo ""

echo "=== Test 6: quantity + total_per_category -> CATEGORY_FULL ==="
curl -sk -X POST "$BASE/api/orders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"roomId\":\"$ROOM_ID\",\"items\":[{\"itemId\":\"$DRINK_ID\",\"qty\":5}]}"
echo ""

echo "=== Test 7: quantity + per_item -> ITEM_LIMIT_REACHED ==="
curl -sk -X POST "$BASE/api/orders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"roomId\":\"$ROOM_ID\",\"items\":[{\"itemId\":\"$SNACK_ID\",\"qty\":5}]}"
echo ""

echo "=== Test 8: one_off first item succeeds ==="
curl -sk -X POST "$BASE/api/orders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"roomId\":\"$ROOM_ID\",\"items\":[{\"itemId\":\"$TIDY_A_ID\",\"qty\":1}]}"
echo ""

echo "=== Test 9: same one_off item again -> ITEM_TAKEN ==="
curl -sk -X POST "$BASE/api/orders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"roomId\":\"$ROOM_ID\",\"items\":[{\"itemId\":\"$TIDY_A_ID\",\"qty\":1}]}"
echo ""

echo "=== Test 10: different one_off item succeeds ==="
curl -sk -X POST "$BASE/api/orders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"roomId\":\"$ROOM_ID\",\"items\":[{\"itemId\":\"$TIDY_B_ID\",\"qty\":1}]}"
echo ""

TOKEN_A=$(curl -sk -X POST "$BASE/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"tenant-a-admin","password":"test123"}' | grep -oE '"token":"[^"]+"' | cut -d'"' -f4)

echo "=== Test 11: tenant A cannot create session on demo room ==="
curl -sk -X POST "$BASE/api/admin/rooms/$ROOM_ID/sessions" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"headcount":2}'
echo ""

echo "Done"

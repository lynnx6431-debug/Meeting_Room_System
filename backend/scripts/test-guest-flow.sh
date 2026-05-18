#!/bin/sh
set -e

BASE=${BASE:-https://localhost}

ROOM_TOKEN=$(docker exec meeting-room-postgres psql -U meeting -d meeting_room -t -A -c \
  "SELECT room_token FROM rooms WHERE code='room-demo' LIMIT 1;" | tr -d '\r')
ROOM_DEMO_ID=$(docker exec meeting-room-postgres psql -U meeting -d meeting_room -t -A -c \
  "SELECT id FROM rooms WHERE code='room-demo' LIMIT 1;" | tr -d '\r')

ADMIN_TOKEN=$(curl -sk -X POST "$BASE/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"demo123"}' | grep -oE '"token":"[^"]+"' | cut -d'"' -f4)
curl -sk -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$BASE/api/admin/rooms/$ROOM_DEMO_ID/reset" > /dev/null 2>&1 || true

echo "Room: $ROOM_DEMO_ID, Token: $ROOM_TOKEN"
echo ""

echo "=== Test 1: GET /api/guest/me with header token ==="
curl -sk -H "X-Room-Token: $ROOM_TOKEN" "$BASE/api/guest/me"
echo ""
echo ""

echo "=== Test 2: GET /api/guest/me with query token (no header) ==="
curl -sk "$BASE/api/guest/me?token=$ROOM_TOKEN"
echo ""
echo ""

echo "=== Test 3: GET /api/guest/me without token -> 401 ==="
curl -sk "$BASE/api/guest/me" -w "\nStatus: %{http_code}\n"
echo ""

echo "=== Test 4: GET /api/guest/me with invalid token -> 401 ==="
curl -sk -H "X-Room-Token: invalid-token-xyz" "$BASE/api/guest/me" -w "\nStatus: %{http_code}\n"
echo ""

echo "=== Test 5: GET /api/guest/menu ==="
curl -sk -H "X-Room-Token: $ROOM_TOKEN" "$BASE/api/guest/menu" | head -c 500
echo ""
echo ""

echo "=== Test 6: GET /api/guest/session (no session yet) ==="
curl -sk -H "X-Room-Token: $ROOM_TOKEN" "$BASE/api/guest/session"
echo ""
echo ""

echo "=== Test 7: POST /api/guest/session (headcount=2) ==="
curl -sk -X POST -H "X-Room-Token: $ROOM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"headcount":2}' \
  "$BASE/api/guest/session"
echo ""
echo ""

echo "=== Test 8: POST /api/guest/session again -> ROOM_ALREADY_OCCUPIED 409 ==="
curl -sk -X POST -H "X-Room-Token: $ROOM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"headcount":3}' \
  "$BASE/api/guest/session" -w "\nStatus: %{http_code}\n"
echo ""

echo "=== Test 9: GET /api/guest/session now returns session ==="
curl -sk -H "X-Room-Token: $ROOM_TOKEN" "$BASE/api/guest/session"
echo ""
echo ""

echo "=== Test 10: POST /api/guest/orders ==="
ITEM_ID=$(docker exec meeting-room-postgres psql -U meeting -d meeting_room -t -A -c \
  "SELECT id FROM menu_items WHERE key='snack-chips' LIMIT 1;" | tr -d '\r')
curl -sk -X POST -H "X-Room-Token: $ROOM_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"items\":[{\"itemId\":\"$ITEM_ID\",\"qty\":1}]}" \
  "$BASE/api/guest/orders" -w "\nStatus: %{http_code}\n"
echo ""

echo "=== Test 11: POST /api/guest/orders qty=2 (full) ==="
curl -sk -X POST -H "X-Room-Token: $ROOM_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"items\":[{\"itemId\":\"$ITEM_ID\",\"qty\":1}]}" \
  "$BASE/api/guest/orders"
echo ""
echo ""

echo "=== Test 12: POST /api/guest/orders one more -> ITEM_LIMIT_REACHED ==="
curl -sk -X POST -H "X-Room-Token: $ROOM_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"items\":[{\"itemId\":\"$ITEM_ID\",\"qty\":1}]}" \
  "$BASE/api/guest/orders" -w "\nStatus: %{http_code}\n"
echo ""

echo "=== Test 13: Cross-room — try item from another site -> 404 ==="
curl -sk -X POST -H "X-Room-Token: $ROOM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"itemId":"nonexistent-item-xyz","qty":1}]}' \
  "$BASE/api/guest/orders" -w "\nStatus: %{http_code}\n"
echo ""

echo "=== Test 14: Token regeneration test ==="
echo "Old token: $ROOM_TOKEN"
docker exec meeting-room-postgres psql -U meeting -d meeting_room -t -A -c \
  "UPDATE rooms SET room_token=gen_random_uuid()::text WHERE code='room-demo';" > /dev/null
NEW_TOKEN=$(docker exec meeting-room-postgres psql -U meeting -d meeting_room -t -A -c \
  "SELECT room_token FROM rooms WHERE code='room-demo' LIMIT 1;" | tr -d ' \r')
echo "New token: $NEW_TOKEN"
curl -sk -H "X-Room-Token: $ROOM_TOKEN" "$BASE/api/guest/me" -w "\nStatus: %{http_code}\n"
curl -sk -H "X-Room-Token: $NEW_TOKEN" "$BASE/api/guest/me" | head -c 200
echo ""

echo "=== Cleanup: reset room ==="
curl -sk -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$BASE/api/admin/rooms/$ROOM_DEMO_ID/reset" > /dev/null 2>&1 || true

echo "Done"

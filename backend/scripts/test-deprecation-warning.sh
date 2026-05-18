#!/bin/sh
set -e

BASE=${BASE:-https://localhost}

SUPER_TOKEN=$(curl -sk -X POST "$BASE/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"super","password":"demo123"}' | grep -oE '"token":"[^"]+"' | cut -d'"' -f4)

echo "=== Test 1: GET /api/orders returns Deprecation headers ==="
curl -sk -I -H "Authorization: Bearer $SUPER_TOKEN" "$BASE/api/orders" 2>&1 | grep -E "Deprecation|Sunset|Link"
echo ""

echo "=== Test 2: New /api/guest/orders has NO Deprecation header ==="
ROOM_TOKEN=$(docker exec meeting-room-postgres psql -U meeting -d meeting_room -t -A -c \
  "SELECT room_token FROM rooms WHERE code='room-demo' LIMIT 1;" | tr -d '\r')
curl -sk -I -H "X-Room-Token: $ROOM_TOKEN" "$BASE/api/guest/me" 2>&1 | grep -iE "Deprecation|Sunset" || echo "  (No deprecation header — correct)"
echo ""

echo "=== Test 3: Legacy /api/orders still works (compat window) ==="
curl -sk -H "Authorization: Bearer $SUPER_TOKEN" "$BASE/api/orders" -w "\nStatus: %{http_code}\n" | head -c 200
echo ""

echo "=== Test 4: Check console.warn output (look at backend logs separately) ==="
echo "Expected: backend logged [DEPRECATED] GET /api/orders called by..."

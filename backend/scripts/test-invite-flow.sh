#!/bin/sh
set -e

BASE=${BASE:-https://localhost}
SUFFIX=$(date +%s)

extract_token() {
  printf '%s' "$1" | grep -oE '"token":"[^"]+"' | cut -d'"' -f4
}

extract_link() {
  printf '%s' "$1" | grep -oE '"link":"[^"]+"' | cut -d'"' -f4
}

extract_id() {
  printf '%s' "$1" | grep -oE '"id":"[^"]+"' | head -1 | cut -d'"' -f4
}

extract_query_token() {
  printf '%s' "$1" | sed -n 's/.*token=\([^"&]*\).*/\1/p'
}

SUPER_RESP=$(curl -sk -X POST "$BASE/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"super","password":"demo123"}')
SUPER_TOKEN=$(extract_token "$SUPER_RESP")

ADMIN_RESP=$(curl -sk -X POST "$BASE/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"demo123"}')
ADMIN_TOKEN=$(extract_token "$ADMIN_RESP")

OP_RESP=$(curl -sk -X POST "$BASE/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"operator-bev","password":"demo123"}')
OP_TOKEN=$(extract_token "$OP_RESP")

TENANT_ID=$(docker exec meeting-room-postgres psql -U meeting -d meeting_room -t -A -c \
  "SELECT id FROM tenants WHERE name='Demo Bank' LIMIT 1;" | tr -d '\r')

NEW_ADMIN_EMAIL="new-admin-${SUFFIX}@demo.local"
NEW_ADMIN_USER="new-admin-${SUFFIX}"
NEW_OP_EMAIL="new-op-${SUFFIX}@demo.local"
EXPIRED_EMAIL="expired-${SUFFIX}@demo.local"
VALIDATION_EMAIL="validation-${SUFFIX}@demo.local"

echo "Tenant ID: $TENANT_ID"
echo ""

echo "=== Test 1: Super invites Customer Admin ==="
RESP=$(curl -sk -X POST "$BASE/api/admin/invites" \
  -H "Authorization: Bearer $SUPER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$NEW_ADMIN_EMAIL\",\"role\":\"CUSTOMER_ADMIN\",\"tenantId\":\"$TENANT_ID\"}")
echo "$RESP"
LINK=$(extract_link "$RESP")
TOKEN=$(extract_query_token "$LINK")
echo "Token: $TOKEN"
echo ""

echo "=== Test 2: Anyone can GET /invites/:token (no auth) ==="
curl -sk "$BASE/api/admin/invites/$TOKEN"
echo ""
echo ""

echo "=== Test 3: Activate invite ==="
curl -sk -X POST "$BASE/api/admin/invites/$TOKEN/activate" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$NEW_ADMIN_USER\",\"password\":\"newpass123\"}"
echo ""
echo ""

echo "=== Test 4: Reusing same token -> INVITE_ALREADY_USED ==="
curl -sk -X POST "$BASE/api/admin/invites/$TOKEN/activate" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"another-admin-$SUFFIX\",\"password\":\"newpass123\"}"
echo ""
echo ""

echo "=== Test 5: New admin can login ==="
NEW_LOGIN=$(curl -sk -X POST "$BASE/api/admin/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$NEW_ADMIN_USER\",\"password\":\"newpass123\"}")
NEW_TOKEN=$(extract_token "$NEW_LOGIN")
echo "New admin token: $(printf '%.30s' "$NEW_TOKEN")..."
echo ""

echo "=== Test 6: Customer Admin invites Operator (allowed) ==="
RESP=$(curl -sk -X POST "$BASE/api/admin/invites" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$NEW_OP_EMAIL\",\"role\":\"OPERATOR\"}")
echo "$RESP"
echo ""

echo "=== Test 7: Customer Admin invites SUPER_ADMIN (forbidden) ==="
curl -sk -X POST "$BASE/api/admin/invites" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"hacker-$SUFFIX@evil.com\",\"role\":\"SUPER_ADMIN\"}"
echo ""
echo ""

echo "=== Test 8: Customer Admin invites another CUSTOMER_ADMIN (forbidden) ==="
curl -sk -X POST "$BASE/api/admin/invites" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"another-admin-$SUFFIX@demo.local\",\"role\":\"CUSTOMER_ADMIN\"}"
echo ""
echo ""

echo "=== Test 9: Operator invites anyone (forbidden) ==="
curl -sk -X POST "$BASE/api/admin/invites" \
  -H "Authorization: Bearer $OP_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"x-$SUFFIX@demo.local\",\"role\":\"OPERATOR\"}"
echo ""
echo ""

echo "=== Test 10: GET invalid token -> INVALID_INVITE ==="
curl -sk "$BASE/api/admin/invites/invalid-token-xyz"
echo ""
echo ""

echo "=== Test 11: Expired invite (manually set expiresAt to past) ==="
RESP=$(curl -sk -X POST "$BASE/api/admin/invites" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EXPIRED_EMAIL\",\"role\":\"OPERATOR\"}")
EXP_LINK=$(extract_link "$RESP")
EXP_TOKEN=$(extract_query_token "$EXP_LINK")
EXP_ID=$(extract_id "$RESP")
docker exec meeting-room-postgres psql -U meeting -d meeting_room -c \
  "UPDATE invites SET expires_at = '2024-01-01' WHERE id = '$EXP_ID';" >/dev/null
curl -sk "$BASE/api/admin/invites/$EXP_TOKEN"
echo ""
echo ""

echo "=== Test 12: Username/password validation ==="
RESP=$(curl -sk -X POST "$BASE/api/admin/invites" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$VALIDATION_EMAIL\",\"role\":\"OPERATOR\"}")
V_LINK=$(extract_link "$RESP")
V_TOKEN=$(extract_query_token "$V_LINK")

echo "Test 12a: username too short:"
curl -sk -X POST "$BASE/api/admin/invites/$V_TOKEN/activate" \
  -H "Content-Type: application/json" \
  -d '{"username":"a","password":"longpassword"}'
echo ""

echo "Test 12b: password too short:"
curl -sk -X POST "$BASE/api/admin/invites/$V_TOKEN/activate" \
  -H "Content-Type: application/json" \
  -d '{"username":"valid-name","password":"short"}'
echo ""
echo ""

echo "Done"

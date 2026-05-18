#!/bin/sh
set -e

BASE=${BASE:-https://localhost}
COOKIE_JAR=$(mktemp)
OLD_JAR=$(mktemp)
LOGOUT_HEADERS=$(mktemp)

cleanup() {
  rm -f "$COOKIE_JAR" "$OLD_JAR" "$LOGOUT_HEADERS"
}

trap cleanup EXIT

extract_token() {
  printf '%s' "$1" | grep -oE '"token":"[^"]+"' | cut -d'"' -f4
}

echo "=== Test 1: Login as super, get access + refresh ==="
RESP=$(curl -sk -c "$COOKIE_JAR" -X POST "$BASE/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"super","password":"demo123"}')
printf '%s\n' "$RESP" | head -c 200
echo ""
echo "Cookies received:"
grep refresh_token "$COOKIE_JAR" || echo "  (none - FAIL: refresh_token cookie not set)"
cp "$COOKIE_JAR" "$OLD_JAR"
echo ""

ACCESS_TOKEN=$(extract_token "$RESP")
echo "Access token prefix: $(printf '%.30s' "$ACCESS_TOKEN")..."
echo "Access token TTL seconds:"
TOKEN="$ACCESS_TOKEN" node - <<'NODE'
const token = process.env.TOKEN || '';
const payloadPart = token.split('.')[1];
if (!payloadPart) {
  console.log('  unable to decode');
  process.exit(0);
}
const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
const ttl = typeof payload.exp === 'number' && typeof payload.iat === 'number' ? payload.exp - payload.iat : null;
console.log(`  ${ttl}`);
NODE
echo ""

echo "=== Test 2: Use access token to call protected endpoint ==="
curl -sk -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE/api/admin/me"
echo ""
echo ""

echo "=== Test 3: Refresh token rotation ==="
RESP2=$(curl -sk -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X POST "$BASE/api/admin/refresh")
echo "$RESP2"
NEW_ACCESS=$(extract_token "$RESP2")
echo "New access token prefix: $(printf '%.30s' "$NEW_ACCESS")..."
if [ "$ACCESS_TOKEN" != "$NEW_ACCESS" ]; then
  echo "Tokens differ: YES"
else
  echo "Tokens differ: NO"
fi
echo ""

echo "=== Test 4: Reuse old refresh token (should FAIL) ==="
curl -sk -i -b "$OLD_JAR" -X POST "$BASE/api/admin/refresh"
echo ""
echo ""

echo "=== Test 5: Refresh token DB status ==="
docker exec meeting-room-postgres psql -U meeting -d meeting_room -c \
  "SELECT revoked, COUNT(*) FROM refresh_tokens GROUP BY revoked ORDER BY revoked;"
echo ""

echo "=== Test 6: Logout ==="
curl -sk -D "$LOGOUT_HEADERS" -o /dev/null -b "$COOKIE_JAR" -X POST "$BASE/api/admin/logout" -w "Status: %{http_code}\n"
echo "Logout response headers:"
cat "$LOGOUT_HEADERS"
echo ""

echo "=== Test 7: After logout, refresh should fail ==="
curl -sk -i -b "$COOKIE_JAR" -X POST "$BASE/api/admin/refresh"
echo ""
echo ""

echo "=== Test 8: All 4 demo accounts can login ==="
for u in super admin operator-bev operator-tidy; do
  STATUS=$(curl -sk -o /dev/null -w "%{http_code}" -X POST "$BASE/api/admin/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$u\",\"password\":\"demo123\"}")
  echo "  $u -> HTTP $STATUS"
done
echo ""

echo "Done"

#!/bin/sh
set -e

CERT_DIR="/etc/nginx/certs"
KEY_PATH="$CERT_DIR/server.key"
CRT_PATH="$CERT_DIR/server.crt"

mkdir -p "$CERT_DIR"

if [ ! -f "$KEY_PATH" ] || [ ! -f "$CRT_PATH" ]; then
  openssl req -x509 -nodes -newkey rsa:2048 \
    -days 3650 \
    -keyout "$KEY_PATH" \
    -out "$CRT_PATH" \
    -subj "/CN=meeting-room.local"
fi

exec nginx -g 'daemon off;'

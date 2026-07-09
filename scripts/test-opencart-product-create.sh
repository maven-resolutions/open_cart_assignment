#!/bin/sh
set -e

OC_BASE="${OC_BASE:-http://127.0.0.1}"
OC_USER="${OC_USER:-unisouk-api}"
OC_KEY="${OC_KEY:?OC_KEY is required}"

LOGIN_JSON=$(curl -s -X POST "$OC_BASE/index.php?route=api/login" \
  -d "username=$OC_USER" \
  -d "key=$OC_KEY")

TOKEN=$(printf '%s' "$LOGIN_JSON" | sed -n 's/.*"api_token":"\([^"]*\)".*/\1/p')

if [ -z "$TOKEN" ]; then
  echo "Login failed: $LOGIN_JSON"
  exit 1
fi

MODEL="TEST-$(date +%s)"
CREATE_JSON=$(curl -s -X POST "$OC_BASE/index.php?route=api/unisouk/products/add&api_token=$TOKEN" \
  -d "name=UniSouk Test Product" \
  -d "model=$MODEL" \
  -d "price=19.99" \
  -d "quantity=5" \
  -d "status=1" \
  -d "description=Created via API test")

echo "$CREATE_JSON"

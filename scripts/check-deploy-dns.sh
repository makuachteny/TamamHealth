#!/usr/bin/env bash
# Verify staging/production DNS points at DO reserved IPs and HTTPS responds.
# Writes NDJSON evidence to .cursor/debug-6f298b.log when DEBUG_SESSION=6f298b.
set -euo pipefail

STAGING_IP="${STAGING_IP:-146.190.179.153}"
PRODUCTION_IP="${PRODUCTION_IP:-138.68.124.30}"
LOG="${DEBUG_LOG:-/Users/ikyalo/TamamHealth/.cursor/debug-6f298b.log}"
SESSION="${DEBUG_SESSION:-6f298b}"

log() {
  local hyp="$1" msg="$2" data="$3"
  printf '{"sessionId":"%s","timestamp":%s,"location":"check-deploy-dns.sh","message":"%s","data":%s,"hypothesisId":"%s","runId":"verify"}\n' \
    "$SESSION" "$(date +%s000)" "$msg" "$data" "$hyp" >> "$LOG"
}

check_a() {
  local host="$1" expected="$2"
  local got
  got="$(dig +short "$host" A | head -1 || true)"
  if [ "$got" = "$expected" ]; then
    echo "  OK  $host -> $got"
    log "A" "DNS OK" "{\"host\":\"$host\",\"ip\":\"$got\"}"
    return 0
  fi
  echo "  FAIL $host -> ${got:-<no record>} (expected $expected)"
  log "A" "DNS missing or wrong" "{\"host\":\"$host\",\"got\":\"${got:-}\",\"expected\":\"$expected\"}"
  return 1
}

fail=0
echo "=== TamamHealth deploy DNS check ==="
echo ""
echo "Staging (expected $STAGING_IP):"
check_a "app.staging.tamamhealth.org" "$STAGING_IP" || fail=$((fail+1))
check_a "couch.staging.tamamhealth.org" "$STAGING_IP" || fail=$((fail+1))
check_a "staging.tamamhealth.org" "$STAGING_IP" || fail=$((fail+1))
echo ""
echo "Production (expected $PRODUCTION_IP):"
check_a "app.tamamhealth.org" "$PRODUCTION_IP" || fail=$((fail+1))
check_a "couch.tamamhealth.org" "$PRODUCTION_IP" || fail=$((fail+1))
check_a "tamamhealth.org" "$PRODUCTION_IP" || fail=$((fail+1))

if [ "$fail" -eq 0 ]; then
  echo ""
  echo "DNS OK — probing HTTPS staging login..."
  code="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 15 https://app.staging.tamamhealth.org/login 2>/dev/null || echo 000)"
  echo "  HTTPS app.staging.tamamhealth.org/login -> $code"
  log "TLS" "HTTPS probe" "{\"url\":\"https://app.staging.tamamhealth.org/login\",\"http_code\":\"$code\"}"
  [ "$code" != "000" ] && [ "$code" != "000" ] || fail=$((fail+1))
fi

echo ""
if [ "$fail" -eq 0 ]; then
  echo "All checks passed."
  exit 0
fi
echo "$fail check(s) failed. Add GoDaddy A records — see infra/digitalocean/DNS-GODADDY.md"
exit 1

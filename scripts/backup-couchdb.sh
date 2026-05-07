#!/bin/sh
# CouchDB backup script — runs nightly from the couchdb-backup service.
# Dumps every tamamhealth_* database to gzipped JSON on the shared volume,
# then prunes anything older than BACKUP_RETAIN_DAYS.
set -eu

: "${COUCHDB_USER:?COUCHDB_USER required}"
: "${COUCHDB_PASSWORD:?COUCHDB_PASSWORD required}"
: "${COUCHDB_HOST:=couchdb}"
: "${COUCHDB_PORT:=5984}"
: "${BACKUP_RETAIN_DAYS:=14}"

BASE="http://${COUCHDB_USER}:${COUCHDB_PASSWORD}@${COUCHDB_HOST}:${COUCHDB_PORT}"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT="/backups/${STAMP}"
mkdir -p "$OUT"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] starting CouchDB backup → $OUT"

# Every tamamhealth_* db (clinical + meta + outbox + conflicts)
curl -sf "${BASE}/_all_dbs" \
  | jq -r '.[]' \
  | grep '^tamamhealth_' \
  | while read db; do
      echo "  dumping $db"
      curl -sf "${BASE}/${db}/_all_docs?include_docs=true" \
        | gzip -c > "${OUT}/${db}.json.gz"
    done

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] backup complete"

# Prune older snapshots
find /backups -maxdepth 1 -type d -name '20*' -mtime +${BACKUP_RETAIN_DAYS} -exec rm -rf {} + 2>/dev/null || true

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] retention cleanup done (kept ${BACKUP_RETAIN_DAYS}d)"

#!/usr/bin/env bash
# Daily dump of the database with rotation. Run from cron on the server, see docs of the deploy.
# Usage: infra/backup.sh [backup dir]  (default: ./backups next to compose.prod.yml)
set -euo pipefail

cd "$(dirname "$0")"
dir="${1:-./backups}"
keep_days="${BACKUP_KEEP_DAYS:-14}"
mkdir -p "$dir"

file="$dir/kotgambit-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
# -T: no terminal under cron. A half-written file is removed so that it is never mistaken for a backup
if ! docker compose -f compose.prod.yml exec -T postgres pg_dump -U kotgambit kotgambit | gzip > "$file"; then
  rm -f "$file"
  echo "backup failed" >&2
  exit 1
fi
chmod 600 "$file"

find "$dir" -name 'kotgambit-*.sql.gz' -mtime "+$keep_days" -delete
echo "saved $file"

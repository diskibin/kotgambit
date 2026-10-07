#!/usr/bin/env bash
# Daily dump of the database with rotation, and an encrypted copy in S3 when backup.env is there.
# Run from cron on the server. Usage: infra/backup.sh [backup dir]  (default: ./backups next to compose.prod.yml)
set -euo pipefail

cd "$(dirname "$0")"
dir="${1:-./backups}"
keep_days="${BACKUP_KEEP_DAYS:-14}"
mkdir -p "$dir"

# The keys of the storage and the passphrase live apart from the .env of the API, so that the API never sees them
if [ -f backup.env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./backup.env
  set +a
fi

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

if [ -z "${BACKUP_S3_BUCKET:-}" ]; then
  echo "BACKUP_S3_BUCKET is not set, no copy outside of the server" >&2
  exit 0
fi

# The dump holds emails and password hashes, so only an encrypted file leaves the server
: "${BACKUP_S3_ACCESS_KEY:?set in backup.env}" "${BACKUP_S3_SECRET_KEY:?set in backup.env}" "${BACKUP_PASSPHRASE:?set in backup.env}"
encrypted="$file.gpg"
trap 'rm -f "$encrypted"' EXIT
gpg --batch --yes --pinentry-mode loopback --passphrase-fd 3 --symmetric --cipher-algo AES256 \
  -o "$encrypted" "$file" 3<<<"$BACKUP_PASSPHRASE"

# rclone from its image, configured through the environment: nothing to install, and the keys are not in the process list
export RCLONE_CONFIG_S3_TYPE=s3
export RCLONE_CONFIG_S3_PROVIDER=Other
export RCLONE_CONFIG_S3_ENDPOINT="${BACKUP_S3_ENDPOINT:-https://s3.ru1.storage.beget.cloud}"
export RCLONE_CONFIG_S3_REGION="${BACKUP_S3_REGION:-ru1}"
export RCLONE_CONFIG_S3_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY"
export RCLONE_CONFIG_S3_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_KEY"
# The bucket is made in the panel and the keys may not create one: rclone must not try before an upload
export RCLONE_CONFIG_S3_NO_CHECK_BUCKET=true
rclone() {
  docker run --rm \
    -e RCLONE_CONFIG_S3_TYPE -e RCLONE_CONFIG_S3_PROVIDER -e RCLONE_CONFIG_S3_ENDPOINT -e RCLONE_CONFIG_S3_REGION \
    -e RCLONE_CONFIG_S3_ACCESS_KEY_ID -e RCLONE_CONFIG_S3_SECRET_ACCESS_KEY -e RCLONE_CONFIG_S3_NO_CHECK_BUCKET \
    -v "$(cd "$dir" && pwd):/backups:ro" rclone/rclone:1 "$@"
}

remote="S3:${BACKUP_S3_BUCKET}/kotgambit"
rclone copyto "/backups/$(basename "$encrypted")" "$remote/$(basename "$encrypted")"
echo "uploaded $(basename "$encrypted") to $BACKUP_S3_BUCKET"
rclone delete "$remote" --min-age "${BACKUP_REMOTE_KEEP_DAYS:-30}d"

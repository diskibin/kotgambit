#!/usr/bin/env bash
# Proves that a backup can be restored: loads it into a throwaway database and counts what is in it.
# Never touches the real database. Usage: infra/restore-check.sh <kotgambit-....sql.gz | ....sql.gz.gpg>
# For a .gpg file the passphrase is read from the BACKUP_PASSPHRASE variable or from backup.env
set -euo pipefail

backup="${1:?pass the backup file}"
cd "$(dirname "$0")"
if [ -f backup.env ] && [ -z "${BACKUP_PASSPHRASE:-}" ]; then
  set -a
  # shellcheck disable=SC1091
  . ./backup.env
  set +a
fi

work="$(mktemp -d)"
container="kotgambit-restore-check-$$"
cleanup() {
  docker rm -f "$container" > /dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

sql="$work/dump.sql.gz"
if [[ "$backup" == *.gpg ]]; then
  : "${BACKUP_PASSPHRASE:?the file is encrypted, set BACKUP_PASSPHRASE}"
  gpg --batch --yes --pinentry-mode loopback --passphrase-fd 3 --decrypt -o "$sql" "$backup" 3<<<"$BACKUP_PASSPHRASE"
else
  cp "$backup" "$sql"
fi

docker run -d --name "$container" -e POSTGRES_PASSWORD=restore-check -e POSTGRES_USER=kotgambit -e POSTGRES_DB=kotgambit \
  postgres:17-alpine > /dev/null
until docker exec "$container" pg_isready -U kotgambit -d kotgambit > /dev/null 2>&1; do sleep 1; done
# The first start of the image runs a temporary server: wait until the real one is up
sleep 3
until docker exec "$container" pg_isready -U kotgambit -d kotgambit > /dev/null 2>&1; do sleep 1; done

gunzip -c "$sql" | docker exec -i "$container" psql -U kotgambit -d kotgambit -v ON_ERROR_STOP=1 -q > /dev/null
for table in users lessons puzzles; do
  count="$(docker exec "$container" psql -U kotgambit -d kotgambit -tA -c "select count(*) from $table")"
  echo "$table: $count"
done
echo "restore ok"

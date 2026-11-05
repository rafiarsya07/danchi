#!/usr/bin/env bash
# Nightly Danchi backup for the mini PC.
#   crontab -e  ->  15 3 * * * /home/USER/danchi/scripts/backup.sh >> /home/USER/danchi-backup.log 2>&1
#
# 1. Dumps the database and the private uploads to $BACKUP_DIR (keeps 14 days, owner only files).
# 2. If RESTIC_REPOSITORY is set, also pushes an encrypted copy off the machine
#    (for example a Cloudflare R2 or Backblaze B2 bucket), so a dead mini PC
#    never means lost data.
set -euo pipefail

cd "$(dirname "$0")/.."
# Read only what we need from .env (sourcing it breaks on values with spaces)
getenv() { grep -E "^$1=" .env | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
DATABASE_URL="$(getenv DATABASE_URL)"
while IFS= read -r line; do export "${line%%=*}=$(echo "${line#*=}" | sed -e 's/^"//' -e 's/"$//')"; done \
  < <(grep -E '^(RESTIC_|AWS_|B2_|BACKUP_DIR=)' .env || true)

BACKUP_DIR="${BACKUP_DIR:-$HOME/danchi-backups}"
mkdir -p "$BACKUP_DIR" && chmod 700 "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M)"
FILE="$BACKUP_DIR/danchi-$STAMP.sql.gz"

pg_dump --no-owner --no-privileges "$DATABASE_URL" | gzip -9 > "$FILE"
echo "[$(date)] wrote $FILE ($(du -h "$FILE" | cut -f1))"

# Her private uploads (papers, notes, project files)
UPLOADS="$(getenv UPLOAD_DIR)"; UPLOADS="${UPLOADS:-$PWD/data/uploads}"
if [[ -d "$UPLOADS" ]]; then
  tar -czf "$BACKUP_DIR/danchi-files-$STAMP.tar.gz" -C "$(dirname "$UPLOADS")" "$(basename "$UPLOADS")"
  chmod 600 "$BACKUP_DIR/danchi-files-$STAMP.tar.gz"
  echo "[$(date)] wrote files backup"
fi
chmod 600 "$FILE"

find "$BACKUP_DIR" -name 'danchi-*.sql.gz' -mtime +14 -delete
find "$BACKUP_DIR" -name 'danchi-files-*.tar.gz' -mtime +14 -delete

if [[ -n "${RESTIC_REPOSITORY:-}" ]]; then
  restic backup "$BACKUP_DIR" --tag danchi --quiet
  restic forget --tag danchi --keep-daily 14 --keep-weekly 8 --keep-monthly 6 --prune --quiet
  echo "[$(date)] restic offsite copy done"
fi

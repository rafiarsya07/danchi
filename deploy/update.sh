#!/usr/bin/env bash
# Update Danchi on the mini PC after new code arrives (git pull or push-to-minipc.ps1).
#   bash deploy/update.sh
set -euo pipefail
cd "$(dirname "$0")/.."
[ -d .git ] && git pull --ff-only
npm ci --no-audit --no-fund
npm run db:migrate
npm run build
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save
echo "🍑 Danchi updated. pm2 logs danchi to watch."

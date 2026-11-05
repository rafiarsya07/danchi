#!/usr/bin/env bash
# =============================================================================
#  Danchi 🍑🌼  one-shot setup for the mini PC (Ubuntu / Debian)
#
#  Run it from the project folder:   bash deploy/setup-minipc.sh
#  Safe to run again any time: it only adds what's missing, then rebuilds and
#  restarts. (deploy/push-to-minipc.ps1 on the laptop copies the code here and
#  runs this for you.)
#
#  What it does:
#    1. Node.js 22, PostgreSQL, PM2 (installs only if missing)
#    2. .env with fresh secrets (asks for the two emails the first time)
#    3. Database user + database
#    4. npm ci, migrations (incl. realtime triggers), accounts, build
#    5. PM2: "danchi" (web) + "danchi-worker" (reminders, push, email), on boot
#    6. Cloudflare Tunnel: danchi.rafiarsya.com -> localhost:3100
#    7. Nightly backup (cron)
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
APP_DIR="$(pwd)"
DOMAIN="${DOMAIN:-danchi.rafiarsya.com}"

say()  { printf '\n\033[1;35m🍑 %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m   ✓ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m   ! %s\033[0m\n' "$*"; }
getenv() { grep -E "^$1=" .env 2>/dev/null | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' || true; }
setenv() { # setenv KEY VALUE  (adds or replaces a line in .env)
  if grep -qE "^$1=" .env; then
    KEY="$1" VAL="$2" node -e 'const fs=require("fs");const k=process.env.KEY,v=process.env.VAL;fs.writeFileSync(".env",fs.readFileSync(".env","utf8").split("\n").map(l=>l.startsWith(k+"=")?k+"="+v:l).join("\n"))'
  else
    printf '%s=%s\n' "$1" "$2" >> .env
  fi
}

# Windows line endings would break bash
sed -i 's/\r$//' deploy/*.sh scripts/*.sh 2>/dev/null || true

# Ask for the sudo password once, keep it warm while we work.
if ! sudo -n true 2>/dev/null; then
  say "Your mini PC password please (for sudo, used for the database and cloudflared)"
  sudo -v
fi
( while true; do sudo -n true 2>/dev/null; sleep 50; done ) &
SUDO_KEEPALIVE=$!
trap 'kill $SUDO_KEEPALIVE 2>/dev/null || true' EXIT

# Port: keep the one in .env; otherwise the first free one from 3110 up.
if [ -f .env ] && [ -n "$(getenv PORT)" ]; then
  PORT="$(getenv PORT)"
else
  PORT="${PORT:-3110}"
  while ss -ltn 2>/dev/null | grep -qE "[:.]${PORT}[[:space:]]"; do PORT=$((PORT + 10)); done
fi
ok "Danchi will listen on port ${PORT}"

# ---------------------------------------------------------------- 1. tools
say "Checking tools"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  say "Installing Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
ok "node $(node -v)"
if ! command -v psql >/dev/null; then
  say "Installing PostgreSQL"
  sudo apt-get update -y && sudo apt-get install -y postgresql
  sudo systemctl enable --now postgresql
fi
ok "$(psql --version)"
command -v pm2 >/dev/null || sudo npm i -g pm2
ok "pm2 $(pm2 -v)"
command -v openssl >/dev/null || sudo apt-get install -y openssl

# ---------------------------------------------------------------- 2. .env
if [ ! -f .env ]; then
  say "First time! Creating .env"
  OWNER_EMAIL="${OWNER_EMAIL:-vyraruka@gmail.com}"
  OWNER_NAME="${OWNER_NAME:-Adis}"
  VIEWER_EMAIL="${VIEWER_EMAIL:-rafiarsya.work@gmail.com}"
  VIEWER_NAME="${VIEWER_NAME:-Rafi}"
  echo "   owner: ${OWNER_EMAIL} (${OWNER_NAME}), viewer: ${VIEWER_EMAIL} (${VIEWER_NAME})"
  DB_PASS="$(openssl rand -hex 18)"
  cat > .env <<ENV
DATABASE_URL=postgres://danchi:${DB_PASS}@localhost:5432/danchi
BETTER_AUTH_SECRET=$(openssl rand -base64 36 | tr -d '\n/+=' | cut -c1-48)
BETTER_AUTH_URL=https://${DOMAIN}
APP_URL=https://${DOMAIN}
DANCHI_OWNER_EMAIL=${OWNER_EMAIL}
DANCHI_OWNER_NAME=${OWNER_NAME}
DANCHI_VIEWER_EMAIL=${VIEWER_EMAIL}
DANCHI_VIEWER_NAME=${VIEWER_NAME}
APP_TIMEZONE=Asia/Kuala_Lumpur
PORT=${PORT}

# Google sign in: the only way in. Only these emails are let through.
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET:-}
ALLOWED_EMAILS=${OWNER_EMAIL},${VIEWER_EMAIL}
ALLOW_PASSWORD_LOGIN=false

# Email (Gmail App Password, no spaces). Fill in, then: bash deploy/setup-minipc.sh
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
MAIL_FROM="Chichi from Danchi <${VIEWER_EMAIL}>"

# Ask Chichi (https://aistudio.google.com/apikey)
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-opus-5-5
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
GEMINI_FALLBACK_MODEL=gemini-3.5-flash-lite
AI_DAILY_LIMIT=40
ENV
  chmod 600 .env
  ok ".env created (chmod 600)"
else
  ok ".env already there, keeping it"
  # Production values, even if .env was copied from the laptop
  [ "$(getenv BETTER_AUTH_URL)" = "https://${DOMAIN}" ] || { setenv BETTER_AUTH_URL "https://${DOMAIN}"; warn "BETTER_AUTH_URL set to https://${DOMAIN}"; }
  [ "$(getenv APP_URL)" = "https://${DOMAIN}" ] || setenv APP_URL "https://${DOMAIN}"
fi

# Google sign in keys shipped from the laptop (deploy/.env.google)
if [ -f deploy/.env.google ]; then
  chmod 600 deploy/.env.google
  setenv GOOGLE_CLIENT_ID "$(grep '^GOOGLE_CLIENT_ID=' deploy/.env.google | cut -d= -f2-)"
  setenv GOOGLE_CLIENT_SECRET "$(grep '^GOOGLE_CLIENT_SECRET=' deploy/.env.google | cut -d= -f2-)"
  ok "Google sign in keys added"
fi

# Private uploads folder: only this user can read it
mkdir -p data/uploads && chmod 700 data data/uploads
chmod 600 .env

# ---------------------------------------------------------------- 3. deps
say "Installing packages"
npm ci --no-audit --no-fund
ok "packages ready"

# Push keys (once; changing them later means re-enabling notifications on every phone)
if [ -z "$(getenv VAPID_PUBLIC_KEY)" ]; then
  KEYS="$(npx tsx scripts/vapid.ts)"
  setenv VAPID_PUBLIC_KEY "$(echo "$KEYS" | grep PUBLIC | cut -d= -f2-)"
  setenv VAPID_PRIVATE_KEY "$(echo "$KEYS" | grep PRIVATE | cut -d= -f2-)"
  setenv VAPID_SUBJECT "mailto:$(getenv DANCHI_VIEWER_EMAIL)"
  ok "push keys generated"
fi

# ---------------------------------------------------------------- 4. database
say "Database"
read -r DB_USER DB_PASS DB_NAME DB_HOST < <(node -e '
  require("dotenv").config({ quiet: true });
  const u = new URL(process.env.DATABASE_URL);
  console.log(decodeURIComponent(u.username), decodeURIComponent(u.password), u.pathname.slice(1), u.hostname);')
if [ "$DB_HOST" = "localhost" ] || [ "$DB_HOST" = "127.0.0.1" ]; then
  if ! sudo -u postgres psql -tAc "select 1 from pg_roles where rolname='${DB_USER}'" | grep -q 1; then
    sudo -u postgres psql -qc "create user \"${DB_USER}\" with password '${DB_PASS}'"
    ok "created db user ${DB_USER}"
  else
    sudo -u postgres psql -qc "alter user \"${DB_USER}\" with password '${DB_PASS}'" >/dev/null
  fi
  if ! sudo -u postgres psql -tAc "select 1 from pg_database where datname='${DB_NAME}'" | grep -q 1; then
    sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
    ok "created database ${DB_NAME}"
  fi
fi
npm run db:migrate
ok "migrations applied (realtime triggers included)"
say "Accounts (you both sign in with Google)"
npm run seed
# Her name is Adis (older installs used "Sayang")
if [ "$(getenv DANCHI_OWNER_NAME)" = "Sayang" ]; then setenv DANCHI_OWNER_NAME Adis; fi
if [ "$DB_HOST" = "localhost" ] || [ "$DB_HOST" = "127.0.0.1" ]; then
  sudo -u postgres psql -d "${DB_NAME}" -qc "update \"user\" set name='Adis' where role='owner' and name='Sayang'" >/dev/null && ok "her name is Adis"
fi

# ---------------------------------------------------------------- 5. build + run
say "Building"
npm run build
say "Starting with PM2"
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save
if ! systemctl list-unit-files 2>/dev/null | grep -q "pm2-${USER}"; then
  sudo env PATH="$PATH:$(dirname "$(command -v node)")" "$(command -v pm2)" startup systemd -u "$USER" --hp "$HOME" >/dev/null && pm2 save
  ok "PM2 starts on boot"
fi
sleep 3
if curl -fsS -o /dev/null "http://localhost:${PORT}/login"; then ok "Danchi is up on http://localhost:${PORT}"; else warn "Danchi didn't answer yet. Check: pm2 logs danchi"; fi

# ---------------------------------------------------------------- 6. Cloudflare Tunnel
say "Cloudflare Tunnel (${DOMAIN})"
CF=""
for f in "$HOME/.cloudflared/config.yml" "$HOME/.cloudflared/config.yaml" /etc/cloudflared/config.yml /etc/cloudflared/config.yaml; do
  [ -f "$f" ] && { CF="$f"; break; }
done
if [ -z "$CF" ]; then
  warn "No cloudflared config found. Add this to your tunnel's ingress, then restart cloudflared:"
  echo "      - hostname: ${DOMAIN}"
  echo "        service: http://localhost:${PORT}"
elif grep -q "hostname: *${DOMAIN}" "$CF"; then
  ok "already routed in $CF"
else
  SUDO=""; [ -w "$CF" ] || SUDO="sudo"
  $SUDO cp "$CF" "$CF.bak-$(date +%s)"
  TMP="$(mktemp)"
  awk -v d="$DOMAIN" -v p="$PORT" '
    !done && /^[[:space:]]*-[[:space:]]*service:[[:space:]]*http_status:404/ {
      match($0, /^[[:space:]]*/); ind = substr($0, 1, RLENGTH);
      print ind "- hostname: " d; print ind "  service: http://localhost:" p; done = 1 }
    { print }
    END { if (!done) { print "  - hostname: " d; print "    service: http://localhost:" p } }' "$CF" > "$TMP"
  $SUDO cp "$TMP" "$CF" && rm -f "$TMP"
  ok "added ${DOMAIN} to $CF (backup saved next to it)"
  TUNNEL="$(grep -E '^tunnel:' "$CF" | awk '{print $2}')"
  if [ -n "$TUNNEL" ] && command -v cloudflared >/dev/null; then
    cloudflared tunnel route dns "$TUNNEL" "$DOMAIN" 2>&1 | tail -1 || warn "DNS route failed. In the Cloudflare dashboard add a CNAME ${DOMAIN} -> ${TUNNEL}.cfargotunnel.com"
  fi
  if systemctl list-units --type=service 2>/dev/null | grep -q cloudflared; then
    sudo systemctl restart cloudflared && ok "cloudflared restarted"
  elif pm2 describe cloudflared >/dev/null 2>&1; then
    pm2 restart cloudflared && ok "cloudflared restarted (pm2)"
  else
    warn "Restart cloudflared yourself so it picks up the new hostname."
  fi
fi

# ---------------------------------------------------------------- 7. backups
chmod +x scripts/backup.sh
if ! crontab -l 2>/dev/null | grep -q "danchi.*backup.sh"; then
  (crontab -l 2>/dev/null; echo "15 3 * * * ${APP_DIR}/scripts/backup.sh >> ${HOME}/danchi-backup.log 2>&1") | crontab -
  ok "nightly backup at 03:15 -> ~/danchi-backups (add RESTIC_* to .env for an offsite copy)"
fi

# ---------------------------------------------------------------- done
say "All done! 🌼"
echo "   Open https://${DOMAIN}"
[ -z "$(getenv GOOGLE_CLIENT_ID)" ] && warn "Google sign in is off: put GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in .env, then: pm2 startOrReload ecosystem.config.cjs --update-env"
[ -z "$(getenv GEMINI_API_KEY)$(getenv ANTHROPIC_API_KEY)" ] && warn "Ask Chichi is off: run  bash deploy/keys.sh"
[ -z "$(getenv SMTP_USER)" ] && warn "Email is off: fill SMTP_USER / SMTP_PASS in .env, then: pm2 startOrReload ecosystem.config.cjs --update-env"
echo "   Logs: pm2 logs danchi   |   pm2 logs danchi-worker"

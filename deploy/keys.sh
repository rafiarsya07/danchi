#!/usr/bin/env bash
# Turn on Ask Chichi (Claude and/or Gemini), SOS phone calls and email reminders. Run on the mini PC:
#   cd ~/danchi && bash deploy/keys.sh
# Paste each key when asked (nothing shows while you paste, that's on purpose).
# Press Enter to skip one. Keys go only into ~/danchi/.env (chmod 600).
set -euo pipefail
cd "$(dirname "$0")/.."
ok()   { printf '\033[1;32m   ✓ %s\033[0m\n' "$*"; }
setenv() {
  if grep -qE "^$1=" .env; then
    KEY="$1" VAL="$2" node -e 'const fs=require("fs");const k=process.env.KEY,v=process.env.VAL;fs.writeFileSync(".env",fs.readFileSync(".env","utf8").split("\n").map(l=>l.startsWith(k+"=")?k+"="+v:l).join("\n"))'
  else
    printf '%s=%s\n' "$1" "$2" >> .env
  fi
}

echo
echo "🍑 Ask Chichi, smartest brain (Claude, paid per use)"
echo "   Get a key at https://platform.claude.com (API keys), add a little credit, then paste it here."
read -rsp "   Claude API key (Enter to skip): " CLAUDEKEY; echo
if [ -n "$CLAUDEKEY" ]; then
  setenv ANTHROPIC_API_KEY "$CLAUDEKEY"
  echo "   Which Claude? 1) Opus 5.5, smartest (default)   2) Sonnet 5.5, about half the price"
  read -rp "   Choose 1 or 2: " PICK
  if [ "${PICK:-1}" = "2" ]; then setenv ANTHROPIC_MODEL claude-sonnet-5-5; else setenv ANTHROPIC_MODEL claude-opus-5-5; fi
  ok "Chichi now thinks with Claude (Gemini stays as backup)"
fi

echo
echo "🍑 Ask Chichi, free brain / backup (Gemini)"
echo "   Get a free key at https://aistudio.google.com/apikey (Create API key), then paste it here."
read -rsp "   Gemini API key (Enter to skip, keeps the old one): " GEMINI; echo
if [ -n "$GEMINI" ]; then setenv GEMINI_API_KEY "$GEMINI"; ok "Chichi's brain is plugged in"; fi

echo
echo "🍑 SOS phone calls (Twilio)"
echo "   When Adis presses SOS 3 times, Danchi really calls + texts these numbers."
echo "   Numbers, separated by commas (01... Malaysia, 08... Indonesia). Enter to keep the current ones."
read -rp "   SOS numbers: " SOSN
if [ -n "$SOSN" ]; then setenv SOS_NUMBERS "${SOSN// /}"; ok "SOS numbers saved"; fi
echo "   Calls need a Twilio account (twilio.com): Account SID, Auth Token and a Twilio phone number."
read -rp "   Twilio Account SID (Enter to skip): " TSID
if [ -n "$TSID" ]; then
  read -rsp "   Twilio Auth Token: " TTOK; echo
  read -rp  "   Twilio phone number (like +1...): " TFROM
  setenv TWILIO_ACCOUNT_SID "$TSID"
  setenv TWILIO_AUTH_TOKEN "$TTOK"
  setenv TWILIO_FROM "${TFROM// /}"
  ok "SOS can make real phone calls now"
fi

echo
echo "🍑 Spotify (songs list + search in Our music)"
echo "   1. developer.spotify.com/dashboard, Create app (needs a Spotify Premium account)"
echo "   2. Redirect URI: $(grep -E '^APP_URL=' .env | cut -d= -f2- | sed 's#/*$##')/api/spotify/callback"
echo "   3. Tick Web API, Save, then Settings: copy Client ID and Client secret"
read -rp "   Spotify Client ID (Enter to skip): " SPID
if [ -n "$SPID" ]; then
  read -rsp "   Spotify Client secret: " SPSEC; echo
  setenv SPOTIFY_CLIENT_ID "$SPID"
  setenv SPOTIFY_CLIENT_SECRET "$SPSEC"
  ok "Spotify keys saved. In Danchi open Our music and tap Connect Spotify"
fi

echo
read -rp "   Set up email reminders now? (y/N): " DOMAIL
if [ "${DOMAIL:-n}" != "y" ]; then
  chmod 600 .env
  pm2 startOrReload ecosystem.config.cjs --update-env >/dev/null && pm2 save >/dev/null
  ok "Danchi restarted with the new keys"
  exit 0
fi
echo "🍑 Email reminders (Gmail)"
echo "   Use a Gmail App Password, not your normal password:"
echo "   Google Account, Security, 2-Step Verification on, then search 'App passwords', create one called Danchi."
read -rp  "   Gmail address that sends the emails (Enter to skip): " SMTPU
if [ -n "$SMTPU" ]; then
  read -rsp "   16 letter App Password: " SMTPP; echo
  setenv SMTP_HOST smtp.gmail.com
  setenv SMTP_PORT 465
  setenv SMTP_USER "$SMTPU"
  setenv SMTP_PASS "${SMTPP// /}"
  setenv MAIL_FROM "Danchi <$SMTPU>"
  ok "email is on"
fi

chmod 600 .env
pm2 startOrReload ecosystem.config.cjs --update-env >/dev/null && pm2 save >/dev/null
ok "Danchi restarted with the new keys"

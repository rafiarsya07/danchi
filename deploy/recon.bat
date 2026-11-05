@echo off
title Danchi: checking the mini PC
cd /d "%~dp0.."
echo.
echo  Danchi is checking your mini PC (nothing gets changed).
echo  If it asks for a password, type your mini PC password and press Enter.
echo.
ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 user@100.77.41.4 "echo ==whoami; whoami; hostname; echo ==os; . /etc/os-release; echo $PRETTY_NAME; uname -m; echo ==tools; node -v 2>&1; npm -v 2>&1; psql --version 2>&1; pm2 -v 2>&1; cloudflared --version 2>&1; git --version 2>&1; echo ==pm2; pm2 ls 2>&1 | head -30; echo ==ports; ss -ltnp 2>/dev/null | awk '{print $4, $6}' | head -40; echo ==cloudflared; ls -la ~/.cloudflared /etc/cloudflared 2>&1; cat ~/.cloudflared/config.y*ml /etc/cloudflared/config.y*ml 2>/dev/null; systemctl is-active cloudflared 2>&1; systemctl list-units --type=service 2>/dev/null | grep -i -E 'cloudflared|postgres|pm2' ; echo ==disk; df -h / | tail -1; free -h | head -2; echo ==sudo; sudo -n true 2>&1 && echo SUDO_NOPASS || echo SUDO_NEEDS_PASSWORD; echo ==danchi; ls ~/danchi 2>&1 | head" > deploy\recon.log 2>&1
echo exit code %ERRORLEVEL% >> deploy\recon.log
type deploy\recon.log
echo.
echo  Done! You can close this window.
timeout /t 600

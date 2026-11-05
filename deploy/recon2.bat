@echo off
title Danchi: checking cloudflared
cd /d "%~dp0.."
ssh -o ConnectTimeout=20 user@100.77.41.4 "echo ==unit; systemctl cat cloudflared 2>/dev/null | grep -E 'ExecStart|User'; echo ==proc; for p in $(pgrep cloudflared); do ps -o user=,args= -p $p; done; echo ==dns; getent hosts tanahraya.rafiarsya.com | head -1; echo ==tunnels; cloudflared tunnel list 2>&1 | head -10; echo ==freeports; for p in 3110 3120 3130 3140; do ss -ltn | grep -q ":$p " && echo $p busy || echo $p free; done; echo ==tanah; curl -sI http://localhost:3100/ | head -1; echo ==pg; sudo -n -u postgres true 2>&1 | head -1; ls /var/run/postgresql/ 2>&1" > deploy\recon2.log 2>&1
echo exit %ERRORLEVEL% >> deploy\recon2.log
type deploy\recon2.log
timeout /t 300

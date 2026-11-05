@echo off
title Danchi: going live on danchi.rafiarsya.com
cd /d "%~dp0.."
set T=user@100.77.41.4
set S=deploy\golive.status
echo.
echo   Danchi is moving into your mini PC. This takes about 5 minutes.
echo   When it asks for a password, type your MINI PC password and press Enter.
echo   (the letters stay invisible while you type, that's normal)
echo.
echo [1/4] packing > %S%
if exist "%TEMP%\danchi-deploy.tgz" del "%TEMP%\danchi-deploy.tgz"
tar -czf "%TEMP%\danchi-deploy.tgz" --exclude=node_modules --exclude=.next --exclude=.env --exclude=*.tsbuildinfo --exclude=*.log --exclude=*.tmp --exclude=data --exclude=*.tgz . >> %S% 2>&1
echo [2/4] sending >> %S%
echo   Sending Danchi to the mini PC...
ssh -o ConnectTimeout=20 -o BatchMode=yes %T% "mkdir -p ~/danchi" >> %S% 2>&1
echo ssh mkdir exit %ERRORLEVEL% >> %S%
scp -o ConnectTimeout=20 -o BatchMode=yes "%TEMP%\danchi-deploy.tgz" %T%:danchi/danchi-deploy.tgz >> %S% 2>&1
echo scp exit %ERRORLEVEL% >> %S%
echo [3/4] setting up >> %S%
echo   Setting up on the mini PC...
ssh -t %T% "cd ~/danchi && tar -xzf danchi-deploy.tgz && rm danchi-deploy.tgz && sed -i 's/\r$//' deploy/*.sh scripts/*.sh && script -q -e -c 'bash deploy/setup-minipc.sh' deploy-setup.log"
echo setup exit %ERRORLEVEL% >> %S%
scp -o BatchMode=yes %T%:danchi/deploy-setup.log deploy\setup.log >> %S% 2>&1
echo [4/4] done >> %S%
echo.
echo   Finished! You can close this window.
timeout /t 1800

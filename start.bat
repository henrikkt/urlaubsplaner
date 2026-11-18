@echo off
rem Urlaubsplaner im Server-Modus starten: baut das Frontend, startet den Server und oeffnet den Browser.
chcp 65001 >nul
cd /d "%~dp0"
title Urlaubsplaner

where node >nul 2>nul
if errorlevel 1 (
  if exist "C:\Program Files\nodejs\node.exe" (
    set "PATH=C:\Program Files\nodejs;%PATH%"
  ) else (
    echo.
    echo   Node.js wurde nicht gefunden. Bitte von https://nodejs.org die LTS-Version installieren.
    echo.
    pause
    exit /b 1
  )
)

if not exist "node_modules\" (
  echo   Erster Start: Pakete werden installiert ...
  call npm install --no-fund --no-audit
  if errorlevel 1 (
    echo   npm install ist fehlgeschlagen.
    pause
    exit /b 1
  )
)

set OPEN_BROWSER=1
call npm run start
echo.
echo   Server wurde beendet.
pause

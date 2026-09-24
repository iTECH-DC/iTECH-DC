@echo off
setlocal
cd /d "%~dp0"
title ALICE OS - Diagnostics
color 0B

echo ============================================================
echo                 ALICE OS LOCAL DIAGNOSTICS
echo ============================================================
echo.

where py >nul 2>&1
if not errorlevel 1 (echo [PASS] Python launcher detected.) else (
  where python >nul 2>&1
  if not errorlevel 1 (echo [PASS] Python detected.) else echo [FAIL] Python not detected.
)

if exist run_alice.py (echo [PASS] Backend present.) else echo [FAIL] run_alice.py missing.
if exist ui\index.html (echo [PASS] UI present.) else echo [FAIL] UI missing.
if exist native\build\alice-init (echo [PASS] Native init present.) else echo [WARN] Native init not built.
if exist rootfs\etc\os-release (echo [PASS] Alice rootfs metadata present.) else echo [WARN] Rootfs metadata missing.

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r=Invoke-RestMethod -Uri 'http://127.0.0.1:8765/api/health' -TimeoutSec 2; Write-Host ('[PASS] Alice service: ' + $r.version) } catch { Write-Host '[INFO] Alice service is not currently running.' }"

echo.
echo.
echo Running automated local integration test...
where python >nul 2>&1
if not errorlevel 1 python tools\self_test.py

echo For a full startup test, run START_ALICE.bat.
echo.
pause

@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title ALICE OS - Start
color 0B

set "URL=http://127.0.0.1:8765"
set "HEALTH=%URL%/api/health"
set "LOGDIR=%~dp0logs"
if not exist "%LOGDIR%" mkdir "%LOGDIR%" >nul 2>&1

cls
echo.
echo ============================================================
echo                         ALICE OS 9.5
echo                       START ALICE
echo ============================================================
echo.

REM If Alice is already running, do not start a second server.
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r=Invoke-RestMethod -Uri '%HEALTH%' -TimeoutSec 2; if($r.ready -eq $true){exit 0}else{exit 1} } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 goto :already_ready

set "PY="
where py >nul 2>&1
if not errorlevel 1 set "PY=py"
if not defined PY (
  where python >nul 2>&1
  if not errorlevel 1 set "PY=python"
)
if not defined PY (
  echo ERROR: Python was not found.
  echo Install Python 3.11+ and run INSTALL_ALL.bat if needed.
  pause
  exit /b 1
)

if not exist "%~dp0run_alice.py" (
  echo ERROR: run_alice.py is missing.
  pause
  exit /b 1
)
if not exist "%~dp0ui\index.html" (
  echo ERROR: ui\index.html is missing.
  pause
  exit /b 1
)

set "PYEXE=%PY%"
if "%PY%"=="py" set "PYEXE=py -3"

echo Starting Alice OS local service...
start "ALICE OS Backend" /min cmd /c "cd /d "%~dp0" ^& %PYEXE% run_alice.py --no-browser ^> "%LOGDIR%\alice.log" 2^>^&1"

echo Waiting for Alice OS to become ready...
set "READY=0"
for /L %%N in (1,1,30) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r=Invoke-RestMethod -Uri '%HEALTH%' -TimeoutSec 1; if($r.ready -eq $true){exit 0}else{exit 1} } catch { exit 1 }" >nul 2>&1
  if not errorlevel 1 (
    set "READY=1"
    goto :ready
  )
  timeout /t 1 /nobreak >nul
)

:ready
if "%READY%"=="1" goto :open

echo.
echo ERROR: Alice OS did not become ready within 30 seconds.
echo.
echo The backend log is:
echo   %LOGDIR%\alice.log
echo.
if exist "%LOGDIR%\alice.log" type "%LOGDIR%\alice.log"
echo.
pause
exit /b 1

:already_ready
echo Alice OS is already running. No duplicate server will be started.

:open
echo Alice OS is ready.
start "" "%URL%"
echo.
echo Alice OS: %URL%
echo Network access: OFF by default
echo Server binding: 127.0.0.1 only
echo.
exit /b 0

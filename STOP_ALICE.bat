@echo off
setlocal
cd /d "%~dp0"
title ALICE OS - Stop
set "PIDFILE=%~dp0data\alice.pid"
if not exist "%PIDFILE%" (
  echo Alice OS is not running, or its PID file is missing.
  exit /b 0
)
set /p PID=<"%PIDFILE%"
for /f "delims=0123456789" %%A in ("%PID%") do set "PID="
if not defined PID (
  del /q "%PIDFILE%" >nul 2>&1
  echo Invalid PID file cleaned.
  exit /b 1
)

echo Stopping Alice OS process %PID%...
set "IMAGE="
for /f "tokens=1,2 delims=," %%A in ('wmic process where (ProcessId=%PID%) get Name,ProcessId /format:csv 2^>nul') do set "IMAGE=%%B"
if defined IMAGE (
  echo Detected process: %IMAGE%
)
taskkill /PID %PID% /T /F >nul 2>&1
if errorlevel 1 (
  echo Process was already stopped or could not be found.
) else (
  echo Alice OS stopped.
)
del /q "%PIDFILE%" >nul 2>&1
exit /b 0

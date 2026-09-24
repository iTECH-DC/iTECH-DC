@echo off
setlocal
cd /d "%~dp0"
title ALICE OS 9.5 - Build / Test
color 0B

echo ============================================================
echo                 ALICE OS 9.5 BUILD CENTER
echo ============================================================
echo.

echo [1/4] Checking Windows Python environment...
where python >nul 2>&1
if errorlevel 1 (
  echo Python was not found. This step is optional for the native ISO build.
) else (
  python -m py_compile run_alice.py
  if errorlevel 1 goto :fail
  echo Python syntax: OK
)

echo.
echo [2/4] Checking WSL...
where wsl >nul 2>&1
if errorlevel 1 (
  echo WSL is not installed or not available.
  echo Install WSL, then run this file again to build the native ISO.
  goto :done
)

echo.
echo [3/4] Running native build checks in WSL...
wsl bash -lc "cd \"$(wsl wslpath -a '%~dp0')\" && ./tools/check_iso_tools.sh && ./tools/kernel_prepare.sh && ./tools/test_native.sh"
if errorlevel 1 goto :fail

echo.
echo [4/4] Building ISO in WSL...
wsl bash -lc "cd \"$(wsl wslpath -a '%~dp0')\" && ./tools/build_iso.sh"
if errorlevel 1 (
  echo ISO build tools are missing. Install grub-mkrescue and xorriso in WSL.
  goto :done
)

echo.
echo BUILD COMPLETE.
echo.
goto :done

:fail
echo.
echo BUILD CHECK FAILED. Review the message above.

:done
pause
exit /b 0

@echo off
setlocal
python -m pip install --upgrade pip
if exist requirements.txt python -m pip install -r requirements.txt
if exist requirements-optional.txt python -m pip install -r requirements-optional.txt
echo.
echo Alice OS dependencies installed.
pause

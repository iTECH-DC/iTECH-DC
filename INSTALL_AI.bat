@echo off
setlocal
cd /d "%~dp0"
python -m pip install -r requirements-ai.txt
if errorlevel 1 echo Optional SDK installation failed. The built-in stdlib adapters still work.
echo.
echo Configure API keys as environment variables (do not put keys in Alice files):
echo   setx OPENAI_API_KEY "YOUR_KEY"
echo   setx ANTHROPIC_API_KEY "YOUR_KEY"
echo Then start Alice and enable Network AI in Intelligence Core.
pause

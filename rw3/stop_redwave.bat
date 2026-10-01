@echo off
taskkill /FI "WINDOWTITLE eq RedWave Server*" /T /F >nul 2>nul
echo RedWave server stopped.
pause

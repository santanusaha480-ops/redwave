@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  start "RedWave Server" /min py -m http.server 5500
) else (
  where python >nul 2>nul
  if %errorlevel%==0 (
    start "RedWave Server" /min python -m http.server 5500
  ) else (
    echo Python was not found.
    echo Install Python from https://www.python.org/downloads/ and try again.
    pause
    exit /b 1
  )
)
timeout /t 2 /nobreak >nul
start "" "http://localhost:5500/index.html"
echo RedWave is running at http://localhost:5500

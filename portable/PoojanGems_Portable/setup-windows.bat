@echo off
setlocal EnableDelayedExpansion
title Poojan Gems - First Time Setup
color 0B

echo ==========================================
echo   Poojan Gems - First Time Setup
echo   Run this ONCE on a new computer.
echo ==========================================
echo.

set "APP_DIR=%~dp0"
cd /d "%APP_DIR%"

REM -- Check if embedded Python already exists --
if exist "%APP_DIR%python\python.exe" (
    echo [OK] Embedded Python already exists.
    goto setup_deps
)

echo [SETUP] Downloading Python 3.11 (no install needed, ~25 MB)...
echo         Please wait...
echo.

powershell -Command "& { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip' -OutFile '%APP_DIR%python-embed.zip' }"

if not exist "%APP_DIR%python-embed.zip" (
    echo [ERROR] Download failed. Check your internet connection.
    pause
    exit /b 1
)

echo [SETUP] Extracting Python...
powershell -Command "Expand-Archive -Path '%APP_DIR%python-embed.zip' -DestinationPath '%APP_DIR%python' -Force"
del "%APP_DIR%python-embed.zip"

REM -- Enable pip in embedded Python --
powershell -Command "(Get-Content '%APP_DIR%python\python311._pth') -replace '#import site','import site' | Set-Content '%APP_DIR%python\python311._pth'"

REM -- Download and install pip --
echo [SETUP] Installing pip...
powershell -Command "& { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile '%APP_DIR%get-pip.py' }"
"%APP_DIR%python\python.exe" "%APP_DIR%get-pip.py" --no-warn-script-location
del "%APP_DIR%get-pip.py"

echo [OK] Embedded Python installed.
echo.

:setup_deps

REM -- Install app dependencies --
echo [SETUP] Installing app dependencies (1-2 minutes)...
"%APP_DIR%python\python.exe" -m pip install -q --no-cache-dir -r "%APP_DIR%backend\requirements-windows.txt" --no-warn-script-location

REM -- Clean up pip cache to save disk space --
"%APP_DIR%python\python.exe" -m pip cache purge >nul 2>&1

REM -- Create data directory --
if not exist "%APP_DIR%data" mkdir "%APP_DIR%data"

echo.
echo ==========================================
echo   Setup complete!
echo   Now double-click start.bat to run.
echo ==========================================
echo.
pause
endlocal

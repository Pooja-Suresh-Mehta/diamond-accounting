@echo off
setlocal
title Building Poojan Gems .exe

echo ==========================================
echo   Building PoojanGems.exe
echo   This takes 2-3 minutes...
echo ==========================================
echo.

set "APP_DIR=%~dp0"
cd /d "%APP_DIR%"

REM -- Find Python --
set "PYTHON="
if exist "%APP_DIR%python\python.exe" (
    set "PYTHON=%APP_DIR%python\python.exe"
) else (
    set "PYTHON=python"
)

REM -- Install build dependencies --
echo [1/3] Installing build tools...
"%PYTHON%" -m pip install -q pyinstaller pystray pillow --no-warn-script-location

REM -- Build .exe --
echo [2/3] Building executable...
"%PYTHON%" -m PyInstaller --onefile --noconsole --name "PoojanGems" --icon NONE launcher.py

REM -- Copy to output --
echo [3/3] Packaging...
if exist "dist\PoojanGems.exe" (
    copy /y "dist\PoojanGems.exe" "%APP_DIR%PoojanGems.exe" >nul
    echo.
    echo ==========================================
    echo   SUCCESS! PoojanGems.exe is ready.
    echo   Copy it alongside backend/ and data/
    echo ==========================================
) else (
    echo.
    echo [ERROR] Build failed. Check errors above.
)

REM -- Cleanup build artifacts --
rmdir /s /q build 2>nul
rmdir /s /q dist 2>nul
del PoojanGems.spec 2>nul

echo.
pause
endlocal

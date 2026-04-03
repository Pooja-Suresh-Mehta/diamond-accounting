@echo off
setlocal EnableDelayedExpansion
title Poojan Gems - Diamond Accounting
color 0A

echo ==========================================
echo   Poojan Gems - Diamond Accounting
echo ==========================================
echo.

set "APP_DIR=%~dp0"
cd /d "%APP_DIR%"

REM -- Local backup folder on C drive --
set "LOCAL_BACKUP=C:\PoojanGems_Backup"
if not exist "%LOCAL_BACKUP%" mkdir "%LOCAL_BACKUP%"

REM -- Create data folder --
if not exist "%APP_DIR%data" mkdir "%APP_DIR%data"

REM -- Backup existing DB before starting --
if exist "%APP_DIR%data\diamond_accounting.db" (
    echo [BACKUP] Saving database to local backup...
    set "STAMP=%date:~10,4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
    set "STAMP=!STAMP: =0!"
    copy /y "%APP_DIR%data\diamond_accounting.db" "%LOCAL_BACKUP%\backup_!STAMP!.db" >nul 2>&1
    echo [OK] Backup saved to %LOCAL_BACKUP%
    echo.
)

REM -- Find Python --
set "PYTHON="

if exist "%APP_DIR%python\python.exe" (
    set "PYTHON=%APP_DIR%python\python.exe"
    echo [OK] Using portable Python.
    goto check_deps
)

python --version >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=*" %%v in ('python --version 2^>^&1') do set "PYVER=%%v"
    echo !PYVER! | findstr /i "Python 3" >nul 2>&1
    if !errorlevel! equ 0 (
        echo [OK] Using system Python: !PYVER!
        if not exist "%APP_DIR%backend\venv\Scripts\python.exe" (
            echo [SETUP] Creating virtual environment...
            python -m venv "%APP_DIR%backend\venv"
            if not exist "%APP_DIR%backend\venv\Scripts\python.exe" (
                echo [ERROR] Failed to create virtual environment.
                goto end
            )
            echo [SETUP] Installing dependencies...
            "%APP_DIR%backend\venv\Scripts\pip.exe" install -q -r "%APP_DIR%backend\requirements.txt"
        )
        set "PYTHON=%APP_DIR%backend\venv\Scripts\python.exe"
        goto check_deps
    )
)

echo [ERROR] Python not found. Run setup-windows.bat first.
goto end

:check_deps

echo [CHECK] Python version:
"!PYTHON!" --version
echo.

REM -- Write .env before any app imports --
echo SECRET_KEY=poojan-gems-portable-secret-2025> "%APP_DIR%backend\.env"
echo DATABASE_URL=sqlite+aiosqlite:///%APP_DIR%data\diamond_accounting.db>> "%APP_DIR%backend\.env"
set "SECRET_KEY=poojan-gems-portable-secret-2025"
set "DATABASE_URL=sqlite+aiosqlite:///%APP_DIR%data\diamond_accounting.db"

echo [CHECK] Testing uvicorn import...
"!PYTHON!" -c "import uvicorn; print('  uvicorn OK')"
if !errorlevel! neq 0 (
    echo [SETUP] Installing dependencies...
    "!PYTHON!" -m pip install -r "%APP_DIR%backend\requirements.txt" --no-warn-script-location
    "!PYTHON!" -c "import uvicorn" >nul 2>&1
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install dependencies.
        goto end
    )
)

echo [CHECK] Testing app import...
"!PYTHON!" -c "import sys; sys.path.insert(0, r'%APP_DIR%backend'); from app.main import app; print('  app OK')"
if !errorlevel! neq 0 (
    echo [ERROR] App failed to load. See error above.
    goto end
)

echo.
echo ==========================================
echo   App starting at http://localhost:8000
echo   Login:
echo     Company:  Diamond Accounting
echo     Username: admin
echo     Password: Poojan@2025
echo.
echo   Close this window to stop the app.
echo ==========================================
echo.

start "" cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:8000"

echo [START] Launching server...
echo.
"!PYTHON!" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --app-dir "%APP_DIR%backend"
echo.
echo [INFO] Server exited with code: !errorlevel!

:end
echo.
echo ==========================================
echo   Press any key to close this window.
echo ==========================================
pause >nul
endlocal

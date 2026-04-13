@echo off
title Poojan Gems - Cleanup
color 0E

echo ==========================================
echo   Poojan Gems - Cleanup Utility
echo   Frees up disk space by removing cache,
echo   temp files, and compiled Python files.
echo ==========================================
echo.

set "APP_DIR=%~dp0"
cd /d "%APP_DIR%"

REM -- Remove Python __pycache__ folders --
echo [CLEANUP] Removing __pycache__ folders...
for /d /r "%APP_DIR%backend" %%d in (__pycache__) do (
    if exist "%%d" (
        rd /s /q "%%d"
        echo   Removed: %%d
    )
)

REM -- Remove compiled .pyc files --
echo [CLEANUP] Removing .pyc files...
del /s /q "%APP_DIR%backend\*.pyc" >nul 2>&1

REM -- Remove pip cache --
echo [CLEANUP] Clearing pip cache...
if exist "%APP_DIR%python\python.exe" (
    "%APP_DIR%python\python.exe" -m pip cache purge >nul 2>&1
    echo   pip cache cleared.
)

REM -- Remove log files older than 7 days --
echo [CLEANUP] Removing old log files...
forfiles /p "%APP_DIR%" /s /m *.log /d -7 /c "cmd /c del @path" >nul 2>&1

REM -- Remove any leftover .tmp files --
del /s /q "%APP_DIR%*.tmp" >nul 2>&1

echo.
echo ==========================================
echo   Cleanup complete!
echo ==========================================
echo.
pause

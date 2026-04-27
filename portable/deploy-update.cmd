@echo off
setlocal EnableDelayedExpansion
title Poojan Gems - Deploy Update
color 0A

echo ==========================================
echo   Poojan Gems - Deploy Update
echo ==========================================
echo.

set "DRIVE=D:"
set "APP_NAME=PoojanGems_Portable"
set "APP_DIR=%DRIVE%\%APP_NAME%"
set "OLD_DIR=%DRIVE%\%APP_NAME%OLD"
set "ZIP_DEST=%DRIVE%\%APP_NAME%.zip"

REM -- Pre-flight: zip must exist before we touch anything --
if not exist "%ZIP_DEST%" (
    echo [ERROR] %ZIP_DEST% not found. Copy the zip to D:\ first.
    goto fail
)

REM -- Step 1: Remove leftover OLD folder from a previous run --
REM    Guard: only delete OLD if python was already successfully copied out last time,
REM    OR if a fresh APP_DIR already exists (meaning last run completed).
if exist "%OLD_DIR%" (
    if exist "%APP_DIR%\python" (
        echo [CLEANUP] Removing leftover %OLD_DIR% (python already in new install)...
        rmdir /s /q "%OLD_DIR%"
        if exist "%OLD_DIR%" (
            echo [ERROR] Could not remove %OLD_DIR%. Close any open files and retry.
            goto fail
        )
    ) else (
        echo [WARN] Leftover %OLD_DIR% found but %APP_DIR%\python is missing.
        echo        Previous deploy may have failed mid-copy. Reusing OLD python.
        REM Do NOT delete OLD yet - we still need its python.
        REM If APP_DIR also exists, remove it so rename below works cleanly.
        if exist "%APP_DIR%" (
            echo [CLEANUP] Removing incomplete %APP_DIR%...
            rmdir /s /q "%APP_DIR%"
        )
    )
)

REM -- Step 2: Rename current app to OLD --
if exist "%APP_DIR%" (
    echo [1/7] Renaming %APP_DIR% to %OLD_DIR%...
    ren "%APP_DIR%" "%APP_NAME%OLD"
    if !errorlevel! neq 0 (
        echo [ERROR] Rename failed. Make sure no files are open from the app folder.
        goto fail
    )
    echo [OK] Renamed.
) else (
    echo [INFO] No existing %APP_DIR% found. Fresh install.
)
echo.

REM -- Step 3: Extract zip --
echo [2/7] Extracting %ZIP_DEST%...
powershell -NoProfile -Command "Expand-Archive -Path '%ZIP_DEST%' -DestinationPath '%DRIVE%\' -Force"
if !errorlevel! neq 0 (
    echo [ERROR] Extraction failed.
    if exist "%OLD_DIR%" (
        echo [ROLLBACK] Restoring previous installation...
        if exist "%APP_DIR%" rmdir /s /q "%APP_DIR%"
        ren "%OLD_DIR%" "%APP_NAME%"
        echo [ROLLBACK] Restored. Your old installation is intact.
    )
    goto fail
)
if not exist "%APP_DIR%" (
    echo [ERROR] Expected %APP_DIR% after extraction but folder not found.
    echo         Make sure the zip contains a %APP_NAME% folder at the root.
    if exist "%OLD_DIR%" (
        echo [ROLLBACK] Restoring previous installation...
        ren "%OLD_DIR%" "%APP_NAME%"
    )
    goto fail
)
echo [OK] Extracted.
echo.

REM -- Step 4: Copy data from OLD --
if exist "%OLD_DIR%\data" (
    echo [3/7] Copying data from old installation...
    robocopy "%OLD_DIR%\data" "%APP_DIR%\data" /e /is /it /njh /njs /nfl /ndl >nul
    echo [OK] Data copied.
) else (
    echo [3/7] No old data folder found. Skipping.
)
echo.

REM -- Step 5: Run cleanup in OLD folder to remove cache before copying python --
if exist "%OLD_DIR%\cleanup.bat" (
    echo [4/7] Cleaning up old Python folder for faster copy...
    cd /d "%OLD_DIR%"
    call cleanup.bat nopause >nul 2>&1
    cd /d "%~dp0"
    echo [OK] Cleanup complete.
) else (
    echo [4/7] No cleanup.bat found. Skipping cleanup.
)
echo.

REM -- Step 6: Copy python folder from OLD --
REM    robocopy exit codes 0-7 all indicate success (not an error).
if exist "%OLD_DIR%\python" (
    echo [5/7] Copying embedded Python from old installation...
    robocopy "%OLD_DIR%\python" "%APP_DIR%\python" /e /is /it /njh /njs /nfl /ndl >nul
    if not exist "%APP_DIR%\python\python.exe" (
        echo [ERROR] Python copy appears incomplete - python.exe missing from destination.
        goto fail
    )
    echo [OK] Python copied.
) else (
    echo [5/7] No old python folder found. Skipping.
)
echo.

REM -- Step 7: Delete OLD folder --
echo [6/7] Deleting old installation...
rmdir /s /q "%OLD_DIR%"
if exist "%OLD_DIR%" (
    echo [WARN] Could not fully delete %OLD_DIR%. You can manually remove it later.
) else (
    echo [OK] Old installation deleted.
)
echo.

REM -- Step 7b: Clean up zip from D:\ --
del /q "%ZIP_DEST%" >nul 2>&1

REM -- Step 8: Run build-exe.bat --
if exist "%APP_DIR%\build-exe.bat" (
    echo [7/7] Running build-exe.bat...
    echo.
    cd /d "%APP_DIR%"
    call build-exe.bat
) else (
    echo [7/7] build-exe.bat not found in %APP_DIR%. Skipping.
)

echo.
echo ==========================================
echo   Deploy complete!
echo ==========================================
goto done

:fail
echo.
echo ==========================================
echo   Deploy FAILED. See errors above.
echo ==========================================

:done
echo.
pause
endlocal

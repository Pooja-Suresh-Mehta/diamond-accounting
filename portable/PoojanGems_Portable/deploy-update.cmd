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
set "ZIP_SRC=C:\%APP_NAME%.zip"
set "ZIP_DEST=%DRIVE%\%APP_NAME%.zip"

REM -- Step 0: Verify the zip exists --
if not exist "%ZIP_SRC%" (
    echo [ERROR] %ZIP_SRC% not found.
    echo         Download the latest zip to C:\ first.
    goto fail
)

REM -- Step 1: Remove leftover OLD folder from a previous run --
if exist "%OLD_DIR%" (
    echo [CLEANUP] Removing leftover %OLD_DIR%...
    rmdir /s /q "%OLD_DIR%"
    if exist "%OLD_DIR%" (
        echo [ERROR] Could not remove %OLD_DIR%. Close any open files and retry.
        goto fail
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

REM -- Step 3: Copy zip to D:\ --
echo [2/7] Copying %ZIP_SRC% to %DRIVE%\...
copy /y "%ZIP_SRC%" "%ZIP_DEST%" >nul
if !errorlevel! neq 0 (
    echo [ERROR] Copy failed.
    goto fail
)
echo [OK] Zip copied.
echo.

REM -- Step 4: Extract zip --
echo [3/7] Extracting %ZIP_DEST%...
powershell -NoProfile -Command "Expand-Archive -Path '%ZIP_DEST%' -DestinationPath '%DRIVE%\' -Force"
if !errorlevel! neq 0 (
    echo [ERROR] Extraction failed. Is PowerShell available?
    goto fail
)
if not exist "%APP_DIR%" (
    echo [ERROR] Expected %APP_DIR% after extraction but folder not found.
    echo         Make sure the zip contains a %APP_NAME% folder at the root.
    goto fail
)
echo [OK] Extracted.
echo.

REM -- Step 5: Copy data from OLD --
if exist "%OLD_DIR%\data" (
    echo [4/7] Copying data from old installation...
    if not exist "%APP_DIR%\data" mkdir "%APP_DIR%\data"
    xcopy /s /e /y /q "%OLD_DIR%\data\*" "%APP_DIR%\data\" >nul
    echo [OK] Data copied.
) else (
    echo [4/7] No old data folder found. Skipping.
)
echo.

REM -- Step 6: Copy python folder from OLD --
if exist "%OLD_DIR%\python" (
    echo [5/7] Copying embedded Python from old installation...
    xcopy /s /e /y /q "%OLD_DIR%\python\*" "%APP_DIR%\python\" >nul
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

REM -- Step 8: Clean up zip from D:\ --
del /q "%ZIP_DEST%" >nul 2>&1

REM -- Step 9: Run build-exe.bat --
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

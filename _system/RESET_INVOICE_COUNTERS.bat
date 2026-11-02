```bat
@echo off
setlocal
cd /d "%~dp0"

set "PORT=47391"

if exist "data\port.txt" (
    set /p PORT=<"data\port.txt"
)

echo ==========================================
echo SD Dynamics - Reset Document Counters
echo ==========================================
echo.
echo Server port: %PORT%
echo This will reset counters only.
echo It will NOT delete invoices, bills, POs, or WOs.
echo.
choice /C YN /M "Are you sure you want to reset counters"
if errorlevel 2 goto :cancel

echo.
echo Sending reset request...

curl --fail-with-body -sS -X POST "http://127.0.0.1:%PORT%/api/meta/resetCounters"

if errorlevel 1 (
    echo.
    echo ERROR: Reset request failed.
    echo Check whether the SD Dynamics server is running.
    pause
    exit /b 1
)

echo.
echo Reset request completed.
echo Please verify the counters in SD Dynamics.
pause
exit /b 0

:cancel
echo.
echo Reset cancelled.
pause
exit /b 0
```
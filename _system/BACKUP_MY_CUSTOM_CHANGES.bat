@echo off
title Backup Free-GST-Billing Custom Changes
echo.
echo  Creating backup of your customized Free-GST-Billing folder...
echo.

set "SRC=%~dp0"
set "STAMP=%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "STAMP=%STAMP: =0%"
set "DEST=%USERPROFILE%\Desktop\FreeGSTBill_Custom_Backup_%STAMP%"

mkdir "%DEST%" 2>nul

echo  Copying entire project to:
echo  %DEST%
echo.

xcopy "%SRC%*." "%DEST%\" /E /I /H /Y /Q

echo.
echo  DONE.
echo  Your backup is on the Desktop:
echo  FreeGSTBill_Custom_Backup_%STAMP%
echo.
echo  Keep this folder safe. Do not run the official updater
echo  on the original folder if you want to keep Work Orders.
echo.
pause

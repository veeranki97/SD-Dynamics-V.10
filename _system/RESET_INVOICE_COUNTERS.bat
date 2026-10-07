@echo off
echo Resets invoice/PO/WO sequence counters in data\meta.json to 0
echo Does NOT delete bills. Delete data\bills\*.json yourself if you want a clean test.
echo.
curl -s -X POST http://127.0.0.1:47388/api/meta/resetCounters
echo.
echo If port is not 47371, edit this file or open data\port.txt
pause

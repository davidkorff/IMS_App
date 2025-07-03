@echo off
echo Killing all Node.js processes on port 5000...
echo.

REM Find and kill processes on port 5000
FOR /F "tokens=5" %%a IN ('netstat -aon ^| findstr :5000') DO (
    echo Killing process ID: %%a
    taskkill /F /PID %%a 2>nul
)

echo.
echo Also killing all node.exe processes...
taskkill /F /IM node.exe 2>nul

echo.
echo Done! All Node.js processes have been terminated.
pause
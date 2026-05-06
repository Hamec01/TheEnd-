@echo off
chcp 65001 >nul
title TheEnd Local Dev Launcher

set "PROJECT_DIR=C:\Users\Ham_h\Documents\GitHub\TheEnd-"
set "BACKEND_DIR=%PROJECT_DIR%\apps\backend"
set "FRONTEND_DIR=%PROJECT_DIR%\apps\frontend"

echo ==========================================
echo TheEnd Local Dev Launcher
echo ==========================================
echo Project: %PROJECT_DIR%
echo.

if not exist "%PROJECT_DIR%\package.json" (
    echo [ERROR] Project folder not found or package.json missing:
    echo %PROJECT_DIR%
    echo.
    echo Edit PROJECT_DIR inside this .bat file if your path is different.
    pause
    exit /b 1
)

if not exist "%BACKEND_DIR%\package.json" (
    echo [ERROR] Backend package.json not found:
    echo %BACKEND_DIR%
    pause
    exit /b 1
)

if not exist "%FRONTEND_DIR%\package.json" (
    echo [ERROR] Frontend package.json not found:
    echo %FRONTEND_DIR%
    pause
    exit /b 1
)

echo [1/3] Starting backend in new window...
start "TheEnd Backend :3000" cmd /k "cd /d "%BACKEND_DIR%" && npm run start:dev"

timeout /t 3 /nobreak >nul

echo [2/3] Starting frontend in new window...
start "TheEnd Frontend :5173" cmd /k "cd /d "%FRONTEND_DIR%" && npm run dev"

timeout /t 5 /nobreak >nul

echo [3/3] Opening browser...
start "" "http://localhost:5173"
start "" "http://localhost:3000/api/health"

echo.
echo Done.
echo.
echo Backend:  http://localhost:3000
echo Frontend: http://localhost:5173
echo Health:   http://localhost:3000/api/health
echo.
echo IMPORTANT:
echo - Do not close backend/frontend terminal windows while working.
echo - To stop servers, close those windows or press Ctrl+C inside each one.
echo.
pause

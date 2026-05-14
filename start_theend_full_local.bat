@echo off
chcp 65001 >nul
title TheEnd Full Local Launcher

set "PROJECT_DIR=C:\Users\ham\Documents\TheEnd"
set "BACKEND_DIR=%PROJECT_DIR%\apps\backend"
set "FRONTEND_DIR=%PROJECT_DIR%\apps\frontend"
set "DOMAIN_DIR=%PROJECT_DIR%\packages\rpg-domain"

echo ==========================================
echo TheEnd Full Local Launcher
echo ==========================================
echo Project: %PROJECT_DIR%
echo.

if not exist "%PROJECT_DIR%\package.json" (
    echo [ERROR] package.json not found:
    echo %PROJECT_DIR%
    echo.
    echo This BAT expects the repository to be cloned directly into C:\theend
    echo Example:
    echo   cd /d C:\
    echo   rmdir /s /q C:\theend
    echo   mkdir C:\theend
    echo   cd /d C:\theend
    echo   git clone https://github.com/Hamec01/TheEnd-.git .
    echo.
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

if not exist "%DOMAIN_DIR%\package.json" (
    echo [ERROR] rpg-domain package.json not found:
    echo %DOMAIN_DIR%
    pause
    exit /b 1
)

cd /d "%PROJECT_DIR%"

echo [1/9] Creating local .env if missing...
if not exist "%PROJECT_DIR%\.env" (
    (
        echo NODE_ENV=development
        echo DATA_MODE=file
        echo CONTENT_STORAGE=file
        echo STORAGE_MODE=file
        echo.
        echo PORT=3000
        echo HOST=localhost
        echo.
        echo FRONTEND_URL=http://localhost:5173
        echo CORS_ORIGIN=http://localhost:5173
        echo.
        echo DATABASE_URL="postgresql://local:local@localhost:5432/theend_local?schema=public"
        echo.
        echo JWT_SECRET="local-dev-secret-change-me"
        echo JWT_EXPIRES_IN="7d"
        echo.
        echo ADMIN_EMAIL="admin@local.dev"
        echo ADMIN_PASSWORD="admin"
        echo.
        echo UPLOAD_DIR="./uploads"
        echo CONTENT_DATA_DIR="./data"
    ) > "%PROJECT_DIR%\.env"
    echo Created %PROJECT_DIR%\.env
) else (
    echo .env already exists, keeping it.
)

echo.
echo [2/9] Copying .env to backend...
copy /Y "%PROJECT_DIR%\.env" "%BACKEND_DIR%\.env" >nul

echo.
echo [3/9] Installing npm dependencies if node_modules is missing...
if not exist "%PROJECT_DIR%\node_modules" (
    npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
) else (
    echo node_modules exists, skipping npm install.
)

echo.
echo [4/9] Installing Prisma 6.19.0...
npm install -D prisma@6.19.0 @prisma/client@6.19.0
if errorlevel 1 (
    echo [ERROR] Prisma install in root failed.
    pause
    exit /b 1
)

npm install -D prisma@6.19.0 @prisma/client@6.19.0 -w apps/backend
if errorlevel 1 (
    echo [ERROR] Prisma install in backend workspace failed.
    pause
    exit /b 1
)

echo.
echo [5/9] Generating Prisma Client...
npx prisma generate --schema=apps/backend/prisma/schema.prisma
if errorlevel 1 (
    echo [ERROR] Prisma generate failed.
    pause
    exit /b 1
)

echo.
echo [6/9] Cleaning old rpg-domain dist...
if exist "%DOMAIN_DIR%\dist" (
    rmdir /s /q "%DOMAIN_DIR%\dist"
)

echo.
echo [7/9] Building @theend/rpg-domain...
npm run build -w @theend/rpg-domain
if errorlevel 1 (
    echo.
    echo [ERROR] rpg-domain build failed.
    echo.
    echo If TypeScript complains about moduleResolution=node10, add this inside compilerOptions
    echo in packages\rpg-domain\tsconfig.json and tsconfig.cjs.json:
    echo.
    echo   "ignoreDeprecations": "6.0",
    echo.
    pause
    exit /b 1
)

echo.
echo [8/9] Cleaning Vite cache...
if exist "%FRONTEND_DIR%\node_modules\.vite" (
    rmdir /s /q "%FRONTEND_DIR%\node_modules\.vite"
)

echo.
echo [9/9] Starting backend and frontend...
echo.

echo Starting backend in new window...
start "TheEnd Backend :3000" cmd /k "cd /d "%BACKEND_DIR%" && npm run start:dev"

timeout /t 4 /nobreak >nul

echo Starting frontend in new window...
start "TheEnd Frontend :5173" cmd /k "cd /d "%FRONTEND_DIR%" && npm run dev -- --force"

timeout /t 5 /nobreak >nul

echo Opening browser...
start "" "http://localhost:5173"
start "" "http://localhost:3000/api/health"

echo.
echo ==========================================
echo Done.
echo ==========================================
echo Backend:  http://localhost:3000
echo Frontend: http://localhost:5173
echo Health:   http://localhost:3000/api/health
echo.
echo Keep backend/frontend terminal windows open while testing.
echo To stop servers, close those windows or press Ctrl+C inside each one.
echo.
pause

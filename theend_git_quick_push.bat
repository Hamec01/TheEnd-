@echo off
chcp 65001 >nul
title TheEnd Git Quick Push

set "PROJECT_DIR=C:\Users\ham\Documents\TheEnd"

echo ==========================================
echo TheEnd Git Quick Push
echo ==========================================
echo Project: %PROJECT_DIR%
echo.

if not exist "%PROJECT_DIR%\.git" (
    echo [ERROR] Git repository not found:
    echo %PROJECT_DIR%
    echo.
    echo Edit PROJECT_DIR inside this .bat file if your path is different.
    pause
    exit /b 1
)

cd /d "%PROJECT_DIR%"

echo [1/5] Current branch:
git branch --show-current
echo.

echo [2/5] Git status:
git status --short
echo.

echo IMPORTANT:
echo This script will add ALL changed files and push them to GitHub.
echo Local ignored files like apps/backend/data/theend_content.local.json should NOT be pushed.
echo.
set /p COMMIT_MSG=Enter commit message: 

if "%COMMIT_MSG%"=="" (
    set "COMMIT_MSG=Update TheEnd project"
)

echo.
echo [3/5] Adding files...
git add .

echo.
echo [4/5] Creating commit...
git commit -m "%COMMIT_MSG%"

if errorlevel 1 (
    echo.
    echo [INFO] Commit failed or there was nothing to commit.
    echo Checking status...
    git status
    echo.
    pause
    exit /b 1
)

echo.
echo [5/5] Pushing to GitHub...
git push

if errorlevel 1 (
    echo.
    echo [ERROR] Push failed.
    echo You may need to pull first:
    echo git pull --rebase
    echo.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo Done. Changes pushed to GitHub.
echo ==========================================
echo.
pause

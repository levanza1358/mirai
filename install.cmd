@echo off
setlocal EnableExtensions

set "REPO_URL=%MIRAI_REPO_URL%"
if not defined REPO_URL set "REPO_URL=https://github.com/levanza1358/mirai.git"
set "TARGET_DIR=%MIRAI_DIR%"
if not defined TARGET_DIR set "TARGET_DIR=%USERPROFILE%\mirai"

where git >nul 2>&1 || (echo Git required. Install Git for Windows first.& exit /b 1)
where node >nul 2>&1 || (echo Node.js 18+ required.& exit /b 1)
where npm >nul 2>&1 || (echo npm required.& exit /b 1)

if exist "%TARGET_DIR%" (
  echo Target already exists: %TARGET_DIR%
  echo Refusing to overwrite existing files. Remove it or set MIRAI_DIR.
  exit /b 1
)

echo Cloning Mirai into %TARGET_DIR%...
git clone "%REPO_URL%" "%TARGET_DIR%"
if errorlevel 1 exit /b 1

pushd "%TARGET_DIR%"
echo Installing dependencies...
npm install
if errorlevel 1 (popd & exit /b 1)

if not exist .env if exist .env.example copy /Y .env.example .env >nul
popd

echo Installed: %TARGET_DIR%
echo Start: cd /d "%TARGET_DIR%" ^&^& npm run dev
endlocal

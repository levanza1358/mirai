@echo off
setlocal EnableDelayedExpansion
rem ===========================================================================
rem  Mirai updater for Windows (cmd.exe / PowerShell)
rem
rem  Usage:
rem    cd %USERPROFILE%\mirai
rem    .\update.cmd
rem
rem  What it does:
rem    - finds the Mirai checkout (this script's folder, or --dir)
rem    - fetches the latest commit from GitHub and resets to it
rem    - reinstalls npm dependencies (skipped when package.json is unchanged)
rem    - rebuilds the production bundle (npm run build)
rem    - restarts Mirai if it is running
rem
rem  .env, your data dir and the database are never touched.
rem
rem  Options:
rem    --dir <path>      Checkout to update       (default: this script's folder)
rem    --branch <ref>    Git ref to follow        (default: main)
rem    --check           Only report if an update is available
rem    --no-restart      Do not restart Mirai afterwards
rem    --no-build        Skip npm run build
rem    --force-install   Always run npm install
rem    --yes             Non-interactive (discard local changes)
rem ===========================================================================

set "INSTALL_DIR=%~dp0"
if "%INSTALL_DIR:~-1%"=="\" set "INSTALL_DIR=%INSTALL_DIR:~0,-1%"
set "BRANCH=main"
set "REPO_URL="
set "CHECK_ONLY=0"
set "DO_RESTART=1"
set "DO_BUILD=1"
set "FORCE_INSTALL=0"
set "ASSUME_YES=0"
set "PORT=1463"

:parse
if "%~1"=="" goto parsed
if /i "%~1"=="--dir"           ( set "INSTALL_DIR=%~2" & shift & shift & goto parse )
if /i "%~1"=="--branch"        ( set "BRANCH=%~2"      & shift & shift & goto parse )
if /i "%~1"=="--repo"          ( set "REPO_URL=%~2"    & shift & shift & goto parse )
if /i "%~1"=="--check"         ( set "CHECK_ONLY=1"    & shift & goto parse )
if /i "%~1"=="--no-restart"    ( set "DO_RESTART=0"    & shift & goto parse )
if /i "%~1"=="--no-build"      ( set "DO_BUILD=0"      & shift & goto parse )
if /i "%~1"=="--force-install" ( set "FORCE_INSTALL=1" & shift & goto parse )
if /i "%~1"=="--yes"           ( set "ASSUME_YES=1"    & shift & goto parse )
if /i "%~1"=="--help"          goto usage
echo Unknown option: %~1
goto usage

:parsed
echo.
echo  Mirai updater
echo    dir:  %INSTALL_DIR%
echo.

where git >nul 2>&1 || goto no_git
where node >nul 2>&1 || goto no_node
where npm >nul 2>&1 || goto no_node

if not exist "%INSTALL_DIR%\.git" goto not_checkout
cd /d "%INSTALL_DIR%"

if "%REPO_URL%"=="" for /f "delims=" %%u in ('git remote get-url origin 2^>nul') do set "REPO_URL=%%u"
if "%REPO_URL%"=="" goto no_remote

rem --- refuse to clobber uncommitted work -------------------------------------
for /f "delims=" %%s in ('git status --porcelain --untracked-files^=no') do set "DIRTY=1"
if defined DIRTY (
  if "%CHECK_ONLY%"=="1" (
    echo    ! local modifications present; they would be overwritten by an update
  ) else if "%ASSUME_YES%"=="1" (
    echo    ! local modifications present - discarding them
  ) else (
    echo Error: you have local changes in %INSTALL_DIR%.
    echo        Commit or stash them, or re-run with --yes to discard.
    exit /b 1
  )
)

for /f "delims=" %%s in ('git rev-parse --short HEAD 2^>nul') do set "BEFORE_SHA=%%s"
for /f "delims=" %%s in ('git rev-parse HEAD 2^>nul') do set "BEFORE_REF=%%s"

echo ==^> Fetching origin/%BRANCH%
git fetch --prune origin %BRANCH%
if errorlevel 1 goto fetch_failed

for /f "delims=" %%s in ('git rev-parse origin/%BRANCH%') do set "AFTER_REF=%%s"
for /f "delims=" %%s in ('git rev-parse --short origin/%BRANCH%') do set "AFTER_SHA=%%s"

if "%BEFORE_REF%"=="%AFTER_REF%" (
  echo    ok already up to date ^(%BEFORE_SHA%^)
  exit /b 0
)

echo    %BEFORE_SHA% -^> %AFTER_SHA%
git --no-pager log --oneline --no-decorate %BEFORE_REF%..%AFTER_REF%

if "%CHECK_ONLY%"=="1" (
  echo.
  echo An update is available. Run `mirai update` to install it.
  echo.
  exit /b 0
)

echo ==^> Updating to origin/%BRANCH%
git checkout -q %BRANCH% 2>nul || git checkout -q -B %BRANCH% origin/%BRANCH%
git reset -q --hard origin/%BRANCH%
if errorlevel 1 goto reset_failed
echo    ok checked out %AFTER_SHA%

rem --- dependencies -----------------------------------------------------------
set "PKG_CHANGED=0"
git diff --quiet %BEFORE_REF% %AFTER_REF% -- package.json package-lock.json cli/package.json 2>nul
if errorlevel 1 set "PKG_CHANGED=1"

if "%FORCE_INSTALL%"=="1" set "PKG_CHANGED=1"
if "%PKG_CHANGED%"=="1" (
  echo ==^> Installing dependencies ^(npm install^)
  call npm install --no-audit --no-fund
  if errorlevel 1 goto npm_failed
  echo    ok dependencies updated
) else (
  echo    ok package.json unchanged - skipping npm install
)

rem --- build ------------------------------------------------------------------
if "%DO_BUILD%"=="1" (
  echo ==^> Building production bundle ^(npm run build^)
  set "NODE_OPTIONS=--max-old-space-size=6144"
  call npm run build
  if errorlevel 1 goto build_failed
  echo    ok build finished
) else (
  echo    ! skipped build --no-build
)

rem --- restart ----------------------------------------------------------------
if "%DO_RESTART%"=="1" (
  tasklist /fi "imagename eq node.exe" 2>nul | find /i "node.exe" >nul
  if not errorlevel 1 (
    echo ==^> Restarting Mirai on the new build
    call mirai restart >nul 2>&1
    echo    ok restart requested - dashboard: http://localhost:%PORT%
  ) else (
    echo    ok Mirai was not running - start it with: mirai start
  )
) else (
  echo    ! skipped restart --no-restart
)

echo.
echo  Mirai updated
echo    location : %INSTALL_DIR%
echo    revision : %AFTER_SHA%
echo    dashboard: http://localhost:%PORT%
echo.
echo    Your .env and data dir were left untouched.
echo.
exit /b 0

:no_git
echo Error: git is required. Install from https://git-scm.com/download/win
exit /b 1

:no_node
echo Error: Node.js 20+ and npm are required. Install from https://nodejs.org
exit /b 1

:not_checkout
echo Error: %INSTALL_DIR% is not a git checkout.
echo        Install Mirai first:
echo          powershell -c "irm https://raw.githubusercontent.com/levanza1358/mirai/main/install.cmd -OutFile install.cmd; .\install.cmd"
exit /b 1

:no_remote
echo Error: no git remote 'origin' found - pass --repo ^<url^>
exit /b 1

:fetch_failed
echo Error: git fetch failed - check your network / repo URL
exit /b 1

:reset_failed
echo Error: git reset failed
exit /b 1

:npm_failed
echo Error: npm install failed
exit /b 1

:build_failed
echo Error: npm run build failed
exit /b 1

:usage
echo.
echo  Mirai updater for Windows
echo.
echo    .\update.cmd [options]
echo.
echo    --dir ^<path^>      Checkout to update       (default: this script's folder)
echo    --branch ^<ref^>    Git ref to follow        (default: main)
echo    --check           Only report if an update is available
echo    --no-restart      Do not restart Mirai afterwards
echo    --no-build        Skip npm run build
echo    --force-install   Always run npm install
echo    --yes             Non-interactive (discard local changes)
echo.
exit /b 0

@echo off
setlocal EnableDelayedExpansion
rem ===========================================================================
rem  Mirai installer for Windows (cmd.exe / PowerShell)
rem
rem  Usage (PowerShell):
rem    irm https://raw.githubusercontent.com/levanza1358/mirai/main/install.cmd -OutFile install.cmd; .\install.cmd
rem
rem  What it does:
rem    - verifies git / node / npm
rem    - clones (or updates) the repo into %USERPROFILE%\mirai
rem    - runs npm install
rem    - creates .env with generated secrets (never overwrites an existing one)
rem    - puts `mirai` on your user PATH so `mirai start` works in a new terminal
rem
rem  Options:
rem    --dir <path>    Install directory       (default: %USERPROFILE%\mirai)
rem    --port <n>      Dashboard port          (default: 1463)
rem    --branch <ref>  Git ref to install      (default: main)
rem    --build         run npm run build afterwards
rem    --no-path       do not add mirai to PATH
rem ===========================================================================

set "REPO_URL=https://github.com/levanza1358/mirai.git"
set "BRANCH=main"
set "INSTALL_DIR=%USERPROFILE%\mirai"
set "PORT=1463"
set "DO_BUILD=0"
set "DO_PATH=1"

:parse
if "%~1"=="" goto parsed
if /i "%~1"=="--dir"     ( set "INSTALL_DIR=%~2" & shift & shift & goto parse )
if /i "%~1"=="--port"    ( set "PORT=%~2"        & shift & shift & goto parse )
if /i "%~1"=="--branch"  ( set "BRANCH=%~2"      & shift & shift & goto parse )
if /i "%~1"=="--repo"    ( set "REPO_URL=%~2"    & shift & shift & goto parse )
if /i "%~1"=="--build"   ( set "DO_BUILD=1"      & shift & goto parse )
if /i "%~1"=="--no-path" ( set "DO_PATH=0"       & shift & goto parse )
if /i "%~1"=="--help"    ( goto usage )
echo Unknown option: %~1
goto usage

:parsed
echo.
echo  Mirai installer
echo    dir:   %INSTALL_DIR%
echo    repo:  %REPO_URL%
echo    ref:   %BRANCH%
echo    port:  %PORT%
echo.

echo ==^> Checking prerequisites
where git >nul 2>&1 || goto no_git
where node >nul 2>&1 || goto no_node
where npm >nul 2>&1 || goto no_node

for /f "delims=" %%v in ('node -p "process.versions.node.split('.')[0]"') do set "NODE_MAJOR=%%v"
if %NODE_MAJOR% LSS 20 goto old_node
for /f "delims=" %%v in ('node -v') do echo    ok node %%v
echo    ok git and npm found

echo ==^> Fetching sources into %INSTALL_DIR%
if exist "%INSTALL_DIR%\.git" goto update_repo
if exist "%INSTALL_DIR%" goto dir_exists
git clone --depth 1 --branch "%BRANCH%" "%REPO_URL%" "%INSTALL_DIR%"
if errorlevel 1 goto git_failed
echo    ok cloned %BRANCH%
goto deps

:update_repo
git -C "%INSTALL_DIR%" fetch --depth 1 origin "%BRANCH%"
if errorlevel 1 goto git_failed
git -C "%INSTALL_DIR%" checkout -q "%BRANCH%" 2>nul
if errorlevel 1 git -C "%INSTALL_DIR%" checkout -q -B "%BRANCH%" "origin/%BRANCH%"
git -C "%INSTALL_DIR%" reset -q --hard "origin/%BRANCH%"
if errorlevel 1 goto git_failed
echo    ok updated to origin/%BRANCH%

:deps
pushd "%INSTALL_DIR%" || goto pushd_failed

echo ==^> Installing dependencies (npm install)
call npm install --no-audit --no-fund
if errorlevel 1 goto npm_failed
echo    ok dependencies installed

echo ==^> Configuring .env
set "ENV_FILE=%INSTALL_DIR%\.env"
set "ENV_EXISTED=0"
if exist "%ENV_FILE%" (
  set "ENV_EXISTED=1"
  echo    ^! .env already exists - keeping it, only filling missing keys
) else (
  if exist ".env.example" ( copy /y ".env.example" "%ENV_FILE%" >nul ) else ( type nul > "%ENV_FILE%" )
)

set "DATA_DIR_VALUE=%USERPROFILE%\.mirai"
if not exist "%DATA_DIR_VALUE%" mkdir "%DATA_DIR_VALUE%"
call :upsert DATA_DIR "%DATA_DIR_VALUE%"
call :upsert PORT "%PORT%"
call :upsert NODE_ENV "production"
call :upsert BASE_URL "http://localhost:%PORT%"
call :upsert NEXT_PUBLIC_BASE_URL "http://localhost:%PORT%"

call :rotate JWT_SECRET 32
call :rotate API_KEY_SECRET 24
call :rotate MACHINE_ID_SALT 16
call :rotate INITIAL_PASSWORD 8

echo    ok .env ready at %ENV_FILE%

echo ==^> Preparing the mirai launcher
if not exist "mirai.cmd" (
  echo    ! mirai.cmd missing from the checkout - repo is incomplete
  goto fail
)
if "%DO_PATH%"=="1" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$dir = '%INSTALL_DIR%'; $target = Join-Path $dir 'mirai.cmd';" ^
    "$userPath = [Environment]::GetEnvironmentVariable('Path','User');" ^
    "if ($userPath -notlike ('*' + $dir + '*')) {" ^
    "  [Environment]::SetEnvironmentVariable('Path', ($userPath.TrimEnd(';') + ';' + $dir), 'User');" ^
    "  Write-Host '   ok added' $dir 'to your user PATH (open a new terminal)'" ^
    "} else { Write-Host '   ok' $dir 'is already on your user PATH' }"
) else (
  echo    skipped PATH setup (--no-path^)
)

if "%DO_BUILD%"=="1" (
  echo ==^> Building production bundle ^(npm run build^)
  call npm run build
  if errorlevel 1 goto build_failed
  echo    ok build finished
)

popd
echo.
echo  Mirai installed
echo    location : %INSTALL_DIR%
echo    launcher : %INSTALL_DIR%\mirai.cmd
echo    env file : %ENV_FILE%
echo    data dir : %DATA_DIR_VALUE%
echo    dashboard: http://localhost:%PORT%
echo.
echo  Start it from a NEW terminal:
echo      mirai start
echo  Or right now:
echo      cd /d "%INSTALL_DIR%" ^&^& mirai.cmd start
echo.
echo  Your dashboard password is in .env ^(-^> INITIAL_PASSWORD^).
echo.
endlocal
exit /b 0

rem --------------------------------------------------------------- subroutines
:upsert
rem %1 = KEY, %2 = VALUE  (uses ENV_FILE from the caller)
node -e "const fs=require('fs');const [f,k,v]=process.argv.slice(1);const re=new RegExp('^'+k+'=.*$','m');let t=fs.readFileSync(f,'utf8');t=re.test(t)?t.replace(re,k+'='+v):t.replace(/\s*$/,'')+'\n'+k+'='+v+'\n';fs.writeFileSync(f,t);" "%ENV_FILE%" "%~1" "%~2"
exit /b 0

:rotate
rem %1 = KEY, %2 = bytes. generate when file is new or value is still a placeholder
if "%ENV_EXISTED%"=="0" goto rotate_do
node -e "const fs=require('fs');const [f,k]=process.argv.slice(1);const t=fs.readFileSync(f,'utf8');const m=t.match(new RegExp('^'+k+'=(.*)$','m'));const v=m?m[1].trim():'';process.exit((!m||v===''||v.indexOf('change-me')===0||v.indexOf('endpoint-proxy')===0)?0:1);" "%ENV_FILE%" "%~1"
if errorlevel 1 (
  echo    ok kept existing %~1
  exit /b 0
)
:rotate_do
for /f "delims=" %%r in ('node -e "process.stdout.write(require('crypto').randomBytes(%~2).toString('hex'))"') do set "GEN=%%r"
call :upsert "%~1" "%GEN%"
echo    ok generated %~1
exit /b 0

:usage
echo.
echo  Usage: install.cmd [--dir PATH] [--port N] [--branch REF] [--repo URL] [--build] [--no-path]
echo.
endlocal
exit /b 1

:no_git
echo    X git is required. Install Git for Windows: https://git-scm.com/download/win
goto fail
:no_node
echo    X Node.js is required. Install Node.js 20 LTS: https://nodejs.org
goto fail
:old_node
echo    X Node.js %NODE_MAJOR% detected, but 20 or newer is required.
goto fail
:dir_exists
echo    X "%INSTALL_DIR%" already exists and is not a Mirai checkout.
echo      Use --dir to pick another path.
goto fail
:git_failed
echo    X git clone/fetch failed.
goto fail
:pushd_failed
echo    X could not enter "%INSTALL_DIR%".
goto fail
:npm_failed
echo    X npm install failed.
popd
goto fail
:build_failed
echo    X npm run build failed.
popd
goto fail

:fail
echo.
echo  Installation aborted.
endlocal
exit /b 1

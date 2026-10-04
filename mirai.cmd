@echo off
rem Mirai launcher — run from the project root:  mirai restart   /   mirai start
rem Forwards all arguments to the bundled CLI.
setlocal
set "SCRIPT_DIR=%~dp0"
node "%SCRIPT_DIR%cli\cli.js" %*
exit /b %ERRORLEVEL%

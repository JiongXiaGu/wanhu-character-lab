@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Wanhu Character Lab - V3
pushd "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js was not found. Install Node.js 22.12 or newer.
    echo.
    pause
    popd
    exit /b 1
)
node "scripts\start-local.cjs"
set "RESULT=%ERRORLEVEL%"
if not "%RESULT%"=="0" (
    echo.
    echo [ERROR] Launcher stopped. Please check the message above.
    pause
)
popd
exit /b %RESULT%

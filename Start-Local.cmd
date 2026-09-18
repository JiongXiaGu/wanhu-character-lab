@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Wanhu Character Lab - Local

cd /d "%~dp0"

if not exist "package.json" (
    echo [错误] 未找到 package.json，请将本脚本放在项目根目录运行。
    echo.
    pause
    exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
    echo [错误] 未找到 Node.js，请先安装 Node.js LTS。
    echo.
    pause
    exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
    echo [错误] 未找到 npm，请重新安装 Node.js LTS。
    echo.
    pause
    exit /b 1
)

if not exist "node_modules\.bin\vite.cmd" (
    echo 首次运行，正在安装项目依赖...
    call npm install --no-package-lock
    if errorlevel 1 (
        echo.
        echo [错误] 依赖安装失败，请检查网络连接和 npm 配置。
        echo.
        pause
        exit /b 1
    )
)

echo.
echo 正在启动 Wanhu Character Lab...
echo 浏览器将自动打开：http://127.0.0.1:5173
echo 按 Ctrl+C 可停止服务。
echo.

call npm run dev -- --host 127.0.0.1 --port 5173 --strictPort --open

if errorlevel 1 (
    echo.
    echo [错误] 本地服务启动失败。
    pause
    exit /b 1
)

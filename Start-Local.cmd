@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Wanhu Character Lab - Local

cd /d "%~dp0"

echo.
echo ========================================
echo   Wanhu Character Lab
echo   Windows 本地启动器
echo ========================================
echo.

if not exist "package.json" (
    echo [错误] 当前目录不是 wanhu-character-lab 项目根目录。
    echo 请确认 Start-Local.cmd 与 package.json 位于同一目录。
    echo.
    pause
    exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
    echo [错误] 未找到 Node.js。
    echo 请先安装 Node.js LTS，然后重新双击本文件。
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo [错误] 未找到 npm。
    echo 请重新安装 Node.js LTS。
    echo.
    pause
    exit /b 1
)

echo [环境]
for /f "delims=" %%v in ('node --version') do echo Node: %%v
for /f "delims=" %%v in ('npm --version') do echo npm : %%v
echo.

where git >nul 2>nul
if errorlevel 1 (
    echo [提示] 未找到 Git，跳过自动更新。
) else (
    if exist ".git" (
        echo [1/4] 正在检查 GitHub main 分支更新...
        git pull --ff-only
        if errorlevel 1 (
            echo [提示] 自动更新未完成，将继续使用当前本地版本。
        )
    ) else (
        echo [1/4] 当前目录不是 Git 仓库，跳过自动更新。
    )
)

echo.
if not exist "node_modules" (
    echo [2/4] 首次运行，正在安装依赖...
    call npm install
    if errorlevel 1 (
        echo.
        echo [错误] npm install 失败。
        echo 请检查网络连接后重新运行。
        echo.
        pause
        exit /b 1
    )
) else (
    echo [2/4] 依赖已存在，跳过 npm install。
)

echo.
echo [3/4] 准备打开浏览器...
start "" powershell -NoProfile -WindowStyle Hidden -Command ^
    "$url='http://127.0.0.1:5173'; for($i=0;$i -lt 60;$i++){ try { $r=Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 1; if($r.StatusCode -ge 200){ Start-Process $url; exit } } catch {}; Start-Sleep -Milliseconds 500 }"

echo.
echo [4/4] 启动 Vite 本地服务器...
echo.
echo 本地地址：
echo http://127.0.0.1:5173
echo.
echo 保持此窗口开启。
echo 按 Ctrl+C 可停止服务器。
echo ========================================
echo.

call npm run dev -- --host 127.0.0.1 --port 5173 --strictPort

echo.
echo Wanhu Character Lab 已停止。
pause

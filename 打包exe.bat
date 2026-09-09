@echo off
rem ============================================================
rem  一键打包 龙猫小说提示词管理器 —— 双击本文件即可
rem  内部调用 build.ps1，日志写入 build.log，窗口不会闪退
rem ============================================================
chcp 65001 >nul
title 龙猫小说提示词管理器 - 一键打包
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1"
set "EXITCODE=%ERRORLEVEL%"
echo.
if "%EXITCODE%"=="0" (
    echo 打包流程结束，窗口 5 秒后自动关闭（完整日志见 build.log）
    timeout /t 5 >nul
) else (
    echo 打包出现问题，请查看上方提示与 build.log 后按键关闭
    pause >nul
)

@echo off
rem ============================================================
rem  build.bat —— 命令行打包入口（调用 build.ps1，日志写入 build.log）
rem  双击请使用「打包exe.bat」；本文件适合在 cmd 中直接执行：
rem     build.bat
rem ============================================================
chcp 65001 >nul
title 龙猫小说提示词管理器 - 打包
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1"
exit /b %ERRORLEVEL%

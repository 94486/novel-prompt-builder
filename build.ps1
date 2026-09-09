# ============================================================
# build.ps1 —— 一键打包 龙猫小说提示词管理器 为 Windows 免安装 exe
#
# 用法：
#   - 双击「打包exe.bat」即可；
#   - 或在本目录执行：powershell -ExecutionPolicy Bypass -File build.ps1
#
# 特点：
#   - 全程输出写入 build.log（与脚本同目录），任何一步出错都能看到日志；
#   - 无论成功或失败，窗口都会停留并等待按键，不会闪退；
#   - 图标生成不依赖 Python（优先 python，缺失时自动用 Windows 自带 .NET）。
# ============================================================

$ErrorActionPreference = 'Stop'
$LogFile = Join-Path $PSScriptRoot 'build.log'

# 记录所有输出到日志文件（同时仍显示在窗口里）
try { Start-Transcript -Path $LogFile -Force -ErrorAction SilentlyContinue | Out-Null } catch { }

Write-Host ''
Write-Host '==============================================' -ForegroundColor Cyan
Write-Host '  龙猫小说提示词管理器 —— 一键打包' -ForegroundColor Cyan
Write-Host '  日志文件：build.log（与本脚本同目录）' -ForegroundColor Cyan
Write-Host '==============================================' -ForegroundColor Cyan
Write-Host ''

try {
    # ---------- 1/4 检查 Node.js 并修复 PATH ----------
    Write-Host '[1/5] 检查 Node.js ...' -ForegroundColor Cyan
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) {
        Write-Host '未检测到 Node.js，请先安装：https://nodejs.org（安装 LTS 版后重试）' -ForegroundColor Red
        Write-Host 'FAIL: node not found' | Out-File $LogFile -Append -Encoding utf8
        return
    }
    $nodeVer = & node --version
    Write-Host "      Node.js $nodeVer OK" -ForegroundColor Green
    # 关键修复：把 node 所在目录强制放到 PATH 最前面。
    # npm 在 Windows 上调起 cmd.exe 执行生命周期脚本时，子进程可能丢失 node 路径，
    # 导致 electron-winstaller 的 select-7z-arch.js 报 "'node' 不是内部或外部命令"。
    $nodeDir = Split-Path $node.Source -Parent
    if ($env:Path -notlike "*$nodeDir*") {
        $env:Path = "$nodeDir;$env:Path"
        Write-Host "      已修复 PATH，加入 node 目录: $nodeDir" -ForegroundColor Yellow
    }

    # ---------- 2/4 检查打包图标 ----------
    Write-Host '[2/5] 检查打包图标 build/icon.png ...' -ForegroundColor Cyan
    if (Test-Path (Join-Path $PSScriptRoot 'build\icon.png')) {
        Write-Host '      图标已存在（package.json win.icon 已指向，勿删）' -ForegroundColor Green
    } else {
        Write-Host '      缺少 build/icon.png（打包将使用 Electron 默认图标，建议补上）' -ForegroundColor Yellow
    }

    # ---------- 3/4 安装依赖 ----------
    Write-Host '[3/5] 安装依赖（首次需下载 Electron，约 100MB，请耐心等待）...' -ForegroundColor Cyan
    Push-Location $PSScriptRoot
    # 若上次安装不完整（node_modules 存在但 electron-builder 缺失），自动清理后重装
    if ((Test-Path 'node_modules') -and -not (Test-Path 'node_modules\electron-builder')) {
        Write-Host '      检测到上次安装不完整，正在清理 node_modules 与 package-lock.json ...' -ForegroundColor Yellow
        Remove-Item -Recurse -Force 'node_modules' -ErrorAction SilentlyContinue
        Remove-Item -Force 'package-lock.json' -ErrorAction SilentlyContinue
    }
    & npm install
    Pop-Location
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'npm install 失败，请检查网络后重试（日志见 build.log）' -ForegroundColor Red
        return
    }
    Write-Host '      依赖安装完成' -ForegroundColor Green

    # ---------- 4/5 清理上次打包产物 ----------
    Write-Host '[4/5] 清理上次 release/ 内的打包产物（保留 data/）...' -ForegroundColor Cyan
    Push-Location $PSScriptRoot
    try { & npx --no-install node scripts/clean-release.js 2>$null }
    catch { Write-Host '      跳过（个别旧文件可能被占用，后续 electron-builder 会自动覆盖）' -ForegroundColor Yellow }
    Pop-Location

    # ---------- 5/5 打包 ----------
    Write-Host '[5/5] electron-builder 打包 portable exe ...' -ForegroundColor Cyan
    Push-Location $PSScriptRoot
    & npx electron-builder --win portable
    Pop-Location
    if ($LASTEXITCODE -ne 0) {
        Write-Host '打包失败，请把 build.log 内容发给我修复。' -ForegroundColor Red
        return
    }

    $exe = Get-ChildItem (Join-Path $PSScriptRoot 'release\*.exe') -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($exe) {
        Write-Host ''
        Write-Host '==============================================' -ForegroundColor Green
        Write-Host "  打包成功：$($exe.FullName)" -ForegroundColor Green
        Write-Host '  双击该 exe 即可运行，数据保存在 exe 同级 data 文件夹' -ForegroundColor Green
        Write-Host '==============================================' -ForegroundColor Green
        Start-Process explorer.exe -ArgumentList "/select,`"$($exe.FullName)`""
    } else {
        Write-Host '未找到打包产物，请检查上方输出与 build.log' -ForegroundColor Red
    }
}
catch {
    Write-Host ''
    Write-Host '发生错误：' -ForegroundColor Red
    Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  $($_.ScriptStackTrace)" -ForegroundColor DarkGray
    Write-Host '完整日志已写入 build.log' -ForegroundColor Yellow
}
finally {
    try { Stop-Transcript -ErrorAction SilentlyContinue | Out-Null } catch { }
    Write-Host ''
    Write-Host '按回车键关闭窗口（日志已保存在 build.log）' -ForegroundColor DarkGray
    Read-Host
}

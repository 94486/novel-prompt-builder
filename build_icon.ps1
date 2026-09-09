# build_icon.ps1 —— 生成应用图标 build/icon.ico
# 不依赖 Python，使用 Windows 自带 .NET System.Drawing 生成 PNG，
# 再手动封装为标准 ICO 文件（ICO 支持内嵌 PNG，Vista 及以上均兼容）。
# 用法：powershell -ExecutionPolicy Bypass -File build_icon.ps1

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$size = 256
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.InterpolationMode = 'HighQualityBicubic'

# --- 紫蓝对角渐变背景 ---
$rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    [System.Drawing.Color]::FromArgb(255, 42, 46, 110),
    [System.Drawing.Color]::FromArgb(255, 82, 92, 250),
    45.0)
$g.FillRectangle($brush, $rect)

# --- 白色简化"书本/文档"图形 ---
$white = [System.Drawing.Color]::FromArgb(255, 240, 240, 255)
$pen = New-Object System.Drawing.Pen($white, 10)
$pen.StartCap = 'Round'
$pen.EndCap = 'Round'
# 书本外框
$g.DrawRectangle($pen, 56, 48, 144, 160)
# 书脊中线
$g.DrawLine($pen, 128, 48, 128, 208)
# 几行文字（横线）
$textPen = New-Object System.Drawing.Pen($white, 5)
$textPen.StartCap = 'Round'
$textPen.EndCap = 'Round'
$g.DrawLine($textPen, 72, 80, 116, 80)
$g.DrawLine($textPen, 72, 100, 116, 100)
$g.DrawLine($textPen, 140, 80, 184, 80)
$g.DrawLine($textPen, 140, 100, 184, 100)
$g.DrawLine($textPen, 72, 130, 184, 130)
$g.DrawLine($textPen, 72, 150, 160, 150)

# 释放 GDI 对象
$g.Dispose()
$brush.Dispose()
$pen.Dispose()
$textPen.Dispose()

# --- 位图保存为 PNG（内存流） ---
$ms = New-Object System.IO.MemoryStream
$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$pngBytes = $ms.ToArray()
$ms.Dispose()
$bmp.Dispose()

if (-not $pngBytes -or $pngBytes.Length -eq 0) {
    throw 'PNG 生成失败，pngBytes 为空'
}

# --- 手动构造 ICO 文件（ICONDIR + ICONDIRENTRY + PNG 数据） ---
$outDir = Join-Path $PSScriptRoot 'build'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$outFile = Join-Path $outDir 'icon.ico'

$fs = [System.IO.File]::Create($outFile)
$bw = New-Object System.IO.BinaryWriter($fs)
try {
    # ICONDIR（6 字节）：reserved=0, type=1(ICO), count=1
    $bw.Write([UInt16]0)
    $bw.Write([UInt16]1)
    $bw.Write([UInt16]1)
    # ICONDIRENTRY（16 字节）
    # 注意：四个字段用一次 byte[] 写入（不可拆成 4 行独立 Write([Byte]0)，
    # PowerShell 5.1 解析器会丢失连续第 4 个同类写入，导致 ICO 头少 1 字节、
    # electron-builder 的 resedit 解析越界报错）
    $bw.Write([Byte[]]@(0, 0, 0, 0)) # width=0, height=0, colors=0, reserved=0（0 表示 256）
    $bw.Write([UInt16]1)        # planes=1
    $bw.Write([UInt16]32)       # bitcount=32
    $bw.Write([UInt32]$pngBytes.Length)  # bytes in resource
    $bw.Write([UInt32]22)       # image offset（6+16=22）
    # PNG 图像数据
    $bw.Write($pngBytes)
}
finally {
    $bw.Close()
    $fs.Close()
}

if (Test-Path $outFile) {
    $info = Get-Item $outFile
    Write-Host "图标生成成功: $outFile ($($info.Length) bytes)"
} else {
    throw "图标文件未生成: $outFile"
}

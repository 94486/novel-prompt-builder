#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_icon.py —— 生成 build/icon.ico（多分辨率 BMP/DIB 格式 ICO，无第三方依赖）

输出包含 7 个尺寸（16/24/32/48/64/128/256），使用 BITMAPINFOHEADER + 像素数据 + AND 蒙版，
兼容 resedit / electron-builder / 资源写入。

用法：python build_icon.py
"""
import os
import struct

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build")
OUT_FILE = os.path.join(OUT_DIR, "icon.ico")

# 渐变两端颜色（BGR 方便像素使用）
C_TOP_R, C_TOP_G, C_TOP_B = 0x2A, 0x2E, 0x6E
C_BOT_R, C_BOT_G, C_BOT_B = 0x52, 0x5C, 0xFA

SIZES = [16, 24, 32, 48, 64, 128, 256]


def lerp(a, b, t):
    return int(round(a + (b - a) * t))


def pixel_at(x, y, size):
    """返回 (B, G, R, A)；圆角外的角置 A=0。"""
    radius = size * 0.18
    dx = min(x, size - 1 - x)
    dy = min(y, size - 1 - y)
    if dx < radius and dy < radius:
        cx, cy = radius, radius
        if (dx - cx) ** 2 + (dy - cy) ** 2 > radius ** 2:
            return (0, 0, 0, 0)
    t = (x + y) / (2.0 * (size - 1)) if size > 1 else 0.0
    return (
        lerp(C_TOP_B, C_BOT_B, t),
        lerp(C_TOP_G, C_BOT_G, t),
        lerp(C_TOP_R, C_BOT_R, t),
        255,
    )


def make_icon_image(size):
    """生成单个尺寸的 ICO 图像数据（BITMAPINFOHEADER + XOR + AND mask）。"""
    header = struct.pack(
        "<IiiHHIIiiII",
        40, size, size * 2, 1, 32, 0, 0, 0, 0, 0, 0
    )

    # XOR 数据：自底向上，每行 4*size 字节 + 对齐到 4 字节
    row_bytes = size * 4
    pad = (4 - row_bytes % 4) % 4
    pixel_data = bytearray()
    for y in range(size - 1, -1, -1):
        row = bytearray()
        for x in range(size):
            b, g, r, a = pixel_at(x, y, size)
            row += bytes((b, g, r, a))
        row += b'\x00' * pad
        pixel_data += row

    # AND 蒙版：每像素 1 bit，按 DWord 对齐；不透明=0，透明=1
    row_bits = size
    and_row_bytes = ((row_bits + 31) // 32) * 4
    and_mask = bytearray()
    for y in range(size):
        row_bits_arr = [0 if pixel_at(x, y, size)[3] > 0 else 1 for x in range(size)]
        # 补齐至 32 倍数
        while len(row_bits_arr) % 32:
            row_bits_arr.append(0)
        # 每 8 bit 打包成 1 字节（小端 bit 序）
        for i in range(0, len(row_bits_arr), 8):
            byte = 0
            for bit in range(min(8, len(row_bits_arr) - i)):
                byte |= row_bits_arr[i + bit] << bit
            and_mask.append(byte)
        # 按行 DWord 对齐
        while len(and_mask) % and_row_bytes:
            and_mask.append(0)

    return header + bytes(pixel_data) + bytes(and_mask)


def make_ico(images):
    """images: 按 size -> bytes；封装为标准 ICO 文件。"""
    count = len(images)
    header_size = 6 + count * 16
    entries = bytearray()
    blobs = bytearray()
    offset = header_size
    for s in sorted(images.keys()):
        data = images[s]
        entries += struct.pack(
            "<BBBBHHII",
            s if s < 256 else 0,
            s if s < 256 else 0,
            0, 0, 1, 32,
            len(data),
            offset
        )
        blobs += data
        offset += len(data)
    icondir = struct.pack("<HHH", 0, 1, count)
    return icondir + bytes(entries) + bytes(blobs)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    images = {s: make_icon_image(s) for s in SIZES}
    ico = make_ico(images)
    with open(OUT_FILE, "wb") as f:
        f.write(ico)
    print(f"已生成: {OUT_FILE} ({len(ico)} bytes，含 {len(SIZES)} 个尺寸: {SIZES})")


if __name__ == "__main__":
    main()

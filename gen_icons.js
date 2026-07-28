// gen_icons.js — 纯 Node 内置模块生成 PWA 图标 PNG（无外部依赖）
// 原理：手动构造最小 PNG 文件（IHDR + IDAT），用渐变 + 简单几何
// 运行: node gen_icons.js
const fs = require('fs');
const zlib = require('zlib');

// PNG 辅助
function crc32(buf) {
    let table = crc32.table;
    if (!table) {
        table = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
            table[n] = c >>> 0;
        }
        crc32.table = table;
    }
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crc]);
}

function makePNG(size, pixelFn) {
    // IHDR
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0);
    ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8;   // bit depth
    ihdr[9] = 6;   // color type RGBA
    ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    
    // 像素
    const stride = size * 4 + 1; // +1 for filter byte
    const raw = Buffer.alloc(stride * size);
    for (let y = 0; y < size; y++) {
        raw[y * stride] = 0; // filter: none
        for (let x = 0; x < size; x++) {
            const idx = y * stride + 1 + x * 4;
            const [r, g, b, a] = pixelFn(x, y, size);
            raw[idx] = r; raw[idx+1] = g; raw[idx+2] = b; raw[idx+3] = a;
        }
    }
    const idat = zlib.deflateSync(raw, { level: 9 });
    
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // PNG sig
        chunk('IHDR', ihdr),
        chunk('IDAT', idat),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

// 绘制剑图标
function swordPixel(size) {
    const cx = size / 2, cy = size / 2;
    const sl = size * 0.55, sw = size * 0.08;
    const outerR = size / 2 - size * 0.06;
    const grad = (x, y) => {
        const t = (x + y) / (size * 2);
        // #0f0c29 -> #302b63 -> #24243e
        const r = Math.floor(15 + t * (48 - 15));
        const g = Math.floor(12 + t * (43 - 12));
        const b = Math.floor(41 + t * (62 - 41));
        return [r, g, b];
    };
    // 背景
    const bg = grad(0, 0);
    // 圆形遮罩
    return (x, y, s) => {
        const dx = x - cx, dy = y - cy;
        const dist = Math.sqrt(dx*dx + dy*dy);
        // 圆形裁剪
        if (dist > size/2 - 2) return [bg[0], bg[1], bg[2], 0];
        // 外圈金色
        if (dist > outerR) return [255, 215, 0, 255];
        // 背景
        const c = grad(x, y);
        // 剑判定
        // 剑刃区域（三角形）
        const swordTop = cy - sl * 0.4;
        const swordBottom = cy + sl * 0.35;
        // 归一化 y in sword
        const ny = (y - swordTop) / (swordBottom - swordTop); // 0 at top, 1 at bottom
        if (ny >= 0 && ny <= 1) {
            // 宽度随 ny 变化
            const halfW = sw * 0.5 * (1 - ny * 0.4);
            if (Math.abs(x - cx) < halfW) {
                // 剑刃颜色
                if (ny < 0.1) return [255, 215, 0, 255]; // 剑尖金色
                return [220, 220, 230, 255];
            }
            // 护手
            if (ny > 0.88 && ny < 0.95 && Math.abs(x - cx) < sw * 1.2) return [255, 215, 0, 255];
            // 剑柄
            if (ny > 0.95 && Math.abs(x - cx) < sw * 0.6) return [139, 69, 19, 255];
        }
        // 粒子
        for (let i = 0; i < 12; i++) {
            const ang = (i / 12) * Math.PI * 2;
            const d = sl * 0.5 + (i % 3) * size * 0.04;
            const px = cx + Math.cos(ang) * d;
            const py = cy + Math.sin(ang) * d;
            if (Math.abs(x - px) < size*0.02 && Math.abs(y - py) < size*0.02) {
                return [255, 215, 0, 160];
            }
        }
        return [c[0], c[1], c[2], 255];
    };
}

[192, 512].forEach(size => {
    const fn = swordPixel(size);
    const png = makePNG(size, fn);
    fs.writeFileSync(`icon-${size}.png`, png);
    console.log(`✅ icon-${size}.png (${png.length} bytes)`);
});
console.log('\n🎉 图标生成完成！');

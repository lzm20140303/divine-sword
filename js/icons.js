// ============================================================
//  icons.js — 用 Canvas 在运行时生成 PWA 图标
//  避免外部图片依赖，离线也能正常安装
// ============================================================

export function generateIcons() {
    const sizes = [192, 512];
    const icons = {};
    
    sizes.forEach(size => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // 背景渐变
        const grad = ctx.createLinearGradient(0, 0, size, size);
        grad.addColorStop(0, '#0f0c29');
        grad.addColorStop(0.5, '#302b63');
        grad.addColorStop(1, '#24243e');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        
        // 外圈金色边框
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = size * 0.04;
        ctx.beginPath();
        ctx.arc(size/2, size/2, size/2 - size*0.06, 0, Math.PI * 2);
        ctx.stroke();
        
        // 剑身
        const cx = size / 2;
        const cy = size / 2;
        const swordLen = size * 0.55;
        const swordW = size * 0.08;
        
        // 剑刃
        ctx.fillStyle = '#e0e0e0';
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = size * 0.08;
        ctx.beginPath();
        ctx.moveTo(cx - swordW/2, cy + swordLen * 0.35);
        ctx.lineTo(cx + swordW/2, cy + swordLen * 0.35);
        ctx.lineTo(cx + swordW * 0.3, cy - swordLen * 0.4);
        ctx.lineTo(cx - swordW * 0.3, cy - swordLen * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // 剑柄
        ctx.fillStyle = '#8b4513';
        ctx.fillRect(cx - swordW * 0.6, cy + swordLen * 0.35, swordW * 1.2, swordLen * 0.15);
        
        // 护手
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(cx - swordW * 1.2, cy + swordLen * 0.3, swordW * 2.4, swordW * 0.25);
        
        // 剑尖光芒
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(cx, cy - swordLen * 0.45, size * 0.04, 0, Math.PI * 2);
        ctx.fill();
        
        // 粒子
        ctx.fillStyle = 'rgba(255, 215, 0, 0.6)';
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.5;
            const dist = swordLen * 0.5 + Math.random() * size * 0.1;
            const px = cx + Math.cos(angle) * dist;
            const py = cy + Math.sin(angle) * dist;
            const r = size * (0.01 + Math.random() * 0.02);
            ctx.beginPath();
            ctx.arc(px, py, r, 0, Math.PI * 2);
            ctx.fill();
        }
        
        icons[size] = canvas.toDataURL('image/png');
    });
    
    return icons;
}

// ============================================================
//  effects.js — 视觉特效层
// ============================================================

export const Effects = {
    showDamage(amount, isCrit, targetIcon) {
        const layer = document.getElementById('effect-layer');
        const monsterEl = document.getElementById('monster-icon');
        if (!layer || !monsterEl) return;
        const rect = monsterEl.getBoundingClientRect();
        const popup = document.createElement('div');
        popup.className = `damage-popup ${isCrit ? 'crit' : ''}`;
        popup.textContent = `-${amount.toFixed(0)}`;
        popup.style.left = `${rect.left + rect.width / 2}px`;
        popup.style.top  = `${rect.top}px`;
        layer.appendChild(popup);
        if (isCrit) {
            const critText = document.createElement('div');
            critText.className = 'crit-text';
            critText.textContent = 'CRIT!';
            critText.style.left = `${rect.left + rect.width / 2}px`;
            critText.style.top  = `${rect.top - 50}px`;
            layer.appendChild(critText);
            setTimeout(() => critText.remove(), 1000);
        }
        setTimeout(() => popup.remove(), 1000);
    },

    shakeScreen() {
        document.body.style.animation = 'shake 0.2s';
        setTimeout(() => { document.body.style.animation = ''; }, 200);
    },

    showCrit() { /* hook for future crit effects */ },

    forgeFlash() {
        document.body.style.animation = 'forgeFlash 0.5s';
        setTimeout(() => { document.body.style.animation = ''; }, 500);
    },
};

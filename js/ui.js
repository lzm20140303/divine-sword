// ============================================================
//  ui.js — UI 管理器：模态框、确认弹窗、离线报告
// ============================================================

import { Renderer } from './renderer.js';

export const UIManager = {
    // ---------- 模态框通用 ----------
    openModal(id) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'flex';
    },
    closeModal(id) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    },

    // ---------- 背包 ----------
    openInventoryModal(state, filterType = null) {
        const body = document.getElementById('inventory-body');
        if (!body) return;
        let html = '<div class="inventory-grid">';
        const filtered = state.inventory.filter(item => !filterType || item.type === filterType);
        if (filtered.length === 0) html += '<p>空空如也...</p>';
        filtered.forEach(item => {
            const isEquipped = state.equipped[item.type]?.id === item.id;
            const elemIcon = item.element ? this._elementIcon(item.element) : '';
            const isHidden = item.secret;
            const canDevour = item.type === 'weapon' && !isEquipped && !isHidden;
            html += `<div class="inv-slot ${isEquipped?'equipped':''} ${isHidden?'hidden-sword':''}">
                <div class="inv-icon">${item.icon}</div>
                <div class="inv-name">${item.name}</div>
                <div class="inv-stats">攻:${item.stats.attack||0} 暴:${item.stats.crit||0}%</div>
                <div class="inv-stats">闪:${item.stats.dodge||0}% 格:${item.stats.block||0}%</div>
                ${elemIcon?`<div class="inv-element">属性: ${elemIcon}</div>`:''}
                <div style="font-size:0.7rem; color:${isEquipped?'cyan':'transparent'}">${isEquipped?'已装备':''}</div>
                <div class="inv-actions">
                    ${!isEquipped?`<button class="inv-btn equip" onclick="Game.equipItem(${item.id})">装备</button>`:''}
                    ${canDevour?`<button class="inv-btn devour" onclick="Game.devourSword(${item.id})">吞噬</button>`:''}
                </div></div>`;
        });
        html += '</div>';
        body.innerHTML = html;
        this.openModal('inventory-modal');
    },

    // ---------- 锻造炉 ----------
    openForgeModal(state) {
        const body = document.getElementById('forge-body');
        if (!body) return;
        // 批量锻造下拉
        const select = document.getElementById('batch-forge-select');
        if (select) {
            select.innerHTML = '';
            state.forgeRecipes.forEach(r => {
                if (r.type !== 'weapon') return;
                if (r.secret && !state.secretSwordsUnlocked.includes(r.id)) return;
                const opt = document.createElement('option');
                opt.value = r.id; opt.textContent = `${r.icon} ${r.name} (攻${r.stats.attack})`;
                select.appendChild(opt);
            });
        }
        this._updateBatchForgeInfo(state);

        let html = '<div class="inventory-grid">';
        state.forgeRecipes.forEach(r => {
            if (r.type !== 'weapon') return;
            if (r.secret && !state.secretSwordsUnlocked.includes(r.id)) return;
            const canForge = Object.keys(r.req).every(m => state.materials[m]?.count >= r.req[m]);
            const elemIcon = r.element ? this._elementIcon(r.element) : '';
            html += `<div class="inv-slot ${r.secret?'hidden-sword':''}" style="${!canForge?'opacity:0.5;':''}" onclick="${canForge?`Game.forgeItem('${r.id}')`:''}">
                <div class="inv-icon">${r.icon}</div><div class="inv-name">${r.name}</div>
                <div class="inv-stats">攻:${r.stats.attack||0} 暴:${r.stats.crit||0}%</div>
                ${elemIcon?`<div class="inv-element">属性: ${elemIcon}</div>`:''}
                <div style="font-size:0.7rem; color:#aaa; margin-top:3px;">需求材料</div>
                <div style="font-size:0.65rem; color:#ccc; text-align:left; margin-top:3px;">${Object.keys(r.req).map(m=>`${state.materials[m]?.icon||''}${r.req[m]}`).join(' ')}</div></div>`;
        });
        html += '</div>';
        body.innerHTML = html;
        this.openModal('forge-modal');
    },

    _updateBatchForgeInfo(state) {
        const select = document.getElementById('batch-forge-select');
        const info = document.getElementById('batch-forge-info');
        if (!select || !info) return;
        const recipe = state.forgeRecipes.find(r => r.id === select.value);
        if (!recipe) { info.textContent = ''; return; }
        const count = parseInt(document.getElementById('batch-forge-count')?.value) || 1;
        let matText = '';
        for (const m in recipe.req) {
            const need = recipe.req[m] * count;
            const have = state.materials[m]?.count || 0;
            matText += `${state.materials[m]?.icon} ${m}: ${have}/${need}${have>=need?' ✅':' ❌'} `;
        }
        const maxPossible = Object.keys(recipe.req).length > 0
            ? Math.min(...Object.keys(recipe.req).map(m => Math.floor((state.materials[m]?.count||0)/recipe.req[m])))
            : '∞';
        info.innerHTML = `${matText}<br>最多可锻造: <strong style="color:gold;">${maxPossible}</strong> 次${recipe.secret?' (有失败率)':''}`;
    },

    // ---------- 天赋树 ----------
    openTalentModal(state) {
        const container = document.getElementById('talent-tree-container');
        if (!container) return;
        container.innerHTML = '';
        for (const key in state.talentDefs) {
            const def = state.talentDefs[key];
            const cur = state.talents[key];
            const max = def.maxLv;
            const isMax = cur >= max;
            container.innerHTML += `<div style="background:rgba(255,255,255,0.05); border:1px solid #444; border-radius:8px; padding:12px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                <div><h4 style="color:#ffd700;">${def.name} Lv.${cur}/${max}</h4>
                <p style="font-size:0.8rem; color:#ccc;">${def.desc}</p>
                <p style="color:#ffd700; font-size:0.7rem;">${def.effect(cur)}</p></div>
                <button style="padding:8px 16px; border:none; border-radius:5px; cursor:pointer; font-weight:bold; color:white; background:${state.sp>0&&!isMax?'#3182ce':'#666'};" onclick="Game.learnTalent('${key}')" ${state.sp<=0||isMax?'disabled':''}>${isMax?'MAX':'升级'}</button></div>`;
        }
        const spEl = document.getElementById('modal-sp-count');
        if (spEl) spEl.textContent = state.sp;
        this.openModal('talent-modal');
    },

    // ---------- 存档槽位 ----------
    openSaveSlotsPanel() {
        const container = document.getElementById('save-slots-container');
        if (!container) return;
        const slots = [
            { id: 'slot1', name: '存档 1' },
            { id: 'slot2', name: '存档 2' },
            { id: 'slot3', name: '存档 3' },
            { id: 'auto',  name: '自动存档' },
        ];
        container.innerHTML = '';
        slots.forEach(slot => {
            const timeKey = `DivineSwordSlot_${slot.id}_time`;
            const saveTime = localStorage.getItem(timeKey) || '无存档';
            const hasData = !!localStorage.getItem(`DivineSwordSlot_${slot.id}`);
            container.innerHTML += `<div class="save-slot ${hasData?'':'empty'}" style="${hasData?'':'opacity:0.5;'}">
                <div class="save-slot-name">${slot.name}</div>
                <div class="save-slot-info">${saveTime}</div>
                <div style="margin-top:5px; display:flex; gap:5px; justify-content:center;">
                    <button style="padding:3px 8px; font-size:0.7rem; border:none; border-radius:3px; cursor:pointer; background:#38a169; color:white;" onclick="Game.saveToSlot('${slot.id}'); UIManager.refreshSaveSlots(); addLog('已保存到${slot.name}！','log-reward');">保存</button>
                    <button style="padding:3px 8px; font-size:0.7rem; border:none; border-radius:3px; cursor:pointer; background:${hasData?'#3182ce':'#666'}; color:white;" onclick="${hasData?`Game.loadFromSlot('${slot.id}'); UIManager.closeModal('save-modal');`:'void(0)'}" ${hasData?'':'disabled'}>读取</button>
                </div></div>`;
        });
    },

    refreshSaveSlots() { this.openSaveSlotsPanel(); },

    // ---------- 离线报告 ----------
    showOfflineReport(state, seconds, kills, materials) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay'; modal.style.display = 'flex';
        let matsHtml = '';
        for (const matId in materials) { matsHtml += `<p>${state.materials[matId]?.icon} ${state.materials[matId]?.name} x${materials[matId]}</p>`; }
        modal.innerHTML = `<div class="modal-content"><div class="modal-header"><h2>⏱️ 离线收益报告</h2><span class="close-btn" onclick="this.closest('.modal-overlay').remove()">&times;</span></div>
            <div id="offline-report">
                <p>离线时间: ${Math.floor(seconds/3600)}小时 ${(seconds%3600/60).toFixed(0)}分钟</p>
                <p>剑灵替你击败了 <span style="color:gold;">${kills}</span> 只怪物</p>
                <h3>获得材料:</h3>${matsHtml || '<p>一无所获...</p>'}</div></div>`;
        document.body.appendChild(modal);
    },

    // ---------- 确认弹窗 ----------
    showConfirm(message, onYes) {
        document.getElementById('confirm-message').innerHTML = message;
        const yesBtn = document.getElementById('confirm-yes');
        yesBtn.onclick = () => { onYes(); this.closeModal('confirm-modal'); };
        this.openModal('confirm-modal');
    },

    // ---------- 元素图标辅助 ----------
    _elementIcon(elem) {
        const icons = { fire:'🔥', water:'💧', earth:'🌿', metal:'⚔️', wood:'🪵', air:'💨', light:'☀️', dark:'🌑' };
        return icons[elem] || '';
    },
};

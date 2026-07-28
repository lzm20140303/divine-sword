// ============================================================
//  renderer.js — 所有 DOM 渲染逻辑
// ============================================================

import { MAP_DEFS, GUILD_TECH_DEFS, RAID_DEFS } from './data.js';
import { Mechanics, AutoSystem } from './mechanics.js';
import { GuildSystem, RaidSystem, TradeSystem, LeaderboardSystem } from './guild.js';

export const Renderer = {
    // ---------- 总入口 ----------
    init(state) { this.renderAll(state); },
    renderAll(state) {
        this.renderStats(state);
        this.renderMaterials(state);
        this.renderGear(state);
        this.updateMonster(state);
        this.updateBoss(state);
        this.updateQuests(state);
        this.updateParticles(state);
        this.updateStamina(state);
        this.updateMapRecommendation(state);
        this.updateAutoButtons(state);
        this.updateAutoStatus(state);
    },

    // ---------- 神剑属性 ----------
    renderStats(state) {
        const stats = Mechanics.getTotalStats(state);
        document.getElementById('sword-icon').textContent = state.equipped.weapon?.icon || '❓';
        document.getElementById('sword-name').textContent = state.equipped.weapon?.name || '无武器';
        document.getElementById('stat-attack').textContent = stats.attack.toFixed(1);
        document.getElementById('stat-crit').textContent  = stats.crit.toFixed(1) + '%';
        document.getElementById('stat-dodge').textContent = stats.dodge.toFixed(1) + '%';
        document.getElementById('stat-sp').textContent    = state.sp;
    },

    // ---------- 材料仓库 ----------
    renderMaterials(state) {
        const grid = document.getElementById('materials-grid');
        if (!grid) return;
        grid.innerHTML = '';
        for (const key in state.materials) {
            const mat = state.materials[key];
            grid.innerHTML += `<div class="mat-item" onclick="Game.state.materials['${key}'].count+=${1+state.talents.gather}; Renderer.renderMaterials(Game.state); addLog('采集了${mat.name}');"><div class="mat-icon">${mat.icon}</div><div class="mat-name">${mat.name}</div><div class="mat-count">x${mat.count}</div></div>`;
        }
    },

    // ---------- 装备栏 ----------
    renderGear(state) {
        const slots = ['ring', 'amulet', 'armor'];
        slots.forEach(slot => {
            const el = document.getElementById(`gear-${slot}`);
            if (!el) return;
            const item = state.equipped[slot];
            if (item) {
                el.classList.remove('empty'); el.classList.add('equipped');
                el.innerHTML = `<div class="gear-icon">${item.icon}</div><div class="gear-name">${item.name}</div>`;
            } else {
                el.classList.add('empty'); el.classList.remove('equipped');
                const icons = { ring: '💍', amulet: '📿', armor: '🥋' };
                const names = { ring: '戒指', amulet: '护符', armor: '盔甲' };
                el.innerHTML = `<div class="gear-icon">${icons[slot]}</div><div class="gear-name">${names[slot]}</div>`;
            }
        });
    },

    // ---------- 怪物 ----------
    updateMonster(state) {
        const m = state.monster;
        document.getElementById('monster-icon').textContent = m.icon;
        document.getElementById('monster-name').textContent = `${m.name} Lv.${m.level}`;
        document.getElementById('monster-element').textContent = `(属性:${Mechanics.getElementIcon(m.element)})`;
        document.getElementById('monster-hp').textContent = m.hp.toFixed(0);
        document.getElementById('monster-max-hp').textContent = m.maxHp.toFixed(0);
        document.getElementById('monster-hp-bar').style.width = `${(m.hp / m.maxHp) * 100}%`;
    },

    // ---------- 体力 ----------
    updateStamina(state) {
        const el = document.getElementById('stamina-value');
        const maxEl = document.getElementById('stamina-max');
        const bar = document.getElementById('stamina-bar-fill');
        if (el) el.textContent = state.stamina;
        if (maxEl) maxEl.textContent = state.maxStamina;
        if (bar) bar.style.width = (state.stamina / state.maxStamina) * 100 + '%';
    },

    // ---------- BOSS ----------
    updateBoss(state) {
        const b = state.boss;
        document.getElementById('boss-timer').textContent = b.timer;
        document.getElementById('boss-hp-bar').style.width = `${(b.hp / b.maxHp) * 100}%`;
        document.getElementById('boss-hp-text').textContent = b.hp.toLocaleString();
        const rankList = document.getElementById('boss-rank-list');
        rankList.innerHTML = '';
        if (b.damageList.length === 0) rankList.innerHTML = '<li>暂无数据</li>';
        else b.damageList.slice(0, 5).forEach((entry, i) =>
            rankList.innerHTML += `<li><span>${i+1}. ${entry.name}</span><span>${entry.damage.toFixed(0)}</span></li>`
        );
    },

    // ---------- 任务 ----------
    updateQuests(state) {
        const list = document.getElementById('quest-list');
        if (!list) return;
        list.innerHTML = '';
        state.quests.forEach(quest => {
            const li = document.createElement('li');
            li.className = `quest-item ${quest.completed ? 'completed' : ''}`;
            const rewardStr = Object.keys(quest.reward)
                .filter(k => k !== 'sp')
                .map(k => `${state.materials[k]?.icon || ''}${quest.reward[k]}`)
                .join(' ');
            li.innerHTML = `<div>${quest.name}: ${quest.desc} ${quest.completed ? '✅' : ''}</div>
                <div class="quest-progress"><div class="quest-progress-bar" style="width:${(quest.progress/quest.target)*100}%"></div></div>
                <div class="quest-reward">奖励: SP+${quest.reward.sp} ${rewardStr}</div>`;
            list.appendChild(li);
        });
    },

    // ---------- 粒子特效 ----------
    updateParticles(state) {
        const container = document.getElementById('particle-effect');
        if (!container) return;
        container.innerHTML = '';
        const wid = state.equipped.weapon?.id;
        if (['holy','gold','death'].includes(wid)) {
            for (let i = 0; i < 10; i++) {
                const p = document.createElement('div');
                p.className = 'particle';
                p.style.left = `${Math.random()*100}%`;
                p.style.top  = `${Math.random()*100}%`;
                p.style.animationDelay = `${Math.random()*2}s`;
                container.appendChild(p);
            }
        }
    },

    // ---------- 地图推荐 ----------
    updateMapRecommendation(state) {
        ['mine','forest','volcano','star'].forEach(id => {
            const el = document.getElementById(`map-${id}`);
            if (el) el.classList.remove('recommended');
        });
        if (state.autoSettings.explore) {
            const best = AutoSystem.pickBestMap(state);
            if (best) {
                const el = document.getElementById(`map-${best}`);
                if (el) el.classList.add('recommended');
            }
        }
    },

    // ---------- 自动按钮状态 ----------
    updateAutoButtons(state) {
        const fightBtn     = document.getElementById('btn-auto-fight');
        const fightBtnSm   = document.getElementById('btn-auto-fight-small');
        const exploreBtn   = document.getElementById('btn-auto-explore');
        const indicator    = document.getElementById('auto-indicator');
        if (!fightBtn) return;

        if (state.autoSettings.fight) {
            fightBtn.className = 'auto-btn on';
            fightBtn.textContent = '⚡ 自动战斗: 开';
            if (fightBtnSm) { fightBtnSm.textContent = '⚡ 自动(开)'; fightBtnSm.style.background = 'linear-gradient(145deg, #38a169, #276749)'; }
            indicator?.classList.add('active');
        } else {
            fightBtn.className = 'auto-btn off';
            fightBtn.textContent = '⚡ 自动战斗: 关';
            if (fightBtnSm) { fightBtnSm.textContent = '⚡ 自动'; fightBtnSm.style.background = 'linear-gradient(145deg, #e53e3e, #9b2c2c)'; }
            if (!state.autoSettings.explore) indicator?.classList.remove('active');
        }
        if (state.autoSettings.explore) {
            exploreBtn.className = 'auto-btn on'; exploreBtn.textContent = '🗺️ 自动探索: 开';
            indicator?.classList.add('active');
        } else {
            exploreBtn.className = 'auto-btn off'; exploreBtn.textContent = '🗺️ 自动探索: 关';
            if (!state.autoSettings.fight) indicator?.classList.remove('active');
        }
    },

    // ---------- 自动状态文字 ----------
    updateAutoStatus(state) {
        const el = document.getElementById('auto-status-text');
        if (!el) return;
        const parts = [];
        if (state.autoSettings.fight)       parts.push(`⚡自动战斗 ON (${state.autoSettings.fightInterval}ms)`);
        if (state.autoSettings.explore)     parts.push('🗺️自动探索 ON');
        if (state.autoSettings.smartUpgrade) parts.push(`🔧智能升级 ON (阈值${state.autoSettings.smartUpgradeThreshold}铁, 上限${state.autoSettings.smartUpgradeMaxAtk}攻)`);
        if (state.autoSettings.autoDevour)   parts.push('🍽️自动吞噬 ON');
        if (parts.length === 0) { el.textContent = '所有自动化功能已停止'; el.className = 'auto-status stopped'; }
        else { el.textContent = parts.join(' | '); el.className = 'auto-status'; }

        const hint = document.getElementById('auto-explore-hint');
        if (hint) {
            if (state.autoSettings.explore) {
                const best = AutoSystem.pickBestMap(state);
                const names = { mine: '矿洞', forest: '森林', volcano: '火山', star: '星空' };
                hint.textContent = best ? `推荐地图: ${names[best]||best}` : '暂无推荐';
            } else { hint.textContent = ''; }
        }
    },

    // ============================================================
    //  公会 / 组队 / 交易 渲染
    // ============================================================

    // ---------- 公会面板 ----------
    renderGuildPanel(state) {
        const container = document.getElementById('guild-body');
        if (!container) return;
        const guild = GuildSystem.getGuild(state);
        if (!guild) {
            // 未加入公会 → 显示创建/加入
            let html = `<h4 style="color:#ffd700; margin-bottom:10px;">创建公会</h4>
                <div style="display:flex; gap:8px; margin-bottom:15px;">
                    <input type="text" id="guild-create-name" placeholder="公会名称" style="flex:1; padding:6px; border-radius:4px; border:1px solid #666; background:#333; color:white;">
                    <button class="btn-action-main btn-forge" style="padding:6px 12px;" onclick="Game.createGuildFromUI()">创建</button>
                </div>
                <h4 style="color:#4fd1c7; margin-bottom:10px;">公会列表</h4>
                <div id="guild-list"></div>`;
            container.innerHTML = html;
            this._renderGuildList(state);
            return;
        }

        // 已加入公会
        let html = `<h4 style="color:#ffd700;">⚔️ ${guild.name}</h4>`;
        html += `<p style="font-size:0.8rem; color:#aaa; margin-bottom:10px;">成员: ${guild.members.length} 人 | 你的贡献: ${state.guild.contribution || 0}</p>`;

        // 成员列表
        html += `<h5 style="color:#4fd1c7; margin:10px 0 5px;">成员</h5><div style="font-size:0.8rem;">`;
        guild.members.forEach(m => {
            html += `<div style="display:flex; justify-content:space-between; padding:3px 0; border-bottom:1px dotted #444;">
                <span>${m.name} (${m.weapon})</span><span>攻:${m.atk} | 捐赠:${m.donated}</span></div>`;
        });
        html += `</div>`;

        // 公会仓库
        html += `<h5 style="color:#ffd700; margin:10px 0 5px;">公会仓库</h5><div style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:10px;">`;
        Object.keys(guild.treasury || {}).forEach(matId => {
            const count = guild.treasury[matId];
            if (count > 0) html += `<span style="background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:3px; font-size:0.75rem;">${state.materials[matId]?.icon||''} ${count}</span>`;
        });
        html += `</div>`;

        // 捐赠
        html += `<h5 style="color:#38a169; margin:10px 0 5px;">捐赠材料</h5>
            <div style="display:flex; gap:5px; flex-wrap:wrap; margin-bottom:10px;" id="donate-row"></div>`;

        // 公会科技
        html += `<h5 style="color:#805ad5; margin:10px 0 5px;">公会科技</h5><div id="guild-tech-list"></div>`;

        // 离开公会
        html += `<button class="btn-action-main btn-new" style="margin-top:10px;" onclick="Game.leaveGuildFromUI()">离开公会</button>`;

        container.innerHTML = html;
        this._renderDonateRow(state);
        this._renderGuildTech(state);
    },

    _renderGuildList(state) {
        const container = document.getElementById('guild-list');
        if (!container) return;
        const guilds = GuildSystem.listGuilds();
        if (guilds.length === 0) { container.innerHTML = '<p style="color:#aaa; font-size:0.8rem;">暂无公会，创建一个吧！</p>'; return; }
        container.innerHTML = '';
        guilds.forEach(g => {
            const div = document.createElement('div');
            div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:6px; background:rgba(255,255,255,0.05); border-radius:5px; margin-bottom:5px; font-size:0.8rem;';
            div.innerHTML = `<span>${g.name} (${g.memberCount}人, 总攻:${g.totalAtk})</span>
                <button style="padding:3px 8px; font-size:0.7rem; border:none; border-radius:3px; background:#3182ce; color:white; cursor:pointer;" onclick="Game.joinGuildFromUI('${g.id}')">加入</button>`;
            container.appendChild(div);
        });
    },

    _renderDonateRow(state) {
        const container = document.getElementById('donate-row');
        if (!container) return;
        Object.keys(state.materials).forEach(matId => {
            const mat = state.materials[matId];
            if (mat.count <= 0) return;
            const btn = document.createElement('button');
            btn.style.cssText = 'padding:3px 6px; font-size:0.7rem; border:1px solid #38a169; border-radius:3px; background:rgba(56,161,105,0.2); color:#68d391; cursor:pointer;';
            btn.textContent = `${mat.icon} 捐1 (有${mat.count})`;
            btn.onclick = () => Game.donateFromUI(matId, 1);
            container.appendChild(btn);
        });
    },

    _renderGuildTech(state) {
        const container = document.getElementById('guild-tech-list');
        if (!container) return;
        const guild = GuildSystem.getGuild(state);
        if (!guild) return;
        container.innerHTML = '';
        Object.keys(GUILD_TECH_DEFS).forEach(techId => {
            const def = GUILD_TECH_DEFS[techId];
            const lvl = guild.tech?.[techId] || 0;
            const cost = def.cost(lvl);
            const canUpgrade = (state.guild?.contribution || 0) >= cost && lvl < def.maxLv;
            const div = document.createElement('div');
            div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:6px; background:rgba(255,255,255,0.05); border-radius:5px; margin-bottom:5px; font-size:0.8rem;';
            div.innerHTML = `<div><strong style="color:#ffd700;">${def.name}</strong> Lv.${lvl}/${def.maxLv} <span style="color:#aaa; font-size:0.7rem;">${def.effect(lvl)}</span></div>
                <button ${canUpgrade?'':'disabled'} style="padding:3px 8px; font-size:0.7rem; border:none; border-radius:3px; background:${canUpgrade?'#805ad5':'#666'}; color:white; cursor:${canUpgrade?'pointer':'not-allowed'};" onclick="Game.upgradeGuildTechFromUI('${techId}')">升级(${cost}贡献)</button>`;
            container.appendChild(div);
        });
    },

    // ---------- 组队副本面板 ----------
    renderRaidPanel(state) {
        const container = document.getElementById('raid-body');
        if (!container) return;

        let html = `<h4 style="color:#ffd700; margin-bottom:10px;">组队副本</h4>`;

        // 我的当前副本
        const myRaid = RaidSystem.getMyRaid(state);
        if (myRaid) {
            const def = RAID_DEFS.find(r => r.id === myRaid.raidId);
            html += `<div style="background:rgba(229,62,62,0.1); border:1px solid #e53e3e; border-radius:8px; padding:10px; margin-bottom:10px;">
                <h5 style="color:#e53e3e;">${def?.icon} ${def?.name} (${myRaid.status==='waiting'?'等待中':'战斗中'})</h5>
                <p style="font-size:0.8rem;">BOSS HP: ${myRaid.bossHp.toFixed(0)} / ${myRaid.bossMaxHp}</p>
                <div style="height:15px; background:#333; border-radius:5px; overflow:hidden; margin:5px 0;"><div style="height:100%; background:linear-gradient(90deg,#e53e3e,#ff8c00); width:${(myRaid.bossHp/myRaid.bossMaxHp)*100}%;"></div></div>
                <p style="font-size:0.75rem; color:#aaa;">成员: ${myRaid.members.map(m=>m.name+'('+m.weapon+')').join(', ')}</p>`;
            if (myRaid.status === 'waiting') {
                html += `<button class="btn-action-main btn-forge" style="margin-top:5px;" onclick="Game.startRaidFromUI('${myRaid.id}')">开始战斗</button>`;
            } else if (myRaid.status === 'completed') {
                html += `<button class="btn-action-main btn-inventory" style="margin-top:5px;" onclick="Game.claimRaidFromUI('${myRaid.id}')">领取奖励</button>`;
            } else {
                html += `<button class="btn-action-main btn-talent" style="margin-top:5px;" onclick="Game.attackRaidFromUI('${myRaid.id}')">攻击BOSS</button>`;
            }
            html += `</div>`;
        }

        // 创建副本
        if (!myRaid) {
            html += `<h5 style="color:#4fd1c7; margin:5px 0;">创建副本</h5><div style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:10px;">`;
            RAID_DEFS.forEach(def => {
                html += `<button style="padding:5px 10px; font-size:0.75rem; border:1px solid #4fd1c7; border-radius:5px; background:rgba(79,209,199,0.1); color:#4fd1c7; cursor:pointer;" onclick="Game.createRaidFromUI('${def.id}')">${def.icon} ${def.name} (${def.requiredMembers}人)</button>`;
            });
            html += `</div>`;
        }

        // 可加入的副本
        const openRaids = RaidSystem.listOpenRaids(state);
        html += `<h5 style="color:#ffd700; margin:10px 0 5px;">开放副本 (可加入)</h5>`;
        if (openRaids.length === 0) {
            html += `<p style="font-size:0.8rem; color:#aaa;">暂无开放副本</p>`;
        } else {
            openRaids.forEach(r => {
                if (myRaid && myRaid.id === r.id) return;
                html += `<div style="display:flex; justify-content:space-between; align-items:center; padding:5px; background:rgba(255,255,255,0.05); border-radius:5px; margin-bottom:3px; font-size:0.75rem;">
                    <span>${r.name} (${r.host}, ${r.memberCount}/${r.maxMembers})</span>
                    <button style="padding:2px 6px; font-size:0.7rem; border:none; border-radius:3px; background:#3182ce; color:white; cursor:pointer;" onclick="Game.joinRaidFromUI('${r.id}')">加入</button></div>`;
            });
        }

        container.innerHTML = html;
    },

    // ---------- 交易/赠送面板 ----------
    renderTradePanel(state) {
        const container = document.getElementById('trade-body');
        if (!container) return;

        let html = `<h4 style="color:#ffd700; margin-bottom:10px;">📬 消息箱</h4>`;

        // 收件箱
        const inbox = TradeSystem.getInbox(state);
        html += `<h5 style="color:#4fd1c7;">收件箱 (${inbox.length})</h5>`;
        if (inbox.length === 0) html += `<p style="font-size:0.8rem; color:#aaa;">暂无消息</p>`;
        inbox.forEach(msg => {
            html += `<div style="background:rgba(255,255,255,0.05); border:1px solid #444; border-radius:6px; padding:8px; margin-bottom:5px; font-size:0.75rem;">
                <div><strong>${msg.from}</strong> → 你 ${msg.type==='gift'?'🎁 赠送':'🔄 交易'}</div>`;
            if (msg.type === 'gift') {
                html += `<div>${state.materials[msg.matId]?.icon} x${msg.amount}${msg.message?` | 💬 ${msg.message}`:''}</div>
                    <div style="margin-top:3px; display:flex; gap:5px;">
                        <button style="padding:2px 6px; font-size:0.7rem; border:none; border-radius:3px; background:#38a169; color:white; cursor:pointer;" onclick="Game.acceptGiftFromUI('${msg.id}')">接受</button>
                        <button style="padding:2px 6px; font-size:0.7rem; border:none; border-radius:3px; background:#e53e3e; color:white; cursor:pointer;" onclick="Game.deleteMessageFromUI('${msg.id}')">删除</button>
                    </div>`;
            } else {
                const itemName = msg.item?.name || '未知物品';
                html += `<div>提供: 【${itemName}】 请求: ${msg.requestAmount}${state.materials[msg.requestMatId]?.icon||''}</div>
                    <div style="margin-top:3px; display:flex; gap:5px;">
                        <button style="padding:2px 6px; font-size:0.7rem; border:none; border-radius:3px; background:#38a169; color:white; cursor:pointer;" onclick="Game.acceptTradeFromUI('${msg.id}')">接受</button>
                        <button style="padding:2px 6px; font-size:0.7rem; border:none; border-radius:3px; background:#e53e3e; color:white; cursor:pointer;" onclick="Game.rejectTradeFromUI('${msg.id}')">拒绝</button>
                    </div>`;
            }
            html += `</div>`;
        });

        // 发件箱
        const outbox = TradeSystem.getOutbox(state);
        html += `<h5 style="color:#d69e2e; margin:10px 0 5px;">发件箱 (${outbox.length})</h5>`;
        if (outbox.length === 0) html += `<p style="font-size:0.8rem; color:#aaa;">暂无发送</p>`;
        outbox.slice(0, 5).forEach(msg => {
            const statusText = msg.type==='trade' ? (msg.status==='accepted'?'✅已接受':msg.status==='rejected'?'❌已拒绝':'⏳等待中') : '🎁已发送';
            html += `<div style="background:rgba(255,255,255,0.03); border:1px solid #333; border-radius:6px; padding:6px; margin-bottom:3px; font-size:0.7rem; color:#aaa;">
                → ${msg.to} ${msg.type==='gift'?`${state.materials[msg.matId]?.icon}x${msg.amount}`:'物品交易'} ${statusText}</div>`;
        });

        // 发送赠送
        html += `<h5 style="color:#38a169; margin:10px 0 5px;">发送赠送</h5>
            <div style="display:flex; gap:5px; flex-wrap:wrap; margin-bottom:5px;">
                <input type="text" id="gift-target" placeholder="目标玩家名" style="padding:4px; border-radius:3px; border:1px solid #666; background:#333; color:white; font-size:0.75rem; width:120px;">
                <select id="gift-mat" style="padding:4px; border-radius:3px; background:#333; color:white; border:1px solid #666; font-size:0.75rem;"></select>
                <input type="number" id="gift-amount" value="1" min="1" style="padding:4px; border-radius:3px; border:1px solid #666; background:#333; color:white; font-size:0.75rem; width:60px;">
            </div>
            <input type="text" id="gift-msg" placeholder="留言（可选）" style="padding:4px; border-radius:3px; border:1px solid #666; background:#333; color:white; font-size:0.75rem; width:100%; margin-bottom:5px;">
            <button class="btn-action-main btn-inventory" style="padding:5px 12px;" onclick="Game.sendGiftFromUI()">🎁 发送赠送</button>`;

        container.innerHTML = html;

        // 填充材料下拉
        const select = document.getElementById('gift-mat');
        Object.keys(state.materials).forEach(matId => {
            if (state.materials[matId].count > 0) {
                const opt = document.createElement('option');
                opt.value = matId;
                opt.textContent = `${state.materials[matId].icon} ${state.materials[matId].name}`;
                select.appendChild(opt);
            }
        });
    },

    // ---------- 排行榜面板 ----------
    renderLeaderboard(state) {
        const container = document.getElementById('leaderboard-body');
        if (!container) return;
        const rankings = LeaderboardSystem.getRankings();
        const myBest = LeaderboardSystem.getMyBestRank(state);

        let html = `<h4 style="color:#ffd700; margin-bottom:10px;">🏆 BOSS伤害排行榜</h4>`;
        if (myBest) {
            html += `<p style="font-size:0.8rem; color:#4fd1c7; margin-bottom:10px;">你的最佳排名: 第${myBest.rank}名 (伤害: ${myBest.bestDamage})</p>`;
        }
        html += `<div style="font-size:0.8rem;">`;
        if (rankings.length === 0) html += '<p style="color:#aaa;">暂无数据</p>';
        rankings.forEach((entry, i) => {
            const isMe = entry.player === (state.playerName || '玩家');
            html += `<div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px dotted #444; ${isMe?'color:#ffd700; font-weight:bold;':''}">
                <span>${i+1}. ${entry.player} (${entry.weapon})</span><span>${entry.damage.toLocaleString()}</span></div>`;
        });
        html += `</div>`;
        container.innerHTML = html;
    },
};

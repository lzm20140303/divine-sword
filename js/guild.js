// ============================================================
//  guild.js — 公会系统 / 组队副本 / 交易赠送
//  所有数据存储在 localStorage（同设备多存档共享）
// ============================================================

import { GUILD_TECH_DEFS, RAID_DEFS } from './data.js';
import { Mechanics } from './mechanics.js';

const GUILD_STORAGE_KEY = 'DivineSword_Guilds';
const RAID_STORAGE_KEY  = 'DivineSword_Raids';

// ---------- 存储工具 ----------
function loadGuilds() {
    try { return JSON.parse(localStorage.getItem(GUILD_STORAGE_KEY)) || {}; }
    catch { return {}; }
}
function saveGuilds(g) {
    localStorage.setItem(GUILD_STORAGE_KEY, JSON.stringify(g));
}
function loadRaids() {
    try { return JSON.parse(localStorage.getItem(RAID_STORAGE_KEY)) || {}; }
    catch { return {}; }
}
function saveRaids(r) {
    localStorage.setItem(RAID_STORAGE_KEY, JSON.stringify(r));
}

// ============================================================
//  GuildSystem — 公会管理
// ============================================================
export const GuildSystem = {
    // ---------- 公会 CRUD ----------
    createGuild(state, name) {
        if (state.guild?.id) { return { ok: false, msg: "你已加入公会！" }; }
        if (!name || name.trim().length === 0) { return { ok: false, msg: "公会名不能为空！" }; }
        const guilds = loadGuilds();
        const id = 'guild_' + Date.now();
        const guild = {
            id, name: name.trim(), createdAt: Date.now(),
            members: [{
                name: state.playerName || '玩家',
                weapon: state.equipped.weapon?.name || '无名剑',
                atk: state.equipped.weapon?.stats.attack || 0,
                donated: 0,
            }],
            treasury: {},   // 公会仓库
            tech: {},       // 公会科技等级
            pendingDonations: [], // 待领取的捐赠
        };
        guilds[id] = guild;
        saveGuilds(guilds);

        state.guild = { id, name: guild.name, donated: 0, contribution: 0 };
        return { ok: true, msg: `公会「${guild.name}」创建成功！` };
    },

    joinGuild(state, guildId) {
        if (state.guild?.id) { return { ok: false, msg: "你已加入公会！" }; }
        const guilds = loadGuilds();
        const guild = guilds[guildId];
        if (!guild) { return { ok: false, msg: "公会不存在！" }; }
        guild.members.push({
            name: state.playerName || '玩家',
            weapon: state.equipped.weapon?.name || '无名剑',
            atk: state.equipped.weapon?.stats.attack || 0,
            donated: 0,
        });
        saveGuilds(guilds);
        state.guild = { id: guildId, name: guild.name, donated: 0, contribution: 0 };
        return { ok: true, msg: `已加入公会「${guild.name}」！` };
    },

    leaveGuild(state) {
        if (!state.guild?.id) return { ok: false, msg: "你不在公会中！" };
        const guilds = loadGuilds();
        const guild = guilds[state.guild.id];
        if (guild) {
            guild.members = guild.members.filter(m => m.name !== (state.playerName || '玩家'));
            if (guild.members.length === 0) {
                delete guilds[state.guild.id];
            }
            saveGuilds(guilds);
        }
        const oldName = state.guild.name;
        state.guild = null;
        return { ok: true, msg: `已离开公会「${oldName}」` };
    },

    getGuild(state) {
        if (!state.guild?.id) return null;
        const guilds = loadGuilds();
        return guilds[state.guild.id] || null;
    },

    listGuilds() {
        const guilds = loadGuilds();
        return Object.values(guilds).map(g => ({
            id: g.id, name: g.name, memberCount: g.members.length,
            totalAtk: g.members.reduce((s,m) => s + m.atk, 0),
        }));
    },

    // ---------- 捐赠系统 ----------
    donateMaterial(state, matId, amount) {
        if (!state.guild?.id) return { ok: false, msg: "请先加入公会！" };
        if ((state.materials[matId]?.count || 0) < amount) { return { ok: false, msg: "材料不足！" }; }
        const guilds = loadGuilds();
        const guild = guilds[state.guild.id];
        if (!guild) return { ok: false, msg: "公会不存在！" };

        state.materials[matId].count -= amount;
        guild.treasury[matId] = (guild.treasury[matId] || 0) + amount;

        const member = guild.members.find(m => m.name === (state.playerName || '玩家'));
        if (member) member.donated += amount;
        state.guild.donated = (state.guild.donated || 0) + amount;
        state.guild.contribution = (state.guild.contribution || 0) + amount;
        state.stats.donated = (state.stats.donated || 0) + amount;

        saveGuilds(guilds);
        return { ok: true, msg: `捐赠了 ${state.materials[matId]?.icon} ${amount} 个到公会仓库！贡献+${amount}` };
    },

    withdrawMaterial(state, matId, amount) {
        if (!state.guild?.id) return { ok: false, msg: "请先加入公会！" };
        const guilds = loadGuilds();
        const guild = guilds[state.guild.id];
        if (!guild) return { ok: false, msg: "公会不存在！" };
        if ((guild.treasury[matId] || 0) < amount) { return { ok: false, msg: "公会仓库不足！" }; }
        if ((state.guild.contribution || 0) < amount) { return { ok: false, msg: "贡献点不足！" }; }

        guild.treasury[matId] -= amount;
        state.materials[matId].count += amount;
        state.guild.contribution -= amount;
        saveGuilds(guilds);
        return { ok: true, msg: `从公会仓库取出了 ${state.materials[matId]?.icon} x${amount}` };
    },

    // ---------- 公会科技 ----------
    upgradeTech(state, techId) {
        if (!state.guild?.id) return { ok: false, msg: "请先加入公会！" };
        const def = GUILD_TECH_DEFS[techId];
        if (!def) return { ok: false, msg: "未知科技！" };
        const guilds = loadGuilds();
        const guild = guilds[state.guild.id];
        if (!guild) return { ok: false, msg: "公会不存在！" };

        const currentLv = guild.tech[techId] || 0;
        if (currentLv >= def.maxLv) { return { ok: false, msg: "已满级！" }; }
        const cost = def.cost(currentLv);
        if ((state.guild.contribution || 0) < cost) { return { ok: false, msg: `需要 ${cost} 贡献点！` }; }

        state.guild.contribution -= cost;
        guild.tech[techId] = currentLv + 1;
        saveGuilds(guilds);
        return { ok: true, msg: `公会科技「${def.name}」升至 Lv.${currentLv+1}！` };
    },

    // ---------- 公会加成预览 ----------
    getGuildBonuses(state) {
        const guild = this.getGuild(state);
        if (!guild) return null;
        const bonuses = {};
        Object.keys(guild.tech || {}).forEach(techId => {
            const lvl = guild.tech[techId];
            const def = GUILD_TECH_DEFS[techId];
            if (def) bonuses[techId] = { name: def.name, level: lvl, desc: def.effect(lvl) };
        });
        return bonuses;
    },
};

// ============================================================
//  RaidSystem — 组队副本
// ============================================================
export const RaidSystem = {
    // 创建副本队伍
    createRaid(state, raidId) {
        const def = RAID_DEFS.find(r => r.id === raidId);
        if (!def) return { ok: false, msg: "副本不存在！" };

        const raids = loadRaids();
        const id = 'raid_' + Date.now();
        const raid = {
            id, raidId,
            host: state.playerName || '玩家',
            hostWeapon: state.equipped.weapon?.name || '无名剑',
            hostAtk: Mechanics.getTotalStats(state).attack,
            members: [{
                name: state.playerName || '玩家',
                weapon: state.equipped.weapon?.name || '无名剑',
                atk: Mechanics.getTotalStats(state).attack,
            }],
            bossHp: def.bossHp, bossMaxHp: def.bossHp,
            damageList: [],
            status: 'waiting', // waiting | fighting | completed
            createdAt: Date.now(),
        };
        raids[id] = raid;
        saveRaids(raids);
        return { ok: true, raidId: id, msg: `副本「${def.name}」已创建，等待队友加入...` };
    },

    // 加入副本
    joinRaid(state, raidInstanceId) {
        const raids = loadRaids();
        const raid = raids[raidInstanceId];
        if (!raid) return { ok: false, msg: "队伍不存在！" };
        if (raid.status !== 'waiting') return { ok: false, msg: "队伍已开始战斗！" };
        if (raid.members.length >= RAID_DEFS.find(r => r.id === raid.raidId)?.requiredMembers) {
            return { ok: false, msg: "队伍已满！" };
        }
        raid.members.push({
            name: state.playerName || '玩家',
            weapon: state.equipped.weapon?.name || '无名剑',
            atk: Mechanics.getTotalStats(state).attack,
        });
        saveRaids(raids);
        return { ok: true, msg: `已加入副本队伍！(${raid.members.length}/${RAID_DEFS.find(r => r.id === raid.raidId).requiredMembers})` };
    },

    // 攻击副本BOSS（合并伤害）
    attackRaidBoss(state, raidInstanceId) {
        const raids = loadRaids();
        const raid = raids[raidInstanceId];
        if (!raid) return { ok: false, msg: "队伍不存在！" };
        if (raid.status === 'completed') return { ok: false, msg: "副本已完成！" };

        const stats = Mechanics.getTotalStats(state);
        let damage = stats.attack * (0.8 + Math.random() * 0.4);
        const isCrit = Math.random() * 100 < stats.crit;
        if (isCrit) damage *= 1.5;

        // 元素克制
        const def = RAID_DEFS.find(r => r.id === raid.raidId);
        const elemMult = Mechanics.getElementMultiplier(state.equipped.weapon?.element, def.element);
        damage *= elemMult;

        raid.bossHp -= damage;
        const playerName = state.playerName || '玩家';
        let record = raid.damageList.find(d => d.name === playerName);
        if (record) record.damage += damage; else raid.damageList.push({ name: playerName, damage });

        if (raid.bossHp <= 0) {
            raid.bossHp = 0;
            raid.status = 'completed';
            saveRaids(raids);
            return { ok: true, msg: `🎉 副本通关！总伤害: ${raid.damageList.reduce((s,d)=>s+d.damage,0).toFixed(0)}`, finished: true };
        }
        saveRaids(raids);
        return { ok: true, msg: `对副本BOSS造成 ${damage.toFixed(0)} 伤害！BOSS剩余 HP: ${raid.bossHp.toFixed(0)}` };
    },

    // 领取副本奖励
    claimRaidReward(state, raidInstanceId) {
        const raids = loadRaids();
        const raid = raids[raidInstanceId];
        if (!raid) return { ok: false, msg: "队伍不存在！" };
        if (raid.status !== 'completed') return { ok: false, msg: "副本未完成！" };

        const def = RAID_DEFS.find(r => r.id === raid.raidId);
        if (!def) return { ok: false, msg: "副本定义丢失！" };

        // 全员均分奖励
        const memberCount = raid.members.length;
        Object.keys(def.reward).forEach(matId => {
            if (matId === 'sp') {
                state.sp += def.reward[matId];
            } else if (state.materials[matId]) {
                const share = Math.ceil(def.reward[matId] / memberCount);
                state.materials[matId].count += share;
            }
        });
        state.stats.teamRaids = (state.stats.teamRaids || 0) + 1;

        // 删除副本记录
        delete raids[raidInstanceId];
        saveRaids(raids);
        return { ok: true, msg: `领取了副本奖励！SP+${def.reward.sp}` };
    },

    listOpenRaids(state) {
        const raids = loadRaids();
        return Object.values(raids).filter(r => r.status === 'waiting').map(r => {
            const def = RAID_DEFS.find(d => d.id === r.raidId);
            return {
                id: r.id, name: def?.name || '未知副本',
                host: r.host, memberCount: r.members.length,
                maxMembers: def?.requiredMembers || 0,
                bossHp: r.bossHp, bossMaxHp: r.bossMaxHp,
            };
        });
    },

    getMyRaid(state) {
        const raids = loadRaids();
        return Object.values(raids).find(r =>
            r.members.some(m => m.name === (state.playerName || '玩家'))
        ) || null;
    },
};

// ============================================================
//  TradeSystem — 交易 / 赠送
// ============================================================
const TRADE_STORAGE_KEY = 'DivineSword_Trades';

function loadTrades() {
    try { return JSON.parse(localStorage.getItem(TRADE_STORAGE_KEY)) || []; }
    catch { return []; }
}
function saveTrades(t) {
    localStorage.setItem(TRADE_STORAGE_KEY, JSON.stringify(t));
}

export const TradeSystem = {
    // 发送赠送（材料 + 留言）
    sendGift(state, targetPlayerName, matId, amount, message) {
        if (!targetPlayerName || targetPlayerName === (state.playerName || '玩家')) {
            return { ok: false, msg: "不能赠送给自己！" };
        }
        if ((state.materials[matId]?.count || 0) < amount) {
            return { ok: false, msg: "材料不足！" };
        }
        state.materials[matId].count -= amount;
        const trades = loadTrades();
        const gift = {
            id: 'gift_' + Date.now(),
            type: 'gift',
            from: state.playerName || '玩家',
            to: targetPlayerName,
            matId, amount, message: message || '',
            timestamp: Date.now(),
            read: false,
        };
        trades.push(gift);
        saveTrades(trades);
        state.stats.trades = (state.stats.trades || 0) + 1;
        return { ok: true, msg: `已向 ${targetPlayerName} 赠送 ${state.materials[matId]?.icon} x${amount}` };
    },

    // 发送装备交易提议
    offerItem(state, targetPlayerName, itemId, requestMatId, requestAmount) {
        const item = state.inventory.find(i => i.id === itemId);
        if (!item) return { ok: false, msg: "物品不存在！" };
        if (item.type === 'weapon' && state.equipped.weapon?.id === item.id) {
            return { ok: false, msg: "不能交易正在装备的武器！" };
        }
        const trades = loadTrades();
        const offer = {
            id: 'trade_' + Date.now(),
            type: 'trade',
            from: state.playerName || '玩家',
            to: targetPlayerName,
            item: { ...item },
            requestMatId, requestAmount,
            timestamp: Date.now(),
            status: 'pending', // pending | accepted | rejected
        };
        trades.push(offer);
        saveTrades(trades);
        return { ok: true, msg: `已向 ${targetPlayerName} 发起交易提议！` };
    },

    // 查看收到的消息
    getInbox(state) {
        const trades = loadTrades();
        const myName = state.playerName || '玩家';
        return trades.filter(t => t.to === myName).sort((a,b) => b.timestamp - a.timestamp);
    },

    // 查看发出的消息
    getOutbox(state) {
        const trades = loadTrades();
        const myName = state.playerName || '玩家';
        return trades.filter(t => t.from === myName).sort((a,b) => b.timestamp - a.timestamp);
    },

    // 接受赠送
    acceptGift(state, giftId) {
        const trades = loadTrades();
        const gift = trades.find(t => t.id === giftId);
        if (!gift || gift.type !== 'gift') return { ok: false, msg: "赠送不存在！" };
        if (gift.to !== (state.playerName || '玩家')) return { ok: false, msg: "不是给你的！" };

        if (state.materials[gift.matId]) {
            state.materials[gift.matId].count += gift.amount;
        }
        // 从列表中移除
        const idx = trades.indexOf(gift);
        trades.splice(idx, 1);
        saveTrades(trades);
        state.stats.trades = (state.stats.trades || 0) + 1;
        return { ok: true, msg: `收到了 ${state.materials[gift.matId]?.icon} x${gift.amount}！` };
    },

    // 接受交易
    acceptTrade(state, tradeId) {
        const trades = loadTrades();
        const trade = trades.find(t => t.id === tradeId);
        if (!trade || trade.type !== 'trade') return { ok: false, msg: "交易不存在！" };
        if (trade.to !== (state.playerName || '玩家')) return { ok: false, msg: "不是给你的！" };
        if (trade.status !== 'pending') return { ok: false, msg: "交易已处理！" };

        // 检查是否有请求的材料
        if (trade.requestMatId && trade.requestAmount > 0) {
            if ((state.materials[trade.requestMatId]?.count || 0) < trade.requestAmount) {
                return { ok: false, msg: `需要 ${trade.requestAmount} 个 ${trade.requestMatId}！` };
            }
            state.materials[trade.requestMatId].count -= trade.requestAmount;
        }

        // 接收物品
        const newItem = { ...trade.item, id: Date.now() + Math.random() };
        state.inventory.push(newItem);

        trade.status = 'accepted';
        saveTrades(trades);
        state.stats.trades = (state.stats.trades || 0) + 1;
        return { ok: true, msg: `交易成功！获得了【${newItem.name}】` };
    },

    // 拒绝
    rejectTrade(state, tradeId) {
        const trades = loadTrades();
        const trade = trades.find(t => t.id === tradeId);
        if (!trade) return { ok: false, msg: "不存在！" };
        trade.status = 'rejected';
        saveTrades(trades);
        return { ok: true, msg: "已拒绝" };
    },

    // 删除消息
    deleteMessage(state, msgId) {
        const trades = loadTrades();
        const idx = trades.findIndex(t => t.id === msgId);
        if (idx >= 0) { trades.splice(idx, 1); saveTrades(trades); }
        return { ok: true };
    },
};

// ============================================================
//  LeaderboardSystem — 多人排行榜（本地版）
//  利用 localStorage 存储所有存档的 BOSS 战绩
// ============================================================
const LEADERBOARD_KEY = 'DivineSword_Leaderboard';

export const LeaderboardSystem = {
    // 提交一次 BOSS 战绩
    submitBossScore(state, damage) {
        const boards = this._load();
        const entry = {
            player: state.playerName || '玩家',
            weapon: state.equipped.weapon?.name || '无名剑',
            damage: Math.floor(damage),
            timestamp: Date.now(),
        };
        boards.push(entry);
        // 只保留最近 100 条
        if (boards.length > 100) boards.splice(0, boards.length - 100);
        localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(boards));
    },

    // 获取排行榜（按伤害降序）
    getRankings() {
        const boards = this._load();
        return boards.sort((a, b) => b.damage - a.damage).slice(0, 20);
    },

    // 获取玩家最佳排名
    getMyBestRank(state) {
        const myName = state.playerName || '玩家';
        const boards = this._load().filter(b => b.player === myName).sort((a,b) => b.damage - a.damage);
        if (boards.length === 0) return null;
        const allSorted = this._load().sort((a,b) => b.damage - a.damage);
        const rank = allSorted.findIndex(b => b.player === myName && b.damage === boards[0].damage);
        return { rank: rank + 1, bestDamage: boards[0].damage };
    },

    _load() {
        try { return JSON.parse(localStorage.getItem(LEADERBOARD_KEY)) || []; }
        catch { return []; }
    },
};

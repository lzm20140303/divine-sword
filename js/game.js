// ============================================================
//  game.js — 主控制器
//  串联数据、机制、渲染、UI、特效、日志、公会、组队、交易
// ============================================================

import { MATERIAL_DEFS, FORGE_RECIPES, TALENT_DEFS, QUEST_DEFS, ACHIEVEMENT_DEFS, MONSTER_DEFS, MAP_DEFS } from './data.js';
import { Mechanics, AutoSystem } from './mechanics.js';
import { GuildSystem, RaidSystem, TradeSystem, LeaderboardSystem } from './guild.js';
import { Renderer } from './renderer.js';
import { UIManager } from './ui.js';
import { Effects } from './effects.js';
import { LogSystem, addLog } from './log.js';

export const Game = {
    state: null,

    // ==================== 初始化 ====================
    init() {
        this.state = this._createDefaultState();
        this.initMaterials();
        this.initEquipment();
        this.initQuests();
        this.loadGame(); // 迁移 + 加载
        this._migrateState();
        this._syncUIFromState();

        Renderer.init(this.state);
        this.bindEvents();
        this.checkOfflineProgress();
        addLog("欢迎回到神剑仙域！", 'log-reward');
        this.checkAchievements();
        this.startGameLoop();
    },

    _createDefaultState() {
        return {
            playerName: '玩家',
            sp: 0, stamina: 30, maxStamina: 30, lastSave: Date.now(),
            inventory: [], equipped: { weapon: null, ring: null, amulet: null, armor: null },
            talents: { forge: 0, sword: 0, survival: 0, gather: 0 },
            materials: {}, monster: { name: "史莱姆", icon: "👾", element: "water", hp: 50, maxHp: 50, level: 1 },
            boss: { name: "远古巨龙", icon: "🐉", element: "fire", hp: 1000000, maxHp: 1000000, timer: 60, damageList: [] },
            quests: [], achievements: {}, stats: { kills: 0, crits: 0, gathered: 0, forged: 0, forgeFailures: 0, autoFightCount: 0, donated: 0, teamRaids: 0, trades: 0 },
            secretSwordsUnlocked: [],
            autoSettings: { fight: false, explore: false, fightInterval: 500, smartUpgrade: false, smartUpgradeThreshold: 50, smartUpgradeMaxAtk: 9999, smartUpgradeReserve: 0, autoDevour: false, logFilter: 'all' },
            forgeRecipes: FORGE_RECIPES,
            talentDefs: TALENT_DEFS,
            questDefs: QUEST_DEFS,
            achievementDefs: ACHIEVEMENT_DEFS,
            guild: null, // { id, name, donated, contribution }
        };
    },

    _migrateState() {
        // 确保所有新字段存在
        const def = this._createDefaultState();
        // 深合并默认值
        this.state = this.deepMerge(def, this.state);
        // 确保 stats 子字段
        const defaultStats = def.stats;
        this.state.stats = { ...defaultStats, ...(this.state.stats || {}) };
        // 确保 autoSettings
        this.state.autoSettings = { ...def.autoSettings, ...(this.state.autoSettings || {}) };
    },

    _syncUIFromState() {
        document.getElementById('auto-fight-interval').value = this.state.autoSettings.fightInterval;
        document.getElementById('smart-upgrade-enabled').checked = this.state.autoSettings.smartUpgrade;
        document.getElementById('smart-upgrade-threshold').value = this.state.autoSettings.smartUpgradeThreshold;
        document.getElementById('smart-upgrade-maxatk').value = this.state.autoSettings.smartUpgradeMaxAtk;
        document.getElementById('smart-upgrade-reserve').value = this.state.autoSettings.smartUpgradeReserve;
        document.getElementById('auto-devour-enabled').checked = this.state.autoSettings.autoDevour;
    },

    // ==================== 数据初始化 ====================
    initMaterials() {
        MATERIAL_DEFS.forEach(m => { this.state.materials[m.id] = { ...m, count: 0 }; });
    },
    initEquipment() {
        const starter = this.state.forgeRecipes.find(r => r.id === 'starter');
        this.state.inventory.push({ ...starter });
        this.state.equipped.weapon = { ...starter };
    },
    initQuests() { this.generateDailyQuests(); },

    // ==================== 事件绑定 ====================
    bindEvents() {
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') { e.preventDefault(); this.attackMonster(); }
            if (e.code === 'KeyB' && e.ctrlKey) { e.preventDefault(); this.attackBoss(); }
        });
        setInterval(() => this.saveGame(), 30000);
        setInterval(() => this.saveToSlot('auto'), 30000);
        // 批量锻造输入变化
        document.addEventListener('change', (e) => {
            if (e.target.id === 'batch-forge-select' || e.target.id === 'batch-forge-count') {
                UIManager._updateBatchForgeInfo(this.state);
            }
        });
    },

    // ==================== 主循环 ====================
    startGameLoop() {
        setInterval(() => this.tickAutoFight(), 100);
        setInterval(() => this.globalTick(), 1000);
    },

    tickAutoFight() {
        if (!this.state.autoSettings.fight) return;
        const interval = this.state.autoSettings.fightInterval;
        const now = Date.now();
        if (!this._lastAutoFight) this._lastAutoFight = now;
        if (now - this._lastAutoFight < interval) return;
        this._lastAutoFight = now;
        const m = this.state.monster;
        if (m.hp > 0) { this.attackMonster(true); this.state.stats.autoFightCount++; }
        else { this.nextMonster(); }
    },

    globalTick() {
        // 体力恢复
        const now = Date.now();
        if (!this._lastStaminaTick) this._lastStaminaTick = now;
        if (now - this._lastStaminaTick >= 10000) {
            this._lastStaminaTick = now;
            if (this.state.stamina < this.state.maxStamina) {
                this.state.stamina = Math.min(this.state.maxStamina, this.state.stamina + 1);
                Renderer.updateStamina(this.state);
            }
        }
        // BOSS 计时
        if (this.state.boss.timer > 0) {
            this.state.boss.timer--;
            Renderer.updateBoss(this.state);
            if (this.state.boss.timer <= 0) {
                addLog("远古巨龙消失了...", 'log-normal');
                this.state.boss.hp = 0;
                Renderer.updateBoss(this.state);
            }
        }
        // 智能升级
        if (this.state.autoSettings.smartUpgrade) this.tickSmartUpgrade();
        // 自动吞噬
        if (this.state.autoSettings.autoDevour) this.tickAutoDevour();
        // 自动探索
        if (this.state.autoSettings.explore) this.tickAutoExplore();
        // 渲染更新
        Renderer.updateMapRecommendation(this.state);
        Renderer.updateAutoStatus(this.state);
    },

    // ==================== 核心战斗 ====================
    upgradeSword() {
        const cost = Math.ceil(5 * (this.state.equipped.weapon?.stats.attack || 10) * (1 - this.state.talents.forge * 0.05) * Mechanics.getGuildTechMultiplier(this.state, 'forge_cost'));
        if (this.state.materials.iron.count < cost) { addLog("精铁不足！"); return; }
        this.state.materials.iron.count -= cost;
        this.state.equipped.weapon.stats.attack += 10;
        this.state.equipped.weapon.stats.crit += 1;
        this.state.sp++; this.state.stats.forged++;
        addLog(`神剑升级！攻击+10，暴击+1%！获得1技能点。`);
        this.updateAndRender();
    },

    attackMonster(isAuto = false) {
        const m = this.state.monster; if (m.hp <= 0) return;
        const stats = Mechanics.getTotalStats(this.state);
        let damage = stats.attack;
        let isCrit = Math.random() * 100 < stats.crit;
        let logClass = 'log-normal';
        if (isCrit) { damage *= (1 + this.state.talents.sword * 0.1); this.state.stats.crits++; logClass = 'log-crit'; Effects.showCrit(); }
        const elemMult = Mechanics.getElementMultiplier(this.state.equipped.weapon?.element, m.element);
        if (elemMult > 1) { damage *= elemMult * Mechanics.getGuildTechMultiplier(this.state, 'elemental'); logClass = 'log-elem'; if (!isAuto) addLog(`属性克制！伤害${elemMult}x！`, logClass); }
        else if (elemMult < 1 && elemMult > 0) { damage *= elemMult; if (!isAuto) addLog(`属性被抵抗！`, 'log-normal'); }
        const dmgResult = Mechanics.calculateDamage(this.state, stats);
        if (dmgResult.type === 'dodge') { logClass = 'log-dodge'; if (!isAuto) addLog("你闪避了攻击！", 'log-dodge'); }
        else if (dmgResult.type === 'block') { logClass = 'log-block'; if (!isAuto) addLog("你格挡了攻击！", 'log-block'); }
        else { if (!isAuto) addLog(`怪物反击你，造成${dmgResult.damage}点伤害。`, 'log-normal'); }
        m.hp -= damage; if (m.hp < 0) m.hp = 0;
        if (!isAuto) { Effects.showDamage(damage, isCrit, m.icon); Effects.shakeScreen(); }
        addLog(`${isAuto?'[自动] ':''}${dmgResult.type==='dodge'?'闪避后反击':'攻击'} ${m.name}，造成 <span class="${logClass}">${damage.toFixed(1)}</span> 点伤害。`, logClass);
        if (m.hp <= 0) {
            addLog(`${isAuto?'[自动] ':''}击败了${m.name}！`);
            this.state.stats.kills++; Mechanics.dropLoot(this.state, addLog); this.state.sp++;
            this.updateAndRender(); this.checkAchievements();
        } else { Renderer.updateMonster(this.state); }
    },

    nextMonster() {
        const s = this.state;
        if (s.monster.hp > 0) { addLog("请先击败当前怪物！"); return; }
        s.monster.level++;
        const idx = Math.min(s.monster.level - 1, MONSTER_DEFS.length - 1);
        const baseHp = 50 + s.monster.level * 30;
        Object.assign(s.monster, MONSTER_DEFS[idx], { hp: baseHp, maxHp: baseHp });
        addLog(`遭遇 ${s.monster.name} Lv.${s.monster.level} (属性:${Mechanics.getElementIcon(s.monster.element)})!`);
        Renderer.updateMonster(s);
    },

    explore(mapId, isAuto = false) {
        const cost = MAP_DEFS[mapId]?.cost;
        if (!cost) return;
        if (this.state.stamina < cost) { if (!isAuto) addLog("体力不足！"); return; }
        this.state.stamina -= cost;
        Renderer.updateStamina(this.state);
        const drops = MAP_DEFS[mapId].drops;
        const dropId = drops[Math.floor(Math.random() * drops.length)];
        const gatherBonus = 1 + this.state.talents.gather * 0.2;
        let amount = Math.ceil((Math.random() * 2 + 1) * gatherBonus);
        // 公会幸运拾取
        if (this.state.guild?.tech?.loot_luck) amount = Math.ceil(amount * (1 + this.state.guild.tech.loot_luck * 0.1));
        this.state.materials[dropId].count += amount;
        this.state.stats.gathered += amount;
        const names = { mine: '矿洞', forest: '森林', volcano: '火山', star: '星空' };
        addLog(`${isAuto?'[自动探索] ':''}${names[mapId]||mapId}获得: ${this.state.materials[dropId].icon} ${this.state.materials[dropId].name} x${amount}`, 'log-auto');
        if (Math.random() < 0.1) {
            const gearRecipes = this.state.forgeRecipes.filter(r => r.type !== 'weapon');
            const recipe = gearRecipes[Math.floor(Math.random() * gearRecipes.length)];
            this.state.inventory.push({ ...recipe, id: Date.now() + Math.random() });
            addLog(`${isAuto?'[自动探索] ':''}<span style="color:gold">发现装备：【${recipe.name}】！</span>`);
        }
        this.updateAndRender();
    },

    attackBoss() {
        const boss = this.state.boss;
        if (boss.hp <= 0 || boss.timer <= 0) { addLog("BOSS已消失或时间结束！"); return; }
        const stats = Mechanics.getTotalStats(this.state);
        let damage = stats.attack * (0.8 + Math.random() * 0.4);
        let isCrit = Math.random() * 100 < stats.crit;
        let logClass = 'log-normal';
        if (isCrit) { damage *= (1 + this.state.talents.sword * 0.1); logClass = 'log-crit'; }
        const elemMult = Mechanics.getElementMultiplier(this.state.equipped.weapon?.element, boss.element);
        if (elemMult > 1) { damage *= elemMult * Mechanics.getGuildTechMultiplier(this.state, 'elemental'); logClass = 'log-elem'; }
        boss.hp -= damage; if (boss.hp < 0) boss.hp = 0;
        const playerName = this.state.equipped.weapon?.name || "无名侠客";
        let record = boss.damageList.find(d => d.name === playerName);
        if (record) record.damage += damage; else boss.damageList.push({ name: playerName, damage });
        boss.damageList.sort((a, b) => b.damage - a.damage);
        Effects.showDamage(damage, isCrit, boss.icon);
        addLog(`对BOSS造成 <span class="${logClass}">${damage.toFixed(1)}</span> 点伤害！`, logClass);
        Renderer.updateBoss(this.state);
        if (boss.hp <= 0) {
            addLog("<span style='color:gold'>恭喜！击败了远古巨龙！</span>", 'log-elem');
            this.settleBossRewards();
            LeaderboardSystem.submitBossScore(this.state, this.state.boss.damageList.find(d=>d.name===playerName)?.damage || 0);
            this.checkAchievements();
        }
    },

    settleBossRewards() {
        const boss = this.state.boss;
        const playerName = this.state.equipped.weapon?.name || "无名侠客";
        const playerRecord = boss.damageList.find(d => d.name === playerName);
        if (!playerRecord) return;
        const rank = boss.damageList.indexOf(playerRecord) + 1;
        let bloodReward = rank === 1 ? 10 : rank <= 3 ? 5 : rank <= 5 ? 2 : 0;
        if (bloodReward > 0) { this.state.materials.blood.count += bloodReward; addLog(`BOSS结算：排名第${rank}，获得 🩸龙血 x${bloodReward}！`, 'log-reward'); this.updateAndRender(); }
    },

    resetBoss() {
        const boss = this.state.boss;
        boss.hp = boss.maxHp; boss.timer = 60; boss.damageList = [];
        addLog("世界BOSS已刷新！"); Renderer.updateBoss(this.state);
    },

    // ==================== 智能升级 / 吞噬 / 探索 ====================
    tickSmartUpgrade() {
        const s = this.state.autoSettings;
        const weapon = this.state.equipped.weapon;
        if (!weapon || weapon.stats.attack >= s.smartUpgradeMaxAtk) return;
        const cost = Math.ceil(5 * weapon.stats.attack * (1 - this.state.talents.forge * 0.05) * Mechanics.getGuildTechMultiplier(this.state, 'forge_cost'));
        if (this.state.materials.iron.count >= cost + s.smartUpgradeReserve && this.state.materials.iron.count >= s.smartUpgradeThreshold) {
            this.state.materials.iron.count -= cost;
            weapon.stats.attack += 10; weapon.stats.crit += 1;
            this.state.sp++; this.state.stats.forged++;
            addLog(`[智能升级] 攻击+10 → ${weapon.stats.attack}，暴击+1% → ${weapon.stats.crit}%`, 'log-auto');
            this.updateAndRender();
        }
    },

    tickAutoDevour() {
        const weapon = this.state.equipped.weapon;
        if (!weapon) return;
        const threshold = weapon.stats.attack * 0.5;
        const candidates = this.state.inventory.filter(i => i.type === 'weapon' && i.id !== weapon.id && !i.secret && i.stats.attack < threshold);
        if (candidates.length === 0) return;
        const target = candidates.reduce((min, cur) => cur.stats.attack < min.stats.attack ? cur : min, candidates[0]);
        this.devourSword(target.id, true);
    },

    tickAutoExplore() {
        if (this.state.stamina <= 0) { addLog("[自动探索] 体力耗尽，停止", 'log-auto'); this.state.autoSettings.explore = false; Renderer.updateAutoButtons(this.state); return; }
        const mapId = AutoSystem.pickBestMap(this.state);
        if (!mapId) { addLog("[自动探索] 没有合适的地图", 'log-auto'); this.state.autoSettings.explore = false; Renderer.updateAutoButtons(this.state); return; }
        const cost = MAP_DEFS[mapId].cost;
        if (this.state.stamina < cost) {
            const cheaper = Object.keys(MAP_DEFS).filter(m => MAP_DEFS[m].cost <= this.state.stamina);
            if (cheaper.length === 0) { addLog("[自动探索] 体力不足", 'log-auto'); this.state.autoSettings.explore = false; Renderer.updateAutoButtons(this.state); return; }
            this.explore(cheaper[0], true);
        } else { this.explore(mapId, true); }
    },

    // ==================== 天赋 ====================
    learnTalent(type) {
        if (this.state.sp <= 0) return;
        const def = this.state.talentDefs[type];
        if (this.state.talents[type] >= def.maxLv) { addLog("该天赋已达上限！"); return; }
        this.state.talents[type]++; this.state.sp--;
        addLog(`习得 ${def.name} Lv.${this.state.talents[type]}！${def.desc}`); this.updateAndRender();
    },

    // ==================== UI 快捷入口 ====================
    openInventory(filterType) { UIManager.openInventoryModal(this.state, filterType); },
    openForgeModal() { UIManager.openForgeModal(this.state); },
    openTalentModal() { UIManager.openTalentModal(this.state); },

    // ==================== 装备操作 ====================
    equipItem(itemId) {
        const item = this.state.inventory.find(i => i.id === itemId);
        if (!item) return;
        this.state.equipped[item.type] = item;
        addLog(`装备了【${item.name}】`); this.updateAndRender();
        UIManager.closeModal('inventory-modal');
        UIManager.openInventoryModal(this.state, item.type);
    },

    forgeItem(recipeId) {
        const recipe = this.state.forgeRecipes.find(r => r.id === recipeId);
        if (!recipe) return;
        if (recipe.secret && recipe.condition && !recipe.condition(this.state)) { addLog(`锻造【${recipe.name}】条件未满足！`, 'log-secret'); return; }
        const successRate = recipe.secret ? 0.8 : 1.0;
        if (Math.random() > successRate) {
            addLog(`锻造【${recipe.name}】失败了...`, 'log-normal');
            this.state.stats.forgeFailures++; this.checkSecretSwords(); this.updateAndRender(); return;
        }
        for (const matId in recipe.req) { if (this.state.materials[matId].count < recipe.req[matId]) { addLog("材料不足！"); return; } }
        for (const matId in recipe.req) { this.state.materials[matId].count -= recipe.req[matId]; }
        const newItem = { ...recipe, id: Date.now() + Math.random() };
        this.state.inventory.push(newItem); this.state.stats.forged++; this.state.stats.forgeFailures = 0;
        addLog(`<span style="color:gold">锻造成功！获得【${newItem.name}】！</span>`);
        Effects.forgeFlash(); this.updateAndRender();
        UIManager.openForgeModal(this.state);
    },

    batchForge(recipeId, count) {
        const recipe = this.state.forgeRecipes.find(r => r.id === recipeId);
        if (!recipe) return { success: 0, fail: 0 };
        let successCount = 0, failCount = 0;
        for (let i = 0; i < count; i++) {
            let canForge = true;
            for (const matId in recipe.req) { if (this.state.materials[matId].count < recipe.req[matId]) { canForge = false; break; } }
            if (!canForge) { addLog(`批量锻造: 材料不足，已锻造 ${successCount} 次后停止`, 'log-normal'); break; }
            for (const matId in recipe.req) { this.state.materials[matId].count -= recipe.req[matId]; }
            if (Math.random() <= (recipe.secret ? 0.8 : 1.0)) { this.state.inventory.push({ ...recipe, id: Date.now() + Math.random() + i }); successCount++; }
            else { failCount++; this.state.stats.forgeFailures++; }
            this.state.stats.forged++;
        }
        this.checkSecretSwords();
        return { success: successCount, fail: failCount };
    },

    devourSword(itemId, isAuto = false) {
        const idx = this.state.inventory.findIndex(i => i.id === itemId);
        if (idx === -1) return;
        const item = this.state.inventory[idx];
        if (item.type !== 'weapon') { addLog("只能吞噬武器！"); return; }
        if (this.state.equipped.weapon?.id === item.id) { addLog("不能吞噬正在装备的武器！"); return; }
        if (item.secret) { addLog("传说中的神剑不可吞噬！", 'log-secret'); return; }
        const expGain = Math.floor(item.stats.attack / 2);
        this.state.equipped.weapon.stats.attack += expGain;
        this.state.inventory.splice(idx, 1);
        addLog(`${isAuto?'[自动] ':''}吞噬了【${item.name}】，主剑攻击力 +${expGain}`, 'log-reward');
        this.updateAndRender();
        if (!isAuto) UIManager.openInventoryModal(this.state);
    },

    // ==================== 隐藏剑 ====================
    checkSecretSwords() {
        this.state.forgeRecipes.forEach(recipe => {
            if (recipe.secret && recipe.condition && recipe.condition(this.state)) {
                if (!this.state.secretSwordsUnlocked.includes(recipe.id)) {
                    this.state.secretSwordsUnlocked.push(recipe.id);
                    addLog(`<span style="color:gold; font-size:1.2em;">💡 领悟了隐藏神剑的锻造之法：【${recipe.name}】！</span>`, 'log-secret');
                    this.updateAndRender();
                }
            }
        });
    },

    // ==================== 离线收益 ====================
    checkOfflineProgress() {
        Const 现在=日期.现在();
        Const offlineTime=数学.最小值(现在 - 这.状态.lastSave, 24 * 60 * 60 * 1000);
        如果 (offlineTime<5000) 返回;
        Const 秒=数学.地板(offlineTime / 1000);
        Const DPS=力学.getTotalStats(这.状态).攻击 * 0.5;
        让 totalDamage=DPS * 秒, 杀死=0, currentHp=这.状态.怪物.maxhp, totalMaterials={};
        在……期间 (totalDamage>0 && 杀死<1000) {
            Const DMG=数学.最小值(totalDamage, currentHp);
            totalDamage-=DMG; currentHp-=DMG;
            如果 (currentHp<=0) {
                杀死++;
                Const 垫子=对象.键(这.状态.材料);
                Const dropMat=垫子[数学.地板(数学.随机() * 垫子.长度)];
                Const 数量=数学.ceil((数学.随机() * 2+1) * (1+这.状态.人才.收集 * 0.2));
                totalMaterials[dropMat]=(totalMaterials[dropMat]||0)+数量;
                currentHp=这.状态.怪物.maxhp;
            }
        }
        这.状态.统计信息.杀死+=杀死;
        为 (Const matid 在……内 totalMaterials) { 这.状态.材料[matid].数数+=totalMaterials[matid]; }
        UIManager.showOfflineReport(这.状态, 秒, 杀死, totalMaterials);
        this.updateAndRender();
    },

    // ==================== 任务与成就 ====================
    generateDailyQuests() {
        const shuffled = [...this.state.questDefs].sort(() => 0.5 - Math.random());
        this.state.quests = shuffled.slice(0, 3).map(q => ({ ...q, progress: 0, completed: false }));
    },
    updateQuests() {
        this.state.quests.forEach(quest => {
            if (quest.completed) return;
            quest.progress = Math.min((this.state.stats[quest.type] || 0), quest.target);
            if (quest.progress >= quest.target && !quest.completed) { quest.completed = true; this.completeQuest(quest); }
        });
    },
    completeQuest(quest) {
        addLog(`<span style="color:gold">任务完成：【${quest.name}】！获得奖励！</span>`, 'log-reward');
        this.state.sp += quest.reward.sp || 0;
        for (const matId in quest.reward) { if (this.state.materials[matId]) this.state.materials[matId].count += quest.reward[matId]; }
    },
    checkAchievements() {
        this.state.achievementDefs.forEach(ach => {
            if (!this.state.achievements[ach.id] && ach.condition(this.state)) {
                this.state.achievements[ach.id] = true;
                addLog(`<span style="color:gold; font-size:1.2em;">🏆 成就解锁：【${ach.name}】！</span>`, 'log-reward');
                if (ach.reward.sp) this.state.sp += ach.reward.sp;
                for (const matId in ach.reward) { if (matId !== 'sp' && this.state.materials[matId]) this.state.materials[matId].count += ach.reward[matId]; }
                this.updateAndRender();
            }
        });
    },

    // ==================== 存档系统 ====================
    saveGame() {
        try {
            this.state.lastSave = Date.now();
            localStorage.setItem('DivineSwordSave_v3', JSON.stringify(this.state));
            this.saveToSlot('auto');
            addLog("游戏已自动保存！", 'log-auto');
        } catch { addLog("保存失败！", 'log-normal'); }
    },
    saveToSlot(slotId) {
        尝试 {
            localStorage.setitem('DivineSwordSlot_${slotId}`, JSON.使字符串化(这.状态));
            localStorage.setitem('DivineSwordSlot_${slotId}_time', 新的 日期().toLocaleString());
        } 赶上 {}
    },
    loadFromSlot(slotId) {
        Const 数据=localStorage.getitem('DivineSwordSlot_${slotId}`);
        如果 (!数据) { addLog(`存档槽位 [${slotId}] 为空！`, '对数正常'); 返回 假的; }
        尝试 {
            这.状态=这.deepMerge(这._createDefaultState(), JSON.解析(数据));
            这._migrateState();
            这.状态.autoSettings.打架=假的; 这.状态.autoSettings.探索=假的;
            addLog(`已从存档槽位 [${slotId}] 加载！`, 'log-reward');
            这.updateAndRender(); 渲染器.updateAutoButtons(这.状态); 返回正确;
        } 赶上{ addLog(`加载槽位 [${slotId}] 失败！`, '对数正常'); 返回假的; }
    },
    deepMerge(目标, 来源) {
        Const从……里面出去=JSON.解析(JSON.使字符串化(目标));
        为 (Const钥匙在……内来源) {
            如果 (来源[钥匙] && typeof 来源[钥匙]==='object'&& !数组.isArray(来源[钥匙])) { 从……里面出去[钥匙]={ ...从……里面出去[钥匙], ...来源[钥匙] }; }
            其他{ 从……里面出去[钥匙]=来源[钥匙]; }
        }
        返回从……里面出去;
    },
    loadgame() {
        Const节省=localStorage.getitem('DivineSwordSave_v3');
        如果 (节省) { 尝试{ 这.状态=这.deepMerge(这._createDefaultState(), JSON.解析(节省)); addLog("存档加载成功！", 'log-reward'); } 赶上{ addLog("存档解析失败，使用默认值", '对数正常'); } }
    },
    newgame() {
        UIManager.showConfirm("确定要开始新游戏吗？ 当前进度将丢失！", ()=>{
            localStorage.RemoveItem('DivineSwordSave_v3');
            ['插槽1','插槽2','插槽3','auto'].foreach(s=>{ localStorage.RemoveItem('DivineSwordSlot_${s}')；localStorage.RemoveItem('DivineSwordSlot_${s}_time'); });
            位置.重载();
        });
    },

    //====================导入/导出====================
    exportSaveToFile() {
        尝试{
            Const数据=JSON.使字符串化(这.状态, 无效的, 2);
            Const斑点=新的斑点([数据], { 类型: '应用程序/约翰逊 });
            ConstURL=URL.createObjectURL(斑点);
            Const一个=文件.createElement(‘A’); 一个.href=URL;
            一个.下载=`神剑仙域存档_${新的日期().toISOString().取代(/[：.]/g,'-')}.json'；
文件.body.appendChild(一个)；一个.点击()；文件.body.removeChild(一个)；URL.revokeObjectURL(URL)；
addLog("存档已导出为JSON文件！"，'log-reward')；
}赶上{addLog("导出失败！"，'对数正常')；}
    },
importSaveFromFile(文件){
Const读者=新的FileReader()；
读者.onload=(e)=>{
尝试 {
Const data=JSON.parse(e.target.result)；
UIManager.showConfirm('确认导入此存档？当前进度将被覆盖。<溴><小的>${文件.姓名} (${(文件.大小/1024).toFixed(1)} KB)</small>'，()=>{
这.状态=这.deepMerge(这._createDefaultState()，数据)；
这._migrateState()；
这.状态.autoSettings.打架=假的；这.状态.autoSettings.探索=假的；
这.updateAndRender()；渲染器.updateAutoButtons(这.状态)；
addLog("存档导入成功！"，'log-reward')；
UIManager.closeModal('保存模式')；
                });
}赶上{addLog("存档文件格式错误！"，'对数正常')；}
        };
读者.readAsText(文件)；
    },

//====================公会系统(UI桥接)====================
createGuildFromUI(){
Const姓名=文件.getElementById('guild-create-name')？.价值；
Const结果=帮派系统.创建帮派(这.状态，姓名)；
如果(结果.好的){addLog(结果.味精，'log-guild')；这.checkAchievements()；}
其他{addLog(结果.味精，'对数正常')；}
这.updateAndRender()；
渲染器.renderGuildPanel(这.状态)；
    },
joinGuildFromUI(GuildID){
Const结果=GuildSystem.joinGuild(这.状态，GuildID)；
如果(结果.好的){addLog(结果.味精，'log-guild')；这.checkAchievements()；}
其他{addLog(结果.味精，'对数正常')；}
这.updateAndRender()；渲染器.renderGuildPanel(这.状态)；
    },
leaveGuildFromUI(){
Const结果=GuildSystem.Leave帮会(爬.状态)；
addLog(结果.味精，结果.好的？'伐木行会“：”对数正常')；
这.updateAndRender()；渲染器.renderGuildPanel(这.状态)；
    },
substitiveFromUI(matid，数量){
Const结果=GuildSystem.donitiveMaterial(这.状态，马蒂德，数量)；
如果(结果.好的){addLog(结果.味精，'log-guild')；这.checkAchievements()；}
其他{addLog(结果.味精，'对数正常')；}
这.updateAndRender()；渲染器.renderGuildPanel(这.状态)；
    },
升级GuildTechFromUI(techId){
Const结果=GuildSystem.upgradeTech(这.状态，techId)；
addLog(结果.味精，结果.好的？'伐木行会“：”对数正常')；
这.updateAndRender()；渲染器.renderGuildPanel(这.状态)；
    },

//====================组队副本(UI桥接)====================
createRaidFromUI(raidId){
Const结果=RaidSystem.createRaid(这.状态，raidId)；
addLog(结果.味精，结果.好的？'日志搜索'：'对数正常')；
这.updateAndRender()；渲染器.renderRaidPanel(这.状态)；
    },
joinRaidFromUI(raidInstanceId){
Const结果=RaidSystem.joinRaid(这.状态，raidInstanceId)；
addLog(结果.味精，结果.好的？'日志搜索'：'对数正常')；
这.updateAndRender()；渲染器.renderRaidPanel(这.状态)；
    },
attackRaidFromUI(raidInstanceId){
Const结果=RaidSystem.attackRaidBoss(这.状态，raidInstanceId)；
如果 (结果.完成) {
addlog(结果.味精，'日志搜索')；
这.checkAchievements()；
}其他{addLog(结果.味精，'日志搜索')；}
这.updateAndRender()；渲染器.renderRaidPanel(这.状态)；
    },
claimRaidFromUI(raidInstanceId){
Const结果=RaidSystem.claimRaidReward(这.状态，raidInstanceId)；
如果(结果.好的){addLog(结果.味精，'log-reward')；这.checkAchievements()；}
其他{addLog(结果.味精，'对数正常')；}
这.updateAndRender()；渲染器.renderRaidPanel(这.状态)；
    },

//====================交易/赠送(UI桥接)====================
sendGiftFromUI(){
Const目标=文件.getElementById('礼品-目标')？.价值；
康斯玛提=文件.getElementById('礼品垫')？.价值；
Const数量=parseInt(文件.getElementById('礼品金额')？.价值)||1；
Const消息=文件.getElementById('gift-msg')？.价值||”；
Const结果=TradeSystem.sendGift(这.状态，目标，马蒂德，数量，消息)；
如果(结果.好的){addLog(结果.味精，'对数交易’)；这.checkAchievements()；}
其他{addLog(结果.味精，'对数正常')；}
这.updateAndRender()；渲染器.renderTradePanel(这.状态)；
    },
acceptGiftFromUI(giftId){
Const结果=TradeSystem.acceptGift(这.状态，giftId)；
addLog(结果.味精，结果.好的？'日志交易“：”对数正常')；
这.updateAndRender()；渲染器.renderTradePanel(这.状态)；
    },
acceptTradeFromUI(tradeId){
Const结果=TradeSystem.acceptTrade(这.状态，tradeId)；
如果(结果.好的){addLog(结果.味精，'对数交易’)；这.checkAchievements()；}
其他{addLog(结果.味精，'对数正常')；}
这.updateAndRender()；渲染器.renderTradePanel(这.状态)；
    },
rejectTradeFromUI(tradeId){
TradeSystem.rejectTrade(这.状态，tradeId)；
这.updateAndRender()；渲染器.renderTradePanel(这.状态)；
    },
deleteMessageFromUI(msgid){deleteMessageFromUI(msgid){
TradeSystem.deleteMessage(这.状态，msgid)；
这.updateAndRender()；渲染器.renderTradePanel(这.状态)；
    },

//====================自动化开关====================
toggleAutoFight(){
常数=这.状态.autoSettings；
s。打架=！s。打架；
如果(s.打架){s.bightInterval=数学.最大值(100，数学.最小值(5000，parseInt(文件.getElementById('⚡ 自动战斗间隔')。价值)||500))；addLog('⚡ 自动战斗已开启(间隔${s.bightInterval}女士)‘、'日志自动')；}
其他{addLog("⚡ 自动战斗已停止"，'日志自动')；}
渲染器.updateAutoButtons(这.状态)；
    },
toggleAutoExplore(){
常数=这.状态.autoSettings；
s。探索=！s。探索；
如果(s.探索){如果(这.状态.耐力<=0){addLog("体力不足！"，'对数正常')；s。探索=假的；}其他{addLog("🗺️ 自动探索已开启"，'日志自动')；}}
其他{addLog("🗺️ 自动探索已停止"，'日志自动')；}
渲染器.updateAutoButtons(这.状态)；
    },

//====================辅助====================
updateAndRender(){这.updatequests()；渲染器.全部渲染(爬.状态)；}，
};

//曝光到全局（供）onClick使用）
常量全局(_G)=typeof窗户！=='未定义'？窗户：全球的；
全局(_G).游戏=游戏；
_global.addLog=addLog；
_global.LogSystem=LogSystem；
_global.UIManager=UIManager；
全局(_G)。渲染器=渲染器；
全局(_G).影响=影响；
全局(_G).力学=力学；
_global.GuildSystem=GuildSystem；
_global.RaidSystem=RaidSystem；
_global.TradeSystem=TradeSystem；
_global.LeaderboardSystem=LeaderboardSystem；
_global.autosystem=AUTOSYSTEM；

// ============================================================
//  mechanics.js — 游戏机制 / 数值计算
//  包含：属性汇总、伤害公式、元素克制、掉落、自动地图选择
// ============================================================

import { MAP_DEFS, GUILD_TECH_DEFS } from './data.js';

export const Mechanics = {
    // ---------- 属性汇总 ----------
    getTotalStats(state) {
        const totals = { attack: 0, crit: 0, dodge: 0, block: 0, def: 0 };
        Object.values(state.equipped).forEach(item => {
            if (item && item.stats) {
                for (const stat in item.stats) {
                    totals[stat] = (totals[stat] || 0) + item.stats[stat];
                }
            }
        });
        // 天赋加成
        totals.crit  += state.talents.sword    * 2;
        totals.dodge += state.talents.survival * 3;
        totals.block += state.talents.survival * 3;
        // 公会科技加成
        if (state.guild?.tech?.combat_tactics) {
            const lvl = state.guild.tech.combat_tactics;
            totals.attack = Math.floor(totals.attack * (1 + lvl * 0.02));
        }
        if (state.guild?.tech?.resilience) {
            const lvl = state.guild.tech.resilience;
            totals.dodge += lvl * 1;
            totals.block += lvl * 1;
        }
        return totals;
    },

    // ---------- 怪物反击 ----------
    calculateDamage(state, stats) {
        if (Math.random() * 100 < stats.dodge) { return { type: 'dodge', damage: 0 }; }
        let damage = 10 + state.monster.level * 2;
        if (Math.random() * 100 < stats.block) { damage *= 0.5; return { type: 'block', damage }; }
        return { type: 'hit', damage };
    },

    // ---------- 元素克制表 ----------
    getElementMultiplier(atkElem, defElem) {
        const chart = {
            fire:  { water: 0.5, earth: 1.5, metal: 1.2, wood: 0.8 },
            water: { fire: 1.5, earth: 0.8, metal: 0.5, wood: 1.2 },
            earth: { fire: 0.8, water: 1.5, metal: 1.2, wood: 0.5 },
            metal: { fire: 0.8, water: 1.2, earth: 0.5, wood: 1.5 },
            wood:  { fire: 1.2, water: 0.8, earth: 1.5, metal: 0.5 },
            air:   { earth: 1.5, water: 0.8 },
            light: { dark: 2.0 },
            dark:  { light: 2.0 },
        };
        if (!atkElem || atkElem === 'none' || !defElem) return 1;
        return chart[atkElem]?.[defElem] || 1;
    },

    getElementIcon(elem) {
        const icons = { fire: '🔥', water: '💧', earth: '🌿', metal: '⚔️', wood: '🪵', air: '💨', light: '☀️', dark: '🌑' };
        return icons[elem] || '';
    },

    // ---------- 掉落 ----------
    dropLoot(state, logFn) {
        const mats = Object.keys(state.materials);
        const dropMat = mats[Math.floor(Math.random() * mats.length)];
        let amount = Math.floor(Math.random() * 3) + 1;
        // 公会幸运拾取加成
        if (state.guild?.tech?.loot_luck) {
            const lvl = state.guild.tech.loot_luck;
            amount = Math.ceil(amount * (1 + lvl * 0.1));
        }
        state.materials[dropMat].count += amount;
        logFn(`获得战利品: ${state.materials[dropMat].icon} ${state.materials[dropMat].name} x${amount}`);
    },

    // ---------- 公会科技效果 ----------
    getGuildTechMultiplier(state, type) {
        if (!state.guild?.tech) return 1;
        switch (type) {
            case 'forge_cost': {
                const lvl = state.guild.tech.forge_mastery || 0;
                return Math.max(0.5, 1 - lvl * 0.03);
            }
            case 'elemental': {
                const lvl = state.guild.tech.elemental || 0;
                return 1 + lvl * 0.05;
            }
            default: return 1;
        }
    },
};

// ============================================================
//  AutoSystem — 自动化辅助算法
// ============================================================
export const AutoSystem = {
    // 分析材料缺口，返回最佳地图
    pickBestMap(state) {
        const costs = { mine: 5, forest: 5, volcano: 10, star: 15 };
        const needed = {};
        state.forgeRecipes.forEach(recipe => {
            if (recipe.secret && !state.secretSwordsUnlocked.includes(recipe.id)) return;
            for (const matId in recipe.req) {
                const have = state.materials[matId]?.count || 0;
                const need = recipe.req[matId];
                needed[matId] = (needed[matId] || 0) + Math.max(0, need - have);
            }
        });

        if (Object.keys(needed).length === 0) {
            return state.stamina >= 5 ? 'mine' : null;
        }

        const mapDrops = {
            mine:    MAP_DEFS.mine.drops,
            forest:  MAP_DEFS.forest.drops,
            volcano: MAP_DEFS.volcano.drops,
            star:    MAP_DEFS.star.drops,
        };

        let bestMap = null, bestScore = -1;
        for (const mapId in mapDrops) {
            const cost = costs[mapId];
            if (state.stamina < cost) continue;
            const drops = mapDrops[mapId];
            let score = 0;
            drops.forEach(mat => { score += needed[mat] || 0; });
            score = score / cost;
            if (score > bestScore) { bestScore = score; bestMap = mapId; }
        }
        return bestMap || (state.stamina >= 5 ? 'mine' : null);
    },
};

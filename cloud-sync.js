/* ============================================================
 * cloud-sync.js  —  神剑仙域 云端同步模块
 * 职责：封装 Supabase 调用，提供简洁 API 给 game.js 使用
 * 依赖：全局变量 window.SUPABASE_URL / window.SUPABASE_ANON_KEY
 *        以及全局 supabase（通过 CDN 加载）
 * ============================================================ */

(function (global) {
    'use strict';

    const TABLES = {
        profiles:   'profiles',
        saves:      'saves',
        leaderboard:'leaderboard',
        guilds:     'guilds',
    };

    // ---------- 内部状态 ----------
    let _client = null;          // supabase client
    let _nickname = null;        // 当前登录昵称
    let _online = false;         // 是否成功连上 Supabase
    let _lastSyncAt = null;      // 上次同步时间
    let _saveTimer = null;       // 自动保存定时器

    // ---------- 初始化 ----------
    async function init() {
        const url  = global.SUPABASE_URL;
        const anon = global.SUPABASE_ANON_KEY;

        if (!url || !anon) {
            console.warn('[CloudSync] 未配置 SUPABASE_URL/ANON_KEY，降级为本地模式');
            return false;
        }

        // 动态加载 Supabase JS SDK（CDN）
        if (!global.supabase) {
            await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
        }

        try {
            _client = global.supabase.createClient(url, anon, {
                auth: { persistSession: false }  // 我们用昵称，不走 supabase auth
            });

            // 探活：查一条数据
            const { error } = await _client.from(TABLES.profiles).select('id').limit(1);
            if (error) throw error;
            _online = true;
            console.log('[CloudSync] ✅ 已连接 Supabase');
            return true;
        } catch (e) {
            console.warn('[CloudSync] 连接失败，降级为本地模式：', e.message);
            _online = false;
            return false;
        }
    }

    // ---------- 工具：动态加载脚本 ----------
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    // ---------- 登录（昵称） ----------
    async function loginByNickname(nickname) {
        if (!nickname || nickname.trim().length < 1) {
            throw new Error('昵称不能为空');
        }
        _nickname = nickname.trim().slice(0, 16);

        if (!_online) return { online: false, nickname: _nickname };

        // upsert 玩家档案
        const { error } = await _client
            .from(TABLES.profiles)
            .upsert({ nickname: _nickname }, { onConflict: 'nickname' });

        if (error) throw error;
        console.log('[CloudSync] 登录为：', _nickname);
        return { online: true, nickname: _nickname };
    }

    // ---------- 上传存档 ----------
    async function uploadSave(stateObj) {
        if (!_online || !_nickname) return { ok: false, reason: 'offline' };

        const payload = {
            nickname: _nickname,
            state_json: JSON.parse(JSON.stringify(stateObj)),  // 深拷贝
        };

        const { error } = await _client
            .from(TABLES.saves)
            .upsert(payload, { onConflict: 'nickname' });

        if (error) {
            console.warn('[CloudSync] 上传失败：', error.message);
            return { ok: false, reason: error.message };
        }

        _lastSyncAt = new Date();
        console.log('[CloudSync] ☁️ 存档已上传', _lastSyncAt.toLocaleTimeString());
        return { ok: true, at: _lastSyncAt };
    }

    // ---------- 下载存档 ----------
    async function downloadSave() {
        if (!_online || !_nickname) return { ok: false, reason: 'offline' };

        const { data, error } = await _client
            .from(TABLES.saves)
            .select('state_json, updated_at')
            .eq('nickname', _nickname)
            .maybeSingle();

        if (error) {
            console.warn('[CloudSync] 下载失败：', error.message);
            return { ok: false, reason: error.message };
        }

        if (!data) return { ok: false, reason: 'no_save' };

        return { ok: true, state: data.state_json, updatedAt: data.updated_at };
    }

    // ---------- 提交排行榜 ----------
    async function submitLeaderboard(bossName, damage) {
        if (!_online || !_nickname) return { ok: false };

        const { error } = await _client
            .from(TABLES.leaderboard)
            .insert({ nickname: _nickname, boss_name: bossName, max_damage: damage });

        if (error) {
            console.warn('[CloudSync] 排行榜提交失败：', error.message);
            return { ok: false };
        }
        return { ok: true };
    }

    // ---------- 拉取排行榜 ----------
    async function fetchLeaderboard(bossName, limit = 20) {
        if (!_online) return { ok: false, data: [] };

        let q = _client.from(TABLES.leaderboard).select('*').order('max_damage', { ascending: false }).limit(limit);
        if (bossName) q = q.eq('boss_name', bossName);

        const { data, error } = await q;
        if (error) return { ok: false, data: [] };
        return { ok: true, data };
    }

    // ---------- 公会：创建 ----------
    async function createGuild(name, leader) {
        if (!_online) return { ok: false };
        const { error } = await _client.from(TABLES.guilds).insert({
            name, leader, members: [leader], treasury: {}, tech: {}
        });
        return { ok: !error, error: error?.message };
    }

    // ---------- 公会：读取 ----------
    async function fetchGuild(name) {
        if (!_online) return { ok: false };
        const { data, error } = await _client
            .from(TABLES.guilds).select('*').eq('name', name).maybeSingle();
        return { ok: !error && !!data, data };
    }

    // ---------- 公会：更新 ----------
    async function updateGuild(name, patch) {
        if (!_online) return { ok: false };
        const { error } = await _client.from(TABLES.guilds).update(patch).eq('name', name);
        return { ok: !error };
    }

    // ---------- 自动保存（游戏内定时调用） ----------
    function startAutoSave(getStateFn, intervalMs = 30000) {
        stopAutoSave();
        _saveTimer = setInterval(async () => {
            if (!getStateFn) return;
            await uploadSave(getStateFn());
        }, intervalMs);
    }

    function stopAutoSave() {
        if (_saveTimer) { clearInterval(_saveTimer); _saveTimer = null; }
    }

    // ---------- 状态查询 ----------
    function isOnline()    { return _online; }
    function getNickname() { return _nickname; }
    function getLastSync() { return _lastSyncAt; }

    // ---------- 暴露 API ----------
    global.CloudSync = {
        init, loginByNickname,
        uploadSave, downloadSave,
        submitLeaderboard, fetchLeaderboard,
        createGuild, fetchGuild, updateGuild,
        startAutoSave, stopAutoSave,
        isOnline, getNickname, getLastSync,
        TABLES,
    };

})(window);

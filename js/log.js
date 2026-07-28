// ============================================================
//  log.js — 结构化战斗日志系统
//  支持按类型筛选 + CSV 导出
// ============================================================

const MAX_ENTRIES = 200;

export const LogSystem = {
    entries: [],
    filter: 'all',

    add(msg, className) {
        className = className || 'log-normal';
        const entry = { time: new Date(), msg, className, raw: msg.replace(/<[^>]*>/g, '') };
        this.entries.push(entry);
        while (this.entries.length > MAX_ENTRIES) this.entries.shift();
        this.render();
    },

    setFilter(filter) {
        this.filter = filter;
        if (window.Game?.state) window.Game.state.autoSettings.logFilter = filter;
        this.render();
    },

    getFiltered() {
        if (this.filter === 'all') return this.entries;
        const map = {
            'crit':   ['log-crit'],
            'dodge':  ['log-dodge'],
            'block':  ['log-block'],
            'elem':   ['log-elem'],
            'reward': ['log-reward', 'log-secret'],
            'auto':   ['log-auto'],
            'guild':  ['log-guild'],
            'trade':  ['log-trade'],
            'raid':   ['log-raid'],
        };
        const allowed = map[this.filter] || [];
        return this.entries.filter(e => allowed.includes(e.className));
    },

    render() {
        const box = document.getElementById('log-box');
        if (!box) return;
        const filtered = this.getFiltered();
        box.innerHTML = filtered.map(e => {
            const time = e.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            return `<div class="log-entry ${e.className}"><span class="log-time">[${time}]</span> ${e.msg}</div>`;
        }).join('');
        box.scrollTop = box.scrollHeight;
    },

    exportCSV() {
        const filtered = this.getFiltered();
        if (filtered.length === 0) { addLog("没有日志可导出！", 'log-normal'); return; }
        let csv = '\uFEFF时间,类型,内容\n'; // BOM for Excel
        filtered.forEach(e => {
            const time = e.time.toISOString();
            const type = e.className.replace('log-', '');
            const content = e.raw.replace(/,/g, '，').replace(/\n/g, ' ');
            csv += `"${time}","${type}","${content}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        a.download = `战斗日志_${ts}.csv`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addLog("日志已导出为 CSV 文件！", 'log-reward');
    },

    clear() { this.entries = []; this.render(); },
};

// 全局快捷函数
export function addLog(msg, className) {
    className = className || 'log-normal';
    LogSystem.add(msg, className);
}

// ============================================================
//  service-worker.js — 离线缓存 & 安装到桌面
//  策略：App Shell 模型（核心文件缓存优先，动态资源按需缓存）
// ============================================================

const CACHE_NAME = 'divine-sword-v1';
const CORE_ASSETS = [
    './index.html',
    './manifest.json',
    './js/game.js',
    './js/data.js',
    './js/mechanics.js',
    './js/effects.js',
    './js/log.js',
    './js/ui.js',
    './js/renderer.js',
    './js/guild.js',
    './js/icons.js',
];

// ---------- 安装：预缓存核心文件 ----------
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] 缓存核心文件...');
            return cache.addAll(CORE_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

// ---------- 激活：清理旧缓存 ----------
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
            );
        }).then(() => self.clients.claim())
    );
});

// ---------- 请求拦截：缓存优先 + 网络回退 ----------
self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    event.respondWith(
        caches.match(req).then((cached) => {
            if (cached) return cached;
            return fetch(req).then((response) => {
                // 动态缓存新资源（JS/CSS/HTML/JSON）
                if (response.ok && (req.url.includes('/js/') || req.url.endsWith('.json') || req.url.endsWith('.html'))) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
                }
                return response;
            }).catch(() => {
                // 离线兜底：返回缓存的 index.html
                if (req.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});

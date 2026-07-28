# ⚔️ 神剑仙域 · 吞噬与秘剑（模块化版 + PWA）

> 一款单文件起源、现已模块化的浏览器放置/养成小游戏。  
> 锻造神剑、吞噬废料、探索地图、挑战世界 BOSS、组建公会、交易装备——一切尽在浏览器中。  
> **支持 PWA 安装到手机桌面，离线也能玩！**

## ✨ 功能一览

### 🗡️ 核心玩法
- **神剑锻造**：用材料打造数十种武器（含隐藏剑），元素克制系统
- **吞噬进化**：把低阶武器喂给主剑，攻击力滚雪球增长
- **冒险打怪**：手动/自动战斗，元素克制影响伤害倍率
- **世界 BOSS**：远古巨龙，60 秒限时，伤害排行

### 🤖 自动化系统
- ⚡ **自动战斗** — 可调节间隔（100~5000ms），怪物死后自动下一关
- 🗺️ **自动探索** — 智能分析材料缺口，自动选最优地图刷材料
- 🔧 **智能升级** — 精铁超过阈值自动升主剑，可设攻击力上限和保留量
- 🍽️ **自动吞噬** — 自动吞掉攻击力 < 主剑 50% 的废料武器

### 🏰 公会 / 社交系统
- **公会仓库**：成员捐赠材料，用贡献点取出
- **公会科技**：5 条科技线（锻造精通/战斗策略/元素共鸣/坚韧意志/幸运拾取），全员共享
- **组队副本**：创建或加入副本队伍，多人合并伤害打 BOSS，通关均分奖励
- **赠送材料**：指定玩家 + 数量 + 留言，对方收件箱一键接受
- **装备交易**：用材料换取他人装备，双向确认机制
- **多人排行榜**：同设备多存档共享 BOSS 伤害排行

### 💾 存档系统
- **4 槽位**：3 个手动槽 + 1 个自动槽（每 30 秒自动保存）
- **导入/导出**：JSON 文件一键备份与恢复
- **深合并迁移**：老存档自动补齐新字段，不会炸

### 📜 战斗日志
- **9 种筛选**：全部 / 暴击 / 闪避 / 格挡 / 元素 / 奖励 / 公会 / 交易 / 副本
- **CSV 导出**：用 Excel 直接打开分析战斗数据

### 📱 PWA（渐进式 Web 应用）
- **安装到桌面**：手机浏览器弹出「安装」提示，一键添加到主屏幕
- **全屏运行**：无浏览器地址栏，体验等同原生 App
- **离线游玩**：Service Worker 缓存所有核心文件，断网也能玩
- **自动更新**：新版本发布后下次打开自动刷新缓存

## 📁 项目结构

```
神剑仙域/
├── index.html              # 入口文件（ES Module + PWA 注册）
├── manifest.json           # PWA 清单（名称/图标/主题色/全屏）
├── service-worker.js       # 离线缓存（App Shell 策略）
├── generate-icons.html      # 图标生成器（一键下载 192/512 图标）
├── start_server.sh         # 一键启动 HTTP 服务器
├── README.md               # 本文件
├── run_tests.js            # 52 项验证测试
├── package.json
├── icon-192.png            # PWA 小图标（手动生成）
├── icon-512.png            # PWA 大图标（手动生成）
└── js/
    ├── data.js             # 静态数据
    ├── mechanics.js        # 核心机制
    ├── effects.js          # 视觉特效
    ├── log.js              # 结构化日志
    ├── ui.js               # UI 管理器
    ├── renderer.js         # 渲染层
    ├── guild.js            # 公会/副本/交易
    ├── icons.js            # 运行时图标生成
    └── game.js            # 主控制器
```

## 🚀 如何运行

### ▶️ 快速启动（本地）

```bash
chmod +x start_server.sh
./start_server.sh
# 浏览器打开 http://localhost:8080/index.html
```

或手动：
```bash
python3 -m http.server 8080
# 或
npx serve .
```

> ⚠️ **必须用 HTTP 服务器**，不能直接双击 `index.html`。  
> ES Module（`import/export`）和 Service Worker 都不支持 `file://` 协议。

### 📱 手机端（推荐：上传到免费托管）

1. 把整个文件夹上传到 **GitHub Pages** / **Vercel** / **Netlify**（免费）
2. 手机浏览器打开你的网址
3. 玩一会儿后，浏览器会弹出 **「安装到主屏幕」** 提示
4. 点安装 → 游戏出现在桌面 → 点击即全屏运行，跟 App 一样！

#### 一键部署到 GitHub Pages
```bash
# 在 GitHub 创建仓库 divine-sword，然后：
git init && git add . && git commit -m "init"
git remote add origin https://github.com/你的用户名/divine-sword.git
git push -u origin main
# 仓库 Settings → Pages → Source: main → Save
# 访问 https://你的用户名.github.io/divine-sword/
```

### 🎨 生成 PWA 图标

1. 用浏览器打开 `generate-icons.html`
2. 自动下载 `icon-192.png` 和 `icon-512.png`
3. 放到与 `index.html` 同级目录

> 如果懒得生成，游戏运行时也会通过 `js/icons.js` 在 Canvas 上绘制图标。

## 📱 手机端完整使用流程

```
1. 上传到 GitHub Pages / Vercel（或本地起服务器 + 内网穿透）
2. 手机浏览器访问网址
3. 游玩 → 出现「📲 安装到主屏幕」横幅
4. 点「安装」→ 确认
5. 桌面出现「神剑仙域」图标
6. 点图标 → 全屏打开 → 像 App 一样玩
7. 关掉网络也能继续玩（Service Worker 已缓存所有文件）
```

## 🎮 快捷键

| 按键 | 功能 |
|---|---|
| `空格` | 攻击怪物 |
| `Ctrl+B` | 攻击世界 BOSS |

## 🧪 运行测试

```bash
npm install jsdom blob-polyfill
node run_tests.js
```

测试覆盖：模块化架构、公会 CRUD、科技升级、捐赠/提取、副本组队、伤害合并、奖励领取、赠送/交易/拒绝、排行榜排序、日志筛选、CSV 导出、智能升级、自动吞噬、自动探索、元素克制、隐藏剑解锁、成就、存档迁移、槽位存取、批量锻造。

## 🔧 技术栈

- **纯原生 JS**（ES Module，零运行时依赖）
- **localStorage** 持久化
- **Service Worker** 离线缓存（App Shell 模型）
- **Web App Manifest** PWA 安装支持
- **CSS Grid + 渐变** 暗色仙侠 UI

## 📜 存档 Key 说明

| Key | 内容 |
|---|---|
| `DivineSwordSave_v3` | 主存档（最新） |
| `DivineSwordSlot_slot1/2/3` | 手动存档槽位 |
| `DivineSwordSlot_auto` | 自动存档（每 30s） |
| `DivineSword_Guilds` | 所有公会数据 |
| `DivineSword_Raids` | 副本队伍数据 |
| `DivineSword_Trades` | 赠送/交易消息 |
| `DivineSword_Leaderboard` | BOSS 伤害排行 |

## 📄 License

MIT

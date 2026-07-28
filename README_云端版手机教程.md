# ☁️ 神剑仙域 · 云端同步版 — 手机完整教程

> 让你的游戏存档存在云上，换手机/清缓存都不丢，多设备无缝切换！

---

## 📦 你拿到了什么

| 文件 | 作用 |
|---|---|
| `神剑仙域_云端版.html` | 游戏本体（165KB，1个文件搞定一切） |
| `supabase_setup.sql` | 数据库建表脚本（在 Supabase 里粘贴运行） |
| `cloud-sync.js` | 云端同步模块源码（已内嵌到 HTML 中，单独保留便于查看） |
| `README_云端版手机教程.md` | 本教程 |

---

## 🚀 第一步：注册 Supabase（5 分钟）

Supabase 是一个免费的云端数据库，我们用来存存档。

### 1.1 打开网站
手机浏览器（推荐 Chrome / Edge）访问 👉 **https://supabase.com**

### 1.2 注册账号
- 点右上角 **「Start your project」**
- 选 **「Continue with GitHub」**（最方便，没有就注册一个 GitHub）
- 没有 GitHub？点 **「Sign up」** 用邮箱注册也行
- 跟着提示一路同意、验证邮箱

### 1.3 创建项目
- 登录后点 **「New project」**
- 填项目名称：`divine-sword`（随便取，英文小写）
- 设置数据库密码：**一定要记住！**（写备忘录里）
- 区域选 **Northeast Asia (Seoul)** 或 **Singapore**（离中国近，速度快）
- 定价方案选 **「Free」**（免费够用）
- 点 **「Create new project」**
- ⏳ 等 2 分钟，项目初始化完成

---

## 🔑 第二步：拿到连接信息（2 分钟）

### 2.1 找到 Project URL 和 Anon Key
- 在 Supabase 后台左侧菜单，点 **⚙️ Settings** → **API**
- 你会看到两个重要信息：

```
Project URL          👉  https://xxxx.supabase.co
anon public key      👉  eyJhbGciOiJIUzI1NiIs...（很长一串）
```

- **长按复制**，存到手机备忘录里

### 2.2 打开游戏文件，填入这两个值
- 用手机文本编辑器打开 `神剑仙域_云端版.html`
- 搜索 `YOUR-PROJECT-REF`（在第 14 行附近）
- 把 `https://YOUR-PROJECT-REF.supabase.co` 替换成你的真实 URL
- 把 `YOUR-ANON-PUBLIC-KEY` 替换成你的真实 anon key
- **保存文件**

> 💡 **手机编辑器推荐**：Android 用「Acode」「QuickEdit」，iPhone 用「Textastic」「Working Copy」

---

## 🗄️ 第三步：创建数据库表（3 分钟）

### 3.1 打开 SQL 编辑器
- Supabase 后台左侧菜单，点 **🗂️ SQL Editor**
- 点 **「New query」** 新建一个查询

### 3.2 粘贴建表脚本
- 打开你下载的 `supabase_setup.sql` 文件
- **全选复制**所有内容
- 粘贴到 Supabase 的 SQL 编辑器里
- 点 **「Run」** 按钮（绿色三角）

### 3.3 确认成功
- 底部出现绿色提示 `Success. No rows returned`
- 左侧 **Table Editor** 里应该能看到 4 张表：
  - ✅ `profiles` — 玩家档案
  - ✅ `saves` — 存档数据
  - ✅ `leaderboard` — 排行榜
  - ✅ `guilds` — 公会数据

---

## 📤 第四步：上传到 GitHub Pages（10 分钟）

现在游戏已经配好云端了，需要放到网上才能让手机浏览器访问。

### 4.1 注册 GitHub（没有的话）
- 浏览器打开 **https://github.com**
- 点 **Sign up**，用邮箱注册

### 4.2 创建仓库
- 登录后点右上角 **「+」** → **「New repository」**
- Repository name 填：`divine-sword`
- 勾选 **「Add a README file」**
- 点 **「Create repository」**

### 4.3 上传游戏文件
- 进入仓库，点 **「Add file」→「Upload files」**
- 选择你改好的 `神剑仙域_云端版.html`，上传
- 在底部 **Commit changes** 写个备注：`添加云端版游戏`
- 点 **「Commit changes」**

### 4.4 开启网页托管
- 点顶部 **「Settings」** 标签
- 左侧找到 **「Pages」**
- **Branch** 选 `main` → 点 **「Save」**
- ⏳ 等 30 秒
- 页面会显示你的网址：
  > 🌍 `https://你的用户名.github.io/divine-sword/`

---

## 🎮 第五步：手机开玩！

### Android（Chrome / Edge）
1. 浏览器打开你的网址
2. 弹出 **「输入昵称」** 弹窗
3. 输入昵称（如「剑仙小李」）→ 点 **⚔️ 进入游戏**
4. 顶部出现 **绿色圆点 + ☁️ 昵称（已同步）** → 连上了！
5. 玩一会儿，存档自动上传到云端
6. 底部弹出 **「📲 安装到主屏幕」** → 点安装 → 桌面出现图标

### iPhone（Safari）
1. Safari 打开你的网址
2. 输入昵称进入游戏
3. 点底部 **分享按钮** → **「添加到主屏幕」**
4. 确认 → 桌面出现图标

---

## 🔄 多设备同步演示

| 场景 | 操作 |
|---|---|
| **手机玩一半，电脑接着玩** | 电脑浏览器打开同一网址 → 输入**同一个昵称** → 自动下载云端存档 → 接着玩 |
| **换手机不丢档** | 新手机打开网址 → 同一昵称登录 → 存档自动恢复 |
| **清了缓存** | 重新打开网址 → 登录同一昵称 → 存档从云端拉回来 |
| **手动同步** | 点顶部的 **☁️ 同步** 按钮，立即上传当前进度 |

---

## ⚠️ 常见问题

| 问题 | 解决办法 |
|---|---|
| 打开游戏显示「连接中…」然后变红点 | URL 或 Key 填错了，检查第二步的替换是否正确 |
| 提示「relation does not exist」 | SQL 脚本没跑成功，回到第三步重新执行 |
| 上传存档没反应 | 检查 Supabase 的 RLS 策略是否创建成功（SQL 里已包含） |
| GitHub Pages 打不开 | 确认 Settings→Pages 已选 main 分支并保存 |
| 想重置云端存档 | Supabase → Table Editor → saves → 删掉对应行 |
| 昵称被占了 | 换个昵称就行，昵称全局唯一 |

---

## 💰 免费额度够用吗？

Supabase 免费版（Free Tier）包含：
- **500MB 数据库** → 你的存档每个约 10-50KB，能存 **1 万+ 个存档**
- **50 万次 API 请求/月** → 每 30 秒自动保存一次，够 **4000 小时** 游戏时间
- **无限带宽** → GitHub Pages 也是免费无限流量

**结论：一个人玩到天荒地老都用不完。**

---

## 🎯 总结流程图

```
注册 Supabase → 创建项目 → 拿到 URL+Key
        ↓
填入游戏 HTML → 保存
        ↓
Supabase 跑 SQL 建表
        ↓
上传 HTML 到 GitHub → 开启 Pages
        ↓
手机浏览器打开网址 → 输入昵称 → 开玩！
        ↓
点「安装到桌面」→ 变成 App 体验
```

🎉 **搞定！你的游戏现在有云端存档了，换设备、清缓存、换手机都不怕丢档！**

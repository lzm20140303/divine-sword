-- ============================================================
-- 神剑仙域 · Supabase 建表脚本
-- 用法：登录 Supabase → SQL Editor → New Query → 粘贴全部 → Run
-- ============================================================

-- ---------- 1. 玩家档案表（昵称 + 创建时间） ----------
create table if not exists public.profiles (
    id uuid primary key default gen_random_uuid(),
    nickname text unique not null,
    created_at timestamptz default now()
);

-- ---------- 2. 游戏进度表（存档数据，JSONB 存整个 state） ----------
create table if not exists public.saves (
    id uuid primary key default gen_random_uuid(),
    nickname text unique not null references public.profiles(nickname) on delete cascade,
    state_json jsonb not null,
    updated_at timestamptz default now()
);

-- ---------- 3. 全局排行榜（BOSS 伤害） ----------
create table if not exists public.leaderboard (
    id uuid primary key default gen_random_uuid(),
    nickname text not null,
    boss_name text not null,
    max_damage bigint not null,
    achieved_at timestamptz default now()
);

-- ---------- 4. 公会数据表（多设备共享） ----------
create table if not exists public.guilds (
    id uuid primary key default gen_random_uuid(),
    name text unique not null,
    leader text not null,
    treasury jsonb default '{}'::jsonb,
    tech jsonb default '{}'::jsonb,
    members text[] default '{}',
    created_at timestamptz default now()
);

-- ============================================================
-- 启用 RLS（行级安全），免费版必须开
-- ============================================================
alter table public.profiles    enable row level security;
alter table public.saves       enable row level security;
alter table public.leaderboard enable row level security;
alter table public.guilds      enable row level security;

-- ============================================================
-- RLS 策略：匿名 key 也能读写（单机小游戏，数据非敏感）
-- 如果想限制"只能改自己的存档"，可改用下面注释里的严格版
-- ============================================================

-- profiles：所有人可读写
create policy "profiles_read_all"  on public.profiles for select using (true);
create policy "profiles_insert_any" on public.profiles for insert with check (true);

-- saves：所有人可读写（简单方案）
create policy "saves_read_all"  on public.saves for select using (true);
create policy "saves_write_all" on public.saves for insert with check (true);
create policy "saves_update_all" on public.saves for update using (true);

-- leaderboard：所有人可读写
create policy "lb_read_all"  on public.leaderboard for select using (true);
create policy "lb_insert_any" on public.leaderboard for insert with check (true);

-- guilds：所有人可读写
create policy "guilds_read_all"  on public.guilds for select using (true);
create policy "guilds_write_all" on public.guilds for insert with check (true);
create policy "guilds_update_all" on public.guilds for update using (true);

-- ============================================================
-- 自动更新 updated_at 的触发器
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists saves_touch_updated_at on public.saves;
create trigger saves_touch_updated_at
    before update on public.saves
    for each row execute function public.touch_updated_at();

-- ============================================================
-- 验证
-- ============================================================
-- select '建表完成' as status;
-- select count(*) from information_schema.tables where table_schema='public';
-- 应该返回 4

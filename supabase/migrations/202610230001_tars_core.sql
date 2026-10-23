create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  agent_name text not null default 'TARS',
  agent_role text not null default 'Personal agent',
  agent_avatar text not null default 'tars',
  agent_color text not null default '#E9A95F',
  theme_preference text not null default 'dark' check (theme_preference in ('system', 'light', 'dark')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'side' check (type in ('main', 'side')),
  title text not null default 'New conversation',
  has_unread_updates boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create unique index if not exists chat_threads_one_main_per_user
  on public.chat_threads(user_id) where type = 'main';
create index if not exists chat_threads_user_updated
  on public.chat_threads(user_id, updated_at desc);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null check (char_length(content) between 1 and 20000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint chat_messages_thread_user_fk foreign key (thread_id, user_id) references public.chat_threads(id, user_id) on delete cascade
);
create index if not exists chat_messages_thread_created
  on public.chat_messages(thread_id, created_at);

create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '' check (char_length(description) <= 5000),
  category text not null default 'General',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ideas_user_updated on public.ideas(user_id, updated_at desc);

create table if not exists public.scheduled_agent_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  original_prompt text not null check (char_length(original_prompt) between 1 and 10000),
  task_type text not null default 'generic_prompt' check (task_type = 'generic_prompt'),
  task_payload jsonb not null default '{}'::jsonb,
  schedule_rule jsonb not null,
  timezone text not null default 'UTC',
  delivery text not null default 'chat',
  next_run_at timestamptz not null,
  last_run_at timestamptz,
  last_run_status text check (last_run_status in ('completed', 'failed')),
  last_run_summary text,
  last_run_error text,
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists scheduled_tasks_user_created
  on public.scheduled_agent_tasks(user_id, created_at desc);
create index if not exists scheduled_tasks_due
  on public.scheduled_agent_tasks(status, next_run_at) where status = 'active';

create table if not exists public.agent_tool_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_id text,
  action_name text not null,
  input_summary text not null default '',
  output_summary text,
  error_message text,
  status text not null check (status in ('completed', 'failed', 'running')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists agent_tool_runs_user_created
  on public.agent_tool_runs(user_id, created_at desc);
create index if not exists agent_tool_runs_scheduled
  on public.agent_tool_runs((metadata->>'scheduled_task_id'));

create table if not exists public.user_tool_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_id text not null,
  status text not null default 'not_connected',
  composio_connected_account_id text,
  composio_connection_request_id text,
  connected_label text,
  connected_email text,
  connected_at timestamptz,
  last_checked_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(user_id, tool_id)
);

create table if not exists public.tools (
  id text primary key,
  name text not null,
  slug text not null unique,
  toolkit_slug text,
  description text not null default '',
  category text not null default 'Other',
  logo_url text,
  icon_url text,
  logo_key text,
  actions jsonb not null default '[]'::jsonb,
  composio_auth_config_id text,
  sort_order integer not null default 0,
  enabled boolean not null default false
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

do $$
declare tbl text;
begin
  foreach tbl in array array['profiles','chat_threads','ideas','scheduled_agent_tasks','user_tool_connections'] loop
    execute format('drop trigger if exists touch_updated_at on public.%I', tbl);
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()', tbl);
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.ideas enable row level security;
alter table public.scheduled_agent_tasks enable row level security;
alter table public.agent_tool_runs enable row level security;
alter table public.user_tool_connections enable row level security;
alter table public.tools enable row level security;

create policy profiles_owner on public.profiles for all to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy threads_owner on public.chat_threads for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy messages_owner on public.chat_messages for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy ideas_owner on public.ideas for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy scheduled_tasks_owner on public.scheduled_agent_tasks for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy agent_runs_owner_select on public.agent_tool_runs for select to authenticated using ((select auth.uid()) = user_id);
create policy connections_owner on public.user_tool_connections for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy tools_read_enabled on public.tools for select to authenticated using (enabled);

grant select, insert, update, delete on public.profiles, public.chat_threads, public.chat_messages, public.ideas, public.scheduled_agent_tasks, public.user_tool_connections to authenticated;
grant select on public.agent_tool_runs to authenticated;
grant select on public.tools to authenticated;

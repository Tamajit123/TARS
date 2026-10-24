-- Additive repairs for authenticated profiles, idempotent chat requests, and
-- private avatar storage. This migration intentionally leaves any existing
-- public.users table and its data untouched.

begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  agent_name text not null default 'TARS',
  agent_role text not null default 'Personal agent',
  agent_avatar text not null default 'tars',
  agent_color text not null default '#E9A95F',
  theme_preference text not null default 'dark'
    check (theme_preference in ('system', 'light', 'dark')),
  avatar_path text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles add column if not exists preferences jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists theme_preference text not null default 'dark';
alter table public.profiles enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'tars_profiles_owner_guard') then
    create policy tars_profiles_owner_guard on public.profiles as restrictive for all to authenticated
      using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'tars_profiles_select_own') then
    create policy tars_profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'tars_profiles_insert_own') then
    create policy tars_profiles_insert_own on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'tars_profiles_update_own') then
    create policy tars_profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
  end if;
end $$;
grant select, insert, update on public.profiles to authenticated;

-- Reconcile the already-existing chat_threads table shown in the supplied
-- project screenshots. create table IF NOT EXISTS in the bootstrap migration
-- cannot add these columns to a table that predates that migration.
alter table public.chat_threads add column if not exists type text not null default 'side';
alter table public.chat_threads add column if not exists has_unread_updates boolean not null default false;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.chat_threads'::regclass and conname = 'chat_threads_type_allowed') then
    alter table public.chat_threads add constraint chat_threads_type_allowed check (type in ('main', 'side')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.chat_threads'::regclass and conname = 'chat_threads_owner_auth_fk') then
    alter table public.chat_threads add constraint chat_threads_owner_auth_fk
      foreign key (user_id) references auth.users(id) on delete cascade not valid;
  end if;
end $$;
create unique index if not exists chat_threads_id_user_unique on public.chat_threads (id, user_id);
create unique index if not exists chat_threads_one_main_per_user
  on public.chat_threads (user_id) where type = 'main';
alter table public.chat_threads enable row level security;

-- A restrictive owner guard also constrains the four policies already present
-- on the existing table; permissive policies are ORed unless guarded.
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'chat_threads' and policyname = 'tars_threads_owner_guard') then
    create policy tars_threads_owner_guard on public.chat_threads as restrictive for all to authenticated
      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'chat_threads' and policyname = 'tars_threads_select_own') then
    create policy tars_threads_select_own on public.chat_threads for select to authenticated using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'chat_threads' and policyname = 'tars_threads_insert_own') then
    create policy tars_threads_insert_own on public.chat_threads for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'chat_threads' and policyname = 'tars_threads_update_own') then
    create policy tars_threads_update_own on public.chat_threads for update to authenticated
      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'chat_threads' and policyname = 'tars_threads_delete_own') then
    create policy tars_threads_delete_own on public.chat_threads for delete to authenticated using ((select auth.uid()) = user_id);
  end if;
end $$;
grant select, insert, update, delete on public.chat_threads to authenticated;

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null check (char_length(content) between 1 and 20000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint chat_messages_thread_user_fk foreign key (thread_id, user_id)
    references public.chat_threads(id, user_id) on delete cascade
);
alter table public.chat_messages add column if not exists request_id text;
create index if not exists chat_messages_thread_created on public.chat_messages (thread_id, created_at);
alter table public.chat_messages enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'chat_messages' and policyname = 'tars_messages_owner_guard') then
    create policy tars_messages_owner_guard on public.chat_messages as restrictive for all to authenticated
      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'chat_messages' and policyname = 'tars_messages_owner') then
    create policy tars_messages_owner on public.chat_messages for all to authenticated
      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
end $$;
grant select, insert, update, delete on public.chat_messages to authenticated;

-- The legacy public."Users" table has a bigint identity and a token column,
-- and is shown with RLS disabled. Preserve all rows, but deny Data API access
-- until an explicit, verified identity mapping is designed.
do $$ begin
  if to_regclass('public."Users"') is not null then
    execute 'alter table public."Users" enable row level security';
    execute 'revoke all on table public."Users" from anon, authenticated';
  end if;
end $$;

-- Provision profiles for new users. Auth remains the identity source of truth;
-- user metadata supplies only an editable display name.
create schema if not exists private;
create or replace function private.provision_tars_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.provision_tars_profile() from public, anon, authenticated;
grant usage on schema private to supabase_auth_admin;
grant execute on function private.provision_tars_profile() to supabase_auth_admin;

drop trigger if exists tars_auth_user_profile on auth.users;
create trigger tars_auth_user_profile
  after insert on auth.users
  for each row execute function private.provision_tars_profile();

-- Client-side recovery is safe and idempotent if the Auth trigger was delayed.
create unique index if not exists chat_messages_request_role_unique
  on public.chat_messages (user_id, request_id, role)
  where request_id is not null;

create table if not exists public.ai_chat_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null,
  request_id text not null check (char_length(request_id) between 8 and 80),
  status text not null default 'pending'
    check (status in ('pending', 'provider_failed', 'persistence_failed', 'completed')),
  response_text text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_chat_request_conversation_owner_fk
    foreign key (conversation_id, user_id)
    references public.chat_threads(id, user_id) on delete cascade,
  constraint ai_chat_request_user_request_unique unique (user_id, request_id)
);

create index if not exists ai_chat_requests_user_recent
  on public.ai_chat_requests (user_id, created_at desc);
alter table public.chat_messages add column if not exists request_id text;
create unique index if not exists chat_messages_request_role_unique
  on public.chat_messages (user_id, request_id, role)
  where request_id is not null;
alter table public.ai_chat_requests enable row level security;
revoke all on public.ai_chat_requests from anon, authenticated;
grant all on public.ai_chat_requests to service_role;

-- A private bucket stores a user's avatar at <auth.uid()>/<random-file-name>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tars-avatars', 'tars-avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'tars_avatars_select_owner') then
    create policy tars_avatars_select_owner on storage.objects for select to authenticated
      using (bucket_id = 'tars-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'tars_avatars_insert_owner') then
    create policy tars_avatars_insert_owner on storage.objects for insert to authenticated
      with check (bucket_id = 'tars-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'tars_avatars_update_owner') then
    create policy tars_avatars_update_owner on storage.objects for update to authenticated
      using (bucket_id = 'tars-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
      with check (bucket_id = 'tars-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'tars_avatars_delete_owner') then
    create policy tars_avatars_delete_owner on storage.objects for delete to authenticated
      using (bucket_id = 'tars-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
end $$;

commit;

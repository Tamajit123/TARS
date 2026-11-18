begin;
set local lock_timeout = '5s';
create table public.composio_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_id text not null unique check (session_id like 'trs_%'),
  created_at timestamptz not null default now()
);
alter table public.composio_sessions enable row level security;
revoke all on public.composio_sessions from anon, authenticated;
grant select on public.composio_sessions to authenticated;
grant all on public.composio_sessions to service_role;
create policy composio_session_owner on public.composio_sessions for select to authenticated
  using (user_id = (select auth.uid()));
comment on table public.composio_sessions is 'Server-owned Composio session mapping for existing TARS Auth UUIDs. Contains no API keys or provider tokens.';
commit;

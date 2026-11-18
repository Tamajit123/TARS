-- Additive only. Existing user data, auth and provider accounts are untouched.
create table public.pending_tool_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null,
  request_id text not null,
  tool_slug text not null,
  toolkit text not null,
  arguments jsonb not null check (jsonb_typeof(arguments) = 'object'),
  input_schema jsonb not null check (jsonb_typeof(input_schema) = 'object'),
  summary text not null,
  status text not null default 'pending' check (status in ('pending','executing','completed','failed','cancelled')),
  result jsonb,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (conversation_id, user_id) references public.chat_threads(id, user_id) on delete cascade,
  unique (user_id, conversation_id, request_id, tool_slug),
  check (octet_length(arguments::text) <= 20000)
);
create index pending_tool_actions_owner_conversation on public.pending_tool_actions(user_id, conversation_id, created_at);
alter table public.pending_tool_actions enable row level security;
revoke all on public.pending_tool_actions from anon, authenticated;
grant select on public.pending_tool_actions to authenticated;
grant all on public.pending_tool_actions to service_role;
create policy pending_actions_owner_read on public.pending_tool_actions for select to authenticated
  using ((select auth.uid()) = user_id);
comment on table public.pending_tool_actions is 'Server-prepared immutable external writes. Only the verified owner can request confirmation; clients cannot edit arguments or status.';

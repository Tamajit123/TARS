-- Additive: retain every existing table, account, message and scheduled agent.
create table public.chat_attachments (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null,
  message_id uuid references public.chat_messages(id) on delete set null,
  name text not null check (length(name) between 1 and 180),
  mime_type text not null,
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  object_path text not null unique,
  duration_ms integer check (duration_ms between 0 and 300000),
  created_at timestamptz not null default now(),
  foreign key (thread_id,user_id) references public.chat_threads(id,user_id) on delete cascade,
  check (object_path = user_id::text || '/' || thread_id::text || '/' || id::text)
);
create index chat_attachments_owner_thread on public.chat_attachments(user_id,thread_id,created_at);
create index chat_attachments_message on public.chat_attachments(message_id);
alter table public.chat_attachments enable row level security;
revoke all on public.chat_attachments from anon,authenticated;
grant select,insert,delete on public.chat_attachments to authenticated;
grant all on public.chat_attachments to service_role;
create policy attachment_owner_read on public.chat_attachments for select to authenticated using ((select auth.uid())=user_id);
create policy attachment_owner_draft on public.chat_attachments for insert to authenticated with check ((select auth.uid())=user_id and message_id is null);
create policy attachment_owner_remove_draft on public.chat_attachments for delete to authenticated using ((select auth.uid())=user_id and message_id is null);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('tars-chat','tars-chat',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf','text/plain','text/csv','application/json','audio/mp4','audio/m4a','audio/mpeg','audio/wav','audio/webm','audio/ogg','application/msword','application/vnd.ms-excel','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation']);
create policy chat_file_owner_read on storage.objects for select to authenticated using (bucket_id='tars-chat' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy chat_file_draft_upload on storage.objects for insert to authenticated with check (bucket_id='tars-chat' and exists(select 1 from public.chat_attachments a where a.object_path=storage.objects.name and a.user_id=(select auth.uid()) and a.message_id is null));
create policy chat_file_draft_remove on storage.objects for delete to authenticated using (bucket_id='tars-chat' and exists(select 1 from public.chat_attachments a where a.object_path=storage.objects.name and a.user_id=(select auth.uid()) and a.message_id is null));

create table public.task_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check(length(title) between 1 and 160),
  due_at timestamptz not null,
  repeat text not null default 'once' check(repeat in ('once','daily','weekly')),
  timezone text not null check(length(timezone) between 1 and 80),
  sound boolean not null default true,
  status text not null default 'active' check(status in ('active','completed','cancelled')),
  revision integer not null default 1 check(revision>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id)
);
create index task_reminders_owner_due on public.task_reminders(user_id,status,due_at);
create trigger touch_updated_at before update on public.task_reminders for each row execute function public.touch_updated_at();
alter table public.task_reminders enable row level security;
revoke all on public.task_reminders from anon,authenticated;
grant select,insert,update,delete on public.task_reminders to authenticated;
grant all on public.task_reminders to service_role;
create policy reminder_owner on public.task_reminders for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create table public.reminder_notifications (
  reminder_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null,
  notification_id text not null check(length(notification_id)<200),
  revision integer not null check(revision>0),
  state text not null check(state in ('scheduled','blocked','cancelled')),
  updated_at timestamptz not null default now(),
  primary key(reminder_id,device_id),
  foreign key(reminder_id,user_id) references public.task_reminders(id,user_id) on delete cascade
);
create index reminder_notifications_owner on public.reminder_notifications(user_id,device_id);
alter table public.reminder_notifications enable row level security;
revoke all on public.reminder_notifications from anon,authenticated;
grant select,insert,update,delete on public.reminder_notifications to authenticated;
grant all on public.reminder_notifications to service_role;
create policy reminder_device_owner on public.reminder_notifications for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

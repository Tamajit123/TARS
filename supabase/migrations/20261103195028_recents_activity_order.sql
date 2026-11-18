-- Schema maintenance invokes the existing updated_at trigger. Recents must use
-- actual user activity rather than administrative edits to a title/category.
-- Service-owned triggers call internal helpers; clients get no schema access.
grant usage on schema private to service_role;
create or replace function public.get_tars_recents()
returns table(id uuid,title text,has_unread_updates boolean,created_at timestamptz,updated_at timestamptz)
language sql stable security invoker set search_path='' as $$
  select t.id,t.title,t.has_unread_updates,t.created_at,
    greatest(t.created_at,coalesce((select max(m.created_at) from public.chat_messages m
      where m.thread_id=t.id and m.user_id=t.user_id),t.created_at)) as updated_at
  from public.chat_threads t where t.user_id=(select auth.uid())
  order by updated_at desc,t.id;
$$;
revoke all on function public.get_tars_recents() from public,anon;
grant execute on function public.get_tars_recents() to authenticated,service_role;

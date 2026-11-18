-- Generate a default title only for the first nonempty user message. Later
-- messages must never overwrite a user rename. No existing rows are rewritten.
create or replace function private.title_tars_conversation()
returns trigger language plpgsql security invoker set search_path='' as $$
declare first_query text; first_message uuid;
begin
  if new.role<>'user' then return new; end if;
  select id,content into first_message,first_query from public.chat_messages
    where thread_id=new.thread_id and user_id=new.user_id and role='user'
      and length(btrim(content))>0 order by created_at,id limit 1;
  if first_message=new.id then
    update public.chat_threads
      set title=left(regexp_replace(btrim(first_query),'[[:space:]]+',' ','g'),80),updated_at=now()
      where id=new.thread_id and user_id=new.user_id
        and (title is null or title in ('','New Chat','New conversation','Main chat','Main conversation'));
  end if;
  return new;
end $$;
revoke all on function private.title_tars_conversation() from public,anon;
grant execute on function private.title_tars_conversation() to authenticated,service_role;

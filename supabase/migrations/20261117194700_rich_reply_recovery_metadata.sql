-- Preserve rich responses when the first assistant insert needs a safe retry.
-- Existing records are untouched; nullable column avoids a table rewrite.
alter table public.ai_chat_requests add column if not exists response_metadata jsonb;
alter table public.ai_chat_requests add constraint ai_chat_response_metadata_object
  check (response_metadata is null or (jsonb_typeof(response_metadata) = 'object' and octet_length(response_metadata::text) <= 180000));
-- RLS and existing service-only writes remain in force.
-- Rollback, only after old workers are drained: drop the constraint, then column.

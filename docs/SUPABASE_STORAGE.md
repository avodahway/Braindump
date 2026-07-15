# Brain Dump Supabase Storage

The public backend can use Supabase Postgres as a durable key-value store for beta records.

## Table Schema

Run this SQL in the Supabase SQL editor:

```sql
create table if not exists public.brain_dump_kv (
  store_key text primary key,
  value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists brain_dump_kv_updated_at on public.brain_dump_kv;

create trigger brain_dump_kv_updated_at
before update on public.brain_dump_kv
for each row
execute function public.set_updated_at();

alter table public.brain_dump_kv enable row level security;
```

The backend uses the Supabase service role key from server-side environment variables. Do not expose that key in the
frontend.

## Required Backend Env

```sh
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=replace-with-service-role-key
SUPABASE_KV_TABLE=brain_dump_kv
```

`SUPABASE_KV_TABLE` is optional when the table is named `brain_dump_kv`.

## Stored Record Categories

The durable store writes namespaced keys for:

- OAuth state records.
- Google token records.
- User workspace records.
- Browser session records.
- Idempotency responses.
- Execution logs.
- Privacy-safe analytics events.

## Backup Expectations

Before inviting beta users:

- Use a paid Supabase plan with backups enabled.
- Confirm point-in-time recovery or scheduled backups are available.
- Test restore in staging with non-production OAuth credentials.
- Keep the service role key in backend host secrets and a password manager.

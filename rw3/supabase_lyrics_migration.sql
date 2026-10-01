-- Run once in Supabase SQL Editor
alter table public.songs add column if not exists lyrics jsonb;

-- lyrics format: [{"time":12.3,"text":"..."}, ...]

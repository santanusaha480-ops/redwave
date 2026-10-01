UPDATE storage.buckets SET public = false WHERE id = 'music';
UPDATE public.songs
SET audio_url = regexp_replace(audio_url, '^https://[^/]+/storage/v1/object/public/music/', '')
WHERE audio_url LIKE 'https://%/storage/v1/object/public/music/%';

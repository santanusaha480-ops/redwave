# RedWave private music storage

The Supabase `music` bucket is private. The website no longer uses public music URLs. When a logged-in user presses play, RedWave calls the `get-media-url` Edge Function, which validates the user's session and returns a Supabase signed URL valid for 1 hour. The browser uses that temporary URL for playback.

Supabase signed URLs are time-limited URLs intended for private buckets.

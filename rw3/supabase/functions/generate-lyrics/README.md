# RedWave Auto Lyrics Edge Function

Deploy this folder as `generate-lyrics` in Supabase Edge Functions.

Required secret:
- `OPENAI_API_KEY` — keep this only in Supabase Edge Function secrets.

The function checks that the caller is an authenticated user whose `profiles.role` is `admin`.

It transcribes the uploaded audio with timestamped segments, then normalizes Hindi into Roman/Hinglish while preserving English. The OpenAI key is never exposed to the browser.

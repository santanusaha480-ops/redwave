# RedWave Auto Lyrics — fixed

## 1. Deploy the Edge Function

Deploy `supabase/functions/generate-lyrics` as the Supabase Edge Function named `generate-lyrics`.

If using the Supabase CLI:

```bash
supabase functions deploy generate-lyrics
```

## 2. Add the OpenAI key securely

In Supabase Dashboard → Edge Functions → Secrets, add:

`OPENAI_API_KEY` = your OpenAI API key

Never put this key in `supabase-config.js` or browser JavaScript.

## 3. Admin access

The function verifies the caller's Supabase session and checks `public.profiles.role = 'admin'` before doing any transcription.

## 4. Auto-generate behavior

Admin → Add/Edit Music → choose an audio file → **Auto-generate lyrics**.

The browser now:
- rejects audio over 25 MB before sending it;
- shows a clear generating state;
- stops waiting after 90 seconds instead of hanging forever;
- displays the actual server error;
- keeps the timestamped lines when the language-cleanup step fails.

The backend uses timestamped transcription and then normalizes Hindi into Roman/Hinglish while keeping English in English. The returned format is:

```json
[{"time":12.3,"text":"Example line"}]
```

This is designed for the existing RedWave synced-lyrics player.

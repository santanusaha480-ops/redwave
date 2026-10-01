# RedWave Security Hardening v2

- Supabase is the backend for Auth, Postgres and Storage.
- No Netlify configuration or Netlify domain fallback remains in the app.
- Browser uses only the Supabase publishable key; never put a service-role/secret key in the frontend.
- PKCE authentication is enabled.
- RLS remains enabled on profiles, songs and likes.
- Profile UPDATE is column-restricted: authenticated users can change only `name` and `avatar_url`; they cannot change `role`, `id`, or timestamps.
- Songs are publicly readable for playback, but INSERT/UPDATE/DELETE are restricted to profiles whose role is `admin`.
- Likes are restricted to the authenticated user's own rows.
- Authorization checks use database-side `auth.uid()` and the protected `profiles.role` value.
- Storage upload/update/delete policies remain admin-only for music and covers.
- `_headers` adds HSTS, clickjacking protection, MIME sniffing protection, referrer policy, permissions policy, and a Content Security Policy for static hosting.

## Important deployment setting

In Supabase Auth URL Configuration, set your real production site URL and only the exact redirect URL(s) you use. Do not add wildcard redirect URLs.

## Important secret rule

The `sb_publishable_...` key in `supabase-config.js` is designed for frontend use. Never put a Supabase `service_role` or secret key in this ZIP or any browser JavaScript.

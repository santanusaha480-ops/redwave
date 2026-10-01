# RedWave — Supabase setup (fixed auth version)

## Important: do NOT double-click index.html
Use `START_REDWAVE.bat`. It starts a local HTTP server at `http://localhost:5500` and opens RedWave in the browser. Supabase email confirmation and password-reset redirects need an HTTP/HTTPS URL; `file://` is not a valid production-style redirect.

## Supabase Auth settings
In Supabase Dashboard → Authentication → Providers → Email:
- Enable Email provider.
- Enable password sign-in.
- For testing, you may temporarily disable Confirm email so signup immediately creates a session. For production, keep Confirm email enabled.

In Authentication → URL Configuration:
- Site URL: `http://localhost:5500/`
- Redirect URL: `http://localhost:5500/**`

Supabase documents that the Site URL and allowed Redirect URLs are used for email confirmations and password resets.

## Email confirmation
If Confirm email is enabled, signup creates the user but does not create an authenticated session until the email is confirmed. The user must click the email before logging in.

## Password reset
RedWave uses Supabase `resetPasswordForEmail()` and `updateUser()`.
- Click Forgot password.
- Enter email.
- Follow the reset email.
- Set a new password.

## Admin
After you create and confirm your first account, run this once in SQL Editor:

```sql
update public.profiles
set role='admin'
where id=(select id from auth.users order by created_at asc limit 1);
```

Then open `http://localhost:5500/admin/index.html`.

## Listener profile panel (avatar, name, email)
Clicking the badge in the top-right header now opens a panel where a listener can change their display name, profile picture and email. Password changes stay only on the dedicated "Forgot password?" flow on the login screen. The panel reuses the existing `profiles` table and the `covers` storage bucket (photos are saved under an `avatars/` folder there, so no new bucket is required).

For this to work, make sure in SQL Editor that logged-in users are allowed to update their own profile row (a `select` policy already exists per the rest of this doc, but `update` may not):

```sql
create policy "Users can update their own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);
```

Changing the email address triggers Supabase's normal email-change confirmation flow — the new address only takes effect once the listener clicks the confirmation link.

## Troubleshooting
If signup says the request failed, check Authentication → Logs and the browser console. The RedWave UI now shows the Supabase error instead of silently failing.

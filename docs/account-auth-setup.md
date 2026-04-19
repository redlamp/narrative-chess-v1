# Account Auth Setup

## GitHub Pages

The GitHub Pages workflow reads these GitHub Actions variables during the Vite build:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_ENABLE_SUPABASE_PUBLISHED_CITIES`

These are public frontend build values, not service-role secrets. They are set as repository variables with `gh variable set` from the local `apps/web/.env.local` values.

## Supabase Auth URLs

Supabase Auth redirect URLs still need to be configured in the Supabase dashboard because the available MCP tools do not expose Auth URL mutation in this session.

Add these under Supabase Auth URL settings:

- Site URL: `https://redlamp.github.io/narrative-chess/`
- Redirect URL: `http://localhost:5173`
- Redirect URL: `https://redlamp.github.io/narrative-chess/`

Add the future custom domain or subdomain here before testing auth on that domain.

## Current App Flows

- Email/password sign in.
- Email/password sign up with password confirmation.
- Forgot password email.
- Signed-in password update with password confirmation.
- Profile display name update for all signed-in users.
- Username creation for users without a username; username reset only remains visible to admins after a username exists.

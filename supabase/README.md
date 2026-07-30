# Supabase change workflow

The application uses Supabase only from `server.mjs` with the service-role key. Browser roles (`anon` and `authenticated`) intentionally have no privileges on the application tables. RLS remains enabled as defense in depth.

## Rules

1. Never put `SUPABASE_SERVICE_ROLE_KEY` or `APP_ENCRYPTION_KEY` in browser code, logs, screenshots, or committed files.
2. Do not edit the production schema in Table Editor or SQL Editor.
3. Create and review a timestamped file in `supabase/migrations/` for every schema change.
4. Test forward migrations on an isolated environment when the Supabase plan supports branches. Otherwise use a local Supabase stack; a transaction ending in `ROLLBACK` may be used only as a syntax/safety dry run.
5. Run Supabase security and performance advisors after every migration.
6. Prefer rolling back the Node deployment first. The SQL in `supabase/reversals/` is emergency-only because it deliberately restores weaker permissions.

## Production requirements

- `AUTH_REQUIRED=true`
- `ADMIN_EMAILS` contains only the approved bootstrap administrator
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` target the same project
- `APP_ENCRYPTION_KEY` is stable across deployments
- Public signup is disabled in Supabase Auth
- The application exposes no email invitation or recovery route; Admins create confirmed accounts and manage passwords through server-only Auth Admin operations
- Leaked-password protection is enabled when the Supabase organization plan supports it; it remains disabled on the current Free plan
- `private` is not listed among exposed Data API schemas

The application supports only `admin` and `user`. Both roles have global client access; user-directory management and audit-log viewing remain Admin-only. Existing `client_assignments` rows are preserved but are not an authorization source.

Do not claim or enforce TOTP MFA until the application has enrollment and challenge screens. MFA is not implemented in the current release.

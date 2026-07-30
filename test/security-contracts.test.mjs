import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function source(relativePath) {
  return readFile(new URL(relativePath, root), "utf8");
}

test("authentication exposes manual creation and password-management routes without signup or recovery email routes", async () => {
  const [server, frontend] = await Promise.all([
    source("server.mjs"),
    source("public/app.js")
  ]);

  for (const route of [
    "/api/settings/users",
    "/api/settings/users/invite",
    "/api/settings/audit-logs",
    "/api/auth/password-change",
    "/password-reset"
  ]) {
    assert.match(server, new RegExp(route.replaceAll("/", "\\/")));
  }
  assert.doesNotMatch(server, /\/api\/auth\/password-reset\/request/);
  assert.doesNotMatch(server, /\/api\/auth\/password-reset\/complete/);
  assert.doesNotMatch(server, /AUTH_EMAIL_DELIVERY_ENABLED|APP_BASE_URL/);
  assert.doesNotMatch(frontend, /AUTH_EMAIL_DELIVERY_ENABLED|APP_BASE_URL|password-reset\/request|password-reset\/complete/);
  assert.doesNotMatch(server, /\/api\/auth\/sign-?up/i);
  assert.doesNotMatch(frontend, /data-sign-?up|id=["']sign-?up/i);
  assert.match(server, /email_confirm:\s*true/);
  assert.match(server, /admin\/users\/\$\{encodeURIComponent\(targetUserId\)\}/);
});

test("user directory and security audit routes enforce Admin on the server", async () => {
  const server = await source("server.mjs");
  const directoryStart = server.indexOf('pathname === "/api/settings/users"');
  const auditStart = server.indexOf('pathname === "/api/settings/audit-logs"');
  assert.notEqual(directoryStart, -1);
  assert.notEqual(auditStart, -1);
  assert.match(server.slice(directoryStart, directoryStart + 300), /canAccess\(user, "admin"\)/);
  assert.match(server.slice(auditStart, auditStart + 300), /canAccess\(user, "admin"\)/);
  assert.match(server, /securityAuditActions/);
});

test("HighLevel request call sites contain no mutation methods", async () => {
  const server = await source("server.mjs");
  const callPattern = /highLevelRequest\(client,\s*\{[\s\S]{0,220}?method:\s*"(PUT|PATCH|DELETE)"/g;
  assert.doesNotMatch(server, callPattern);
  assert.match(server, /assertHighLevelReadOnly\(method, endpointPath\)/);
});

test("Admin and User migration preserves browser revocations and global client access", async () => {
  const migration = await source("supabase/migrations/20260729075229_admin_user_roles.sql");
  assert.match(migration, /where role in \('operator', 'viewer'\)/);
  assert.match(migration, /check \(role in \('admin', 'user'\)\)/);
  assert.match(migration, /private\.current_app_role\(\) in \('admin', 'user'\)/);
  assert.match(migration, /create trigger preserve_active_admin/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /revoke all privileges on table public\.clients from anon, authenticated/);
  assert.match(migration, /grant all privileges on table public\.clients to service_role/);
});

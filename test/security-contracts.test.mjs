import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

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

test("Blast Analyzer only displays analyses for the selected client", async () => {
  const frontend = await source("public/app.js");

  assert.match(frontend, /\.filter\(\(item\) => item\.clientId === clientId\)/);
  assert.match(frontend, /state\.activeBlastAnalysis\?\.clientId === clientId/);
  assert.match(frontend, /requireClientOptions\(blastClientId\)/);
  assert.match(frontend, /state\.blastClientId = event\.target\.value/);
  assert.match(frontend, /No saved blast analysis exists for/);
  assert.doesNotMatch(frontend, /Date\.now\(\) - startedAt > 15 \* 60 \* 1000/);

  const selectionFunctions = frontend.slice(
    frontend.indexOf("function timestampValue"),
    frontend.indexOf("function blastDraftValue")
  );
  const context = {
    state: {
      blastResultsCleared: false,
      activeBlastAnalysisId: "analysis-a",
      activeBlastAnalysis: {
        id: "analysis-a",
        clientId: "client-a",
        createdAt: "2026-07-31T12:00:00.000Z"
      },
      blastAnalyses: [
        {
          id: "analysis-a",
          clientId: "client-a",
          createdAt: "2026-07-31T12:00:00.000Z"
        },
        {
          id: "analysis-b-old",
          clientId: "client-b",
          createdAt: "2026-07-30T12:00:00.000Z"
        },
        {
          id: "analysis-b-new",
          clientId: "client-b",
          createdAt: "2026-07-31T11:00:00.000Z"
        }
      ]
    }
  };

  runInNewContext(selectionFunctions, context);
  const selected = runInNewContext('selectedBlastAnalysis("client-b")', context);
  assert.equal(selected.id, "analysis-b-new");
  context.state.blastResultsCleared = true;
  assert.equal(runInNewContext('selectedBlastAnalysis("client-b")', context), null);
});

test("Blast Analyzer renders an accessible phased progress indicator", async () => {
  const frontend = await source("public/app.js");
  const styles = await source("public/styles.css");

  assert.match(frontend, /role="progressbar"/);
  assert.match(frontend, /aria-valuenow/);
  assert.match(frontend, /blast-progress-fill/);
  assert.match(frontend, /updateBlastProgress\(job\.progress\)/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
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

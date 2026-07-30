import http from "node:http";
import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

import {
  canAccessClientId,
  canAccessJob,
  hasMinimumRole,
  scopedClientIds
} from "./src/access-control.mjs";
import {
  isSupportedAppRole,
  isPendingAdminUserRoleMigration,
  manualUserCreationValidationError,
  managedPasswordResetValidationError,
  normalizeAppRole,
  safeManagedUser,
  selfPasswordChangeValidationError,
  validateManagedUserMutation
} from "./src/auth-management.mjs";
import { safeAuditMessage } from "./src/audit.mjs";
import {
  applyBlastClassificationGuards,
  blastContactAnalysisState,
  classifyConversationByRules,
  contactDndStatus,
  selectAnchoredBlastThread
} from "./src/blast-thread.mjs";
import { blastProgress } from "./src/blast-progress.mjs";
import {
  collectCursorPagedHighLevelItems,
  collectPagedHighLevelItems,
  dailyUtcWindows
} from "./src/highlevel-pagination.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");
const storePath = path.join(dataDir, "store.json");
const jobsDir = path.join(dataDir, "jobs");
const port = Number(process.env.PORT || 3000);
const highLevelBaseUrl = process.env.HIGHLEVEL_API_BASE_URL || "https://services.leadconnectorhq.com";
const defaultHighLevelApiVersion = process.env.HIGHLEVEL_API_VERSION || "2021-07-28";
const configuredAiBaseUrl = process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE_URL || process.env.AI_BASE_URL || "";
const detectedAiProvider = configuredAiBaseUrl.includes("openrouter") || process.env.OPENROUTER_API_KEY ? "openrouter" : "openai";
const aiProvider = normalizeAiProvider(process.env.AI_PROVIDER || detectedAiProvider);
const aiProviderLabel = aiProvider === "openrouter" ? "OpenRouter" : "OpenAI";
const aiBaseUrl = normalizeAiBaseUrl(configuredAiBaseUrl || (aiProvider === "openrouter" ? "https://openrouter.ai/api/v1" : "https://api.openai.com/v1"));
const openAiApiKey = aiProvider === "openrouter"
  ? (process.env.OPENROUTER_API_KEY || "").trim()
  : (process.env.OPENAI_API_KEY || "").trim();
const configuredOpenAiModel = process.env.OPENAI_MODEL || (aiProvider === "openrouter" ? "openai/gpt-5.4-nano" : "gpt-5.4-nano");
const openAiModel = normalizeOpenAiModel(configuredOpenAiModel, aiProvider);
const openAiModelWarning = configuredOpenAiModel !== openAiModel
  ? aiProvider === "openrouter"
    ? `Using ${openAiModel}; OpenRouter model IDs include the provider prefix.`
    : `Using ${openAiModel}; remove the ${configuredOpenAiModel.split("/")[0]}/ prefix from OPENAI_MODEL.`
  : "";
const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseConfigured = Boolean(supabaseUrl && supabaseServiceRoleKey);
const authRequired = process.env.AUTH_REQUIRED === "true" || supabaseConfigured;
const cookieSecure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : process.env.NODE_ENV === "production";
const adminEmails = new Set(
  String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);
const securityAuditActions = [
  "auth.login",
  "auth.password_change",
  "auth.password_reset",
  "user.create",
  "user.update"
];
const highLevelReadAllowlist = new Set([
  "GET /contacts/",
  "POST /contacts/search",
  "GET /conversations/search",
  "GET /conversations/messages/export",
  "GET /opportunities/search",
  "POST /opportunities/search",
  "GET /workflows",
  "GET /workflows/"
]);

const defaultStore = {
  clients: [],
  routingSetups: [],
  blastAnalyses: [],
  reports: [],
    settings: {
      highLevelApiVersion: defaultHighLevelApiVersion,
      clickupConnected: Boolean(process.env.CLICKUP_API_TOKEN),
      aiConnected: Boolean(openAiApiKey),
      aiProvider,
      openAiModel,
      openAiModelWarning,
      safeMode: true
    }
  };

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon"
};

function normalizeAiProvider(provider) {
  const clean = String(provider || "openai").trim().toLowerCase();
  return clean === "openrouter" ? "openrouter" : "openai";
}

function normalizeAiBaseUrl(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

function normalizeOpenAiModel(model, provider = "openai") {
  const clean = String(model || "gpt-5.4-nano").trim();
  if (provider === "openrouter") {
    return clean.includes("/") ? clean : `openai/${clean}`;
  }
  return clean.startsWith("openai/") ? clean.slice("openai/".length) : clean;
}

function json(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function notFound(res) {
  json(res, 404, { error: "Not found" });
}

async function ensureStore() {
  await mkdir(dataDir, { recursive: true });
  try {
    await stat(storePath);
  } catch {
    await writeStore(defaultStore);
  }
}

async function readStore(user) {
  if (supabaseConfigured) return readSupabaseStore(user);
  await ensureStore();
  const raw = await readFile(storePath, "utf8");
  return JSON.parse(raw);
}

async function writeStore(store) {
  if (supabaseConfigured) {
    throw new Error("Whole-store writes are disabled when Supabase is configured.");
  }
  await mkdir(dataDir, { recursive: true });
  await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

async function writeJob(jobId, data) {
  await mkdir(jobsDir, { recursive: true });
  await writeFile(path.join(jobsDir, `${jobId}.json`), JSON.stringify(data), "utf8");
}

async function readJob(jobId) {
  try {
    const raw = await readFile(path.join(jobsDir, `${jobId}.json`), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function publicClient(client) {
  const { tokenCiphertext, ...safe } = client;
  return { ...safe, hasToken: Boolean(tokenCiphertext) };
}

function clientFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    locationId: row.ghl_location_id,
    clickupTaskId: row.clickup_task_id || "",
    timezone: row.timezone || "America/New_York",
    formLeadTag: row.form_lead_tag || "form lead",
    activePipelineName: row.active_pipeline_name || "",
    activePipelineId: row.active_pipeline_id || "",
    replyStageName: row.reply_stage_name || "",
    replyStageId: row.reply_stage_id || "",
    replyStageWindowHours: Number(row.reply_stage_window_hours || 24),
    tokenPreview: row.ghl_private_integration_token_preview || "",
    tokenCiphertext: row.ghl_private_integration_token_encrypted || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function clientToRow(client) {
  return {
    id: client.id,
    name: client.name,
    ghl_location_id: client.locationId,
    clickup_task_id: client.clickupTaskId || "",
    timezone: client.timezone || "America/New_York",
    form_lead_tag: client.formLeadTag || "form lead",
    active_pipeline_name: client.activePipelineName || "",
    active_pipeline_id: client.activePipelineId || "",
    reply_stage_name: client.replyStageName || "",
    reply_stage_id: client.replyStageId || "",
    reply_stage_window_hours: Number(client.replyStageWindowHours || 24),
    ghl_private_integration_token_preview: client.tokenPreview || "",
    ghl_private_integration_token_encrypted: client.tokenCiphertext || "",
    created_at: client.createdAt,
    updated_at: client.updatedAt
  };
}

function routingFromRow(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    staffContactId: row.staff_contact_id || "",
    staffPhone: row.staff_phone || "",
    expectedPhrase: row.expected_phrase || "New form submission",
    expectedDelayMinutes: Number(row.expected_delay_minutes || 10),
    active: row.active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function routingToRow(setup) {
  return {
    id: setup.id,
    client_id: setup.clientId,
    staff_contact_id: setup.staffContactId || "",
    staff_phone: setup.staffPhone || "",
    expected_phrase: setup.expectedPhrase || "New form submission",
    expected_delay_minutes: Number(setup.expectedDelayMinutes || 10),
    active: setup.active !== false,
    created_at: setup.createdAt,
    updated_at: setup.updatedAt
  };
}

function blastFromRow(row) {
  return {
    ...(row.payload || {}),
    id: row.id,
    clientId: row.client_id,
    createdAt: row.created_at
  };
}

function blastToRow(analysis) {
  return {
    id: analysis.id,
    client_id: analysis.clientId,
    date_start: analysis.dateStart,
    date_end: analysis.dateEnd,
    reply_tag: analysis.replyTag || "",
    source: analysis.source || "sample",
    payload: analysis,
    created_at: analysis.createdAt
  };
}

function reportFromRow(row) {
  return {
    ...(row.payload || {}),
    id: row.id,
    clientId: row.client_id,
    createdAt: row.created_at,
    postedToClickUp: Boolean(row.posted_to_clickup),
    clickupCommentId: row.clickup_comment_id || row.payload?.clickupCommentId || ""
  };
}

function reportToRow(report) {
  return {
    id: report.id,
    client_id: report.clientId,
    date_start: report.dateStart,
    date_end: report.dateEnd,
    status: report.status,
    source: report.source || "sample",
    posted_to_clickup: Boolean(report.postedToClickUp),
    clickup_comment_id: report.clickupCommentId || "",
    payload: report,
    created_at: report.createdAt
  };
}

async function supabaseRest(pathname, { method = "GET", query = {}, body, prefer = "" } = {}) {
  if (!supabaseConfigured) throw new Error("Supabase is not configured.");
  const url = new URL(`${supabaseUrl}/rest/v1/${pathname}`);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  });
  const response = await fetch(url, {
    method,
    headers: {
      "apikey": supabaseServiceRoleKey,
      "authorization": `Bearer ${supabaseServiceRoleKey}`,
      "content-type": "application/json",
      "accept": "application/json",
      ...(prefer ? { "prefer": prefer } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  const payload = text ? parseJsonMaybe(text) : null;
  if (!response.ok) {
    const error = new Error("Supabase database request failed.");
    error.status = response.status;
    error.detail = sanitizeApiDetail(typeof payload === "string" ? payload : payload?.message || text);
    throw error;
  }
  return payload;
}

function emptyStoreSettings() {
  return {
    highLevelApiVersion: defaultHighLevelApiVersion,
    clickupConnected: Boolean(process.env.CLICKUP_API_TOKEN),
    aiConnected: Boolean(openAiApiKey),
    aiProvider,
    openAiModel,
    openAiModelWarning,
    safeMode: true,
    storage: supabaseConfigured ? "Supabase" : "Local",
    authRequired
  };
}

function uuidFilter(values) {
  const ids = values.filter((value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value)));
  return ids.length ? `in.(${ids.join(",")})` : null;
}

async function readSupabaseStore(user) {
  const clientScope = scopedClientIds(user, { authRequired });
  if (Array.isArray(clientScope) && clientScope.length === 0) {
    return {
      clients: [],
      routingSetups: [],
      blastAnalyses: [],
      reports: [],
      settings: emptyStoreSettings()
    };
  }

  const filter = Array.isArray(clientScope) ? uuidFilter(clientScope) : null;
  if (Array.isArray(clientScope) && !filter) {
    return {
      clients: [], routingSetups: [], blastAnalyses: [], reports: [], settings: emptyStoreSettings()
    };
  }
  const [clients, routingSetups, blastAnalyses, reports] = await Promise.all([
    supabaseRest("clients", { query: { select: "*", order: "created_at.asc", id: filter || undefined } }),
    supabaseRest("routing_setups", { query: { select: "*", order: "created_at.asc", client_id: filter || undefined } }),
    supabaseRest("blast_analyses", { query: { select: "*", order: "created_at.desc", client_id: filter || undefined } }),
    supabaseRest("monthly_reports", { query: { select: "*", order: "created_at.desc", client_id: filter || undefined } })
  ]);

  return {
    clients: clients.map(clientFromRow),
    routingSetups: routingSetups.map(routingFromRow),
    blastAnalyses: blastAnalyses.map(blastFromRow),
    reports: reports.map(reportFromRow),
    settings: emptyStoreSettings()
  };
}

async function upsertSupabaseRecord(table, row) {
  return supabaseRest(table, {
    method: "POST",
    query: { on_conflict: "id" },
    body: row,
    prefer: "resolution=merge-duplicates"
  });
}

async function persistClient(store, client) {
  if (supabaseConfigured) return upsertSupabaseRecord("clients", clientToRow(client));
  return writeStore(store);
}

async function persistRoutingSetup(store, setup) {
  if (supabaseConfigured) return upsertSupabaseRecord("routing_setups", routingToRow(setup));
  return writeStore(store);
}

async function persistBlastAnalysis(store, analysis) {
  if (supabaseConfigured) return upsertSupabaseRecord("blast_analyses", blastToRow(analysis));
  return writeStore(store);
}

async function persistReport(store, report) {
  if (supabaseConfigured) return upsertSupabaseRecord("monthly_reports", reportToRow(report));
  return writeStore(store);
}

async function writeAuditLog({ authUserId = null, clientId = null, action, targetType = "", targetId = "", status = "success", message = "" }) {
  if (!supabaseConfigured) return;
  await supabaseRest("api_audit_logs", {
    method: "POST",
    body: {
      auth_user_id: authUserId || null,
      client_id: clientId || null,
      action: String(action || "unknown").slice(0, 120),
      target_type: String(targetType || "").slice(0, 80),
      target_id: String(targetId || "").slice(0, 160),
      status: status === "failure" ? "failure" : "success",
      message: safeAuditMessage(message)
    }
  });
}

async function recordAudit(event) {
  try {
    await writeAuditLog(event);
  } catch (error) {
    console.error("Audit logging failed.", error.status || "");
  }
}

function encryptionKey() {
  const secret = process.env.APP_ENCRYPTION_KEY || "local-dev-lead-hero-health-check";
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptToken(value) {
  if (!value) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

function decryptToken(value) {
  if (!value) return "";
  const [ivRaw, tagRaw, encryptedRaw] = String(value).split(".");
  if (!ivRaw || !tagRaw || !encryptedRaw) return "";
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivRaw, "base64"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64")),
    decipher.final()
  ]).toString("utf8");
}

function tokenPreview(value) {
  if (!value) return "";
  const clean = String(value).trim();
  if (clean.length <= 8) return "saved";
  return `${clean.slice(0, 4)}...${clean.slice(-4)}`;
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function setCookie(res, name, value, { maxAge = 3600 } = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`
  ];
  if (cookieSecure) parts.push("Secure");
  res.setHeader("set-cookie", parts.join("; "));
}

function clearCookie(res, name) {
  setCookie(res, name, "", { maxAge: 0 });
}

async function supabaseAuth(pathname, { method = "GET", body, token, query = {} } = {}) {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase Auth is not configured.");
  const url = new URL(`${supabaseUrl}/auth/v1/${pathname}`);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  });
  const response = await fetch(url, {
    method,
    headers: {
      "apikey": supabaseAnonKey,
      "authorization": token ? `Bearer ${token}` : `Bearer ${supabaseAnonKey}`,
      "content-type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  const payload = text ? parseJsonMaybe(text) : {};
  if (!response.ok) {
    const error = new Error("Supabase Auth request failed.");
    error.status = response.status;
    error.detail = sanitizeApiDetail(typeof payload === "string" ? payload : payload?.msg || payload?.message || text);
    throw error;
  }
  return payload;
}

async function supabaseAdminAuth(pathname, { method = "GET", body, query = {} } = {}) {
  if (!supabaseConfigured) throw new Error("Supabase Auth administration is not configured.");
  const url = new URL(`${supabaseUrl}/auth/v1/${pathname}`);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  });
  const response = await fetch(url, {
    method,
    headers: {
      "apikey": supabaseServiceRoleKey,
      "authorization": `Bearer ${supabaseServiceRoleKey}`,
      "content-type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  const payload = text ? parseJsonMaybe(text) : {};
  if (!response.ok) {
    const error = new Error("Supabase Auth administration request failed.");
    error.status = response.status;
    error.detail = sanitizeApiDetail(typeof payload === "string" ? payload : payload?.msg || payload?.message || text);
    throw error;
  }
  return payload;
}

async function loadAppUser(user) {
  const email = String(user.email || "").toLowerCase();
  if (adminEmails.has(email)) {
    if (supabaseConfigured) {
      await supabaseRest("app_users", {
        method: "POST",
        query: { on_conflict: "auth_user_id" },
        body: {
          auth_user_id: user.id,
          email,
          role: "admin",
          active: true,
          updated_at: new Date().toISOString()
        },
        prefer: "resolution=merge-duplicates"
      });
    }
    return { id: user.id, email, role: "admin", active: true, assignedClientIds: [], source: "ADMIN_EMAILS" };
  }
  if (!supabaseConfigured) {
    return { id: user.id, email, role: "admin", active: true, assignedClientIds: [], source: "local" };
  }
  const rows = await supabaseRest("app_users", {
    query: {
      select: "id,auth_user_id,email,role,active",
      auth_user_id: `eq.${user.id}`,
      limit: "1"
    }
  });
  const appUser = rows[0];
  if (!appUser?.active) return null;
  return {
    id: appUser.auth_user_id || user.id,
    email: appUser.email || email,
    role: normalizeAppRole(appUser.role),
    active: true,
    assignedClientIds: [],
    source: "app_users"
  };
}

async function getCurrentUser(req) {
  if (!authRequired) return { id: "local-dev", email: "local-dev", role: "admin", active: true, source: "local-dev" };
  const token = parseCookies(req).lh_session;
  if (!token) return null;
  try {
    const payload = await supabaseAuth("user", { token });
    const user = payload.user || payload;
    if (!user?.id) return null;
    return loadAppUser(user);
  } catch {
    return null;
  }
}

function validEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

async function getAppUserByAuthId(authUserId) {
  const rows = await supabaseRest("app_users", {
    query: {
      select: "id,auth_user_id,email,role,active,created_at,updated_at",
      auth_user_id: `eq.${authUserId}`,
      limit: "1"
    }
  });
  return rows[0] || null;
}

async function getAuthUserById(authUserId) {
  const payload = await supabaseAdminAuth(`admin/users/${encodeURIComponent(authUserId)}`);
  return payload?.user || payload;
}

async function findAuthUserByEmail(email) {
  for (let page = 1; page <= 20; page += 1) {
    const payload = await supabaseAdminAuth("admin/users", {
      query: { page, per_page: 100 }
    });
    const users = Array.isArray(payload?.users) ? payload.users : [];
    const match = users.find((user) => String(user.email || "").trim().toLowerCase() === email);
    if (match) return match;
    if (users.length < 100) return null;
  }
  return null;
}

async function listManagedUsers({ page = 1, perPage = 25 } = {}) {
  const requestedPage = Math.max(1, Number(page) || 1);
  const requestedPerPage = Math.min(50, Math.max(1, Number(perPage) || 25));
  const [authPayload, appUsers] = await Promise.all([
    supabaseAdminAuth("admin/users", {
      query: { page: requestedPage, per_page: requestedPerPage + 1 }
    }),
    supabaseRest("app_users", {
      query: {
        select: "id,auth_user_id,email,role,active,created_at,updated_at",
        order: "created_at.asc"
      }
    })
  ]);
  const authUsers = Array.isArray(authPayload?.users) ? authPayload.users : [];
  const hasMore = authUsers.length > requestedPerPage;
  const appUsersByAuthId = new Map(appUsers.map((appUser) => [appUser.auth_user_id, appUser]));
  const users = authUsers.slice(0, requestedPerPage).map((authUser) => {
    const email = String(authUser.email || "").trim().toLowerCase();
    return safeManagedUser({
      authUser,
      appUser: appUsersByAuthId.get(authUser.id),
      protectedAdmin: adminEmails.has(email)
    });
  });
  return {
    users,
    pagination: {
      page: requestedPage,
      perPage: requestedPerPage,
      hasPrevious: requestedPage > 1,
      hasMore
    }
  };
}

async function countActiveAdmins() {
  const rows = await supabaseRest("app_users", {
    query: {
      select: "auth_user_id",
      role: "eq.admin",
      active: "eq.true"
    }
  });
  return rows.length;
}

async function signOutAuthToken(token) {
  if (!token) return;
  await supabaseAuth("logout", { method: "POST", token }).catch(() => {});
}

async function verifyCurrentPassword(user, currentPassword) {
  let verificationPayload = null;
  try {
    verificationPayload = await supabaseAuth("token?grant_type=password", {
      method: "POST",
      body: {
        email: user.email,
        password: currentPassword
      }
    });
    if (verificationPayload?.user?.id !== user.id) {
      throw new Error("Authenticated identity does not match the current user.");
    }
  } catch {
    const error = new Error("Current password is incorrect.");
    error.status = 401;
    throw error;
  } finally {
    await signOutAuthToken(verificationPayload?.access_token);
  }
}

function auditLogFromRow(row) {
  return {
    id: row.id,
    actorUserId: row.auth_user_id || "",
    clientId: row.client_id || "",
    action: row.action || "",
    targetType: row.target_type || "",
    targetId: row.target_id || "",
    status: row.status || "",
    message: safeAuditMessage(row.message),
    createdAt: row.created_at
  };
}

function canAccess(user, minimumRole) {
  return hasMinimumRole(user, minimumRole, { authRequired });
}

function canAccessClient(user, clientId) {
  return canAccessClientId(user, clientId, { authRequired });
}

function forbidden(res, message = "You do not have permission to perform this action.") {
  return json(res, 403, { error: message });
}

function unauthorized(res) {
  return json(res, 401, { error: "Please log in to continue." });
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw || "{}");
}

function highLevelEndpointKey(method, endpointPath) {
  const pathname = new URL(endpointPath, highLevelBaseUrl).pathname;
  return `${method.toUpperCase()} ${pathname}`;
}

function assertHighLevelReadOnly(method, endpointPath) {
  const key = highLevelEndpointKey(method, endpointPath);
  if (!highLevelReadAllowlist.has(key)) {
    throw new Error(`Blocked HighLevel API operation: ${key}`);
  }
}

function sanitizeApiDetail(text = "") {
  const clean = String(text).replace(/\s+/g, " ").trim();
  return clean.length > 240 ? `${clean.slice(0, 240)}...` : clean;
}

async function highLevelRequest(client, { method = "GET", endpointPath, query = {}, body, apiVersion = defaultHighLevelApiVersion }) {
  assertHighLevelReadOnly(method, endpointPath);
  const token = decryptToken(client.tokenCiphertext);
  if (!token) {
    const error = new Error("HighLevel token is missing for this client.");
    error.status = 400;
    throw error;
  }

  const url = new URL(endpointPath, highLevelBaseUrl);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  });

  const response = await fetch(url, {
    method,
    headers: {
      "authorization": `Bearer ${token}`,
      "accept": "application/json",
      "content-type": "application/json",
      "version": apiVersion
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const raw = await response.text();
  const payload = raw ? parseJsonMaybe(raw) : {};
  if (!response.ok) {
    const error = new Error("HighLevel API request failed.");
    error.status = response.status;
    error.detail = sanitizeApiDetail(typeof payload === "string" ? payload : payload.message || payload.error || raw);
    throw error;
  }
  return payload;
}

function parseJsonMaybe(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function findFirstArrayByKeys(value, keys, depth = 0) {
  if (!value || depth > 4) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== "object") return [];
  for (const key of keys) {
    if (Array.isArray(value[key])) return value[key];
  }
  for (const nested of Object.values(value)) {
    const found = findFirstArrayByKeys(nested, keys, depth + 1);
    if (found.length) return found;
  }
  return [];
}

function extractContacts(payload) {
  return findFirstArrayByKeys(payload, ["contacts", "items", "results", "data"]);
}

function findContactPaginationMeta(value, depth = 0) {
  if (!value || typeof value !== "object" || Array.isArray(value) || depth > 4) return {};
  if (
    value.startAfter !== undefined
    || value.startAfterId !== undefined
    || value.nextStartAfter !== undefined
    || value.nextStartAfterId !== undefined
    || value.start_after !== undefined
    || value.start_after_id !== undefined
    || value.next_start_after !== undefined
    || value.next_start_after_id !== undefined
  ) {
    return value;
  }
  for (const nested of Object.values(value)) {
    const found = findContactPaginationMeta(nested, depth + 1);
    if (Object.keys(found).length) return found;
  }
  return {};
}

function extractMessages(payload) {
  return findFirstArrayByKeys(payload, ["messages", "items", "results", "data"]);
}

function extractWorkflows(payload) {
  return findFirstArrayByKeys(payload, ["workflows", "items", "results", "data"]);
}

function extractOpportunities(payload) {
  return findFirstArrayByKeys(payload, ["opportunities", "items", "results", "data"]);
}

function timestampOf(record) {
  const value = record.createdAt || record.dateAdded || record.dateCreated || record.updatedAt || record.timestamp || record.messageDate || record.date;
  if (!value) return 0;
  if (typeof value === "number") return value < 100000000000 ? value * 1000 : value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isWithinDateRange(record, dateStart, dateEnd) {
  if (!dateStart || !dateEnd) return true;
  const timestamp = timestampOf(record);
  if (!timestamp) return true;
  const start = Date.parse(`${dateStart}T00:00:00.000Z`);
  const end = Date.parse(`${dateEnd}T23:59:59.999Z`);
  return timestamp >= start && timestamp <= end;
}

function valueText(record, keys) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return String(record[key]);
  }
  return "";
}

function messageText(message) {
  return valueText(message, ["body", "message", "text", "content", "subject", "snippet"]);
}

function messageContactId(message) {
  return valueText(message, ["contactId", "contact_id", "contactID"]) ||
    valueText(message.contact || {}, ["id", "contactId", "contact_id", "_id"]) ||
    valueText(message.conversation || {}, ["contactId", "contact_id", "contactID"]);
}

function messageId(message) {
  return valueText(message, ["id", "messageId", "message_id", "_id"]);
}

function contactId(contact) {
  return valueText(contact, ["id", "contactId", "contact_id", "_id"]);
}

function opportunityContactId(opportunity) {
  return valueText(opportunity, ["contactId", "contact_id", "contactID"]) ||
    valueText(opportunity.contact || {}, ["id", "contactId"]);
}

function opportunityPipelineId(opportunity) {
  return valueText(opportunity, ["pipelineId", "pipeline_id", "pipelineID"]);
}

function opportunityPipelineName(opportunity) {
  const pipeline = opportunity.pipeline || opportunity.pipelineDetails || {};
  return valueText(opportunity, ["pipelineName", "pipeline_name", "pipeline"]) ||
    valueText(pipeline, ["name", "title"]);
}

function opportunityStageId(opportunity) {
  return valueText(opportunity, ["pipelineStageId", "pipeline_stage_id", "stageId", "stage_id", "stageID"]);
}

function opportunityStageName(opportunity) {
  const stage = opportunity.stage || opportunity.pipelineStage || opportunity.pipelineStageDetails || {};
  return valueText(opportunity, ["stageName", "stage_name", "pipelineStageName", "status"]) ||
    valueText(stage, ["name", "title"]);
}

function messagePhone(message) {
  return valueText(message, ["phone", "to", "from", "contactPhone", "phoneNumber"]);
}

function messageChannel(message) {
  return valueText(message, ["channel", "messageChannel", "message_channel", "conversationProvider", "source", "medium"]);
}

function isCallMessage(message) {
  const channel = messageChannel(message).toLowerCase();
  const type = valueText(message, ["type", "messageType", "message_type"]).toLowerCase();
  return channel.includes("call") || type.includes("call");
}

function isOutboundMessage(message) {
  const direction = valueText(message, ["direction", "messageDirection", "type"]).toLowerCase();
  return direction.includes("out") || direction.includes("sent");
}

function isInboundMessage(message) {
  const direction = valueText(message, ["direction", "messageDirection", "type"]).toLowerCase();
  return direction.includes("in") || direction.includes("received");
}

function contactName(contact) {
  const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
  return contact.name || contact.fullName || fullName || contact.email || contact.phone || contact.id || "Unknown contact";
}

function contactTags(contact) {
  const tags = contact.tags || contact.contactTags || contact.tag;
  if (Array.isArray(tags)) {
    return tags.map((tag) => typeof tag === "string" ? tag : tag.name || tag.value || "").filter(Boolean);
  }
  return String(tags || "").split(",").map((tag) => tag.trim()).filter(Boolean);
}

function contactHasTag(contact, tag) {
  if (!tag) return true;
  const needle = tag.toLowerCase();
  return contactTags(contact).some((item) => item.toLowerCase() === needle || item.toLowerCase().includes(needle));
}

function filterSearchedContacts(contacts, { dateStart, dateEnd, replyTag = "", createdDateFilter = true, trustServerTagFilter = false }) {
  return contacts.filter((contact) => {
    const matchesDate = !createdDateFilter || isWithinDateRange(contact, dateStart, dateEnd);
    const matchesTag = trustServerTagFilter || contactHasTag(contact, replyTag);
    return matchesDate && matchesTag;
  });
}

function contactCursorFromPayload(payload, pageItems) {
  const meta = findContactPaginationMeta(payload);
  const lastContact = pageItems.at(-1);
  const startAfter = meta.nextStartAfter
    ?? meta.startAfter
    ?? meta.next_start_after
    ?? meta.start_after
    ?? timestampOf(lastContact || {});
  const startAfterId = meta.nextStartAfterId
    ?? meta.startAfterId
    ?? meta.next_start_after_id
    ?? meta.start_after_id
    ?? contactId(lastContact || {});
  if (!startAfter || !startAfterId) return null;
  return { startAfter, startAfterId };
}

function hasAttribution(contact) {
  const direct = ["source", "attributionSource", "utmSource", "utm_source", "firstAttribution", "lastAttribution"];
  if (direct.some((key) => Boolean(contact[key]))) return true;
  const customFields = contact.customFields || contact.customField || [];
  return Array.isArray(customFields) && customFields.some((field) => {
    const name = String(field.name || field.fieldKey || field.key || "").toLowerCase();
    return Boolean(field.value) && (name.includes("source") || name.includes("utm") || name.includes("attribution"));
  });
}

const blastClassificationLabels = new Set(["Positive", "Neutral", "Negative", "Opt-out", "Needs review"]);
const blastClassificationAliases = new Map([
  ["positive", "Positive"],
  ["interested", "Positive"],
  ["interest", "Positive"],
  ["neutral", "Neutral"],
  ["negative", "Negative"],
  ["not_interested", "Negative"],
  ["not interested", "Negative"],
  ["low_interest", "Negative"],
  ["low interest", "Negative"],
  ["opt-out", "Opt-out"],
  ["opt out", "Opt-out"],
  ["optout", "Opt-out"],
  ["opt_out", "Opt-out"],
  ["unsubscribe", "Opt-out"],
  ["needs review", "Needs review"],
  ["needs_review", "Needs review"],
  ["review needed", "Needs review"],
  ["manual review", "Needs review"]
]);

function normalizeBlastClassification(value) {
  const label = String(value || "").trim();
  if (blastClassificationLabels.has(label)) return label;
  const normalized = label
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return blastClassificationAliases.get(normalized) || null;
}

function normalizeReviewStatus(classification) {
  if (classification === "Needs review") return "Review needed";
  return "Auto-classified";
}

function normalizeServiceRelevance(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
  const relevanceMap = new Map([
    ["promoted service", "Promoted service"],
    ["same service", "Promoted service"],
    ["different service", "Different service"],
    ["other service", "Different service"],
    ["unclear", "Unclear"],
    ["unknown", "Unclear"]
  ]);
  return relevanceMap.get(normalized) || "Unclear";
}

function hasValidAiClassification(parsed) {
  if (!parsed || typeof parsed !== "object") return false;
  if (Boolean(normalizeBlastClassification(parsed.classification))) return true;
  for (const value of Object.values(parsed)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (normalizeBlastClassification(value.classification)) return true;
    }
  }
  return false;
}

function clampConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0.5;
  return Math.max(0, Math.min(1, number));
}

function truncateForAi(text, maxLength = 2000) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > maxLength ? `${clean.slice(0, maxLength)}...` : clean;
}

function messageTimestamp(message) {
  return valueText(message, ["dateAdded", "createdAt", "created_at", "timestamp", "time"]);
}

function messageDirectionLabel(message) {
  if (isInboundMessage(message)) return "inbound";
  if (isOutboundMessage(message)) return "outbound";
  return "unknown";
}

function extractResponseText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  const chunks = [];
  for (const item of payload?.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
}

function extractChatCompletionText(payload) {
  const message = payload?.choices?.[0]?.message || {};
  const content = message.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((item) => item.text || item.content || "").filter(Boolean).join("\n").trim();
  }
  return "";
}

function flattenAiClassificationObject(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  if (obj.classification) return obj;
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object" && !Array.isArray(value) && value.classification) {
      return value;
    }
  }
  return obj;
}

function extractClassificationFromReasoning(reasoning) {
  if (!reasoning || typeof reasoning !== "string") return null;
  const patterns = [
    { re: /classif(?:y|ication)[^.]*?\bpositive\b/i, value: "Positive" },
    { re: /classif(?:y|ication)[^.]*?\bnegative\b/i, value: "Negative" },
    { re: /classif(?:y|ication)[^.]*?\bopt.?out\b/i, value: "Opt-out" },
    { re: /classif(?:y|ication)[^.]*?\bneutral\b/i, value: "Neutral" },
    { re: /\bclassif(?:y|ication)\b.*?\bneeds.?review\b/i, value: "Needs review" },
    { re: /\bpositive\b.*?\bclassif/i, value: "Positive" },
    { re: /\bnegative\b.*?\bclassif/i, value: "Negative" },
  ];
  for (const { re, value } of patterns) {
    if (re.test(reasoning)) return { classification: value, confidence: 0.7, summary: "", evidence: "", reviewStatus: "Auto-classified" };
  }
  return null;
}

function extractChatCompletionJson(payload) {
  const message = payload?.choices?.[0]?.message || {};
  if (message.parsed && typeof message.parsed === "object") return flattenAiClassificationObject(message.parsed);
  if (message.refusal) return null;
  const content = message.content;
  if (content && typeof content === "object" && !Array.isArray(content)) {
    return flattenAiClassificationObject(content);
  }
  const parsed = parseJsonObject(extractChatCompletionText(payload));
  if (parsed) return flattenAiClassificationObject(parsed);
  // Reasoning models may produce null content, so fall back to extracting from reasoning text.
  const reasoning = typeof message.reasoning === "string" ? message.reasoning
    : message.reasoning_details?.find?.(d => typeof d?.text === "string")?.text || null;
  return extractClassificationFromReasoning(reasoning);
}

function parseJsonObject(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function openAiFallbackReason(error) {
  if (error?.fallbackReason) return error.fallbackReason;
  if (error?.name === "TimeoutError" || String(error?.message || "").toLowerCase().includes("timeout")) {
    return `${aiProviderLabel} request timed out.`;
  }
  if (String(error?.message || "").includes("fetch failed")) {
    return `${aiProviderLabel} request could not reach the API.`;
  }
  return `${aiProviderLabel} classification did not complete.`;
}

async function openAiErrorReason(response) {
  let detail = "";
  let errorCode = "";
  let errorType = "";
  try {
    const text = await response.text();
    const parsed = parseJsonObject(text);
    detail = parsed?.error?.message || text;
    errorCode = parsed?.error?.code || "";
    errorType = parsed?.error?.type || "";
  } catch {
    detail = "";
  }
  const safeDetail = sanitizeApiDetail(detail);
  const suffix = safeDetail ? ` ${safeDetail}` : "";
  if (response.status === 400) return `${aiProviderLabel} rejected the classification request.${suffix}`;
  if (response.status === 401) return `${aiProviderLabel} API key was rejected. Check ${aiProvider === "openrouter" ? "OPENROUTER_API_KEY" : "OPENAI_API_KEY"} in the server environment.`;
  if (response.status === 403) return `${aiProviderLabel} model or account access is not allowed.${suffix}`;
  if (response.status === 404) return `${aiProviderLabel} model was not found. Check OPENAI_MODEL in Railway.${suffix}`;
  if (response.status === 429) {
    if (errorCode === "insufficient_quota" || errorType === "insufficient_quota") {
      return `${aiProviderLabel} quota is exhausted or billing is not active for this API project.${suffix}`;
    }
    if (errorCode === "rate_limit_exceeded" || errorType === "rate_limit_exceeded" || errorType === "tokens") {
      return `${aiProviderLabel} rate limit was hit. Try again shortly or raise the project's rate limit.${suffix}`;
    }
    return `${aiProviderLabel} returned a 429 limit response.${suffix}`;
  }
  if (response.status >= 500) return `${aiProviderLabel} API returned a server error.`;
  return `${aiProviderLabel} request failed with status ${response.status}.${suffix}`;
}

function blastReplyJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "classification",
      "serviceRelevance",
      "relevanceReason",
      "summary",
      "evidence",
      "confidence",
      "reviewStatus"
    ],
    properties: {
      classification: {
        type: "string",
        enum: ["Positive", "Neutral", "Negative", "Opt-out", "Needs review"]
      },
      serviceRelevance: {
        type: "string",
        enum: ["Promoted service", "Different service", "Unclear"],
        description: "Whether the customer's expressed interest concerns the service promoted by the matched outbound blast."
      },
      relevanceReason: {
        type: "string",
        description: "One short sentence explaining the service-relevance decision."
      },
      summary: {
        type: "string",
        description: "One short sentence explaining the customer's overall post-blast intent."
      },
      evidence: {
        type: "string",
        description: "A short, non-sensitive excerpt or rationale from the reply."
      },
      confidence: {
        type: "number"
      },
      reviewStatus: {
        type: "string",
        enum: ["Auto-classified", "Review needed"]
      }
    }
  };
}

function blastReplySystemPrompt() {
  return [
    "You classify the customer's overall intent toward the specific promoted offer across a complete post-blast HighLevel conversation for an internal Lead Hero health check.",
    "Return only structured JSON. Do not recommend sending messages, updating contacts, changing opportunities, or triggering workflows.",
    "The promotedOffer field contains the actual matched outbound blast. The blastAnchorPhrase was used only to locate that outbound message and is not the full offer.",
    "Treat postBlastConversation as the primary evidence and consider the entire trajectory of inbound customer messages, not only the latest reply.",
    "Outbound messages provide context and must never be treated as customer intent.",
    "Use semantic and emotional intelligence rather than a fixed keyword list. Consider questions, hesitation, objections, follow-through, and changes in intent across the conversation.",
    "Opt-out takes precedence only when an inbound customer message explicitly asks not to be contacted, removed, unsubscribed, or contains a standalone STOP instruction. Normal phrases such as 'stop by tomorrow' are not opt-outs.",
    "Identify the service or services promoted in promotedOffer, then identify which service or services the customer is discussing.",
    "Set serviceRelevance to Promoted service when the customer is engaging with a service in the promoted offer, Different service when the customer's only expressed interest concerns another service, and Unclear when the service cannot be determined.",
    "Positive means the customer shows genuine interest in the promoted service, requests its pricing or details, asks a relevant service question, requests next steps, or indicates willingness to visit, book, or continue for that promoted service.",
    "Negative means the customer clearly declines or rejects the promoted offer or explicitly says they have no interest in it.",
    "Neutral means the customer is understandable but shows neither clear acceptance nor clear rejection of the promoted offer. Different-service-only inquiries are Neutral for this blast because they do not accept or reject the promoted offer. Also treat temporary deferrals such as not ready right now or maybe later, acknowledgements such as okay or thanks, and identity questions such as who is this as Neutral unless the wider conversation clearly supports another label.",
    "Needs review is exceptional. Use it only when there is no usable inbound customer text, the only evidence is a call record without text intent, or the conversation is genuinely irreconcilable after reading all messages.",
    "Do not use Needs review merely because a message is short, cautious, informal, or requires ordinary contextual judgment.",
    "The summary, evidence, and relevanceReason must describe the customer's overall post-blast intent without copying sensitive contact data. Evidence must cite inbound customer language, not outbound blast copy."
  ].join(" ");
}

function blastReplyRelaxedSystemPrompt() {
  return [
    blastReplySystemPrompt(),
    "Return a single JSON object with exactly these keys: classification, serviceRelevance, relevanceReason, summary, evidence, confidence, reviewStatus.",
    "Do not wrap the JSON in markdown."
  ].join(" ");
}

function blastReplyUserContent({ phrase, promotedOffer, thread = [] }) {
  const postBlastConversation = thread.map((message) => ({
    direction: message.direction,
    time: message.time,
    channel: message.channel,
    text: truncateForAi(message.text, 4000)
  }));
  return JSON.stringify({
    task: "Classify the customer's overall intent toward the promotedOffer across the complete postBlastConversation.",
    payloadFormat: "structured-json",
    blastAnchorPhrase: phrase || "",
    promotedOffer: truncateForAi(promotedOffer, 6000),
    postBlastConversation,
    contextNote: "The array begins with the matched outbound blast and includes every exported message from that blast onward in the selected date range. Analyze all inbound customer messages together; outbound messages are context only. A different-service-only inquiry is Neutral for this promoted offer because it neither accepts nor rejects the offer."
  });
}

function isOpenRouterParameterRoutingIssue(reason = "") {
  const clean = String(reason).toLowerCase();
  return clean.includes("no endpoints found") || clean.includes("requested parameters") || clean.includes("provider routing");
}

function invalidAiClassificationError() {
  const error = new Error(`${aiProviderLabel} returned an invalid classification response.`);
  error.fallbackReason = `${aiProviderLabel} returned an invalid classification response.`;
  return error;
}

async function requestAiClassification({ phrase, promotedOffer, thread = [] }) {
  const schema = blastReplyJsonSchema();
  if (aiProvider === "openrouter") {
    const headers = {
      "content-type": "application/json",
      authorization: `Bearer ${openAiApiKey}`
    };
    const referer = process.env.OPENROUTER_SITE_URL || process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";
    const appName = process.env.OPENROUTER_APP_NAME || "Lead Hero Health Check Tool";
    if (referer) headers["HTTP-Referer"] = referer;
    if (appName) {
      headers["X-Title"] = appName;
      headers["X-OpenRouter-Title"] = appName;
    }

    const strictBody = {
      model: openAiModel,
      messages: [
        { role: "system", content: blastReplySystemPrompt() },
        { role: "user", content: blastReplyUserContent({ phrase, promotedOffer, thread }) }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "blast_reply_classification",
          strict: true,
          schema
        }
      },
      provider: { require_parameters: true },
      temperature: 0,
      max_tokens: 1500
    };
    const relaxedBody = {
      model: openAiModel,
      messages: [
        { role: "system", content: blastReplyRelaxedSystemPrompt() },
        { role: "user", content: blastReplyUserContent({ phrase, promotedOffer, thread }) }
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 1500
    };
    const requestOpenRouter = async (body) => {
      const response = await fetch(`${aiBaseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(45000)
      });
      if (!response.ok) {
        const errorText = await response.text();
        const parsed = parseJsonObject(errorText);
        const detail = sanitizeApiDetail(parsed?.error?.message || errorText);
        const error = new Error(`${aiProviderLabel} classification failed with ${response.status}`);
        const suffix = detail ? ` ${detail}` : "";
        if (response.status === 400) error.fallbackReason = `${aiProviderLabel} rejected the classification request.${suffix}`;
        else if (response.status === 401) error.fallbackReason = `${aiProviderLabel} API key was rejected.`;
        else if (response.status === 404) error.fallbackReason = `${aiProviderLabel} model was not found.${suffix}`;
        else if (response.status === 429) error.fallbackReason = `${aiProviderLabel} returned a 429 limit response.${suffix}`;
        else if (response.status >= 500) error.fallbackReason = `${aiProviderLabel} API returned a server error.`;
        else error.fallbackReason = `${aiProviderLabel} request failed with status ${response.status}.${suffix}`;
        throw error;
      }
      const rawText = await response.text();
      const data = parseJsonMaybe(rawText);
      return extractChatCompletionJson(data);
    };

    try {
      const strictParsed = await requestOpenRouter(strictBody);
      if (hasValidAiClassification(strictParsed)) return strictParsed;
    } catch (error) {
      if (!isOpenRouterParameterRoutingIssue(openAiFallbackReason(error))) throw error;
    }

    const relaxedParsed = await requestOpenRouter(relaxedBody);
    if (hasValidAiClassification(relaxedParsed)) return relaxedParsed;

    const plainBody = {
      model: openAiModel,
      messages: [
        { role: "system", content: blastReplyRelaxedSystemPrompt() },
        { role: "user", content: blastReplyUserContent({ phrase, promotedOffer, thread }) }
      ],
      temperature: 0,
      max_tokens: 1500
    };
    try {
      const plainParsed = await requestOpenRouter(plainBody);
      if (hasValidAiClassification(plainParsed)) return plainParsed;
    } catch {
      // ignore plain text failure, throw the classification error below
    }
    throw invalidAiClassificationError();
  }

  const response = await fetch(`${aiBaseUrl}/responses`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${openAiApiKey}`
    },
    body: JSON.stringify({
      model: openAiModel,
      input: [
        { role: "system", content: blastReplySystemPrompt() },
        { role: "user", content: blastReplyUserContent({ phrase, promotedOffer, thread }) }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "blast_reply_classification",
          strict: true,
          schema
        }
      },
      max_output_tokens: 1500
    }),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) {
    const error = new Error(`${aiProviderLabel} classification failed with ${response.status}`);
    error.fallbackReason = await openAiErrorReason(response);
    throw error;
  }
  const data = await response.json();
  return parseJsonObject(extractResponseText(data));
}

function summaryForConversation(classification) {
  const summaries = {
    Positive: "The post-blast conversation shows customer interest or a request to continue.",
    Neutral: "The post-blast conversation neither clearly accepts nor rejects the promoted offer, or it concerns a different service.",
    Negative: "The post-blast conversation clearly declines or rejects the promoted offer.",
    "Opt-out": "The post-blast conversation contains an explicit request to stop contact.",
    "Needs review": "The post-blast conversation lacks enough usable customer text for a reliable classification."
  };
  return summaries[classification];
}

function ruleBasedBlastAnalysis(ruleResult) {
  const classification = ruleResult.classification;
  const confidence = confidenceForClassification(classification);
  return {
    classification,
    summary: summaryForConversation(classification),
    evidence: sanitizeApiDetail(ruleResult.evidenceText || ""),
    serviceRelevance: "Unclear",
    relevanceReason: "Rule fallback could not reliably determine whether the customer discussed the promoted service.",
    confidence,
    reviewStatus: classification === "Needs review" ? "Review needed" : "Auto-classified",
    analysisMethod: openAiApiKey ? "Rules fallback" : "Rules",
    analysisNote: openAiApiKey ? "" : "OpenAI API key is not configured."
  };
}

function confidenceForClassification(classification) {
  const confidenceMap = {
    Positive: 0.78,
    Neutral: 0.52,
    Negative: 0.78,
    "Opt-out": 0.82,
    "Needs review": 0.35
  };
  return confidenceMap[classification] || 0.5;
}

async function classifyBlastReplyWithAi({
  phrase,
  promotedOffer,
  thread = [],
  dndStatus = { isDnd: false, channel: "SMS", source: "none" }
}) {
  if (dndStatus.isDnd) {
    return {
      classification: "Opt-out",
      summary: "HighLevel marks this contact as Do Not Disturb for the blast channel.",
      evidence: `HighLevel reports Do Not Disturb for ${dndStatus.channel}.`,
      serviceRelevance: "Unclear",
      relevanceReason: "HighLevel DND takes precedence over offer-relevance classification.",
      confidence: 0.99,
      reviewStatus: "Auto-classified",
      analysisMethod: "HighLevel DND",
      analysisNote: ""
    };
  }

  const ruleResult = classifyConversationByRules(thread);
  const fallback = ruleBasedBlastAnalysis(ruleResult);
  if (!openAiApiKey || ruleResult.classification === "Needs review") return fallback;

  try {
    const parsed = await requestAiClassification({ phrase, promotedOffer, thread });
    const classification = normalizeBlastClassification(parsed?.classification);
    if (!classification) {
      const error = new Error(`${aiProviderLabel} returned an invalid classification response.`);
      error.fallbackReason = `${aiProviderLabel} returned an invalid classification response.`;
      throw error;
    }
    const confidence = parsed?.confidence === undefined || parsed?.confidence === null
      ? confidenceForClassification(classification)
      : clampConfidence(parsed.confidence);
    const serviceRelevance = normalizeServiceRelevance(parsed?.serviceRelevance);
    const finalClassification = applyBlastClassificationGuards({
      classification,
      serviceRelevance,
      ruleResult
    });
    const finalConfidence = finalClassification !== classification
      ? confidenceForClassification(finalClassification)
      : confidence;
    const reviewStatus = normalizeReviewStatus(finalClassification);
    const adjustedByGuard = finalClassification !== classification;

    return {
      classification: finalClassification,
      summary: adjustedByGuard
        ? summaryForConversation(finalClassification)
        : sanitizeApiDetail(parsed?.summary || summaryForClassification(finalClassification, phrase)),
      evidence: adjustedByGuard
        ? fallback.evidence
        : sanitizeApiDetail(parsed?.evidence || fallback.evidence),
      serviceRelevance,
      relevanceReason: sanitizeApiDetail(
        parsed?.relevanceReason
        || (serviceRelevance === "Different service"
          ? "The customer discussed a service other than the one promoted in the matched blast."
          : "The service relationship was not explicitly explained.")
      ),
      confidence: finalConfidence,
      reviewStatus,
      analysisMethod: adjustedByGuard ? "AI + validation" : "AI",
      analysisNote: adjustedByGuard
        ? serviceRelevance === "Different service"
          ? `Adjusted from ${classification} because the customer discussed only a different service from the promoted offer.`
          : `Adjusted from ${classification} using the complete-conversation classification policy.`
        : ""
    };
  } catch (error) {
    return {
      ...fallback,
      reviewStatus: fallback.classification === "Needs review" ? "Review needed" : "Auto-classified (rules fallback)",
      analysisNote: openAiFallbackReason(error)
    };
  }
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function latestMessageForContact(messages, contactId, { inboundOnly = false } = {}) {
  return messages
    .filter((message) => messageContactId(message) === contactId && (!inboundOnly || isInboundMessage(message)))
    .sort((a, b) => timestampOf(b) - timestampOf(a))[0];
}

function latestInboundMessage(messages) {
  return [...messages]
    .reverse()
    .find((message) => isInboundMessage(message));
}

function threadMessageForAi(message) {
  return {
    direction: messageDirectionLabel(message),
    time: messageTimestamp(message),
    channel: messageChannel(message) || valueText(message, ["type", "messageType", "message_type"]) || "",
    text: messageText(message)
  };
}

function blastThreadForContact(messages, contactIdValue, messagePhrase) {
  const contactMessages = messages
    .filter((message) => messageContactId(message) === contactIdValue)
    .sort((a, b) => timestampOf(a) - timestampOf(b));
  if (!contactMessages.length) {
    return {
      thread: [],
      latest: undefined,
      latestCandidate: undefined,
      matchedBlast: undefined,
      blastFound: false
    };
  }

  const usableMessages = contactMessages.filter((message) => {
    const text = messageText(message);
    return text || isCallMessage(message) || isInboundMessage(message) || isOutboundMessage(message);
  });
  const result = selectAnchoredBlastThread(usableMessages, {
    messagePhrase,
    textOf: messageText,
    timestampOf,
    isOutbound: isOutboundMessage,
    isInbound: isInboundMessage,
    toThreadMessage: threadMessageForAi
  });
  return {
    ...result,
    latestCandidate: latestInboundMessage(usableMessages)
  };
}

function countMissedCalls(messages) {
  return messages.filter((message) => {
    const status = valueText(message, ["status", "callStatus", "disposition", "result"]).toLowerCase();
    const text = messageText(message).toLowerCase();
    return status.includes("miss") || status.includes("no-answer") || text.includes("missed call");
  }).length;
}

async function highLevelSearchContacts(client, {
  dateStart,
  dateEnd,
  replyTag = "",
  limit = 100,
  maxPages = 1,
  createdDateFilter = true,
  onPageProgress
}) {
  const filters = [];
  if (replyTag) filters.push({ field: "tags", operator: "contains", value: replyTag });
  if (createdDateFilter && dateStart && dateEnd) {
    filters.push({
      field: "dateAdded",
      operator: "range",
      value: {
        gte: `${dateStart}T00:00:00.000Z`,
        lte: `${dateEnd}T23:59:59.999Z`
      }
    });
  }

  const offsetPageLimit = Math.min(maxPages, 100);
  const searchPages = (searchFilters) => collectPagedHighLevelItems({
    pageSize: limit,
    maxPages: offsetPageLimit,
    failOnPageLimit: maxPages > 1,
    pageLimitErrorMessage: "HighLevel offset pagination reached its 10,000-contact window.",
    itemId: contactId,
    extractItems: extractContacts,
    onPage: onPageProgress
      ? ({ page, itemCount }) => onPageProgress({ mode: "filtered", page, count: itemCount })
      : undefined,
    fetchPage: (page, pageSize) => highLevelRequest(client, {
      method: "POST",
      endpointPath: "/contacts/search",
      body: {
        locationId: client.locationId,
        page,
        pageLimit: pageSize,
        ...(searchFilters.length ? { filters: searchFilters } : {})
      }
    })
  });

  try {
    const filteredContacts = filterSearchedContacts(await searchPages(filters), {
      dateStart,
      dateEnd,
      replyTag,
      createdDateFilter,
      trustServerTagFilter: Boolean(replyTag)
    });
    if (filteredContacts.length || !replyTag) return filteredContacts;
  } catch (error) {
    // Fall through to the read-only cursor scan below. Some HighLevel tag filters
    // can fail or return no rows depending on account response shape.
  }

  const cursorContacts = await collectCursorPagedHighLevelItems({
    pageSize: limit,
    maxPages,
    failOnPageLimit: maxPages > 1,
    pageLimitErrorMessage: "HighLevel returned more contacts than the Blast Analyzer 50,000-contact safety limit. Narrow the account data before trusting this run.",
    missingCursorErrorMessage: "HighLevel did not provide a cursor for the next contact page, so the Blast Analyzer stopped instead of saving partial results.",
    itemId: contactId,
    extractItems: extractContacts,
    extractCursor: contactCursorFromPayload,
    onPage: onPageProgress
      ? ({ page, itemCount }) => onPageProgress({ mode: "cursor", page, count: itemCount })
      : undefined,
    fetchPage: (cursor, pageSize) => highLevelRequest(client, {
      method: "GET",
      endpointPath: "/contacts/",
      query: {
        locationId: client.locationId,
        limit: pageSize,
        ...(cursor || {})
      }
    })
  });

  return filterSearchedContacts(cursorContacts, {
    dateStart,
    dateEnd,
    replyTag,
    createdDateFilter,
    trustServerTagFilter: false
  });
}

async function highLevelSearchOpportunities(client, { contactIdValue = "", dateStart, dateEnd, limit = 100 }) {
  const filters = [];
  if (contactIdValue) filters.push({ field: "contactId", operator: "eq", value: contactIdValue });
  if (dateStart && dateEnd) {
    filters.push({
      field: "dateAdded",
      operator: "range",
      value: {
        gte: `${dateStart}T00:00:00.000Z`,
        lte: `${dateEnd}T23:59:59.999Z`
      }
    });
  }

  try {
    const payload = await highLevelRequest(client, {
      method: "POST",
      endpointPath: "/opportunities/search",
      apiVersion: "2023-02-21",
      body: {
        locationId: client.locationId,
        page: 1,
        pageLimit: limit,
        filters
      }
    });
    return extractOpportunities(payload).filter((opportunity) => {
      const matchesContact = !contactIdValue || opportunityContactId(opportunity) === contactIdValue;
      return matchesContact && isWithinDateRange(opportunity, dateStart, dateEnd);
    });
  } catch (error) {
    const payload = await highLevelRequest(client, {
      method: "GET",
      endpointPath: "/opportunities/search",
      query: {
        location_id: client.locationId,
        locationId: client.locationId,
        contact_id: contactIdValue,
        contactId: contactIdValue,
        limit
      }
    });
    return extractOpportunities(payload).filter((opportunity) => {
      const matchesContact = !contactIdValue || opportunityContactId(opportunity) === contactIdValue;
      return matchesContact && isWithinDateRange(opportunity, dateStart, dateEnd);
    });
  }
}

async function highLevelExportMessages(client, { dateStart, dateEnd, channel = "", onWindowProgress }) {
  const messages = [];
  const seenMessageIds = new Set();
  const maxPagesPerDay = 50;
  const pageLimit = 100;
  const retryableStatuses = new Set([401, 429, 500, 502, 503, 504]);
  const windows = dailyUtcWindows(dateStart, dateEnd);

  for (let windowIndex = 0; windowIndex < windows.length; windowIndex += 1) {
    const window = windows[windowIndex];
    let cursor = "";
    for (let page = 0; page < maxPagesPerDay; page += 1) {
      let payload;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          payload = await highLevelRequest(client, {
            method: "GET",
            endpointPath: "/conversations/messages/export",
            query: {
              locationId: client.locationId,
              startDate: window.startDate,
              endDate: window.endDate,
              channel,
              limit: pageLimit,
              pageLimit,
              cursor
            }
          });
          break;
        } catch (error) {
          if (!retryableStatuses.has(Number(error.status)) || attempt === 2) throw error;
          await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
        }
      }

      for (const message of extractMessages(payload)) {
        const id = messageId(message);
        if (id && seenMessageIds.has(id)) continue;
        if (id) seenMessageIds.add(id);
        messages.push(message);
      }

      cursor = payload.nextCursor || payload.cursor || payload.meta?.nextCursor || "";
      if (!cursor) break;
      if (page === maxPagesPerDay - 1) {
        const error = new Error("HighLevel message export exceeded the safe daily page limit.");
        error.status = 422;
        error.detail = "The selected day contains too many messages to analyze completely. Run a narrower date range.";
        throw error;
      }
    }
    if (onWindowProgress) {
      await onWindowProgress({
        done: windowIndex + 1,
        total: windows.length,
        messageCount: messages.length
      });
    }
  }
  return messages.filter((message) => isWithinDateRange(message, dateStart, dateEnd));
}

async function highLevelGetWorkflows(client) {
  const payload = await highLevelRequest(client, {
    method: "GET",
    endpointPath: "/workflows/",
    query: { locationId: client.locationId }
  });
  return extractWorkflows(payload);
}

async function testHighLevelConnection(client) {
  const contacts = await highLevelSearchContacts(client, { limit: 1 });
  return {
    ok: true,
    message: "HighLevel read-only connection succeeded.",
    checked: "contacts/search",
    sampleCount: contacts.length
  };
}

function monthLabel(startDate) {
  const date = new Date(`${startDate}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
}

function dateSpanDays(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

function deterministicNumber(seed, min, max) {
  const hash = crypto.createHash("sha1").update(seed).digest();
  const value = hash.readUInt32BE(0) / 0xffffffff;
  return Math.round(min + value * (max - min));
}

function classifyStatus(metrics) {
  if (metrics.routingWorking === "No" || metrics.automationsFiring === "No" || metrics.attributionIntact === "No" || metrics.callsTracked === "No") {
    return "Red";
  }
  if (metrics.routingWorking === "Partial" || metrics.automationsFiring === "Partial" || metrics.attributionIntact === "Partial" || metrics.missedRate > 0.3) {
    return "Yellow";
  }
  return "Green";
}

function textMatchesConfigured(value, configuredValue) {
  if (!configuredValue) return true;
  const clean = String(value || "").trim().toLowerCase();
  const configured = String(configuredValue || "").trim().toLowerCase();
  return clean === configured || clean.includes(configured) || configured.includes(clean);
}

function opportunityMatchesPipeline(opportunity, client) {
  const configuredId = String(client.activePipelineId || "").trim();
  const configuredName = String(client.activePipelineName || "").trim();
  if (!configuredId && !configuredName) return true;
  if (configuredId && opportunityPipelineId(opportunity) === configuredId) return true;
  return configuredName ? textMatchesConfigured(opportunityPipelineName(opportunity), configuredName) : false;
}

function opportunityMatchesReplyStage(opportunity, client) {
  const configuredId = String(client.replyStageId || "").trim();
  const configuredName = String(client.replyStageName || "").trim();
  if (!configuredId && !configuredName) return false;
  if (configuredId && opportunityStageId(opportunity) === configuredId) return true;
  return configuredName ? textMatchesConfigured(opportunityStageName(opportunity), configuredName) : false;
}

function firstInboundReply(messages, contactIdValue) {
  const contactMessages = messages
    .filter((message) => messageContactId(message) === contactIdValue)
    .sort((a, b) => timestampOf(a) - timestampOf(b));
  const firstOutboundAt = timestampOf(contactMessages.find(isOutboundMessage) || {});
  if (!firstOutboundAt) return undefined;
  return contactMessages.find((message) => isInboundMessage(message) && timestampOf(message) > firstOutboundAt);
}

async function loadOpportunitiesForContacts(client, contacts, { dateStart, dateEnd }) {
  const pairs = [];
  let errorCount = 0;
  const ids = contacts.map(contactId).filter(Boolean).slice(0, 100);
  for (let index = 0; index < ids.length; index += 5) {
    const batch = ids.slice(index, index + 5);
    const results = await Promise.all(batch.map(async (id) => {
      try {
        return [id, await highLevelSearchOpportunities(client, {
          contactIdValue: id,
          dateStart,
          dateEnd,
          limit: 25
        })];
      } catch (error) {
        errorCount += 1;
        return [id, []];
      }
    }));
    pairs.push(...results);
  }
  return { map: new Map(pairs), errorCount };
}

function buildAutomationFlowEvidence({ client, formLeadContacts, opportunitiesByContact, opportunitySearchErrors = 0, messages, routingWorking }) {
  const configuredPipeline = client.activePipelineId || client.activePipelineName;
  const configuredReplyStage = client.replyStageId || client.replyStageName;
  const formLeadCount = formLeadContacts.length;
  let activePipelineOpportunities = 0;
  let contactsWithReply = 0;
  let repliedContactsInStage = 0;

  formLeadContacts.forEach((contact) => {
    const id = contactId(contact);
    const opportunities = opportunitiesByContact.get(id) || [];
    const activeOpportunities = opportunities.filter((opportunity) => opportunityMatchesPipeline(opportunity, client));
    if (activeOpportunities.length) activePipelineOpportunities += 1;

    const reply = firstInboundReply(messages, id);
    if (reply) {
      contactsWithReply += 1;
      if (activeOpportunities.some((opportunity) => opportunityMatchesReplyStage(opportunity, client))) {
        repliedContactsInStage += 1;
      }
    }
  });

  const issues = [];
  let status = "Yes";
  if (!configuredPipeline) {
    status = "Partial";
    issues.push("Active pipeline name or ID is not configured for the client.");
  }
  if (opportunitySearchErrors > 0) {
    status = "Partial";
    issues.push(`Opportunity search could not be completed for ${opportunitySearchErrors} form-lead contact(s).`);
  }
  if (!configuredReplyStage && contactsWithReply > 0) {
    status = "Partial";
    issues.push("Reply stage is not configured, so first-reply movement could not be confirmed.");
  }
  if (formLeadCount === 0) {
    status = "Partial";
  } else if (opportunitySearchErrors >= formLeadCount) {
    status = "Partial";
  } else if (activePipelineOpportunities === 0) {
    status = "No";
    issues.push(`No form-lead contacts had a matching opportunity in ${configuredPipeline || "the configured active pipeline"}.`);
  } else if (activePipelineOpportunities < formLeadCount) {
    status = "Partial";
    issues.push(`${formLeadCount - activePipelineOpportunities} form-lead contact(s) did not have a matching active-pipeline opportunity.`);
  }

  if (routingWorking === "No" && formLeadCount > 0) {
    status = "No";
    issues.push("Staff notification evidence was missing for form-lead activity.");
  } else if (routingWorking === "Partial" && status === "Yes") {
    status = "Partial";
    issues.push("Staff notification evidence was only partially confirmed.");
  }

  if (contactsWithReply > 0 && configuredReplyStage) {
    if (repliedContactsInStage === 0) {
      status = status === "No" ? "No" : "Partial";
      issues.push("Contacts replied, but no matching opportunities were found in the expected reply stage.");
    } else if (repliedContactsInStage < contactsWithReply) {
      status = status === "No" ? "No" : "Partial";
      issues.push(`${contactsWithReply - repliedContactsInStage} replied contact(s) were not confirmed in the expected reply stage.`);
    }
  }

  return {
    status,
    formLeadTag: client.formLeadTag || "form lead",
    activePipeline: configuredPipeline || "Not configured",
    replyStage: configuredReplyStage || "Not configured",
    formLeadCount,
    activePipelineOpportunities,
    contactsWithReply,
    repliedContactsInStage,
    issues,
    detail: `${formLeadCount} form-lead contact(s), ${activePipelineOpportunities} active-pipeline opportunity match(es), ${contactsWithReply} first reply/replies, ${repliedContactsInStage} confirmed in reply stage.`
  };
}

function statusSymbol(status) {
  return status;
}

function buildComment({ client, dateStart, metrics, blast }) {
  const label = monthLabel(dateStart);
  const blastBlock = blast
    ? `Blasts (if applicable):\nBlast(s) Sent: Yes\nType: ${blast.messageType || "SMS"}\nSends: ${blast.estimatedSends || "Not available"}\nDelivery Rate: ${blast.deliveryRate || "Not available"}\nReplies / Engagement: ${blast.totalRepliedContacts} replies (${blast.positiveCount} positive, ${blast.neutralCount} neutral, ${blast.negativeCount} negative, ${blast.optOutCount} opt-out)`
    : "Blasts (if applicable):\nBlast(s) Sent: No\nType:\nSends:\nDelivery Rate:\nReplies / Engagement:";

  const issues = metrics.status === "Green" ? "None" : metrics.issues.join("\n");

  return `Lead Hero (Software) - ${metrics.status} - ${label} ${client.name}

System Health:
Routing Working: ${metrics.routingWorking}
Automations Firing: ${metrics.automationsFiring}
Tracking / Attribution Intact: ${metrics.attributionIntact}

Usage & Activity:
Leads Received: ${metrics.leadsReceived}
Answered vs Missed: ${metrics.callsAnswered} answered / ${metrics.callsMissed} missed

${blastBlock}

Issues:
${issues}

Next Month Focus:
${metrics.nextMonthFocus}`;
}

function generateBlastAnalysis({ client, dateStart, dateEnd, replyTag, workflowName, messagePhrase }) {
  const days = dateSpanDays(dateStart, dateEnd);
  const seed = `${client.id}:${dateStart}:${dateEnd}:${replyTag}:${workflowName}:${messagePhrase}`;
  const total = deterministicNumber(seed, Math.min(4, days), Math.min(38, Math.max(8, days + 10)));
  const positive = Math.floor(total * 0.48);
  const negative = Math.floor(total * 0.16);
  const optOut = Math.max(1, Math.floor(total * 0.08));
  const needsReview = Math.max(1, Math.floor(total * 0.12));
  const neutral = Math.max(0, total - positive - negative - optOut - needsReview);
  const names = ["Avery Johnson", "Morgan Ellis", "Sam Rivera", "Taylor Brooks", "Jordan Lee", "Casey Martin", "Riley Shah", "Jamie Carter", "Drew Parker", "Alex Kim"];
  const labels = [
    ...Array(positive).fill("Positive"),
    ...Array(neutral).fill("Neutral"),
    ...Array(negative).fill("Negative"),
    ...Array(optOut).fill("Opt-out"),
    ...Array(needsReview).fill("Needs review")
  ];
  const replies = labels.slice(0, Math.min(total, 14)).map((classification, index) => ({
    id: crypto.randomUUID(),
    contactId: `contact-${index + 1}`,
    contactName: names[index % names.length],
    lastReplyDate: dateEnd,
    classification,
    summary: summaryForClassification(classification, messagePhrase),
    evidence: evidenceForClassification(classification),
    confidence: classification === "Needs review" ? 0.38 : 0.74,
    analysisMethod: "Sample",
    analysisNote: "",
    reviewStatus: classification === "Needs review" ? "Review needed" : "Auto-classified"
  }));

  return {
    id: crypto.randomUUID(),
    clientId: client.id,
    clientName: client.name,
    dateStart,
    dateEnd,
    replyTag,
    workflowName,
    messagePhrase,
    messageType: "SMS",
    estimatedSends: "Not available",
    deliveryRate: "Not available",
    taggedContactCount: total,
    totalRepliedContacts: total,
    analyzedContactCount: total,
    positiveCount: positive,
    neutralCount: neutral,
    negativeCount: negative,
    optOutCount: optOut,
    needsReviewCount: needsReview,
    summary: `${total} contacts matched the reply tag during the selected window. ${positive} appear positive and ${needsReview} need human review.`,
    source: "sample",
    analysisMethod: "Sample",
    replies,
    createdAt: new Date().toISOString()
  };
}

async function generateLiveBlastAnalysis({ client, dateStart, dateEnd, replyTag, workflowName, messagePhrase, onProgress }) {
  if (onProgress) await onProgress(blastProgress("contacts", { count: 0 }));
  const contacts = await highLevelSearchContacts(client, {
    dateStart,
    dateEnd,
    replyTag,
    limit: 100,
    maxPages: 500,
    createdDateFilter: false,
    onPageProgress: ({ mode, count }) => onProgress?.(blastProgress("contacts", { mode, count }))
  });
  const messageWindowCount = dailyUtcWindows(dateStart, dateEnd).length;
  if (onProgress) await onProgress(blastProgress("messages", { done: 0, total: messageWindowCount }));
  const messages = await highLevelExportMessages(client, {
    dateStart,
    dateEnd,
    onWindowProgress: ({ done, total, messageCount }) => onProgress?.(blastProgress("messages", {
      done,
      total,
      count: messageCount,
      detail: `${done} of ${total} date windows exported; ${messageCount.toLocaleString()} messages loaded read-only.`
    }))
  });
  if (onProgress) await onProgress(blastProgress("matching", { count: contacts.length }));
  const contactIds = new Set(contacts.map((contact) => contactId(contact)));
  const contactContexts = contacts.map((contact) => {
      const contactIdValue = contactId(contact);
      const context = blastThreadForContact(messages, contactIdValue, messagePhrase);
      return {
        contact,
        contactId: contactIdValue,
        latest: context.latest,
        latestCandidate: context.latestCandidate,
        thread: context.thread,
        matchedBlast: context.matchedBlast,
        blastFound: context.blastFound
      };
    });
  const contactsWithMatchedBlast = contactContexts.filter((item) => item.blastFound);
  const contactsWithInboundReplies = contactContexts.filter((item) => item.blastFound && item.latest);
  const total = contactContexts.length;
  if (onProgress) await onProgress(blastProgress("classifying", { done: 0, total }));
  let progressDone = 0;
  const replies = await mapWithConcurrency(contactContexts, 5, async ({
    contact,
    contactId,
    latest,
    latestCandidate,
    thread,
    matchedBlast,
    blastFound
  }) => {
    const dndStatus = contactDndStatus(contact, matchedBlast?.channel || "SMS");
    const analysisState = blastContactAnalysisState({ blastFound, latest });
    const lastReplyDate = messageTimestamp(latest || latestCandidate) || "";
    if (!analysisState.eligible) {
      progressDone++;
      if (onProgress) await onProgress(blastProgress("classifying", { done: progressDone, total }));
      return {
        id: crypto.randomUUID(),
        contactId,
        contactName: contactName(contact),
        lastReplyDate,
        classification: "Not analyzed",
        summary: analysisState.reason,
        evidence: analysisState.status,
        threadMessageCount: thread.length,
        blastContextMatched: blastFound,
        confidence: null,
        analysisMethod: "Not analyzed",
        analysisNote: "",
        reviewStatus: analysisState.status,
        analysisStatus: analysisState.status,
        analyzed: false,
        serviceRelevance: "Unclear",
        relevanceReason: analysisState.reason,
        doNotDisturb: dndStatus.isDnd,
        dndChannel: dndStatus.isDnd ? dndStatus.channel : ""
      };
    }

    const analysis = await classifyBlastReplyWithAi({
      phrase: messagePhrase,
      promotedOffer: matchedBlast?.text || "",
      thread,
      dndStatus
    });
    progressDone++;
    if (onProgress) await onProgress(blastProgress("classifying", { done: progressDone, total }));
    return {
      id: crypto.randomUUID(),
      contactId,
      contactName: contactName(contact),
      lastReplyDate,
      classification: analysis.classification,
      summary: analysis.summary,
      evidence: analysis.evidence || `Matched HighLevel contact tag "${replyTag}" within the selected date range.`,
      threadMessageCount: thread.length,
      blastContextMatched: blastFound,
      confidence: analysis.confidence,
      analysisMethod: analysis.analysisMethod,
      analysisNote: analysis.analysisNote,
      reviewStatus: analysis.reviewStatus,
      analysisStatus: "Analyzed",
      analyzed: true,
      serviceRelevance: analysis.serviceRelevance,
      relevanceReason: analysis.relevanceReason,
      doNotDisturb: dndStatus.isDnd,
      dndChannel: dndStatus.isDnd ? dndStatus.channel : ""
    };
  });
  const noBlastMatchCount = Math.max(0, contacts.length - contactsWithMatchedBlast.length);
  const matchedBlastWithoutReplyCount = Math.max(0, contactsWithMatchedBlast.length - contactsWithInboundReplies.length);

  const phraseMatches = messages.filter((message) => {
    if (!messagePhrase) return false;
    const contactId = messageContactId(message);
    return isOutboundMessage(message)
      && !contactIds.has(contactId)
      && messageText(message).toLowerCase().includes(messagePhrase.toLowerCase());
  });
  const analyzedReplies = replies.filter((reply) => reply.analyzed);
  const counts = analyzedReplies.reduce((acc, reply) => {
    acc[reply.classification] = (acc[reply.classification] || 0) + 1;
    return acc;
  }, {});
  const aiClassifiedCount = analyzedReplies.filter((reply) => String(reply.analysisMethod || "").startsWith("AI")).length;
  const fallbackClassifiedCount = analyzedReplies.filter((reply) => String(reply.analysisMethod || "").includes("Rules")).length;
  const dndClassifiedCount = analyzedReplies.filter((reply) => reply.analysisMethod === "HighLevel DND").length;
  const analysisMethods = [
    aiClassifiedCount ? "AI" : "",
    dndClassifiedCount ? "HighLevel DND" : "",
    fallbackClassifiedCount ? (openAiApiKey ? "rules fallback" : "rules") : ""
  ].filter(Boolean);
  const analysisMethod = analysisMethods.length ? analysisMethods.join(" + ") : "No classifications";
  const methodParts = [
    aiClassifiedCount ? `${aiClassifiedCount} reply/replies were classified by AI` : "",
    dndClassifiedCount ? `${dndClassifiedCount} were classified from read-only HighLevel DND status` : "",
    fallbackClassifiedCount
      ? `${fallbackClassifiedCount} used ${openAiApiKey ? "rules fallback" : "rules because AI is not configured"}`
      : ""
  ].filter(Boolean);
  const methodSummary = methodParts.length
    ? `${methodParts.join(", ")}.`
    : "No reply conversations were classified.";
  const fallbackReasons = [...new Set(analyzedReplies.map((reply) => reply.analysisNote).filter(Boolean))];
  const fallbackReasonSummary = fallbackReasons.length ? ` Reason: ${fallbackReasons.slice(0, 2).join(" ")}` : "";
  const blastContextMatches = analyzedReplies.filter((reply) => reply.blastContextMatched).length;
  const threadSummary = `${blastContextMatches} classified reply thread(s) were anchored to the matching outbound blast and included every exported message from that blast onward inside the selected date range.`;

  return {
    id: crypto.randomUUID(),
    clientId: client.id,
    clientName: client.name,
    dateStart,
    dateEnd,
    replyTag,
    workflowName,
    messagePhrase,
    messageType: "SMS",
    estimatedSends: "Not available",
    deliveryRate: "Not available",
    taggedContactCount: contacts.length,
    totalRepliedContacts: analyzedReplies.length,
    analyzedContactCount: analyzedReplies.length,
    matchedBlastCount: contactsWithMatchedBlast.length,
    noBlastMatchCount,
    matchedBlastWithoutReplyCount,
    positiveCount: counts.Positive || 0,
    neutralCount: counts.Neutral || 0,
    negativeCount: counts.Negative || 0,
    optOutCount: counts["Opt-out"] || 0,
    needsReviewCount: counts["Needs review"] || 0,
    summary: `${contacts.length} tagged contact(s) were found and all ${contacts.length} are listed below. ${contactsWithMatchedBlast.length} had a matching outbound blast. ${contactsWithInboundReplies.length} had an inbound reply after that blast and were classified. ${matchedBlastWithoutReplyCount} matched the blast but had no later inbound reply. ${noBlastMatchCount} had no matching outbound blast and were not force-classified. ${phraseMatches.length} extra message(s) matched the required phrase without the reply tag. ${threadSummary} ${methodSummary}${fallbackReasonSummary}`,
    source: "live",
    analysisMethod,
    replies,
    createdAt: new Date().toISOString()
  };
}

async function runBlastJob(jobId, params) {
  const { user, client, ...analysisParams } = params;
  const metadata = { clientId: client.id, authUserId: user.id };
  let latestProgress = blastProgress("initializing");
  let progressWrite = Promise.resolve();
  const reportProgress = (progress) => {
    progressWrite = progressWrite.then(async () => {
      latestProgress = {
        ...progress,
        percent: Math.max(latestProgress.percent || 0, progress.percent || 0)
      };
      await writeJob(jobId, { ...metadata, status: "running", progress: latestProgress });
    });
    return progressWrite;
  };
  try {
    await reportProgress(latestProgress);
    const analysis = await generateLiveBlastAnalysis({
      ...analysisParams,
      client,
      onProgress: reportProgress
    });
    await reportProgress(blastProgress("saving", {
      done: analysis.replies.length,
      total: analysis.replies.length
    }));
    const freshStore = await readStore(user);
    freshStore.blastAnalyses.unshift(analysis);
    await persistBlastAnalysis(freshStore, analysis);
    await writeAuditLog({
      authUserId: user.id,
      clientId: client.id,
      action: "blast.generate",
      targetType: "blast_analysis",
      targetId: analysis.id,
      message: "Live blast analysis completed."
    });
    await writeJob(jobId, {
      ...metadata,
      status: "done",
      progress: blastProgress("done", {
        done: analysis.replies.length,
        total: analysis.replies.length
      }),
      analysis
    });
  } catch (error) {
    await Promise.all([
      writeAuditLog({
        authUserId: user.id,
        clientId: client.id,
        action: "blast.generate",
        targetType: "background_job",
        targetId: jobId,
        status: "failure",
        message: `Live blast analysis failed${error.status ? ` with HTTP ${error.status}` : ""}.`
      }),
      writeAuditLog({
        authUserId: user.id,
        clientId: client.id,
        action: "highlevel.read",
        targetType: "blast_analysis",
        targetId: jobId,
        status: "failure",
        message: `HighLevel read failed during blast analysis${error.status ? ` with HTTP ${error.status}` : ""}.`
      })
    ]).catch(() => {});
    await writeJob(jobId, {
      ...metadata,
      status: "error",
      error: error.detail || error.message || "Blast analysis failed.",
      progress: {
        ...latestProgress,
        phase: "error",
        phaseLabel: "Stopped",
        verb: "[Analysis stopped...]",
        detail: "The Blast Analyzer stopped before completing this run."
      }
    }).catch(() => {});
  }
}

function summaryForClassification(classification, phrase) {
  const context = phrase ? `the "${phrase}" blast` : "the blast";
  const map = {
    Positive: `Contact showed interest in ${context} or asked for more information.`,
    Neutral: `Contact replied without clear buying intent. Conversation may need light review.`,
    Negative: `Contact declined ${context} or indicated no interest.`,
    "Opt-out": `Contact asked to stop receiving similar outreach.`,
    "Needs review": `Reply is ambiguous and should be reviewed manually before counting as positive or negative.`
  };
  return map[classification];
}

function evidenceForClassification(classification) {
  const map = {
    Positive: "Post-blast customer messages show interest, request details, or ask a buying or service question.",
    Neutral: "Post-blast customer messages show neither clear interest nor clear rejection.",
    Negative: "Post-blast customer messages clearly decline or show no interest.",
    "Opt-out": "A post-blast customer message asks to stop or be removed.",
    "Needs review": "The post-blast conversation does not contain enough usable customer text for automatic classification."
  };
  return map[classification];
}

function generateMonthlyReport({ store, client, dateStart, dateEnd, blastAnalysisId }) {
  const routing = store.routingSetups.filter((item) => item.clientId === client.id && item.active);
  const blast = store.blastAnalyses.find((item) => item.id === blastAnalysisId);
  const seed = `${client.id}:${dateStart}:${dateEnd}`;
  const leadsReceived = deterministicNumber(`${seed}:leads`, 24, 196);
  const routingMessages = routing.length ? Math.max(0, leadsReceived - deterministicNumber(`${seed}:routing-gap`, 0, Math.round(leadsReceived * 0.08))) : 0;
  const callsAnswered = deterministicNumber(`${seed}:answered`, 42, 96);
  const callsMissed = deterministicNumber(`${seed}:missed`, 3, 18);
  const attributionCoverage = deterministicNumber(`${seed}:attr`, 68, 96);
  const missedRate = callsMissed / Math.max(1, callsAnswered + callsMissed);
  const routingWorking = !routing.length ? "No" : routingMessages / Math.max(1, leadsReceived) >= 0.9 ? "Yes" : "Partial";
  const automationFlow = {
    status: routingWorking === "No" ? "Partial" : "Yes",
    formLeadTag: client.formLeadTag || "form lead",
    activePipeline: client.activePipelineId || client.activePipelineName || "Sample active pipeline",
    replyStage: client.replyStageId || client.replyStageName || "Sample replied stage",
    formLeadCount: leadsReceived,
    activePipelineOpportunities: Math.max(0, leadsReceived - deterministicNumber(`${seed}:opp-gap`, 0, 4)),
    contactsWithReply: deterministicNumber(`${seed}:replies`, 2, Math.min(18, leadsReceived)),
    repliedContactsInStage: 0,
    issues: [],
    detail: ""
  };
  automationFlow.repliedContactsInStage = Math.max(0, automationFlow.contactsWithReply - deterministicNumber(`${seed}:stage-gap`, 0, 2));
  automationFlow.detail = `${automationFlow.formLeadCount} sample form-lead contact(s), ${automationFlow.activePipelineOpportunities} active-pipeline opportunity match(es), ${automationFlow.contactsWithReply} first reply/replies, ${automationFlow.repliedContactsInStage} confirmed in reply stage.`;
  const automationsFiring = automationFlow.status;
  const attributionIntact = attributionCoverage >= 80 ? "Yes" : attributionCoverage >= 60 ? "Partial" : "No";
  const callsTracked = callsAnswered + callsMissed > 0 ? "Yes" : "No";
  const issues = [];

  if (!routing.length) issues.push("Routing setup is missing staff notification contacts.");
  if (routingWorking === "Partial") issues.push("Routing notifications are lower than expected for the selected period.");
  if (attributionIntact !== "Yes") issues.push(`Attribution coverage is ${attributionCoverage}%, which needs review.`);
  if (missedRate > 0.3) issues.push("Missed call rate is above the attention threshold.");
  if (blast && blast.needsReviewCount > 0) issues.push(`${blast.needsReviewCount} blast replies need manual review.`);

  const metrics = {
    routingWorking,
    automationsFiring,
    attributionIntact,
    callsTracked,
    leadsReceived,
    routingMessages,
    callsAnswered,
    callsMissed,
    missedRate,
    attributionCoverage,
    automationFlow,
    issues,
    nextMonthFocus: issues.length ? "Review the flagged items, confirm workflow evidence, and improve follow-up coverage." : "Maintain current routing, attribution, and response tracking.",
    status: "Green"
  };
  metrics.status = classifyStatus(metrics);

  const report = {
    id: crypto.randomUUID(),
    clientId: client.id,
    clientName: client.name,
    dateStart,
    dateEnd,
    status: metrics.status,
    metrics,
    blastAnalysisId: blast?.id || "",
    generatedComment: buildComment({ client, dateStart, metrics, blast }),
    source: "sample",
    postedToClickUp: false,
    clickupCommentId: "",
    evidence: [
      {
        label: "Routing evidence",
        detail: routing.length
          ? `${routingMessages} matching workflow messages contained "New form submission" across ${routing.length} staff contact setup(s).`
          : "No active routing setup exists for this client."
      },
      {
        label: "Attribution coverage",
        detail: `${attributionCoverage}% of generated sample leads have attribution or source fields populated.`
      },
      {
        label: "Call activity",
        detail: `${callsAnswered} answered and ${callsMissed} missed calls found in the selected period.`
      },
      {
        label: "Workflow metadata",
        detail: "Workflow metadata check is read-only. Node-level inspection is intentionally not claimed."
      },
      {
        label: "Automation flow",
        detail: automationFlow.detail
      }
    ],
    createdAt: new Date().toISOString()
  };
  return report;
}

async function generateLiveMonthlyReport({ store, client, dateStart, dateEnd, blastAnalysisId }) {
  const routing = store.routingSetups.filter((item) => item.clientId === client.id && item.active);
  const blast = store.blastAnalyses.find((item) => item.id === blastAnalysisId);
  const issues = [];
  const partials = [];
  const formLeadTag = client.formLeadTag || "form lead";
  const contacts = await highLevelSearchContacts(client, { dateStart, dateEnd, replyTag: formLeadTag, limit: 100 });
  const allMessages = await highLevelExportMessages(client, { dateStart, dateEnd });
  const callMessages = await highLevelExportMessages(client, { dateStart, dateEnd, channel: "Call" });
  const opportunityResults = await loadOpportunitiesForContacts(client, contacts, { dateStart, dateEnd });

  let workflows = [];
  try {
    workflows = await highLevelGetWorkflows(client);
  } catch (error) {
    partials.push(`Workflow metadata could not be loaded: ${error.detail || error.message}`);
  }

  const expectedPhrase = routing[0]?.expectedPhrase || "New form submission";
  const routingMatches = routing.map((setup) => {
    const staffId = String(setup.staffContactId || "");
    const staffPhone = String(setup.staffPhone || "").replace(/\D/g, "");
    const matches = allMessages.filter((message) => {
      const contactMatch = staffId && messageContactId(message) === staffId;
      const phone = messagePhone(message).replace(/\D/g, "");
      const phoneMatch = staffPhone && phone.includes(staffPhone.slice(-10));
      return (contactMatch || phoneMatch) &&
        isOutboundMessage(message) &&
        messageText(message).toLowerCase().includes(String(setup.expectedPhrase || expectedPhrase).toLowerCase());
    });
    return { setup, count: matches.length };
  });
  const routingMessages = routingMatches.reduce((sum, item) => sum + item.count, 0);
  const workflowMessages = allMessages.filter((message) => String(message.source || "").toLowerCase() === "workflow").length;
  const leadsReceived = contacts.length;
  const callsMissed = countMissedCalls(callMessages);
  const callsAnswered = Math.max(0, callMessages.length - callsMissed);
  const attributionCount = contacts.filter(hasAttribution).length;
  const attributionCoverage = leadsReceived ? Math.round((attributionCount / leadsReceived) * 100) : 0;
  const missedRate = callsMissed / Math.max(1, callsAnswered + callsMissed);
  const routingWorking = !routing.length
    ? "No"
    : routingMessages > 0
      ? "Yes"
      : workflowMessages > 0
        ? "Partial"
        : leadsReceived === 0
          ? "Partial"
          : "No";
  const activeWorkflows = workflows.filter((workflow) => {
    const status = String(workflow.status || "").toLowerCase();
    return status.includes("publish") || status.includes("active");
  }).length;
  const automationFlow = buildAutomationFlowEvidence({
    client,
    formLeadContacts: contacts,
    opportunitiesByContact: opportunityResults.map,
    opportunitySearchErrors: opportunityResults.errorCount,
    messages: allMessages,
    routingWorking
  });
  const automationsFiring = automationFlow.status;
  const attributionIntact = leadsReceived === 0 ? "Partial" : attributionCoverage >= 80 ? "Yes" : attributionCoverage >= 60 ? "Partial" : "No";
  const callsTracked = callMessages.length > 0 ? "Yes" : "No";

  if (!routing.length) issues.push("Routing setup is missing staff notification contacts.");
  if (routingWorking === "No") issues.push(`No outbound staff notification messages containing "${expectedPhrase}" were found.`);
  if (routingWorking === "Partial") issues.push(`Workflow messages were found or there were no leads, but no exact staff notification match for "${expectedPhrase}" was confirmed.`);
  issues.push(...automationFlow.issues);
  if (attributionIntact !== "Yes") issues.push(leadsReceived ? `Attribution coverage is ${attributionCoverage}%, which needs review.` : "No leads were found in the selected period, so attribution could not be confirmed.");
  if (callsTracked === "No") issues.push("No call records were found with channel=Call in the selected period.");
  if (missedRate > 0.3) issues.push("Missed call rate is above the attention threshold.");
  if (blast && blast.needsReviewCount > 0) issues.push(`${blast.needsReviewCount} blast replies need manual review.`);

  const metrics = {
    routingWorking,
    automationsFiring,
    attributionIntact,
    callsTracked,
    leadsReceived,
    routingMessages,
    callsAnswered,
    callsMissed,
    missedRate,
    attributionCoverage,
    automationFlow,
    issues,
    nextMonthFocus: issues.length ? "Review the flagged items, confirm workflow evidence, and improve follow-up coverage." : "Maintain current routing, attribution, and response tracking.",
    status: "Green"
  };
  metrics.status = classifyStatus(metrics);

  return {
    id: crypto.randomUUID(),
    clientId: client.id,
    clientName: client.name,
    dateStart,
    dateEnd,
    status: metrics.status,
    metrics,
    blastAnalysisId: blast?.id || "",
    generatedComment: buildComment({ client, dateStart, metrics, blast }),
    source: "live",
    postedToClickUp: false,
    clickupCommentId: "",
    evidence: [
      {
        label: "Routing evidence",
        detail: routing.length
          ? `${routingMessages} outbound staff notification message(s) contained "${expectedPhrase}" across ${routing.length} staff contact setup(s).`
          : "No active routing setup exists for this client."
      },
      {
        label: "Lead contacts",
        detail: `${leadsReceived} contact record(s) matched tag "${formLeadTag}" in the selected date range through read-only contact search.`
      },
      {
        label: "Attribution coverage",
        detail: `${attributionCoverage}% of matching contacts had source, UTM, attribution, or matching custom-field evidence.`
      },
      {
        label: "Call activity",
        detail: `${callsAnswered} answered and ${callsMissed} missed call message(s) found with channel=Call.`
      },
      {
        label: "Workflow metadata",
        detail: partials.length
          ? partials.join(" ")
          : `${workflows.length} workflow metadata record(s) were loaded read-only; node-level inspection is intentionally not claimed.`
      },
      {
        label: "Automation flow",
        detail: `${automationFlow.detail} Active workflow metadata records loaded: ${activeWorkflows}.`
      }
    ],
    createdAt: new Date().toISOString()
  };
}

async function handleApi(req, res, pathname) {
  if (req.method === "POST" && pathname === "/api/auth/login") {
    if (!authRequired) {
      return json(res, 200, { user: { email: "local-dev", role: "admin" } });
    }
    const body = await parseBody(req);
    if (!body.email || !body.password) {
      return json(res, 400, { error: "Email and password are required." });
    }
    try {
      const payload = await supabaseAuth("token?grant_type=password", {
        method: "POST",
        body: { email: body.email, password: body.password }
      });
      const user = await loadAppUser(payload.user);
      if (!user) {
        await recordAudit({
          authUserId: payload.user?.id || null,
          action: "auth.login",
          targetType: "app_user",
          targetId: payload.user?.id || "",
          status: "failure",
          message: "Authenticated identity is not provisioned or active."
        });
        return forbidden(res, "This user is not approved for the Lead Hero Health Check Tool.");
      }
      await recordAudit({
        authUserId: user.id,
        action: "auth.login",
        targetType: "app_user",
        targetId: user.id,
        message: "Application login succeeded."
      });
      setCookie(res, "lh_session", payload.access_token, { maxAge: payload.expires_in || 3600 });
      return json(res, 200, { user });
    } catch (error) {
      await recordAudit({
        action: "auth.login",
        targetType: "app_user",
        status: "failure",
        message: `Application login failed${error.status ? ` with HTTP ${error.status}` : ""}.`
      });
      return json(res, error.status || 401, {
        error: "Login failed. Please check your account access.",
        detail: error.detail || ""
      });
    }
  }

  if (req.method === "POST" && pathname === "/api/auth/logout") {
    clearCookie(res, "lh_session");
    return json(res, 200, { ok: true });
  }

  if (req.method === "GET" && pathname === "/api/auth/me") {
    const user = await getCurrentUser(req);
    return json(res, 200, { authRequired, user });
  }

  const user = await getCurrentUser(req);

  if (authRequired && pathname !== "/api/bootstrap" && !user) {
    return unauthorized(res);
  }

  if (req.method === "POST" && pathname === "/api/auth/password-change") {
    if (!supabaseConfigured) return json(res, 503, { error: "Supabase Auth administration is not configured." });
    const body = await parseBody(req);
    const validationError = selfPasswordChangeValidationError({
      currentPassword: body.currentPassword,
      password: body.password,
      confirmation: body.passwordConfirmation
    });
    if (validationError) {
      await recordAudit({
        authUserId: user.id,
        action: "auth.password_change",
        targetType: "app_user",
        targetId: user.id,
        status: "failure",
        message: "Self-service password change failed input validation."
      });
      return json(res, 400, { error: validationError });
    }

    try {
      await verifyCurrentPassword(user, body.currentPassword);
      await supabaseAdminAuth(`admin/users/${encodeURIComponent(user.id)}`, {
        method: "PUT",
        body: { password: body.password }
      });
      await recordAudit({
        authUserId: user.id,
        action: "auth.password_change",
        targetType: "app_user",
        targetId: user.id,
        message: "Self-service password change completed."
      });
      await signOutAuthToken(parseCookies(req).lh_session);
      clearCookie(res, "lh_session");
      return json(res, 200, { message: "Password updated. Sign in again." });
    } catch (error) {
      await recordAudit({
        authUserId: user.id,
        action: "auth.password_change",
        targetType: "app_user",
        targetId: user.id,
        status: "failure",
        message: `Self-service password change failed${error.status ? ` with HTTP ${error.status}` : ""}.`
      });
      return json(res, error.status === 401 ? 401 : error.status === 422 ? 400 : 502, {
        error: error.status === 401 ? "Current password is incorrect." : "The password could not be updated."
      });
    }
  }

  if (req.method === "GET" && pathname === "/api/bootstrap") {
    if (authRequired && !user) {
      return json(res, 200, {
        clients: [],
        routingSetups: [],
        blastAnalyses: [],
        reports: [],
        settings: {
          highLevelApiVersion: defaultHighLevelApiVersion,
          clickupConnected: Boolean(process.env.CLICKUP_API_TOKEN),
          aiConnected: Boolean(openAiApiKey),
          aiProvider,
          openAiModel,
          openAiModelWarning,
          safeMode: true,
          storage: supabaseConfigured ? "Supabase" : "Local",
          authRequired
        },
        auth: { required: true, user: null }
      });
    }
    const store = await readStore(user);
    return json(res, 200, {
      ...store,
      clients: store.clients.map(publicClient),
      settings: {
        ...store.settings,
        clickupConnected: Boolean(process.env.CLICKUP_API_TOKEN),
        aiConnected: Boolean(openAiApiKey),
        aiProvider,
        openAiModel,
        openAiModelWarning,
        storage: supabaseConfigured ? "Supabase" : "Local",
        authRequired
      },
      auth: { required: authRequired, user }
    });
  }

  if (req.method === "GET" && pathname === "/api/settings/users") {
    if (!canAccess(user, "admin")) return forbidden(res, "Only Admin users can view the user directory.");
    if (!supabaseConfigured) {
      return json(res, 200, {
        users: [{
          id: user.id,
          email: user.email,
          role: "admin",
          active: true,
          provisioned: true,
          status: "Active",
          protectedAdmin: true,
          createdAt: "",
          lastSignInAt: ""
        }],
        pagination: { page: 1, perPage: 25, hasPrevious: false, hasMore: false }
      });
    }
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);
    try {
      const result = await listManagedUsers({
        page: requestUrl.searchParams.get("page"),
        perPage: requestUrl.searchParams.get("perPage")
      });
      return json(res, 200, result);
    } catch (error) {
      return json(res, error.status || 502, {
        error: "User directory could not be loaded.",
        detail: error.detail || ""
      });
    }
  }

  if (req.method === "POST" && pathname === "/api/settings/users/invite") {
    if (!canAccess(user, "admin")) return forbidden(res, "Only Admin users can create users.");
    if (!supabaseConfigured) return json(res, 503, { error: "Supabase Auth administration is not configured." });
    const body = await parseBody(req);
    const email = validEmail(body.email);
    const requestedRole = String(body.role || "user").toLowerCase();
    const inputError = manualUserCreationValidationError({
      email,
      role: requestedRole,
      password: body.password,
      confirmation: body.passwordConfirmation,
      adminPassword: body.adminPassword
    });
    if (inputError) {
      await recordAudit({
        authUserId: user.id,
        action: "user.create",
        targetType: "app_user",
        status: "failure",
        message: "Application user creation failed input validation."
      });
      return json(res, 400, { error: inputError });
    }

    let createdAuthUserId = "";
    try {
      await verifyCurrentPassword(user, body.adminPassword);
      const existing = await findAuthUserByEmail(email);
      const duplicateError = manualUserCreationValidationError({
        email,
        role: requestedRole,
        password: body.password,
        confirmation: body.passwordConfirmation,
        adminPassword: body.adminPassword,
        existingUser: existing
      });
      if (duplicateError) {
        await recordAudit({
          authUserId: user.id,
          action: "user.create",
          targetType: "app_user",
          targetId: existing.id,
          status: "failure",
          message: "Application user creation was rejected because the Auth account already exists."
        });
        return json(res, 409, { error: duplicateError });
      }
      const payload = await supabaseAdminAuth("admin/users", {
        method: "POST",
        body: {
          email,
          password: body.password,
          email_confirm: true
        }
      });
      const createdUser = payload?.user || payload;
      if (!createdUser?.id) throw new Error("Supabase Auth did not return a created user.");
      createdAuthUserId = createdUser.id;
      const role = adminEmails.has(email) ? "admin" : requestedRole;
      await supabaseRest("app_users", {
        method: "POST",
        query: { on_conflict: "auth_user_id" },
        body: {
          auth_user_id: createdUser.id,
          email,
          role,
          active: true,
          updated_at: new Date().toISOString()
        },
        prefer: "resolution=merge-duplicates"
      });
      await recordAudit({
        authUserId: user.id,
        action: "user.create",
        targetType: "app_user",
        targetId: createdUser.id,
        message: "Application user created."
      });
      return json(res, 201, {
        user: safeManagedUser({
          authUser: createdUser,
          appUser: { auth_user_id: createdUser.id, email, role, active: true },
          protectedAdmin: adminEmails.has(email)
        })
      });
    } catch (error) {
      if (createdAuthUserId) {
        await supabaseAdminAuth(`admin/users/${encodeURIComponent(createdAuthUserId)}`, {
          method: "DELETE"
        }).catch(() => {});
      }
      const pendingRoleMigration = isPendingAdminUserRoleMigration(error);
      await recordAudit({
        authUserId: user.id,
        action: "user.create",
        targetType: "app_user",
        status: "failure",
        message: pendingRoleMigration
          ? "Application user creation failed because the Admin/User database migration is pending."
          : `Application user creation failed${error.status ? ` with HTTP ${error.status}` : ""}.`
      });
      return json(res, pendingRoleMigration ? 503 : error.status === 401 ? 401 : error.status === 422 ? 400 : error.status || 502, {
        error: pendingRoleMigration
          ? "User creation is unavailable until the Admin/User database migration is applied."
          : error.status === 401
          ? "Current Admin password is incorrect."
          : "The user could not be created."
      });
    }
  }

  const managedUserMatch = pathname.match(/^\/api\/settings\/users\/([0-9a-f-]+)$/i);
  if (req.method === "PATCH" && managedUserMatch) {
    if (!canAccess(user, "admin")) return forbidden(res, "Only Admin users can change users.");
    if (!supabaseConfigured) return json(res, 503, { error: "Supabase Auth administration is not configured." });
    const targetUserId = managedUserMatch[1];
    const body = await parseBody(req);
    const roleProvided = Object.prototype.hasOwnProperty.call(body, "role");
    const activeProvided = Object.prototype.hasOwnProperty.call(body, "active");
    if (!roleProvided && !activeProvided) {
      await recordAudit({
        authUserId: user.id,
        action: "user.update",
        targetType: "app_user",
        targetId: targetUserId,
        status: "failure",
        message: "Application user update failed because no supported change was provided."
      });
      return json(res, 400, { error: "Role or active status is required." });
    }
    if (roleProvided && !isSupportedAppRole(body.role)) {
      await recordAudit({
        authUserId: user.id,
        action: "user.update",
        targetType: "app_user",
        targetId: targetUserId,
        status: "failure",
        message: "Application user update failed role validation."
      });
      return json(res, 400, { error: "Role must be Admin or User." });
    }

    try {
      const [authUser, appUser, activeAdminCount] = await Promise.all([
        getAuthUserById(targetUserId),
        getAppUserByAuthId(targetUserId),
        countActiveAdmins()
      ]);
      if (!authUser?.id) {
        await recordAudit({
          authUserId: user.id,
          action: "user.update",
          targetType: "app_user",
          targetId: targetUserId,
          status: "failure",
          message: "Application user update failed because the user was not found."
        });
        return json(res, 404, { error: "User not found." });
      }
      const email = String(authUser.email || appUser?.email || "").trim().toLowerCase();
      const target = safeManagedUser({
        authUser,
        appUser,
        protectedAdmin: adminEmails.has(email)
      });
      const nextRole = roleProvided ? String(body.role).toLowerCase() : target.role;
      const nextActive = activeProvided ? body.active === true : target.active;
      const mutationError = validateManagedUserMutation({
        actor: user,
        target,
        nextRole,
        nextActive,
        activeAdminCount
      });
      if (mutationError) {
        await recordAudit({
          authUserId: user.id,
          action: "user.update",
          targetType: "app_user",
          targetId: targetUserId,
          status: "failure",
          message: "Application user update was blocked by an authorization guard."
        });
        return json(res, 409, { error: mutationError });
      }

      await supabaseRest("app_users", {
        method: "POST",
        query: { on_conflict: "auth_user_id" },
        body: {
          auth_user_id: authUser.id,
          email,
          role: nextRole,
          active: nextActive,
          updated_at: new Date().toISOString()
        },
        prefer: "resolution=merge-duplicates"
      });
      await recordAudit({
        authUserId: user.id,
        action: "user.update",
        targetType: "app_user",
        targetId: authUser.id,
        message: "Application user role or active status updated."
      });
      return json(res, 200, { ok: true });
    } catch (error) {
      await recordAudit({
        authUserId: user.id,
        action: "user.update",
        targetType: "app_user",
        targetId: targetUserId,
        status: "failure",
        message: `Application user update failed${error.status ? ` with HTTP ${error.status}` : ""}.`
      });
      return json(res, error.status || 502, {
        error: "The user could not be updated.",
        detail: error.detail || ""
      });
    }
  }

  const managedResetMatch = pathname.match(/^\/api\/settings\/users\/([0-9a-f-]+)\/password-reset$/i);
  if (req.method === "POST" && managedResetMatch) {
    if (!canAccess(user, "admin")) return forbidden(res, "Only Admin users can reset another user's password.");
    if (!supabaseConfigured) return json(res, 503, { error: "Supabase Auth administration is not configured." });
    const targetUserId = managedResetMatch[1];
    if (targetUserId === user.id) {
      await recordAudit({
        authUserId: user.id,
        action: "auth.password_reset",
        targetType: "app_user",
        targetId: targetUserId,
        status: "failure",
        message: "Admin-managed password reset was blocked for the signed-in account."
      });
      return json(res, 409, { error: "Use Change password to update your own account." });
    }
    const body = await parseBody(req);
    try {
      const appUser = await getAppUserByAuthId(targetUserId);
      const accountError = managedPasswordResetValidationError({
        appUser,
        adminPassword: body.adminPassword,
        password: body.password,
        confirmation: body.passwordConfirmation
      });
      if (accountError) {
        await recordAudit({
          authUserId: user.id,
          action: "auth.password_reset",
          targetType: "app_user",
          targetId: targetUserId,
          status: "failure",
          message: "Admin-managed password reset failed input or account validation."
        });
        return json(res, !appUser ? 404 : appUser.active === false ? 409 : 400, { error: accountError });
      }
      await verifyCurrentPassword(user, body.adminPassword);
      await supabaseAdminAuth(`admin/users/${encodeURIComponent(targetUserId)}`, {
        method: "PUT",
        body: { password: body.password }
      });
      await recordAudit({
        authUserId: user.id,
        action: "auth.password_reset",
        targetType: "app_user",
        targetId: targetUserId,
        message: "Admin-managed password reset completed."
      });
      return json(res, 200, { message: "Password updated." });
    } catch (error) {
      await recordAudit({
        authUserId: user.id,
        action: "auth.password_reset",
        targetType: "app_user",
        targetId: targetUserId,
        status: "failure",
        message: `Admin-managed password reset failed${error.status ? ` with HTTP ${error.status}` : ""}.`
      });
      return json(res, error.status === 401 ? 401 : error.status === 422 ? 400 : error.status || 502, {
        error: error.status === 401
          ? "Current Admin password is incorrect."
          : "The password could not be updated."
      });
    }
  }

  if (req.method === "GET" && pathname === "/api/settings/audit-logs") {
    if (!canAccess(user, "admin")) return forbidden(res, "Only Admin users can view security audit events.");
    if (!supabaseConfigured) {
      return json(res, 200, {
        events: [],
        pagination: { page: 1, perPage: 25, hasPrevious: false, hasMore: false }
      });
    }
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);
    const page = Math.max(1, Number(requestUrl.searchParams.get("page")) || 1);
    const perPage = Math.min(50, Math.max(1, Number(requestUrl.searchParams.get("perPage")) || 25));
    try {
      const rows = await supabaseRest("api_audit_logs", {
        query: {
          select: "id,auth_user_id,client_id,action,target_type,target_id,status,message,created_at",
          action: `in.(${securityAuditActions.join(",")})`,
          order: "created_at.desc",
          limit: perPage + 1,
          offset: (page - 1) * perPage
        }
      });
      return json(res, 200, {
        events: rows.slice(0, perPage).map(auditLogFromRow),
        pagination: {
          page,
          perPage,
          hasPrevious: page > 1,
          hasMore: rows.length > perPage
        }
      });
    } catch (error) {
      return json(res, error.status || 502, {
        error: "Security audit events could not be loaded.",
        detail: error.detail || ""
      });
    }
  }

  const store = await readStore(user);

  if (req.method === "POST" && pathname === "/api/clients") {
    if (!canAccess(user, "user")) return forbidden(res, "Only active Admin and User accounts can add or update clients.");
    const body = await parseBody(req);
    const now = new Date().toISOString();
    const existing = body.id ? store.clients.find((item) => item.id === body.id) : null;
    if (!body.name || !body.locationId) {
      return json(res, 400, { error: "Client name and HighLevel location ID are required." });
    }
    if (!existing && !body.pitToken) {
      return json(res, 400, { error: "A read-only HighLevel Private Integration Token is required when adding a client." });
    }
    const client = {
      id: body.id || crypto.randomUUID(),
      name: body.name.trim(),
      locationId: body.locationId.trim(),
      clickupTaskId: body.clickupTaskId?.trim() || "",
      timezone: body.timezone || "America/New_York",
      formLeadTag: body.formLeadTag?.trim() || existing?.formLeadTag || "form lead",
      activePipelineName: body.activePipelineName?.trim() || existing?.activePipelineName || "",
      activePipelineId: body.activePipelineId?.trim() || existing?.activePipelineId || "",
      replyStageName: body.replyStageName?.trim() || existing?.replyStageName || "",
      replyStageId: body.replyStageId?.trim() || existing?.replyStageId || "",
      replyStageWindowHours: Number(body.replyStageWindowHours || existing?.replyStageWindowHours || 24),
      tokenPreview: body.pitToken ? tokenPreview(body.pitToken) : existing?.tokenPreview || "",
      tokenCiphertext: body.pitToken ? encryptToken(body.pitToken) : existing?.tokenCiphertext || "",
      createdAt: existing?.createdAt || body.createdAt || now,
      updatedAt: now
    };
    const index = store.clients.findIndex((item) => item.id === client.id);
    if (index >= 0) store.clients[index] = { ...store.clients[index], ...client };
    else store.clients.push(client);
    await persistClient(store, client);
    await recordAudit({
      authUserId: user.id,
      clientId: client.id,
      action: existing ? "client.update" : "client.create",
      targetType: "client",
      targetId: client.id,
      message: existing ? "Client configuration updated." : "Client created."
    });
    if (body.pitToken) {
      await recordAudit({
        authUserId: user.id,
        clientId: client.id,
        action: existing?.tokenCiphertext ? "client.token_replace" : "client.token_add",
        targetType: "client",
        targetId: client.id,
        message: existing?.tokenCiphertext ? "Encrypted HighLevel token replaced." : "Encrypted HighLevel token added."
      });
    }
    return json(res, 200, { client: publicClient(client), clients: store.clients.map(publicClient) });
  }

  if (req.method === "POST" && pathname === "/api/clients/disconnect") {
    if (!canAccess(user, "user")) return forbidden(res, "Only active Admin and User accounts can disconnect client HighLevel accounts.");
    const body = await parseBody(req);
    const client = store.clients.find((item) => item.id === body.clientId);
    if (!client) return json(res, 404, { error: "Client not found." });

    client.tokenPreview = "";
    client.tokenCiphertext = "";
    client.updatedAt = new Date().toISOString();
    await persistClient(store, client);
    await recordAudit({
      authUserId: user.id,
      clientId: client.id,
      action: "client.token_remove",
      targetType: "client",
      targetId: client.id,
      message: "Encrypted HighLevel token removed."
    });
    return json(res, 200, {
      message: "Client HighLevel connection disconnected from this tool.",
      client: publicClient(client),
      clients: store.clients.map(publicClient)
    });
  }

  if (req.method === "POST" && pathname === "/api/highlevel/test") {
    if (!canAccess(user, "user")) return forbidden(res, "Only active Admin and User accounts can test client HighLevel connections.");
    const body = await parseBody(req);
    const client = store.clients.find((item) => item.id === body.clientId);
    if (!client) return json(res, 404, { error: "Client not found." });
    try {
      const result = await testHighLevelConnection(client);
      return json(res, 200, result);
    } catch (error) {
      await recordAudit({
        authUserId: user.id,
        clientId: client.id,
        action: "highlevel.read",
        targetType: "connection_test",
        targetId: client.id,
        status: "failure",
        message: `HighLevel read-only connection test failed${error.status ? ` with HTTP ${error.status}` : ""}.`
      });
      return json(res, error.status || 502, {
        ok: false,
        error: "HighLevel connection failed. Please check the Private Integration Token and location ID.",
        detail: error.detail || "The read-only connection test could not complete."
      });
    }
  }

  if (req.method === "POST" && pathname === "/api/routing") {
    if (!canAccess(user, "user")) return forbidden(res, "Only active Admin and User accounts can update routing setup.");
    const body = await parseBody(req);
    if (!body.clientId || !body.staffPhone) {
      return json(res, 400, { error: "Client and staff phone are required." });
    }
    const now = new Date().toISOString();
    const setup = {
      id: body.id || crypto.randomUUID(),
      clientId: body.clientId,
      staffContactId: body.staffContactId || "",
      staffPhone: body.staffPhone,
      expectedPhrase: body.expectedPhrase || "New form submission",
      expectedDelayMinutes: Number(body.expectedDelayMinutes || 10),
      active: body.active !== false,
      createdAt: body.createdAt || now,
      updatedAt: now
    };
    const index = store.routingSetups.findIndex((item) => item.id === setup.id);
    if (index >= 0) store.routingSetups[index] = setup;
    else store.routingSetups.push(setup);
    await persistRoutingSetup(store, setup);
    await recordAudit({
      authUserId: user.id,
      clientId: setup.clientId,
      action: "routing.update",
      targetType: "routing_setup",
      targetId: setup.id,
      message: "Routing setup updated."
    });
    return json(res, 200, { routingSetups: store.routingSetups });
  }

  if (req.method === "POST" && pathname === "/api/blasts/run") {
    if (!canAccess(user, "user")) return forbidden(res, "Only active Admin and User accounts can run Blast Analyzer.");
    const body = await parseBody(req);
    if (!canAccessClient(user, body.clientId)) return forbidden(res, "You do not have access to this client.");
    const client = store.clients.find((item) => item.id === body.clientId);
    if (!client) return json(res, 404, { error: "Client not found." });
    const messagePhrase = String(body.messagePhrase || "").trim();
    if (!body.dateStart || !body.dateEnd || !body.replyTag || !messagePhrase) {
      return json(res, 400, { error: "Client, date range, reply tag, and blast message phrase are required." });
    }
    if (client.tokenCiphertext) {
      const jobId = crypto.randomUUID();
      runBlastJob(jobId, {
        user,
        client,
        dateStart: body.dateStart,
        dateEnd: body.dateEnd,
        replyTag: body.replyTag,
        workflowName: body.workflowName || "",
        messagePhrase
      });
      return json(res, 202, { jobId });
    }
    const analysis = generateBlastAnalysis({
      client,
      dateStart: body.dateStart,
      dateEnd: body.dateEnd,
      replyTag: body.replyTag,
      workflowName: body.workflowName || "",
      messagePhrase
    });
    store.blastAnalyses.unshift(analysis);
    await persistBlastAnalysis(store, analysis);
    await recordAudit({
      authUserId: user.id,
      clientId: client.id,
      action: "blast.generate",
      targetType: "blast_analysis",
      targetId: analysis.id,
      message: "Sample blast analysis completed."
    });
    return json(res, 200, { analysis, blastAnalyses: store.blastAnalyses });
  }

  if (req.method === "GET" && pathname.startsWith("/api/blasts/job/")) {
    if (!canAccess(user, "user")) return forbidden(res, "Only active Admin and User accounts can view Blast Analyzer jobs.");
    const jobId = pathname.slice("/api/blasts/job/".length);
    if (!jobId) return json(res, 400, { error: "Job ID is required." });
    const job = await readJob(jobId);
    if (!job) return json(res, 404, { error: "Job not found." });
    if (!canAccessJob(user, job, { authRequired })) return forbidden(res, "You do not have access to this job.");
    const { authUserId, ...publicJob } = job;
    return json(res, 200, publicJob);
  }

  if (req.method === "POST" && pathname === "/api/monthly/run") {
    if (!canAccess(user, "user")) return forbidden(res, "Only active Admin and User accounts can run monthly checks.");
    const body = await parseBody(req);
    if (!canAccessClient(user, body.clientId)) return forbidden(res, "You do not have access to this client.");
    const client = store.clients.find((item) => item.id === body.clientId);
    if (!client) return json(res, 404, { error: "Client not found." });
    if (!body.dateStart || !body.dateEnd) {
      return json(res, 400, { error: "Client and date range are required." });
    }
    if (body.blastAnalysisId) {
      const blast = store.blastAnalyses.find((item) => item.id === body.blastAnalysisId);
      if (!blast || blast.clientId !== client.id) {
        return forbidden(res, "The selected blast analysis does not belong to this client.");
      }
    }
    let report;
    try {
      report = client.tokenCiphertext
        ? await generateLiveMonthlyReport({
          store,
          client,
          dateStart: body.dateStart,
          dateEnd: body.dateEnd,
          blastAnalysisId: body.blastAnalysisId || ""
        })
        : generateMonthlyReport({
          store,
          client,
          dateStart: body.dateStart,
          dateEnd: body.dateEnd,
          blastAnalysisId: body.blastAnalysisId || ""
        });
    } catch (error) {
      await Promise.all([
        recordAudit({
          authUserId: user.id,
          clientId: client.id,
          action: "monthly.generate",
          targetType: "monthly_report",
          status: "failure",
          message: `Monthly report generation failed${error.status ? ` with HTTP ${error.status}` : ""}.`
        }),
        recordAudit({
          authUserId: user.id,
          clientId: client.id,
          action: "highlevel.read",
          targetType: "monthly_report",
          status: "failure",
          message: `HighLevel read failed during monthly report generation${error.status ? ` with HTTP ${error.status}` : ""}.`
        })
      ]);
      return json(res, error.status || 502, {
        error: "HighLevel monthly check failed.",
        detail: error.detail || "The read-only HighLevel data pull could not complete."
      });
    }
    store.reports.unshift(report);
    await persistReport(store, report);
    await recordAudit({
      authUserId: user.id,
      clientId: client.id,
      action: "monthly.generate",
      targetType: "monthly_report",
      targetId: report.id,
      message: `${report.source === "live" ? "Live" : "Sample"} monthly report completed.`
    });
    return json(res, 200, { report, reports: store.reports });
  }

  if (req.method === "POST" && pathname === "/api/clickup/post") {
    if (!canAccess(user, "user")) return forbidden(res, "Only active Admin and User accounts can post reviewed ClickUp comments.");
    const body = await parseBody(req);
    const report = store.reports.find((item) => item.id === body.reportId);
    if (!report && supabaseConfigured && body.reportId) {
      const rows = await supabaseRest("monthly_reports", {
        query: { select: "id,client_id", id: `eq.${body.reportId}`, limit: "1" }
      });
      if (rows[0] && !canAccessClient(user, rows[0].client_id)) {
        return forbidden(res, "You do not have access to the client for this report.");
      }
    }
    if (!report) return json(res, 404, { error: "Report not found." });
    if (!canAccessClient(user, report.clientId)) return forbidden(res, "You do not have access to the client for this report.");
    const client = store.clients.find((item) => item.id === report.clientId);
    if (!client?.clickupTaskId) {
      return json(res, 400, { error: "ClickUp task ID is missing for this client." });
    }

    if (process.env.CLICKUP_API_TOKEN) {
      try {
        const response = await fetch(`https://api.clickup.com/api/v2/task/${client.clickupTaskId}/comment`, {
          method: "POST",
          headers: {
            "authorization": process.env.CLICKUP_API_TOKEN,
            "content-type": "application/json"
          },
          body: JSON.stringify({ comment_text: report.generatedComment, notify_all: false })
        });
        if (!response.ok) {
          await response.text();
          await recordAudit({
            authUserId: user.id,
            clientId: client.id,
            action: "clickup.post",
            targetType: "monthly_report",
            targetId: report.id,
            status: "failure",
            message: `ClickUp posting failed with HTTP ${response.status}.`
          });
          return json(res, response.status, { error: "ClickUp posting failed.", detail: `ClickUp returned HTTP ${response.status}.` });
        }
        const payload = await response.json();
        report.postedToClickUp = true;
        report.clickupCommentId = payload.id || payload.comment?.id || "posted";
      } catch (error) {
        await recordAudit({
          authUserId: user.id,
          clientId: client.id,
          action: "clickup.post",
          targetType: "monthly_report",
          targetId: report.id,
          status: "failure",
          message: "ClickUp posting failed before a response was received."
        });
        return json(res, 502, { error: "ClickUp posting failed.", detail: "ClickUp did not return a usable response." });
      }
    } else {
      report.postedToClickUp = true;
      report.clickupCommentId = "local-preview";
    }

    await persistReport(store, report);
    await recordAudit({
      authUserId: user.id,
      clientId: client.id,
      action: "clickup.post",
      targetType: "monthly_report",
      targetId: report.id,
      message: "Reviewed monthly report posted to ClickUp."
    });
    return json(res, 200, { report, reports: store.reports });
  }

  return notFound(res);
}

async function serveStatic(req, res, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(publicDir, requestedPath));
  if (!filePath.startsWith(publicDir)) return notFound(res);

  try {
    await stat(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { "content-type": mimeTypes[ext] || "application/octet-stream" });
    createReadStream(filePath).pipe(res);
  } catch {
    const fallback = path.join(publicDir, "index.html");
    res.writeHead(200, { "content-type": mimeTypes[".html"] });
    createReadStream(fallback).pipe(res);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url.pathname);
      return;
    }
    await serveStatic(req, res, url.pathname);
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Internal server error" });
  }
});

server.listen(port, () => {
  console.log(`Lead Hero Health Check Tool running at http://localhost:${port}`);
});

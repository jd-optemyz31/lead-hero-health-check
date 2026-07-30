const icons = {
  clients: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  routing: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`,
  blast: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 11 18-5-5 18-4-8-9-5Z"/><path d="m12 16 4-4"/></svg>`,
  monthly: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/></svg>`,
  reports: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 15v2"/><path d="M12 9v8"/><path d="M17 12v5"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06A2 2 0 1 1 7.03 3.8l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.2.36.5.66.9.85.21.1.44.15.7.15H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z"/></svg>`,
  play: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7Z"/></svg>`,
  save: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></svg>`,
  post: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4 20-7Z"/></svg>`
};

const navItems = [
  { id: "clients", label: "Clients", icon: icons.clients },
  { id: "blast", label: "Blast Analyzer", icon: icons.blast },
  { id: "monthly", label: "Monthly Check", icon: icons.monthly },
  { id: "reports", label: "Reports", icon: icons.reports },
  { id: "settings", label: "Settings", icon: icons.settings }
];

const state = {
  active: "monthly",
  clients: [],
  routingSetups: [],
  blastAnalyses: [],
  reports: [],
  settings: {},
  auth: { required: false, user: null },
  selectedReportId: "",
  editingClientId: "",
  editingRoutingId: "",
  blastClientId: "",
  blastDraft: {},
  activeBlastAnalysisId: "",
  activeBlastAnalysis: null,
  blastResultsCleared: false,
  blastJob: null,
  passwordResetUserId: "",
  settingsUsers: [],
  settingsAuditEvents: [],
  settingsUsersPagination: { page: 1, perPage: 25, hasPrevious: false, hasMore: false },
  settingsAuditPagination: { page: 1, perPage: 25, hasPrevious: false, hasMore: false },
  settingsDataLoaded: false,
  settingsDataLoading: false,
  toast: ""
};

const app = document.querySelector("#app");
const localStoreKey = "leadHeroHealthCheckStore";
const fallbackTimeZones = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "Europe/Paris",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney"
];

function seedStore() {
  return {
    clients: [],
    routingSetups: [],
    blastAnalyses: [],
    reports: [],
    settings: {
      highLevelApiVersion: "2021-07-28",
      clickupConnected: false,
      aiConnected: false,
      aiProvider: "openai",
      openAiModel: "",
      safeMode: true,
      storage: "Local",
      authRequired: false
    },
    auth: { required: false, user: { email: "local-dev", role: "admin" } }
  };
}

function readLocalStore() {
  const raw = localStorage.getItem(localStoreKey);
  if (!raw) {
    const seeded = seedStore();
    writeLocalStore(seeded);
    return seeded;
  }
  return JSON.parse(raw);
}

function writeLocalStore(store) {
  localStorage.setItem(localStoreKey, JSON.stringify(store));
}

function todayIso() {
  return formatDateInput(new Date());
}

function firstDayOfMonth(date = new Date()) {
  return formatDateInput(new Date(date.getFullYear(), date.getMonth(), 1));
}

function lastDayOfMonth(date = new Date()) {
  return formatDateInput(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function api(path, options = {}) {
  if (window.location.protocol === "file:") {
    return localApi(path, options);
  }
  try {
    const response = await fetch(path, {
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      ...options
    });
    const payload = await response.json();
    if (!response.ok) {
      const error = new Error(payload.error || "Request failed");
      error.detail = payload.detail || "";
      error.fromServer = true;
      throw error;
    }
    return payload;
  } catch (error) {
    if (error.fromServer) throw error;
    throw new Error("Could not reach the app server. Saved clients and routing setup were not loaded.");
  }
}

function localApi(path, options = {}, originalError) {
  const method = options.method || "GET";
  const store = readLocalStore();
  const body = options.body ? JSON.parse(options.body) : {};
  const now = new Date().toISOString();

  if (method === "GET" && path === "/api/bootstrap") return store;
  if (method === "GET" && path.startsWith("/api/settings/users")) {
    return {
      users: [{
        id: "local-dev",
        email: "local-dev",
        role: "admin",
        active: true,
        provisioned: true,
        status: "Active",
        protectedAdmin: true,
        createdAt: "",
        lastSignInAt: ""
      }],
      pagination: { page: 1, perPage: 25, hasPrevious: false, hasMore: false }
    };
  }
  if (method === "GET" && path.startsWith("/api/settings/audit-logs")) {
    return {
      events: [],
      pagination: { page: 1, perPage: 25, hasPrevious: false, hasMore: false }
    };
  }
  if (method === "POST" && path === "/api/clients") {
    const existing = body.id ? store.clients.find((item) => item.id === body.id) : null;
    if (!existing && !body.pitToken) throw new Error("A read-only HighLevel Private Integration Token is required when adding a client.");
    const client = {
      id: body.id || crypto.randomUUID(),
      name: body.name,
      locationId: body.locationId,
      clickupTaskId: body.clickupTaskId || "",
      timezone: body.timezone || "America/New_York",
      formLeadTag: body.formLeadTag || "form lead",
      activePipelineName: body.activePipelineName || "",
      activePipelineId: body.activePipelineId || "",
      replyStageName: body.replyStageName || "",
      replyStageId: body.replyStageId || "",
      replyStageWindowHours: Number(body.replyStageWindowHours || 24),
      tokenPreview: body.pitToken ? `${body.pitToken.slice(0, 4)}...${body.pitToken.slice(-4)}` : existing?.tokenPreview || "",
      hasToken: body.pitToken ? true : Boolean(existing?.hasToken),
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };
    const index = store.clients.findIndex((item) => item.id === client.id);
    if (index >= 0) store.clients[index] = { ...store.clients[index], ...client };
    else store.clients.push(client);
    writeLocalStore(store);
    return { client, clients: store.clients };
  }

  if (method === "POST" && path === "/api/clients/disconnect") {
    const client = store.clients.find((item) => item.id === body.clientId);
    if (!client) throw new Error("Client not found.");
    client.tokenPreview = "";
    client.hasToken = false;
    client.updatedAt = now;
    writeLocalStore(store);
    return {
      message: "Client HighLevel connection disconnected from this tool.",
      client,
      clients: store.clients
    };
  }

  if (method === "POST" && path === "/api/routing") {
    const existing = body.id ? store.routingSetups.find((item) => item.id === body.id) : null;
    const setup = {
      id: body.id || crypto.randomUUID(),
      clientId: body.clientId,
      staffContactId: body.staffContactId || "",
      staffPhone: body.staffPhone,
      expectedPhrase: body.expectedPhrase || "New form submission",
      expectedDelayMinutes: Number(body.expectedDelayMinutes || 10),
      active: true,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };
    const index = store.routingSetups.findIndex((item) => item.id === setup.id);
    if (index >= 0) store.routingSetups[index] = { ...store.routingSetups[index], ...setup };
    else store.routingSetups.push(setup);
    writeLocalStore(store);
    return { routingSetups: store.routingSetups };
  }

  if (method === "POST" && path === "/api/highlevel/test") {
    const client = store.clients.find((item) => item.id === body.clientId);
    if (!client) throw new Error("Client not found.");
    if (!client.hasToken) throw new Error("HighLevel token is missing for this client.");
    return {
      ok: true,
      message: "Local preview connection check passed. Start the server with a saved PIT to test HighLevel live.",
      checked: "local-preview",
      sampleCount: 0
    };
  }

  if (method === "POST" && path === "/api/blasts/run") {
    const client = store.clients.find((item) => item.id === body.clientId);
    const analysis = localBlastAnalysis(client, body);
    store.blastAnalyses.unshift(analysis);
    writeLocalStore(store);
    return { analysis, blastAnalyses: store.blastAnalyses };
  }

  if (method === "POST" && path === "/api/monthly/run") {
    const client = store.clients.find((item) => item.id === body.clientId);
    const report = localMonthlyReport(store, client, body);
    store.reports.unshift(report);
    writeLocalStore(store);
    return { report, reports: store.reports };
  }

  if (method === "POST" && path === "/api/clickup/post") {
    const report = store.reports.find((item) => item.id === body.reportId);
    if (!report) throw new Error("Report not found.");
    report.postedToClickUp = true;
    report.clickupCommentId = "local-preview";
    writeLocalStore(store);
    return { report, reports: store.reports };
  }

  throw originalError || new Error("Local API fallback failed.");
}

function localBlastAnalysis(client, body) {
  const total = 18;
  return {
    id: crypto.randomUUID(),
    clientId: client.id,
    clientName: client.name,
    dateStart: body.dateStart,
    dateEnd: body.dateEnd,
    replyTag: body.replyTag,
    workflowName: body.workflowName || "",
    messagePhrase: body.messagePhrase || "",
    messageType: "SMS",
    estimatedSends: "Not available",
    deliveryRate: "Not available",
    taggedContactCount: total,
    totalRepliedContacts: total,
    analyzedContactCount: total,
    positiveCount: 9,
    neutralCount: 4,
    negativeCount: 3,
    optOutCount: 1,
    needsReviewCount: 1,
    summary: "18 contacts matched the reply tag during the selected window. 9 appear positive and 1 needs human review.",
    source: "sample",
    analysisMethod: "Sample",
    replies: [
      ["Avery Johnson", "Positive", "Contact showed interest and should be followed up."],
      ["Morgan Ellis", "Neutral", "Reply was short and unclear."],
      ["Sam Rivera", "Negative", "Contact was not interested."],
      ["Taylor Brooks", "Positive", "Contact asked for more details."],
      ["Jordan Lee", "Opt-out", "Contact asked to stop similar outreach."],
      ["Casey Martin", "Needs review", "Reply is ambiguous."]
    ].map(([contactName, classification, summary], index) => ({
      id: crypto.randomUUID(),
      contactId: `contact-${index + 1}`,
      contactName,
      lastReplyDate: body.dateEnd,
      classification,
      summary,
      evidence: "Local preview classification based on sample conversation evidence.",
      confidence: classification === "Needs review" ? 0.38 : 0.74,
      analysisMethod: "Sample",
      analysisNote: "",
      reviewStatus: classification === "Needs review" ? "Review needed" : "Auto-classified"
    })),
    createdAt: new Date().toISOString()
  };
}

function localMonthlyReport(store, client, body) {
  const blast = store.blastAnalyses.find((item) => item.id === body.blastAnalysisId);
  const automationFlow = {
    status: "Yes",
    formLeadTag: client.formLeadTag || "form lead",
    activePipeline: client.activePipelineId || client.activePipelineName || "Sample active pipeline",
    replyStage: client.replyStageId || client.replyStageName || "Sample replied stage",
    formLeadCount: 84,
    activePipelineOpportunities: 82,
    contactsWithReply: 18,
    repliedContactsInStage: 17,
    detail: "84 sample form-lead contacts, 82 active-pipeline opportunity matches, 18 first replies, 17 confirmed in reply stage."
  };
  const metrics = {
    routingWorking: "Yes",
    automationsFiring: "Yes",
    attributionIntact: "Yes",
    callsTracked: "Yes",
    leadsReceived: 84,
    routingMessages: 82,
    callsAnswered: 41,
    callsMissed: 8,
    missedRate: 8 / 49,
    attributionCoverage: 88,
    automationFlow,
    issues: [],
    nextMonthFocus: "Maintain current routing, attribution, and response tracking.",
    status: "Green"
  };
  const label = new Date(`${body.dateStart}T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const blastBlock = blast
    ? `Blasts (if applicable):\nBlast(s) Sent: Yes\nType: SMS\nSends: Not available\nDelivery Rate: Not available\nReplies / Engagement: ${blast.totalRepliedContacts} replies (${blast.positiveCount} positive, ${blast.neutralCount} neutral, ${blast.negativeCount} negative, ${blast.optOutCount} opt-out)`
    : "Blasts (if applicable):\nBlast(s) Sent: No\nType:\nSends:\nDelivery Rate:\nReplies / Engagement:";
  const generatedComment = `Lead Hero (Software) - Green - ${label} ${client.name}

System Health:
Routing Working: Yes
Automations Firing: Yes
Tracking / Attribution Intact: Yes

Usage & Activity:
Leads Received: ${metrics.leadsReceived}
Answered vs Missed: ${metrics.callsAnswered} answered / ${metrics.callsMissed} missed

${blastBlock}

Issues:
None

Next Month Focus:
${metrics.nextMonthFocus}`;
  return {
    id: crypto.randomUUID(),
    clientId: client.id,
    clientName: client.name,
    dateStart: body.dateStart,
    dateEnd: body.dateEnd,
    status: "Green",
    metrics,
    blastAnalysisId: blast?.id || "",
    generatedComment,
    source: "sample",
    postedToClickUp: false,
    clickupCommentId: "",
    evidence: [
      { label: "Routing evidence", detail: "82 matching workflow messages contained New form submission." },
      { label: "Attribution coverage", detail: "88% of sample leads have attribution or source fields populated." },
      { label: "Call activity", detail: "41 answered and 8 missed calls found in the selected period." },
      { label: "Workflow metadata", detail: "Workflow metadata check is read-only. Node-level inspection is intentionally not claimed." },
      { label: "Automation flow", detail: automationFlow.detail }
    ],
    createdAt: new Date().toISOString()
  };
}

async function load() {
  const data = await api("/api/bootstrap");
  Object.assign(state, data);
  render();
}

function showToast(message) {
  state.toast = message;
  render();
  window.setTimeout(() => {
    state.toast = "";
    render();
  }, 3200);
}

function setActive(active) {
  state.active = active;
  render();
}

function currentClientId() {
  return state.clients[0]?.id || "";
}

function timestampValue(value) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function newestFirstByCreatedAt(items = []) {
  return [...items].sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt));
}

function selectedBlastClientId() {
  return state.clients.some((client) => client.id === state.blastClientId)
    ? state.blastClientId
    : currentClientId();
}

function selectedBlastAnalysis(clientId) {
  if (!clientId || state.blastResultsCleared) return null;
  const clientAnalyses = newestFirstByCreatedAt(state.blastAnalyses)
    .filter((item) => item.clientId === clientId);
  const activeAnalysis = state.activeBlastAnalysis?.clientId === clientId
    ? state.activeBlastAnalysis
    : null;
  const selectedSavedAnalysis = state.activeBlastAnalysisId
    ? clientAnalyses.find((item) => item.id === state.activeBlastAnalysisId)
    : null;
  return activeAnalysis || selectedSavedAnalysis || clientAnalyses[0] || null;
}

function blastDraftValue(name, fallback = "") {
  return state.blastDraft[name] === undefined ? fallback : state.blastDraft[name];
}

function normalizedBlastProgress(progress = {}) {
  const percent = Math.max(0, Math.min(100, Math.round(Number(progress.percent) || 0)));
  return {
    phase: String(progress.phase || "initializing"),
    phaseLabel: String(progress.phaseLabel || "Preparing"),
    verb: String(progress.verb || "[Calibrating the blast scan...]"),
    detail: String(progress.detail || "Preparing a read-only HighLevel analysis."),
    percent,
    done: Math.max(0, Number(progress.done) || 0),
    total: Math.max(0, Number(progress.total) || 0),
    count: Math.max(0, Number(progress.count) || 0)
  };
}

function blastProgressCount(progress) {
  if (progress.phase === "contacts") {
    return `${progress.count.toLocaleString()} contact${progress.count === 1 ? "" : "s"} inspected`;
  }
  if (progress.phase === "messages") {
    return `${Math.min(progress.done, progress.total)} / ${progress.total} date windows`;
  }
  if (progress.phase === "classifying") {
    return `${Math.min(progress.done, progress.total).toLocaleString()} / ${progress.total.toLocaleString()} contacts`;
  }
  return "HighLevel read-only";
}

function renderBlastProgress(progressValue) {
  const progress = normalizedBlastProgress(progressValue);
  return `
    <section class="panel blast-progress-panel" aria-live="polite">
      <div class="blast-progress-header">
        <div>
          <div class="blast-progress-kicker"><span class="progress-pulse" aria-hidden="true"></span> Live analysis</div>
          <h2 id="blast-progress-verb">${escapeHtml(progress.verb)}</h2>
          <p id="blast-job-progress">${escapeHtml(progress.detail)}</p>
        </div>
        <strong id="blast-progress-percent" class="blast-progress-percent">${progress.percent}%</strong>
      </div>
      <div
        id="blast-progress-track"
        class="blast-progress-track"
        role="progressbar"
        aria-label="Blast analysis progress"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow="${progress.percent}"
        aria-valuetext="${escapeHtml(`${progress.phaseLabel}: ${progress.detail}`)}"
      >
        <div id="blast-progress-fill" class="blast-progress-fill" style="width: ${progress.percent}%"></div>
      </div>
      <div class="blast-progress-meta">
        <span id="blast-progress-phase">${escapeHtml(progress.phaseLabel)}</span>
        <span id="blast-progress-count">${escapeHtml(blastProgressCount(progress))}</span>
      </div>
    </section>
  `;
}

function updateBlastProgress(progressValue) {
  const progress = normalizedBlastProgress(progressValue);
  if (state.blastJob) state.blastJob.progress = progress;
  const verb = document.querySelector("#blast-progress-verb");
  const detail = document.querySelector("#blast-job-progress");
  const percent = document.querySelector("#blast-progress-percent");
  const track = document.querySelector("#blast-progress-track");
  const fill = document.querySelector("#blast-progress-fill");
  const phase = document.querySelector("#blast-progress-phase");
  const count = document.querySelector("#blast-progress-count");
  if (!verb || !detail || !percent || !track || !fill || !phase || !count) return;
  verb.textContent = progress.verb;
  detail.textContent = progress.detail;
  percent.textContent = `${progress.percent}%`;
  track.setAttribute("aria-valuenow", String(progress.percent));
  track.setAttribute("aria-valuetext", `${progress.phaseLabel}: ${progress.detail}`);
  fill.style.width = `${progress.percent}%`;
  phase.textContent = progress.phaseLabel;
  count.textContent = blastProgressCount(progress);
}

function formatSavedAt(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "saved time unknown";
  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function blastAnalysisOptionLabel(item) {
  const clientName = item.clientName || "Unknown client";
  const replyTag = item.replyTag || "reply tag not set";
  const source = item.source === "live" ? "live" : "sample";
  return `${clientName} - saved ${formatSavedAt(item.createdAt)} - ${item.dateStart} to ${item.dateEnd} - ${replyTag} - ${source}`;
}

function isAdminUser() {
  return state.auth?.user?.role === "admin";
}

function canManageClients() {
  return ["admin", "user"].includes(state.auth?.user?.role) || !state.auth?.required;
}

function timeZones() {
  if (typeof Intl?.supportedValuesOf === "function") {
    return Intl.supportedValuesOf("timeZone");
  }
  return fallbackTimeZones;
}

function timezoneOptions(selected = "America/New_York") {
  const zones = timeZones();
  const values = zones.includes(selected) ? zones : [selected, ...zones];
  return values.map((zone) => `<option value="${escapeHtml(zone)}" ${zone === selected ? "selected" : ""}>${escapeHtml(zone)}</option>`).join("");
}

function clientOptions(selected = currentClientId()) {
  return state.clients.map((client) => `<option value="${client.id}" ${client.id === selected ? "selected" : ""}>${escapeHtml(client.name)}</option>`).join("");
}

function requireClientOptions(selected = currentClientId()) {
  const options = clientOptions(selected);
  return options || `<option value="">Add a client first</option>`;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function badge(value) {
  const key = String(value || "").toLowerCase();
  const className = key.includes("green") || key === "yes" || key === "positive" || key === "posted" ? "green" : key.includes("yellow") || key === "partial" || key === "neutral" || key.includes("review") ? "yellow" : key.includes("red") || key === "no" || key === "negative" || key.includes("opt") ? "red" : "dark";
  return `<span class="badge ${className}">${escapeHtml(value)}</span>`;
}

function sourceBadge(source) {
  return badge(source === "live" ? "Live HighLevel" : "Sample");
}

function formatConfidence(value) {
  if (value === null || value === undefined || value === "") return "Not scored";
  const number = Number(value);
  if (!Number.isFinite(number)) return "Not scored";
  return `${Math.round(number * 100)}%`;
}

function errorMessage(error) {
  return error.detail ? `${error.message} ${error.detail}` : error.message;
}

function renderShell(content, title, subtitle, actions = "") {
  const authActions = state.auth?.user
    ? `<span class="user-chip">${escapeHtml(state.auth.user.email || "User")} | ${escapeHtml(state.auth.user.role || "user")}</span><button class="btn secondary small" type="button" data-logout>Log out</button>`
    : "";
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand"><img src="assets/lead-hero-logo.png" alt="Lead Hero" /></div>
        <nav class="nav" aria-label="Primary">
          ${navItems.map((item) => `<button class="${state.active === item.id ? "active" : ""}" data-nav="${item.id}">${item.icon}<span>${item.label}</span></button>`).join("")}
        </nav>
        <div class="safe-note"><strong>Read-only HighLevel mode.</strong><br />This app has no controls to message contacts, call contacts, enroll workflows, or change CRM records.</div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div class="page-title">
            <h1>${title}</h1>
            <p>${subtitle}</p>
          </div>
          <div class="top-actions">${actions}${authActions}</div>
        </header>
        <div class="content">${content}</div>
      </main>
    </div>
    <div class="toast ${state.toast ? "" : "hidden"}">${escapeHtml(state.toast)}</div>
  `;

  document.querySelectorAll("[data-nav]").forEach((button) => {
    button.addEventListener("click", () => setActive(button.dataset.nav));
  });
  document.querySelectorAll("[data-logout]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await api("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
      } finally {
        state.auth = { required: true, user: null };
        render();
      }
    });
  });
}

function render() {
  if (state.auth?.required && !state.auth?.user) {
    renderLogin();
    return;
  }
  const views = {
    clients: renderClients,
    blast: renderBlast,
    monthly: renderMonthly,
    reports: renderReports,
    settings: renderSettings
  };
  if (!views[state.active]) state.active = "clients";
  views[state.active]();
}

function renderLogin() {
  app.innerHTML = `
    <main class="login-screen">
      <section class="login-panel">
        <img src="assets/lead-hero-logo.png" alt="Lead Hero" />
        <h1>Lead Hero Health Check</h1>
        <p>Sign in with an approved internal account to continue.</p>
        <form id="login-form" class="grid">
          <div class="field"><label>Email</label><input name="email" type="email" autocomplete="email" required></div>
          <div class="field"><label>Password</label><input name="password" type="password" autocomplete="current-password" required></div>
          <button class="btn primary" type="submit">${icons.play} Sign in</button>
        </form>
        <p class="security-note">If you cannot sign in, contact an Admin. Password recovery email is not used by this tool.</p>
      </section>
      <div class="toast ${state.toast ? "" : "hidden"}">${escapeHtml(state.toast)}</div>
    </main>
  `;
  document.querySelector("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const payload = await api("/api/auth/login", { method: "POST", body: JSON.stringify(body) });
      state.auth = { required: true, user: payload.user };
      showToast("Signed in.");
      await load();
    } catch (error) {
      showToast(errorMessage(error));
    }
  });
}

function renderClients() {
  const canManageConnections = canManageClients();
  const editingClient = state.clients.find((client) => client.id === state.editingClientId);
  const editingRouting = state.routingSetups.find((setup) => setup.id === state.editingRoutingId);
  const routingClientId = editingRouting?.clientId || editingClient?.id || currentClientId();
  const routingRows = state.routingSetups
    .filter((setup) => !routingClientId || setup.clientId === routingClientId)
    .map((setup) => {
      const client = state.clients.find((item) => item.id === setup.clientId);
      return `
        <tr>
          <td><strong>${escapeHtml(client?.name || "Unknown client")}</strong></td>
          <td>${escapeHtml(setup.staffContactId || "Not provided")}</td>
          <td>${escapeHtml(setup.staffPhone)}</td>
          <td>${escapeHtml(setup.expectedPhrase)}</td>
          <td>${setup.expectedDelayMinutes} min</td>
          <td>${setup.active ? badge("Active") : badge("Inactive")}</td>
          <td>${canManageConnections ? `<button class="btn secondary small" type="button" data-edit-routing="${setup.id}">Edit</button>` : ""}</td>
        </tr>
      `;
    }).join("");
  const formTitle = editingClient ? `Edit ${editingClient.name}` : "Add client";
  const formSubtitle = editingClient
    ? "Update connection, lead flow, routing, and ClickUp settings. Leave the token blank to keep the saved token."
    : "Store the read-only HighLevel connection, lead flow, routing, and ClickUp task target.";
  const routingFormTitle = editingRouting ? "Edit routing setup" : "Add routing setup";
  const statusItems = [
    {
      label: "HighLevel",
      detail: `Read-only mode, API ${state.settings.highLevelApiVersion || "2021-07-28"}`
    },
    {
      label: "ClickUp",
      detail: state.settings.clickupConnected ? "Connected for reviewed report comments" : "Local preview only"
    },
    {
      label: "AI",
      detail: state.settings.aiConnected
        ? `${state.settings.aiProvider === "openrouter" ? "OpenRouter" : "OpenAI"} connected${state.settings.openAiModel ? `, ${state.settings.openAiModel}` : ""}`
        : "Rules fallback"
    }
  ];
  const rows = state.clients.map((client) => `
    <tr>
      <td><strong>${escapeHtml(client.name)}</strong><br><span class="muted">${escapeHtml(client.timezone)}</span></td>
      <td>${escapeHtml(client.locationId)}</td>
      <td><strong>${escapeHtml(client.formLeadTag || "form lead")}</strong><br><span class="muted">${escapeHtml(client.activePipelineName || client.activePipelineId || "Pipeline not set")} -> ${escapeHtml(client.replyStageName || client.replyStageId || "Reply stage not set")}</span></td>
      <td>${client.hasToken ? badge("Token saved") : badge("Missing token")}</td>
      <td>${client.clickupTaskId ? escapeHtml(client.clickupTaskId) : badge("Missing ClickUp")}</td>
      <td>${new Date(client.updatedAt).toLocaleDateString()}</td>
      <td>
        <div class="table-actions">
          ${canManageConnections ? `<button class="btn secondary small" type="button" data-edit-client="${client.id}">Edit</button>` : ""}
          ${canManageConnections ? `<button class="btn secondary small" type="button" data-test-highlevel="${client.id}" ${client.hasToken ? "" : "disabled"}>${icons.play} Test</button>` : ""}
          ${canManageConnections ? `<button class="btn danger small" type="button" data-disconnect-client="${client.id}" ${client.hasToken ? "" : "disabled"}>Disconnect</button>` : ""}
        </div>
      </td>
    </tr>
  `).join("");

  renderShell(`
    <div class="grid">
      <section class="panel">
        <div class="panel-header">
          <div><h2>Clients</h2><p>${state.clients.length} configured account${state.clients.length === 1 ? "" : "s"}</p></div>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Client</th><th>Location ID</th><th>Automation flow</th><th>HighLevel token</th><th>ClickUp task</th><th>Updated</th><th>Connection</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="7"><div class="empty">Add your first client to start running Lead Hero health checks.</div></td></tr>`}</tbody>
          </table>
        </div>
      </section>
      <section class="panel">
        <div class="panel-header">
          <div><h2>${escapeHtml(formTitle)}</h2><p>${escapeHtml(formSubtitle)}</p></div>
        </div>
        <form id="client-form" class="grid">
          <input type="hidden" name="id" value="${escapeHtml(editingClient?.id || "")}">
          <h3 class="section-kicker">Connection</h3>
          <div class="form-grid">
            <div class="field"><label>Client name</label><input name="name" required placeholder="Client account name" value="${escapeHtml(editingClient?.name || "")}"></div>
            <div class="field"><label>Timezone</label><select name="timezone">${timezoneOptions(editingClient?.timezone || "America/New_York")}</select></div>
            <div class="field"><label>HighLevel location ID</label><input name="locationId" required placeholder="Location/sub-account ID" value="${escapeHtml(editingClient?.locationId || "")}"></div>
            <div class="field"><label>ClickUp task ID</label><input name="clickupTaskId" placeholder="ClickUp client task ID" value="${escapeHtml(editingClient?.clickupTaskId || "")}"></div>
            <div class="field"><label>Read-only Private Integration Token</label><input name="pitToken" type="password" ${editingClient ? "" : "required"} placeholder="${editingClient ? "Leave blank to keep saved token" : "Encrypted server-side after saving"}"></div>
          </div>
          <h3 class="section-kicker">Lead flow</h3>
          <div class="form-grid">
            <div class="field"><label>Form lead tag</label><input name="formLeadTag" value="${escapeHtml(editingClient?.formLeadTag || "form lead")}"></div>
            <div class="field"><label>Active pipeline name</label><input name="activePipelineName" placeholder="#1 Active Pipeline" value="${escapeHtml(editingClient?.activePipelineName || "")}"></div>
            <div class="field"><label>Active pipeline ID</label><input name="activePipelineId" placeholder="Optional exact pipeline ID" value="${escapeHtml(editingClient?.activePipelineId || "")}"></div>
            <div class="field"><label>First reply stage name</label><input name="replyStageName" placeholder="Replied / Engaged / Needs Follow Up" value="${escapeHtml(editingClient?.replyStageName || "")}"></div>
            <div class="field"><label>First reply stage ID</label><input name="replyStageId" placeholder="Optional exact stage ID" value="${escapeHtml(editingClient?.replyStageId || "")}"></div>
            <div class="field"><label>Reply movement window</label><input name="replyStageWindowHours" type="number" min="1" value="${escapeHtml(editingClient?.replyStageWindowHours || 24)}"></div>
          </div>
          <p class="muted">Automation firing is checked with read-only evidence: form-lead contacts, opportunities in the active pipeline, staff notification messages, and reply-stage movement after the contact replies.</p>
          <p class="muted">Use read-only HighLevel scopes only. Tokens are never shown again after saving and must not be stored in code or Railway variables per client.</p>
          <div class="actions"><button class="btn primary" type="submit">${icons.save} ${editingClient ? "Save changes" : "Save client"}</button>${editingClient ? `<button class="btn secondary" type="button" data-cancel-edit>Cancel edit</button>` : ""}</div>
        </form>
      </section>
      <section class="panel">
        <div class="panel-header">
          <div><h2>${routingFormTitle}</h2><p>Configure staff notification evidence for the selected client. This only checks messages containing the expected phrase.</p></div>
        </div>
        <form id="routing-form" class="grid">
          <input type="hidden" name="id" value="${escapeHtml(editingRouting?.id || "")}">
          <div class="form-grid">
            <div class="field"><label>Client</label><select name="clientId" required>${requireClientOptions(routingClientId)}</select></div>
            <div class="field"><label>Staff contact ID</label><input name="staffContactId" placeholder="Optional if phone is enough" value="${escapeHtml(editingRouting?.staffContactId || "")}"></div>
            <div class="field"><label>Staff phone number</label><input name="staffPhone" required placeholder="+1 555 010 1400" value="${escapeHtml(editingRouting?.staffPhone || "")}"></div>
            <div class="field"><label>Expected phrase</label><input name="expectedPhrase" value="${escapeHtml(editingRouting?.expectedPhrase || "New form submission")}"></div>
            <div class="field"><label>Expected delay window</label><select name="expectedDelayMinutes"><option value="5" ${Number(editingRouting?.expectedDelayMinutes || 10) === 5 ? "selected" : ""}>5 minutes</option><option value="10" ${Number(editingRouting?.expectedDelayMinutes || 10) === 10 ? "selected" : ""}>10 minutes</option><option value="15" ${Number(editingRouting?.expectedDelayMinutes || 10) === 15 ? "selected" : ""}>15 minutes</option><option value="30" ${Number(editingRouting?.expectedDelayMinutes || 10) === 30 ? "selected" : ""}>30 minutes</option></select></div>
          </div>
          <p class="muted">Routing checks are read-only. The app verifies staff notification evidence; it does not send or resend notifications.</p>
          <div class="actions"><button class="btn primary" type="submit" ${state.clients.length ? "" : "disabled"}>${icons.save} ${editingRouting ? "Save routing changes" : "Save routing setup"}</button>${editingRouting ? `<button class="btn secondary" type="button" data-cancel-routing-edit>Cancel edit</button>` : ""}</div>
        </form>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Client</th><th>Staff contact</th><th>Phone</th><th>Phrase</th><th>Delay</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>${routingRows || `<tr><td colspan="7"><div class="empty">No routing setup has been added for this client yet.</div></td></tr>`}</tbody>
          </table>
        </div>
      </section>
      <section class="panel">
        <div class="panel-header">
          <div><h2>System status</h2><p>Short server-side status. Detailed setup stays in Railway and Supabase.</p></div>
        </div>
        <div class="evidence-list">
          ${statusItems.map((item) => `<div class="evidence-item"><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.detail)}</span></div>`).join("")}
        </div>
      </section>
    </div>
  `, "Clients", "Manage each account's connection, lead flow, routing, and ClickUp destination.");

  document.querySelector("#client-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const previousClientIds = new Set(state.clients.map((client) => client.id));
      const payload = await api("/api/clients", { method: "POST", body: JSON.stringify(body) });
      state.clients = payload.clients;
      if (!body.id) {
        const addedClient = state.clients.find((client) => !previousClientIds.has(client.id));
        if (addedClient) {
          state.blastClientId = addedClient.id;
          state.blastDraft = { ...state.blastDraft, clientId: addedClient.id };
        }
      }
      state.editingClientId = "";
      showToast(body.id ? "Client details updated." : "Client saved.");
    } catch (error) {
      showToast(errorMessage(error));
    }
  });
  document.querySelectorAll("[data-edit-client]").forEach((button) => {
    button.addEventListener("click", () => {
      state.editingClientId = button.dataset.editClient;
      render();
    });
  });
  document.querySelectorAll("[data-cancel-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      state.editingClientId = "";
      render();
    });
  });
  document.querySelectorAll("[data-test-highlevel]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        const payload = await api("/api/highlevel/test", { method: "POST", body: JSON.stringify({ clientId: button.dataset.testHighlevel }) });
        showToast(payload.message || "HighLevel connection succeeded.");
      } catch (error) {
        showToast(errorMessage(error));
      }
    });
  });
  document.querySelectorAll("[data-disconnect-client]").forEach((button) => {
    button.addEventListener("click", async () => {
      const client = state.clients.find((item) => item.id === button.dataset.disconnectClient);
      if (!window.confirm(`Disconnect ${client?.name || "this client"} from HighLevel in this tool? This only removes the saved token from the Health Check Tool.`)) return;
      try {
        const payload = await api("/api/clients/disconnect", { method: "POST", body: JSON.stringify({ clientId: button.dataset.disconnectClient }) });
        state.clients = payload.clients;
        showToast(payload.message || "Client disconnected.");
      } catch (error) {
        showToast(errorMessage(error));
      }
    });
  });
  document.querySelectorAll("[data-edit-routing]").forEach((button) => {
    button.addEventListener("click", () => {
      state.editingRoutingId = button.dataset.editRouting;
      render();
    });
  });
  document.querySelectorAll("[data-cancel-routing-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      state.editingRoutingId = "";
      render();
    });
  });
  document.querySelector("#routing-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const payload = await api("/api/routing", { method: "POST", body: JSON.stringify(body) });
      state.routingSetups = payload.routingSetups;
      state.editingRoutingId = "";
      showToast(body.id ? "Routing setup updated." : "Routing setup saved.");
    } catch (error) {
      showToast(errorMessage(error));
    }
  });
}

function pollBlastJob(jobId) {
  let consecutiveFailures = 0;
  const interval = setInterval(async () => {
    try {
      const job = await api(`/api/blasts/job/${jobId}`);
      consecutiveFailures = 0;
      if (job.status === "running") updateBlastProgress(job.progress);
      if (job.status === "done") {
        clearInterval(interval);
        state.blastJob = null;
        state.blastClientId = job.analysis.clientId;
        state.blastDraft = { ...state.blastDraft, clientId: job.analysis.clientId };
        state.activeBlastAnalysis = job.analysis;
        state.blastAnalyses = newestFirstByCreatedAt([
          job.analysis,
          ...(state.blastAnalyses || []).filter((item) => item.id !== job.analysis.id)
        ]);
        state.activeBlastAnalysisId = job.analysis.id;
        if (state.active === "blast") render();
        showToast(job.analysis.totalRepliedContacts
          ? "Live HighLevel blast analysis saved."
          : "Blast analysis completed with no matching post-blast replies. Review the result diagnostics.");
      } else if (job.status === "error") {
        clearInterval(interval);
        state.blastJob = null;
        if (state.active === "blast") render();
        showToast(job.error || "Blast analysis failed.");
      }
    } catch {
      consecutiveFailures += 1;
      if (consecutiveFailures >= 3) {
        clearInterval(interval);
        state.blastJob = null;
        if (state.active === "blast") render();
        showToast("Blast analysis status could not be read after repeated connection failures. Please run the analysis again.");
      }
    }
  }, 3000);
}

function renderBlast() {
  const blastClientId = selectedBlastClientId();
  state.blastClientId = blastClientId;
  const selectedClient = state.clients.find((client) => client.id === blastClientId);
  const latest = selectedBlastAnalysis(blastClientId);
  const clearAction = latest
    ? `<button class="btn secondary" type="button" data-clear-blast-result>Clear loaded result</button>`
    : "";
  const rows = latest?.replies?.map((reply) => `
    <tr>
      <td><strong>${escapeHtml(reply.contactName)}</strong><br><span class="muted">${escapeHtml(reply.contactId)}</span></td>
      <td>${escapeHtml(reply.lastReplyDate)}</td>
      <td>${badge(reply.classification)}</td>
      <td>${escapeHtml(formatConfidence(reply.confidence))}</td>
      <td>${escapeHtml(reply.summary)}</td>
      <td>${escapeHtml(reply.evidence)}</td>
      <td>${reply.doNotDisturb
        ? `${badge("HighLevel DND")}<br><span class="muted">${escapeHtml(reply.dndChannel || "Blast channel")}</span>`
        : `${badge(reply.serviceRelevance || "Unclear")}${reply.relevanceReason ? `<br><span class="muted">${escapeHtml(reply.relevanceReason)}</span>` : ""}`
      }</td>
      <td>${escapeHtml(reply.analysisMethod || "Rules")}</td>
      <td>${escapeHtml(reply.reviewStatus)}${reply.analysisNote ? `<br><span class="muted">${escapeHtml(reply.analysisNote)}</span>` : ""}${reply.threadMessageCount ? `<br><span class="muted">${escapeHtml(`${reply.threadMessageCount} post-blast message(s) reviewed${reply.blastContextMatched ? " after matched blast" : ""}.`)}</span>` : ""}</td>
    </tr>
  `).join("");

  renderShell(`
    <div class="grid">
      <section class="panel">
        <div class="panel-header">
          <div><h2>Run blast analysis anytime</h2><p>Use reply tag, date range, and the required blast phrase to account for every tagged contact and classify safely anchored post-blast conversations. This does not launch blasts or message contacts.</p></div>
        </div>
        <form id="blast-form" class="grid">
          <div class="form-grid three">
            <div class="field"><label>Client</label><select name="clientId" required ${state.blastJob ? "disabled" : ""}>${requireClientOptions(blastClientId)}</select></div>
            <div class="field"><label>Start date</label><input type="date" name="dateStart" required value="${escapeHtml(blastDraftValue("dateStart", firstDayOfMonth()))}"></div>
            <div class="field"><label>End date</label><input type="date" name="dateEnd" required value="${escapeHtml(blastDraftValue("dateEnd", todayIso()))}"></div>
            <div class="field"><label>Reply tag</label><input name="replyTag" required value="${escapeHtml(blastDraftValue("replyTag", "Replied to Blast"))}"></div>
            <div class="field"><label>Optional workflow name or ID</label><input name="workflowName" placeholder="BLAST - May Offer" value="${escapeHtml(blastDraftValue("workflowName"))}"></div>
            <div class="field"><label>Blast message phrase</label><input name="messagePhrase" required placeholder="Distinctive wording from the outbound blast" value="${escapeHtml(blastDraftValue("messagePhrase"))}"></div>
          </div>
          <div class="actions"><button class="btn primary" type="submit" ${state.clients.length && !state.blastJob ? "" : "disabled"}>${icons.play} ${state.blastJob ? "Running..." : "Run analysis"}</button></div>
        </form>
      </section>
      ${state.blastJob
        ? renderBlastProgress(state.blastJob.progress)
        : latest
          ? renderBlastResult(latest, rows, clearAction)
          : `<div class="empty">${state.blastResultsCleared
            ? "No blast analysis is loaded. Run analysis to show fresh results."
            : `No saved blast analysis exists for ${escapeHtml(selectedClient?.name || "the selected client")}. Run an analysis to create one.`}</div>`
      }
    </div>
  `, "Blast Analyzer", "Analyze blast replies independently from the monthly maintenance check.");

  const blastForm = document.querySelector("#blast-form");
  blastForm.addEventListener("input", (event) => {
    if (event.target.name) state.blastDraft[event.target.name] = event.target.value;
  });
  blastForm.querySelector('[name="clientId"]').addEventListener("change", (event) => {
    state.blastClientId = event.target.value;
    state.blastDraft.clientId = event.target.value;
    state.activeBlastAnalysisId = "";
    state.activeBlastAnalysis = null;
    state.blastResultsCleared = false;
    render();
  });
  blastForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      state.blastClientId = body.clientId;
      state.blastDraft = body;
      state.blastResultsCleared = false;
      state.activeBlastAnalysis = null;
      state.activeBlastAnalysisId = "";
      const payload = await api("/api/blasts/run", { method: "POST", body: JSON.stringify(body) });
      if (payload.jobId) {
        state.blastJob = {
          jobId: payload.jobId,
          clientId: body.clientId,
          status: "running",
          progress: normalizedBlastProgress()
        };
        render();
        pollBlastJob(payload.jobId);
      } else {
        state.blastClientId = payload.analysis.clientId;
        state.blastDraft = { ...state.blastDraft, clientId: payload.analysis.clientId };
        state.activeBlastAnalysis = payload.analysis;
        state.blastAnalyses = newestFirstByCreatedAt([
          payload.analysis,
          ...(payload.blastAnalyses || []).filter((item) => item.id !== payload.analysis.id)
        ]);
        state.activeBlastAnalysisId = payload.analysis.id;
        showToast(`${payload.analysis.source === "live" ? "Live HighLevel" : "Sample"} blast analysis saved.`);
      }
    } catch (error) {
      showToast(errorMessage(error));
    }
  });

  document.querySelectorAll("[data-clear-blast-result]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeBlastAnalysisId = "";
      state.activeBlastAnalysis = null;
      state.blastResultsCleared = true;
      showToast("Loaded blast analysis cleared from this screen.");
    });
  });
}

function renderBlastResult(analysis, rows, actions = "") {
  const resultRows = rows || `
    <tr>
      <td colspan="9">
        <div class="empty">No tagged contact had both the required outbound blast phrase and a later inbound reply in this date range. Review the diagnostic summary above, then confirm the reply tag, phrase, and dates.</div>
      </td>
    </tr>
  `;
  return `
    <section class="grid blast-metrics">
      ${metricCard("Tagged contacts", analysis.taggedContactCount ?? analysis.totalRepliedContacts, analysis.replyTag)}
      ${metricCard("Analyzed replies", analysis.analyzedContactCount ?? analysis.totalRepliedContacts, "Matched blast and later inbound reply")}
      ${metricCard("Positive", analysis.positiveCount, "Interested or likely follow-up")}
      ${metricCard("Neutral", analysis.neutralCount, "No clear intent")}
      ${metricCard("Negative", analysis.negativeCount, "Low interest")}
      ${metricCard("Opt-outs", analysis.optOutCount, "Do-not-contact signal")}
      ${metricCard("Needs review", analysis.needsReviewCount, "Human review")}
    </section>
    <section class="panel">
      <div class="panel-header">
          <div><h2>All tagged contacts</h2><p>${escapeHtml(analysis.summary)} Saved ${escapeHtml(formatSavedAt(analysis.createdAt))}.</p></div>
          <div class="panel-tools">
            <div class="badge-group">${sourceBadge(analysis.source)}${badge(analysis.analysisMethod || "Rules")}${badge(`${analysis.dateStart} to ${analysis.dateEnd}`)}</div>
            <div class="actions">${actions}</div>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Contact</th><th>Last reply</th><th>Classification</th><th>Confidence</th><th>Summary</th><th>Evidence</th><th>Offer relevance / DND</th><th>Method</th><th>Status</th></tr></thead>
            <tbody>${resultRows}</tbody>
          </table>
        </div>
    </section>
  `;
}

function renderMonthly() {
  const latest = state.reports[0];
  const client = state.clients.find((item) => item.id === (latest?.clientId || currentClientId()));
  const savedBlastAnalyses = newestFirstByCreatedAt(state.blastAnalyses);
  const blastOptions = [`<option value="">Do not include blast analysis</option>`]
    .concat(savedBlastAnalyses.map((item) => `<option value="${item.id}">${escapeHtml(blastAnalysisOptionLabel(item))}</option>`))
    .join("");
  const action = latest ? `<button class="btn primary" type="button" data-post-clickup="${latest.id}">${icons.post} Post to ClickUp</button>` : "";

  renderShell(`
    <div class="grid">
      <section class="panel">
        <div class="panel-header">
          <div><h2>Run monthly check</h2><p>Select a client and reporting period. Review before posting to ClickUp.</p></div>
        </div>
        <form id="monthly-form" class="grid">
          <div class="form-grid three">
            <div class="field"><label>Client</label><select name="clientId" required>${requireClientOptions(client?.id)}</select></div>
            <div class="field"><label>Start date</label><input type="date" name="dateStart" required value="${firstDayOfMonth()}"></div>
            <div class="field"><label>End date</label><input type="date" name="dateEnd" required value="${lastDayOfMonth()}"></div>
            <div class="field"><label>Saved blast analysis</label><select name="blastAnalysisId">${blastOptions}</select></div>
          </div>
          <div class="actions"><button class="btn primary" type="submit" ${state.clients.length ? "" : "disabled"}>${icons.play} Run monthly check</button>${action}</div>
        </form>
      </section>
      ${latest ? renderReport(latest) : renderEmptyMonthly()}
    </div>
  `, "Monthly Check", "Generate, review, and post the Lead Hero software health report.");

  document.querySelector("#monthly-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const payload = await api("/api/monthly/run", { method: "POST", body: JSON.stringify(body) });
      state.reports = payload.reports;
      state.selectedReportId = payload.report.id;
      showToast(`${payload.report.source === "live" ? "Live HighLevel" : "Sample"} monthly check generated.`);
    } catch (error) {
      showToast(errorMessage(error));
    }
  });
  document.querySelectorAll("[data-post-clickup]").forEach((button) => {
    button.addEventListener("click", () => postClickUp(button.dataset.postClickup));
  });
}

function renderReport(report) {
  const m = report.metrics;
  const automationFoot = m.automationFlow
    ? `${m.automationFlow.activePipelineOpportunities}/${m.automationFlow.formLeadCount} opps, ${m.automationFlow.repliedContactsInStage}/${m.automationFlow.contactsWithReply} reply-stage`
    : "Outcome-based evidence";
  return `
    <section class="status-hero">
      <div>
        <h2>Lead Hero status: ${badge(report.status)}</h2>
        <div class="source-row">${sourceBadge(report.source)}</div>
        <p class="muted">${escapeHtml(report.clientName)} | ${escapeHtml(report.dateStart)} to ${escapeHtml(report.dateEnd)} | ${report.postedToClickUp ? "Posted to ClickUp" : "Draft report"}</p>
      </div>
      <div class="status-mark">${report.status === "Green" ? "G" : report.status === "Yellow" ? "!" : "X"}</div>
    </section>
    <section class="grid six">
      ${metricCard("Routing Working", m.routingWorking, `${m.routingMessages} notification matches`)}
      ${metricCard("Automations Firing", m.automationsFiring, automationFoot)}
      ${metricCard("Attribution", m.attributionIntact, `${m.attributionCoverage}% coverage`)}
      ${metricCard("Leads Received", m.leadsReceived, "Selected date range")}
      ${metricCard("Answered Calls", m.callsAnswered, `${m.callsMissed} missed`)}
      ${metricCard("Missed Rate", `${Math.round(m.missedRate * 100)}%`, "Call activity")}
    </section>
    <section class="grid two">
      <div class="panel">
        <div class="panel-header"><div><h2>Evidence</h2><p>Read-only checks used for the report.</p></div></div>
        <div class="source-row">${sourceBadge(report.source)}</div>
        <div class="evidence-list">
          ${report.evidence.map((item) => `<div class="evidence-item"><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.detail)}</span></div>`).join("")}
        </div>
      </div>
      <div class="panel">
        <div class="panel-header">
          <div><h2>ClickUp comment preview</h2><p>Review this before posting to the configured client task.</p></div>
          ${report.postedToClickUp ? badge("Posted") : badge("Draft")}
        </div>
        <div class="comment-preview">${escapeHtml(report.generatedComment)}</div>
      </div>
    </section>
  `;
}

function renderEmptyMonthly() {
  return `
    <div class="empty">Run a monthly check to generate system health, usage activity, call reporting, blast summary, and ClickUp comment text.</div>
  `;
}

function metricCard(label, value, foot) {
  return `
    <article class="card metric">
      <div class="metric-label"><span>${escapeHtml(label)}</span></div>
      <div class="metric-value">${escapeHtml(value)}</div>
      <div class="metric-foot">${escapeHtml(foot || "")}</div>
    </article>
  `;
}

async function postClickUp(reportId) {
  if (!window.confirm("Post this reviewed report to the configured ClickUp task?")) return;
  try {
    const payload = await api("/api/clickup/post", { method: "POST", body: JSON.stringify({ reportId }) });
    state.reports = payload.reports;
    showToast(payload.report.clickupCommentId === "local-preview" ? "Marked as posted locally. Add CLICKUP_API_TOKEN to post live." : "Posted to ClickUp.");
  } catch (error) {
    showToast(errorMessage(error));
  }
}

function formatOptionalDate(value, fallback = "Never") {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : fallback;
}

async function loadSettingsData({
  usersPage = state.settingsUsersPagination.page || 1,
  auditPage = state.settingsAuditPagination.page || 1
} = {}) {
  if (!isAdminUser()) return;
  state.settingsDataLoading = true;
  if (state.active === "settings") render();
  try {
    const [userPayload, auditPayload] = await Promise.all([
      api(`/api/settings/users?page=${usersPage}&perPage=25`),
      api(`/api/settings/audit-logs?page=${auditPage}&perPage=25`)
    ]);
    state.settingsUsers = userPayload.users || [];
    state.settingsUsersPagination = userPayload.pagination || state.settingsUsersPagination;
    state.settingsAuditEvents = auditPayload.events || [];
    state.settingsAuditPagination = auditPayload.pagination || state.settingsAuditPagination;
    state.settingsDataLoaded = true;
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    state.settingsDataLoading = false;
    if (state.active === "settings") render();
  }
}

function settingsIntegrationCards() {
  const items = [
    ["HighLevel", `Read-only API ${state.settings.highLevelApiVersion || "2021-07-28"}`],
    ["ClickUp", state.settings.clickupConnected ? "Connected for reviewed comments" : "Not connected"],
    ["AI classification", state.settings.aiConnected ? `${state.settings.aiProvider === "openrouter" ? "OpenRouter" : "OpenAI"} connected` : "Rules fallback"],
    ["Storage", state.settings.storage || "Local"],
    ["Authentication", state.settings.authRequired ? "Required" : "Local development bypass"]
  ];
  return items.map(([label, detail]) => `
    <div class="evidence-item">
      <strong>${escapeHtml(label)}</strong>
      <span>${escapeHtml(detail)}</span>
    </div>
  `).join("");
}

function renderSettings() {
  const isAdmin = isAdminUser();
  const currentUser = state.auth?.user || {};
  const currentUserId = currentUser.id || "";
  const usersById = new Map(state.settingsUsers.map((item) => [item.id, item]));
  const passwordResetUser = usersById.get(state.passwordResetUserId);
  const userRows = state.settingsUsers.map((managedUser) => {
    const protectedAccount = managedUser.protectedAdmin;
    const self = managedUser.id === currentUserId;
    const changeDisabled = protectedAccount || self;
    return `
      <tr data-user-row="${escapeHtml(managedUser.email.toLowerCase())}">
        <td>
          <strong>${escapeHtml(managedUser.email || "Email unavailable")}</strong>
          ${protectedAccount ? `<br><span class="muted">Environment-managed Admin</span>` : ""}
        </td>
        <td>
          <select class="compact-select" data-user-role="${escapeHtml(managedUser.id)}" ${changeDisabled ? "disabled" : ""}>
            <option value="admin" ${managedUser.role === "admin" ? "selected" : ""}>Admin</option>
            <option value="user" ${managedUser.role === "user" ? "selected" : ""}>User</option>
          </select>
        </td>
        <td>${badge(managedUser.status)}</td>
        <td>${escapeHtml(formatOptionalDate(managedUser.lastSignInAt))}</td>
        <td>${escapeHtml(formatOptionalDate(managedUser.createdAt, "Unknown"))}</td>
        <td>
          <div class="table-actions">
            <button class="btn secondary small" type="button" data-reset-user="${escapeHtml(managedUser.id)}" ${!managedUser.active || self ? "disabled" : ""}>Reset password</button>
            <button class="btn ${managedUser.active ? "danger" : "secondary"} small" type="button" data-toggle-user="${escapeHtml(managedUser.id)}" data-next-active="${managedUser.active ? "false" : "true"}" ${changeDisabled ? "disabled" : ""}>${managedUser.active ? "Deactivate" : "Reactivate"}</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
  const auditRows = state.settingsAuditEvents.map((event) => {
    const actor = usersById.get(event.actorUserId);
    return `
      <tr>
        <td>${escapeHtml(formatOptionalDate(event.createdAt, "Unknown"))}</td>
        <td><strong>${escapeHtml(event.action)}</strong><br><span class="muted">${escapeHtml(event.targetType || "application")}</span></td>
        <td>${badge(event.status)}</td>
        <td>${escapeHtml(actor?.email || event.actorUserId || "System")}</td>
        <td>${escapeHtml(event.message || "")}</td>
      </tr>
    `;
  }).join("");
  const invitePanel = isAdmin
    ? `
      <section class="panel">
        <div class="panel-header">
          <div><h2>Invite user</h2><p>Create a confirmed member manually. No invitation email is sent.</p></div>
          ${badge("Admin only")}
        </div>
        <form id="invite-user-form" class="form-grid">
          <div class="field"><label>Email</label><input name="email" type="email" autocomplete="off" required></div>
          <div class="field"><label>Role</label><select name="role"><option value="user" selected>User</option><option value="admin">Admin</option></select></div>
          <div class="field"><label>Initial password</label><input name="password" type="password" minlength="12" maxlength="128" autocomplete="new-password" required></div>
          <div class="field"><label>Confirm initial password</label><input name="passwordConfirmation" type="password" minlength="12" maxlength="128" autocomplete="new-password" required></div>
          <div class="field"><label>Your current Admin password</label><input name="adminPassword" type="password" autocomplete="current-password" required></div>
          <div class="actions"><button class="btn primary" type="submit">Create member</button></div>
        </form>
        <p class="security-note">The initial password is sent only to Supabase Auth and is never saved in application tables, returned, displayed again, or written to audit events. Share it through an approved internal channel.</p>
      </section>
    `
    : "";
  const userDirectoryPanel = isAdmin
    ? `
      <section class="panel">
        <div class="panel-header">
          <div><h2>Users and roles</h2><p>Admins manage every user. User accounts retain full operational client access.</p></div>
          <input id="settings-user-search" class="search-input" type="search" placeholder="Search users" aria-label="Search users">
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Last sign-in</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>${state.settingsDataLoading && !state.settingsDataLoaded
              ? `<tr><td colspan="6"><div class="empty">Loading users...</div></td></tr>`
              : userRows || `<tr><td colspan="6"><div class="empty">No users found.</div></td></tr>`}</tbody>
          </table>
        </div>
        <div class="pagination">
          <button class="btn secondary small" type="button" data-users-page="${state.settingsUsersPagination.page - 1}" ${state.settingsUsersPagination.hasPrevious && !state.settingsDataLoading ? "" : "disabled"}>Previous</button>
          <span class="muted">Page ${state.settingsUsersPagination.page}</span>
          <button class="btn secondary small" type="button" data-users-page="${state.settingsUsersPagination.page + 1}" ${state.settingsUsersPagination.hasMore && !state.settingsDataLoading ? "" : "disabled"}>Next</button>
        </div>
      </section>
    `
    : "";
  const auditPanel = isAdmin
    ? `
      <section class="panel">
        <div class="panel-header"><div><h2>Security audit events</h2><p>Sanitized authentication, user-management, and security events.</p></div></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Time</th><th>Event</th><th>Status</th><th>Actor</th><th>Message</th></tr></thead>
            <tbody>${state.settingsDataLoading && !state.settingsDataLoaded
              ? `<tr><td colspan="5"><div class="empty">Loading audit events...</div></td></tr>`
              : auditRows || `<tr><td colspan="5"><div class="empty">No audit events found.</div></td></tr>`}</tbody>
          </table>
        </div>
        <div class="pagination">
          <button class="btn secondary small" type="button" data-audit-page="${state.settingsAuditPagination.page - 1}" ${state.settingsAuditPagination.hasPrevious && !state.settingsDataLoading ? "" : "disabled"}>Previous</button>
          <span class="muted">Page ${state.settingsAuditPagination.page}</span>
          <button class="btn secondary small" type="button" data-audit-page="${state.settingsAuditPagination.page + 1}" ${state.settingsAuditPagination.hasMore && !state.settingsDataLoading ? "" : "disabled"}>Next</button>
        </div>
      </section>
    `
    : "";

  renderShell(`
    <div class="grid">
      <section class="grid two">
        <div class="panel">
          <div class="panel-header"><div><h2>Your account</h2><p>Account identity and password management.</p></div></div>
          <div class="evidence-list">
            <div class="evidence-item"><strong>${escapeHtml(currentUser.email || "Local development")}</strong><span>Role: ${escapeHtml(currentUser.role || "admin")}</span></div>
          </div>
          <form id="self-password-form" class="grid">
            <div class="field"><label>Current password</label><input name="currentPassword" type="password" autocomplete="current-password" required></div>
            <div class="field"><label>New password</label><input name="password" type="password" minlength="12" maxlength="128" autocomplete="new-password" required></div>
            <div class="field"><label>Confirm new password</label><input name="passwordConfirmation" type="password" minlength="12" maxlength="128" autocomplete="new-password" required></div>
            <div class="actions"><button class="btn secondary" type="submit">Change password</button></div>
          </form>
          <p class="security-note">After changing your password, you must sign in again.</p>
        </div>
        <div class="panel">
          <div class="panel-header"><div><h2>System connections</h2><p>Status only. Secrets are never displayed.</p></div></div>
          <div class="evidence-list">${settingsIntegrationCards()}</div>
        </div>
      </section>
      ${invitePanel}
      ${userDirectoryPanel}
      ${auditPanel}
    </div>
    ${isAdmin && passwordResetUser ? `
      <div class="modal-backdrop" data-password-modal>
        <section class="password-modal" role="dialog" aria-modal="true" aria-labelledby="password-reset-title">
          <div class="panel-header">
            <div><h2 id="password-reset-title">Reset password</h2><p>Set a new password for ${escapeHtml(passwordResetUser.email)}.</p></div>
            <button class="btn secondary small" type="button" data-cancel-password-reset>Cancel</button>
          </div>
          <form id="managed-password-form" class="grid">
            <div class="field"><label>New password</label><input name="password" type="password" minlength="12" maxlength="128" autocomplete="new-password" required autofocus></div>
            <div class="field"><label>Confirm new password</label><input name="passwordConfirmation" type="password" minlength="12" maxlength="128" autocomplete="new-password" required></div>
            <div class="field"><label>Your current Admin password</label><input name="adminPassword" type="password" autocomplete="current-password" required></div>
            <div class="actions">
              <button class="btn secondary" type="button" data-cancel-password-reset>Cancel</button>
              <button class="btn primary" type="submit">Update password</button>
            </div>
          </form>
          <p class="security-note">The new password is sent only to Supabase Auth and is never stored or displayed by this tool.</p>
        </section>
      </div>
    ` : ""}
  `, "Settings", isAdmin ? "Manage users, roles, security events, and safe connection status." : "Review your account and safe connection status.");

  document.querySelector("#self-password-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const payload = await api("/api/auth/password-change", {
        method: "POST",
        body: JSON.stringify(body)
      });
      state.auth = { required: true, user: null };
      showToast(payload.message || "Password updated. Sign in again.");
      render();
    } catch (error) {
      showToast(errorMessage(error));
    }
  });
  document.querySelector("#invite-user-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api("/api/settings/users/invite", { method: "POST", body: JSON.stringify(body) });
      event.currentTarget.reset();
      await loadSettingsData({ usersPage: 1, auditPage: 1 });
      showToast("Member created.");
    } catch (error) {
      showToast(errorMessage(error));
    }
  });
  document.querySelector("#settings-user-search")?.addEventListener("input", (event) => {
    const search = event.currentTarget.value.trim().toLowerCase();
    document.querySelectorAll("[data-user-row]").forEach((row) => {
      row.hidden = search && !row.dataset.userRow.includes(search);
    });
  });
  document.querySelectorAll("[data-user-role]").forEach((select) => {
    select.addEventListener("change", async () => {
      const managedUser = state.settingsUsers.find((item) => item.id === select.dataset.userRole);
      if (!window.confirm(`Change ${managedUser?.email || "this user"} to ${select.value === "admin" ? "Admin" : "User"}?`)) {
        render();
        return;
      }
      try {
        await api(`/api/settings/users/${select.dataset.userRole}`, {
          method: "PATCH",
          body: JSON.stringify({ role: select.value })
        });
        await loadSettingsData();
        showToast("User role updated.");
      } catch (error) {
        showToast(errorMessage(error));
      }
    });
  });
  document.querySelectorAll("[data-toggle-user]").forEach((button) => {
    button.addEventListener("click", async () => {
      const managedUser = state.settingsUsers.find((item) => item.id === button.dataset.toggleUser);
      const nextActive = button.dataset.nextActive === "true";
      if (!window.confirm(`${nextActive ? "Reactivate" : "Deactivate"} ${managedUser?.email || "this user"}?`)) return;
      try {
        await api(`/api/settings/users/${button.dataset.toggleUser}`, {
          method: "PATCH",
          body: JSON.stringify({ active: nextActive })
        });
        await loadSettingsData();
        showToast(nextActive ? "User reactivated." : "User deactivated.");
      } catch (error) {
        showToast(errorMessage(error));
      }
    });
  });
  document.querySelectorAll("[data-reset-user]").forEach((button) => {
    button.addEventListener("click", () => {
      state.passwordResetUserId = button.dataset.resetUser;
      render();
    });
  });
  document.querySelectorAll("[data-cancel-password-reset]").forEach((button) => {
    button.addEventListener("click", () => {
      state.passwordResetUserId = "";
      render();
    });
  });
  document.querySelector("[data-password-modal]")?.addEventListener("click", (event) => {
    if (event.target !== event.currentTarget) return;
    state.passwordResetUserId = "";
    render();
  });
  document.querySelector("#managed-password-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const payload = await api(`/api/settings/users/${state.passwordResetUserId}/password-reset`, {
        method: "POST",
        body: JSON.stringify(body)
      });
      state.passwordResetUserId = "";
      await loadSettingsData();
      showToast(payload.message || "Password updated.");
    } catch (error) {
      showToast(errorMessage(error));
    }
  });
  document.querySelectorAll("[data-users-page]").forEach((button) => {
    button.addEventListener("click", () => loadSettingsData({
      usersPage: Number(button.dataset.usersPage),
      auditPage: state.settingsAuditPagination.page
    }));
  });
  document.querySelectorAll("[data-audit-page]").forEach((button) => {
    button.addEventListener("click", () => loadSettingsData({
      usersPage: state.settingsUsersPagination.page,
      auditPage: Number(button.dataset.auditPage)
    }));
  });

  if (isAdmin && !state.settingsDataLoaded && !state.settingsDataLoading) {
    loadSettingsData();
  }
}

function renderReports() {
  const rows = state.reports.map((report) => `
    <tr>
      <td><strong>${escapeHtml(report.clientName)}</strong><br><span class="muted">${escapeHtml(report.dateStart)} to ${escapeHtml(report.dateEnd)}</span></td>
      <td>${badge(report.status)}</td>
      <td>${report.metrics.leadsReceived}</td>
      <td>${report.metrics.callsAnswered} / ${report.metrics.callsMissed}</td>
      <td>${report.postedToClickUp ? badge("Posted") : badge("Draft")}</td>
      <td>${new Date(report.createdAt).toLocaleString()}</td>
    </tr>
  `).join("");

  renderShell(`
    <section class="panel">
      <div class="panel-header">
        <div><h2>Saved reports</h2><p>Monthly checks and ClickUp posting history.</p></div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Report</th><th>Status</th><th>Leads</th><th>Answered / Missed</th><th>ClickUp</th><th>Created</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="6"><div class="empty">No reports have been generated yet.</div></td></tr>`}</tbody>
        </table>
      </div>
    </section>
  `, "Reports", "Review generated maintenance checks and posting status.");
}

load().catch((error) => {
  app.innerHTML = `<div class="content"><div class="panel"><h1>Unable to load app</h1><p>${escapeHtml(error.message)}</p></div></div>`;
});

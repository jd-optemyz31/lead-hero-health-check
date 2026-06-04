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
  { id: "routing", label: "Routing Setup", icon: icons.routing },
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
  toast: ""
};

const app = document.querySelector("#app");
const localStoreKey = "leadHeroHealthCheckStore";

function seedStore() {
  return {
    clients: [],
    routingSetups: [],
    blastAnalyses: [],
    reports: [],
    settings: {
      highLevelApiVersion: "2021-07-28",
      clickupConnected: false,
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
    return localApi(path, options, error);
  }
}

function localApi(path, options = {}, originalError) {
  const method = options.method || "GET";
  const store = readLocalStore();
  const body = options.body ? JSON.parse(options.body) : {};
  const now = new Date().toISOString();

  if (method === "GET" && path === "/api/bootstrap") return store;

  if (method === "POST" && path === "/api/clients") {
    if (!body.pitToken) throw new Error("A read-only HighLevel Private Integration Token is required when adding a client.");
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
      tokenPreview: body.pitToken ? `${body.pitToken.slice(0, 4)}...${body.pitToken.slice(-4)}` : "local",
      hasToken: Boolean(body.pitToken),
      createdAt: now,
      updatedAt: now
    };
    store.clients.push(client);
    writeLocalStore(store);
    return { client, clients: store.clients };
  }

  if (method === "POST" && path === "/api/routing") {
    const setup = {
      id: crypto.randomUUID(),
      clientId: body.clientId,
      staffContactId: body.staffContactId || "",
      staffPhone: body.staffPhone,
      expectedPhrase: body.expectedPhrase || "New form submission",
      expectedDelayMinutes: Number(body.expectedDelayMinutes || 10),
      active: true,
      createdAt: now,
      updatedAt: now
    };
    store.routingSetups.push(setup);
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
    totalRepliedContacts: total,
    positiveCount: 9,
    neutralCount: 4,
    negativeCount: 3,
    optOutCount: 1,
    needsReviewCount: 1,
    summary: "18 contacts matched the reply tag during the selected window. 9 appear positive and 1 needs human review.",
    source: "sample",
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

function errorMessage(error) {
  return error.detail ? `${error.message} ${error.detail}` : error.message;
}

function renderShell(content, title, subtitle, actions = "") {
  const authActions = state.auth?.user
    ? `<span class="user-chip">${escapeHtml(state.auth.user.email || "User")} | ${escapeHtml(state.auth.user.role || "viewer")}</span><button class="btn secondary small" type="button" data-logout>Log out</button>`
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
    routing: renderRouting,
    blast: renderBlast,
    monthly: renderMonthly,
    reports: renderReports,
    settings: renderSettings
  };
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
  const rows = state.clients.map((client) => `
    <tr>
      <td><strong>${escapeHtml(client.name)}</strong><br><span class="muted">${escapeHtml(client.timezone)}</span></td>
      <td>${escapeHtml(client.locationId)}</td>
      <td><strong>${escapeHtml(client.formLeadTag || "form lead")}</strong><br><span class="muted">${escapeHtml(client.activePipelineName || client.activePipelineId || "Pipeline not set")} -> ${escapeHtml(client.replyStageName || client.replyStageId || "Reply stage not set")}</span></td>
      <td>${client.hasToken ? badge("Token saved") : badge("Missing token")}</td>
      <td>${client.clickupTaskId ? escapeHtml(client.clickupTaskId) : badge("Missing ClickUp")}</td>
      <td>${new Date(client.updatedAt).toLocaleDateString()}</td>
      <td><button class="btn secondary small" type="button" data-test-highlevel="${client.id}" ${client.hasToken ? "" : "disabled"}>${icons.play} Test</button></td>
    </tr>
  `).join("");

  renderShell(`
    <div class="grid two">
      <section class="panel">
        <div class="panel-header">
          <div><h2>Add or update client</h2><p>Store the read-only HighLevel connection and ClickUp task target.</p></div>
        </div>
        <form id="client-form" class="grid">
          <div class="form-grid">
            <div class="field"><label>Client name</label><input name="name" required placeholder="Client account name"></div>
            <div class="field"><label>Timezone</label><input name="timezone" value="America/New_York"></div>
            <div class="field"><label>HighLevel location ID</label><input name="locationId" required placeholder="Location/sub-account ID"></div>
            <div class="field"><label>ClickUp task ID</label><input name="clickupTaskId" placeholder="ClickUp client task ID"></div>
            <div class="field"><label>Read-only Private Integration Token</label><input name="pitToken" type="password" required placeholder="Encrypted server-side after saving"></div>
            <div class="field"><label>Form lead tag</label><input name="formLeadTag" value="form lead"></div>
            <div class="field"><label>Active pipeline name</label><input name="activePipelineName" placeholder="#1 Active Pipeline"></div>
            <div class="field"><label>Active pipeline ID</label><input name="activePipelineId" placeholder="Optional exact pipeline ID"></div>
            <div class="field"><label>First reply stage name</label><input name="replyStageName" placeholder="Replied / Engaged / Needs Follow Up"></div>
            <div class="field"><label>First reply stage ID</label><input name="replyStageId" placeholder="Optional exact stage ID"></div>
            <div class="field"><label>Reply movement window</label><input name="replyStageWindowHours" type="number" min="1" value="24"></div>
          </div>
          <p class="muted">Automation firing is checked with read-only evidence: form-lead contacts, opportunities in the active pipeline, staff notification messages, and reply-stage movement after the contact replies.</p>
          <p class="muted">Use read-only HighLevel scopes only. Tokens are never shown again after saving and must not be stored in code or Railway variables per client.</p>
          <div class="actions"><button class="btn primary" type="submit">${icons.save} Save client</button></div>
        </form>
      </section>
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
    </div>
  `, "Clients", "Manage account connections and report destinations.");

  document.querySelector("#client-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const payload = await api("/api/clients", { method: "POST", body: JSON.stringify(body) });
      state.clients = payload.clients;
      showToast("Client saved.");
    } catch (error) {
      showToast(errorMessage(error));
    }
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
}

function renderRouting() {
  const rows = state.routingSetups.map((setup) => {
    const client = state.clients.find((item) => item.id === setup.clientId);
    return `
      <tr>
        <td><strong>${escapeHtml(client?.name || "Unknown client")}</strong></td>
        <td>${escapeHtml(setup.staffContactId || "Not provided")}</td>
        <td>${escapeHtml(setup.staffPhone)}</td>
        <td>${escapeHtml(setup.expectedPhrase)}</td>
        <td>${setup.expectedDelayMinutes} min</td>
        <td>${setup.active ? badge("Active") : badge("Inactive")}</td>
      </tr>
    `;
  }).join("");

  renderShell(`
    <div class="grid two">
      <section class="panel">
        <div class="panel-header">
          <div><h2>Routing evidence setup</h2><p>Checks staff-contact conversations for workflow messages containing the expected phrase.</p></div>
        </div>
        <form id="routing-form" class="grid">
          <div class="form-grid">
            <div class="field"><label>Client</label><select name="clientId" required>${requireClientOptions()}</select></div>
            <div class="field"><label>Staff contact ID</label><input name="staffContactId" placeholder="Optional if phone is enough"></div>
            <div class="field"><label>Staff phone number</label><input name="staffPhone" required placeholder="+1 555 010 1400"></div>
            <div class="field"><label>Expected phrase</label><input name="expectedPhrase" value="New form submission"></div>
            <div class="field"><label>Expected delay window</label><select name="expectedDelayMinutes"><option value="5">5 minutes</option><option value="10" selected>10 minutes</option><option value="15">15 minutes</option><option value="30">30 minutes</option></select></div>
          </div>
          <div class="actions"><button class="btn primary" type="submit" ${state.clients.length ? "" : "disabled"}>${icons.save} Save routing setup</button></div>
        </form>
      </section>
      <section class="panel">
        <div class="panel-header">
          <div><h2>Configured staff notifications</h2><p>Routing is checked without needing workflow write access.</p></div>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Client</th><th>Staff contact</th><th>Phone</th><th>Phrase</th><th>Delay</th><th>Status</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="6"><div class="empty">No routing setup has been added yet.</div></td></tr>`}</tbody>
          </table>
        </div>
      </section>
    </div>
  `, "Routing Setup", "Verify new-lead internal notifications using the New form submission phrase.");

  document.querySelector("#routing-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const payload = await api("/api/routing", { method: "POST", body: JSON.stringify(body) });
      state.routingSetups = payload.routingSetups;
      showToast("Routing setup saved.");
    } catch (error) {
      showToast(errorMessage(error));
    }
  });
}

function renderBlast() {
  const latest = state.blastAnalyses[0];
  const rows = latest?.replies?.map((reply) => `
    <tr>
      <td><strong>${escapeHtml(reply.contactName)}</strong><br><span class="muted">${escapeHtml(reply.contactId)}</span></td>
      <td>${escapeHtml(reply.lastReplyDate)}</td>
      <td>${badge(reply.classification)}</td>
      <td>${escapeHtml(reply.summary)}</td>
      <td>${escapeHtml(reply.evidence)}</td>
      <td>${escapeHtml(reply.reviewStatus)}</td>
    </tr>
  `).join("");

  renderShell(`
    <div class="grid">
      <section class="panel">
        <div class="panel-header">
          <div><h2>Run blast analysis anytime</h2><p>Use reply tag + date range to classify responses. This does not launch blasts or message contacts.</p></div>
        </div>
        <form id="blast-form" class="grid">
          <div class="form-grid three">
            <div class="field"><label>Client</label><select name="clientId" required>${requireClientOptions()}</select></div>
            <div class="field"><label>Start date</label><input type="date" name="dateStart" required value="${firstDayOfMonth()}"></div>
            <div class="field"><label>End date</label><input type="date" name="dateEnd" required value="${todayIso()}"></div>
            <div class="field"><label>Reply tag</label><input name="replyTag" required value="Replied to Blast"></div>
            <div class="field"><label>Optional workflow name or ID</label><input name="workflowName" placeholder="BLAST - May Offer"></div>
            <div class="field"><label>Optional blast message phrase</label><input name="messagePhrase" placeholder="Offer, event, or message phrase"></div>
          </div>
          <div class="actions"><button class="btn primary" type="submit" ${state.clients.length ? "" : "disabled"}>${icons.play} Run analysis</button></div>
        </form>
      </section>
      ${latest ? renderBlastResult(latest, rows) : `<div class="empty">No blast analysis has been run yet.</div>`}
    </div>
  `, "Blast Analyzer", "Analyze blast replies independently from the monthly maintenance check.");

  document.querySelector("#blast-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const payload = await api("/api/blasts/run", { method: "POST", body: JSON.stringify(body) });
      state.blastAnalyses = payload.blastAnalyses;
      showToast(`${payload.analysis.source === "live" ? "Live HighLevel" : "Sample"} blast analysis saved.`);
    } catch (error) {
      showToast(errorMessage(error));
    }
  });
}

function renderBlastResult(analysis, rows) {
  return `
    <section class="grid six">
      ${metricCard("Replied contacts", analysis.totalRepliedContacts, analysis.replyTag)}
      ${metricCard("Positive", analysis.positiveCount, "Interested or likely follow-up")}
      ${metricCard("Neutral", analysis.neutralCount, "No clear intent")}
      ${metricCard("Negative", analysis.negativeCount, "Low interest")}
      ${metricCard("Opt-outs", analysis.optOutCount, "Do-not-contact signal")}
      ${metricCard("Needs review", analysis.needsReviewCount, "Human review")}
    </section>
    <section class="panel">
      <div class="panel-header">
        <div><h2>Conversation classifications</h2><p>${escapeHtml(analysis.summary)}</p></div>
        <div class="badge-group">${sourceBadge(analysis.source)}${badge(`${analysis.dateStart} to ${analysis.dateEnd}`)}</div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Contact</th><th>Last reply</th><th>Classification</th><th>Summary</th><th>Evidence</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderMonthly() {
  const latest = state.reports[0];
  const client = state.clients.find((item) => item.id === (latest?.clientId || currentClientId()));
  const blastOptions = [`<option value="">Do not include blast analysis</option>`]
    .concat(state.blastAnalyses.map((item) => `<option value="${item.id}">${escapeHtml(item.clientName)} - ${item.dateStart} to ${item.dateEnd} - ${escapeHtml(item.replyTag)}</option>`))
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

function renderSettings() {
  renderShell(`
    <div class="grid two">
      <section class="panel">
        <div class="panel-header">
          <div><h2>Safety boundary</h2><p>The app is intentionally missing all HighLevel write actions.</p></div>
        </div>
        <div class="evidence-list">
          <div class="evidence-item"><strong>HighLevel mode</strong><span>Read contacts, conversations, calls, workflows, opportunities, tags, and custom fields only.</span></div>
          <div class="evidence-item"><strong>Blocked actions</strong><span>No contact messaging, calls, workflow enrollments, tag updates, opportunity edits, or contact updates.</span></div>
          <div class="evidence-item"><strong>ClickUp mode</strong><span>Only reviewed report comments can be posted to configured ClickUp tasks.</span></div>
        </div>
      </section>
      <section class="panel">
        <div class="panel-header">
          <div><h2>Integration status</h2><p>Server-side environment controls live API posting.</p></div>
        </div>
        <div class="grid">
          ${metricCard("HighLevel API version", state.settings.highLevelApiVersion || "2021-07-28", "Configured server default")}
          ${metricCard("ClickUp connection", state.settings.clickupConnected ? "Connected" : "Local preview", state.settings.clickupConnected ? "CLICKUP_API_TOKEN detected" : "Set CLICKUP_API_TOKEN for live posting")}
          ${metricCard("Storage", state.settings.storage || "Local", state.settings.storage === "Supabase" ? "Supabase-backed production storage" : "Local JSON development storage")}
          ${metricCard("Authentication", state.settings.authRequired ? "Required" : "Local dev", state.settings.authRequired ? "Supabase Auth enforced" : "Auth disabled for local development")}
          ${metricCard("Safe mode", state.settings.safeMode ? "Enabled" : "Disabled", "HighLevel writes are not implemented")}
        </div>
      </section>
    </div>
  `, "Settings", "Review API settings and safety controls.");
}

load().catch((error) => {
  app.innerHTML = `<div class="content"><div class="panel"><h1>Unable to load app</h1><p>${escapeHtml(error.message)}</p></div></div>`;
});


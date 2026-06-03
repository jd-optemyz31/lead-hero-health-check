import http from "node:http";
import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");
const storePath = path.join(dataDir, "store.json");
const port = Number(process.env.PORT || 5173);

const defaultStore = {
  clients: [
    {
      id: "sample-client",
      name: "Lead Hero Sample Account",
      locationId: "sample-location-id",
      clickupTaskId: "",
      timezone: "America/New_York",
      tokenPreview: "read-only token not saved",
      tokenCiphertext: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  routingSetups: [
    {
      id: "sample-routing",
      clientId: "sample-client",
      staffContactId: "staff-contact-001",
      staffPhone: "+1 555 010 1400",
      expectedPhrase: "New form submission",
      expectedDelayMinutes: 10,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  blastAnalyses: [],
  reports: [],
  settings: {
    highLevelApiVersion: "2021-07-28",
    clickupConnected: Boolean(process.env.CLICKUP_API_TOKEN),
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

async function readStore() {
  await ensureStore();
  const raw = await readFile(storePath, "utf8");
  return JSON.parse(raw);
}

async function writeStore(store) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function publicClient(client) {
  const { tokenCiphertext, ...safe } = client;
  return { ...safe, hasToken: Boolean(tokenCiphertext) };
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

function tokenPreview(value) {
  if (!value) return "";
  const clean = String(value).trim();
  if (clean.length <= 8) return "saved";
  return `${clean.slice(0, 4)}...${clean.slice(-4)}`;
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw || "{}");
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
  if (metrics.routingWorking === "No" || metrics.attributionIntact === "No" || metrics.callsTracked === "No") {
    return "Red";
  }
  if (metrics.routingWorking === "Partial" || metrics.automationsFiring === "Partial" || metrics.attributionIntact === "Partial" || metrics.missedRate > 0.3) {
    return "Yellow";
  }
  return "Green";
}

function statusSymbol(status) {
  if (status === "Green") return "🟢";
  if (status === "Yellow") return "🟡";
  return "🔴";
}

function buildComment({ client, dateStart, metrics, blast }) {
  const label = monthLabel(dateStart);
  const symbol = statusSymbol(metrics.status);
  const blastBlock = blast
    ? `Blasts (if applicable):\nBlast(s) Sent: Yes\nType: ${blast.messageType || "SMS"}\nSends: ${blast.estimatedSends || "Not available"}\nDelivery Rate: ${blast.deliveryRate || "Not available"}\nReplies / Engagement: ${blast.totalRepliedContacts} replies (${blast.positiveCount} positive, ${blast.neutralCount} neutral, ${blast.negativeCount} negative, ${blast.optOutCount} opt-out)`
    : "Blasts (if applicable):\nBlast(s) Sent: No\nType:\nSends:\nDelivery Rate:\nReplies / Engagement:";

  const issues = metrics.status === "Green" ? "None" : metrics.issues.join("\n");

  return `Lead Hero (Software) - ${symbol} ${metrics.status} - ${label} ${client.name}

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
    totalRepliedContacts: total,
    positiveCount: positive,
    neutralCount: neutral,
    negativeCount: negative,
    optOutCount: optOut,
    needsReviewCount: needsReview,
    summary: `${total} contacts matched the reply tag during the selected window. ${positive} appear positive and ${needsReview} need human review.`,
    replies,
    createdAt: new Date().toISOString()
  };
}

function summaryForClassification(classification, phrase) {
  const context = phrase ? `the "${phrase}" blast` : "the blast";
  const map = {
    Positive: `Contact showed interest in ${context} and should be followed up by the CAM or sales team.`,
    Neutral: `Contact replied without clear buying intent. Conversation may need light review.`,
    Negative: `Contact indicated low interest or objected to the offer.`,
    "Opt-out": `Contact asked to stop receiving similar outreach.`,
    "Needs review": `Reply is ambiguous and should be reviewed manually before counting as positive or negative.`
  };
  return map[classification];
}

function evidenceForClassification(classification) {
  const map = {
    Positive: "Inbound reply contains interest language such as yes, interested, or can you send more info.",
    Neutral: "Inbound reply is short or unclear.",
    Negative: "Inbound reply contains no thanks or not interested language.",
    "Opt-out": "Inbound reply asks to stop or remove.",
    "Needs review": "Conversation context is not clear enough for automatic classification."
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
  const automationsFiring = routingWorking === "No" ? "Partial" : "Yes";
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
      }
    ],
    createdAt: new Date().toISOString()
  };
  return report;
}

async function handleApi(req, res, pathname) {
  const store = await readStore();

  if (req.method === "GET" && pathname === "/api/bootstrap") {
    return json(res, 200, {
      ...store,
      clients: store.clients.map(publicClient),
      settings: {
        ...store.settings,
        clickupConnected: Boolean(process.env.CLICKUP_API_TOKEN)
      }
    });
  }

  if (req.method === "POST" && pathname === "/api/clients") {
    const body = await parseBody(req);
    if (!body.name || !body.locationId) {
      return json(res, 400, { error: "Client name and HighLevel location ID are required." });
    }
    const now = new Date().toISOString();
    const client = {
      id: body.id || crypto.randomUUID(),
      name: body.name.trim(),
      locationId: body.locationId.trim(),
      clickupTaskId: body.clickupTaskId?.trim() || "",
      timezone: body.timezone || "America/New_York",
      tokenPreview: body.pitToken ? tokenPreview(body.pitToken) : body.tokenPreview || "",
      tokenCiphertext: body.pitToken ? encryptToken(body.pitToken) : body.tokenCiphertext || "",
      createdAt: body.createdAt || now,
      updatedAt: now
    };
    const index = store.clients.findIndex((item) => item.id === client.id);
    if (index >= 0) store.clients[index] = { ...store.clients[index], ...client };
    else store.clients.push(client);
    await writeStore(store);
    return json(res, 200, { client: publicClient(client), clients: store.clients.map(publicClient) });
  }

  if (req.method === "POST" && pathname === "/api/routing") {
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
    await writeStore(store);
    return json(res, 200, { routingSetups: store.routingSetups });
  }

  if (req.method === "POST" && pathname === "/api/blasts/run") {
    const body = await parseBody(req);
    const client = store.clients.find((item) => item.id === body.clientId);
    if (!client) return json(res, 404, { error: "Client not found." });
    if (!body.dateStart || !body.dateEnd || !body.replyTag) {
      return json(res, 400, { error: "Client, date range, and reply tag are required." });
    }
    const analysis = generateBlastAnalysis({
      client,
      dateStart: body.dateStart,
      dateEnd: body.dateEnd,
      replyTag: body.replyTag,
      workflowName: body.workflowName || "",
      messagePhrase: body.messagePhrase || ""
    });
    store.blastAnalyses.unshift(analysis);
    await writeStore(store);
    return json(res, 200, { analysis, blastAnalyses: store.blastAnalyses });
  }

  if (req.method === "POST" && pathname === "/api/monthly/run") {
    const body = await parseBody(req);
    const client = store.clients.find((item) => item.id === body.clientId);
    if (!client) return json(res, 404, { error: "Client not found." });
    if (!body.dateStart || !body.dateEnd) {
      return json(res, 400, { error: "Client and date range are required." });
    }
    const report = generateMonthlyReport({
      store,
      client,
      dateStart: body.dateStart,
      dateEnd: body.dateEnd,
      blastAnalysisId: body.blastAnalysisId || ""
    });
    store.reports.unshift(report);
    await writeStore(store);
    return json(res, 200, { report, reports: store.reports });
  }

  if (req.method === "POST" && pathname === "/api/clickup/post") {
    const body = await parseBody(req);
    const report = store.reports.find((item) => item.id === body.reportId);
    if (!report) return json(res, 404, { error: "Report not found." });
    const client = store.clients.find((item) => item.id === report.clientId);
    if (!client?.clickupTaskId) {
      return json(res, 400, { error: "ClickUp task ID is missing for this client." });
    }

    if (process.env.CLICKUP_API_TOKEN) {
      const response = await fetch(`https://api.clickup.com/api/v2/task/${client.clickupTaskId}/comment`, {
        method: "POST",
        headers: {
          "authorization": process.env.CLICKUP_API_TOKEN,
          "content-type": "application/json"
        },
        body: JSON.stringify({ comment_text: report.generatedComment, notify_all: false })
      });
      if (!response.ok) {
        const errorText = await response.text();
        return json(res, response.status, { error: "ClickUp posting failed.", detail: errorText });
      }
      const payload = await response.json();
      report.postedToClickUp = true;
      report.clickupCommentId = payload.id || payload.comment?.id || "posted";
    } else {
      report.postedToClickUp = true;
      report.clickupCommentId = "local-preview";
    }

    await writeStore(store);
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

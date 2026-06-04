/**
 * AI Classification Diagnostic Script
 * Tests the OpenRouter / OpenAI classification pipeline to find why
 * "OpenRouter returned an invalid classification response" occurs.
 *
 * Usage: node work/diagnose-ai.mjs
 * Requires the same env vars as the server: AI_PROVIDER, OPENROUTER_API_KEY, etc.
 */

import crypto from "node:crypto";

// ── Read env vars the same way server.mjs does ──────────────────────────
const configuredAiBaseUrl = process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE_URL || process.env.AI_BASE_URL || "";
const detectedAiProvider = configuredAiBaseUrl.includes("openrouter") || process.env.OPENROUTER_API_KEY ? "openrouter" : "openai";
const aiProvider = normalizeAiProvider(process.env.AI_PROVIDER || detectedAiProvider);
const aiBaseUrl = normalizeAiBaseUrl(configuredAiBaseUrl || (aiProvider === "openrouter" ? "https://openrouter.ai/api/v1" : "https://api.openai.com/v1"));
const openAiApiKey = aiProvider === "openrouter"
  ? process.env.OPENROUTER_API_KEY || ""
  : process.env.OPENAI_API_KEY || "";
const configuredModel = process.env.OPENAI_MODEL || (aiProvider === "openrouter" ? "openai/gpt-5.4-nano" : "gpt-5.4-nano");
const openAiModel = normalizeOpenAiModel(configuredModel, aiProvider);

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

// ── Print config ────────────────────────────────────────────────────────
console.log("═══════════════════════════════════════════════════════════════");
console.log("  AI CLASSIFICATION DIAGNOSTIC");
console.log("═══════════════════════════════════════════════════════════════");
console.log("");
console.log("Configuration:");
console.log("  AI_PROVIDER env    :", process.env.AI_PROVIDER || "(not set)");
console.log("  Resolved provider  :", aiProvider);
console.log("  OPENAI_BASE_URL env:", process.env.OPENAI_BASE_URL || "(not set)");
console.log("  Resolved base URL  :", aiBaseUrl);
console.log("  OPENAI_MODEL env   :", process.env.OPENAI_MODEL || "(not set)");
console.log("  Resolved model     :", openAiModel);
console.log("  API key present    :", openAiApiKey ? `Yes (${openAiApiKey.slice(0, 6)}...${openAiApiKey.slice(-4)})` : "NO — THIS IS THE PROBLEM");
console.log("  OPENROUTER_API_KEY :", process.env.OPENROUTER_API_KEY ? "set" : "NOT set");
console.log("  OPENAI_API_KEY     :", process.env.OPENAI_API_KEY ? "set" : "NOT set");
console.log("");

if (!openAiApiKey) {
  console.error("❌ No API key found! Set OPENROUTER_API_KEY or OPENAI_API_KEY.");
  process.exit(1);
}

// ── Build the same request payloads as server.mjs ───────────────────────
const schema = {
  type: "object",
  additionalProperties: false,
  required: ["classification", "summary", "evidence", "confidence", "reviewStatus"],
  properties: {
    classification: {
      type: "string",
      enum: ["Positive", "Neutral", "Negative", "Opt-out", "Needs review"]
    },
    summary: { type: "string", description: "One short sentence explaining the reply intent." },
    evidence: { type: "string", description: "A short, non-sensitive excerpt or rationale from the reply." },
    confidence: { type: "number" },
    reviewStatus: { type: "string", enum: ["Auto-classified", "Review needed"] }
  }
};

const systemPrompt = [
  "You classify inbound replies to HighLevel blast campaigns for an internal Lead Hero health check.",
  "Return only structured JSON. Do not recommend sending messages, updating contacts, changing opportunities, or triggering workflows.",
  "Use semantic intent, not a fixed keyword list. Customers can express the same intent in many ways.",
  "Positive means the reply shows interest, asks a buying or service question, asks for next steps, wants details, or indicates willingness to continue.",
  "Negative means the reply clearly declines, rejects, says they are not a fit, or shows no interest.",
  "Opt-out means the reply asks not to be contacted or to unsubscribe.",
  "Neutral means the reply is understandable but does not clearly show interest or rejection.",
  "Needs review means AI cannot explicitly tell whether it is positive, negative, neutral, or opt-out, the reply text is missing, the reply is contradictory, or the evidence is a call record rather than a text reply.",
  "Do not use Needs review when the text clearly supports another label."
].join(" ");

const relaxedSystemPrompt = systemPrompt + " Return a single JSON object with exactly these keys: classification, summary, evidence, confidence, reviewStatus. Do not wrap the JSON in markdown.";

// Use a realistic test reply
const testReply = "Yes can you please tell me more about this thanks, what would be the price for my Audi A10";
const testPhrase = "Save 10% Off on Ceramic coating services this month!";
const userContent = JSON.stringify({
  blastContext: testPhrase,
  latestReplyText: testReply,
  messagesAfterBlast: [
    { direction: "outbound", time: "2026-06-01T10:00:00Z", channel: "SMS", text: testPhrase },
    { direction: "inbound", time: "2026-06-04T07:12:15Z", channel: "SMS", text: testReply }
  ]
});

const headers = {
  "content-type": "application/json",
  authorization: `Bearer ${openAiApiKey}`
};
const referer = process.env.OPENROUTER_SITE_URL || "";
const appName = process.env.OPENROUTER_APP_NAME || "Lead Hero Health Check Tool";
if (referer) headers["HTTP-Referer"] = referer;
if (appName) {
  headers["X-Title"] = appName;
  headers["X-OpenRouter-Title"] = appName;
}

// ── Classification label validation (same as server.mjs) ────────────────
const blastClassificationLabels = new Set(["Positive", "Neutral", "Negative", "Opt-out", "Needs review"]);
const blastClassificationAliases = new Map([
  ["positive", "Positive"], ["interested", "Positive"], ["interest", "Positive"],
  ["neutral", "Neutral"],
  ["negative", "Negative"], ["not_interested", "Negative"], ["not interested", "Negative"],
  ["opt-out", "Opt-out"], ["opt out", "Opt-out"], ["optout", "Opt-out"], ["opt_out", "Opt-out"],
  ["needs review", "Needs review"], ["needs_review", "Needs review"]
]);

function normalizeBlastClassification(value) {
  const label = String(value || "").trim();
  if (blastClassificationLabels.has(label)) return label;
  const normalized = label.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return blastClassificationAliases.get(normalized) || null;
}

function hasValidAiClassification(parsed) {
  return Boolean(parsed && normalizeBlastClassification(parsed.classification));
}

// ── Response parsing (same as server.mjs) ───────────────────────────────
function extractChatCompletionText(payload) {
  const message = payload?.choices?.[0]?.message || {};
  const content = message.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((item) => item.text || item.content || "").filter(Boolean).join("\n").trim();
  }
  return "";
}

function extractChatCompletionJson(payload) {
  const message = payload?.choices?.[0]?.message || {};
  if (message.parsed && typeof message.parsed === "object") return message.parsed;
  if (message.refusal) return null;
  return parseJsonObject(extractChatCompletionText(payload));
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

// ── TEST 1: Strict structured output request ────────────────────────────
async function testStrict() {
  console.log("───────────────────────────────────────────────────────────────");
  console.log("TEST 1: STRICT structured output request");
  console.log("───────────────────────────────────────────────────────────────");

  const body = {
    model: openAiModel,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent }
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
    max_tokens: 250
  };

  const endpoint = aiProvider === "openrouter"
    ? `${aiBaseUrl}/chat/completions`
    : `${aiBaseUrl}/responses`;

  console.log(`  Endpoint: ${endpoint}`);
  console.log(`  Model   : ${openAiModel}`);
  console.log("");

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000)
    });

    console.log(`  HTTP status : ${response.status} ${response.statusText}`);
    console.log(`  Content-Type: ${response.headers.get("content-type")}`);

    const raw = await response.text();
    console.log(`  Raw response length: ${raw.length} chars`);
    console.log("");
    console.log("  RAW RESPONSE BODY:");
    console.log("  " + raw.slice(0, 2000));
    console.log("");

    if (!response.ok) {
      console.log("  ❌ HTTP error — strict request failed (expected if model doesn't support strict json_schema)");
      const parsed = parseJsonObject(raw);
      if (parsed?.error) {
        console.log(`  Error code: ${parsed.error.code || "(none)"}`);
        console.log(`  Error type: ${parsed.error.type || "(none)"}`);
        console.log(`  Error msg : ${parsed.error.message || "(none)"}`);
      }
      return null;
    }

    const data = parseJsonObject(raw);
    if (!data) {
      console.log("  ❌ Could not parse response as JSON");
      return null;
    }

    console.log("  PARSED RESPONSE STRUCTURE:");
    console.log(`  data.id      : ${data.id || "(missing)"}`);
    console.log(`  data.model   : ${data.model || "(missing)"}`);
    console.log(`  data.choices  : ${data.choices ? `array[${data.choices.length}]` : "(missing)"}`);
    if (data.choices?.[0]) {
      const choice = data.choices[0];
      console.log(`  choice.finish_reason: ${choice.finish_reason || "(missing)"}`);
      console.log(`  choice.message      : ${typeof choice.message}`);
      if (choice.message) {
        console.log(`    .role     : ${choice.message.role || "(missing)"}`);
        console.log(`    .content  : ${typeof choice.message.content} → ${JSON.stringify(choice.message.content)?.slice(0, 300)}`);
        console.log(`    .parsed   : ${typeof choice.message.parsed} → ${JSON.stringify(choice.message.parsed)?.slice(0, 300)}`);
        console.log(`    .refusal  : ${choice.message.refusal}`);
      }
    }
    console.log("");

    const extracted = extractChatCompletionJson(data);
    console.log("  EXTRACTED JSON:");
    console.log(`  ${JSON.stringify(extracted, null, 2)}`);
    console.log("");

    const valid = hasValidAiClassification(extracted);
    console.log(`  hasValidAiClassification: ${valid}`);
    if (extracted) {
      console.log(`  classification raw      : "${extracted.classification}"`);
      console.log(`  normalized              : "${normalizeBlastClassification(extracted.classification)}"`);
    }
    console.log(valid ? "  ✅ Strict request PASSED" : "  ❌ Strict request returned data but classification is INVALID");
    return extracted;
  } catch (error) {
    console.log(`  ❌ Exception: ${error.message}`);
    return null;
  }
}

// ── TEST 2: Relaxed json_object request ─────────────────────────────────
async function testRelaxed() {
  console.log("");
  console.log("───────────────────────────────────────────────────────────────");
  console.log("TEST 2: RELAXED json_object request");
  console.log("───────────────────────────────────────────────────────────────");

  const body = {
    model: openAiModel,
    messages: [
      { role: "system", content: relaxedSystemPrompt },
      { role: "user", content: userContent }
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 250
  };

  const endpoint = `${aiBaseUrl}/chat/completions`;
  console.log(`  Endpoint: ${endpoint}`);
  console.log(`  Model   : ${openAiModel}`);
  console.log("");

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000)
    });

    console.log(`  HTTP status : ${response.status} ${response.statusText}`);

    const raw = await response.text();
    console.log(`  Raw response length: ${raw.length} chars`);
    console.log("");
    console.log("  RAW RESPONSE BODY:");
    console.log("  " + raw.slice(0, 2000));
    console.log("");

    if (!response.ok) {
      console.log("  ❌ HTTP error — relaxed request also failed");
      return null;
    }

    const data = parseJsonObject(raw);
    if (!data) {
      console.log("  ❌ Could not parse response as JSON");
      return null;
    }

    console.log("  PARSED RESPONSE STRUCTURE:");
    console.log(`  data.choices : ${data.choices ? `array[${data.choices.length}]` : "(missing)"}`);
    if (data.choices?.[0]?.message) {
      const msg = data.choices[0].message;
      console.log(`    .content type: ${typeof msg.content}`);
      console.log(`    .content     : ${JSON.stringify(msg.content)?.slice(0, 500)}`);
      console.log(`    .parsed      : ${JSON.stringify(msg.parsed)?.slice(0, 300)}`);
    }
    console.log("");

    const extracted = extractChatCompletionJson(data);
    console.log("  EXTRACTED JSON:");
    console.log(`  ${JSON.stringify(extracted, null, 2)}`);
    console.log("");

    const valid = hasValidAiClassification(extracted);
    console.log(`  hasValidAiClassification: ${valid}`);
    if (extracted) {
      console.log(`  classification raw      : "${extracted.classification}"`);
      console.log(`  normalized              : "${normalizeBlastClassification(extracted.classification)}"`);
    }
    console.log(valid ? "  ✅ Relaxed request PASSED" : "  ❌ Relaxed request returned data but classification is INVALID");
    return extracted;
  } catch (error) {
    console.log(`  ❌ Exception: ${error.message}`);
    return null;
  }
}

// ── TEST 3: Plain text request (no response_format) ─────────────────────
async function testPlain() {
  console.log("");
  console.log("───────────────────────────────────────────────────────────────");
  console.log("TEST 3: PLAIN text request (no response_format — to verify model works at all)");
  console.log("───────────────────────────────────────────────────────────────");

  const body = {
    model: openAiModel,
    messages: [
      { role: "system", content: relaxedSystemPrompt },
      { role: "user", content: userContent }
    ],
    temperature: 0,
    max_tokens: 250
  };

  const endpoint = `${aiBaseUrl}/chat/completions`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000)
    });

    console.log(`  HTTP status: ${response.status}`);
    const raw = await response.text();
    console.log(`  Raw response length: ${raw.length} chars`);
    console.log("");
    console.log("  RAW RESPONSE BODY:");
    console.log("  " + raw.slice(0, 2000));
    console.log("");

    if (!response.ok) {
      console.log("  ❌ Even plain request failed — model or API key issue");
      return null;
    }

    const data = parseJsonObject(raw);
    const text = extractChatCompletionText(data);
    console.log("  EXTRACTED TEXT:");
    console.log(`  ${text}`);
    console.log("");

    const extracted = parseJsonObject(text);
    console.log("  PARSED AS JSON:");
    console.log(`  ${JSON.stringify(extracted, null, 2)}`);

    if (extracted) {
      const valid = hasValidAiClassification(extracted);
      console.log(`  hasValidAiClassification: ${valid}`);
      console.log(`  classification raw      : "${extracted.classification}"`);
      console.log(valid ? "  ✅ Plain request PASSED" : "  ❌ Model responded but classification label is not recognized");
    } else {
      console.log("  ⚠️ Model response was not parseable as JSON — model might not follow JSON instructions");
    }
    return extracted;
  } catch (error) {
    console.log(`  ❌ Exception: ${error.message}`);
    return null;
  }
}

// ── Run ─────────────────────────────────────────────────────────────────
async function main() {
  const r1 = await testStrict();
  const r2 = await testRelaxed();
  const r3 = await testPlain();

  console.log("");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  DIAGNOSIS SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Strict request   : ${r1 && hasValidAiClassification(r1) ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`  Relaxed request  : ${r2 && hasValidAiClassification(r2) ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`  Plain request    : ${r3 && hasValidAiClassification(r3) ? "✅ PASS" : "❌ FAIL"}`);
  console.log("");

  if (!r1 && !r2 && !r3) {
    console.log("  🔴 All requests failed — check API key, model ID, and network.");
  } else if (r3 && !r2 && !r1) {
    console.log("  🟡 Model works but does NOT support response_format.");
    console.log("     FIX: Remove response_format and parse JSON from plain text.");
  } else if (r2 && !r1) {
    console.log("  🟢 Relaxed request works but strict does not — this is expected.");
    console.log("     The server code should handle this. Check if relaxed parsing is correct.");
  } else if (r3 && !hasValidAiClassification(r3)) {
    console.log("  🟡 Model responds but uses unexpected classification labels.");
    console.log("     FIX: Add the labels used by the model to the normalization aliases.");
  }
  console.log("");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

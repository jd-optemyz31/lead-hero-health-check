import test from "node:test";
import assert from "node:assert/strict";

import {
  applyBlastClassificationGuards,
  blastContactAnalysisState,
  classifyConversationByRules,
  contactDndStatus,
  selectAnchoredBlastThread
} from "../src/blast-thread.mjs";

const options = {
  messagePhrase: "summer offer",
  textOf: (message) => message.text || "",
  timestampOf: (message) => message.time,
  isOutbound: (message) => message.direction === "outbound",
  isInbound: (message) => message.direction === "inbound",
  toThreadMessage: (message) => ({ ...message })
};

test("keeps every message from the matched blast onward", () => {
  const messages = [
    { direction: "inbound", time: 1, text: "Earlier unrelated message" },
    { direction: "outbound", time: 2, text: "Our SUMMER OFFER starts today" },
    ...Array.from({ length: 14 }, (_, index) => ({
      direction: index % 2 ? "outbound" : "inbound",
      time: index + 3,
      text: `Post-blast message ${index + 1}`
    }))
  ];

  const result = selectAnchoredBlastThread(messages, options);

  assert.equal(result.blastFound, true);
  assert.equal(result.thread.length, 15);
  assert.equal(result.thread[0].text, "Our SUMMER OFFER starts today");
  assert.equal(result.thread.at(-1).text, "Post-blast message 14");
  assert.equal(result.latest.text, "Post-blast message 13");
  assert.equal(result.matchedBlast.text, "Our SUMMER OFFER starts today");
});

test("does not return an unanchored date-window fallback", () => {
  const messages = [
    { direction: "outbound", time: 1, text: "A different campaign" },
    { direction: "inbound", time: 2, text: "Interested" }
  ];

  const result = selectAnchoredBlastThread(messages, options);

  assert.equal(result.blastFound, false);
  assert.deepEqual(result.thread, []);
  assert.equal(result.latest, undefined);
  assert.equal(result.matchedBlast, undefined);
});

test("reports a matched blast with no later inbound reply without returning a thread", () => {
  const messages = [
    { direction: "outbound", time: 1, text: "Summer offer starts today" },
    { direction: "outbound", time: 2, text: "Following up" }
  ];

  const result = selectAnchoredBlastThread(messages, options);

  assert.equal(result.blastFound, true);
  assert.deepEqual(result.thread, []);
  assert.equal(result.latest, undefined);
  assert.equal(result.matchedBlast.text, "Summer offer starts today");
});

test("classifies the complete conversation as positive when earlier customer interest is clear", () => {
  const result = classifyConversationByRules([
    { direction: "outbound", channel: "SMS", text: "Summer offer starts today" },
    { direction: "inbound", channel: "SMS", text: "Yes, can you send me pricing and details?" },
    { direction: "outbound", channel: "SMS", text: "Absolutely." },
    { direction: "inbound", channel: "SMS", text: "Okay thanks" }
  ]);

  assert.equal(result.classification, "Positive");
  assert.equal(result.signalType, "positive");
});

test("treats a temporary deferral as neutral rather than negative", () => {
  const result = classifyConversationByRules([
    { direction: "outbound", channel: "SMS", text: "Summer offer starts today" },
    { direction: "inbound", channel: "SMS", text: "I am not ready right now, maybe later." }
  ]);

  assert.equal(result.classification, "Neutral");
  assert.equal(result.signalType, "temporary-neutral");
});

test("treats acknowledgements and identity questions as neutral instead of needs review", () => {
  for (const text of ["Okay thanks", "Who is this?"]) {
    const result = classifyConversationByRules([
      { direction: "outbound", channel: "SMS", text: "Summer offer starts today" },
      { direction: "inbound", channel: "SMS", text }
    ]);

    assert.equal(result.classification, "Neutral");
    assert.equal(result.signalMatched, true);
  }
});

test("classifies a clear decline as negative", () => {
  const result = classifyConversationByRules([
    { direction: "outbound", channel: "SMS", text: "Summer offer starts today" },
    { direction: "inbound", channel: "SMS", text: "No thanks, I am not interested." }
  ]);

  assert.equal(result.classification, "Negative");
});

test("gives opt-out precedence across the complete conversation", () => {
  const result = classifyConversationByRules([
    { direction: "outbound", channel: "SMS", text: "Summer offer starts today" },
    { direction: "inbound", channel: "SMS", text: "Can you send pricing?" },
    { direction: "inbound", channel: "SMS", text: "Actually, remove me from this list." }
  ]);

  assert.equal(result.classification, "Opt-out");
});

test("does not treat stop by language as an opt-out", () => {
  const result = classifyConversationByRules([
    { direction: "outbound", channel: "SMS", text: "Summer offer starts today" },
    { direction: "inbound", channel: "SMS", text: "Sounds good. I'll stop by tomorrow.." }
  ]);

  assert.equal(result.classification, "Positive");
  assert.equal(result.signalType, "positive-visit");
});

test("treats an exact STOP reply as an opt-out", () => {
  const result = classifyConversationByRules([
    { direction: "outbound", channel: "SMS", text: "Summer offer starts today" },
    { direction: "inbound", channel: "SMS", text: "STOP!" }
  ]);

  assert.equal(result.classification, "Opt-out");
});

test("treats an unambiguous stop-contact request as an opt-out", () => {
  const result = classifyConversationByRules([
    { direction: "outbound", channel: "SMS", text: "Summer offer starts today" },
    { direction: "inbound", channel: "SMS", text: "Please stop texting me." }
  ]);

  assert.equal(result.classification, "Opt-out");
});

test("reads overall and channel-specific HighLevel DND state without mutating the contact", () => {
  assert.deepEqual(contactDndStatus({ dnd: true }, "SMS"), {
    isDnd: true,
    channel: "SMS",
    source: "overall"
  });
  assert.equal(contactDndStatus({ dndSettings: { SMS: { status: "active" } } }, "TYPE_SMS").isDnd, true);
  assert.equal(contactDndStatus({ dndSettings: { SMS: { status: "permanent" } } }, "SMS").isDnd, true);
  assert.equal(contactDndStatus({ dndSettings: { SMS: { status: "inactive" } } }, "SMS").isDnd, false);
  assert.equal(contactDndStatus({ dndSettings: { Email: { status: "active" } } }, "SMS").isDnd, false);
});

test("treats different-service-only interest as neutral for the promoted blast", () => {
  const guarded = applyBlastClassificationGuards({
    classification: "Positive",
    serviceRelevance: "Different service",
    ruleResult: { classification: "Positive", signalMatched: true, signalType: "positive" }
  });

  assert.equal(guarded, "Neutral");
});

test("prevents AI from treating a clear stop-by visit as an opt-out", () => {
  const guarded = applyBlastClassificationGuards({
    classification: "Opt-out",
    serviceRelevance: "Promoted service",
    ruleResult: { classification: "Positive", signalMatched: true, signalType: "positive-visit" }
  });

  assert.equal(guarded, "Positive");
});

test("keeps clear promoted-service interest positive across the conversation", () => {
  const guarded = applyBlastClassificationGuards({
    classification: "Neutral",
    serviceRelevance: "Promoted service",
    ruleResult: { classification: "Positive", signalMatched: true, signalType: "positive" }
  });

  assert.equal(guarded, "Positive");
});

test("keeps explicit opt-out precedence over service relevance", () => {
  const guarded = applyBlastClassificationGuards({
    classification: "Positive",
    serviceRelevance: "Promoted service",
    ruleResult: { classification: "Opt-out", signalMatched: true, signalType: "opt-out" }
  });

  assert.equal(guarded, "Opt-out");
});

test("accounts for every tagged contact without classifying unanchored conversations", () => {
  assert.deepEqual(blastContactAnalysisState({ blastFound: false }), {
    eligible: false,
    status: "No blast match",
    reason: "The contact has the reply tag, but the required outbound blast phrase was not found in the exported date range."
  });
  assert.deepEqual(blastContactAnalysisState({ blastFound: true }), {
    eligible: false,
    status: "No post-blast reply",
    reason: "The outbound blast matched, but no later inbound customer message was found in the exported date range."
  });
  assert.deepEqual(blastContactAnalysisState({ blastFound: true, latest: { id: "reply" } }), {
    eligible: true,
    status: "Analyzed",
    reason: ""
  });
});

test("uses needs review only when no usable inbound text exists", () => {
  const result = classifyConversationByRules([
    { direction: "outbound", channel: "SMS", text: "Summer offer starts today" },
    { direction: "inbound", channel: "Call", text: "Inbound call record" }
  ]);

  assert.equal(result.classification, "Needs review");
  assert.equal(result.signalType, "call-only");
});

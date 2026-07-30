export function selectAnchoredBlastThread(messages, {
  messagePhrase,
  textOf,
  timestampOf,
  isOutbound,
  isInbound,
  toThreadMessage
}) {
  const phrase = String(messagePhrase || "").trim().toLowerCase();
  if (!phrase || !messages.length) {
    return { thread: [], latest: undefined, matchedBlast: undefined, blastFound: false };
  }

  const blastMessages = [...messages]
    .reverse()
    .filter((message) => isOutbound(message) && textOf(message).toLowerCase().includes(phrase));

  for (const blastMessage of blastMessages) {
    const blastTimestamp = timestampOf(blastMessage);
    const postBlastMessages = messages.filter((message) => {
      const messageTimestamp = timestampOf(message);
      return !blastTimestamp || !messageTimestamp || messageTimestamp >= blastTimestamp;
    });
    const latest = [...postBlastMessages].reverse().find((message) => isInbound(message));
    if (latest) {
      return {
        thread: postBlastMessages.map(toThreadMessage),
        latest,
        matchedBlast: toThreadMessage(blastMessage),
        blastFound: true
      };
    }
  }

  return {
    thread: [],
    latest: undefined,
    matchedBlast: blastMessages[0] ? toThreadMessage(blastMessages[0]) : undefined,
    blastFound: blastMessages.length > 0
  };
}

const explicitOptOutPattern = /\b(unsubscribe|remove me(?: from (?:this|your) (?:list|messages?))?|do not (?:contact|text|message|call) me|don't (?:contact|text|message|call) me|take me off(?: (?:this|your) (?:list|messages?))?|opt me out|stop (?:texting|messaging|contacting|calling|sending) me|stop (?:all )?(?:messages?|texts?|sms))\b/i;
const temporaryNeutralPattern = /\b(not ready(?: right)? now|not now|maybe later|another time|check back later|reach out later)\b/i;
const negativePattern = /\b(no thanks|no thank you|not interested|not a fit|no interest|already have|too expensive|pass|do not need|don't need|no longer interested)\b/i;
const positivePattern = /\b(yes|sure|sounds good|please send|send me|tell me more|more information|details|pricing|price|quote|cost|how much|call me|book|schedule|next steps?|move forward|proceed|i(?:'m| am) interested|we(?:'re| are) interested|interested in|i(?:'ll| will) stop by|stop by (?:today|tomorrow|later)|come by|drop by|see you (?:today|tomorrow|then))\b/i;
const positiveVisitPattern = /\b(i(?:'ll| will) stop by|stop by (?:today|tomorrow|later)|come by|drop by|see you (?:today|tomorrow|then))\b/i;
const explicitNeutralPattern = /\b(ok|okay|thanks|thank you|who is this|what is this about|received|got it)\b/i;

function latestMatchingText(messages, pattern) {
  return [...messages].reverse().find((message) => pattern.test(message.text))?.text || "";
}

function normalizedOptOutText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[.!?,;:'"()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isExplicitOptOutText(text) {
  const normalized = normalizedOptOutText(text);
  if (["stop", "please stop", "stop please"].includes(normalized)) return true;
  return explicitOptOutPattern.test(normalized);
}

function normalizeDndChannel(channel) {
  const normalized = String(channel || "SMS")
    .replace(/^TYPE_/i, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
  const channelMap = {
    sms: "SMS",
    text: "SMS",
    email: "Email",
    call: "Call",
    phone: "Call",
    voicemail: "Voicemail",
    whatsapp: "WhatsApp",
    gmb: "GMB",
    googlemybusiness: "GMB",
    fb: "FB",
    facebook: "FB"
  };
  return channelMap[normalized] || "SMS";
}

export function contactDndStatus(contact = {}, channel = "SMS") {
  const normalizedChannel = normalizeDndChannel(channel);
  if (contact?.dnd === true) {
    return { isDnd: true, channel: normalizedChannel, source: "overall" };
  }

  const settings = contact?.dndSettings && typeof contact.dndSettings === "object"
    ? contact.dndSettings
    : {};
  const settingEntry = Object.entries(settings).find(([key]) => normalizeDndChannel(key) === normalizedChannel)?.[1];
  const status = String(settingEntry?.status || "").trim().toLowerCase();
  const isDnd = status === "active" || status === "permanent";
  return {
    isDnd,
    channel: normalizedChannel,
    source: isDnd ? "channel" : "none"
  };
}

export function applyBlastClassificationGuards({
  classification,
  serviceRelevance = "Unclear",
  ruleResult = {}
}) {
  if (ruleResult.classification === "Opt-out") return "Opt-out";
  if (serviceRelevance === "Different service" && classification !== "Opt-out") return "Neutral";
  if (classification === "Opt-out" && ruleResult.signalType === "positive-visit") return "Positive";
  if (
    serviceRelevance === "Promoted service"
    && ruleResult.classification === "Positive"
    && classification !== "Opt-out"
  ) {
    return "Positive";
  }
  if (classification === "Needs review" && ruleResult.signalMatched) return ruleResult.classification;
  if (classification === "Negative" && ruleResult.signalType === "temporary-neutral") return "Neutral";
  return classification;
}

export function blastContactAnalysisState({ blastFound = false, latest } = {}) {
  if (!blastFound) {
    return {
      eligible: false,
      status: "No blast match",
      reason: "The contact has the reply tag, but the required outbound blast phrase was not found in the exported date range."
    };
  }
  if (!latest) {
    return {
      eligible: false,
      status: "No post-blast reply",
      reason: "The outbound blast matched, but no later inbound customer message was found in the exported date range."
    };
  }
  return {
    eligible: true,
    status: "Analyzed",
    reason: ""
  };
}

export function classifyConversationByRules(thread) {
  const inboundMessages = thread
    .filter((message) => String(message.direction || "").toLowerCase() === "inbound")
    .map((message) => ({
      text: String(message.text || "").replace(/\s+/g, " ").trim(),
      isCall: String(message.channel || "").toLowerCase().includes("call")
    }));
  const readableTextMessages = inboundMessages.filter((message) => message.text && !message.isCall);

  if (!readableTextMessages.length) {
    return {
      classification: "Needs review",
      evidenceText: "",
      signalMatched: false,
      signalType: inboundMessages.some((message) => message.isCall) ? "call-only" : "missing-text"
    };
  }

  const optOutEvidence = [...readableTextMessages]
    .reverse()
    .find((message) => isExplicitOptOutText(message.text))?.text || "";
  if (optOutEvidence) {
    return { classification: "Opt-out", evidenceText: optOutEvidence, signalMatched: true, signalType: "opt-out" };
  }

  const positiveMessages = readableTextMessages.filter((message) => positivePattern.test(message.text) && !negativePattern.test(message.text));
  const positiveEvidence = latestMatchingText(positiveMessages, positivePattern);
  if (positiveEvidence) {
    return {
      classification: "Positive",
      evidenceText: positiveEvidence,
      signalMatched: true,
      signalType: positiveVisitPattern.test(positiveEvidence) ? "positive-visit" : "positive"
    };
  }

  const temporaryNeutralEvidence = latestMatchingText(readableTextMessages, temporaryNeutralPattern);
  if (temporaryNeutralEvidence) {
    return { classification: "Neutral", evidenceText: temporaryNeutralEvidence, signalMatched: true, signalType: "temporary-neutral" };
  }

  const negativeEvidence = latestMatchingText(readableTextMessages, negativePattern);
  if (negativeEvidence) {
    return { classification: "Negative", evidenceText: negativeEvidence, signalMatched: true, signalType: "negative" };
  }

  const explicitNeutralEvidence = latestMatchingText(readableTextMessages, explicitNeutralPattern);
  if (explicitNeutralEvidence) {
    return { classification: "Neutral", evidenceText: explicitNeutralEvidence, signalMatched: true, signalType: "neutral" };
  }

  return {
    classification: "Neutral",
    evidenceText: readableTextMessages.at(-1)?.text || "",
    signalMatched: false,
    signalType: "neutral"
  };
}

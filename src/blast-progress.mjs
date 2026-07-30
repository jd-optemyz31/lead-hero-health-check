const classificationVerbs = [
  "[Reading reply intent...]",
  "[Checking service relevance...]",
  "[Weighing conversation signals...]",
  "[Sorting reply sentiment...]"
];

function boundedPercent(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function ratio(done, total) {
  const safeTotal = Math.max(0, Number(total) || 0);
  if (!safeTotal) return 1;
  return Math.max(0, Math.min(1, (Number(done) || 0) / safeTotal));
}

export function blastProgress(phase, {
  done = 0,
  total = 0,
  count = 0,
  mode = "",
  detail = ""
} = {}) {
  const safeDone = Math.max(0, Number(done) || 0);
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeCount = Math.max(0, Number(count) || 0);
  let percent = 2;
  let verb = "[Calibrating the blast scan...]";
  let phaseLabel = "Preparing";
  let progressDetail = detail || "Preparing a read-only HighLevel analysis.";

  if (phase === "contacts") {
    percent = 5 + Math.min(20, (safeCount / 50_000) * 20);
    verb = mode === "cursor"
      ? "[Sweeping contact pages...]"
      : "[Filtering reply-tag candidates...]";
    phaseLabel = "Contact scan";
    progressDetail = detail || (mode === "cursor"
      ? `${safeCount.toLocaleString()} contacts inspected with read-only cursor pagination.`
      : `${safeCount.toLocaleString()} reply-tag candidate contacts loaded.`);
  } else if (phase === "messages") {
    percent = 25 + ratio(safeDone, safeTotal) * 25;
    verb = "[Gathering conversation trails...]";
    phaseLabel = "Conversation export";
    progressDetail = detail || `${Math.min(safeDone, safeTotal)} of ${safeTotal} date windows exported.`;
  } else if (phase === "matching") {
    percent = 53;
    verb = "[Anchoring outbound blast messages...]";
    phaseLabel = "Blast matching";
    progressDetail = detail || `Matching the required phrase for ${safeCount.toLocaleString()} tagged contacts.`;
  } else if (phase === "classifying") {
    percent = 56 + ratio(safeDone, safeTotal) * 39;
    const verbIndex = Math.floor(safeDone / Math.max(1, Math.ceil(safeTotal / classificationVerbs.length)));
    verb = classificationVerbs[Math.min(classificationVerbs.length - 1, verbIndex)];
    phaseLabel = "Reply classification";
    progressDetail = detail || (safeTotal
      ? `${Math.min(safeDone, safeTotal).toLocaleString()} of ${safeTotal.toLocaleString()} tagged contacts reviewed.`
      : "No tagged contacts require classification.");
  } else if (phase === "saving") {
    percent = 98;
    verb = "[Polishing the final analysis...]";
    phaseLabel = "Saving";
    progressDetail = detail || "Saving the completed, client-scoped analysis.";
  } else if (phase === "done") {
    percent = 100;
    verb = "[Blast analysis complete.]";
    phaseLabel = "Complete";
    progressDetail = detail || `${safeDone.toLocaleString()} tagged contacts accounted for.`;
  }

  return {
    phase,
    phaseLabel,
    verb,
    detail: progressDetail,
    percent: boundedPercent(percent),
    done: safeDone,
    total: safeTotal,
    count: safeCount
  };
}

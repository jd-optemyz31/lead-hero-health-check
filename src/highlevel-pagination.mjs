export async function collectPagedHighLevelItems({
  fetchPage,
  extractItems,
  itemId,
  pageSize = 100,
  maxPages = 1,
  failOnPageLimit = false,
  pageLimitErrorMessage = "HighLevel pagination reached its configured safety limit."
}) {
  const items = [];
  const seenIds = new Set();
  let lastPageItemCount = 0;
  let pagesFetched = 0;

  for (let page = 1; page <= maxPages; page += 1) {
    const payload = await fetchPage(page, pageSize);
    const pageItems = extractItems(payload);
    lastPageItemCount = pageItems.length;
    pagesFetched = page;

    for (const item of pageItems) {
      const id = itemId(item);
      if (id && seenIds.has(id)) continue;
      if (id) seenIds.add(id);
      items.push(item);
    }

    if (pageItems.length < pageSize) break;
  }

  if (failOnPageLimit && pagesFetched === maxPages && lastPageItemCount >= pageSize) {
    throw new Error(pageLimitErrorMessage);
  }

  return items;
}

export function dailyUtcWindows(dateStart, dateEnd) {
  if (!dateStart || !dateEnd) return [{ startDate: "", endDate: "" }];

  const rangeStart = Date.parse(`${dateStart}T00:00:00.000Z`);
  const rangeEnd = Date.parse(`${dateEnd}T23:59:59.999Z`);
  if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd) || rangeStart > rangeEnd) {
    throw new Error("A valid date range is required.");
  }

  const windows = [];
  const dayMilliseconds = 86_400_000;
  for (let start = rangeStart; start <= rangeEnd; start += dayMilliseconds) {
    windows.push({
      startDate: new Date(start).toISOString(),
      endDate: new Date(Math.min(rangeEnd, start + dayMilliseconds - 1)).toISOString()
    });
  }
  return windows;
}

import test from "node:test";
import assert from "node:assert/strict";

import { collectPagedHighLevelItems, dailyUtcWindows } from "../src/highlevel-pagination.mjs";

test("collects every contact page until HighLevel returns a short page", async () => {
  const pagesRequested = [];
  const pages = {
    1: [{ id: "one" }, { id: "two" }],
    2: [{ id: "three" }]
  };

  const items = await collectPagedHighLevelItems({
    pageSize: 2,
    maxPages: 10,
    itemId: (item) => item.id,
    extractItems: (payload) => payload.contacts,
    fetchPage: async (page) => {
      pagesRequested.push(page);
      return { contacts: pages[page] || [] };
    }
  });

  assert.deepEqual(pagesRequested, [1, 2]);
  assert.deepEqual(items.map((item) => item.id), ["one", "two", "three"]);
});

test("deduplicates contacts repeated across HighLevel pages", async () => {
  const pages = {
    1: [{ id: "one" }, { id: "two" }],
    2: [{ id: "two" }, { id: "three" }],
    3: []
  };

  const items = await collectPagedHighLevelItems({
    pageSize: 2,
    maxPages: 3,
    itemId: (item) => item.id,
    extractItems: (payload) => payload.contacts,
    fetchPage: async (page) => ({ contacts: pages[page] })
  });

  assert.deepEqual(items.map((item) => item.id), ["one", "two", "three"]);
});

test("fails instead of silently returning a partial contact population at the page limit", async () => {
  await assert.rejects(
    collectPagedHighLevelItems({
      pageSize: 2,
      maxPages: 2,
      failOnPageLimit: true,
      pageLimitErrorMessage: "Contact scan incomplete.",
      itemId: (item) => item.id,
      extractItems: (payload) => payload.contacts,
      fetchPage: async (page) => ({
        contacts: [
          { id: `${page}-one` },
          { id: `${page}-two` }
        ]
      })
    }),
    /Contact scan incomplete/
  );
});

test("splits a selected date range into non-overlapping UTC day windows", () => {
  assert.deepEqual(dailyUtcWindows("2026-07-01", "2026-07-03"), [
    {
      startDate: "2026-07-01T00:00:00.000Z",
      endDate: "2026-07-01T23:59:59.999Z"
    },
    {
      startDate: "2026-07-02T00:00:00.000Z",
      endDate: "2026-07-02T23:59:59.999Z"
    },
    {
      startDate: "2026-07-03T00:00:00.000Z",
      endDate: "2026-07-03T23:59:59.999Z"
    }
  ]);
});

test("rejects inverted HighLevel export date ranges", () => {
  assert.throws(
    () => dailyUtcWindows("2026-07-03", "2026-07-01"),
    /valid date range/
  );
});

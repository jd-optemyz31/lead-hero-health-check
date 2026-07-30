import test from "node:test";
import assert from "node:assert/strict";

import {
  collectCursorPagedHighLevelItems,
  collectPagedHighLevelItems,
  dailyUtcWindows
} from "../src/highlevel-pagination.mjs";

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

test("cursor pagination continues beyond the 10,000-contact offset window", async () => {
  const cursors = [];
  const pages = [
    {
      contacts: [{ id: "one" }, { id: "two" }],
      meta: { startAfter: 200, startAfterId: "two" }
    },
    {
      contacts: [{ id: "three" }, { id: "four" }],
      meta: { startAfter: 400, startAfterId: "four" }
    },
    {
      contacts: [{ id: "five" }],
      meta: {}
    }
  ];

  const items = await collectCursorPagedHighLevelItems({
    pageSize: 2,
    maxPages: 500,
    failOnPageLimit: true,
    itemId: (item) => item.id,
    extractItems: (payload) => payload.contacts,
    extractCursor: (payload) => payload.meta.startAfter
      ? { startAfter: payload.meta.startAfter, startAfterId: payload.meta.startAfterId }
      : null,
    fetchPage: async (cursor) => {
      cursors.push(cursor);
      return pages[cursors.length - 1];
    }
  });

  assert.deepEqual(cursors, [
    null,
    { startAfter: 200, startAfterId: "two" },
    { startAfter: 400, startAfterId: "four" }
  ]);
  assert.deepEqual(items.map((item) => item.id), ["one", "two", "three", "four", "five"]);
});

test("cursor pagination fails rather than trusting a full page without a next cursor", async () => {
  await assert.rejects(
    collectCursorPagedHighLevelItems({
      pageSize: 2,
      maxPages: 500,
      failOnPageLimit: true,
      itemId: (item) => item.id,
      extractItems: (payload) => payload.contacts,
      extractCursor: () => null,
      fetchPage: async () => ({ contacts: [{ id: "one" }, { id: "two" }] })
    }),
    /full page without a cursor/
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

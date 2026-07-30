import test from "node:test";
import assert from "node:assert/strict";

import { blastProgress } from "../src/blast-progress.mjs";

test("Blast progress phases advance through the real analysis pipeline", () => {
  const stages = [
    blastProgress("initializing"),
    blastProgress("contacts", { count: 50_000, mode: "cursor" }),
    blastProgress("messages", { done: 31, total: 31 }),
    blastProgress("matching", { count: 176 }),
    blastProgress("classifying", { done: 0, total: 176 }),
    blastProgress("classifying", { done: 88, total: 176 }),
    blastProgress("classifying", { done: 176, total: 176 }),
    blastProgress("saving"),
    blastProgress("done", { done: 176, total: 176 })
  ];

  assert.deepEqual(stages.map((stage) => stage.percent), [2, 25, 50, 53, 56, 76, 95, 98, 100]);
});

test("Blast progress uses marketing-analysis verbs rather than explosive-engineering language", () => {
  const progressText = [
    blastProgress("initializing").verb,
    blastProgress("contacts", { count: 100, mode: "cursor" }).verb,
    blastProgress("messages", { done: 1, total: 3 }).verb,
    blastProgress("matching", { count: 20 }).verb,
    blastProgress("classifying", { done: 10, total: 20 }).verb,
    blastProgress("saving").verb
  ].join(" ");

  assert.match(progressText, /\[.+\.\.\.\]/);
  assert.doesNotMatch(progressText, /shockwave|overpressure|fragment|deflagration|Mach stem|structural breach/i);
});

test("Blast progress safely handles an empty tagged-contact set", () => {
  const progress = blastProgress("classifying", { done: 0, total: 0 });

  assert.equal(progress.percent, 95);
  assert.equal(progress.detail, "No tagged contacts require classification.");
  assert.equal(progress.done, 0);
  assert.equal(progress.total, 0);
});

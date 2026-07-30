import test from "node:test";
import assert from "node:assert/strict";

import {
  canAccessClientId,
  canAccessJob,
  hasMinimumRole,
  scopedClientIds
} from "../src/access-control.mjs";
import { safeAuditMessage } from "../src/audit.mjs";

const admin = { id: "admin-1", role: "admin", active: true, assignedClientIds: [] };
const user = { id: "user-1", role: "user", active: true, assignedClientIds: [] };

test("admin can access every client and user action", () => {
  assert.equal(hasMinimumRole(admin, "user"), true);
  assert.equal(canAccessClientId(admin, "client-b"), true);
  assert.equal(scopedClientIds(admin), null);
});

test("user can manage every client but cannot perform Admin actions", () => {
  assert.equal(hasMinimumRole(user, "user"), true);
  assert.equal(hasMinimumRole(user, "admin"), false);
  assert.equal(canAccessClientId(user, "client-a"), true);
  assert.equal(canAccessClientId(user, "client-b"), true);
  assert.equal(scopedClientIds(user), null);
});

test("inactive and unprovisioned users are denied", () => {
  assert.equal(hasMinimumRole(null, "user"), false);
  assert.equal(hasMinimumRole({ role: "admin", active: false }, "user"), false);
  assert.equal(canAccessClientId({ role: "viewer", active: true }, "client-a"), false);
});

test("user job access requires ownership while Admin can inspect every job", () => {
  const ownJob = { authUserId: "user-1", clientId: "client-a" };
  const otherUsersJob = { authUserId: "user-2", clientId: "client-a" };
  const crossClientJob = { authUserId: "user-1", clientId: "client-b" };

  assert.equal(canAccessJob(user, ownJob), true);
  assert.equal(canAccessJob(user, otherUsersJob), false);
  assert.equal(canAccessJob(user, crossClientJob), true);
  assert.equal(canAccessJob(admin, otherUsersJob), true);
});

test("local development bypass is explicit", () => {
  assert.equal(hasMinimumRole(null, "admin", { authRequired: false }), true);
  assert.equal(canAccessClientId(null, "client-a", { authRequired: false }), true);
  assert.equal(canAccessJob(null, null, { authRequired: false }), true);
});

test("audit messages redact credential-shaped values and stay bounded", () => {
  const message = `Bearer abc.def token=pit-secret password: hunter2 api_key=my-key ${"x".repeat(300)}`;
  const safe = safeAuditMessage(message);

  assert.equal(safe.includes("abc.def"), false);
  assert.equal(safe.includes("pit-secret"), false);
  assert.equal(safe.includes("hunter2"), false);
  assert.equal(safe.includes("my-key"), false);
  assert.ok(safe.length <= 240);
});

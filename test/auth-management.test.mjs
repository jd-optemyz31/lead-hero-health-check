import test from "node:test";
import assert from "node:assert/strict";

import {
  isSupportedAppRole,
  isPendingAdminUserRoleMigration,
  manualUserCreationValidationError,
  managedPasswordResetValidationError,
  normalizeAppRole,
  passwordValidationError,
  safeManagedUser,
  selfPasswordChangeValidationError,
  validateManagedUserMutation
} from "../src/auth-management.mjs";

const actor = { id: "admin-1", role: "admin", active: true };
const targetAdmin = {
  id: "admin-2",
  email: "admin@example.test",
  role: "admin",
  active: true,
  provisioned: true,
  protectedAdmin: false
};

test("legacy and unknown roles normalize to User", () => {
  assert.equal(normalizeAppRole("admin"), "admin");
  assert.equal(normalizeAppRole("operator"), "user");
  assert.equal(normalizeAppRole("viewer"), "user");
  assert.equal(isSupportedAppRole("admin"), true);
  assert.equal(isSupportedAppRole("user"), true);
  assert.equal(isSupportedAppRole("operator"), false);
});

test("password validation requires matching 12-character values", () => {
  assert.equal(passwordValidationError("short", "short"), "Password must be at least 12 characters.");
  assert.equal(passwordValidationError("twelve-chars!", "different-value"), "Password confirmation does not match.");
  assert.equal(passwordValidationError("twelve-chars!", "twelve-chars!"), "");
});

test("manual user creation validates role, duplicate account, password, and Admin reauthentication", () => {
  assert.equal(manualUserCreationValidationError({
    email: "user@example.test",
    role: "viewer",
    password: "twelve-chars!",
    confirmation: "twelve-chars!",
    adminPassword: "current-password"
  }), "Role must be Admin or User.");
  assert.equal(manualUserCreationValidationError({
    email: "user@example.test",
    role: "user",
    password: "twelve-chars!",
    confirmation: "twelve-chars!",
    adminPassword: "current-password",
    existingUser: { id: "existing" }
  }), "An Auth account already exists for this email address.");
  assert.equal(manualUserCreationValidationError({
    email: "user@example.test",
    role: "user",
    password: "twelve-chars!",
    confirmation: "twelve-chars!",
    adminPassword: ""
  }), "Enter your current Admin password to continue.");
});

test("detects the unapplied Admin/User role constraint without exposing database detail", () => {
  assert.equal(isPendingAdminUserRoleMigration({
    status: 400,
    detail: 'new row for relation "app_users" violates check constraint "app_users_role_check"'
  }), true);
  assert.equal(isPendingAdminUserRoleMigration({
    status: 409,
    detail: "duplicate key value violates unique constraint"
  }), false);
});

test("self-service password changes require current password and a different valid password", () => {
  assert.equal(selfPasswordChangeValidationError({
    currentPassword: "",
    password: "new-password!",
    confirmation: "new-password!"
  }), "Enter your current password.");
  assert.equal(selfPasswordChangeValidationError({
    currentPassword: "same-password",
    password: "same-password",
    confirmation: "same-password"
  }), "Choose a new password that is different from your current password.");
});

test("Admin-managed password reset validates active account and Admin reauthentication", () => {
  assert.equal(managedPasswordResetValidationError({
    appUser: { active: false },
    adminPassword: "current-password",
    password: "twelve-chars!",
    confirmation: "twelve-chars!"
  }), "Reactivate this user before resetting its password.");
  assert.equal(managedPasswordResetValidationError({
    appUser: { active: true },
    adminPassword: "",
    password: "twelve-chars!",
    confirmation: "twelve-chars!"
  }), "Enter your current Admin password to continue.");
});

test("safe user projection excludes Auth metadata and session details", () => {
  const safe = safeManagedUser({
    authUser: {
      id: "user-1",
      email: "USER@EXAMPLE.TEST",
      created_at: "2026-07-01T00:00:00Z",
      email_confirmed_at: "2026-07-02T00:00:00Z",
      last_sign_in_at: "2026-07-03T00:00:00Z",
      user_metadata: { secret: "not-safe" },
      ip: "127.0.0.1"
    },
    appUser: { role: "user", active: true }
  });

  assert.deepEqual(Object.keys(safe), [
    "id",
    "email",
    "role",
    "active",
    "provisioned",
    "status",
    "protectedAdmin",
    "createdAt",
    "lastSignInAt"
  ]);
  assert.equal(safe.email, "user@example.test");
  assert.equal(safe.status, "Active");
  assert.equal("user_metadata" in safe, false);
  assert.equal("ip" in safe, false);
});

test("Admins cannot change their own role or active status", () => {
  assert.equal(
    validateManagedUserMutation({
      actor,
      target: { ...targetAdmin, id: actor.id },
      nextRole: "user",
      nextActive: true,
      activeAdminCount: 2
    }),
    "Admins cannot change their own role or active status."
  );
});

test("environment-managed and last active Admin guards are enforced", () => {
  assert.equal(
    validateManagedUserMutation({
      actor,
      target: { ...targetAdmin, protectedAdmin: true },
      nextRole: "user",
      nextActive: true,
      activeAdminCount: 2
    }),
    "Environment-managed Admins cannot be deactivated or changed to User."
  );
  assert.equal(
    validateManagedUserMutation({
      actor,
      target: targetAdmin,
      nextRole: "user",
      nextActive: true,
      activeAdminCount: 1
    }),
    "At least one active Admin must remain."
  );
});

test("another Admin can update a non-protected account when an Admin remains", () => {
  assert.equal(
    validateManagedUserMutation({
      actor,
      target: targetAdmin,
      nextRole: "user",
      nextActive: true,
      activeAdminCount: 2
    }),
    ""
  );
});

const appRoles = new Set(["admin", "user"]);

export function normalizeAppRole(role) {
  return String(role || "").toLowerCase() === "admin" ? "admin" : "user";
}

export function isSupportedAppRole(role) {
  return appRoles.has(String(role || "").toLowerCase());
}

export function isPendingAdminUserRoleMigration(error) {
  const detail = String(error?.detail || "").toLowerCase();
  return Number(error?.status) === 400
    && (
      detail.includes("app_users_role_check")
      || (detail.includes("check constraint") && detail.includes("app_users"))
    );
}

export function passwordValidationError(password, confirmation) {
  if (typeof password !== "string" || password.length < 12) {
    return "Password must be at least 12 characters.";
  }
  if (password.length > 128) {
    return "Password must be 128 characters or fewer.";
  }
  if (password !== confirmation) {
    return "Password confirmation does not match.";
  }
  return "";
}

export function manualUserCreationValidationError({
  email,
  role,
  password,
  confirmation,
  adminPassword,
  existingUser = null
}) {
  if (!email) return "A valid email address is required.";
  if (!isSupportedAppRole(role)) return "Role must be Admin or User.";
  if (existingUser) return "An Auth account already exists for this email address.";
  return passwordValidationError(password, confirmation)
    || (!adminPassword ? "Enter your current Admin password to continue." : "");
}

export function selfPasswordChangeValidationError({
  currentPassword,
  password,
  confirmation
}) {
  if (!currentPassword) return "Enter your current password.";
  if (currentPassword === password) return "Choose a new password that is different from your current password.";
  return passwordValidationError(password, confirmation);
}

export function managedPasswordResetValidationError({
  appUser,
  adminPassword,
  password,
  confirmation
}) {
  if (!appUser) return "User not found.";
  if (appUser.active === false) return "Reactivate this user before resetting its password.";
  if (!adminPassword) return "Enter your current Admin password to continue.";
  return passwordValidationError(password, confirmation);
}

export function safeManagedUser({ authUser, appUser, protectedAdmin = false }) {
  const email = String(authUser?.email || appUser?.email || "").trim().toLowerCase();
  const confirmedAt = authUser?.email_confirmed_at || authUser?.confirmed_at || "";
  const provisioned = Boolean(appUser);
  const active = provisioned && appUser.active !== false;
  const status = !provisioned
    ? "Unprovisioned"
    : !active
      ? "Inactive"
      : confirmedAt
        ? "Active"
        : authUser?.invited_at
          ? "Invited"
          : "Pending";

  return {
    id: authUser?.id || appUser?.auth_user_id || "",
    email,
    role: normalizeAppRole(appUser?.role),
    active,
    provisioned,
    status,
    protectedAdmin: Boolean(protectedAdmin),
    createdAt: authUser?.created_at || appUser?.created_at || "",
    lastSignInAt: authUser?.last_sign_in_at || ""
  };
}

export function validateManagedUserMutation({
  actor,
  target,
  nextRole,
  nextActive,
  activeAdminCount
}) {
  if (!actor || actor.role !== "admin" || actor.active === false) {
    return "Only an active Admin can manage users.";
  }
  if (!target?.id) return "User not found.";

  const role = normalizeAppRole(nextRole);
  const active = nextActive !== false;
  const changesRole = role !== normalizeAppRole(target.role);
  const changesActive = active !== (target.active !== false);

  if (!changesRole && !changesActive) return "";
  if (actor.id === target.id) {
    return "Admins cannot change their own role or active status.";
  }
  if (target.protectedAdmin && (role !== "admin" || !active)) {
    return "Environment-managed Admins cannot be deactivated or changed to User.";
  }
  if (
    normalizeAppRole(target.role) === "admin"
    && target.active !== false
    && (role !== "admin" || !active)
    && Number(activeAdminCount) <= 1
  ) {
    return "At least one active Admin must remain.";
  }
  return "";
}

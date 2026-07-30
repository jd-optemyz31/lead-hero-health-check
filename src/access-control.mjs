const roleRank = Object.freeze({
  user: 1,
  admin: 2
});

export function hasMinimumRole(user, minimumRole, { authRequired = true } = {}) {
  if (!authRequired) return true;
  if (!user?.active) return false;
  return (roleRank[user.role] || 0) >= (roleRank[minimumRole] || 0);
}

export function canAccessClientId(user, clientId, { authRequired = true } = {}) {
  if (!authRequired) return true;
  if (!user?.active || !clientId) return false;
  return user.role === "admin" || user.role === "user";
}

export function canAccessJob(user, job, { authRequired = true } = {}) {
  if (!authRequired) return true;
  if (!user?.active || !job) return false;
  if (user.role === "admin") return true;
  return user.role === "user"
    && job.authUserId === user.id
    && canAccessClientId(user, job.clientId, { authRequired });
}

export function scopedClientIds(user, { authRequired = true } = {}) {
  if (!authRequired) return null;
  if (!user?.active || !["admin", "user"].includes(user.role)) return [];
  return null;
}

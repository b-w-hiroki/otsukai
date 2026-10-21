"use strict";

function admitMember(current, { code, uid, name, emoji, now, legacy }) {
  if (!current || !current.meta || current.meta.inviteCode !== code ||
      !current.members) return;
  if (current.members[uid]) return current;
  const meta = current.meta;
  // Old string mappings are bounded on their first successful admission.
  const expiresAt = meta.inviteExpiresAt ?? (legacy ? now + 7 * 86400000 : null);
  const maxUses = meta.inviteMaxUses ?? (legacy ? 10 : null);
  if (!Number.isFinite(expiresAt) || expiresAt <= now ||
      !Number.isInteger(maxUses) || maxUses < 1) return;
  const redeemed = meta.inviteRedemptions || {};
  if (redeemed[uid] || Object.keys(redeemed).length >= maxUses) return;
  return {
    ...current,
    meta: {
      ...meta, inviteExpiresAt: expiresAt, inviteMaxUses: maxUses,
      inviteRedemptions: { ...redeemed, [uid]: now }
    },
    members: {
      ...current.members,
      [uid]: { name, emoji, joinedAt: now, role: "member", memberRole: "child" }
    }
  };
}

function publishInvite(current, { uid, code, expiresAt }) {
  if (!current || !current.meta || !current.members ||
      !current.members[uid] || current.members[uid].memberRole !== "parent") return;
  return { ...current, meta: { ...current.meta,
    inviteCode: code, inviteExpiresAt: expiresAt,
    inviteMaxUses: 10, inviteRedemptions: {} } };
}

module.exports = { admitMember, publishInvite };

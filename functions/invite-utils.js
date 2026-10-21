"use strict";

function reserveInvite(current, { familyId, uid, now }) {
  // First legitimate redemption of an old string mapping moves it to the
  // bounded format. The family metadata check is repeated in admitMember.
  if (current === familyId) {
    current = { familyId, expiresAt: now + 7 * 86400000,
      maxUses: 10, redeemed: {} };
  }
  if (!current || typeof current !== "object" ||
      current.familyId !== familyId || !Number.isFinite(current.expiresAt) ||
      current.expiresAt <= now || !Number.isInteger(current.maxUses) ||
      current.maxUses < 1) return;
  const redeemed = current.redeemed || {};
  // A removed member must not replay an already consumed invitation.
  if (redeemed[uid] || Object.keys(redeemed).length >= current.maxUses) return;
  return { ...current, redeemed: { ...redeemed, [uid]: now } };
}

function admitMember(current, { code, uid, name, emoji, now, expiresAt }) {
  if (!current || !current.meta || current.meta.inviteCode !== code ||
      !current.members || (expiresAt !== null && expiresAt <= now)) return;
  if (current.members[uid]) return current;
  return {
    ...current,
    members: {
      ...current.members,
      [uid]: { name, emoji, joinedAt: now, role: "member", memberRole: "child" }
    }
  };
}

module.exports = { reserveInvite, admitMember };

"use strict";

function reserveInvite(current, { familyId, uid, now }) {
  if (!current || typeof current !== "object" ||
      current.familyId !== familyId || !Number.isFinite(current.expiresAt) ||
      current.expiresAt <= now || !Number.isInteger(current.maxUses) ||
      current.maxUses < 1) return;
  const redeemed = current.redeemed || {};
  if (redeemed[uid]) return current; // idempotent retry
  if (Object.keys(redeemed).length >= current.maxUses) return;
  return { ...current, redeemed: { ...redeemed, [uid]: now } };
}

module.exports = { reserveInvite };

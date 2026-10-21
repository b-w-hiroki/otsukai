"use strict";
const { reserveInvite, admitMember } = require("./invite-utils");

class InvalidInviteError extends Error {
  constructor() { super("invalid invite"); this.code = "invalid-invite"; }
}

async function redeemInvite(db, { code, uid, profile, clock = Date.now }) {
  const invalid = () => { throw new InvalidInviteError(); };
  const inviteRef = db.ref(`invites/${code}`);
  const invite = (await inviteRef.once("value")).val();
  const familyId = typeof invite === "string" ? invite : invite && invite.familyId;
  if (typeof familyId !== "string" || !/^[-A-Za-z0-9_]{1,128}$/.test(familyId)) invalid();
  const familyRef = db.ref(`families/${familyId}`);
  const family = (await familyRef.once("value")).val();
  if (!family || !family.meta || family.meta.inviteCode !== code || !family.members) invalid();
  if (family.members[uid]) return { familyId };

  const reserved = await inviteRef.transaction(
    current => reserveInvite(current, { familyId, uid, now: clock() }),
    undefined, false);
  if (!reserved.committed) invalid();

  const expiresAt = reserved.snapshot.val().expiresAt;
  const name = typeof profile?.name === "string" ? profile.name.slice(0, 80) : "";
  const emoji = typeof profile?.emoji === "string" ? profile.emoji.slice(0, 8) : "";
  // The transaction retries against the current family after any concurrent
  // parent rotation, membership change, or family deletion.
  const admitted = await familyRef.transaction(
    current => admitMember(current, {
      code, uid, name, emoji, now: clock(), expiresAt
    }), undefined, false);
  if (!admitted.committed) invalid();
  return { familyId };
}

module.exports = { redeemInvite, InvalidInviteError };

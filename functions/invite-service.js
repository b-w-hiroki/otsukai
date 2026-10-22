"use strict";
const { admitMember } = require("./invite-utils");
const { withLiveFamily } = require("./live-family");

class InvalidInviteError extends Error {
  constructor() { super("invalid invite"); this.code = "invalid-invite"; }
}

async function redeemInvite(db, { code, uid, profile, clock = Date.now, legacyCutoff = null }) {
  const invalid = () => { throw new InvalidInviteError(); };
  const invite = (await db.ref(`invites/${code}`).once("value")).val();
  if (typeof invite === "string" && legacyCutoff !== null &&
      (!Number.isFinite(legacyCutoff) || clock() >= legacyCutoff)) invalid();
  const familyId = typeof invite === "string" ? invite : invite && invite.familyId;
  if (typeof familyId !== "string" || !/^[-A-Za-z0-9_]{1,128}$/.test(familyId)) invalid();
  const familyRef = db.ref(`families/${familyId}`);
  return withLiveFamily(familyRef, async family => {
    if (!family || !family.meta || family.meta.inviteCode !== code || !family.members) invalid();
    if (family.members[uid]) return { familyId };

    const name = typeof profile?.name === "string" ? profile.name.slice(0, 80) : "";
    const emoji = typeof profile?.emoji === "string" ? profile.emoji.slice(0, 8) : "";
    // Membership and redemption ledger commit together. A retry before commit
    // is safe, and removing a member does not erase their consumed invitation.
    const admitted = await familyRef.transaction(
      current => admitMember(current, {
        code, uid, name, emoji, now: clock(), legacy: typeof invite === "string"
      }), undefined, false);
    if (!admitted.committed) invalid();
    return { familyId };
  });
}

module.exports = { redeemInvite, InvalidInviteError };

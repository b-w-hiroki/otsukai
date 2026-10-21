import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const admin = require("firebase-admin");
const { redeemInvite, InvalidInviteError } = require("../../functions/invite-service.js");

const projectId = "demo-otsukai-authz";
if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== "127.0.0.1:9000") {
  throw new Error("This test requires the local RTDB emulator");
}
admin.initializeApp({
  projectId,
  databaseURL: `https://${projectId}-default-rtdb.firebaseio.com`
});
const db = admin.database();
const args = uid => ({ code: "ABCDEF", uid, profile: { name: "Synthetic" }, clock: () => 900 });
async function seed(maxUses = 1) {
  await db.ref().set({
    invites: { ABCDEF: { familyId: "family" } },
    families: { family: {
      meta: { inviteCode: "ABCDEF", inviteExpiresAt: 1000,
        inviteMaxUses: maxUses, inviteRedemptions: {} },
      members: { parent: { role: "admin", memberRole: "parent" } }
    } }
  });
}
try {
  await seed();
  const concurrent = await Promise.allSettled([
    redeemInvite(db, args("a")), redeemInvite(db, args("b"))
  ]);
  assert.equal(concurrent.filter(x => x.status === "fulfilled").length, 1);
  const first = concurrent.findIndex(x => x.status === "fulfilled") === 0 ? "a" : "b";
  const family = (await db.ref("families/family").once("value")).val();
  assert.equal(Object.keys(family.meta.inviteRedemptions).length, 1);
  assert.equal(Object.keys(family.members).length, 2);
  await db.ref(`families/family/members/${first}`).remove();
  await assert.rejects(redeemInvite(db, args(first)), e => e instanceof InvalidInviteError);

  await seed(2);
  // Inject a failure before any family transaction commits, then retry.
  const failingDb = { ref(path) {
    const ref = db.ref(path);
    if (path !== "families/family") return ref;
    return { once: (...xs) => ref.once(...xs),
      transaction: async () => { throw new Error("transient"); } };
  } };
  await assert.rejects(redeemInvite(failingDb, args("retry")), /transient/);
  assert.equal((await db.ref("families/family/meta/inviteRedemptions").once("value")).val(), null);
  await redeemInvite(db, args("retry"));
  assert.equal((await db.ref("families/family/meta/inviteRedemptions/retry").once("value")).val(), 900);
  console.log("Real emulator invite transactions passed");
} finally {
  await db.ref().remove();
  await admin.app().delete();
}

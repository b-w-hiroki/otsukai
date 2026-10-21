import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { redeemInvite, InvalidInviteError } = require("../../functions/invite-service.js");

const clone = value => value == null ? value : structuredClone(value);
function fakeDb({ maxUses = 2, legacy = false } = {}) {
  const state = {
    invites: { CODE: legacy ? "family" : {
      familyId: "family", expiresAt: 1000, maxUses, redeemed: {}
    } },
    families: { family: {
      meta: { inviteCode: "CODE" },
      members: { parent: { role: "admin", memberRole: "parent" } }
    } }
  };
  let beforeFamilyTransaction = null;
  const db = {
    state,
    setBeforeFamilyTransaction(fn) { beforeFamilyTransaction = fn; },
    ref(path) {
      const [collection, key] = path.split("/");
      return {
        async once() { return { val: () => clone(state[collection][key]) }; },
        async transaction(transform) {
          if (collection === "families" && beforeFamilyTransaction) {
            beforeFamilyTransaction(state);
            beforeFamilyTransaction = null;
          }
          const next = transform(clone(state[collection][key]));
          if (next === undefined) return { committed: false };
          state[collection][key] = next;
          return { committed: true, snapshot: { val: () => clone(next) } };
        }
      };
    }
  };
  return db;
}
const args = uid => ({ code: "CODE", uid, profile: { name: "Synthetic" }, clock: () => 900 });
const denied = e => e instanceof InvalidInviteError;

test("callable core admits one user and blocks replay after removal", async () => {
  const db = fakeDb();
  assert.deepEqual(await redeemInvite(db, args("child")), { familyId: "family" });
  assert.equal(db.state.families.family.members.child.role, "member");
  delete db.state.families.family.members.child;
  await assert.rejects(redeemInvite(db, args("child")), denied);
});
test("concurrent redemption respects the maximum use count", async () => {
  const db = fakeDb({ maxUses: 1 });
  const results = await Promise.allSettled([
    redeemInvite(db, args("a")), redeemInvite(db, args("b"))
  ]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(Object.keys(db.state.invites.CODE.redeemed).length, 1);
  assert.equal(Object.keys(db.state.families.family.members).length, 2);
});
test("rotation or family deletion during redemption cannot create membership", async () => {
  for (const change of [
    state => { state.families.family.meta.inviteCode = "ROTATED"; },
    state => { delete state.families.family; }
  ]) {
    const db = fakeDb();
    db.setBeforeFamilyTransaction(change);
    await assert.rejects(redeemInvite(db, args("child")), denied);
    assert.equal(db.state.families.family?.members.child, undefined);
  }
});
test("expired code and legacy migration", async () => {
  const expired = fakeDb();
  await assert.rejects(redeemInvite(expired, { ...args("child"), clock: () => 1000 }), denied);
  const legacy = fakeDb({ legacy: true });
  assert.deepEqual(await redeemInvite(legacy, args("child")), { familyId: "family" });
  assert.equal(legacy.state.invites.CODE.expiresAt, 900 + 7 * 86400000);
  assert.equal(legacy.state.invites.CODE.maxUses, 10);
});

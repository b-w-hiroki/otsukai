import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { redeemInvite, InvalidInviteError } = require("../../functions/invite-service.js");

const clone = value => value == null ? value : structuredClone(value);
function fakeDb({ maxUses = 2, legacy = false } = {}) {
  const meta = { inviteCode: "ABCDEF" };
  if (!legacy) Object.assign(meta, {
    inviteExpiresAt: 1000, inviteMaxUses: maxUses, inviteRedemptions: {}
  });
  const state = {
    invites: { ABCDEF: legacy ? "family" : { familyId: "family" } },
    families: { family: {
      meta, members: { parent: { role: "admin", memberRole: "parent" } }
    } }
  };
  let beforeFamilyTransaction = null;
  return {
    state,
    setBeforeFamilyTransaction(fn) { beforeFamilyTransaction = fn; },
    ref(path) {
      const [collection, key] = path.split("/");
      return {
        async once() { return { val: () => clone(state[collection][key]) }; },
        on(_event, listener) { listener({ val: () => clone(state[collection][key]) }); },
        off() {},
        async transaction(transform) {
          if (collection === "families" && beforeFamilyTransaction) {
            const callback = beforeFamilyTransaction;
            beforeFamilyTransaction = null;
            callback(state);
          }
          const next = transform(clone(state[collection][key]));
          if (next === undefined) return { committed: false };
          state[collection][key] = next;
          return { committed: true, snapshot: { val: () => clone(next) } };
        }
      };
    }
  };
}
const args = uid => ({ code: "ABCDEF", uid, profile: { name: "Synthetic" }, clock: () => 900 });
const denied = e => e instanceof InvalidInviteError;

test("a failed first admission can retry without consuming a use", async () => {
  const db = fakeDb();
  db.setBeforeFamilyTransaction(() => { throw new Error("transient"); });
  await assert.rejects(redeemInvite(db, args("child")), /transient/);
  assert.deepEqual(db.state.families.family.meta.inviteRedemptions, {});
  assert.equal(db.state.families.family.members.child, undefined);
  assert.deepEqual(await redeemInvite(db, args("child")), { familyId: "family" });
  assert.equal(db.state.families.family.meta.inviteRedemptions.child, 900);
});
test("duplicate concurrent retries consume only one use", async () => {
  const db = fakeDb({ maxUses: 1 });
  const results = await Promise.allSettled([
    redeemInvite(db, args("child")), redeemInvite(db, args("child"))
  ]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 2);
  assert.equal(Object.keys(db.state.families.family.meta.inviteRedemptions).length, 1);
  assert.equal(Object.keys(db.state.families.family.members).length, 2);
});
test("concurrent distinct users respect maximum uses", async () => {
  const db = fakeDb({ maxUses: 1 });
  const results = await Promise.allSettled([
    redeemInvite(db, args("a")), redeemInvite(db, args("b"))
  ]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(Object.keys(db.state.families.family.meta.inviteRedemptions).length, 1);
});
test("removed member cannot replay a consumed invitation", async () => {
  const db = fakeDb();
  await redeemInvite(db, args("child"));
  delete db.state.families.family.members.child;
  await assert.rejects(redeemInvite(db, args("child")), denied);
});
test("rotation or family deletion before commit cannot admit a member", async () => {
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
test("expiry and legacy first-use bound", async () => {
  const expired = fakeDb();
  await assert.rejects(redeemInvite(expired, { ...args("child"), clock: () => 1000 }), denied);
  const legacy = fakeDb({ legacy: true });
  await redeemInvite(legacy, args("child"));
  assert.equal(legacy.state.families.family.meta.inviteExpiresAt, 900 + 7 * 86400000);
  assert.equal(legacy.state.families.family.meta.inviteMaxUses, 10);
});
test("legacy cutoff is disabled by default and rejects only when explicitly set", async () => {
  const before = fakeDb({ legacy: true });
  await assert.rejects(redeemInvite(before, { ...args("child"), legacyCutoff: 900 }), denied);
  assert.equal(before.state.families.family.members.child, undefined);
  const during = fakeDb({ legacy: true });
  assert.deepEqual(await redeemInvite(during, { ...args("child"), legacyCutoff: 901 }), { familyId: "family" });
});

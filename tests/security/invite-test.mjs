import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { reserveInvite, admitMember, publishInvite } = require("../../functions/invite-utils.js");

const base = { familyId: "synthetic-family", expiresAt: 1000, maxUses: 2, redeemed: {} };
test("valid invitation reserves a single use", () => {
  const first = reserveInvite(base, { familyId: base.familyId, uid: "a", now: 900 });
  assert.equal(first.redeemed.a, 900);
  assert.equal(base.redeemed.a, undefined);
  assert.equal(reserveInvite(first, { familyId: base.familyId, uid: "a", now: 901 }), undefined);
});
test("expiry, mismatched family and reuse are rejected", () => {
  assert.equal(reserveInvite(base, { familyId: base.familyId, uid: "a", now: 1000 }), undefined);
  assert.equal(reserveInvite(base, { familyId: "other", uid: "a", now: 900 }), undefined);
  const full = { ...base, redeemed: { a: 800, b: 810 } };
  assert.equal(reserveInvite(full, { familyId: base.familyId, uid: "c", now: 900 }), undefined);
  assert.equal(reserveInvite(full, { familyId: base.familyId, uid: "a", now: 900 }), undefined);
});

test("membership uses the current family code and rejects rotation, deletion, and expiry", () => {
  const family = { meta: { inviteCode: "ACTIVE" }, members: { parent: { role: "admin" } } };
  const args = { code: "ACTIVE", uid: "child", name: "Synthetic", emoji: "", now: 900, expiresAt: 1000 };
  const admitted = admitMember(family, args);
  assert.equal(admitted.members.child.role, "member");
  assert.equal(admitted.members.child.memberRole, "child");
  assert.equal(family.members.child, undefined);
  assert.equal(admitMember({ ...family, meta: { inviteCode: "ROTATED" } }, args), undefined);
  assert.equal(admitMember(null, args), undefined);
  assert.equal(admitMember(family, { ...args, now: 1000 }), undefined);
  assert.deepEqual(admitMember(admitted, args), admitted);
});

test("legacy invitation gains a bounded expiry and replay protection", () => {
  const first = reserveInvite("synthetic-family", {
    familyId: "synthetic-family", uid: "a", now: 100
  });
  assert.equal(first.expiresAt, 100 + 7 * 86400000);
  assert.equal(first.maxUses, 10);
  assert.equal(reserveInvite(first, { familyId: "synthetic-family", uid: "a", now: 101 }), undefined);
});

test("issuance denies parent removed or family deleted before publish", () => {
  const family = { meta: { inviteCode: "OLD" },
    members: { parent: { memberRole: "parent" }, child: { memberRole: "child" } } };
  const args = { uid: "parent", code: "NEWCODE", expiresAt: 1000 };
  assert.equal(publishInvite(null, args), undefined);
  assert.equal(publishInvite({ ...family, members: {} }, args), undefined);
  assert.equal(publishInvite(family, { ...args, uid: "child" }), undefined);
  assert.equal(publishInvite(family, args).meta.inviteCode, "NEWCODE");
});

import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { reserveInvite } = require("../../functions/invite-utils.js");

const base = { familyId: "synthetic-family", expiresAt: 1000, maxUses: 2, redeemed: {} };
test("valid invitation reserves a single use", () => {
  const first = reserveInvite(base, { familyId: base.familyId, uid: "a", now: 900 });
  assert.equal(first.redeemed.a, 900);
  assert.equal(base.redeemed.a, undefined);
  assert.deepEqual(reserveInvite(first, { familyId: base.familyId, uid: "a", now: 901 }), first);
});
test("expiry, mismatched family and reuse are rejected", () => {
  assert.equal(reserveInvite(base, { familyId: base.familyId, uid: "a", now: 1000 }), undefined);
  assert.equal(reserveInvite(base, { familyId: "other", uid: "a", now: 900 }), undefined);
  const full = { ...base, redeemed: { a: 800, b: 810 } };
  assert.equal(reserveInvite(full, { familyId: base.familyId, uid: "c", now: 900 }), undefined);
  assert.deepEqual(reserveInvite(full, { familyId: base.familyId, uid: "a", now: 900 }), full);
});

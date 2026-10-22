import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { admitMember, publishInvite } = require("../../functions/invite-utils.js");

const family = () => ({
  meta: { inviteCode: "ACTIVE", inviteExpiresAt: 1000,
    inviteMaxUses: 2, inviteRedemptions: {} },
  members: { parent: { role: "admin", memberRole: "parent" } }
});
const args = uid => ({ code: "ACTIVE", uid, name: "Synthetic",
  emoji: "", now: 900, legacy: false });

test("membership and use ledger are updated together", () => {
  const before = family();
  const after = admitMember(before, args("child"));
  assert.equal(after.members.child.role, "member");
  assert.equal(after.meta.inviteRedemptions.child, 900);
  assert.equal(before.members.child, undefined);
  assert.equal(before.meta.inviteRedemptions.child, undefined);
});
test("expiry, rotation, deletion, reuse and limit deny admission", () => {
  assert.equal(admitMember(family(), { ...args("child"), now: 1000 }), undefined);
  const malformed = family();
  malformed.meta.inviteExpiresAt = 0;
  assert.equal(admitMember(malformed, { ...args("child"), legacy: true }), undefined);
  assert.equal(admitMember({ ...family(), meta: { inviteCode: "ROTATED" } }, args("child")), undefined);
  assert.equal(admitMember(null, args("child")), undefined);
  const used = family();
  used.meta.inviteRedemptions.child = 800;
  assert.equal(admitMember(used, args("child")), undefined);
  used.meta.inviteRedemptions.other = 810;
  assert.equal(admitMember(used, args("third")), undefined);
});
test("legacy first admission gains a bound in the same transaction", () => {
  const before = { meta: { inviteCode: "ACTIVE" }, members: { parent: { role: "admin" } } };
  const after = admitMember(before, { ...args("child"), legacy: true });
  assert.equal(after.meta.inviteExpiresAt, 900 + 7 * 86400000);
  assert.equal(after.meta.inviteMaxUses, 10);
  assert.equal(after.meta.inviteRedemptions.child, 900);
});
test("issuance denies parent removed or family deleted before publish", () => {
  const before = family();
  const issue = { uid: "parent", code: "NEWCODE", expiresAt: 2000 };
  assert.equal(publishInvite(null, issue), undefined);
  assert.equal(publishInvite({ ...before, members: {} }, issue), undefined);
  assert.equal(publishInvite(before, { ...issue, uid: "child" }), undefined);
  const next = publishInvite(before, issue);
  assert.equal(next.meta.inviteCode, "NEWCODE");
  assert.deepEqual(next.meta.inviteRedemptions, {});
});

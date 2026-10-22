import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";

const env = await initializeTestEnvironment({
  projectId: "demo-otsukai-authz",
  database: { host: "127.0.0.1", port: 9000, rules: readFileSync("database.rules.json", "utf8") }
});
const family = "synthetic-family";
const member = uid => env.authenticatedContext(uid).database().ref(`families/${family}/members/${uid}`);
const db = uid => env.authenticatedContext(uid).database();
async function seed() {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async context => {
    await context.database().ref(`families/${family}`).set({
      meta: { createdBy: "parent", inviteCode: "LEGACY" },
      members: {
        parent: { role: "admin", memberRole: "parent", name: "Parent" },
        child: { role: "member", memberRole: "child", name: "Child" },
        legacy: { role: "member", name: "Legacy" }
      },
      requests: { one: { name: "Synthetic item" } }
    });
    await context.database().ref("invites/LEGACY").set(family);
  });
}
async function run() {
  await seed();
  await assertSucceeds(db("creator").ref("families/new-family").set({
    meta: { createdBy: "creator" },
    members: { creator: { role: "admin", memberRole: "parent" } }
  }));
  await assertFails(db("outsider").ref("families/forged-family").set({
    meta: { createdBy: "creator" },
    members: { outsider: { role: "admin", memberRole: "parent" } }
  }));
  await assertFails(member("outsider").set({ role: "member", memberRole: "child" }));
  await assertFails(member("outsider").set({ role: "admin", memberRole: "child" }));
  await assertFails(db("outsider").ref(`families/${family}`).once("value"));
  await assertFails(db("outsider").ref(`families/${family}/requests/new`).set({ name: "No" }));
  await assertFails(db("outsider").ref().update({
    [`families/${family}/members/outsider`]: { role: "member", memberRole: "child" },
    [`families/${family}/requests/new`]: { name: "No" }
  }));
  await assertFails(db("outsider").ref("invites/FAKE").set(family));
  await assertFails(db("outsider").ref("invites/LEGACY").once("value"));
  await assertFails(member("child").update({ role: "admin" }));
  await assertFails(member("child").update({ memberRole: "parent" }));
  await assertFails(member("legacy").update({ role: "admin", memberRole: "parent" }));
  await assertSucceeds(member("child").update({ name: "Child renamed" }));
  await assertSucceeds(member("legacy").update({ name: "Legacy renamed" }));
  await assertSucceeds(db("child").ref(`families/${family}/requests/new`).set({ name: "Allowed" }));
  await assertSucceeds(member("parent").update({ name: "Parent renamed" }));
  await assertSucceeds(db("parent").ref(`families/${family}/members/new-child`).set({ role: "member", memberRole: "child" }));
  await assertFails(db("child").ref("families/other-family").once("value"));
  await assertFails(db("child").ref("families/other-family/requests/new").set({ name: "No" }));
}
try {
  await run();
  console.log("RTDB authorization cases passed");
} finally {
  await env.cleanup();
}

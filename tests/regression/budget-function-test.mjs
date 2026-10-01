import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { crossedBudget, budgetNotification } = require("../../functions/budget-alert.js");
let failed = 0;
const check = (name, ok) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed += 1;
};

check("crossing from under to over budget notifies", crossedBudget(
  { budget: 300, actualCost: 250 },
  { budget: 300, actualCost: 500 }
));
check("editing an already-over-budget value does not notify again", !crossedBudget(
  { budget: 300, actualCost: 500 },
  { budget: 300, actualCost: 550 }
));
check("no budget does not notify", !crossedBudget({}, { actualCost: 500 }));
const message = budgetNotification({ name: "牛乳", actualCost: 500, budget: 300 }, "ひろき");
check("notification identifies item, actual cost, and budget", message.body.includes("牛乳") && message.body.includes("500円") && message.body.includes("300円"));

process.exit(failed ? 1 : 0);

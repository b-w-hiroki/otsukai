"use strict";

function crossedBudget(before = {}, after = {}) {
  return after.budget > 0 && after.actualCost > after.budget &&
    !(before.actualCost > before.budget);
}

function budgetNotification(request, recorder) {
  return {
    title: "⚠️ 予算を超えました",
    body: `${recorder || "家族"}さんが「${request.name}」を${request.actualCost}円で記録しました（予算 ${request.budget}円）`,
  };
}

module.exports = { crossedBudget, budgetNotification };

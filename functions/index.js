/**
 * おうちのおつかい — 買い物リマインドのプッシュ通知（サーバー側）
 *
 * 家族ごとに設定された時刻（families/{id}/reminderTimes）に、未完了の買い物が
 * あれば、その家族の端末トークン（families/{id}/pushTokens）へ FCM を送る。
 *
 * Cloud Scheduler により毎分起動し、現在時刻(Asia/Tokyo)の "HH:MM" と一致する
 * reminderTimes を持つ家族にだけ通知する。
 *
 * デプロイには Firebase の Blaze（従量課金）プランが必要です。詳しくは README.md。
 */
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

admin.initializeApp();

exports.shoppingReminder = functions
  .region("asia-northeast1")
  .pubsub.schedule("* * * * *")
  .timeZone("Asia/Tokyo")
  .onRun(async () => {
    const now = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
    );
    const current =
      String(now.getHours()).padStart(2, "0") +
      ":" +
      String(now.getMinutes()).padStart(2, "0");

    const db = admin.database();
    const snap = await db.ref("families").once("value");
    const families = snap.val() || {};
    const tasks = [];

    for (const [familyId, fam] of Object.entries(families)) {
      if (!fam) continue;
      const reminderTimes = fam.reminderTimes || {};
      if (!reminderTimes[current]) continue;

      // 未完了（open/claimed）の買い物があるか
      const requests = fam.requests || {};
      const pending = Object.values(requests).filter(
        (r) => r && r.status && r.status !== "done"
      );
      if (!pending.length) continue;

      const tokens = Object.keys(fam.pushTokens || {});
      if (!tokens.length) continue;

      const openCount = pending.filter((r) => r.status === "open").length;
      const body =
        openCount > 0
          ? `未受け取りの買い物が${openCount}件あります。確認しよう！`
          : `買い物リストに${pending.length}件あります。確認しよう！`;

      const message = {
        notification: { title: "🧺 おうちのおつかい", body },
        data: { tag: `reminder-${current}`, url: "./" },
        tokens,
      };

      tasks.push(
        admin
          .messaging()
          .sendEachForMulticast(message)
          .then(async (resp) => {
            // 無効になったトークンを掃除する
            const removals = [];
            resp.responses.forEach((r, i) => {
              if (!r.success) {
                const code = r.error && r.error.code;
                if (
                  code === "messaging/registration-token-not-registered" ||
                  code === "messaging/invalid-registration-token" ||
                  code === "messaging/invalid-argument"
                ) {
                  removals.push(
                    db
                      .ref(`families/${familyId}/pushTokens/${tokens[i]}`)
                      .remove()
                  );
                }
              }
            });
            await Promise.all(removals);
          })
          .catch((e) => console.error("send failed for", familyId, e))
      );
    }

    await Promise.all(tasks);
    return null;
  });

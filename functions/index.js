/**
 * おうちのおつかい — 買い物リマインドのプッシュ通知（サーバー側）
 *
 * 家族ごとに設定された時刻（families/{id}/reminderTimes）に、未完了の買い物が
 * あれば、その家族の端末トークン（families/{id}/pushTokens）へ FCM を送る。
 *
 * Cloud Scheduler により毎分起動する。全家族をスキャンする代わりに、クライアントが
 * 保守する逆引き索引 reminderIndex/{HH:MM}/{familyId} を読むため、リマインド該当の
 * ない分は索引ノード1つの読み取りだけで済む（スケーラブル＆低コスト）。
 *
 * デプロイには Firebase の Blaze（従量課金）プランが必要です。詳しくは README.md。
 */
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

admin.initializeApp();

/** Asia/Tokyo の現在時刻を "HH:MM" で返す */
function currentTimeJST() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type).value;
  // en-GB の hour は "00"-"23"（"24" にならない）
  return `${get("hour")}:${get("minute")}`;
}

exports.shoppingReminder = functions
  .region("asia-northeast1")
  .pubsub.schedule("* * * * *")
  .timeZone("Asia/Tokyo")
  .onRun(async () => {
    const current = currentTimeJST();
    const db = admin.database();

    // 逆引き索引: この時刻に通知したい家族の一覧（該当なしなら即終了）
    const idxSnap = await db.ref(`reminderIndex/${current}`).once("value");
    const familyIds = Object.keys(idxSnap.val() || {});
    if (!familyIds.length) return null;

    const tasks = familyIds.map(async (familyId) => {
      try {
        const famRef = db.ref(`families/${familyId}`);
        const [timeSnap, tokensSnap, requestsSnap] = await Promise.all([
          famRef.child(`reminderTimes/${current}`).once("value"),
          famRef.child("pushTokens").once("value"),
          famRef.child("requests").once("value"),
        ]);

        // 索引が古い（家族側の設定が消えている）場合は自己修復して終了
        if (!timeSnap.val()) {
          await db.ref(`reminderIndex/${current}/${familyId}`).remove();
          return;
        }

        // 未完了（open/claimed）の買い物があるか
        const requests = requestsSnap.val() || {};
        const pending = Object.values(requests).filter(
          (r) => r && r.status && r.status !== "done"
        );
        if (!pending.length) return;

        const tokens = Object.keys(tokensSnap.val() || {});
        if (!tokens.length) return;

        const openCount = pending.filter((r) => r.status === "open").length;
        const body =
          openCount > 0
            ? `未受け取りの買い物が${openCount}件あります。確認しよう！`
            : `買い物リストに${pending.length}件あります。確認しよう！`;

        const resp = await admin.messaging().sendEachForMulticast({
          notification: { title: "🧺 おうちのおつかい", body },
          data: { tag: `reminder-${current}`, url: "./" },
          tokens,
        });

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
              removals.push(famRef.child(`pushTokens/${tokens[i]}`).remove());
            }
          }
        });
        await Promise.all(removals);
      } catch (e) {
        console.error("reminder failed for", familyId, e);
      }
    });

    await Promise.all(tasks);
    return null;
  });

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

// Realtime Database は asia-southeast1 のインスタンスを明示する
// （関数リージョン asia-northeast1 と異なるため）。
const DB_INSTANCE = "otsukai-app-4b62b-default-rtdb";

/** 家族の pushTokens を読み、条件に合うトークンへ FCM を送って無効分を掃除する */
async function sendToFamily(familyId, { title, body, tag, filterUid }) {
  const db = admin.database();
  const tokensSnap = await db
    .ref(`families/${familyId}/pushTokens`)
    .once("value");
  const entries = Object.entries(tokensSnap.val() || {});
  // filterUid: { exclude: uid } 依頼者本人には送らない / { only: uid } 指名相手だけに送る
  const tokens = entries
    .filter(([, v]) => {
      if (!filterUid) return true;
      if (filterUid.only) return v && v.uid === filterUid.only;
      if (filterUid.exclude) return !v || v.uid !== filterUid.exclude;
      return true;
    })
    .map(([t]) => t);
  if (!tokens.length) return;

  const resp = await admin.messaging().sendEachForMulticast({
    notification: { title, body },
    // type:"event" はフォアグラウンドのアプリが二重トーストを避けるための目印
    data: { tag, url: "./", type: "event" },
    tokens,
  });
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
          db.ref(`families/${familyId}/pushTokens/${tokens[i]}`).remove()
        );
      }
    }
  });
  await Promise.all(removals);
}

/** メンバー名を取得（居なければ「家族の誰か」） */
async function memberName(familyId, uid) {
  if (!uid) return "家族の誰か";
  const snap = await admin
    .database()
    .ref(`families/${familyId}/members/${uid}/name`)
    .once("value");
  return snap.val() || "家族の誰か";
}

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

/**
 * イベント型プッシュ①: 新しい依頼が追加されたとき。
 * - 指名あり → 指名された本人だけに通知
 * - 指名なし → 依頼者以外の家族全員に通知（急ぎは 🔥 を付ける）
 */
exports.notifyNewRequest = functions
  .region("asia-northeast1")
  .database.instance(DB_INSTANCE)
  .ref("/families/{familyId}/requests/{requestId}")
  .onCreate(async (snap, context) => {
    const r = snap.val();
    if (!r || r.status !== "open") return null;
    const { familyId } = context.params;
    const requester = await memberName(familyId, r.requestedBy);
    try {
      if (r.assignedTo) {
        await sendToFamily(familyId, {
          title: "📌 あなたに指名のおつかい",
          body: `${requester}さんから「${r.name}」を頼まれました`,
          tag: `request-${context.params.requestId}`,
          filterUid: { only: r.assignedTo },
        });
      } else {
        await sendToFamily(familyId, {
          title: r.urgent ? "🔥 急ぎのおつかい" : "🛒 新しいおつかい",
          body: `${requester}さんが「${r.name}」を頼んでいます`,
          tag: `request-${context.params.requestId}`,
          filterUid: { exclude: r.requestedBy },
        });
      }
    } catch (e) {
      console.error("notifyNewRequest failed", familyId, e);
    }
    return null;
  });

/**
 * イベント型プッシュ②: ステータスが変わったとき（立候補・完了）。
 * 依頼者本人にだけ通知する（本人の操作なら送らない）。
 */
exports.notifyStatusChange = functions
  .region("asia-northeast1")
  .database.instance(DB_INSTANCE)
  .ref("/families/{familyId}/requests/{requestId}")
  .onUpdate(async (change, context) => {
    const before = change.before.val() || {};
    const after = change.after.val() || {};
    if (before.status === after.status) return null;
    const { familyId } = context.params;
    try {
      if (after.status === "claimed" && after.claimedBy && after.claimedBy !== after.requestedBy) {
        const claimer = await memberName(familyId, after.claimedBy);
        await sendToFamily(familyId, {
          title: "🙋 立候補がありました",
          body: `${claimer}さんが「${after.name}」を買いに行きます`,
          tag: `request-${context.params.requestId}`,
          filterUid: { only: after.requestedBy },
        });
      } else if (after.status === "done" && after.completedBy && after.completedBy !== after.requestedBy) {
        const buyer = await memberName(familyId, after.completedBy);
        await sendToFamily(familyId, {
          title: "✅ 買ってきました！",
          body: `${buyer}さんが「${after.name}」を買ってきました`,
          tag: `request-${context.params.requestId}`,
          filterUid: { only: after.requestedBy },
        });
      }
    } catch (e) {
      console.error("notifyStatusChange failed", familyId, e);
    }
    return null;
  });

/**
 * 完了アイテムの自動アーカイブ（毎日 03:15 JST）。
 * 完了から90日を過ぎた依頼を families/{id}/archive/ へ移動し、
 * 付随するコメントも一緒に移す。requests が無限に肥大して
 * 起動時の全ダウンロードが重くなるのを防ぐ。
 *
 * 注: 全家族を1日1回読む。家族数が大きく増えたら requests に
 * completedAt インデックスを張って絞り込む形に見直すこと。
 */
const ARCHIVE_AFTER_DAYS = 90;

exports.archiveOldRequests = functions
  .region("asia-northeast1")
  .pubsub.schedule("15 3 * * *")
  .timeZone("Asia/Tokyo")
  .onRun(async () => {
    const db = admin.database();
    const cutoff = Date.now() - ARCHIVE_AFTER_DAYS * 24 * 60 * 60 * 1000;
    const famSnap = await db.ref("families").once("value");
    const families = famSnap.val() || {};
    let moved = 0;

    for (const [familyId, fam] of Object.entries(families)) {
      if (!fam || !fam.requests) continue;
      const updates = {};
      for (const [rid, r] of Object.entries(fam.requests)) {
        if (!r || r.status !== "done") continue;
        if ((r.completedAt || 0) >= cutoff) continue;
        updates[`families/${familyId}/archive/requests/${rid}`] = r;
        updates[`families/${familyId}/requests/${rid}`] = null;
        const comments = fam.comments && fam.comments[rid];
        if (comments) {
          updates[`families/${familyId}/archive/comments/${rid}`] = comments;
          updates[`families/${familyId}/comments/${rid}`] = null;
        }
        moved++;
      }
      if (Object.keys(updates).length) {
        try {
          await db.ref().update(updates); // 家族単位でアトミックに移動
        } catch (e) {
          console.error("archive failed for", familyId, e);
        }
      }
    }
    console.log(`archived ${moved} requests (older than ${ARCHIVE_AFTER_DAYS} days)`);
    return null;
  });

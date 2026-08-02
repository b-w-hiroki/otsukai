// おうちのおつかい ドッグフーディング用 — インメモリ Firebase compat スタブ
// gstatic の firebase-app-compat.js の代わりに配信され、本物の SDK と同じ表面APIで
// メモリ上の DB を提供する。リスナー・トランザクション・push キー対応。
(() => {
  // 説明用スクショで「写真つきの依頼」を見せるためのサンプル画像（青いボトル）
  const SAMPLE_PHOTO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAAEsCAIAAAD2HxkiAAAFnElEQVR4nO3dIbJcVRSG0Q4VDAbNDDBMCARYGBBYEDAhDDYKGwwiGERXNSCSVEje/c7ZZy2dvNpV//3e7Y7Js1cvX9yAzkf1AXA6EUJMhBATIcRECDERQkyEEBMhxEQIMRFCTIQQEyHERAgxEUJMhBATIcRECDERQkyEEBMhxEQIMRFCTIQQEyHERAgxEUJMhBATIcRECDERQkyEEBMhxEQIMRFCTIQQEyHERAgxEUJMhBB7Xh9Q+vPjz+oT+Mcnf/1en9A4MULtremxy2k1nhWh/LZwn+mcFA/6TqjAvZyz1ykRnrPoJIesdkSEh2w50gnbzY/whBVnG7/g8AjH73eI2TtOjnD2cqcZvObYCAdvdqypm46NEHYxM8KpvzIZuezMCGEjIoTYwAhHfmLhYd6+AyOEvYgQYiKEmAghJkKIiRBiIoSYCCEmQoiJEGIihJgIISZCiIkQYiKEmAghJkKIiRBiIoSYCCEmQoiJEGIihJgIISZCiIkQYiKEmAghJkKIiRBiIoSYCCEmQoiJEGIihJgIISZCiIkQYiKEmAghJkKIiRBiAyP87qff6hN4QvP2HRgh7EWEEJsZ4bxPLNyNXHZmhLCRsRGO/JV5uKmbjo3wNnezMw1ec3KEt9HLHWX2jsMjvE3f7wTjF5wf4e2AFQc7YbsjIrydseU8h6x2SoS3YxYd45y9ntcHXOq+6/dff14fwpuck9/dWRHePTZW41JOa+/hxAgfjl2dpRz0nRDWJEKIiRBiIoSYCCEmQoiJEGIihJgIISZCiIkQYiKEmAghJkKIiRBiIoSYCCEmQoiJEGIihJgIISZCiIkQYiKEmAghJkKIiRBiIoSYCCEmQoiJEGIihJgIISZCiIkQYiKEmAghJkKIPa8P4J39/O0Xb/4DX/3w6zWX8EGIcA9vDe91f1iQ6xPh6t4pv9f9dSmuTISLes/2XvfT1Lgg/zCzog9b4DU/mf/Nm3AtF0TiA+pqvAkXcuVryitxHSJcxfVV6HARIlxC1YMOVyDCXluCDnMijK3QwAo3nEyEpXWe/nUuOZAIM6s996vdcw4RNtZ84te8ajwRQkyEgZVfOCvfNpUIr7b+U77+hcOIEGIihJgIL7XLJ71d7pxBhBAT4XX2er3sde3WRAgxEUJMhBAT4UV2/Iq14807EiHERAgxEUJMhBATIcRECDERQkyEEBMhxEQIMRFeZMf/imzHm3ckQoiJEGIihJgIr7PXV6y9rt2aCCEmwkvt8nrZ5c4ZRAgxEUJMhFdb/5Pe+hcOI8LAyk/5yrdNJUKIibCx5gtnzavGE2FmtSd+tXvOIcLSOs/9OpccSISxFZ7+FW44mQh7bQMKzIlwCVUJClyBCFdxfQ8KXIQIF3JlFQpcx/P6AP7j3saT/p9k8luNN+GKnq4TBS7Im3BRj1o+yFtReysT4ere8wOq/NYnwj38u6W3Bim8vYhwPxobxj/MQEyEEBMhxEQIMRFCTIQQEyHERAgxEUJMhBATIcRECDERQkyEEBMhxEQIMRFCTIQQEyHERAgxEUJMhBATIcRECDERQkyEEBMhxEQIMRFCTIQQEyHERAgxEUJMhBATIcQGRvjjl5/WJ/CE5u07MELYiwghNjPCeZ9YuBu57MwIYSNjIxz5K/NwUzcdG+Ft7mZnGrzm5Ahvo5c7yuwdh0d4m77fCcYvOD/C2wErDnbCdkdEeDtjy3kOWe2UCG/HLDrGOXs9e/XyRX3D1b755Y/6BN7knPzuTozwQY1LOa29h6MjhBUc9J0Q1iRCiIkQYiKEmAghJkKIiRBiIoSYCCEmQoiJEGIihJgIISZCiIkQYiKEmAghJkKIiRBiIoSYCCEmQoiJEGIihJgIISZCiIkQYiKEmAghJkKIiRBiIoSYCCEmQoiJEGIihJgIISZCiP0NvAPvN3Farw4AAAAASUVORK5CYII=";
  const store = {};
  const listeners = [];

  const deepCopy = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const getAt = (path) =>
    path.split("/").filter(Boolean).reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), store);
  const setAt = (path, val) => {
    const keys = path.split("/").filter(Boolean);
    if (!keys.length) return;
    let o = store;
    for (const k of keys.slice(0, -1)) {
      if (!o[k] || typeof o[k] !== "object") o[k] = {};
      o = o[k];
    }
    const last = keys[keys.length - 1];
    if (val === null || val === undefined) delete o[last];
    else o[last] = deepCopy(val);
    fireAll();
  };
  const snap = (path) => ({
    val: () => { const v = getAt(path); return v === undefined ? null : deepCopy(v); },
    exists: () => getAt(path) !== undefined,
    child: (k) => snap(path + "/" + k),
  });
  const fireAll = () => {
    // 書き込みのたびに全リスナーへ再通知（実DBより雑だがUI検証には十分）
    for (const l of [...listeners]) {
      try { l.cb(snap(l.path)); } catch (e) { console.error("listener error", e); }
    }
  };

  let pushCounter = 100;
  const makeRef = (path) => ({
    key: path.split("/").filter(Boolean).pop() || null,
    child(k) { return makeRef((path ? path + "/" : "") + String(k).replace(/^\/+|\/+$/g, "")); },
    on(ev, cb) { listeners.push({ path, cb }); setTimeout(() => cb(snap(path)), 0); return cb; },
    off() { for (let i = listeners.length - 1; i >= 0; i--) if (listeners[i].path === path) listeners.splice(i, 1); },
    async once() { return snap(path); },
    async set(v) { setAt(path, v); },
    async update(obj) { for (const [k, v] of Object.entries(obj)) setAt((path ? path + "/" : "") + k, v); },
    async remove() { setAt(path, null); },
    push() { const key = "p" + (++pushCounter); return makeRef((path ? path + "/" : "") + key); },
    async transaction(fn) {
      const cur = snap(path).val();
      const res = fn(cur);
      if (res === undefined) return { committed: false, snapshot: snap(path) };
      setAt(path, res);
      return { committed: true, snapshot: snap(path) };
    },
  });

  const authObj = {
    currentUser: { uid: "uid-parent", metadata: { lastSignInTime: new Date().toISOString() }, delete: async () => {} },
    onAuthStateChanged(cb) { setTimeout(() => cb({ uid: "uid-parent" }), 0); },
    async signOut() {},
  };
  const auth = () => authObj;
  auth.GoogleAuthProvider = function () {};

  self.firebase = {
    initializeApp() {},
    auth,
    database: () => ({ ref: (p = "") => makeRef(String(p || "")) }),
    // Storage は put/getDownloadURL だけ動く最小の偽物。
    // 実際にはアップロードせず、1x1 の透明PNG(data URL)を返す。
    // 「写真が付いた依頼がどう表示されるか」を検証できれば十分なため。
    storage: () => ({
      ref: (path = "") => ({
        _path: String(path),
        async put() { self.__uploadedPhotos = (self.__uploadedPhotos || []).concat(String(path)); return {}; },
        async getDownloadURL() {
          return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        },
      }),
    }),
    messaging: Object.assign(() => ({ onMessage() {}, getToken: async () => null }), { isSupported: () => false }),
    app: () => ({ functions: () => ({ httpsCallable: () => async () => { throw new Error("functions未デプロイ（スタブ）"); } }) }),
  };

  // ===== シードデータ（親ひろき視点） =====
  const now = Date.now();
  const H = 36e5, D = 864e5;
  store.users = { "uid-parent": { name: "ひろき", emoji: "😎", familyId: "fam1" } };
  store.families = {
    fam1: {
      meta: { name: "ひろき家", inviteCode: "ABC123", createdAt: now - 90 * D, createdBy: "uid-parent" },
      members: {
        "uid-parent": { name: "ひろき", emoji: "😎", memberRole: "parent", role: "admin", joinedAt: now - 90 * D },
        "uid-mom": { name: "はな", emoji: "🌸", memberRole: "sub-parent", role: "member", joinedAt: now - 85 * D },
        "uid-child": { name: "たろう", emoji: "🦊", memberRole: "child", role: "member", joinedAt: now - 80 * D },
      },
      requests: {
        r1: { name: "牛乳", diff: "normal", urgent: false, status: "open", requestedBy: "uid-mom", requestedAt: now - 2 * H, category: "food", budget: 300 },
        r2: { name: "卵", diff: "normal", urgent: true, status: "open", requestedBy: "uid-mom", requestedAt: now - 1 * H, category: "food" },
        r3: { name: "トイレットペーパー", diff: "hard", urgent: false, status: "open", requestedBy: "uid-parent", requestedAt: now - 3 * H, category: "daily", memo: "12ロール・ダブル" , photoUrl: SAMPLE_PHOTO },
        r4: { name: "単3電池", diff: "normal", urgent: false, status: "open", requestedBy: "uid-mom", requestedAt: now - 5 * H, category: "other", brand: "パナソニック" },
        r5: { name: "食パン", diff: "normal", urgent: false, status: "claimed", claimedBy: "uid-child", claimedAt: now - 30 * 6e4, requestedBy: "uid-parent", requestedAt: now - 2 * H, category: "food" },
        r6: { name: "オレンジジュース", diff: "normal", status: "done", requestedBy: "uid-mom", completedBy: "uid-child", requestedAt: now - 1 * D, completedAt: now - 2 * H, category: "food", reactions: { "uid-mom": "❤️" } },
        r7: { name: "洗剤", diff: "normal", status: "done", requestedBy: "uid-parent", completedBy: "uid-mom", requestedAt: now - 2 * D, completedAt: now - 1 * D, category: "daily" },
        r8: { name: "こどもチャレンジ付録の電池", diff: "normal", status: "done", requestedBy: "uid-child", completedBy: "uid-parent", requestedAt: now - 3 * D, completedAt: now - 3 * D },
      },
      comments: { r2: { c1: { text: "Lサイズがいいな", authorUid: "uid-mom", authorEmoji: "🌸", authorName: "はな", createdAt: now - 30 * 6e4 } } },
      stats: {
        "uid-parent": { requestedCount: 12, claimedCount: 4, completedCount: 3 },
        "uid-child": { requestedCount: 2, claimedCount: 8, completedCount: 7 },
        "uid-mom": { requestedCount: 9, claimedCount: 5, completedCount: 5 },
      },
      shortcuts: {
        s1: { name: "牛乳", diff: "normal", urgent: false, category: "food", budget: 300, createdBy: "uid-parent", createdAt: now - D },
        s2: { name: "食パン", diff: "normal", category: "food", createdBy: "uid-mom", createdAt: now - D },
        s3: { name: "トイレットペーパー", diff: "hard", category: "daily", memo: "12ロール", createdBy: "uid-parent", createdAt: now - D },
        s4: { name: "ティッシュ", diff: "normal", createdBy: "uid-parent", createdAt: now - D },
      },
      points: { "uid-parent": 5, "uid-child": 12, "uid-mom": 8 },
      rewards: {
        rw1: { name: "アイス", cost: 3, createdBy: "uid-parent", createdAt: now - D },
        rw2: { name: "ゲーム30分延長", cost: 5, createdBy: "uid-parent", createdAt: now - D },
        rw3: { name: "おかし選び放題", cost: 10, createdBy: "uid-parent", createdAt: now - D },
      },
      rewardLogs: { l1: { name: "アイス", cost: 3, uid: "uid-child", at: now - D } },
      reminderTimes: { "17:00": true },
      stocks: {
        st1: { name: "米", level: "low", updatedBy: "uid-parent", updatedAt: now - D },
        st2: { name: "しょうゆ", level: "ok", updatedBy: "uid-mom", updatedAt: now - 2 * D },
        st3: { name: "ラップ", level: "out", updatedBy: "uid-parent", updatedAt: now - H },
        // 履歴ゼロでも「買う間隔」を手入力してあるもの（30日ごと・29日前に補充 → あと1日）
        st4: { name: "コンタクト洗浄液", level: "ok", cycleDays: 30, lastFilledAt: now - 29 * D, updatedBy: "uid-mom", updatedAt: now - 29 * D },
      },
      missions: {},
      missionLogs: {},
      weekly: {}, // 下でセット（週キーは実行時に計算）
    },
  };
  // 履歴が長い状況を再現するための完了アイテム（シート高さ・閉じるボタン検証用）
  const names = ["キャベツ","にんじん","牛肉","豆腐","納豆","ヨーグルト","バナナ","シャンプー",
    "歯みがき粉","キッチンペーパー","ゴミ袋","味噌","カレールー","冷凍うどん","チーズ",
    "ハム","レタス","トマト","じゃがいも","玉ねぎ","food wrap","乾電池","ボディソープ","柔軟剤","麦茶"];
  names.forEach((n, i) => {
    store.families.fam1.requests["h" + i] = {
      name: n, diff: "normal", status: "done",
      requestedBy: "uid-mom", completedBy: i % 2 ? "uid-child" : "uid-parent",
      requestedAt: now - (i + 2) * D, completedAt: now - (i + 1) * D,
      category: i % 3 === 0 ? "food" : i % 3 === 1 ? "daily" : "other",
    };
  });

  // 定期購入の提案検証用: 約7日周期で4回買っていて、最後の購入から9日経過
  [30, 23, 16, 9].forEach((ago, i) => {
    store.families.fam1.requests["rep" + i] = {
      name: "こめ5kg", diff: "hard", status: "done",
      requestedBy: "uid-parent", completedBy: "uid-parent",
      requestedAt: now - (ago + 1) * D, completedAt: now - ago * D, category: "food",
    };
  });

  // 予告日数の検証用: 約28日周期で3回買っていて、次の買い時まであと10日
  [74, 46, 18].forEach((ago, i) => {
    store.families.fam1.requests["far" + i] = {
      name: "ティッシュ箱買い", diff: "normal", status: "done",
      requestedBy: "uid-mom", completedBy: "uid-mom",
      requestedAt: now - (ago + 1) * D, completedAt: now - ago * D, category: "daily",
    };
  });

  // ウィークリーミッションの進捗シード（現在の週キーで登録）
  const wk = (() => {
    const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const [y, m, d2] = ymd.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d2));
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7) + 3);
    const firstThu = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
    firstThu.setUTCDate(firstThu.getUTCDate() - ((firstThu.getUTCDay() + 6) % 7) + 3);
    const week = 1 + Math.round((date - firstThu) / (7 * 864e5));
    return date.getUTCFullYear() + "-W" + String(week).padStart(2, "0");
  })();
  store.families.fam1.weekly = {
    [wk]: {
      "uid-parent": { completed: 2, urgentCompleted: 1, reactionsSent: 1, awards: { urgent1: Date.now() - 3600000 } },
      "uid-child": { completed: 3, urgentCompleted: 0, reactionsSent: 0, awards: { complete3: Date.now() - 7200000 } },
    },
  };
})();

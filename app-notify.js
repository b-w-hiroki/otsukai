// おうちのおつかい — プッシュ通知・リマインド時刻 / 月次サマリー・テーマ切替 / 完了時の紙吹雪
// 元 app.js の 2501〜2726行目。index.html の <script> 順で他の app-*.js と読み込み順が保証される
// （クラシックスクリプトなのでグローバルスコープを共有。type="module" にはしていない）。

// ===== Push notifications (FCM) & reminder times =====
let messaging = null;
let fcmSwReg = null;

function getMessaging() {
  if (!pushSupported) return null;
  if (!messaging) {
    try { messaging = firebase.messaging(); } catch (e) { messaging = null; }
  }
  return messaging;
}

function updatePushStatus(msg, isError) {
  const el = $("push-status");
  if (!el) return;
  el.textContent = msg || "";
  el.style.color = isError ? "#dc2626" : "var(--muted)";
}

// 「この端末では通知を受け取らない」フラグ（端末ローカル・個人設定）
function pushOptedOut() { return localStorage.getItem("pushOptOut") === "1"; }

// 現在の FCM トークンを取得して家族の pushTokens に登録する。
// トークンはローテーションされるため、家族に入るたび（起動時）にも呼んで最新を保つ。
// 古いトークンが残っていれば削除して付け替える。
async function registerPushToken() {
  if (!pushSupported || VAPID_KEY.startsWith("YOUR_") || pushOptedOut()) return null;
  if (Notification.permission !== "granted" || !state.familyId) return null;
  try {
    if (!fcmSwReg) {
      fcmSwReg = await navigator.serviceWorker.register("./firebase-messaging-sw.js");
    }
    const m = getMessaging();
    if (!m) return null;
    const token = await m.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: fcmSwReg });
    if (!token) return null;
    const old = localStorage.getItem("pushToken");
    if (old && old !== token) {
      await familyRef().child("pushTokens/" + old).remove().catch(() => {});
    }
    await familyRef().child("pushTokens/" + token).set({
      uid: state.uid,
      name: (state.profile && state.profile.name) || "",
      updatedAt: now()
    });
    localStorage.setItem("pushToken", token);
    return token;
  } catch (e) {
    console.error("registerPushToken failed", e);
    return null;
  }
}

// ログアウトや家族離脱時に、この端末のトークンを家族から外す（外し損ねても
// サーバー側の無効トークン掃除が最終防衛線になる）。
async function unregisterPushToken(familyId) {
  const token = localStorage.getItem("pushToken");
  if (!token || !familyId) return;
  try { await db.ref(`families/${familyId}/pushTokens/${token}`).remove(); } catch (e) {}
}

async function enablePush() {
  if (!pushSupported) {
    updatePushStatus("この端末/ブラウザはプッシュ通知に対応していません（iOSはホーム画面に追加＋16.4以上が必要）。", true);
    return;
  }
  if (VAPID_KEY.startsWith("YOUR_")) {
    updatePushStatus("VAPIDキーが未設定です。firebase-config.js の FIREBASE_VAPID_KEY にウェブプッシュ証明書を設定してください。", true);
    return;
  }
  try {
    localStorage.removeItem("pushOptOut");
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      updatePushStatus("通知が許可されませんでした。端末の設定から許可してください。", true);
      return;
    }
    const token = await registerPushToken();
    if (!token) {
      updatePushStatus("通知トークンを取得できませんでした。もう一度お試しください。", true);
      return;
    }
    updatePushStatus("✅ プッシュ通知をオンにしました。");
    setupForegroundMessages();
  } catch (e) {
    updatePushStatus("有効化に失敗しました: " + (e && e.message ? e.message : e), true);
  }
  renderPushToggle();
}

// この端末だけ通知を止める（家族の設定時刻はそのまま）
async function disablePush() {
  localStorage.setItem("pushOptOut", "1");
  await unregisterPushToken(state.familyId);
  localStorage.removeItem("pushToken");
  updatePushStatus("この端末では通知を受け取りません。");
  renderPushToggle();
}

// 通知ボタンの表示をオン/オフ状態に合わせる
function renderPushToggle() {
  const btn = $("btn-enable-push");
  if (!btn) return;
  const active = pushSupported && !VAPID_KEY.startsWith("YOUR_") &&
    Notification.permission === "granted" && !pushOptedOut() && !!localStorage.getItem("pushToken");
  btn.textContent = active ? "通知をオフにする" : "通知をオンにする";
  btn.dataset.pushActive = active ? "1" : "";
}

function togglePush() {
  if ($("btn-enable-push").dataset.pushActive === "1") disablePush();
  else enablePush();
}

function setupForegroundMessages() {
  const m = getMessaging();
  if (!m) return;
  try {
    m.onMessage((payload) => {
      const data = (payload && payload.data) || {};
      // イベント型（依頼追加・立候補・完了）はアプリ起動中なら DB リスナーが
      // 同じ内容をトーストするため、二重表示を避けてスキップする。
      if (data.type === "event") return;
      const n = (payload && payload.notification) || {};
      showToast("🔔 " + (n.title || "お知らせ") + (n.body ? "：" + n.body : ""));
    });
  } catch (e) {}
}

function initPushOnLoad() {
  if (!pushSupported) {
    updatePushStatus("この端末/ブラウザはプッシュ通知に対応していません。", true);
    return;
  }
  if (pushOptedOut()) {
    updatePushStatus("この端末では通知を受け取りません。");
  } else if (Notification.permission === "granted" && !VAPID_KEY.startsWith("YOUR_")) {
    updatePushStatus("✅ プッシュ通知はオンです。");
    setupForegroundMessages();
    // トークンローテーションに追従（家族に入っていれば再登録）
    registerPushToken();
  } else {
    updatePushStatus("「通知をオンにする」で買い物リマインドを受け取れます。");
  }
  renderPushToggle();
}

// 設定タブ「⏳ そろそろ切れるかも」の予告日数
function renderLowLeadSetting() {
  const sel = $("opt-low-lead");
  if (!sel) return;
  const v = String(lowLeadDays());
  // 選択肢に無い値（他端末で将来増やした場合など）でも表示が飛ばないようにする
  if (!Array.from(sel.options).some((o) => o.value === v)) {
    sel.add(new Option(`${v}日前から`, v));
  }
  sel.value = v;
}

async function saveLowLeadDays(v) {
  if (!state.familyId) return;
  const d = parseInt(v, 10);
  if (!(d >= 0 && d <= LOW_LEAD_MAX)) return;
  if (!(await dbOp(familyRef().child("settings/lowLeadDays").set(d), "設定できませんでした"))) {
    renderLowLeadSetting(); // 失敗したら表示を元に戻す
    return;
  }
  showToast(d === 0 ? "⏳ 切れる当日に知らせます" : `⏳ ${d}日前から知らせます`, { sound: false });
}

function renderReminderTimes() {
  const wrap = $("reminder-times-list");
  if (!wrap) return;
  const times = Object.keys(state.reminderTimes || {}).sort();
  if (!times.length) {
    wrap.innerHTML = `<span class="muted" style="font-size:12px;">まだ設定されていません</span>`;
    return;
  }
  wrap.innerHTML = times.map((t) => `
    <span class="member-chip">
      ⏰ ${escapeHtml(t)}
      <button data-remove-time="${escapeHtml(t)}" aria-label="削除" style="margin-left:6px;background:none;border:none;cursor:pointer;color:var(--muted);font-weight:800;font-size:15px;line-height:1;">×</button>
    </span>
  `).join("");
  wrap.querySelectorAll("[data-remove-time]").forEach((b) => {
    b.addEventListener("click", () => removeReminderTime(b.dataset.removeTime));
  });
}

// ===== Monthly summary（設定タブ） =====
// ===== テーマ（ライト / ダーク / 端末に合わせる） =====
function applyTheme(mode) {
  const m = mode || localStorage.getItem("theme") || "auto";
  if (m === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", m);
  localStorage.setItem("theme", m);
  // アドレスバーの色も追従させる
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const dark = m === "dark" || (m === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    meta.setAttribute("content", dark ? "#14131a" : "#6366f1");
  }
}

// ===== 完了時の紙吹雪 =====
function celebrate() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const wrap = document.createElement("div");
  wrap.className = "confetti-wrap";
  const colors = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#38bdf8"];
  for (let i = 0; i < 26; i++) {
    const p = document.createElement("div");
    p.className = "confetti-piece";
    p.style.left = Math.random() * 100 + "vw";
    p.style.background = colors[i % colors.length];
    p.style.setProperty("--dx", (Math.random() * 160 - 80) + "px");
    p.style.setProperty("--rot", (Math.random() * 720 + 180) + "deg");
    p.style.setProperty("--dur", (1.2 + Math.random() * 0.9) + "s");
    p.style.animationDelay = (Math.random() * 0.25) + "s";
    if (i % 3 === 0) p.style.borderRadius = "50%";
    wrap.appendChild(p);
  }
  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), 2600);
}

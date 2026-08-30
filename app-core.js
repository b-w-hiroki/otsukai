// おうちのおつかい — Firebase設定・定数・状態 / 認証・家族・メンバー管理・プロフィール / リアルタイムリスナー・コメント・通知差分 / 使い方モーダル
// 元 app.js の 1〜701行目。index.html の <script> 順で他の app-*.js と読み込み順が保証される
// （クラシックスクリプトなのでグローバルスコープを共有。type="module" にはしていない）。

// おうちのおつかい — アプリ本体のロジック（index.html から分離）
// 読み込み順: Firebase SDK → firebase-config.js → app-core.js → ...（index.html の <script> 順で保証）
// テーマは描画前に当てて、初回表示のちらつきを防ぐ（定義は下部の applyTheme）
(() => {
  const m = localStorage.getItem("theme") || "auto";
  if (m !== "auto") document.documentElement.setAttribute("data-theme", m);
})();

// ===== Firebase config =====
// 実体は firebase-config.js（firebase-messaging-sw.js と共有）。
const firebaseConfig = self.FIREBASE_CONFIG;
const isConfigured = !firebaseConfig.apiKey.startsWith("YOUR_");
const VAPID_KEY = self.FIREBASE_VAPID_KEY;
const pushSupported = ("Notification" in window) &&
  ("serviceWorker" in navigator) &&
  (typeof firebase !== "undefined") && !!firebase.messaging;

// ===== Constants =====
const EMOJI_CHOICES = [
  "🙂","😊","😎","🥳","🤓","😺","🐶","🐰",
  "🐻","🐼","🦊","🐯","🦁","🐸","🐵","🦄",
  "👨","👩","👦","👧","👴","👵","🧑","🧒"
];
const DIFF_LABEL = { normal: "ふつう", hard: "💪 ちょっと大変", extreme: "😅 めちゃ大変" };
const STATUS_LABEL = { open: "未受託", claimed: "買いに行く", done: "完了" };

// ===== State =====
const state = {
  uid: null,
  email: null,
  profile: null,
  familyId: null,
  family: null,
  requests: {},
  comments: {},
  stats: {},
  activeTab: "requests",
  profileEmoji: "🙂",
  settingsEmoji: "🙂",
  soundOn: localStorage.getItem("soundOn") !== "false",
  prevRequests: {},
  prevComments: {},
  expandedItems: new Set(),
  unreadComments: new Set(),
  reminderTimes: {},
  familySettings: {},
  shortcuts: {},
  stocks: {},
  missions: {},
  missionLogs: {},
  points: {},
  rewards: {},
  rewardLogs: {},
  weekly: {},
  extraExpenses: {},
  myRole: null
};

const expandedGroups = new Set(["group-open", "group-claimed"]);
let editingRequestId = null;
let shortcutMode = false;
let editingShortcutId = null;
// 追加/編集シートで選んだ写真。null = 変更なし、"" = 外す
let pendingReqPhoto = null;
let existingReqPhotoUrl = "";

const $ = (id) => document.getElementById(id);
const now = () => Date.now();
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (m) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
// 実写真か、用意したイラスト（shortcut-icons/）かを区別する。
// イラストは正方形基準のSVGなので、横長の写真枠に object-fit:cover で引き伸ばすと歪む。
const isIllustrationPhoto = (url) => !!url && url.startsWith("./shortcut-icons/");

// ===== Firebase init =====
// gstatic.com から読み込む Firebase SDK が、広告ブロッカーやプライバシー系拡張機能・
// 社内ネットワークのフィルタなどで読み込めなかった場合（PCのブラウザで起きやすい）、
// firebase 自体が未定義になり initializeApp が例外を投げる。ここを守らないと
// 「読み込み中…」のまま無限に固まって画面が真っ白に見える不具合になる（init() 側で
// firebaseInitFailed を見て案内画面に切り替える）。
let auth, db;
let firebaseInitFailed = false;
if (isConfigured) {
  try {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.database();
  } catch (e) {
    console.error("[init] Firebase SDK の初期化に失敗:", e);
    firebaseInitFailed = true;
  }
}

// ===== PWA インストール導線 =====
// ブラウザがネイティブの「ホーム画面に追加」導線を出せるかどうかは beforeinstallprompt の
// 発火有無でしか分からない（Android/デスクトップ Chrome・Edgeのみ。iOS Safariには無い）。
// 初回オンボーディングのインストール案内（app-init.js）で使うため、できるだけ早く捕まえておく。
let deferredInstallPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
});

// ===== 簡易エラーロギング =====
// 実機で何が起きているか見えるよう、未捕捉エラーを DB の errors/ に記録する
// （読み取りは Firebase Console から）。1セッション最大10件・ログイン後のみ。
let errorLogCount = 0;
function logClientError(message, stack) {
  if (!db || !state.uid || errorLogCount >= 10) return;
  errorLogCount++;
  try {
    db.ref("errors").push({
      uid: state.uid,
      message: String(message || "").slice(0, 500),
      stack: String(stack || "").slice(0, 1500),
      ua: navigator.userAgent,
      at: Date.now()
    });
  } catch (e) { /* ロギング自体の失敗は握りつぶす */ }
}
window.addEventListener("error", (e) => {
  logClientError(e.message, e.error && e.error.stack);
});
window.addEventListener("unhandledrejection", (e) => {
  const r = e.reason || {};
  logClientError(r.message || String(e.reason), r.stack);
});

// ===== Screens =====
function showScreen(name) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $("screen-" + name).classList.add("active");
  // メイン画面はログイン直後など非表示から表示に切り替わる瞬間があり、その前に
  // 計測した下部ナビの位置（幅0など）はあてにならないため、表示された直後に測り直す。
  if (name === "main") requestAnimationFrame(() => positionNavIndicator(state.activeTab, false));
}

// ===== Toasts / Sound =====
function showToast(text, opts = {}) {
  const d = document.createElement("div");
  d.className = "toast" + (opts.urgent ? " urgent" : "");
  d.textContent = text;
  $("toasts").appendChild(d);
  setTimeout(() => { d.style.opacity = "0"; d.style.transition = "opacity .3s"; }, 2400);
  setTimeout(() => d.remove(), 2800);
  if (opts.sound !== false && state.soundOn) playBeep(opts.urgent);
}
let audioCtx;
function playBeep(urgent) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g);
    g.connect(audioCtx.destination);
    o.type = "sine";
    o.frequency.value = urgent ? 1200 : 880;
    const t = audioCtx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (urgent ? 0.45 : 0.28));
    o.start(t);
    o.stop(t + (urgent ? 0.5 : 0.3));
    if (urgent) {
      const o2 = audioCtx.createOscillator();
      const g2 = audioCtx.createGain();
      o2.connect(g2); g2.connect(audioCtx.destination);
      o2.frequency.value = 1600;
      g2.gain.setValueAtTime(0.0001, t + 0.2);
      g2.gain.exponentialRampToValueAtTime(0.15, t + 0.22);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o2.start(t + 0.2);
      o2.stop(t + 0.55);
    }
  } catch (e) { /* ignore */ }
}

// ===== Auth =====
function initAuthListener() {
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      state.uid = null;
      showScreen("auth");
      return;
    }
    state.uid = user.uid;
    state.email = user.email;
    await loadUserProfile();
  });
}
async function signInEmail() {
  const email = $("auth-email").value.trim();
  const pw = $("auth-password").value;
  hideAuthError();
  try { await auth.signInWithEmailAndPassword(email, pw); }
  catch (e) { showAuthError(authErrorJa(e)); }
}
async function signUpEmail() {
  const email = $("auth-email").value.trim();
  const pw = $("auth-password").value;
  hideAuthError();
  if (pw.length < 6) return showAuthError("パスワードは6文字以上で入力してください");
  try { await auth.createUserWithEmailAndPassword(email, pw); }
  catch (e) { showAuthError(authErrorJa(e)); }
}
async function signInGoogle() {
  hideAuthError();
  try { await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
  catch (e) { showAuthError(authErrorJa(e)); }
}
function authErrorJa(e) {
  const code = e && e.code;
  const map = {
    "auth/invalid-email": "メールアドレスの形式が正しくありません",
    "auth/user-not-found": "ユーザーが見つかりません。新規登録してください",
    "auth/wrong-password": "パスワードが違います",
    "auth/email-already-in-use": "このメールはすでに登録されています",
    "auth/weak-password": "パスワードが弱すぎます（6文字以上）",
    "auth/popup-closed-by-user": "ログインがキャンセルされました",
    "auth/network-request-failed": "ネットワークエラーが発生しました"
  };
  return map[code] || (e && e.message) || "ログインに失敗しました";
}
function showAuthError(msg) { const el = $("auth-error"); el.textContent = msg; el.style.display = "block"; }
function hideAuthError() { $("auth-error").style.display = "none"; }
async function signOut() {
  await unregisterPushToken(state.familyId); // この端末への通知を止める
  detachListeners();
  state.uid = null; state.profile = null; state.familyId = null; state.family = null;
  state.requests = {}; state.stats = {}; state.prevRequests = {}; state.shortcuts = {}; state.stocks = {};
  state.missions = {}; state.missionLogs = {}; state.myRole = null;
  state.points = {}; state.rewards = {}; state.rewardLogs = {};
  await auth.signOut();
}

// ===== メンバー管理（保護者専用） =====
// 誤操作防止のため、アカウント削除は本人のボタンではなく保護者の管理機能として提供する。
// 実際の削除は Cloud Functions の deleteMemberAccount（Admin SDK）で行い、
// 保護者権限の検証・認証アカウントの削除・データ掃除をサーバー側で完結させる。
// 依頼・コメントは家族の記録として残る。

// 誤操作防止: 管理メニュー（アカウント削除等）はトグルで閉じておき、開いた時だけ操作できる
let memberAdminOpen = false;
function updateMemberAdminToggle() {
  const body = $("member-admin-body");
  const btn = $("btn-member-admin-toggle");
  if (!body || !btn) return;
  body.style.display = memberAdminOpen ? "" : "none";
  btn.classList.toggle("open", memberAdminOpen);
  btn.setAttribute("aria-expanded", String(memberAdminOpen));
  btn.innerHTML = memberAdminOpen
    ? '🔧 管理メニューを閉じる <span class="toggle-chevron">▴</span>'
    : '🔧 管理メニューを開く <span class="toggle-chevron">▾</span>';
}

// 設定タブのメンバー管理カードを描画（保護者にだけ表示）
function renderMemberAdmin() {
  const card = $("member-admin-card");
  if (!card) return;
  const isParent = state.myRole === "parent";
  card.style.display = isParent ? "" : "none";
  if (!isParent) return;
  const members = (state.family && state.family.members) || {};
  const sorted = Object.entries(members).sort(([, a], [, b]) => {
    const r = roleRank(a.memberRole) - roleRank(b.memberRole);
    if (r !== 0) return r;
    return (a.name || "").localeCompare(b.name || "", "ja");
  });
  $("member-admin-list").innerHTML = sorted.map(([uid, m]) => `
    <div class="row" style="justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--border);gap:8px;flex-wrap:wrap;">
      <span style="display:flex;align-items:center;gap:8px;min-width:0;">
        <span class="avatar sm">${escapeHtml(m.emoji || "👤")}</span>
        <span style="font-weight:700;font-size:14px;">${escapeHtml(m.name || "メンバー")}${uid === state.uid ? "（自分）" : ""}</span>
        <span class="muted" style="font-size:11px;">${ROLE_LABEL[m.memberRole] || "未設定"}</span>
      </span>
      <span style="display:flex;gap:6px;flex-shrink:0;">
        ${uid !== state.uid ? `<button class="ghost tiny-btn" style="font-size:11px;" data-admin-remove="${uid}" data-name="${escapeHtml(m.name || "メンバー")}">家族から外す</button>` : ""}
        <button class="danger tiny-btn" style="font-size:11px;" data-admin-delete="${uid}" data-name="${escapeHtml(m.name || "メンバー")}">アカウント削除</button>
      </span>
    </div>`).join("");
  $("member-admin-list").querySelectorAll("[data-admin-remove]").forEach((btn) => {
    btn.addEventListener("click", () => removeMemberFromFamily(btn.dataset.adminRemove, btn.dataset.name));
  });
  $("member-admin-list").querySelectorAll("[data-admin-delete]").forEach((btn) => {
    btn.addEventListener("click", () => adminDeleteAccount(btn.dataset.adminDelete, btn.dataset.name));
  });
  updateMemberAdminToggle();
}

// 家族から外す（アカウント自体は残る）
async function removeMemberFromFamily(targetUid, name) {
  if (!confirm(`${name} さんを家族から外しますか？\n\n外すと、この人はおうちの買い物リストやミッションを見られなくなります。（本人のアカウントは消えません）`)) return;
  const ok = await dbOp(Promise.all([
    familyRef().child(`members/${targetUid}`).remove(),
    familyRef().child(`stats/${targetUid}`).remove()
  ]), "外せませんでした");
  if (ok) showToast(`${name} さんを家族から外しました`, { sound: false });
}

// functions-compat SDK は「アカウント完全削除」でしか使わないため、起動時には
// 読み込まず、必要になった時点で読み込む（初期表示を速くするため）。
let functionsSdkPromise = null;
function loadFunctionsSdk() {
  if (!functionsSdkPromise) {
    functionsSdkPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = FIREBASE_SDK_BASE + "firebase-functions-compat.js";
      s.onload = () => resolve();
      s.onerror = () => { functionsSdkPromise = null; reject(new Error("通信環境を確認してもう一度お試しください")); };
      document.head.appendChild(s);
    });
  }
  return functionsSdkPromise;
}

// アカウント完全削除（Cloud Functions 経由・保護者のみ）
async function adminDeleteAccount(targetUid, name) {
  const isSelf = targetUid === state.uid;
  const first = isSelf
    ? "自分のアカウントを削除しますか？\n\nプロフィール・統計・ログインアカウントが削除されます。\n追加した依頼やコメントは家族の記録に残ります。"
    : `${name} さんのアカウントを完全に削除しますか？\n\n本人のプロフィール・統計・ログインアカウントが削除されます。\n追加した依頼やコメントは家族の記録に残ります。`;
  if (!confirm(first)) return;
  if (!confirm("本当に削除しますか？ この操作は元に戻せません。")) return;
  try {
    await loadFunctionsSdk();
    const fn = firebase.app().functions("asia-northeast1").httpsCallable("deleteMemberAccount");
    await fn({ familyId: state.familyId, targetUid });
    if (isSelf) {
      // 認証アカウントはサーバー側で削除済み。ローカルもサインアウト状態に揃える
      detachListeners();
      localStorage.removeItem("pushToken");
      state.uid = null; state.profile = null; state.familyId = null; state.family = null;
      state.requests = {}; state.stats = {}; state.prevRequests = {}; state.shortcuts = {}; state.stocks = {};
      state.missions = {}; state.missionLogs = {}; state.myRole = null;
  state.points = {}; state.rewards = {}; state.rewardLogs = {};
      showScreen("auth");
      showToast("アカウントを削除しました");
      try { await auth.signOut(); } catch (e) {}
    } else {
      showToast(`${name} さんのアカウントを削除しました`, { sound: false });
    }
  } catch (e) {
    console.error("adminDeleteAccount failed", e);
    const msg = (e && e.message) || String(e);
    // functions 未デプロイ時は not-found / internal で返る
    showToast("⚠️ 削除できませんでした: " + msg);
  }
}

// ===== User profile =====
async function loadUserProfile() {
  const snap = await db.ref("users/" + state.uid).once("value");
  const data = snap.val();
  if (!data || !data.name) {
    state.profile = null;
    state.profileEmoji = "🙂";
    renderEmojiPicker("emoji-picker", "profileEmoji");
    $("profile-name").value = "";
    showScreen("profile");
    return;
  }
  state.profile = { name: data.name, emoji: data.emoji || "🙂" };
  state.familyId = data.familyId || null;
  if (!state.familyId) { showScreen("family"); return; }
  attachFamilyListeners();
}
async function saveProfile() {
  const name = $("profile-name").value.trim();
  if (!name) return showToast("名前を入力してください");
  const profile = { name, emoji: state.profileEmoji, email: state.email, updatedAt: now() };
  await db.ref("users/" + state.uid).update(profile);
  state.profile = { name, emoji: state.profileEmoji };
  if (!state.familyId) showScreen("family");
  else attachFamilyListeners();
}
async function updateProfileFromSettings() {
  const name = $("set-name").value.trim();
  if (!name) return showToast("名前を入力してください");
  await db.ref("users/" + state.uid).update({ name, emoji: state.settingsEmoji });
  if (state.familyId) {
    await db.ref(`families/${state.familyId}/members/${state.uid}`).update({ name, emoji: state.settingsEmoji });
  }
  state.profile = { name, emoji: state.settingsEmoji };
  renderTopbar();
  showToast("プロフィールを更新しました");
}

// ===== Family =====
function genInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
async function createFamily() {
  const name = $("family-name").value.trim();
  if (!name) return showFamilyError("家族の名前を入力してください");
  const familyId = db.ref("families").push().key;
  let code = genInviteCode();
  // try a few times to avoid collision
  for (let i = 0; i < 5; i++) {
    const exist = await db.ref("invites/" + code).once("value");
    if (!exist.exists()) break;
    code = genInviteCode();
  }
  const ts = now();
  await db.ref("families/" + familyId).set({
    meta: { name, createdAt: ts, inviteCode: code, createdBy: state.uid },
    members: { [state.uid]: { name: state.profile.name, emoji: state.profile.emoji, joinedAt: ts, role: "admin", memberRole: "parent" } }
  });
  await db.ref("invites/" + code).set(familyId);
  await db.ref("users/" + state.uid + "/familyId").set(familyId);
  state.familyId = familyId;
  attachFamilyListeners();
}
async function joinFamily() {
  const code = $("invite-code").value.trim().toUpperCase();
  if (!code) return showFamilyError("招待コードを入力してください");
  try {
    const snap = await db.ref("invites/" + code).once("value");
    const familyId = snap.val();
    if (!familyId) return showFamilyError("招待コードが見つかりません");
    const ts = now();
    await db.ref(`families/${familyId}/members/${state.uid}`).set({
      name: state.profile.name, emoji: state.profile.emoji, joinedAt: ts, role: "member", memberRole: "child"
    });
    await db.ref("users/" + state.uid + "/familyId").set(familyId);
    state.familyId = familyId;
    attachFamilyListeners();
  } catch (e) {
    if (e && e.code === "PERMISSION_DENIED") {
      showFamilyError("参加できませんでした（セキュリティルールを確認してください）");
    } else {
      showFamilyError("エラーが発生しました: " + (e && e.message || e));
    }
  }
}
function showFamilyError(msg) { const el = $("family-error"); el.textContent = msg; el.style.display = "block"; }
function hideFamilyError() { $("family-error").style.display = "none"; }

// ===== Real-time listeners =====
const listenerRefs = [];
function attach(ref, event, cb, errCb) {
  ref.on(event, cb, errCb);
  listenerRefs.push({ ref, event, cb });
}
function detachListeners() {
  listenerRefs.forEach(({ ref, event, cb }) => ref.off(event, cb));
  listenerRefs.length = 0;
}
function familyRef() { return db.ref("families/" + state.familyId); }

// 家族から外された／アクセス権を失ったときの処理。
// メンバー一覧の読み取りが PERMISSION_DENIED になった = もう家族の一員ではない。
let familyAccessLost = false;
async function handleFamilyAccessLost(err) {
  if (familyAccessLost || !state.familyId) return;
  if (!err || err.code !== "PERMISSION_DENIED") return;
  familyAccessLost = true;
  detachListeners();
  try { await db.ref("users/" + state.uid + "/familyId").remove(); } catch (e) {}
  state.familyId = null; state.family = null; state.myRole = null;
  state.requests = {}; state.stats = {}; state.shortcuts = {}; state.stocks = {}; state.missions = {}; state.missionLogs = {};
  state.familySettings = {};
  state.points = {}; state.rewards = {}; state.rewardLogs = {};
  showScreen("family");
  showToast("家族から外れました");
}

function attachFamilyListeners() {
  detachListeners();
  state.prevRequests = {};
  familyAccessLost = false;
  // 各ストリームの「初回スナップショット」を判定するためのフラグ。
  // 初回（＝ページ読込時にもともと存在していたデータ）は通知しない。
  let requestsInit = false;
  let commentsInit = false;
  // Family meta + members
  attach(familyRef().child("meta"), "value", (s) => {
    state.family = state.family || {};
    state.family.meta = s.val() || {};
    renderTopbar();
    renderSettings();
  }, handleFamilyAccessLost);
  attach(familyRef().child("members"), "value", (s) => {
    state.family = state.family || {};
    state.family.members = s.val() || {};
    const myMember = (s.val() || {})[state.uid];
    state.myRole = myMember ? (myMember.memberRole || null) : null;
    renderTopbar();
    renderSettings();
    renderRequests();
    renderHistory();
    renderMissions();
    renderRewards();
  }, handleFamilyAccessLost);
  // Reminder times（家族共有の通知時刻）
  attach(familyRef().child("reminderTimes"), "value", (s) => {
    state.reminderTimes = s.val() || {};
    renderReminderTimes();
  });
  // 家族共通の設定（「そろそろ切れるかも」の予告日数など）
  attach(familyRef().child("settings"), "value", (s) => {
    state.familySettings = s.val() || {};
    renderLowLeadSetting();
    renderSuggestions();
    renderStocks();
  });
  // 通知許可済みならトークンをこの家族に登録し直す（ローテーション追従）
  registerPushToken();
  // Requests
  let _lastRequestsJson = "";
  let prevForDiff = {};
  attach(familyRef().child("requests"), "value", (s) => {
    const next = s.val() || {};
    const nextJson = JSON.stringify(next);
    const changed = nextJson !== _lastRequestsJson;
    _lastRequestsJson = nextJson;
    if (changed) {
      // 初回スナップショットでは通知しない（既存の依頼を新着扱いしない）
      if (requestsInit) detectAndNotify(state.prevRequests, next);
      state.prevRequests = next;
      state.requests = next;
    }
    requestsInit = true;
    if (changed) {
      // リアクションだけの変更なら、重い再描画（買い物リスト・提案・集計）は省き、
      // リアクションが表示される履歴だけ更新する
      const reactionOnly = onlyReactionsChanged(prevForDiff, next);
      prevForDiff = next;
      renderHistory();
      if (!reactionOnly) {
        renderRequests();
        renderBadge();
        renderMonthlySummary();
        renderSuggestions();
        renderStreak();
      }
    }
  }, handleFamilyAccessLost);
  // Stats
  attach(familyRef().child("stats"), "value", (s) => {
    state.stats = s.val() || {};
    renderStreak();
  });
  // Comments
  attach(db.ref(`families/${state.familyId}/comments`), "value", (s) => {
    const next = s.val() || {};
    // 初回スナップショットでは通知しない（既存コメントを新着扱いしない）。
    // 以前は共有フラグ muteNotifications を使っていたが、requests リスナーが
    // 先にフラグを解除すると初回コメントが毎回通知される不具合があったため、
    // コメント専用の初期化フラグで判定する。
    if (commentsInit) {
      Object.entries(next).forEach(([reqId, comments]) => {
        const prev = state.prevComments[reqId] || {};
        Object.entries(comments || {}).forEach(([cid, c]) => {
          if (!prev[cid] && c.authorUid !== state.uid) {
            const req = state.requests[reqId];
            const reqName = req ? req.name : "アイテム";
            showToast(`💬 ${escapeHtml(c.authorName)}さんが「${escapeHtml(reqName)}」にコメント`);
          }
        });
      });
    }
    commentsInit = true;
    state.prevComments = JSON.parse(JSON.stringify(next));
    state.comments = next;
    updateUnreadComments();
    renderRequests();
    renderHistory();
  }, handleFamilyAccessLost);
  // その他の支出（お使いリスト以外で買ったものの金額ログ）
  attach(familyRef().child("extraExpenses"), "value", (s) => {
    state.extraExpenses = s.val() || {};
    renderMonthlySummary();
  });
  // Shortcuts
  attach(familyRef().child("shortcuts"), "value", (s) => {
    state.shortcuts = s.val() || {};
    renderShortcuts();
    // カードの⭐（登録済み表示）も最新にする
    renderRequests();
    renderHistory();
  });
  // Stocks
  attach(familyRef().child("stocks"), "value", (s) => {
    state.stocks = s.val() || {};
    renderStocks();
    renderStockBadge();
    renderSuggestions(); // 「そろそろ切れるかも」にストックの残量が効くため
  });
  // Missions
  attach(familyRef().child("missions"), "value", (s) => {
    state.missions = s.val() || {};
    renderMissions();
    renderMissionBadge();
  });
  // Mission logs
  attach(familyRef().child("missionLogs"), "value", (s) => {
    state.missionLogs = s.val() || {};
    renderMissions();
    renderMissionBadge();
  });
  // ごほうびポイント
  // 付与はサーバー側で行われるため、自分の残高が増えたらトーストで知らせる
  // （初回スナップショットでは出さない）
  _prevOwnPoints = null;
  attach(familyRef().child("points"), "value", (s) => {
    state.points = s.val() || {};
    const mine = state.points[state.uid] || 0;
    if (_prevOwnPoints !== null && mine > _prevOwnPoints) {
      showToast(`🪙 +${mine - _prevOwnPoints}pt ゲット！`);
    }
    _prevOwnPoints = mine;
    renderRewards();
  });
  attach(familyRef().child("rewards"), "value", (s) => {
    state.rewards = s.val() || {};
    renderRewards();
  });
  attach(familyRef().child("rewardLogs"), "value", (s) => {
    state.rewardLogs = s.val() || {};
    renderRewards();
  });
  // ウィークリーミッション（進捗はサーバーが記録・クライアントは読むだけ）
  _prevWeeklyAwards = null;
  attach(familyRef().child("weekly"), "value", (s) => {
    state.weekly = s.val() || {};
    // 自分の達成が増えたらお祝いトースト（初回スナップショットは除外）
    const mine = ((state.weekly[weekKeyJST()] || {})[state.uid] || {}).awards || {};
    if (_prevWeeklyAwards !== null) {
      Object.keys(mine).forEach((mid) => {
        if (!_prevWeeklyAwards[mid]) {
          const m = WEEKLY_MISSIONS.find((x) => x.id === mid);
          if (m) showToast(`🎯 ウィークリーミッション「${m.title}」達成！`);
        }
      });
    }
    _prevWeeklyAwards = mine;
    renderWeeklyMissions();
  });
  showScreen("main");
  maybeShowOnboarding();
}

// ===== Comments =====
function unreadKey(reqId) { return `${state.familyId}_${reqId}_lv`; }
function markCommentsSeen(reqId) {
  localStorage.setItem(unreadKey(reqId), String(now()));
  state.unreadComments.delete(reqId);
}
function updateUnreadComments() {
  Object.entries(state.comments).forEach(([reqId, comments]) => {
    const lastViewed = parseInt(localStorage.getItem(unreadKey(reqId)) || '0');
    const hasNew = Object.values(comments || {}).some(c => c.createdAt > lastViewed && c.authorUid !== state.uid);
    if (hasNew) state.unreadComments.add(reqId);
    else state.unreadComments.delete(reqId);
  });
}
function toggleComments(reqId) {
  if (state.expandedItems.has(reqId)) {
    state.expandedItems.delete(reqId);
  } else {
    state.expandedItems.add(reqId);
    markCommentsSeen(reqId);
  }
  renderRequests();
  renderHistory();
}
async function postComment(reqId, text, parentId) {
  if (!text.trim()) return;
  const ref = db.ref(`families/${state.familyId}/comments/${reqId}`);
  const cid = ref.push().key;
  // 注: 以前はここで requests/{id}/lastCommentAt も更新していたが、どこからも
  // 参照されておらず、requests リスナーの全再描画を無駄に誘発するだけなので廃止。
  await dbOp(ref.child(cid).set({
    text: text.trim(),
    authorUid: state.uid,
    authorEmoji: state.profile.emoji,
    authorName: state.profile.name,
    createdAt: now(),
    parentId: parentId || null
  }), "コメントを送信できませんでした");
}
// 2つの requests スナップショットの差が「reactions だけ」かを判定する。
// リアクション1タップでリスト全体を作り直すのを避けるために使う。
function onlyReactionsChanged(prev, next) {
  const keys = new Set([...Object.keys(prev || {}), ...Object.keys(next || {})]);
  let sawReactionChange = false;
  for (const k of keys) {
    const a = (prev || {})[k], b = (next || {})[k];
    if (!a || !b) return false; // 追加/削除は通常の再描画へ
    const { reactions: ra, ...restA } = a;
    const { reactions: rb, ...restB } = b;
    if (JSON.stringify(restA) !== JSON.stringify(restB)) return false;
    if (JSON.stringify(ra || {}) !== JSON.stringify(rb || {})) sawReactionChange = true;
  }
  return sawReactionChange;
}

// ===== Notification diff =====
// 呼び出し側で初回スナップショットを除外しているため、ここでは差分のみ通知する。
function detectAndNotify(prev, next) {
  Object.entries(next).forEach(([id, r]) => {
    const before = prev[id];
    const requesterName = memberName(r.requestedBy);
    if (!before) {
      if (r.requestedBy !== state.uid) {
        showToast(`📣 ${requesterName}さんが依頼: ${r.name}`, { urgent: !!r.urgent });
      }
      return;
    }
    if (before.status !== r.status) {
      if (r.status === "claimed" && r.claimedBy && r.claimedBy !== state.uid) {
        showToast(`🙋 ${memberName(r.claimedBy)}さんが「${r.name}」に立候補しました`);
      } else if (r.status === "done" && r.completedBy && r.completedBy !== state.uid) {
        showToast(`✅ ${memberName(r.completedBy)}さんが「${r.name}」を買ってきました！`);
      } else if (r.status === "open" && before.status === "claimed") {
        showToast(`↩️ 「${r.name}」の担当が外れました`);
      }
    }
    // 自分が完了した物に家族から「ありがとう」リアクションが付いたら知らせる
    if (r.completedBy === state.uid) {
      const prevReactions = before.reactions || {};
      Object.entries(r.reactions || {}).forEach(([uid, emoji]) => {
        if (uid !== state.uid && prevReactions[uid] !== emoji) {
          showToast(`${emoji} ${memberName(uid)}さんから「${r.name}」にありがとう！`);
        }
      });
    }
  });
}
function memberName(uid) {
  if (!uid) return "";
  const m = state.family && state.family.members && state.family.members[uid];
  return m ? m.name : "誰か";
}
// 絵文字も DB 由来の文字列なので innerHTML へ入れる前にエスケープする（XSS対策）
function memberEmoji(uid) {
  const m = state.family && state.family.members && state.family.members[uid];
  return m && m.emoji ? escapeHtml(m.emoji) : "👤";
}

// ===== How-to modal =====
function openHowto() {
  $("howto-modal").classList.add("open");
  $("howto-modal-backdrop").classList.add("open");
}
function closeHowto() {
  $("howto-modal").classList.remove("open");
  $("howto-modal-backdrop").classList.remove("open");
}

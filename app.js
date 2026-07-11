// おうちのおつかい — アプリ本体のロジック（index.html から分離）
// 読み込み順: Firebase SDK → firebase-config.js → app.js（index.html の <script> 順で保証）
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
  shortcuts: {},
  stocks: {},
  missions: {},
  missionLogs: {},
  points: {},
  rewards: {},
  rewardLogs: {},
  myRole: null
};

const expandedGroups = new Set(["group-open", "group-claimed"]);
let editingRequestId = null;
let shortcutMode = false;

const $ = (id) => document.getElementById(id);
const now = () => Date.now();
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (m) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));

// ===== Firebase init =====
let auth, db;
if (isConfigured) {
  firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.database();
}

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

// アカウント完全削除（Cloud Functions 経由・保護者のみ）
async function adminDeleteAccount(targetUid, name) {
  const isSelf = targetUid === state.uid;
  const first = isSelf
    ? "自分のアカウントを削除しますか？\n\nプロフィール・統計・ログインアカウントが削除されます。\n追加した依頼やコメントは家族の記録に残ります。"
    : `${name} さんのアカウントを完全に削除しますか？\n\n本人のプロフィール・統計・ログインアカウントが削除されます。\n追加した依頼やコメントは家族の記録に残ります。`;
  if (!confirm(first)) return;
  if (!confirm("本当に削除しますか？ この操作は元に戻せません。")) return;
  try {
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
  // 通知許可済みならトークンをこの家族に登録し直す（ローテーション追従）
  registerPushToken();
  // Requests
  let _lastRequestsJson = "";
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
      renderRequests();
      renderHistory();
      renderBadge();
      renderMonthlySummary();
    }
  }, handleFamilyAccessLost);
  // Stats
  attach(familyRef().child("stats"), "value", (s) => {
    state.stats = s.val() || {};
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
  // Shortcuts
  attach(familyRef().child("shortcuts"), "value", (s) => {
    state.shortcuts = s.val() || {};
    renderShortcuts();
  });
  // Stocks
  attach(familyRef().child("stocks"), "value", (s) => {
    state.stocks = s.val() || {};
    renderStocks();
    renderStockBadge();
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
  attach(familyRef().child("points"), "value", (s) => {
    state.points = s.val() || {};
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
  showScreen("main");
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

// ===== Category =====
// 固定3種のカテゴリ。任意入力（未選択 = 分類なし）。
const CATEGORY = {
  food:  { emoji: "🍎", label: "食品",   order: 0 },
  daily: { emoji: "🧻", label: "日用品", order: 1 },
  other: { emoji: "📦", label: "その他", order: 2 },
};
const CATEGORY_NONE_ORDER = 3; // 未分類はカテゴリ付きの後ろに並べる
let selectedCategory = null;

function setSelectedCategory(cat) {
  selectedCategory = cat && CATEGORY[cat] ? cat : null;
  document.querySelectorAll("#new-category .cat-chip").forEach((b) => {
    b.classList.toggle("selected", b.dataset.cat === selectedCategory);
  });
}
function wireCategoryChips() {
  document.querySelectorAll("#new-category .cat-chip").forEach((b) => {
    b.addEventListener("click", () => {
      // 同じチップをもう一度タップで解除
      setSelectedCategory(b.dataset.cat === selectedCategory ? null : b.dataset.cat);
    });
  });
}
function categoryOrder(r) {
  return r.category && CATEGORY[r.category] ? CATEGORY[r.category].order : CATEGORY_NONE_ORDER;
}

// ===== Bottom sheet =====
function resetSheetToAddMode() {
  editingRequestId = null;
  shortcutMode = false;
  document.querySelector("#sheet-add .sheet-title").textContent = "🛍️ おつかいを追加";
  $("btn-add-request").textContent = "追加する";
  $("new-name").value = "";
  $("new-memo").value = "";
  $("new-budget").value = "";
  $("new-brand").value = "";
  $("new-urgent").checked = false;
  $("new-diff").value = "normal";
  $("new-assignee").value = "";
  setSelectedCategory(null);
}
// 指名セレクト（#new-assignee）にメンバー一覧を注入する（自分は除外）
function populateAssigneeSelect(suffix = "に頼む") {
  const sel = $("new-assignee");
  sel.innerHTML = '<option value="">👥 誰でもOK（指名なし）</option>';
  const members = state.family && state.family.members ? state.family.members : {};
  Object.entries(members).forEach(([uid, m]) => {
    if (uid === state.uid) return;
    const opt = document.createElement("option");
    opt.value = uid;
    opt.textContent = (m.emoji || "👤") + " " + (m.name || "メンバー") + suffix;
    sel.appendChild(opt);
  });
}
function openSheet() {
  populateAssigneeSelect();
  $("sheet-add").classList.add("open");
  $("sheet-backdrop").classList.add("open");
  $("fab-add").classList.add("open");
  setTimeout(() => $("new-name").focus(), 350);
}
function closeSheet() {
  $("sheet-add").classList.remove("open");
  $("sheet-backdrop").classList.remove("open");
  $("fab-add").classList.remove("open");
  resetSheetToAddMode();
}

// ===== Request CRUD =====
// Firebase 書き込みの共通エラーハンドラ。
// 失敗（権限・通信）をユーザーに知らせずに成功トーストを出さないため、
// 書き込みは必ずこれを通し、false が返ったら後続処理を中断する。
async function dbOp(promise, errMsg = "保存できませんでした") {
  try { await promise; return true; }
  catch (e) {
    console.error(errMsg, e);
    const denied = e && e.code === "PERMISSION_DENIED";
    showToast(`⚠️ ${errMsg}${denied ? "（権限がありません）" : "。通信環境を確認してください"}`);
    return false;
  }
}

let addingRequest = false; // 二度押し防止
async function addRequest() {
  const name = $("new-name").value.trim();
  if (!name) return showToast("品名を入力してください");
  if (addingRequest) return;
  addingRequest = true;
  try {
    const diff = $("new-diff").value;
    const urgent = $("new-urgent").checked;
    const memo = $("new-memo").value.trim();
    const budget = parseInt($("new-budget").value, 10);
    const brand = $("new-brand").value.trim();
    const id = familyRef().child("requests").push().key;
    const ts = now();
    const assignedTo = $("new-assignee").value;
    const req = { name, diff, urgent, status: "open", requestedBy: state.uid, requestedAt: ts };
    if (memo) req.memo = memo;
    if (budget > 0) req.budget = budget;
    if (brand) req.brand = brand;
    if (assignedTo) req.assignedTo = assignedTo;
    if (selectedCategory) req.category = selectedCategory;
    if (!(await dbOp(familyRef().child("requests/" + id).set(req), "追加できませんでした"))) return;
    bumpStat("requestedCount");
    $("new-name").value = "";
    $("new-memo").value = "";
    $("new-budget").value = "";
    $("new-brand").value = "";
    $("new-urgent").checked = false;
    $("new-assignee").value = "";
    closeSheet();
    showToast("追加しました 🛒", { sound: false });
  } finally {
    addingRequest = false;
  }
}
function openEditSheet(r) {
  editingRequestId = r.id;
  populateAssigneeSelect();
  // フィールドに既存値を注入
  $("new-name").value = r.name || "";
  $("new-diff").value = r.diff || "normal";
  $("new-urgent").checked = !!r.urgent;
  $("new-memo").value = r.memo || "";
  $("new-budget").value = r.budget > 0 ? r.budget : "";
  $("new-brand").value = r.brand || "";
  $("new-assignee").value = r.assignedTo || "";
  setSelectedCategory(r.category || null);
  // 編集モード UI
  document.querySelector("#sheet-add .sheet-title").textContent = "✏️ おつかいを編集";
  $("btn-add-request").textContent = "更新する";
  $("sheet-add").classList.add("open");
  $("sheet-backdrop").classList.add("open");
  $("fab-add").classList.add("open");
  setTimeout(() => $("new-name").focus(), 350);
}
async function updateRequest() {
  if (!editingRequestId) return;
  const name = $("new-name").value.trim();
  if (!name) return showToast("品名を入力してください");
  const diff = $("new-diff").value;
  const urgent = $("new-urgent").checked;
  const memo = $("new-memo").value.trim();
  const budget = parseInt($("new-budget").value, 10);
  const brand = $("new-brand").value.trim();
  const assignedTo = $("new-assignee").value;
  const updates = { name, diff, urgent };
  updates.memo = memo || null;
  updates.budget = budget > 0 ? budget : null;
  updates.brand = brand || null;
  updates.assignedTo = assignedTo || null;
  updates.category = selectedCategory || null;
  if (!(await dbOp(familyRef().child("requests/" + editingRequestId).update(updates), "更新できませんでした"))) return;
  closeSheet();
  showToast("更新しました ✏️");
}
async function addShortcut() {
  const name = $("new-name").value.trim();
  if (!name) return showToast("品名を入力してください");
  const diff = $("new-diff").value;
  const urgent = $("new-urgent").checked;
  const ref = familyRef().child("shortcuts").push();
  if (!(await dbOp(ref.set({ name, diff, urgent: urgent || false, createdAt: now(), createdBy: state.uid }), "登録できませんでした"))) return;
  closeSheet();
  showToast(`⭐ 「${name}」をショートカット登録しました`);
}
async function deleteShortcut(id) {
  await dbOp(familyRef().child("shortcuts/" + id).remove(), "削除できませんでした");
}
async function addFromShortcut(s) {
  const id = familyRef().child("requests").push().key;
  const req = { name: s.name, diff: s.diff || "normal", urgent: s.urgent || false, status: "open", requestedBy: state.uid, requestedAt: now() };
  if (s.memo) req.memo = s.memo;
  if (s.budget > 0) req.budget = s.budget;
  if (s.brand) req.brand = s.brand;
  if (s.assignedTo) req.assignedTo = s.assignedTo;
  if (s.category) req.category = s.category;
  if (!(await dbOp(familyRef().child("requests/" + id).set(req), "追加できませんでした"))) return;
  bumpStat("requestedCount");
  showToast(`🛒 「${s.name}」を追加しました`);
}
function updateShortcutVisibility() {
  const wrap = $("shortcut-float-wrap");
  if (!wrap) return;
  wrap.style.display = state.activeTab === "requests" ? "flex" : "none";
}
function openShortcutRegisterSheet() {
  shortcutMode = true;
  editingRequestId = null;
  closeShortcutPanel();
  populateAssigneeSelect("");
  // フィールドをクリア
  $("new-name").value = "";
  $("new-memo").value = "";
  $("new-budget").value = "";
  $("new-brand").value = "";
  $("new-urgent").checked = false;
  $("new-diff").value = "normal";
  $("new-assignee").value = "";
  // ショートカット登録モード UI
  document.querySelector("#sheet-add .sheet-title").textContent = "⭐ よく買うものを登録";
  $("btn-add-request").textContent = "登録する";
  $("sheet-add").classList.add("open");
  $("sheet-backdrop").classList.add("open");
  $("fab-add").classList.add("open");
  setTimeout(() => $("new-name").focus(), 350);
}
async function addShortcutFromSheet() {
  const name = $("new-name").value.trim();
  if (!name) return showToast("品名を入力してください");
  const diff = $("new-diff").value;
  const urgent = $("new-urgent").checked;
  const memo = $("new-memo").value.trim();
  const budget = parseInt($("new-budget").value, 10);
  const brand = $("new-brand").value.trim();
  const assignedTo = $("new-assignee").value;
  const entry = { name, diff, urgent: urgent || false, createdAt: now(), createdBy: state.uid };
  if (memo) entry.memo = memo;
  if (budget > 0) entry.budget = budget;
  if (brand) entry.brand = brand;
  if (assignedTo) entry.assignedTo = assignedTo;
  if (selectedCategory) entry.category = selectedCategory;
  const ref = familyRef().child("shortcuts").push();
  if (!(await dbOp(ref.set(entry), "登録できませんでした"))) return;
  closeSheet();
  showToast(`⭐ 「${name}」をよく買うものに登録しました`);
}
function renderShortcuts() {
  const wrap = $("shortcut-float-wrap");
  const btn = $("btn-shortcut-toggle");
  const chips = $("shortcut-chips");
  if (!wrap || !btn || !chips) return;
  const entries = Object.entries(state.shortcuts);
  updateShortcutVisibility();
  const count = entries.length;
  btn.innerHTML = `<span style="font-size:17px;line-height:1;">⚡</span> よく買うもの${count ? ` <span style="background:rgba(255,255,255,0.25);border-radius:99px;padding:1px 7px;font-size:11px;font-weight:800;">${count}</span>` : ''}`;
  if (!count) {
    chips.innerHTML = `<p class="shortcut-chips-empty">まだ登録がありません。「＋ よく買うものを登録」から追加してください。</p>`;
  } else {
    chips.innerHTML = entries.map(([id, s]) => {
      const hints = [];
      if (s.budget > 0) hints.push(`💰${Number(s.budget).toLocaleString()}円`);
      if (s.brand) hints.push(`🏷️${escapeHtml(s.brand)}`);
      if (s.assignedTo) {
        const m = (state.family && state.family.members && state.family.members[s.assignedTo]);
        if (m) hints.push(`👤${escapeHtml(m.name || '')}`);
      }
      const hintHtml = hints.length ? `<span class="shortcut-chip-hints">${hints.join(' ')}</span>` : '';
      return `
      <button class="shortcut-chip" data-sid="${id}">
        <span class="shortcut-chip-label">${s.urgent ? '🔥 ' : ''}${escapeHtml(s.name)}</span>
        ${hintHtml}
        <span class="chip-delete" data-del="${id}" role="button" aria-label="削除">×</span>
      </button>`;
    }).join("");
  }
  chips.querySelectorAll(".shortcut-chip").forEach(chip => {
    chip.addEventListener("click", (e) => {
      if (e.target.closest(".chip-delete")) return;
      const s = state.shortcuts[chip.dataset.sid];
      if (s) { addFromShortcut(s); closeShortcutPanel(); }
    });
  });
  chips.querySelectorAll(".chip-delete").forEach(del => {
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteShortcut(del.dataset.del);
    });
  });
}
function closeShortcutPanel() {
  const panel = $("shortcut-panel");
  const btn = $("btn-shortcut-toggle");
  if (panel) panel.classList.remove("open");
  if (btn) btn.classList.remove("open");
}
async function claimRequest(id) {
  // トランザクションで「open のときだけ」立候補する。
  // 2人が同時に押しても後から来た方は中断され、担当の上書きと統計の二重加算を防ぐ。
  try {
    const res = await familyRef().child("requests/" + id).transaction((cur) => {
      if (cur === null) return cur;       // まだローカルに無い/削除済み → そのまま
      if (cur.status !== "open") return;  // 先に誰かが立候補 → 中断
      return { ...cur, status: "claimed", claimedBy: state.uid, claimedAt: now() };
    });
    const after = res.snapshot ? res.snapshot.val() : null;
    if (!res.committed || !after || after.claimedBy !== state.uid) {
      if (after && after.claimedBy && after.claimedBy !== state.uid) {
        showToast(`🙋 ひと足先に${memberName(after.claimedBy)}さんが立候補していました`);
      }
      return;
    }
    bumpStat("claimedCount");
  } catch (e) {
    console.error(e);
    showToast("⚠️ 立候補できませんでした。通信環境を確認してください");
  }
}
async function unclaimRequest(id) {
  await dbOp(familyRef().child("requests/" + id).update({
    status: "open", claimedBy: null, claimedAt: null
  }), "変更できませんでした");
}
// ===== ごほうびポイント =====
// おつかい完了で獲得。難易度が基本値（ふつう1 / ちょっと大変2 / めちゃ大変3）、急ぎは+1。
// 難易度・急ぎから決定的に計算できるので、完了取り消し時は同額を返却できる。
function requestPoints(r) {
  const base = r.diff === "extreme" ? 3 : r.diff === "hard" ? 2 : 1;
  return base + (r.urgent ? 1 : 0);
}
// ポイント残高を増減する（残高が負にならないようクランプ）。おまけ機能なので失敗は握りつぶす。
async function adjustPoints(uid, delta) {
  if (!uid || !delta) return;
  try {
    await familyRef().child(`points/${uid}`).transaction((v) => Math.max(0, (v || 0) + delta));
  } catch (e) { console.error("adjustPoints failed", e); }
}

async function completeRequest(id) {
  const r = state.requests[id];
  if (!(await dbOp(familyRef().child("requests/" + id).update({
    status: "done", completedBy: state.uid, completedAt: now()
  }), "完了にできませんでした"))) return;
  bumpStat("completedCount");
  const pts = requestPoints(r || {});
  adjustPoints(state.uid, pts);
  showToast(`✅ 完了！ 🪙 +${pts}pt ゲット`, { sound: false });
}
async function reopenRequest(id) {
  // 取り消し時は、完了時に付与したポイントを返却する（誰が戻しても完了者から引く）
  const r = state.requests[id];
  const refund = r && r.status === "done" && r.completedBy ? { uid: r.completedBy, pts: requestPoints(r) } : null;
  if (!(await dbOp(familyRef().child("requests/" + id).update({
    status: "open", completedBy: null, completedAt: null, claimedBy: null, claimedAt: null
  }), "戻せませんでした"))) return;
  if (refund) adjustPoints(refund.uid, -refund.pts);
}
async function deleteRequest(id) {
  const r = state.requests[id];
  const label = r && r.name ? `「${r.name}」` : "この依頼";
  if (!confirm(`${label}を削除しますか？\n\n一度削除すると元に戻せません。`)) return;
  await dbOp(familyRef().child("requests/" + id).remove(), "削除できませんでした");
}
async function bumpStat(field) {
  // 統計はおまけなので、失敗しても本処理を止めない（エラートーストも出さない）
  try {
    const ref = familyRef().child(`stats/${state.uid}/${field}`);
    await ref.transaction((v) => (v || 0) + 1);
    await familyRef().child(`stats/${state.uid}/lastActiveAt`).set(now());
  } catch (e) { console.error("bumpStat failed", e); }
}

// ===== ごほうび（ミッションタブ） =====
function renderRewards() {
  const el = $("rewards-section");
  if (!el) return;
  const myPts = (state.points && state.points[state.uid]) || 0;
  const isParent = state.myRole === "parent";
  const rewards = Object.entries(state.rewards || {})
    .sort(([, a], [, b]) => (a.cost || 0) - (b.cost || 0));
  const logs = Object.entries(state.rewardLogs || {})
    .map(([id, l]) => ({ id, ...l }))
    .sort((a, b) => (b.at || 0) - (a.at || 0))
    .slice(0, 5);

  let html = `<div class="card">
    <h2>🎁 ごほうび</h2>
    <div class="reward-balance">🪙 じぶんのポイント：<b>${myPts}</b> pt</div>
    <p class="muted" style="font-size:11px;margin:4px 0 10px;">おつかい完了でポイントが貯まります（ふつう1pt・💪2pt・😅3pt、🔥急ぎは+1pt）</p>`;
  if (!rewards.length) {
    html += `<p class="muted" style="font-size:12px;">${isParent
      ? "下の入力欄から、ポイントと交換できるごほうびを登録しましょう。"
      : "まだごほうびがありません。保護者に登録してもらいましょう。"}</p>`;
  } else {
    html += rewards.map(([id, rw]) => `
      <div class="reward-row">
        <span class="reward-name">${escapeHtml(rw.name)}</span>
        <span class="reward-cost">🪙 ${Number(rw.cost) || 0}pt</span>
        <button class="success tiny-btn" data-redeem="${id}" ${myPts < rw.cost ? "disabled" : ""}>交換する</button>
        ${isParent ? `<button class="danger tiny-btn" data-reward-del="${id}" aria-label="ごほうびを削除">×</button>` : ""}
      </div>`).join("");
  }
  if (isParent) {
    html += `<div class="row" style="gap:6px;margin-top:10px;">
      <input id="reward-name-input" placeholder="ごほうび名（例: アイス）" maxlength="30" style="flex:2;min-width:0;" />
      <input id="reward-cost-input" type="number" min="1" max="9999" placeholder="pt" style="flex:0.8;min-width:56px;" />
      <button id="btn-add-reward" class="ghost tiny-btn" style="white-space:nowrap;">＋ 追加</button>
    </div>`;
  }
  if (logs.length) {
    html += `<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:8px;">` +
      logs.map((l) => `<div class="muted" style="font-size:12px;padding:2px 0;">${memberEmoji(l.uid)} ${escapeHtml(memberName(l.uid))}さんが「${escapeHtml(l.name)}」と交換（${Number(l.cost) || 0}pt）・<span data-timeago="${l.at}">${timeAgo(l.at)}</span></div>`).join("") +
      `</div>`;
  }
  html += `</div>`;
  el.innerHTML = html;

  el.querySelectorAll("[data-redeem]").forEach((b) => b.addEventListener("click", () => redeemReward(b.dataset.redeem)));
  el.querySelectorAll("[data-reward-del]").forEach((b) => b.addEventListener("click", () => deleteReward(b.dataset.rewardDel)));
  const addBtn = el.querySelector("#btn-add-reward");
  if (addBtn) addBtn.addEventListener("click", addReward);
}

async function addReward() {
  const name = $("reward-name-input").value.trim();
  const cost = parseInt($("reward-cost-input").value, 10);
  if (!name) return showToast("ごほうび名を入力してください");
  if (!(cost > 0)) return showToast("必要ポイントを入力してください");
  const ref = familyRef().child("rewards").push();
  if (!(await dbOp(ref.set({ name, cost, createdBy: state.uid, createdAt: now() }), "登録できませんでした"))) return;
  showToast(`🎁 「${name}」を登録しました`, { sound: false });
}

async function deleteReward(id) {
  const rw = state.rewards[id];
  if (!rw) return;
  if (!confirm(`ごほうび「${rw.name}」を削除しますか？`)) return;
  await dbOp(familyRef().child("rewards/" + id).remove(), "削除できませんでした");
}

async function redeemReward(id) {
  const rw = state.rewards[id];
  if (!rw) return;
  if (!confirm(`「${rw.name}」を ${rw.cost}pt で交換しますか？`)) return;
  try {
    // トランザクションで残高を確認しながら引く（不足していたら中断）
    const res = await familyRef().child(`points/${state.uid}`).transaction((v) => {
      const cur = v || 0;
      if (cur < rw.cost) return;
      return cur - rw.cost;
    });
    if (!res.committed) { showToast("🪙 ポイントが足りません"); return; }
    await familyRef().child("rewardLogs").push().set({
      rewardId: id, name: rw.name, cost: rw.cost, uid: state.uid, at: now()
    });
    showToast(`🎉 「${rw.name}」と交換しました！保護者に見せてね`);
  } catch (e) {
    console.error("redeemReward failed", e);
    showToast("⚠️ 交換できませんでした。通信環境を確認してください");
  }
}

// ===== Stock Management =====
const STOCK_LEVEL = {
  ok:  { emoji: "🟢", label: "たっぷり" },
  low: { emoji: "🟡", label: "少ない" },
  out: { emoji: "🔴", label: "切れた" }
};
const STOCK_NEXT = { ok: "low", low: "out", out: "ok" };
let stockAddLevel = "ok";

function openStockSheet() {
  stockAddLevel = "ok";
  document.querySelectorAll(".slp-btn").forEach((b) => b.classList.toggle("active", b.dataset.lvl === "ok"));
  $("stock-name").value = "";
  $("stock-memo").value = "";
  $("stock-budget").value = "";
  $("stock-photo-input").value = "";
  $("stock-photo-preview-wrap").innerHTML = '<span class="stock-photo-placeholder">📷 タップして写真を選ぶ</span>';
  $("stock-sheet").classList.add("open");
  $("sheet-backdrop").classList.add("open");
  $("fab-add").classList.add("open");
  setTimeout(() => $("stock-name").focus(), 350);
}
function closeStockSheet() {
  $("stock-sheet").classList.remove("open");
  $("sheet-backdrop").classList.remove("open");
  $("fab-add").classList.remove("open");
}
// 写真プレビュー
document.addEventListener("DOMContentLoaded", () => {
  $("stock-photo-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      $("stock-photo-preview-wrap").innerHTML = `<img class="stock-photo-preview" src="${ev.target.result}" alt="プレビュー" />`;
    };
    reader.readAsDataURL(file);
  });
});
async function uploadStockPhoto(file, stockId) {
  const storage = firebase.storage();
  const ref = storage.ref(`families/${state.familyId}/stocks/${stockId}`);
  await ref.put(file);
  return await ref.getDownloadURL();
}
async function addStock() {
  const name = $("stock-name").value.trim();
  if (!name) return showToast("商品名を入力してください");
  const memo = $("stock-memo").value.trim();
  const budget = parseInt($("stock-budget").value, 10);
  const photoFile = $("stock-photo-input").files[0];
  const addBtn = $("btn-add-stock");
  if (addBtn && addBtn.disabled) return; // アップロード中の二度押し防止
  if (addBtn) addBtn.disabled = true;
  try {
    const id = familyRef().child("stocks").push().key;
    const item = { name, level: stockAddLevel, updatedBy: state.uid, updatedAt: now() };
    if (memo) item.memo = memo;
    if (budget > 0) item.budget = budget;
    if (photoFile) {
      showToast("写真をアップロード中...", { sound: false });
      try {
        item.photoUrl = await uploadStockPhoto(photoFile, id);
      } catch (e) {
        showToast("写真のアップロードに失敗しました");
      }
    }
    if (!(await dbOp(familyRef().child("stocks/" + id).set(item), "登録できませんでした"))) return;
    closeStockSheet();
    showToast("登録しました 📦", { sound: false });
  } finally {
    if (addBtn) addBtn.disabled = false;
  }
}
async function updateStockLevel(id, level) {
  await dbOp(familyRef().child(`stocks/${id}`).update({ level, updatedBy: state.uid, updatedAt: now() }), "変更できませんでした");
}
async function deleteStock(id) {
  const s = state.stocks[id];
  if (!s) return;
  if (!confirm(`「${s.name}」をストックから削除しますか？\n\n一度削除すると元に戻せません。`)) return;
  if (!(await dbOp(familyRef().child("stocks/" + id).remove(), "削除できませんでした"))) return;
  showToast(`「${s.name}」を削除しました`, { sound: false });
}
async function addStockToRequest(s) {
  const id = familyRef().child("requests").push().key;
  const req = { name: s.name, diff: "normal", urgent: s.level === "out", status: "open", requestedBy: state.uid, requestedAt: now() };
  if (s.budget > 0) req.budget = s.budget;
  if (s.memo) req.brand = s.memo;
  if (!(await dbOp(familyRef().child("requests/" + id).set(req), "追加できませんでした"))) return;
  bumpStat("requestedCount");
  showToast(`🛒 「${s.name}」をお買い物リストに追加しました`);
}
function stockCard(s, i) {
  const lvl = STOCK_LEVEL[s.level] || STOCK_LEVEL.ok;
  const metaChips = [];
  if (s.budget > 0) metaChips.push(`💰 ${Number(s.budget).toLocaleString()}円以下`);
  if (s.memo) metaChips.push(`📝 ${escapeHtml(s.memo)}`);
  const metaHtml = metaChips.length
    ? `<div class="stock-meta">${metaChips.map(c => `<span class="stock-meta-chip">${c}</span>`).join("")}</div>`
    : "";
  return `
    <div class="stock-item" data-sid="${s.id}" style="--i:${i};cursor:pointer;">
      <button class="stock-level-btn ${s.level}" data-sid="${s.id}" data-act="cycle" title="タップでレベルを変更">
        ${lvl.emoji}
      </button>
      ${s.photoUrl ? `<img class="stock-img" src="${escapeHtml(s.photoUrl)}" alt="${escapeHtml(s.name)}" />` : ""}
      <div class="stock-info">
        <span class="stock-name">${escapeHtml(s.name)}</span>
        ${metaHtml}
      </div>
      <button class="stock-delete-btn" data-sid="${s.id}" data-act="delete" aria-label="削除">×</button>
    </div>`;
}
function renderStocks() {
  const items = Object.entries(state.stocks).map(([id, s]) => ({ id, ...s }));
  const empty = $("stock-empty");
  if (!empty) return;
  if (items.length === 0) {
    empty.style.display = "";
    $("stock-out-section").innerHTML = "";
    $("stock-low-section").innerHTML = "";
    $("stock-ok-section").innerHTML = "";
    return;
  }
  empty.style.display = "none";
  const byLevel = { out: [], low: [], ok: [] };
  items.forEach((s) => { (byLevel[s.level] || byLevel.ok).push(s); });
  Object.values(byLevel).forEach((arr) => arr.sort((a, b) => a.name.localeCompare(b.name, "ja")));
  $("stock-out-section").innerHTML = byLevel.out.length
    ? sectionHtml("🔴 切れてる", byLevel.out.length, byLevel.out.map((s, i) => stockCard(s, i)).join("")) : "";
  $("stock-low-section").innerHTML = byLevel.low.length
    ? sectionHtml("🟡 残り少ない", byLevel.low.length, byLevel.low.map((s, i) => stockCard(s, i)).join("")) : "";
  $("stock-ok-section").innerHTML = byLevel.ok.length
    ? sectionHtml("🟢 たっぷりある", byLevel.ok.length, byLevel.ok.map((s, i) => stockCard(s, i)).join("")) : "";
  wireStockButtons();
}
function wireStockButtons() {
  document.querySelectorAll(".stock-item [data-act]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation(); // prevent opening detail sheet
      const id = btn.dataset.sid;
      const act = btn.dataset.act;
      const s = state.stocks[id];
      if (!s) return;
      if (act === "cycle")  updateStockLevel(id, STOCK_NEXT[s.level] || "ok");
      else if (act === "delete") deleteStock(id);
    });
  });
  document.querySelectorAll(".stock-item").forEach(item => {
    item.addEventListener("click", () => {
      const id = item.dataset.sid;
      if (id) openStockDetail(id);
    });
  });
}

// ===== Stock detail sheet =====
function openStockDetail(id) {
  const s = state.stocks[id];
  if (!s) return;
  const lvl = STOCK_LEVEL[s.level] || STOCK_LEVEL.ok;
  $("stock-detail-title").textContent = s.name;
  $("stock-detail-body").innerHTML = `
    ${s.photoUrl ? `<img src="${escapeHtml(s.photoUrl)}" style="width:100%;max-height:200px;object-fit:cover;border-radius:var(--r-md);margin-bottom:16px;" />` : ""}
    <div class="row" style="gap:14px;margin-bottom:14px;align-items:center;">
      <div style="font-size:36px;line-height:1;">${lvl.emoji}</div>
      <div>
        <div style="font-size:18px;font-weight:800;letter-spacing:-0.4px;">${escapeHtml(s.name)}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px;font-weight:600;">${lvl.label}</div>
      </div>
    </div>
    ${s.memo || s.budget > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;">
      ${s.budget > 0 ? `<span class="req-hint">💰 ${Number(s.budget).toLocaleString()}円以下</span>` : ""}
      ${s.memo ? `<span class="req-hint">📝 ${escapeHtml(s.memo)}</span>` : ""}
    </div>` : ""}
    <div style="margin-bottom:16px;">
      <div style="font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">在庫レベルを変更</div>
      <div class="stock-level-picker">
        <button class="slp-btn${s.level === 'ok' ? ' active' : ''}" data-detail-lvl="ok" data-sid="${id}">🟢 たっぷり</button>
        <button class="slp-btn${s.level === 'low' ? ' active' : ''}" data-detail-lvl="low" data-sid="${id}">🟡 少ない</button>
        <button class="slp-btn${s.level === 'out' ? ' active' : ''}" data-detail-lvl="out" data-sid="${id}">🔴 切れた</button>
      </div>
    </div>
    <button id="btn-stock-detail-add" class="success" style="width:100%;margin-bottom:8px;">🛒 買い物リストに追加</button>
    <button id="btn-stock-detail-delete" class="danger" style="width:100%;">🗑️ ストックから削除</button>
  `;
  $("stock-detail-body").querySelectorAll("[data-detail-lvl]").forEach(btn => {
    btn.addEventListener("click", () => {
      updateStockLevel(btn.dataset.sid, btn.dataset.detailLvl);
      $("stock-detail-body").querySelectorAll("[data-detail-lvl]").forEach(b => b.classList.toggle("active", b === btn));
    });
  });
  $("btn-stock-detail-add").addEventListener("click", () => {
    addStockToRequest({ ...s, id });
    closeStockDetail();
  });
  $("btn-stock-detail-delete").addEventListener("click", async () => {
    closeStockDetail();
    await deleteStock(id);
  });
  $("stock-detail-sheet").classList.add("open");
  $("sheet-backdrop").classList.add("open");
}
function closeStockDetail() {
  $("stock-detail-sheet").classList.remove("open");
  $("sheet-backdrop").classList.remove("open");
}
function renderStockBadge() {
  const badge = $("badge-stock");
  if (!badge) return;
  const urgentCount = Object.values(state.stocks).filter((s) => s.level === "out" || s.level === "low").length;
  if (urgentCount > 0 && state.activeTab !== "stock") {
    badge.textContent = urgentCount;
    badge.style.display = "";
  } else {
    badge.style.display = "none";
  }
}

// ===== Mission Management =====
function openMissionSheet() {
  $("mission-title-input").value = "";
  $("mission-target").value = "";
  $("mission-reward-input").value = "";
  // 子どもメンバーのみセレクトに注入
  const sel = $("mission-assignee");
  sel.innerHTML = '<option value="">-- 子どもを選んでください --</option>';
  const members = state.family && state.family.members ? state.family.members : {};
  Object.entries(members).forEach(([uid, m]) => {
    if (m.memberRole !== "child") return;
    const opt = document.createElement("option");
    opt.value = uid;
    opt.textContent = (m.emoji || "👤") + " " + (m.name || "メンバー");
    sel.appendChild(opt);
  });
  $("mission-sheet").classList.add("open");
  $("sheet-backdrop").classList.add("open");
  $("fab-add").classList.add("open");
  setTimeout(() => $("mission-title-input").focus(), 350);
}
function closeMissionSheet() {
  $("mission-sheet").classList.remove("open");
  $("sheet-backdrop").classList.remove("open");
  $("fab-add").classList.remove("open");
}
async function saveMyRole(role) {
  if (!state.familyId) return;
  await familyRef().child(`members/${state.uid}/memberRole`).set(role);
  state.myRole = role;
  renderMissions();
  renderSettings();
  showToast(role === "parent" ? "👨‍👩‍👧 親として設定しました" : "👧 子どもとして設定しました", { sound: false });
}
async function addMission() {
  const assignedTo = $("mission-assignee").value;
  const title = $("mission-title-input").value.trim();
  const targetCount = parseInt($("mission-target").value, 10);
  const reward = parseInt($("mission-reward-input").value, 10);
  if (!assignedTo) return showToast("担当する子どもを選んでください");
  if (!title) return showToast("ミッション名を入力してください");
  if (!targetCount || targetCount < 1) return showToast("クリア回数を入力してください");
  if (!reward || reward < 1) return showToast("おこづかい金額を入力してください");
  const mid = familyRef().child("missions").push().key;
  await familyRef().child("missions/" + mid).set({
    title, targetCount, reward, assignedTo,
    createdBy: state.uid, createdAt: now(), status: "active"
  });
  closeMissionSheet();
  showToast("ミッションを依頼しました 🎯", { sound: false });
}
async function doMissionStep(mid, uid) {
  const targetUid = uid || state.uid;
  const ref = familyRef().child(`missionLogs/${mid}/${targetUid}/count`);
  await ref.transaction((v) => (v || 0) + 1);
  showToast("達成確認！ ⭐", { sound: false });
}
async function confirmPaid(mid, uid) {
  // 報酬渡し済み → ログをリセットして次サイクルへ
  await familyRef().child(`missionLogs/${mid}/${uid}`).set({
    count: 0, claimPending: false, paid: false
  });
  showToast("おこづかいを渡しました 💰");
}
async function archiveMission(mid) {
  await familyRef().child(`missions/${mid}/status`).set("archived");
  showToast("ミッションを終了しました");
}

function renderMissions() {
  const el = $("missions-content");
  if (!el || !state.profile) return;
  const role = state.myRole;
  if (!role) {
    el.innerHTML = `<div class="empty">ロールが設定されていません。<br>家族設定を確認してください。</div>`;
    return;
  }
  const activeMissions = Object.entries(state.missions)
    .filter(([, m]) => m.status === "active")
    .map(([mid, m]) => ({ mid, ...m }))
    .sort((a, b) => a.createdAt - b.createdAt);
  if (isParent()) {
    renderMissionsParent(el, activeMissions);
  } else {
    renderMissionsChild(el, activeMissions);
  }
  wireMissionButtons();
}

function renderMissionsParent(el, missions) {
  if (!missions.length) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">🎯</div><b>ミッションがまだありません</b><br>＋ をタップして子どもにミッションを依頼しましょう</div>`;
    return;
  }
  el.innerHTML = sectionHtml("🎯 アクティブなミッション", missions.length,
    missions.map((m, i) => missionCardParent(m, i)).join(""));
}

function missionCardParent(m, i) {
  const log = (state.missionLogs[m.mid] || {})[m.assignedTo] || {};
  const count = log.count || 0;
  const pct = Math.min(100, Math.round(count / m.targetCount * 100));
  const isDone = count >= m.targetCount;
  const member = state.family && state.family.members && m.assignedTo
    ? state.family.members[m.assignedTo] : null;
  const childName = member ? escapeHtml(member.name) : "（未設定）";
  const childEmoji = member ? (member.emoji || "👤") : "👤";
  const actionHtml = isDone
    ? `<button class="success tiny-btn" data-act="confirm-paid" data-mid="${m.mid}" data-uid="${m.assignedTo}">💰 おこづかいを渡す</button>`
    : `<button class="ghost tiny-btn" data-act="do-step" data-mid="${m.mid}" data-uid="${m.assignedTo}">⭐ +1 達成確認</button>`;
  return `<div class="mission-card" style="--i:${i}">
    <div class="row between" style="margin-bottom:4px;">
      <span class="mission-title">${escapeHtml(m.title)}</span>
      <button class="icon-btn" data-act="archive" data-mid="${m.mid}" aria-label="終了" title="ミッション終了">✕</button>
    </div>
    <div class="row" style="gap:12px;margin-bottom:10px;">
      <span class="mission-reward-label">💰 ${Number(m.reward).toLocaleString()}円</span>
      <span class="tiny">🔄 ${m.targetCount}回でクリア</span>
    </div>
    <div class="row between" style="margin-bottom:4px;">
      <span style="font-size:13px;font-weight:700;">${childEmoji} ${childName}</span>
      <span class="tiny">${count} / ${m.targetCount}回</span>
    </div>
    <div class="mission-progress-bar" style="margin-bottom:10px;">
      <div class="mission-progress-fill" style="width:${pct}%"></div>
    </div>
    <div class="actions">${actionHtml}</div>
  </div>`;
}

function renderMissionsChild(el, missions) {
  const myMissions = missions.filter(m => m.assignedTo === state.uid);
  if (!myMissions.length) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">🎯</div><b>ミッションがまだありません</b><br>親からのミッションをここで確認できます</div>`;
    return;
  }
  el.innerHTML = sectionHtml("🎯 ミッション一覧", myMissions.length,
    myMissions.map((m, i) => missionCardChild(m, i)).join(""));
}

function missionCardChild(m, i) {
  const log = (state.missionLogs[m.mid] || {})[state.uid] || {};
  const count = log.count || 0;
  const pct = Math.min(100, Math.round(count / m.targetCount * 100));
  const isDone = count >= m.targetCount;
  return `<div class="mission-card${isDone ? ' done' : ''}" style="--i:${i}">
    <div class="mission-title" style="margin-bottom:4px;">${escapeHtml(m.title)}</div>
    <div class="row" style="gap:12px;margin-bottom:8px;">
      <span class="mission-reward-label">💰 ${Number(m.reward).toLocaleString()}円</span>
      <span class="tiny">🔄 ${m.targetCount}回でクリア</span>
    </div>
    <div class="row between" style="font-size:12px;color:var(--muted);font-weight:600;margin-bottom:2px;">
      <span>${count} / ${m.targetCount}回</span>
      <span>${pct}%</span>
    </div>
    <div class="mission-progress-bar" style="margin-bottom:8px;">
      <div class="mission-progress-fill" style="width:${pct}%"></div>
    </div>
    ${isDone ? `<div style="text-align:center;padding:6px 0;font-size:14px;font-weight:800;color:var(--c-done);">🎉 達成！おこづかいをもらってね</div>` : ""}
  </div>`;
}

function wireMissionButtons() {
  document.querySelectorAll(".mission-card [data-act]").forEach(btn => {
    btn.addEventListener("click", () => {
      const { act, mid, uid } = btn.dataset;
      if (act === "do-step") doMissionStep(mid, uid);
      else if (act === "confirm-paid") confirmPaid(mid, uid);
      else if (act === "archive") archiveMission(mid);
    });
  });
}

function renderMissionBadge() {
  const badge = $("badge-missions");
  if (!badge) return;
  let count = 0;
  if (isParent()) {
    // 達成済み（おこづかいを渡す待ち）のミッション数
    Object.entries(state.missions).forEach(([mid, m]) => {
      if (m.status !== "active" || !m.assignedTo) return;
      const log = (state.missionLogs[mid] || {})[m.assignedTo] || {};
      if ((log.count || 0) >= m.targetCount) count++;
    });
  } else if (state.myRole === "child") {
    // 自分に割り当てられた達成済みミッション数
    Object.entries(state.missions).forEach(([mid, m]) => {
      if (m.status !== "active" || m.assignedTo !== state.uid) return;
      const log = (state.missionLogs[mid] || {})[state.uid] || {};
      if ((log.count || 0) >= m.targetCount) count++;
    });
  }
  if (count > 0 && state.activeTab !== "missions") {
    badge.textContent = count;
    badge.style.display = "";
  } else {
    badge.style.display = "none";
  }
}

// ===== Rendering =====
const ROLE_LABEL = { parent: "保護者", "sub-parent": "副保護者", child: "こども" };
const ROLE_ORDER = { parent: 0, "sub-parent": 1, child: 2 };
function roleRank(role) { return role in ROLE_ORDER ? ROLE_ORDER[role] : 99; }
function isParent() { return state.myRole === "parent" || state.myRole === "sub-parent"; }
function renderTopbar() {
  if (!state.profile || !state.family || !state.family.meta) return;
  $("top-family-text").textContent = state.profile.name || "ユーザー";
  $("my-avatar").textContent = state.profile.emoji || "🙂";
  const badge = $("top-role-badge");
  const roleLabel = state.myRole ? ROLE_LABEL[state.myRole] : null;
  if (roleLabel) {
    badge.textContent = roleLabel;
    badge.style.display = "";
  } else {
    badge.style.display = "none";
  }
}
// ===== Collapsible group helper =====
function groupHtml(groupId, title, count, bodyHtml) {
  const isOpen = expandedGroups.has(groupId);
  return `<div class="req-group${isOpen ? '' : ' closed'}" data-group="${groupId}">
    <div class="req-group-hdr" data-group-toggle="${groupId}">
      <h2>${title}</h2>
      <span class="section-count">${count}</span>
      <span class="req-group-chevron">▼</span>
    </div>
    <div class="req-group-body">${bodyHtml}</div>
  </div>`;
}

// ===== Compact card =====
function compactCard(r, i = 0) {
  const isDone = r.status === "done";
  const isClaimed = r.status === "claimed";
  const mine = r.claimedBy === state.uid;
  const hasUnread = state.unreadComments.has(r.id);
  const expanded = state.expandedItems.has(r.id);
  const allComments = state.comments[r.id] || {};
  const commentList = Object.entries(allComments).map(([cid, c]) => ({ id: cid, ...c }));
  const commentCount = commentList.length;

  let rowClass = "req-row";
  if (isDone) rowClass += " done";
  else if (isClaimed) rowClass += " claimed";
  if (r.urgent && !isDone) rowClass += " urgent";
  if (hasUnread) rowClass += " has-unread-comment";

  const claimerHtml = r.claimedBy
    ? `<span class="req-row-claimer">${memberEmoji(r.claimedBy)} ${escapeHtml(memberName(r.claimedBy))}</span>`
    : "";

  let pillsHtml = "";
  if (!isDone) {
    if (r.urgent) pillsHtml += `<span class="pill urgent" style="font-size:12px;padding:2px 8px;">🔥</span>`;
    if (r.diff && r.diff !== "normal") pillsHtml += `<span class="pill diff-${r.diff}" style="font-size:12px;padding:2px 8px;">${r.diff === "hard" ? "💪" : "😅"}</span>`;
  } else {
    pillsHtml = `<span class="pill s-done" style="font-size:12px;padding:2px 8px;">✅</span>`;
  }

  const canEdit = r.requestedBy === state.uid && !isDone;

  let actHtml = "";
  if (isDone) {
    actHtml = `<button class="ghost rc-btn" data-act="reopen" data-id="${r.id}" aria-label="買い物リストに戻す">↩️</button>`;
    if (r.requestedBy === state.uid) {
      actHtml += `<button class="danger rc-btn" data-act="delete" data-id="${r.id}" aria-label="削除">×</button>`;
    }
  } else if (!isClaimed) {
    const isAssigned = r.assignedTo === state.uid;
    actHtml = `<button class="${isAssigned ? 'warn' : 'success'} rc-btn" data-act="claim" data-id="${r.id}">${isAssigned ? "✋担当" : "🙋買うよ"}</button>`;
    if (r.requestedBy === state.uid) {
      actHtml += `<button class="danger rc-btn" data-act="delete" data-id="${r.id}" aria-label="削除">×</button>`;
    }
  } else if (mine) {
    actHtml = `<button class="success rc-btn" data-act="complete" data-id="${r.id}">✅完了</button>
               <button class="ghost rc-btn" data-act="unclaim" data-id="${r.id}">やめる</button>`;
  }

  const dot = hasUnread
    ? `<span class="comment-dot unread"></span>`
    : commentCount > 0 ? `<span class="comment-dot seen"></span>` : '';
  actHtml += `<button class="rc-comment-btn${expanded ? ' open' : ''}" data-toggle="${r.id}" aria-label="コメントを開く">💬${dot}</button>`;

  // Extra info hints: budget / brand / memo / assignee
  const hintParts = [];
  if (r.category && CATEGORY[r.category]) hintParts.push(`${CATEGORY[r.category].emoji} ${CATEGORY[r.category].label}`);
  if (r.budget > 0) hintParts.push(`💰 ${Number(r.budget).toLocaleString()}円以下`);
  if (r.brand) hintParts.push(`🏷️ ${escapeHtml(r.brand)}`);
  if (r.memo) hintParts.push(`📝 ${escapeHtml(r.memo)}`);
  if (r.assignedTo && r.status === "open") {
    hintParts.push(`📌 ${memberEmoji(r.assignedTo)} ${escapeHtml(memberName(r.assignedTo))}`);
  }
  const hintsHtml = hintParts.length
    ? `<div class="req-row-hints">${hintParts.map(p => `<span class="req-row-hint">${p}</span>`).join("")}</div>`
    : "";

  let commentBodyHtml = "";
  if (expanded) {
    const roots = commentList.filter(c => !c.parentId).sort((a, b) => a.createdAt - b.createdAt);
    const replies = commentList.filter(c => !!c.parentId);
    let threadHtml = `<div class="comment-thread">`;
    if (roots.length === 0) {
      threadHtml += `<p class="muted" style="font-size:12px;text-align:center;">まだコメントはありません</p>`;
    }
    roots.forEach(root => {
      const rootReplies = replies.filter(rp => rp.parentId === root.id).sort((a, b) => a.createdAt - b.createdAt);
      threadHtml += `<div class="comment-root">
        <div class="comment-item">
          <span class="avatar sm">${escapeHtml(root.authorEmoji)}</span>
          <div class="comment-body">
            <div class="comment-author">${escapeHtml(root.authorName)} <span class="tiny">${timeAgo(root.createdAt)}</span></div>
            <div class="comment-text">${escapeHtml(root.text)}</div>
            <button class="reply-btn" data-reply="${root.id}" data-name="${escapeHtml(root.authorName)}" data-req="${r.id}">↩️ 返信</button>
          </div>
        </div>`;
      rootReplies.forEach(rep => {
        threadHtml += `<div class="comment-item reply">
          <span class="avatar sm">${escapeHtml(rep.authorEmoji)}</span>
          <div class="comment-body">
            <div class="comment-author">${escapeHtml(rep.authorName)} <span class="tiny">${timeAgo(rep.createdAt)}</span></div>
            <div class="comment-text">${escapeHtml(rep.text)}</div>
          </div>
        </div>`;
      });
      threadHtml += `</div>`;
    });
    threadHtml += `<div class="comment-input-row" data-req="${r.id}" data-parent="">
      <span class="avatar sm">${state.profile ? escapeHtml(state.profile.emoji) : '🙂'}</span>
      <input class="comment-input" placeholder="コメントを追加..." />
      <button class="comment-send">送信</button>
    </div></div>`;
    commentBodyHtml = `<div class="req-row-comment-body">${threadHtml}</div>`;
  }

  // 完了アイテムには「ありがとう」リアクション行を付ける（1人1つ・再タップで取消）
  let reactionsHtml = "";
  if (isDone) {
    const reactions = r.reactions || {};
    const myReaction = reactions[state.uid];
    const counts = {};
    Object.values(reactions).forEach((e) => { counts[e] = (counts[e] || 0) + 1; });
    const QUICK_REACTIONS = ["❤️", "👏", "🎉"];
    const btns = QUICK_REACTIONS.map((e) =>
      `<button class="react-btn${myReaction === e ? " mine" : ""}" data-react="${e}" data-id="${r.id}" aria-label="ありがとうを送る ${e}">${e}${counts[e] ? `<span class="react-count">${counts[e]}</span>` : ""}</button>`
    ).join("");
    reactionsHtml = `<div class="req-row-reactions"><span class="react-label">ありがとう</span>${btns}</div>`;
  }

  return `<div class="${rowClass}" style="--i:${i}">
    <div class="req-row-main">
      <div class="req-row-name-col${canEdit ? ' editable' : ''}"${canEdit ? ` data-edit-id="${r.id}"` : ''}>
        <span class="req-row-name">${escapeHtml(r.name)}</span>
        ${hintsHtml}
      </div>
      <div class="req-row-meta">${claimerHtml}${pillsHtml}</div>
      <div class="req-row-actions">${actHtml}</div>
    </div>
    ${reactionsHtml}
    ${commentBodyHtml}
  </div>`;
}

// リアクションの付け外し（同じ絵文字をもう一度タップで取消）
async function toggleReaction(id, emoji) {
  const r = state.requests[id];
  const cur = r && r.reactions && r.reactions[state.uid];
  const ref = familyRef().child(`requests/${id}/reactions/${state.uid}`);
  await dbOp(cur === emoji ? ref.remove() : ref.set(emoji), "送れませんでした");
}

// ===== Wire group toggles =====
function wireGroupToggles() {
  document.querySelectorAll("[data-group-toggle]").forEach(hdr => {
    hdr.addEventListener("click", () => {
      const gid = hdr.dataset.groupToggle;
      if (expandedGroups.has(gid)) expandedGroups.delete(gid);
      else expandedGroups.add(gid);
      const group = document.querySelector(`.req-group[data-group="${gid}"]`);
      if (group) group.classList.toggle("closed", !expandedGroups.has(gid));
    });
  });
}

function renderRequests() {
  const items = Object.entries(state.requests).map(([id, r]) => ({ id, ...r }));

  // Group 1: unclaimed open items
  const openItems = items
    .filter(r => r.status === "open")
    .sort((a, b) =>
      (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0) ||        // 急ぎが最優先
      categoryOrder(a) - categoryOrder(b) ||             // 次にカテゴリ（食品→日用品→その他→未分類）
      a.requestedAt - b.requestedAt);

  // Group 2: items someone declared they'll buy (claimed, in-progress).
  // 完了(done)はリストから外し「購入完了済み履歴」に格納する。
  const claimedItems = items
    .filter(r => r.status === "claimed")
    .sort((a, b) => {
      // 自分の担当を先に、その後は宣言した順
      const aMine = a.claimedBy === state.uid ? 0 : 1;
      const bMine = b.claimedBy === state.uid ? 0 : 1;
      if (aMine !== bMine) return aMine - bMine;
      return (a.claimedAt || 0) - (b.claimedAt || 0);
    });

  const hasAny = items.length > 0;
  $("btn-howto").style.display = hasAny ? "" : "none";

  let html = "";
  if (!hasAny) {
    html = howtoHtml();
  } else {
    const openBody = openItems.length
      ? openItems.map((r, i) => compactCard(r, i)).join("")
      : `<div class="empty" style="padding:12px 4px 8px;font-size:12px;">新しい依頼はありません</div>`;
    html += groupHtml("group-open", "🛒 買い物リスト", openItems.length, openBody);
    if (claimedItems.length) {
      html += groupHtml("group-claimed", "🙋 宣言済みリスト", claimedItems.length,
        claimedItems.map((r, i) => compactCard(r, i)).join(""));
    }
  }

  $("list-open").innerHTML = html;
  wireRequestButtons($("list-open"));
  wireGroupToggles();
}
function sectionHtml(title, count, body) {
  return `<div class="section-header"><h2>${title}</h2><span class="section-count">${count}</span></div>${body}`;
}
function emptyHtml(msg) { return `<div class="empty">${msg}</div>`; }
function howtoHtml() {
  return `<div class="howto-wrap">
    <div class="howto-title">はじめかた</div>
    <div class="howto-steps">
      <div class="howto-step" style="--i:0">
        <div class="howto-num">1</div>
        <div class="howto-text">
          <strong>＋ をタップして追加</strong>
          <span>品名・メモ・難易度を入れて送信</span>
        </div>
        <div class="howto-emoji">🛒</div>
      </div>
      <div class="howto-step" style="--i:1">
        <div class="howto-num">2</div>
        <div class="howto-text">
          <strong>家族が「買ってくる！」と立候補</strong>
          <span>リアルタイムで誰が動いてるか一目でわかる</span>
        </div>
        <div class="howto-emoji">🙋</div>
      </div>
      <div class="howto-step" style="--i:2">
        <div class="howto-num">3</div>
        <div class="howto-text">
          <strong>買ったら完了マーク</strong>
          <span>履歴に記録されて貢献度もわかる</span>
        </div>
        <div class="howto-emoji">✅</div>
      </div>
    </div>
  </div>`;
}
function timeAgo(ts) {
  if (!ts) return "";
  const diff = now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "たった今";
  if (min < 60) return min + "分前";
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + "時間前";
  const day = Math.floor(hr / 24);
  return day + "日前";
}
function wireRequestButtons(root = document) {
  root.querySelectorAll(".req-row [data-act]").forEach((b) => {
    b.addEventListener("click", () => {
      const id = b.dataset.id;
      const act = b.dataset.act;
      if (act === "claim") claimRequest(id);
      else if (act === "unclaim") unclaimRequest(id);
      else if (act === "complete") completeRequest(id);
      else if (act === "reopen") reopenRequest(id);
      else if (act === "delete") deleteRequest(id);
    });
  });
  root.querySelectorAll("[data-react]").forEach((b) => {
    b.addEventListener("click", () => toggleReaction(b.dataset.id, b.dataset.react));
  });
  root.querySelectorAll("[data-toggle]").forEach((b) => {
    b.addEventListener("click", () => toggleComments(b.dataset.toggle));
  });
  root.querySelectorAll(".reply-btn[data-reply]").forEach((b) => {
    b.addEventListener("click", () => {
      const row = root.querySelector(`.comment-input-row[data-req="${b.dataset.req}"]`);
      if (!row) return;
      row.dataset.parent = b.dataset.reply;
      const input = row.querySelector(".comment-input");
      input.placeholder = `↩️ ${b.dataset.name}さんへ返信...`;
      input.focus();
    });
  });
  root.querySelectorAll(".comment-input-row").forEach((row) => {
    const input = row.querySelector(".comment-input");
    const send = row.querySelector(".comment-send");
    const doSend = () => {
      const text = input.value;
      const parentId = row.dataset.parent || null;
      postComment(row.dataset.req, text, parentId).then(() => {
        input.value = "";
        row.dataset.parent = "";
        input.placeholder = "コメントを追加...";
      });
    };
    send.addEventListener("click", doSend);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); } });
  });
  // 名前コラムタップで編集
  root.querySelectorAll(".req-row-name-col[data-edit-id]").forEach((col) => {
    col.addEventListener("click", () => {
      const id = col.dataset.editId;
      const raw = state.requests[id];
      if (raw) openEditSheet({ id, ...raw }); // id を明示的に付与
    });
  });
}

let historyLimit = 50; // 「もっと見る」で 50 件ずつ増える
function renderHistoryHtml() {
  // 通常の買い物リストと同じカード(compactCard)フォーマットで、完了日ごとに見出しを付けて表示する。
  const all = Object.entries(state.requests)
    .filter(([,r]) => r.status === "done")
    .sort((a,b) => (b[1].completedAt || 0) - (a[1].completedAt || 0))
    .map(([id, r]) => ({ id, ...r }));
  if (!all.length) return emptyHtml("まだ完了履歴がありません。");
  const items = all.slice(0, historyLimit);
  let html = "";
  let curKey = null;
  items.forEach((r, i) => {
    const d = new Date(r.completedAt || 0);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (key !== curKey) {
      curKey = key;
      html += `<div class="history-date-hdr">${historyDateLabel(r.completedAt)}</div>`;
    }
    html += compactCard(r, i);
  });
  if (all.length > historyLimit) {
    html += `<button data-history-more class="ghost" style="width:100%;margin-top:10px;padding:12px;border-radius:12px;font-size:13px;font-weight:700;">さらに表示（残り ${all.length - historyLimit} 件）</button>`;
  }
  return html;
}
// 完了日を「今日／昨日／M月D日(曜)」のラベルにする。
function historyDateLabel(ts) {
  const d = new Date(ts || 0);
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(new Date()) - startOf(d)) / 86400000);
  if (diffDays === 0) return "今日";
  if (diffDays === 1) return "昨日";
  const wd = ["日","月","火","水","木","金","土"][d.getDay()];
  return `${d.getMonth()+1}月${d.getDate()}日(${wd})`;
}
// 履歴リストの描画＋結線（「もっと見る」含む）
function refreshHistoryList() {
  const el = $("history-list");
  el.innerHTML = renderHistoryHtml();
  wireRequestButtons(el);
  const more = el.querySelector("[data-history-more]");
  if (more) more.addEventListener("click", () => { historyLimit += 50; refreshHistoryList(); });
}
// 履歴シートが開いている間は requests/comments の変更でライブ再描画する。
function renderHistory() {
  const sheet = $("history-sheet");
  if (!sheet || !sheet.classList.contains("open")) return;
  refreshHistoryList();
}

function renderMemberStatsHtml() {
  if (!state.family || !state.family.members) return "";
  const canManage = state.myRole === "parent";
  const members = state.family.members;
  // 保護者 → 副保護者 → こども の順に並べる（同ロール内は名前順）
  const sorted = Object.entries(members).sort(([, a], [, b]) => {
    const r = roleRank(a.memberRole) - roleRank(b.memberRole);
    if (r !== 0) return r;
    return (a.name || "").localeCompare(b.name || "", "ja");
  });
  const cards = sorted.map(([uid, m]) => {
    const s = state.stats[uid] || {};
    const roleLabel = ROLE_LABEL[m.memberRole] || "未設定";
    const isMe = uid === state.uid;
    const manageHtml = (canManage && !isMe) ? `
      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">
        <button class="ghost tiny-btn" style="font-size:11px;" data-set-role="${uid}" data-role-val="sub-parent">副保護者</button>
        <button class="ghost tiny-btn" style="font-size:11px;" data-set-role="${uid}" data-role-val="child">子ども</button>
        <button class="danger tiny-btn" style="font-size:11px;" data-remove-member="${uid}" data-member-name="${escapeHtml(m.name || "メンバー")}">家族から外す</button>
      </div>` : "";
    return `
      <div class="stat-card">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
          <span style="font-size:28px;">${escapeHtml(m.emoji || "👤")}</span>
          <div>
            <div style="font-weight:700;font-size:14px;">${escapeHtml(m.name || "メンバー")}${isMe ? " <span style='color:var(--muted);font-size:11px;'>(自分)</span>" : ""}</div>
            <div style="font-size:11px;color:var(--muted);">${roleLabel}</div>
          </div>
        </div>
        <div class="stat-grid" style="margin-top:0;padding-top:8px;border-top:1px solid var(--border);">
          <div class="stat"><b>${s.requestedCount || 0}</b><span>依頼</span></div>
          <div class="stat"><b>${s.claimedCount || 0}</b><span>担当</span></div>
          <div class="stat"><b>${s.completedCount || 0}</b><span>完了</span></div>
        </div>
        ${manageHtml}
      </div>`;
  }).join("");
  // 統計リセット（保護者のみ）
  const resetHtml = canManage ? `
    <button class="ghost" id="btn-reset-stats" style="width:100%;margin-top:14px;font-size:13px;color:var(--c-urgent);">
      📊 依頼・担当・完了の数をリセット
    </button>` : "";
  return cards + resetHtml;
}

function renderSettings() {
  if (!state.profile || !state.family) return;
  $("set-name").value = state.profile.name;
  state.settingsEmoji = state.profile.emoji;
  renderEmojiPicker("set-emoji-picker", "settingsEmoji");
  $("set-family-name").textContent = (state.family.meta && state.family.meta.name) || "";
  $("set-invite-code").value = (state.family.meta && state.family.meta.inviteCode) || "";
  const members = (state.family && state.family.members) || {};
  $("member-list").innerHTML = Object.entries(members).map(([uid, m]) => `
    <span class="member-chip">
      <span class="avatar sm">${escapeHtml(m.emoji || "👤")}</span>
      ${escapeHtml(m.name)}${uid === state.uid ? "（自分）" : ""}
    </span>
  `).join("");
  renderMemberAdmin();
}

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
function renderMonthlySummary() {
  const el = $("monthly-summary");
  if (!el) return;
  const nowD = new Date();
  const monthStart = new Date(nowD.getFullYear(), nowD.getMonth(), 1).getTime();
  const done = Object.values(state.requests || {})
    .filter((r) => r && r.status === "done" && (r.completedAt || 0) >= monthStart);
  if (!done.length) {
    el.textContent = "今月の完了はまだありません";
    return;
  }
  const budgetSum = done.reduce((sum, r) => sum + (r.budget > 0 ? r.budget : 0), 0);
  const budgeted = done.filter((r) => r.budget > 0).length;
  el.innerHTML = `
    <div class="stat-grid" style="margin-top:0;">
      <div class="stat"><b>${done.length}</b><span>完了した買い物</span></div>
      <div class="stat"><b>${budgetSum > 0 ? budgetSum.toLocaleString() + "円" : "—"}</b><span>予算の合計${budgeted ? `（${budgeted}件分）` : ""}</span></div>
    </div>
    <p class="muted" style="font-size:11px;margin-top:8px;">※ 予算は依頼時に入力された「〜円以下」の合計です（実際の支払額ではありません）</p>`;
}

async function addReminderTime() {
  if (!state.familyId) return;
  const input = $("reminder-time-input");
  const val = (input.value || "").trim();
  if (!/^\d{2}:\d{2}$/.test(val)) { showToast("時刻を選んでください"); return; }
  // reminderIndex はサーバー（Cloud Functions）が「この時刻に通知すべき家族」を
  // 全家族スキャンなしで引けるようにするための逆引き索引。
  const ok = await dbOp(Promise.all([
    familyRef().child("reminderTimes/" + val).set(true),
    db.ref(`reminderIndex/${val}/${state.familyId}`).set(true)
  ]), "設定できませんでした");
  if (!ok) return;
  input.value = "";
  showToast(`⏰ ${val} にリマインドを設定しました`, { sound: false });
}

async function removeReminderTime(t) {
  if (!state.familyId) return;
  await dbOp(Promise.all([
    familyRef().child("reminderTimes/" + t).remove(),
    db.ref(`reminderIndex/${t}/${state.familyId}`).remove()
  ]), "削除できませんでした");
}

function renderEmojiPicker(elId, stateKey) {
  const cur = state[stateKey];
  $(elId).innerHTML = EMOJI_CHOICES.map((e) => `
    <button data-e="${e}" class="${e === cur ? 'selected' : ''}">${e}</button>
  `).join("");
  $(elId).querySelectorAll("button").forEach((b) => {
    b.addEventListener("click", () => {
      state[stateKey] = b.dataset.e;
      $(elId).querySelectorAll("button").forEach((x) => x.classList.remove("selected"));
      b.classList.add("selected");
    });
  });
}

function renderBadge() {
  const openCount = Object.values(state.requests).filter((r) => r.status === "open" && r.requestedBy !== state.uid).length;
  const badge = $("badge-requests");
  if (openCount > 0 && state.activeTab !== "requests") {
    badge.textContent = openCount;
    badge.style.display = "";
  } else {
    badge.style.display = "none";
  }
  document.title = (openCount > 0 ? `(${openCount}) ` : "") + "🧺 おうちのおつかい";
}

// ===== History sheet =====
function openHistorySheet() {
  historyLimit = 50; // 開き直したら表示件数をリセット
  refreshHistoryList();
  $("history-sheet").classList.add("open");
  $("sheet-backdrop").classList.add("open");
}
function closeHistorySheet() {
  $("history-sheet").classList.remove("open");
  $("sheet-backdrop").classList.remove("open");
}

// ===== Player profile sheet =====
function openPlayerSheet() {
  const body = $("player-sheet-body");
  const name = state.profile ? state.profile.name : "ゲスト";
  const emoji = state.profile ? (state.profile.emoji || "🙂") : "🙂";
  const roleLabel = state.myRole ? (ROLE_LABEL[state.myRole] || "") : "";
  const myStats = state.stats[state.uid] || {};
  const req = myStats.requestedCount || 0;
  const cl = myStats.claimedCount || 0;
  const done = myStats.completedCount || 0;
  body.innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;padding:4px 0 20px;">
      <div class="avatar" style="width:60px;height:60px;font-size:30px;box-shadow:none;background:var(--pri-soft);">${emoji}</div>
      <div>
        <div style="font-size:20px;font-weight:800;letter-spacing:-0.5px;">${escapeHtml(name)}</div>
        ${roleLabel ? `<div style="margin-top:4px;"><span class="role-badge">${roleLabel}</span></div>` : ""}
      </div>
    </div>
    <div class="stat-grid" style="margin-top:0;padding-top:0;border-top:none;margin-bottom:24px;">
      <div class="stat"><b>${req}</b><span>依頼</span></div>
      <div class="stat"><b>${cl}</b><span>担当</span></div>
      <div class="stat"><b>${done}</b><span>完了</span></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;">
      <button id="ps-btn-family" class="ghost" style="width:100%;text-align:left;padding:14px 16px;border-radius:12px;font-size:14px;font-weight:700;">
        👨‍👩‍👧 家族の状況
      </button>
      <button id="ps-btn-history" class="ghost" style="width:100%;text-align:left;padding:14px 16px;border-radius:12px;font-size:14px;font-weight:700;">
        🛒 買い物履歴
      </button>
      <button id="ps-btn-mission-history" class="ghost" style="width:100%;text-align:left;padding:14px 16px;border-radius:12px;font-size:14px;font-weight:700;">
        🏆 ミッション達成履歴
      </button>
    </div>
  `;
  // ボタンのイベント
  body.querySelector("#ps-btn-family").addEventListener("click", openFamilySheet);
  body.querySelector("#ps-btn-history").addEventListener("click", openHistorySheet);
  body.querySelector("#ps-btn-mission-history").addEventListener("click", openMissionHistorySheet);
  $("player-sheet").classList.add("open");
  $("sheet-backdrop").classList.add("open");
}
function closePlayerSheet() {
  $("player-sheet").classList.remove("open");
  $("sheet-backdrop").classList.remove("open");
}

// ===== Family stats sheet =====
function openFamilySheet() {
  const html = renderMemberStatsHtml() || `<p class="muted" style="text-align:center;font-size:13px;">メンバー情報がありません</p>`;
  $("family-sheet-body").innerHTML = html;
  // Wire role management buttons (parent only)
  $("family-sheet-body").querySelectorAll("[data-set-role]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const targetUid = btn.dataset.setRole;
      const newRole = btn.dataset.roleVal;
      await familyRef().child(`members/${targetUid}/memberRole`).set(newRole);
      showToast(newRole === "sub-parent" ? "副保護者に設定しました" : "子どもに設定しました", { sound: false });
    });
  });
  // Wire remove-member buttons (parent only)
  $("family-sheet-body").querySelectorAll("[data-remove-member]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const targetUid = btn.dataset.removeMember;
      const name = btn.dataset.memberName || "このメンバー";
      if (!confirm(`${name} さんを家族から外しますか？\n\n外すと、この人はおうちの買い物リストやミッションを見られなくなります。（本人のアカウントは消えません）`)) return;
      try {
        await familyRef().child(`members/${targetUid}`).remove();
        await familyRef().child(`stats/${targetUid}`).remove();
        showToast(`${name} さんを家族から外しました`, { sound: false });
        openFamilySheet(); // 一覧を再描画
      } catch (e) {
        showToast("外せませんでした: " + ((e && e.message) || e), { sound: false });
      }
    });
  });
  // Wire reset-stats button (parent only)
  const resetBtn = $("btn-reset-stats");
  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      if (!confirm("全員の「依頼・担当・完了」の数を 0 にリセットしますか？\n\n買い物リストやミッションは消えません。集計の数だけがリセットされます。")) return;
      try {
        await familyRef().child("stats").remove();
        showToast("依頼・担当・完了の数をリセットしました", { sound: false });
        openFamilySheet();
      } catch (e) {
        showToast("リセットできませんでした: " + ((e && e.message) || e), { sound: false });
      }
    });
  }
  $("family-sheet").classList.add("open");
  $("sheet-backdrop").classList.add("open");
}
function closeFamilySheet() {
  $("family-sheet").classList.remove("open");
  $("sheet-backdrop").classList.remove("open");
}

// ===== Mission history sheet =====
function renderMissionHistoryHtml() {
  const rows = [];
  Object.entries(state.missionLogs).forEach(([mid, logs]) => {
    const myLog = logs[state.uid];
    if (!myLog || !(myLog.count > 0)) return;
    const m = state.missions[mid];
    const title = m ? m.title : "（終了済みミッション）";
    const reward = m ? m.reward : 0;
    const targetCount = m ? m.targetCount : "?";
    const cleared = myLog.count >= (m ? m.targetCount : Infinity);
    const paid = myLog.paid;
    rows.push({ title, reward, count: myLog.count, targetCount, cleared, paid, claimedAt: myLog.claimedAt || 0 });
  });
  if (!rows.length) return emptyHtml("まだミッション履歴がありません。");
  rows.sort((a, b) => b.claimedAt - a.claimedAt);
  return rows.map(r => `
    <div class="row" style="padding:10px 4px;border-bottom:1px solid var(--border);gap:10px;align-items:center;">
      <div class="grow">
        <div style="font-size:14px;font-weight:700;">${escapeHtml(r.title)}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px;">${r.count} / ${r.targetCount}回 達成${r.reward ? ` ・ 💰${Number(r.reward).toLocaleString()}円` : ''}</div>
      </div>
      <span style="font-size:12px;font-weight:700;${r.paid ? 'color:var(--c-done)' : r.cleared ? 'color:var(--c-claimed)' : 'color:var(--muted)'}">
        ${r.paid ? '✅ 報酬済' : r.cleared ? '🎉 達成' : '進行中'}
      </span>
    </div>
  `).join("");
}
function openMissionHistorySheet() {
  $("mission-history-body").innerHTML = renderMissionHistoryHtml();
  $("mission-history-sheet").classList.add("open");
  $("sheet-backdrop").classList.add("open");
}
function closeMissionHistorySheet() {
  $("mission-history-sheet").classList.remove("open");
  $("sheet-backdrop").classList.remove("open");
}

// ===== Tabs =====
function wireTabs() {
  document.querySelectorAll(".bottom-nav button[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".bottom-nav button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const t = btn.dataset.tab;
      state.activeTab = t;
      document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
      $("tab-" + t).classList.add("active");
      closeSheet();
      closeStockSheet();
      closeMissionSheet();
      closeShortcutPanel();
      updateShortcutVisibility();
      renderBadge();
      renderStockBadge();
      renderMissionBadge();
      // スクロールを最上部へ。モバイルの描画タイミング差で同期実行だけだと
      // 効かない場合があるため、次フレームでも再実行する。
      const scrollTop = () => {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      };
      scrollTop();
      requestAnimationFrame(scrollTop);
    });
  });
}

// ===== Init =====
function wireGlobalEvents() {
  $("btn-google").addEventListener("click", signInGoogle);
  $("btn-signin").addEventListener("click", signInEmail);
  $("btn-signup").addEventListener("click", signUpEmail);
  $("btn-save-profile").addEventListener("click", saveProfile);
  $("btn-create-family").addEventListener("click", createFamily);
  $("btn-join-family").addEventListener("click", joinFamily);
  $("btn-player-profile").addEventListener("click", openPlayerSheet);
  $("btn-player-sheet-close").addEventListener("click", closePlayerSheet);

  $("btn-history-close").addEventListener("click", closeHistorySheet);
  $("btn-family-close").addEventListener("click", closeFamilySheet);
  $("btn-mission-history-close").addEventListener("click", closeMissionHistorySheet);
  $("btn-howto").addEventListener("click", openHowto);
  $("btn-howto-close").addEventListener("click", closeHowto);
  $("howto-modal-backdrop").addEventListener("click", closeHowto);
  // Shortcut float toggle
  $("btn-shortcut-toggle").addEventListener("click", (e) => {
    e.stopPropagation();
    const panel = $("shortcut-panel");
    const btn = $("btn-shortcut-toggle");
    const isOpen = panel.classList.contains("open");
    panel.classList.toggle("open", !isOpen);
    btn.classList.toggle("open", !isOpen);
  });
  $("shortcut-panel").addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", closeShortcutPanel);
  // Stock detail sheet
  $("btn-stock-detail-close").addEventListener("click", closeStockDetail);
  $("fab-add").addEventListener("click", () => {
    if (state.activeTab === "stock") openStockSheet();
    else if (state.activeTab === "missions" && isParent()) openMissionSheet();
    else if (state.activeTab === "missions") { /* child: nothing */ }
    else openSheet();
  });
  $("btn-sheet-close").addEventListener("click", closeSheet);
  $("sheet-backdrop").addEventListener("click", () => { closeSheet(); closeStockSheet(); closeMissionSheet(); closePlayerSheet(); closeStockDetail(); closeHistorySheet(); closeFamilySheet(); closeMissionHistorySheet(); });
  $("btn-add-request").addEventListener("click", () => { if (editingRequestId) updateRequest(); else if (shortcutMode) addShortcutFromSheet(); else addRequest(); });
  $("btn-shortcut-register").addEventListener("click", openShortcutRegisterSheet);
  $("btn-history-float").addEventListener("click", openHistorySheet);
  $("btn-update-profile").addEventListener("click", updateProfileFromSettings);
  $("btn-logout").addEventListener("click", signOut);
  wireCategoryChips();
  $("btn-copy-code").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("set-invite-code").value);
      showToast("コピーしました 📋", { sound: false });
    } catch (e) { showToast("コピー失敗"); }
  });
  $("opt-sound").checked = state.soundOn;
  $("opt-sound").addEventListener("change", (e) => {
    state.soundOn = e.target.checked;
    localStorage.setItem("soundOn", String(state.soundOn));
  });
  $("btn-enable-push").addEventListener("click", togglePush);
  $("btn-add-reminder-time").addEventListener("click", addReminderTime);
  $("reminder-time-input").addEventListener("keydown", (e) => { if (e.key === "Enter") addReminderTime(); });
  initPushOnLoad();
  $("new-name").addEventListener("keydown", (e) => { if (e.key === "Enter") { if (editingRequestId) updateRequest(); else addRequest(); } });
  $("auth-password").addEventListener("keydown", (e) => { if (e.key === "Enter") signInEmail(); });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeSheet();
    closeStockSheet();
    closeMissionSheet();
    closeStockDetail();
    closeHowto();
  });
  $("btn-stock-sheet-close").addEventListener("click", closeStockSheet);
  $("btn-add-stock").addEventListener("click", addStock);
  $("stock-name").addEventListener("keydown", (e) => { if (e.key === "Enter") addStock(); });
  // Mission sheet
  $("btn-mission-sheet-close").addEventListener("click", closeMissionSheet);
  $("btn-add-mission").addEventListener("click", addMission);
  $("mission-title-input").addEventListener("keydown", (e) => { if (e.key === "Enter") $("mission-target").focus(); });
  document.querySelectorAll(".slp-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      stockAddLevel = btn.dataset.lvl;
      document.querySelectorAll(".slp-btn").forEach((b) => b.classList.toggle("active", b === btn));
    });
  });
  // 「X分前」ラベルを5分おきに静かに更新（アニメーションなし）
  setInterval(() => {
    document.querySelectorAll("[data-timeago]").forEach(el => {
      const ts = parseInt(el.dataset.timeago, 10);
      if (ts) el.textContent = timeAgo(ts);
    });
  }, 60000);
}

// i-mobile のバナータグを端末別に注入する。
// SP/PC 用タグを別サイト/別プラットフォームで併用するのは規約違反のため、
// 端末判定して片方だけを差し込む。
function injectImobileBanner(slotId, config) {
  const slot = document.getElementById(slotId);
  if (!slot) return;
  const content = slot.querySelector(".ad-content");
  if (!content || content.children.length > 0) return;
  const isMobile = /iPhone|iPod|Android.*Mobile/i.test(navigator.userAgent)
    || window.matchMedia("(max-width: 767px)").matches;
  const variant = isMobile ? config.sp : config.pc;
  const adDiv = document.createElement("div");
  adDiv.id = variant.elementid;
  content.appendChild(adDiv);
  // spot.js は全スポットで共通なので一度だけ読み込む
  if (!document.querySelector('script[data-imobile-loader]')) {
    const loader = document.createElement("script");
    loader.async = true;
    loader.src = "https://imp-adedge.i-mobile.co.jp/script/v1/spot.js?20220104";
    loader.setAttribute("data-imobile-loader", "1");
    document.head.appendChild(loader);
  }
  const pushScript = document.createElement("script");
  pushScript.text = '(window.adsbyimobile=window.adsbyimobile||[]).push({pid:'
    + config.pid + ',mid:' + variant.mid + ',asid:' + variant.asid
    + ',type:"banner",display:"inline",elementid:"' + variant.elementid + '"});';
  document.head.appendChild(pushScript);
}

// 広告枠: スポットタグを注入し、.ad-content に中身があれば .ad-slot を表示する。
function initAdSlots() {
  // お買い物タブ末尾: i-mobile「トップページ バナー」
  injectImobileBanner("ad-slot-requests", {
    pid: 84969,
    sp: { mid: 593255, asid: 1932938, elementid: "im-d0dd8eaf34ba46fcaaa603b7f68e0acc" },
    pc: { mid: 593254, asid: 1932937, elementid: "im-68455a797ff34316a29423d6979d3d15" },
  });
  // ログイン画面: i-mobile「ログイン画面 バナー」
  injectImobileBanner("ad-slot-auth", {
    pid: 84969,
    sp: { mid: 593257, asid: 1932940, elementid: "im-ff2d5e1043d04affb90900196031d7cc" },
    pc: { mid: 593256, asid: 1932939, elementid: "im-2f7e44594cec42cf857e64398b7496a4" },
  });
  document.querySelectorAll(".ad-slot").forEach((slot) => {
    const content = slot.querySelector(".ad-content");
    if (content && content.children.length > 0) {
      slot.classList.add("has-ad");
    }
  });
}

function init() {
  wireGlobalEvents();
  wireTabs();
  initAdSlots();
  if (!isConfigured) {
    showScreen("config");
    return;
  }
  initAuthListener();
}
init();

// PWA: Service Worker 登録（ホーム画面追加・オフライン対応）
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

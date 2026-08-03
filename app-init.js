// おうちのおつかい — タブ切替 / 初期化（init）/ 引っ張って更新 / PWA: Service Worker 登録と更新検知
// 元 app.js の 3299〜3758行目。index.html の <script> 順で他の app-*.js と読み込み順が保証される
// （クラシックスクリプトなのでグローバルスコープを共有。type="module" にはしていない）。

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
  $("btn-shortcut-edit").addEventListener("click", () => {
    shortcutsEditMode = !shortcutsEditMode;
    renderShortcuts();
  });
  $("btn-history-float").addEventListener("click", openHistorySheet);
  $("btn-update-profile").addEventListener("click", updateProfileFromSettings);
  $("btn-logout").addEventListener("click", signOut);
  wireCategoryChips();
  wireMissionSubtabs();
  $("btn-member-admin-toggle").addEventListener("click", () => {
    memberAdminOpen = !memberAdminOpen;
    updateMemberAdminToggle();
  });
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
  // そろそろ切れるかも: 何日前から知らせるか（家族共通）
  $("opt-low-lead").addEventListener("change", (e) => saveLowLeadDays(e.target.value));
  // テーマ
  $("opt-theme").value = localStorage.getItem("theme") || "auto";
  $("opt-theme").addEventListener("change", (e) => applyTheme(e.target.value));
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if ((localStorage.getItem("theme") || "auto") === "auto") applyTheme("auto");
  });
  // 店内モード
  $("btn-store-mode").addEventListener("click", openStoreMode);
  $("btn-store-mode-close").addEventListener("click", closeStoreMode);
  // 写真: 選ぶ / 外す / 拡大して見る
  $("req-photo-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    pendingReqPhoto = file;
    const reader = new FileReader();
    reader.onload = (ev) => setReqPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  });
  $("btn-req-photo-clear").addEventListener("click", (e) => {
    e.preventDefault();
    pendingReqPhoto = "";           // 「外す」の意思表示
    setReqPhotoPreview("");
  });
  $("btn-photo-viewer-close").addEventListener("click", closePhotoViewer);
  $("photo-viewer").addEventListener("click", (e) => {
    if (e.target === $("photo-viewer")) closePhotoViewer();
  });
  // 写真はいろんな画面に出るので、まとめて受ける
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-photo]");
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    openPhotoViewer(el.dataset.photo);
  });
  // メンテナンス（更新・復旧）
  $("btn-refresh-data").addEventListener("click", doPullRefresh);
  $("btn-force-update").addEventListener("click", forceRefreshApp);
  $("btn-force-signout").addEventListener("click", forceSignOut);
  initPullToRefresh();
  showAppVersion();
  // ホーム画面ショートカット（?action=add）から起動されたら追加シートを開く
  if (new URLSearchParams(location.search).get("action") === "add") {
    setTimeout(() => { if ($("screen-main").classList.contains("active")) openSheet(); }, 900);
  }
  $("btn-enable-push").addEventListener("click", togglePush);
  $("btn-add-reminder-time").addEventListener("click", addReminderTime);
  $("reminder-time-input").addEventListener("keydown", (e) => { if (e.key === "Enter") addReminderTime(); });
  initPushOnLoad();
  // Enter キーも追加ボタンと同じ分岐（shortcutMode を無視すると⭐登録シートで
  // 本物の依頼が作られてしまうバグがあった）
  $("new-name").addEventListener("keydown", (e) => { if (e.key === "Enter") { if (editingRequestId) updateRequest(); else if (shortcutMode) addShortcutFromSheet(); else addRequest(); } });
  $("auth-password").addEventListener("keydown", (e) => { if (e.key === "Enter") signInEmail(); });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeSheet();
    closeStockSheet();
    closeMissionSheet();
    closeStockDetail();
    closeHowto();
    closeHistorySheet();
    if (storeModeOpen) closeStoreMode();
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

// 現在のキャッシュ版（= アプリのバージョン）を Service Worker から取得して表示
function showAppVersion() {
  const el = $("app-version");
  if (!el) return;
  if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) {
    el.textContent = "（オンライン版）";
    return;
  }
  const onMsg = (e) => {
    if (e.data && e.data.type === "VERSION") {
      el.textContent = String(e.data.version).replace("otsukai-", "");
      navigator.serviceWorker.removeEventListener("message", onMsg);
    }
  };
  navigator.serviceWorker.addEventListener("message", onMsg);
  navigator.serviceWorker.controller.postMessage({ type: "GET_VERSION" });
  setTimeout(() => { if (el.textContent === "—") el.textContent = "（取得できません）"; }, 2000);
}

// ===== スライドで更新（引っ張って更新） =====
// リアルタイム同期しているので通常は不要だが、「表示がおかしい気がする」ときに
// 手元で確かめられる操作があると安心なので用意する。
// 実行内容: 家族データのリスナーを張り直す＋アプリの更新チェック。
let ptrStartY = null, ptrPulling = false, ptrRefreshing = false;

function atPageTop() {
  return (window.scrollY || document.documentElement.scrollTop || 0) <= 0;
}
// シートや店内モードが開いている間は無効（そちらのスクロールを邪魔しないため）
function ptrBlocked() {
  return !!document.querySelector(".sheet.open") ||
    (document.getElementById("store-mode") || {}).classList?.contains("open") ||
    !document.getElementById("screen-main").classList.contains("active");
}

function ptrIndicator() {
  let el = document.getElementById("ptr-indicator");
  if (!el) {
    el = document.createElement("div");
    el.id = "ptr-indicator";
    el.className = "ptr-indicator";
    el.innerHTML = `<span class="ptr-spinner">🔄</span>`;
    document.body.appendChild(el);
  }
  return el;
}

async function doPullRefresh() {
  if (ptrRefreshing) return;
  ptrRefreshing = true;
  const el = ptrIndicator();
  el.classList.add("spinning");
  try {
    if (state.familyId) attachFamilyListeners(); // リスナーを張り直して最新を取り直す
    if (swRegistration) await swRegistration.update().catch(() => {});
    await new Promise((r) => setTimeout(r, 600)); // 体感用の最小表示時間
    showToast("🔄 最新の状態に更新しました", { sound: false });
  } finally {
    el.classList.remove("spinning", "visible");
    el.style.transform = "";
    ptrRefreshing = false;
  }
}

function initPullToRefresh() {
  const THRESHOLD = 70;
  document.addEventListener("touchstart", (e) => {
    if (ptrRefreshing || ptrBlocked() || !atPageTop() || e.touches.length !== 1) { ptrStartY = null; return; }
    ptrStartY = e.touches[0].clientY;
    ptrPulling = false;
  }, { passive: true });

  document.addEventListener("touchmove", (e) => {
    if (ptrStartY === null || ptrRefreshing) return;
    const dy = e.touches[0].clientY - ptrStartY;
    if (dy <= 0) { ptrStartY = null; return; }
    if (!atPageTop()) { ptrStartY = null; return; }
    ptrPulling = true;
    const el = ptrIndicator();
    el.classList.add("visible");
    const pull = Math.min(dy * 0.5, 90);
    el.style.transform = `translate(-50%, ${pull}px) rotate(${pull * 4}deg)`;
    el.classList.toggle("ready", dy >= THRESHOLD);
  }, { passive: true });

  document.addEventListener("touchend", () => {
    if (ptrStartY === null) return;
    const el = ptrIndicator();
    const ready = el.classList.contains("ready");
    el.classList.remove("ready");
    ptrStartY = null;
    if (ptrPulling && ready) doPullRefresh();
    else { el.classList.remove("visible"); el.style.transform = ""; }
    ptrPulling = false;
  }, { passive: true });
}

// ===== PWA: Service Worker 登録と更新の検知 =====
// PWA は app-*.js / styles.css をキャッシュ優先で配信するため、放置すると
// 古いバージョンのまま固定されてしまう。そこで
//   1. 新バージョンを検知したら画面上部にバナーを出し、タップで即切り替え
//   2. 起動時・アプリに戻ったとき・1時間ごとに更新チェック
//   3. それでも直らないとき用に設定タブから「アプリを更新」（全キャッシュ破棄）
// の3段構えにする。
let swRegistration = null;
let reloadingForUpdate = false;
let updateRequested = false; // ユーザーが「更新する」を押したか

function showUpdateBanner() {
  if (document.getElementById("update-banner")) return;
  const bar = document.createElement("div");
  bar.id = "update-banner";
  bar.className = "update-banner";
  bar.innerHTML = `
    <span class="update-banner-text">🆕 新しいバージョンがあります</span>
    <button class="update-banner-btn" id="btn-apply-update">更新する</button>
    <button class="update-banner-close" id="btn-dismiss-update" aria-label="あとで">✕</button>`;
  document.body.appendChild(bar);
  requestAnimationFrame(() => bar.classList.add("open"));
  document.getElementById("btn-apply-update").addEventListener("click", applyUpdate);
  document.getElementById("btn-dismiss-update").addEventListener("click", () => bar.remove());
}

// 待機中の新バージョンを有効化し、切り替わったら1回だけ再読み込みする
function applyUpdate() {
  updateRequested = true;
  const waiting = swRegistration && swRegistration.waiting;
  if (!waiting) { location.reload(); return; }
  showToast("更新しています…", { sound: false });
  waiting.postMessage({ type: "SKIP_WAITING" });
  // controllerchange を待つが、来なかった場合の保険で 3 秒後に再読み込み
  setTimeout(() => { if (!reloadingForUpdate) { reloadingForUpdate = true; location.reload(); } }, 3000);
}

// 最後の手段: 全キャッシュを捨てて Service Worker を作り直し、再取得させる
async function forceRefreshApp() {
  if (!confirm("アプリを最新版に更新しますか？\n\nキャッシュを破棄して読み込み直します（ログイン状態や家族のデータはそのままです）。")) return;
  showToast("最新版を取得しています…", { sound: false });
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch (e) { console.error("forceRefreshApp failed", e); }
  // クエリを付けてキャッシュを確実にすり抜ける
  location.replace(location.pathname + "?fresh=" + Date.now());
}

// データがおかしいときの復旧用: ログアウトしてローカル状態も消す
async function forceSignOut() {
  if (!confirm("ログアウトして、この端末に保存された表示設定をリセットしますか？\n\n家族のデータ（買い物リストなど）は消えません。")) return;
  try {
    await signOut();
  } catch (e) { console.error(e); }
  try {
    // 端末ローカルの設定・既読情報などをクリア（テーマは残さない＝初期状態へ）
    localStorage.clear();
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (e) { console.error(e); }
  location.replace(location.pathname + "?fresh=" + Date.now());
}

if ("serviceWorker" in navigator) {
  // 起動時点で SW に制御されていたか（＝初回登録かどうかの判定に使う）
  const hadControllerAtStart = !!navigator.serviceWorker.controller;
  window.addEventListener("load", async () => {
    try {
      // updateViaCache:"none" … sw.js を HTTP キャッシュ経由で比較させない。
      // 既定（"imports"）だとブラウザのキャッシュが残っている間は更新を検知できず、
      // 新バージョンを配信しても古いままになることがある。
      const reg = await navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" });
      swRegistration = reg;

      // すでに新バージョンが待機している
      if (reg.waiting && navigator.serviceWorker.controller) showUpdateBanner();

      // これから入ってくる新バージョンを監視
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller) showUpdateBanner();
        });
      });

      // 制御する Service Worker が変わったとき。
      // 初回登録でも（未制御 → 制御）発火するため、無条件に再読み込みすると
      // 入力途中の画面が巻き込まれる。ユーザーが「更新する」を押したときだけ
      // 再読み込みし、それ以外（他のタブで更新された等）はバナー提示にとどめる。
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (updateRequested) {
          if (reloadingForUpdate) return;
          reloadingForUpdate = true;
          location.reload();
        } else if (hadControllerAtStart) {
          // 他のタブなどで新バージョンが有効化された → 案内だけ出す
          showUpdateBanner();
        }
        // 初回登録（起動時に制御なし → 制御された）は何もしない
      });

      // 更新チェック: 起動直後・アプリに戻ったとき・1時間ごと
      const checkUpdate = () => reg.update().catch(() => {});
      checkUpdate();
      document.addEventListener("visibilitychange", () => { if (!document.hidden) checkUpdate(); });
      setInterval(checkUpdate, 60 * 60 * 1000);
    } catch (e) { /* 登録失敗時は通常の Web ページとして動作する */ }
  });
}

// おうちのおつかい — カテゴリ選択・追加/編集シート・依頼CRUD
// 元 app.js の 702〜1133行目。index.html の <script> 順で他の app-*.js と読み込み順が保証される
// （クラシックスクリプトなのでグローバルスコープを共有。type="module" にはしていない）。

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
  setReqPhotoPreview("");
  pendingReqPhoto = null;
  existingReqPhotoUrl = "";
  $("new-cycle-wrap").style.display = "none";
  $("new-cycle-days").value = "";
}

// 追加/編集シートの写真プレビュー。url が空なら「タップして選ぶ」に戻す。
function setReqPhotoPreview(url) {
  const wrap = $("req-photo-preview-wrap");
  const clear = $("btn-req-photo-clear");
  if (!wrap) return;
  if (url) {
    wrap.innerHTML = `<img class="photo-preview" src="${escapeHtml(url)}" alt="プレビュー" />`;
    if (clear) clear.style.display = "";
  } else {
    wrap.innerHTML = `<span class="photo-placeholder">📷 タップして写真を選ぶ</span>`;
    if (clear) clear.style.display = "none";
  }
  const input = $("req-photo-input");
  if (input && !url) input.value = "";
}

// 一覧の行に出す写真サムネイル。
// バッジだけだと「写真がある」ことに気づけないので、中身を小さく見せる。
// タップ領域は44px（ui.md）。押すと拡大表示が開く。
function photoThumbHtml(r) {
  if (!r.photoUrl) return "";
  return `<button class="photo-thumb" data-photo="${escapeHtml(r.photoUrl)}" aria-label="${escapeHtml(r.name)}の写真を見る">
    <img src="${escapeHtml(r.photoUrl)}" alt="" loading="lazy" />
  </button>`;
}

// 写真を拡大して見る（買い物中に細部を確かめたいことがあるため）
function openPhotoViewer(url) {
  if (!url) return;
  $("photo-viewer-img").src = url;
  $("photo-viewer").classList.add("open");
}
function closePhotoViewer() {
  $("photo-viewer").classList.remove("open");
  $("photo-viewer-img").src = "";
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
  // closeSheet 側のリセットに頼らず、開くときにも明示的にクリーンな追加モードにする
  resetSheetToAddMode();
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

// 写真のアップロード。失敗しても依頼の作成自体は続ける（写真は任意なので、
// Storage の権限やオフラインで転んだときに「追加できない」にしてしまわない）。
async function uploadRequestPhoto(file, requestId) {
  showToast("写真をアップロード中...", { sound: false });
  try {
    return await uploadPhoto(file, `families/${state.familyId}/requests/${requestId}`);
  } catch (e) {
    console.error("photo upload failed", e);
    showToast("⚠️ 写真だけアップロードできませんでした（内容は保存されます）");
    return null;
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
    if (pendingReqPhoto) {
      const url = await uploadRequestPhoto(pendingReqPhoto, id);
      if (url) req.photoUrl = url;
    }
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
  pendingReqPhoto = null;
  existingReqPhotoUrl = r.photoUrl || "";
  setReqPhotoPreview(existingReqPhotoUrl);
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
  if (pendingReqPhoto) {
    const url = await uploadRequestPhoto(pendingReqPhoto, editingRequestId);
    if (url) updates.photoUrl = url;
  } else if (pendingReqPhoto === "" && existingReqPhotoUrl) {
    updates.photoUrl = null; // 「写真を外す」を押した
  }
  if (!(await dbOp(familyRef().child("requests/" + editingRequestId).update(updates), "更新できませんでした"))) return;
  closeSheet();
  showToast("更新しました ✏️");
}
// 同名のショートカットが既にあるか（⭐ボタンの表示と重複登録防止に使う）
function isShortcutRegistered(name) {
  if (!name) return false;
  return Object.values(state.shortcuts || {}).some((s) => s && s.name === name);
}

// よく買うものを登録したら、同名のストック項目を自動的に用意する。
// 二重管理（よく買うもの一覧とストック一覧を別々に手入力）を避け、既存の
// cycleDays ベースの「⏳ そろそろ切れるかも」予測（app-stock.js）がそのまま効くようにする。
// 品によって持つ期間が違うので、cycleDays を指定すればここで反映される。
// マッチングはストック本体と同じく品名の文字列一致（IDでの紐付けはしない）。
async function ensureStockForShortcut(name, cycleDays) {
  const existing = Object.entries(state.stocks || {}).find(([, s]) => s && s.name === name);
  if (existing) {
    // 既にストックにある品なら、買う間隔だけ反映する（在庫レベルは変えない）
    if (cycleDays > 0) await updateStockCycle(existing[0], cycleDays);
    return;
  }
  const item = { name, level: "ok", updatedBy: state.uid, updatedAt: now() };
  if (cycleDays > 0) { item.cycleDays = cycleDays; item.lastFilledAt = now(); }
  const id = familyRef().child("stocks").push().key;
  await dbOp(familyRef().child("stocks/" + id).set(item), "ストックへの登録に失敗しました");
}

// リスト上の項目を、その内容ごと「よく買うもの」に登録する
async function addShortcutFromRequest(id) {
  const r = state.requests[id];
  if (!r) return;
  if (isShortcutRegistered(r.name)) {
    showToast(`⭐ 「${r.name}」はもう登録されています`, { sound: false });
    return;
  }
  const entry = { name: r.name, diff: r.diff || "normal", urgent: !!r.urgent, createdAt: now(), createdBy: state.uid };
  if (r.memo) entry.memo = r.memo;
  if (r.budget > 0) entry.budget = r.budget;
  if (r.brand) entry.brand = r.brand;
  if (r.assignedTo) entry.assignedTo = r.assignedTo;
  if (r.category) entry.category = r.category;
  const ref = familyRef().child("shortcuts").push();
  if (!(await dbOp(ref.set(entry), "登録できませんでした"))) return;
  await ensureStockForShortcut(r.name); // 買う間隔はここでは指定しない（ストックタブから後で設定可）
  showToast(`⭐ 「${r.name}」をよく買うものに登録しました`, { sound: false });
  renderRequests();
  renderHistory();
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
  setSelectedCategory(null);
  $("new-cycle-days").value = "";
  $("new-cycle-wrap").style.display = "";
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
  const cycleRaw = $("new-cycle-days").value.trim();
  if (cycleRaw && !(parseInt(cycleRaw, 10) >= 1 && parseInt(cycleRaw, 10) <= 365)) {
    showToast("買う間隔は1〜365日で入力してください");
    return;
  }
  const cycleDays = cycleRaw ? parseInt(cycleRaw, 10) : 0;
  const entry = { name, diff, urgent: urgent || false, createdAt: now(), createdBy: state.uid };
  if (memo) entry.memo = memo;
  if (budget > 0) entry.budget = budget;
  if (brand) entry.brand = brand;
  if (assignedTo) entry.assignedTo = assignedTo;
  if (selectedCategory) entry.category = selectedCategory;
  const ref = familyRef().child("shortcuts").push();
  if (!(await dbOp(ref.set(entry), "登録できませんでした"))) return;
  await ensureStockForShortcut(name, cycleDays);
  closeSheet();
  showToast(`⭐ 「${name}」をよく買うものに登録しました`);
}
// 誤操作防止: 削除×は「✏️ 編集」モードの中だけに表示する
let shortcutsEditMode = false;
function renderShortcuts() {
  const wrap = $("shortcut-float-wrap");
  const btn = $("btn-shortcut-toggle");
  const chips = $("shortcut-chips");
  if (!wrap || !btn || !chips) return;
  const entries = Object.entries(state.shortcuts);
  updateShortcutVisibility();
  const count = entries.length;
  btn.innerHTML = `<span style="font-size:17px;line-height:1;">⚡</span> よく買うもの${count ? ` <span style="background:rgba(255,255,255,0.25);border-radius:99px;padding:1px 7px;font-size:11px;font-weight:800;">${count}</span>` : ''}`;
  const editBtn = $("btn-shortcut-edit");
  if (editBtn) {
    editBtn.style.display = count ? "" : "none";
    editBtn.textContent = shortcutsEditMode ? "✔ 完了" : "✏️ 編集";
    editBtn.classList.toggle("open", shortcutsEditMode);
  }
  if (!count) {
    shortcutsEditMode = false;
    chips.innerHTML = `<p class="shortcut-chips-empty">まだ登録がありません。「＋ よく買うものを登録」か、リストの項目の ☆ から追加できます。</p>`;
  } else {
    // カテゴリ順（食品→日用品→その他→未分類）→ 名前順で並べ、カテゴリ見出しを付けて見やすく。
    // 全件が未分類なら見出しは出さない。
    const sorted = entries.sort(([, a], [, b]) =>
      categoryOrder(a) - categoryOrder(b) || (a.name || "").localeCompare(b.name || "", "ja"));
    const anyCategorized = sorted.some(([, s]) => s.category && CATEGORY[s.category]);
    let html = "";
    let curCat;
    sorted.forEach(([id, s]) => {
      const catKey = s.category && CATEGORY[s.category] ? s.category : "none";
      if (anyCategorized && catKey !== curCat) {
        curCat = catKey;
        const hdr = catKey === "none" ? "📎 未分類" : `${CATEGORY[catKey].emoji} ${CATEGORY[catKey].label}`;
        html += `<div class="shortcut-cat-hdr">${hdr}</div>`;
      }
      const hints = [];
      if (s.budget > 0) hints.push(`💰${Number(s.budget).toLocaleString()}円`);
      if (s.brand) hints.push(`🏷️${escapeHtml(s.brand)}`);
      if (s.assignedTo) {
        const m = (state.family && state.family.members && state.family.members[s.assignedTo]);
        if (m) hints.push(`👤${escapeHtml(m.name || '')}`);
      }
      const hintHtml = hints.length ? `<span class="shortcut-row-hints">${hints.join(' ')}</span>` : '';
      html += `
      <button class="shortcut-row${shortcutsEditMode ? " editing" : ""}" data-sid="${id}" aria-label="${escapeHtml(s.name)}を買い物リストに追加">
        <span class="shortcut-row-main">
          <span class="shortcut-row-name">${s.urgent ? '🔥 ' : ''}${escapeHtml(s.name)}</span>
          ${hintHtml}
        </span>
        ${shortcutsEditMode
          ? `<span class="shortcut-row-del" data-del="${id}" role="button" aria-label="削除">×</span>`
          : `<span class="shortcut-row-add" aria-hidden="true">＋</span>`}
      </button>`;
    });
    chips.innerHTML = html;
  }
  chips.querySelectorAll(".shortcut-row").forEach(row => {
    row.addEventListener("click", (e) => {
      if (e.target.closest(".shortcut-row-del")) return;
      if (shortcutsEditMode) return; // 編集中の誤タップで追加しない
      const s = state.shortcuts[row.dataset.sid];
      if (s) { addFromShortcut(s); closeShortcutPanel(); }
    });
  });
  chips.querySelectorAll(".shortcut-row-del").forEach(del => {
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      const s = state.shortcuts[del.dataset.del];
      if (s && !confirm(`「${s.name}」をよく買うものから削除しますか？`)) return;
      deleteShortcut(del.dataset.del);
    });
  });
}
function openShortcutPanel() {
  $("shortcut-sheet").classList.add("open");
  $("sheet-backdrop").classList.add("open");
  $("btn-shortcut-toggle").classList.add("open");
}
function closeShortcutPanel() {
  const sheet = $("shortcut-sheet");
  const btn = $("btn-shortcut-toggle");
  if (sheet) sheet.classList.remove("open");
  $("sheet-backdrop").classList.remove("open");
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

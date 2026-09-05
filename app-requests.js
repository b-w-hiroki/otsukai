// おうちのおつかい — カテゴリ選択・追加/編集シート・依頼CRUD
// 元 app.js の 702〜1133行目。index.html の <script> 順で他の app-*.js と読み込み順が保証される
// （クラシックスクリプトなのでグローバルスコープを共有。type="module" にはしていない）。

// ===== Category =====
// 固定3種のカテゴリ。追加・編集シートではいずれか1つを必ずタップしないと保存できない
// （選ばずに保存して意図せず未分類になる、を防ぐため。当てはまるものが無ければ
// 「📦 その他」を選ぶ。「未分類」という選択肢は別途用意しない）。
const CATEGORY = {
  food:  { emoji: "🍎", label: "食品",   order: 0 },
  daily: { emoji: "🧻", label: "日用品", order: 1 },
  other: { emoji: "📦", label: "その他", order: 2 },
};
const CATEGORY_NONE_ORDER = 3; // 未分類（"none" またはカテゴリ未設定）はカテゴリ付きの後ろに並べる
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

// ===== 行き先（家族共通の登録制。カテゴリと違い固定3種ではなく、設定タブで自由に追加/削除する） =====
// 未設定でも困らない任意項目のため、カテゴリのような「必須タップ」は課さない。
let selectedDestination = null;

// 登録順そのまま（destinations は push キーなので createdAt で並べる）を「行き先の並び順」とする。
// 買い物リストのグルーピング順も、設定タブの表示順もこれに合わせて一貫させる。
function sortedDestinations() {
  return Object.entries(state.destinations || {})
    .map(([id, d]) => ({ id, ...d }))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}
function destinationOrder(r) {
  if (!r.destination) return Infinity; // 行き先未設定は各カテゴリの最後にまとめる
  const idx = sortedDestinations().findIndex((d) => d.id === r.destination);
  return idx === -1 ? Infinity : idx; // 削除済みの行き先を指していた場合も末尾扱い
}
function destinationName(r) {
  const d = state.destinations && state.destinations[r.destination];
  return d ? d.name : null;
}

// カテゴリ（#new-category）とは違い、行き先は家族ごとに件数も内容も変わるため、
// シートを開くたびに現在の登録状況からチップを作り直し、その場で選択を配線する。
function renderNewDestinationPicker() {
  selectedDestination = null;
  const el = $("new-destination");
  const dests = sortedDestinations();
  // 行き先を1件も登録していない家族には、行ごと出さない（説明文だけの行を増やさない）
  $("new-destination-wrap").style.display = dests.length ? "" : "none";
  el.innerHTML = dests.map((d) => `<button type="button" class="cat-chip" data-dest="${d.id}">🏬 ${escapeHtml(d.name)}</button>`).join("");
  el.querySelectorAll(".cat-chip").forEach((b) => {
    b.addEventListener("click", () => {
      const willSelect = !b.classList.contains("selected");
      el.querySelectorAll(".cat-chip").forEach((c) => c.classList.remove("selected"));
      selectedDestination = willSelect ? b.dataset.dest : null;
      if (willSelect) b.classList.add("selected");
    });
  });
}
// 編集シートを開いたときなど、既存の選択値を反映したい場合に呼ぶ
function setSelectedDestination(id) {
  selectedDestination = id && state.destinations[id] ? id : null;
  $("new-destination").querySelectorAll(".cat-chip").forEach((b) => {
    b.classList.toggle("selected", b.dataset.dest === selectedDestination);
  });
}

// 設定タブ: 行き先リストの表示（追加・削除）
function renderDestinationSettings() {
  const el = $("destination-list");
  if (!el) return;
  const dests = sortedDestinations();
  el.innerHTML = dests.length
    ? dests.map((d) => `<span class="dest-chip">🏬 ${escapeHtml(d.name)}<button data-del-dest="${d.id}" aria-label="「${escapeHtml(d.name)}」を削除">×</button></span>`).join("")
    : `<p class="muted" style="font-size:12px;margin:0;">まだ行き先が登録されていません。</p>`;
  el.querySelectorAll("[data-del-dest]").forEach((b) => {
    b.addEventListener("click", () => deleteDestination(b.dataset.delDest));
  });
}
async function addDestination() {
  const input = $("new-destination-name");
  const name = input.value.trim();
  if (!name) return showToast("行き先の名前を入力してください");
  if (Object.values(state.destinations || {}).some((d) => d && d.name === name)) {
    showToast(`「${name}」はもう登録されています`, { sound: false });
    return;
  }
  const ref = familyRef().child("destinations").push();
  if (!(await dbOp(ref.set({ name, createdAt: now(), createdBy: state.uid }), "登録できませんでした"))) return;
  input.value = "";
  showToast(`🏬 「${name}」を登録しました`, { sound: false });
}
// 削除済みの行き先を使っていた依頼・ストック・よく買うものは「行き先未設定」扱いに
// 戻るだけでデータ自体は消えないが、破壊的操作（削除）のルール（docs/rules/ui.md）に
// 従い confirm を挟む。
async function deleteDestination(id) {
  const d = state.destinations[id];
  if (!d) return;
  if (!confirm(`「${d.name}」を削除しますか？\n\nこの行き先が設定されていた項目は「行き先未設定」に戻ります。`)) return;
  await dbOp(familyRef().child("destinations/" + id).remove(), "削除できませんでした");
  showToast(`「${d.name}」を削除しました`, { sound: false });
}

// ===== Bottom sheet =====
function resetSheetToAddMode() {
  editingRequestId = null;
  shortcutMode = false;
  editingShortcutId = null;
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
  renderNewDestinationPicker();
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
  $("btn-add-float").classList.add("open");
  setTimeout(() => $("new-name").focus(), 350);
}
function closeSheet() {
  $("sheet-add").classList.remove("open");
  $("sheet-backdrop").classList.remove("open");
  $("btn-add-float").classList.remove("open");
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
  if (!selectedCategory) return showToast("カテゴリを選んでください");
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
    req.category = selectedCategory;
    if (selectedDestination) req.destination = selectedDestination;
    if (pendingReqPhoto) {
      // File なら実写真としてアップロード、文字列なら選んだイラストのパスをそのまま使う
      const url = pendingReqPhoto instanceof File ? await uploadRequestPhoto(pendingReqPhoto, id) : pendingReqPhoto;
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
  renderNewDestinationPicker();
  setSelectedDestination(r.destination || null);
  pendingReqPhoto = null;
  existingReqPhotoUrl = r.photoUrl || "";
  setReqPhotoPreview(existingReqPhotoUrl);
  // 編集モード UI
  document.querySelector("#sheet-add .sheet-title").textContent = "✏️ おつかいを編集";
  $("btn-add-request").textContent = "更新する";
  $("sheet-add").classList.add("open");
  $("sheet-backdrop").classList.add("open");
  $("btn-add-float").classList.add("open");
  setTimeout(() => $("new-name").focus(), 350);
}
async function updateRequest() {
  if (!editingRequestId) return;
  const name = $("new-name").value.trim();
  if (!name) return showToast("品名を入力してください");
  if (!selectedCategory) return showToast("カテゴリを選んでください");
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
  updates.category = selectedCategory;
  updates.destination = selectedDestination || null;
  if (pendingReqPhoto) {
    const url = pendingReqPhoto instanceof File ? await uploadRequestPhoto(pendingReqPhoto, editingRequestId) : pendingReqPhoto;
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
async function ensureStockForShortcut(name, cycleDays, category, destination) {
  const existing = Object.entries(state.stocks || {}).find(([, s]) => s && s.name === name);
  if (existing) {
    // 既にストックにある品なら、買う間隔だけ反映する（在庫レベルは変えない）
    if (cycleDays > 0) await updateStockCycle(existing[0], cycleDays);
    return;
  }
  const item = { name, level: "ok", updatedBy: state.uid, updatedAt: now() };
  if (category) item.category = category;
  if (destination) item.destination = destination;
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
  if (r.destination) entry.destination = r.destination;
  const ref = familyRef().child("shortcuts").push();
  if (!(await dbOp(ref.set(entry), "登録できませんでした"))) return;
  await ensureStockForShortcut(r.name, 0, r.category, r.destination); // 買う間隔はここでは指定しない（ストックタブから後で設定可）
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
  if (s.destination) req.destination = s.destination;
  if (s.photoUrl) req.photoUrl = s.photoUrl;
  if (!(await dbOp(familyRef().child("requests/" + id).set(req), "追加できませんでした"))) return;
  bumpStat("requestedCount");
  showToast(`🛒 「${s.name}」を追加しました`);
}
function openShortcutRegisterSheet() {
  // resetSheetToAddMode() で写真プレビュー等も含めて確実にクリーンな状態にしてから、
  // ショートカット登録モードに上書きする（他のモードで選んだ写真が紛れ込むのを防ぐ）
  resetSheetToAddMode();
  shortcutMode = true;
  editingRequestId = null;
  populateAssigneeSelect("");
  $("new-cycle-wrap").style.display = "";
  // ショートカット登録モード UI
  document.querySelector("#sheet-add .sheet-title").textContent = "⭐ よく買うものを登録";
  $("btn-add-request").textContent = "登録する";
  $("sheet-add").classList.add("open");
  $("sheet-backdrop").classList.add("open");
  setTimeout(() => $("new-name").focus(), 350);
}
async function addShortcutFromSheet() {
  const name = $("new-name").value.trim();
  if (!name) return showToast("品名を入力してください");
  if (!selectedCategory) return showToast("カテゴリを選んでください");
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
  entry.category = selectedCategory;
  if (selectedDestination) entry.destination = selectedDestination;
  const ref = familyRef().child("shortcuts").push();
  if (pendingReqPhoto) {
    const url = pendingReqPhoto instanceof File ? await uploadShortcutPhoto(pendingReqPhoto, ref.key) : pendingReqPhoto;
    if (url) entry.photoUrl = url;
  }
  if (!(await dbOp(ref.set(entry), "登録できませんでした"))) return;
  await ensureStockForShortcut(name, cycleDays, selectedCategory, selectedDestination);
  closeSheet();
  showToast(`⭐ 「${name}」をよく買うものに登録しました`);
}
// 既存のよく買うものを編集するシートを開く（編集モードでカード本体をタップしたとき）。
// 名前・カテゴリ・手間などを、カテゴリ必須化より前に登録された項目でも後から直せるようにする。
// 買う間隔は登録時に一度ストックへ渡すだけの値でショートカット自体には保存していないため、
// このシートでは出さない（ストックタブ側でいつでも設定できる）。
function openShortcutEditSheet(id) {
  const s = state.shortcuts[id];
  if (!s) return;
  // シートを閉じてから編集シートを開く（DOM順で sheet-add がこのシートより手前にあり、
  // 開いたままだと編集シートが背面に隠れて操作できないため。登録シートと同じ理由）
  closeShortcutSheet();
  resetSheetToAddMode();
  editingShortcutId = id;
  populateAssigneeSelect("");
  $("new-name").value = s.name || "";
  $("new-diff").value = s.diff || "normal";
  $("new-urgent").checked = !!s.urgent;
  $("new-memo").value = s.memo || "";
  $("new-budget").value = s.budget > 0 ? s.budget : "";
  $("new-brand").value = s.brand || "";
  $("new-assignee").value = s.assignedTo || "";
  setSelectedCategory(s.category || null);
  renderNewDestinationPicker();
  setSelectedDestination(s.destination || null);
  pendingReqPhoto = null;
  existingReqPhotoUrl = s.photoUrl || "";
  setReqPhotoPreview(existingReqPhotoUrl);
  document.querySelector("#sheet-add .sheet-title").textContent = "✏️ よく買うものを編集";
  $("btn-add-request").textContent = "更新する";
  $("sheet-add").classList.add("open");
  $("sheet-backdrop").classList.add("open");
  setTimeout(() => $("new-name").focus(), 350);
}
async function updateShortcut() {
  if (!editingShortcutId) return;
  const name = $("new-name").value.trim();
  if (!name) return showToast("品名を入力してください");
  if (!selectedCategory) return showToast("カテゴリを選んでください");
  const diff = $("new-diff").value;
  const urgent = $("new-urgent").checked;
  const memo = $("new-memo").value.trim();
  const budget = parseInt($("new-budget").value, 10);
  const brand = $("new-brand").value.trim();
  const assignedTo = $("new-assignee").value;
  const updates = { name, diff, urgent, category: selectedCategory };
  updates.memo = memo || null;
  updates.budget = budget > 0 ? budget : null;
  updates.brand = brand || null;
  updates.assignedTo = assignedTo || null;
  updates.destination = selectedDestination || null;
  if (pendingReqPhoto) {
    const url = pendingReqPhoto instanceof File ? await uploadShortcutPhoto(pendingReqPhoto, editingShortcutId) : pendingReqPhoto;
    if (url) updates.photoUrl = url;
  } else if (pendingReqPhoto === "" && existingReqPhotoUrl) {
    updates.photoUrl = null; // 「写真を外す」を押した
  }
  if (!(await dbOp(familyRef().child("shortcuts/" + editingShortcutId).update(updates), "更新できませんでした"))) return;
  closeSheet();
  showToast("更新しました ✏️");
}
async function uploadShortcutPhoto(file, shortcutId) {
  showToast("写真をアップロード中...", { sound: false });
  try {
    return await uploadPhoto(file, `families/${state.familyId}/shortcuts/${shortcutId}`);
  } catch (e) {
    console.error("photo upload failed", e);
    showToast("⚠️ 写真だけアップロードできませんでした（内容は保存されます）");
    return null;
  }
}
// 編集モード中、カードの写真をタップして選び直した画像をアップロードし、
// そのカードの photoUrl だけ差し替える（他の項目には影響しない）
async function replaceShortcutPhoto(shortcutId, file) {
  const s = state.shortcuts[shortcutId];
  if (!s) return;
  const url = await uploadShortcutPhoto(file, shortcutId);
  if (!url) return;
  if (!(await dbOp(familyRef().child("shortcuts/" + shortcutId + "/photoUrl").set(url), "写真を更新できませんでした"))) return;
  showToast(`📷 「${s.name}」の写真を変更しました`, { sound: false });
}
// 「イラストから選ぶ」で選んだパスをそのまま photoUrl に入れる（アップロード不要）
async function setShortcutIllustration(shortcutId, path) {
  const s = state.shortcuts[shortcutId];
  if (!s) return;
  if (!(await dbOp(familyRef().child("shortcuts/" + shortcutId + "/photoUrl").set(path), "写真を更新できませんでした"))) return;
  showToast(`🎨 「${s.name}」の写真を変更しました`, { sound: false });
}
// 誤操作防止: 削除×・写真の差し替えは「✏️ 編集」モードの中だけに表示する
let shortcutsEditMode = false;
// 編集モードで写真タップ→ファイル選択の間、どのカードを対象にしたかを覚えておく
// （カードごとに <input type=file> を用意せず、共有の1つを使い回すため）
let shortcutPhotoTargetId = null;

// ===== イラスト（shortcut-icons/）のライブラリ =====
// 🎨「イラストから選ぶ」ピッカーの一覧と、品名からの自動判定（キーワード）を1か所で持つ。
// 絵の実体は shortcut-icons/<file>.svg（薄い丸の中に絵文字1文字を置いたSVG）。
// 追加するときは: ①SVG を置く ②ここに1行足す ③sw.js の PRECACHE に足す。
// group は ICON_GROUPS のキー。ピッカーでは group ごとに見出しを付けて並べる。
const ICON_GROUPS = {
  veg: "🥬 野菜",
  fruit: "🍎 果物",
  meat: "🍖 肉・魚・卵",
  dairy: "🥛 乳製品・パン・主食",
  ready: "🍱 調味料・加工食品",
  drink: "🧃 飲み物・おやつ",
  daily: "🧻 日用品",
  clean: "🧹 掃除・洗濯",
  other: "🎁 その他",
};
const ICON_LIBRARY = [
  { file: "tomato", label: "トマト", group: "veg", keywords: ["トマト"] },
  { file: "carrot", label: "にんじん", group: "veg", keywords: ["にんじん", "人参", "ニンジン"] },
  { file: "onion", label: "たまねぎ", group: "veg", keywords: ["たまねぎ", "玉ねぎ", "玉葱", "タマネギ"] },
  { file: "cabbage", label: "キャベツ", group: "veg", keywords: ["キャベツ"] },
  { file: "lettuce", label: "レタス", group: "veg", keywords: ["レタス", "サニーレタス"] },
  { file: "potato", label: "じゃがいも", group: "veg", keywords: ["じゃがいも", "ジャガイモ", "じゃが芋", "馬鈴薯"] },
  { file: "sweetpotato", label: "さつまいも", group: "veg", keywords: ["さつまいも", "サツマイモ", "薩摩芋", "さつま芋"] },
  { file: "cucumber", label: "きゅうり", group: "veg", keywords: ["きゅうり", "キュウリ", "胡瓜"] },
  { file: "spinach", label: "ほうれん草", group: "veg", keywords: ["ほうれん草", "ホウレンソウ", "ほうれんそう", "小松菜", "こまつな", "ニラ", "にら", "水菜"] },
  { file: "broccoli", label: "ブロッコリー", group: "veg", keywords: ["ブロッコリー", "カリフラワー"] },
  { file: "avocado", label: "アボカド", group: "veg", keywords: ["アボカド"] },
  { file: "eggplant", label: "なす", group: "veg", keywords: ["なす", "ナス", "茄子"] },
  { file: "mushroom", label: "きのこ", group: "veg", keywords: ["きのこ", "キノコ", "しめじ", "シメジ", "えのき", "エノキ", "しいたけ", "椎茸", "まいたけ", "舞茸", "エリンギ", "マッシュルーム"] },
  { file: "corn", label: "とうもろこし", group: "veg", keywords: ["とうもろこし", "トウモロコシ", "コーン"] },
  { file: "garlic", label: "にんにく", group: "veg", keywords: ["にんにく", "ニンニク", "大蒜", "しょうが", "生姜", "ショウガ"] },
  { file: "pepper", label: "ピーマン", group: "veg", keywords: ["ピーマン", "パプリカ"] },
  { file: "chili", label: "とうがらし", group: "veg", keywords: ["唐辛子", "とうがらし", "鷹の爪", "一味", "七味"] },
  { file: "salad", label: "サラダ", group: "veg", keywords: ["サラダ", "カット野菜", "もやし", "モヤシ", "豆苗"] },
  { file: "daikon", label: "大根", group: "veg", keywords: ["大根", "だいこん", "ダイコン", "かぶ", "カブ", "ごぼう", "ゴボウ", "れんこん", "レンコン", "長ねぎ", "ねぎ", "ネギ"] },
  { file: "apple", label: "りんご", group: "fruit", keywords: ["りんご", "リンゴ", "林檎"] },
  { file: "banana", label: "バナナ", group: "fruit", keywords: ["バナナ"] },
  { file: "strawberry", label: "いちご", group: "fruit", keywords: ["いちご", "イチゴ", "苺"] },
  { file: "grapes", label: "ぶどう", group: "fruit", keywords: ["ぶどう", "ブドウ", "葡萄", "シャインマスカット", "マスカット"] },
  { file: "orange", label: "みかん", group: "fruit", keywords: ["みかん", "ミカン", "蜜柑", "オレンジ", "デコポン", "グレープフルーツ"] },
  { file: "lemon", label: "レモン", group: "fruit", keywords: ["レモン", "ゆず", "柚子", "すだち", "かぼす", "ライム"] },
  { file: "peach", label: "もも", group: "fruit", keywords: ["もも", "モモ", "桃"] },
  { file: "pear", label: "なし", group: "fruit", keywords: ["梨", "ナシ", "洋なし", "洋梨", "ラ・フランス"] },
  { file: "cherry", label: "さくらんぼ", group: "fruit", keywords: ["さくらんぼ", "サクランボ", "チェリー"] },
  { file: "watermelon", label: "すいか", group: "fruit", keywords: ["すいか", "スイカ", "西瓜"] },
  { file: "melon", label: "メロン", group: "fruit", keywords: ["メロン"] },
  { file: "pineapple", label: "パイナップル", group: "fruit", keywords: ["パイナップル", "パイン"] },
  { file: "kiwi", label: "キウイ", group: "fruit", keywords: ["キウイ"] },
  { file: "mango", label: "マンゴー", group: "fruit", keywords: ["マンゴー"] },
  { file: "blueberry", label: "ブルーベリー", group: "fruit", keywords: ["ブルーベリー", "ラズベリー"] },
  { file: "persimmon", label: "柿", group: "fruit", keywords: ["柿", "かき", "カキ"] },
  { file: "chicken", label: "鶏肉", group: "meat", keywords: ["鶏肉", "とり肉", "鳥肉", "チキン", "鶏もも", "とりもも", "鶏むね", "とりむね", "ささみ", "手羽先", "手羽元", "手羽中", "鶏ひき肉", "唐揚げ", "からあげ"] },
  { file: "beef", label: "牛肉", group: "meat", keywords: ["牛肉", "ビーフ", "牛もも", "牛バラ", "牛ロース", "牛ひき肉", "牛タン", "牛すね", "牛こま", "ステーキ"] },
  { file: "pork", label: "豚肉", group: "meat", keywords: ["豚肉", "ぶた肉", "ポーク", "豚バラ", "豚ロース", "豚もも", "豚ひき肉", "豚こま", "とんかつ", "トンカツ"] },
  { file: "mince", label: "ひき肉", group: "meat", keywords: ["ひき肉", "挽肉", "合いびき", "合挽", "ミンチ", "お肉", "肉"] },
  { file: "bacon", label: "ベーコン・ハム", group: "meat", keywords: ["ベーコン", "ハム", "生ハム"] },
  { file: "sausage", label: "ウインナー", group: "meat", keywords: ["ウインナー", "ウィンナー", "ソーセージ", "フランクフルト"] },
  { file: "salmon", label: "サケ", group: "meat", keywords: ["サケ", "シャケ", "鮭", "サーモン"] },
  { file: "fish", label: "魚", group: "meat", keywords: ["魚", "さかな", "サバ", "鯖", "さんま", "秋刀魚", "アジ", "鯵", "ぶり", "ブリ", "たら", "タラ", "鱈", "イワシ", "鰯", "マグロ", "まぐろ", "鮪", "かつお", "カツオ", "鰹", "しらす", "ちりめん", "干物", "ししゃも"] },
  { file: "shrimp", label: "えび", group: "meat", keywords: ["えび", "エビ", "海老"] },
  { file: "squid", label: "いか・たこ", group: "meat", keywords: ["イカ", "烏賊", "たこ", "タコ", "蛸"] },
  { file: "crab", label: "かに", group: "meat", keywords: ["カニ", "蟹", "ホタテ", "ほたて", "帆立", "あさり", "アサリ", "しじみ", "シジミ", "牡蠣", "かき", "カキ"] },
  { file: "sushi", label: "刺身・寿司", group: "meat", keywords: ["刺身", "さしみ", "寿司", "すし", "お寿司"] },
  { file: "egg", label: "卵", group: "meat", keywords: ["卵", "たまご", "玉子"] },
  { file: "milk", label: "牛乳", group: "dairy", keywords: ["牛乳", "ミルク", "豆乳", "低脂肪乳"] },
  { file: "yogurt", label: "ヨーグルト", group: "dairy", keywords: ["ヨーグルト", "飲むヨーグルト", "R-1", "R1"] },
  { file: "cheese", label: "チーズ", group: "dairy", keywords: ["チーズ"] },
  { file: "butter", label: "バター", group: "dairy", keywords: ["バター", "マーガリン", "生クリーム"] },
  { file: "bread", label: "パン", group: "dairy", keywords: ["パン", "食パン", "ロールパン", "ベーグル"] },
  { file: "croissant", label: "菓子パン", group: "dairy", keywords: ["クロワッサン", "菓子パン", "メロンパン", "あんパン", "デニッシュ"] },
  { file: "rice", label: "米", group: "dairy", keywords: ["米", "こめ", "コメ", "ごはん", "ご飯", "パックご飯", "もち", "餅"] },
  { file: "riceball", label: "おにぎり", group: "dairy", keywords: ["おにぎり", "おむすび", "海苔", "のり", "ノリ"] },
  { file: "noodle", label: "麺類", group: "dairy", keywords: ["ラーメン", "うどん", "そば", "蕎麦", "麺", "パスタ", "スパゲッティ", "スパゲティ", "そうめん", "素麺", "焼きそば", "中華麺", "カップ麺", "カップヌードル", "インスタント"] },
  { file: "cereal", label: "シリアル", group: "dairy", keywords: ["シリアル", "グラノーラ", "コーンフレーク", "オートミール"] },
  { file: "flour", label: "粉類", group: "dairy", keywords: ["小麦粉", "薄力粉", "強力粉", "片栗粉", "パン粉", "天ぷら粉", "ホットケーキミックス", "ホットケーキ", "お好み焼き粉", "米粉"] },
  { file: "seasoning", label: "調味料", group: "ready", keywords: ["塩", "しお", "こしょう", "胡椒", "砂糖", "しょうゆ", "醤油", "味噌", "みそ", "みりん", "酢", "ソース", "ケチャップ", "マヨネーズ", "ドレッシング", "だし", "出汁", "つゆ", "めんつゆ", "ポン酢", "焼肉のたれ", "たれ", "タレ", "コンソメ", "鶏ガラ", "ごま油", "オリーブオイル", "サラダ油", "油", "調味料", "スパイス", "ふりかけ", "わさび", "からし", "しょうが"] },
  { file: "canned", label: "缶詰", group: "ready", keywords: ["缶詰", "ツナ缶", "トマト缶", "サバ缶", "缶"] },
  { file: "honey", label: "はちみつ・ジャム", group: "ready", keywords: ["はちみつ", "ハチミツ", "蜂蜜", "ジャム", "メープル", "シロップ"] },
  { file: "bento", label: "お弁当・惣菜", group: "ready", keywords: ["弁当", "惣菜", "お惣菜", "お総菜", "コロッケ", "唐揚", "天ぷら"] },
  { file: "dumpling", label: "餃子・点心", group: "ready", keywords: ["餃子", "ぎょうざ", "ギョウザ", "シュウマイ", "焼売", "春巻き", "肉まん"] },
  { file: "curry", label: "カレー・ルウ", group: "ready", keywords: ["カレー", "ルウ", "ルー", "シチュー", "ハヤシ"] },
  { file: "pizza", label: "ピザ", group: "ready", keywords: ["ピザ"] },
  { file: "frozen", label: "冷凍食品", group: "ready", keywords: ["冷凍", "冷食", "氷"] },
  { file: "tofu", label: "豆腐・納豆", group: "ready", keywords: ["豆腐", "とうふ", "納豆", "なっとう", "油揚げ", "厚揚げ", "こんにゃく", "しらたき", "豆"] },
  { file: "retort", label: "レトルト・スープ", group: "ready", keywords: ["レトルト", "スープ", "味噌汁", "みそ汁", "お吸い物", "おでん", "鍋の素", "鍋つゆ"] },
  { file: "water", label: "水", group: "drink", keywords: ["水", "ミネラルウォーター", "天然水", "炭酸水"] },
  { file: "juice", label: "ジュース", group: "drink", keywords: ["ジュース", "野菜ジュース", "カルピス"] },
  { file: "tea", label: "お茶", group: "drink", keywords: ["お茶", "麦茶", "緑茶", "茶", "紅茶", "烏龍茶", "ウーロン茶", "ほうじ茶", "ティーバッグ"] },
  { file: "coffee", label: "コーヒー", group: "drink", keywords: ["コーヒー", "珈琲", "ドリップ", "カフェオレ"] },
  { file: "soda", label: "炭酸・清涼飲料", group: "drink", keywords: ["コーラ", "サイダー", "炭酸", "ソフトドリンク", "スポーツドリンク", "ポカリ", "アクエリ"] },
  { file: "beer", label: "ビール", group: "drink", keywords: ["ビール", "発泡酒"] },
  { file: "wine", label: "ワイン", group: "drink", keywords: ["ワイン", "シャンパン", "スパークリング"] },
  { file: "sake", label: "お酒", group: "drink", keywords: ["日本酒", "酎ハイ", "チューハイ", "焼酎", "ハイボール", "ウイスキー", "お酒", "酒", "梅酒"] },
  { file: "snack", label: "おやつ・お菓子", group: "drink", keywords: ["おやつ", "お菓子", "おかし", "クッキー", "ビスケット", "せんべい", "煎餅", "菓子", "ラスク"] },
  { file: "chocolate", label: "チョコ", group: "drink", keywords: ["チョコ"] },
  { file: "candy", label: "あめ・グミ", group: "drink", keywords: ["あめ", "飴", "キャンディ", "グミ", "ガム", "ラムネ"] },
  { file: "chips", label: "スナック", group: "drink", keywords: ["ポテチ", "ポテトチップス", "スナック", "じゃがりこ", "柿の種", "ナッツ", "ポップコーン"] },
  { file: "icecream", label: "アイス", group: "drink", keywords: ["アイス"] },
  { file: "cake", label: "ケーキ・デザート", group: "drink", keywords: ["ケーキ", "シュークリーム", "プリン", "ゼリー", "ドーナツ", "パフェ", "デザート"] },
  { file: "dango", label: "和菓子", group: "drink", keywords: ["団子", "だんご", "大福", "和菓子", "まんじゅう", "饅頭", "どら焼き", "ようかん", "羊羹"] },
  { file: "toiletpaper", label: "トイレットペーパー", group: "daily", keywords: ["トイレットペーパー", "トイペ", "キッチンペーパー", "ペーパータオル"] },
  { file: "tissue", label: "ティッシュ", group: "daily", keywords: ["ティッシュ", "ティシュ", "ウェットティッシュ", "鼻セレブ"] },
  { file: "soap", label: "せっけん", group: "daily", keywords: ["石けん", "せっけん", "石鹸", "ハンドソープ", "ボディソープ", "ボディーソープ", "洗顔"] },
  { file: "shampoo", label: "シャンプー", group: "daily", keywords: ["シャンプー", "リンス", "コンディショナー", "トリートメント", "ヘアオイル", "整髪"] },
  { file: "cosmetics", label: "化粧品", group: "daily", keywords: ["化粧水", "乳液", "コスメ", "化粧", "ファンデ", "リップ", "日焼け止め", "クレンジング", "美容液", "ハンドクリーム"] },
  { file: "toothbrush", label: "歯ブラシ", group: "daily", keywords: ["歯ブラシ", "歯みがき", "歯磨き", "はみがき", "マウスウォッシュ", "フロス", "歯間"] },
  { file: "razor", label: "カミソリ", group: "daily", keywords: ["カミソリ", "かみそり", "髭剃り", "ヒゲ", "シェーバー", "替刃"] },
  { file: "mask", label: "マスク", group: "daily", keywords: ["マスク"] },
  { file: "medicine", label: "くすり", group: "daily", keywords: ["薬", "くすり", "風邪薬", "胃薬", "目薬", "絆創膏", "ばんそうこう", "バンドエイド", "湿布", "サプリ", "ビタミン", "体温計", "のど飴", "龍角散"] },
  { file: "contact", label: "コンタクト", group: "daily", keywords: ["コンタクト", "洗浄液", "保存液"] },
  { file: "battery", label: "電池", group: "daily", keywords: ["電池", "バッテリー", "充電器", "充電"] },
  { file: "bulb", label: "電球", group: "daily", keywords: ["電球", "蛍光灯", "LED"] },
  { file: "wrap", label: "ラップ・ホイル", group: "daily", keywords: ["ラップ", "アルミホイル", "ホイル", "クッキングシート", "ジップロック", "保存袋", "ポリ袋", "フリーザーバッグ"] },
  { file: "sanitary", label: "生理用品", group: "daily", keywords: ["生理用品", "ナプキン", "タンポン", "おりもの"] },
  { file: "baby", label: "ベビー用品", group: "daily", keywords: ["おむつ", "オムツ", "おしりふき", "粉ミルク", "離乳食", "ベビー", "哺乳瓶"] },
  { file: "pet", label: "ペット用品", group: "daily", keywords: ["ペット", "キャットフード", "ドッグフード", "猫砂", "ネコ砂", "ちゅーる", "えさ", "エサ", "餌", "ペットシーツ"] },
  { file: "laundry", label: "洗濯洗剤", group: "clean", keywords: ["洗濯洗剤", "柔軟剤", "漂白剤", "洗濯", "おしゃれ着", "ハンガー"] },
  { file: "dishsoap", label: "食器用洗剤", group: "clean", keywords: ["食器用洗剤", "食器洗剤", "キュキュット", "ジョイ", "食洗機"] },
  { file: "detergent", label: "洗剤", group: "clean", keywords: ["洗剤", "クリーナー", "カビキラー", "除菌", "アルコール", "消臭", "ファブリーズ"] },
  { file: "sponge", label: "スポンジ", group: "clean", keywords: ["スポンジ", "たわし", "タワシ", "ふきん", "布巾", "雑巾", "ぞうきん", "メラミン"] },
  { file: "broom", label: "掃除用具", group: "clean", keywords: ["ほうき", "掃除", "クイックル", "ワイパー", "モップ", "コロコロ", "粘着", "フロア"] },
  { file: "trash", label: "ゴミ袋", group: "clean", keywords: ["ゴミ袋", "ごみ袋", "ゴミ", "ごみ", "レジ袋"] },
  { file: "bugspray", label: "虫よけ・殺虫", group: "clean", keywords: ["虫よけ", "虫除け", "殺虫", "蚊取り", "キンチョール", "ゴキブリ", "ホウ酸"] },
  { file: "kitchen", label: "キッチン用品", group: "other", keywords: ["フライパン", "鍋", "包丁", "まな板", "ボウル", "菜箸", "おたま", "タッパー", "弁当箱", "水筒", "コップ", "皿"] },
  { file: "clothes", label: "衣類", group: "other", keywords: ["靴下", "くつ下", "下着", "Tシャツ", "パンツ", "シャツ", "肌着", "ストッキング", "タイツ", "手袋", "タオル"] },
  { file: "stationery", label: "文房具", group: "other", keywords: ["ノート", "鉛筆", "えんぴつ", "ペン", "消しゴム", "文房具", "のり", "テープ", "ハガキ", "はがき", "封筒", "年賀状", "クレヨン", "折り紙", "切手"] },
  { file: "flower", label: "花", group: "other", keywords: ["花", "お花", "仏花", "線香"] },
  { file: "gift", label: "プレゼント", group: "other", keywords: ["プレゼント", "ギフト", "手土産", "お土産", "おみやげ"] },
  { file: "umbrella", label: "傘・雨具", group: "other", keywords: ["傘", "かさ", "レインコート", "長靴"] },
  { file: "toy", label: "おもちゃ・本", group: "other", keywords: ["おもちゃ", "絵本", "本", "雑誌", "ゲーム", "付録"] },
  { file: "cigarette", label: "たばこ", group: "other", keywords: ["たばこ", "タバコ", "煙草", "ライター"] },
];
// 写真が未設定のカードでも、品名からよくある品だとわかるものは
// あらかじめ用意したイラスト（shortcut-icons/）を代わりに表示する。
// 本物の写真ではないので、いつでも編集モードから本物の写真に差し替えられる。
// 一致は「いちばん長いキーワード」を優先する（「フライパン」が「パン」に、
// 「パンツ」がパンに、「食器用洗剤」が洗濯洗剤に化けないように）。
function matchShortcutIcon(name) {
  if (!name) return null;
  let best = null, bestLen = 0;
  for (const it of ICON_LIBRARY) {
    for (const k of it.keywords) {
      if (k.length > bestLen && name.includes(k)) { best = it; bestLen = k.length; }
    }
  }
  return best ? `./shortcut-icons/${best.file}.svg` : null;
}

// ===== イラストから選ぶピッカー（よく買うもの/ストック/おつかいの写真欄で共通利用） =====
// 品名からの自動判定（matchShortcutIcon）とは別に、利用者が能動的に選べるようにしたもの。
// 選ぶと photoUrl にイラストのパスをそのまま入れる（本物の写真と同じ扱い。アップロード不要）。
let iconPickerOnSelect = null; // (path) => void
let iconPickerOnCamera = null; // () => void（渡したときだけ「写真をセットする」ボタンをイラスト一覧とは別枠で出す）
function openIconPicker({ onSelect, onCamera } = {}) {
  iconPickerOnSelect = onSelect || null;
  iconPickerOnCamera = onCamera || null;
  // 「イラストを選ぶ」と「写真をセットする」を別の選択肢として並べる。
  // onCamera が無い場面（登録シート）は、写真の欄が既に別にあるのでこのボタンは出さない。
  $("btn-icon-picker-camera").style.display = iconPickerOnCamera ? "" : "none";
  $("icon-picker-grid-label").style.display = iconPickerOnCamera ? "" : "none";
  renderIconPickerGrid();
  $("icon-picker-sheet").classList.add("open");
  $("sheet-backdrop").classList.add("open");
}
function closeIconPicker() {
  $("icon-picker-sheet").classList.remove("open");
  $("sheet-backdrop").classList.remove("open");
  iconPickerOnSelect = null;
  iconPickerOnCamera = null;
}
function renderIconPickerGrid() {
  const grid = $("icon-picker-grid");
  if (!grid) return;
  // 件数が多いので、分類（ICON_GROUPS）ごとに小見出しを付けて並べる
  grid.innerHTML = Object.entries(ICON_GROUPS).map(([g, gLabel]) => {
    const items = ICON_LIBRARY.filter((it) => it.group === g);
    if (!items.length) return "";
    return `<div class="icon-picker-group-hdr">${escapeHtml(gLabel)}</div>` + items.map((it) => `
    <button type="button" class="icon-picker-tile" data-file="${it.file}">
      <img src="./shortcut-icons/${it.file}.svg" alt="" loading="lazy" />
      <span class="icon-picker-tile-label">${escapeHtml(it.label)}</span>
    </button>`).join("");
  }).join("");
  grid.querySelectorAll(".icon-picker-tile").forEach((btn) => {
    btn.addEventListener("click", () => {
      const path = `./shortcut-icons/${btn.dataset.file}.svg`;
      const cb = iconPickerOnSelect;
      closeIconPicker();
      if (cb) cb(path);
    });
  });
}
// ===== カード形式 / リスト形式の切り替え =====
// カードは写真中心で見やすく、リストは1行が小さく詰まった分いちどに多く見渡せる
// （「よく買うものタブが分かりにくい」というフィードバックを受けて、旧リスト形式を復活）。
// 端末ごとに覚え、買い物ページから開く簡易シート（#shortcut-sheet）とも共通の設定。
let shortcutViewMode = localStorage.getItem("shortcutViewMode") === "card" ? "card" : "list";
function setShortcutViewMode(mode) {
  if (mode !== "card" && mode !== "list") return;
  shortcutViewMode = mode;
  localStorage.setItem("shortcutViewMode", mode);
  renderShortcuts();
}
function updateShortcutViewToggles() {
  document.querySelectorAll(".shortcut-viewmode-btn").forEach((btn) => {
    const on = btn.dataset.viewmode === shortcutViewMode;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-selected", String(on));
  });
}
function wireShortcutViewToggles() {
  document.querySelectorAll(".shortcut-viewmode-btn").forEach((btn) => {
    btn.addEventListener("click", () => setShortcutViewMode(btn.dataset.viewmode));
  });
}

function shortcutHintsHtml(s, cardStyle) {
  const hints = [];
  if (s.budget > 0) hints.push(`💰${Number(s.budget).toLocaleString()}円`);
  if (s.brand) hints.push(`🏷️${escapeHtml(s.brand)}`);
  if (destinationName(s)) hints.push(`🏬${escapeHtml(destinationName(s))}`);
  if (s.assignedTo) {
    const m = (state.family && state.family.members && state.family.members[s.assignedTo]);
    if (m) hints.push(`👤${escapeHtml(m.name || '')}`);
  }
  if (!hints.length) return "";
  return `<span class="${cardStyle ? "shortcut-card-hints" : "shortcut-row-hints"}">${hints.join(' ')}</span>`;
}
function shortcutCardHtml(id, s, editMode) {
  const iconUrl = s.photoUrl ? null : matchShortcutIcon(s.name);
  return `
  <button class="shortcut-card${editMode ? " editing" : ""}" data-sid="${id}" aria-label="${escapeHtml(s.name)}を買い物リストに追加">
    <span class="shortcut-card-photo"${editMode ? ` data-photo-edit="${id}" role="button" aria-label="${escapeHtml(s.name)}の写真を変更"` : ""}>
      ${s.photoUrl
        ? `<img src="${escapeHtml(s.photoUrl)}" alt="" loading="lazy" />`
        : iconUrl
          ? `<img src="${iconUrl}" class="shortcut-card-icon" alt="" loading="lazy" />`
          : `<span class="shortcut-card-placeholder" aria-hidden="true">🛒</span>`}
      ${s.urgent ? `<span class="shortcut-card-urgent" aria-hidden="true">🔥</span>` : ""}
      ${editMode ? `<span class="shortcut-card-photo-hint" aria-hidden="true">📷</span>` : ""}
    </span>
    <span class="shortcut-card-name">${escapeHtml(s.name)}</span>
    ${shortcutHintsHtml(s, true)}
    ${editMode ? `<span class="shortcut-card-del" data-del="${id}" role="button" aria-label="削除">×</span>` : ""}
  </button>`;
}
// 元々（下部タブに昇格する前）のシンプルな行形式。写真は出さず品名を主役にして、
// 一度にたくさんの項目を見渡せるようにする（カード形式との使い分け）。
function shortcutRowHtml(id, s, editMode) {
  return `
  <button class="shortcut-row${editMode ? " editing" : ""}" data-sid="${id}" aria-label="${escapeHtml(s.name)}を買い物リストに追加">
    <span class="shortcut-row-main">
      <span class="shortcut-row-name">${s.urgent ? '🔥 ' : ''}${escapeHtml(s.name)}</span>
      ${shortcutHintsHtml(s, false)}
    </span>
    ${editMode
      ? `<span class="shortcut-row-del" data-del="${id}" role="button" aria-label="削除">×</span>`
      : `<span class="shortcut-row-add" aria-hidden="true">＋</span>`}
  </button>`;
}
// カテゴリ順（食品→日用品→その他→未分類）→ 名前順で並べ、カテゴリ見出しを付けて見やすく。
// 全件が未分類なら見出しは出さない。カード形式は見出しごとにグリッドを区切る
// （グリッドをまたいだ列揃えは狙わない）。リスト形式は見出しの下に行が並ぶだけ。
function shortcutsListHtml(sorted, mode, editMode) {
  const anyCategorized = sorted.some(([, s]) => s.category && CATEGORY[s.category]);
  const wrapClass = mode === "card" ? "shortcut-card-grid" : null;
  let html = "";
  let curCat = null;
  let groupOpen = false;
  sorted.forEach(([id, s]) => {
    const catKey = s.category && CATEGORY[s.category] ? s.category : "none";
    if (anyCategorized && catKey !== curCat) {
      curCat = catKey;
      if (groupOpen && wrapClass) html += `</div>`;
      const hdr = catKey === "none" ? "📎 未分類" : `${CATEGORY[catKey].emoji} ${CATEGORY[catKey].label}`;
      html += `<div class="shortcut-cat-hdr">${hdr}</div>`;
      groupOpen = false;
    }
    if (wrapClass && !groupOpen) { html += `<div class="${wrapClass}">`; groupOpen = true; }
    html += mode === "card" ? shortcutCardHtml(id, s, editMode) : shortcutRowHtml(id, s, editMode);
  });
  if (groupOpen && wrapClass) html += `</div>`;
  return html;
}
function wireShortcutsContainer(container, editMode) {
  container.querySelectorAll(".shortcut-card, .shortcut-row").forEach(item => {
    item.addEventListener("click", (e) => {
      if (e.target.closest(".shortcut-card-del") || e.target.closest(".shortcut-row-del") || e.target.closest("[data-photo-edit]")) return;
      if (editMode) { openShortcutEditSheet(item.dataset.sid); return; }
      const s = state.shortcuts[item.dataset.sid];
      // 項目数が増えると、うっかり隣の項目に触れて追加してしまいやすくなるため、
      // 確認をひとつ挟む（誤タップ防止）
      if (s && confirm(`「${s.name}」を買い物リストに追加しますか？`)) addFromShortcut(s);
    });
  });
  container.querySelectorAll(".shortcut-card-del, .shortcut-row-del").forEach(del => {
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      const s = state.shortcuts[del.dataset.del];
      if (s && !confirm(`「${s.name}」をよく買うものから削除しますか？`)) return;
      deleteShortcut(del.dataset.del);
    });
  });
  container.querySelectorAll("[data-photo-edit]").forEach(photo => {
    photo.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = photo.dataset.photoEdit;
      openIconPicker({
        onCamera: () => { shortcutPhotoTargetId = id; $("shortcut-photo-replace-input").click(); },
        onSelect: (path) => setShortcutIllustration(id, path),
      });
    });
  });
}
function renderShortcutsInto(container, entries, editMode) {
  if (!entries.length) {
    container.innerHTML = `<p class="shortcut-chips-empty">まだ登録がありません。＋ をタップして登録するか、リストの項目の ☆ から追加できます。</p>`;
  } else {
    const sorted = [...entries].sort(([, a], [, b]) =>
      categoryOrder(a) - categoryOrder(b) || (a.name || "").localeCompare(b.name || "", "ja"));
    container.innerHTML = shortcutsListHtml(sorted, shortcutViewMode, editMode);
  }
  wireShortcutsContainer(container, editMode);
}
function renderShortcuts() {
  // 下部タブを廃止し、買い物ページのフローティングボタンから開くシート（#shortcut-sheet）に
  // 一本化した。追加・編集（削除・写真差し替え）ともこのシートだけで行う
  const chips = $("shortcut-sheet-chips");
  if (!chips) return;
  const entries = Object.entries(state.shortcuts);
  updateFloatWraps();
  const count = entries.length;
  const editBtn = $("btn-shortcut-edit");
  if (editBtn) {
    editBtn.style.display = count ? "" : "none";
    editBtn.innerHTML = shortcutsEditMode
      ? '✏️ 編集（閉じる） <span class="toggle-chevron">▴</span>'
      : '✏️ 編集 <span class="toggle-chevron">▾</span>';
    editBtn.classList.toggle("open", shortcutsEditMode);
  }
  if (!count) shortcutsEditMode = false;
  renderShortcutsInto(chips, entries, shortcutsEditMode);
  updateShortcutViewToggles();
}
function openShortcutSheet() {
  $("shortcut-sheet").classList.add("open");
  $("sheet-backdrop").classList.add("open");
  renderShortcuts();
}
function closeShortcutSheet() {
  $("shortcut-sheet").classList.remove("open");
  $("sheet-backdrop").classList.remove("open");
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

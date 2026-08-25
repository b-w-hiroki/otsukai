// おうちのおつかい — ストック管理・写真アップロード共通処理・ストック詳細シート
// 元 app.js の 1367〜1658行目。index.html の <script> 順で他の app-*.js と読み込み順が保証される
// （クラシックスクリプトなのでグローバルスコープを共有。type="module" にはしていない）。

// ===== Stock Management =====
const STOCK_LEVEL = {
  ok:  { emoji: "🟢", label: "たっぷり" },
  low: { emoji: "🟡", label: "少ない" },
  out: { emoji: "🔴", label: "切れた" }
};
const STOCK_NEXT = { ok: "low", low: "out", out: "ok" };
let stockAddLevel = "ok";
// 登録シートの写真。File（実写真をアップロード）／文字列（選んだイラストのパスをそのまま使う）／null
let pendingStockPhoto = null;
// 詳細シートで「写真を撮る・選ぶ」を選んだとき、どのストックが対象かを覚えておく
let stockPhotoTargetId = null;

function openStockSheet() {
  stockAddLevel = "ok";
  document.querySelectorAll(".slp-btn").forEach((b) => b.classList.toggle("active", b.dataset.lvl === "ok"));
  $("stock-name").value = "";
  $("stock-memo").value = "";
  $("stock-budget").value = "";
  $("stock-cycle").value = "";
  $("stock-photo-input").value = "";
  pendingStockPhoto = null;
  $("stock-photo-preview-wrap").innerHTML = '<span class="stock-photo-placeholder">📷 タップして写真を選ぶ</span>';
  $("stock-sheet").classList.add("open");
  $("sheet-backdrop").classList.add("open");
  setTimeout(() => $("stock-name").focus(), 350);
}
function closeStockSheet() {
  $("stock-sheet").classList.remove("open");
  $("sheet-backdrop").classList.remove("open");
}
// 写真プレビュー
document.addEventListener("DOMContentLoaded", () => {
  $("stock-photo-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    pendingStockPhoto = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
      $("stock-photo-preview-wrap").innerHTML = `<img class="stock-photo-preview" src="${ev.target.result}" alt="プレビュー" />`;
    };
    reader.readAsDataURL(file);
  });
});
// ===== 写真（ストック・おつかい共通） =====
// スマホの写真はそのままだと3〜5MBある。買い物中に見るだけなので長辺1000pxで十分。
// 圧縮すると 150KB 前後になり、アップロードが速く、Storage の無料枠も食わない。
function compressImage(file, maxSide = 1000, quality = 0.82) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      // 失敗したら元のファイルをそのまま使う（アップロード自体は成功させたい）
      canvas.toBlob((blob) => resolve(blob || file), "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

async function uploadPhoto(file, path) {
  const blob = await compressImage(file);
  const ref = firebase.storage().ref(path);
  await ref.put(blob, { contentType: "image/jpeg" });
  return await ref.getDownloadURL();
}

async function uploadStockPhoto(file, stockId) {
  return uploadPhoto(file, `families/${state.familyId}/stocks/${stockId}`);
}
// ストック詳細シートから、登録済みの品の写真だけを差し替える
async function replaceStockPhoto(stockId, file) {
  const s = state.stocks[stockId];
  if (!s) return;
  showToast("写真をアップロード中...", { sound: false });
  let url;
  try { url = await uploadStockPhoto(file, stockId); }
  catch (e) { showToast("写真のアップロードに失敗しました"); return; }
  if (!(await dbOp(familyRef().child("stocks/" + stockId + "/photoUrl").set(url), "写真を更新できませんでした"))) return;
  showToast(`📷 「${s.name}」の写真を変更しました`, { sound: false });
  openStockDetail(stockId); // 詳細シートの表示も更新する
}
// 「イラストから選ぶ」で選んだパスをそのまま photoUrl に入れる（アップロード不要）
async function setStockIllustration(stockId, path) {
  const s = state.stocks[stockId];
  if (!s) return;
  if (!(await dbOp(familyRef().child("stocks/" + stockId + "/photoUrl").set(path), "写真を更新できませんでした"))) return;
  showToast(`🎨 「${s.name}」の写真を変更しました`, { sound: false });
  openStockDetail(stockId);
}
async function addStock() {
  const name = $("stock-name").value.trim();
  if (!name) return showToast("商品名を入力してください");
  const memo = $("stock-memo").value.trim();
  const budget = parseInt($("stock-budget").value, 10);
  const cycleDays = parseInt($("stock-cycle").value, 10);
  const addBtn = $("btn-add-stock");
  if (addBtn && addBtn.disabled) return; // アップロード中の二度押し防止
  if (addBtn) addBtn.disabled = true;
  try {
    const id = familyRef().child("stocks").push().key;
    const item = { name, level: stockAddLevel, updatedBy: state.uid, updatedAt: now() };
    if (memo) item.memo = memo;
    if (budget > 0) item.budget = budget;
    if (cycleDays >= 1 && cycleDays <= 365) {
      item.cycleDays = cycleDays;
      // 「たっぷり」で登録＝いま補充した、とみなして周期の起点にする
      if (stockAddLevel === "ok") item.lastFilledAt = now();
    }
    if (pendingStockPhoto instanceof File) {
      showToast("写真をアップロード中...", { sound: false });
      try {
        item.photoUrl = await uploadStockPhoto(pendingStockPhoto, id);
      } catch (e) {
        showToast("写真のアップロードに失敗しました");
      }
    } else if (typeof pendingStockPhoto === "string" && pendingStockPhoto) {
      item.photoUrl = pendingStockPhoto; // 選んだイラストのパスをそのまま使う
    }
    if (!(await dbOp(familyRef().child("stocks/" + id).set(item), "登録できませんでした"))) return;
    closeStockSheet();
    showToast("登録しました 📦", { sound: false });
  } finally {
    if (addBtn) addBtn.disabled = false;
  }
}
async function updateStockLevel(id, level) {
  const patch = { level, updatedBy: state.uid, updatedAt: now() };
  // 🟢 に戻した＝補充した日。手入力した「買う間隔」の起点になる。
  if (level === "ok") patch.lastFilledAt = now();
  await dbOp(familyRef().child(`stocks/${id}`).update(patch), "変更できませんでした");
}

// ストック詳細から「買う間隔（日）」を設定・解除する
async function updateStockCycle(id, days) {
  const s = state.stocks[id];
  if (!s) return;
  const patch = { cycleDays: days || null, updatedBy: state.uid, updatedAt: now() };
  // 起点が無いまま間隔だけ入れても予測できないので、今を起点にしておく
  if (days && !s.lastFilledAt) patch.lastFilledAt = now();
  if (!(await dbOp(familyRef().child(`stocks/${id}`).update(patch), "変更できませんでした"))) return;
  showToast(days ? `🔄 「${s.name}」を${days}日ごとに設定しました` : "🔄 買う間隔の設定を外しました", { sound: false });
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
  // 周期が分かるものは「あと何日で切れそうか」を添える（手入力＞履歴からの学習）
  const cyc = cycleInfo()[s.name];
  if (cyc) {
    const every = cyc.source === "manual" ? `${cyc.avgDays}日ごと` : `約${cyc.avgDays}日ごと`;
    metaChips.push(cyc.daysLeft > 0 ? `🔄 ${every}・あと${cyc.daysLeft}日` : `🔄 ${every}・買い時`);
  }
  const metaHtml = metaChips.length
    ? `<div class="stock-meta">${metaChips.map(c => `<span class="stock-meta-chip">${c}</span>`).join("")}</div>`
    : "";
  return `
    <div class="stock-item" data-sid="${s.id}" style="--i:${i};cursor:pointer;">
      <button class="stock-level-btn ${s.level}" data-sid="${s.id}" data-act="cycle" title="タップでレベルを変更">
        ${lvl.emoji}
      </button>
      ${s.photoUrl ? `<img class="stock-img" src="${escapeHtml(s.photoUrl)}" alt="${escapeHtml(s.name)}" loading="lazy" />` : ""}
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
    ${s.photoUrl ? `<img src="${escapeHtml(s.photoUrl)}" style="width:100%;max-height:200px;object-fit:cover;border-radius:var(--r-md);margin-bottom:8px;" />` : ""}
    <button type="button" id="btn-stock-detail-photo" class="ghost tiny-btn" style="width:100%;margin-bottom:16px;">
      ${s.photoUrl ? "✏️ 写真を変更" : "📷 写真を追加"}
    </button>
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
    <div style="margin-bottom:16px;">
      <div style="font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">買う間隔</div>
      <div class="row" style="gap:6px;">
        <input id="stock-detail-cycle" type="number" min="1" max="365" inputmode="numeric"
               placeholder="例: 7" value="${s.cycleDays > 0 ? Number(s.cycleDays) : ""}" style="flex:1;" />
        <span style="font-size:13px;font-weight:700;white-space:nowrap;">日ごと</span>
        <button id="btn-stock-detail-cycle" class="ghost tiny-btn" style="white-space:nowrap;">保存</button>
      </div>
      <p class="muted" style="font-size:11px;margin-top:6px;">${cycleHintHtml(s)}</p>
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
  $("btn-stock-detail-photo").addEventListener("click", () => {
    openIconPicker({
      onCamera: () => { stockPhotoTargetId = id; $("stock-detail-photo-input").click(); },
      onSelect: (path) => setStockIllustration(id, path),
    });
  });
  $("btn-stock-detail-cycle").addEventListener("click", async () => {
    const raw = $("stock-detail-cycle").value.trim();
    if (raw === "") { await updateStockCycle(id, 0); closeStockDetail(); return; }
    const d = parseInt(raw, 10);
    if (!(d >= 1 && d <= 365)) { showToast("1〜365日で入力してください"); return; }
    await updateStockCycle(id, d);
    closeStockDetail();
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

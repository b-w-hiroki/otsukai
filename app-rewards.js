// おうちのおつかい — ごほうびポイント・ウィークリーミッション進捗・ごほうび（ミッションタブ）
// 元 app.js の 1134〜1366行目。index.html の <script> 順で他の app-*.js と読み込み順が保証される
// （クラシックスクリプトなのでグローバルスコープを共有。type="module" にはしていない）。

// ===== ごほうびポイント =====
// ポイントの付与・返却はサーバー側（Cloud Functions の awardPoints）が status の
// 遷移を見て行う。クライアントで付与するとルールで偽造を防げないため。
// 獲得トーストは points リスナーの残高差分で表示する（attachFamilyListeners 参照）。

// 完了の二度押し・同時完了で二重付与にならないよう、
// トランザクションで「done でないときだけ」完了させる。
const completingIds = new Set();
async function completeRequest(id) {
  if (completingIds.has(id)) return;
  completingIds.add(id);
  try {
    const res = await familyRef().child("requests/" + id).transaction((cur) => {
      if (cur === null) return cur;      // まだローカルに無い/削除済み → そのまま
      if (cur.status === "done") return; // すでに完了 → 中断（二重付与防止）
      return { ...cur, status: "done", completedBy: state.uid, completedAt: now() };
    });
    if (!res.committed) return;
    bumpStat("completedCount");
    const doneName = res.snapshot.val() && res.snapshot.val().name;
    if (doneName) replenishMatchingStocks(doneName);
    showToast("✅ 完了！", { sound: false });
    celebrate();
  } catch (e) {
    console.error(e);
    showToast("⚠️ 完了にできませんでした。通信環境を確認してください");
  } finally {
    completingIds.delete(id);
  }
}
async function reopenRequest(id) {
  // ポイント返却はサーバー側（awardPoints が done→open の遷移で実施）。
  // 統計の完了数はここで戻す（完了→戻す→完了の繰り返しでMVP集計が水増しされないように）。
  const r = state.requests[id];
  const wasDoneBy = r && r.status === "done" ? r.completedBy : null;
  if (!(await dbOp(familyRef().child("requests/" + id).update({
    status: "open", completedBy: null, completedAt: null, claimedBy: null, claimedAt: null
  }), "戻せませんでした"))) return;
  if (wasDoneBy) adjustStat(wasDoneBy, "completedCount", -1);
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
// 任意メンバーの統計を増減（0未満にはしない）。完了取り消し時の完了数戻しに使う。
async function adjustStat(uid, field, delta) {
  if (!uid || !delta) return;
  try {
    await familyRef().child(`stats/${uid}/${field}`).transaction((v) => Math.max(0, (v || 0) + delta));
  } catch (e) { console.error("adjustStat failed", e); }
}

// ===== ウィークリーミッション（定番ミッション） =====
// 家族からもらうミッションとは別の、毎週自動リセットの定番ミッション。
// 進捗カウント・達成判定・ポイント付与はすべてサーバー（functions の bumpWeekly）。
// ここでは表示のみを行う。定義はサーバー側と一致させること。
const WEEKLY_MISSIONS = [
  { id: "complete3", metric: "completed",       target: 3, pts: 3, title: "🛒 おつかいを3回完了する" },
  { id: "urgent1",   metric: "urgentCompleted", target: 1, pts: 2, title: "🔥 急ぎのおつかいを1回完了する" },
  { id: "thanks3",   metric: "reactionsSent",   target: 3, pts: 1, title: "❤️ ありがとうを3回送る" },
];
let _prevWeeklyAwards = null;

// Asia/Tokyo の ISO 週キー（サーバー側と同じアルゴリズム）
function weekKeyJST() {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7) + 3);
  const firstThu = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  firstThu.setUTCDate(firstThu.getUTCDate() - ((firstThu.getUTCDay() + 6) % 7) + 3);
  const week = 1 + Math.round((date - firstThu) / (7 * 864e5));
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function renderWeeklyMissions() {
  const el = $("weekly-missions-section");
  if (!el) return;
  const my = (state.weekly[weekKeyJST()] || {})[state.uid] || {};
  const awards = my.awards || {};
  const rows = WEEKLY_MISSIONS.map((m) => {
    const count = Math.min(my[m.metric] || 0, m.target);
    const doneMission = !!awards[m.id];
    const pct = doneMission ? 100 : Math.round(count / m.target * 100);
    return `
      <div class="weekly-mission${doneMission ? " done" : ""}">
        <div class="row between" style="margin-bottom:4px;">
          <span class="weekly-mission-title">${m.title}</span>
          <span class="weekly-mission-pts">${doneMission ? "✅ 達成" : `+${m.pts}pt`}</span>
        </div>
        <div class="row" style="gap:8px;">
          <div class="mission-progress-bar" style="flex:1;">
            <div class="mission-progress-fill" style="width:${pct}%"></div>
          </div>
          <span class="tiny" style="flex-shrink:0;">${doneMission ? m.target : count} / ${m.target}</span>
        </div>
      </div>`;
  }).join("");
  el.innerHTML = `<div class="card">
    <h2>⚡ ウィークリーミッション</h2>
    <p class="muted" style="font-size:11px;margin:0 0 10px;">毎週月曜にリセット。ふだんの行動で自動的に進みます（達成すると自動でポイントゲット）</p>
    ${rows}
  </div>`;
}

// ===== ごほうび（ミッションタブ） =====
// 誤操作防止: 削除×と追加フォームは「編集」トグルを開いた時だけ表示する
// （子どもの「交換する」の隣に削除ボタンが常時並ばないように）。
let rewardsEditMode = false;
let _prevOwnPoints = null; // ポイント獲得トースト用（リスナーの残高差分）
function renderRewards() {
  const el = $("rewards-section");
  if (!el) return;
  // 再描画で入力中のごほうび名/ptが消えないよう退避（家族の操作で points 等が
  // 変わるたびにこの関数が走るため）
  const prevNameInput = el.querySelector("#reward-name-input");
  const prevCostInput = el.querySelector("#reward-cost-input");
  const savedName = prevNameInput ? prevNameInput.value : "";
  const savedCost = prevCostInput ? prevCostInput.value : "";
  const hadFocus = document.activeElement === prevNameInput ? "name"
    : document.activeElement === prevCostInput ? "cost" : null;
  const myPts = (state.points && state.points[state.uid]) || 0;
  const isParent = state.myRole === "parent";
  const editing = isParent && rewardsEditMode;
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
      ? "「ごほうびを編集」から、ポイントと交換できるごほうびを登録しましょう。"
      : "まだごほうびがありません。保護者に登録してもらいましょう。"}</p>`;
  } else {
    html += rewards.map(([id, rw]) => `
      <div class="reward-row">
        <span class="reward-name">${escapeHtml(rw.name)}</span>
        <span class="reward-cost">🪙 ${Number(rw.cost) || 0}pt</span>
        <button class="success tiny-btn" data-redeem="${id}" ${myPts < rw.cost ? "disabled" : ""}>交換する</button>
        ${editing ? `<button class="danger tiny-btn" data-reward-del="${id}" aria-label="ごほうびを削除">×</button>` : ""}
      </div>`).join("");
  }
  if (isParent) {
    html += `<button id="btn-rewards-edit-toggle" class="section-toggle-btn${editing ? " open" : ""}" aria-expanded="${editing}" style="margin-top:10px;">✏️ ごほうびを編集${editing ? "（閉じる）" : ""} <span class="toggle-chevron">${editing ? "▴" : "▾"}</span></button>`;
    if (editing) {
      html += `<div class="row" style="gap:6px;">
        <input id="reward-name-input" placeholder="ごほうび名（例: アイス）" maxlength="30" style="flex:2;min-width:0;" />
        <input id="reward-cost-input" type="number" min="1" max="9999" placeholder="pt" style="flex:0.8;min-width:56px;" />
        <button id="btn-add-reward" class="ghost tiny-btn" style="white-space:nowrap;">＋ 追加</button>
      </div>`;
    }
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
  const editToggle = el.querySelector("#btn-rewards-edit-toggle");
  if (editToggle) editToggle.addEventListener("click", () => {
    rewardsEditMode = !rewardsEditMode;
    renderRewards();
  });
  // 退避した入力値とフォーカスを復元
  const nameInput = el.querySelector("#reward-name-input");
  const costInput = el.querySelector("#reward-cost-input");
  if (nameInput && savedName) nameInput.value = savedName;
  if (costInput && savedCost) costInput.value = savedCost;
  if (hadFocus === "name" && nameInput) nameInput.focus();
  else if (hadFocus === "cost" && costInput) costInput.focus();
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

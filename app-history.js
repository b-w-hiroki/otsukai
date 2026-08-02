// おうちのおつかい — 連続記録・称号 / 履歴シート・プレイヤーシート・家族統計シート・ミッション履歴シート
// 元 app.js の 3014〜3298行目。index.html の <script> 順で他の app-*.js と読み込み順が保証される
// （クラシックスクリプトなのでグローバルスコープを共有。type="module" にはしていない）。

// ===== 連続記録（ストリーク）と称号 =====
const RANKS = [
  { min: 0,   label: "🌱 おつかい見習い" },
  { min: 5,   label: "🚶 おつかい配達員" },
  { min: 15,  label: "🛒 おつかい上手" },
  { min: 30,  label: "⭐ おつかいマスター" },
  { min: 60,  label: "👑 おつかい達人" },
];
function myCompletedTotal() {
  const s = (state.stats && state.stats[state.uid]) || {};
  return s.completedCount || 0;
}
// 自分が完了した日の連続日数（今日 or 昨日を起点に遡る）
function computeStreak() {
  const days = new Set();
  Object.values(state.requests || {}).forEach((r) => {
    if (!r || r.status !== "done" || r.completedBy !== state.uid || !r.completedAt) return;
    const d = new Date(r.completedAt);
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  });
  if (!days.size) return 0;
  const key = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const today = new Date();
  const yest = new Date(today.getTime() - 864e5);
  let cursor = days.has(key(today)) ? today : days.has(key(yest)) ? yest : null;
  if (!cursor) return 0;
  let n = 0;
  while (days.has(key(cursor))) {
    n++;
    cursor = new Date(cursor.getTime() - 864e5);
  }
  return n;
}
function renderStreak() {
  const el = $("streak-section");
  if (!el) return;
  const streak = computeStreak();
  const total = myCompletedTotal();
  const rank = [...RANKS].reverse().find(r => total >= r.min) || RANKS[0];
  const next = RANKS.find(r => r.min > total);
  el.innerHTML = `<div class="card">
    <div class="streak-row">
      <span class="streak-big">${streak > 0 ? "🔥" + streak : "—"}</span>
      <span style="flex:1;min-width:0;">
        <span class="streak-title">${streak > 0 ? `${streak}日連続でおつかい中！` : "連続記録はこれから"}</span>
        <div style="margin-top:4px;"><span class="rank-badge">${rank.label}</span></div>
      </span>
    </div>
    <p class="muted" style="font-size:11px;margin:8px 0 0;">
      これまでに ${total} 回完了${next ? `・あと ${next.min - total} 回で ${next.label}` : "・最高ランク達成！"}
    </p>
  </div>`;
}

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
  // 実支出（履歴の 💴 で記録した金額）が1件でもあれば、そちらを主役に表示する
  const costItems = done.filter((r) => r.actualCost > 0);
  const costSum = costItems.reduce((sum, r) => sum + r.actualCost, 0);
  const mainStat = costItems.length
    ? `<div class="stat"><b>${costSum.toLocaleString()}円</b><span>実際の支出（${costItems.length}件分）</span></div>`
    : `<div class="stat"><b>${budgetSum > 0 ? budgetSum.toLocaleString() + "円" : "—"}</b><span>予算の合計${budgeted ? `（${budgeted}件分）` : ""}</span></div>`;
  el.innerHTML = `
    <div class="stat-grid" style="margin-top:0;">
      <div class="stat"><b>${done.length}</b><span>完了した買い物</span></div>
      ${mainStat}
    </div>
    <p class="muted" style="font-size:11px;margin-top:8px;">${costItems.length
      ? `※ 履歴の 💴 ボタンで記録した実際の支払額の合計です（未記録: ${done.length - costItems.length}件）`
      : "※ 予算は依頼時の「〜円以下」の合計です。履歴の 💴 から実際の支払額を記録すると、実支出で集計されます"}</p>`;
}

async function addReminderTime() {
  if (!state.familyId) return;
  const input = $("reminder-time-input");
  const raw = (input.value || "").trim();
  if (!/^\d{2}:\d{2}$/.test(raw)) { showToast("時刻を選んでください"); return; }
  // サーバーのリマインド起動は5分ごと（コスト最適化）なので、5分きざみに丸める
  const [h, m] = raw.split(":").map(Number);
  const total = (Math.round((h * 60 + m) / 5) * 5) % 1440;
  const val = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  // reminderIndex はサーバー（Cloud Functions）が「この時刻に通知すべき家族」を
  // 全家族スキャンなしで引けるようにするための逆引き索引。
  const ok = await dbOp(Promise.all([
    familyRef().child("reminderTimes/" + val).set(true),
    db.ref(`reminderIndex/${val}/${state.familyId}`).set(true)
  ]), "設定できませんでした");
  if (!ok) return;
  input.value = "";
  showToast(`⏰ ${val} にリマインドを設定しました${val !== raw ? "（5分きざみに調整）" : ""}`, { sound: false });
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

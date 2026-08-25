// おうちのおつかい — ミッション管理（保護者が子どもにミッションを出す機能）
// 元 app.js の 1659〜1858行目。index.html の <script> 順で他の app-*.js と読み込み順が保証される
// （クラシックスクリプトなのでグローバルスコープを共有。type="module" にはしていない）。

// ===== ミッションタブ内のサブタブ（ウィークリー/ごほうび/ミッション） =====
// ⚡ウィークリー・🎁ごほうび・🎯ミッションが縦積みで長くなっていたための切り替え。
// 🔥ストリークだけは常に見えていてほしい情報なので、サブタブの外（上部）に置いたまま。
function switchMissionSubtab(key) {
  document.querySelectorAll(".mission-subtab").forEach((el) => {
    el.classList.toggle("active", el.dataset.msub === key);
  });
  document.querySelectorAll("#tab-missions .seg-btn").forEach((btn) => {
    const on = btn.dataset.msub === key;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-selected", String(on));
  });
  updateFloatWraps();
}
function wireMissionSubtabs() {
  document.querySelectorAll("#tab-missions .seg-btn[data-msub]").forEach((btn) => {
    btn.addEventListener("click", () => switchMissionSubtab(btn.dataset.msub));
  });
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
  setTimeout(() => $("mission-title-input").focus(), 350);
}
function closeMissionSheet() {
  $("mission-sheet").classList.remove("open");
  $("sheet-backdrop").classList.remove("open");
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
  updateFloatWraps(); // 役割が変わったときも「＋ 新しいミッション」の表示を追従させる
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

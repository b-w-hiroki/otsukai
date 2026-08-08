// おうちのおつかい — リスト描画共通処理（折りたたみ・カード・チェックリスト表示・グループ開閉）
// 元 app.js の 1859〜2500行目。index.html の <script> 順で他の app-*.js と読み込み順が保証される
// （クラシックスクリプトなのでグローバルスコープを共有。type="module" にはしていない）。

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

// コメントスレッドのHTML（履歴カードとチェックリスト詳細で共用）
function commentThreadHtml(r, commentList) {
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
  return threadHtml;
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
  // リストの項目をそのまま「⭐よく買うもの」に登録できるボタン（登録済みは金色表示）
  const starred = isShortcutRegistered(r.name);
  actHtml += `<button class="rc-comment-btn rc-star-btn${starred ? " starred" : ""}" data-star="${r.id}" aria-label="${starred ? "よく買うものに登録済み" : "よく買うものに登録"}">${starred ? "⭐" : "☆"}</button>`;

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
    commentBodyHtml = `<div class="req-row-comment-body">${commentThreadHtml(r, commentList)}</div>`;
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
    // 実際に支払った金額（レシート記録）。記録済みなら金額を表示する。
    const costBtn = `<button class="react-btn cost-btn${r.actualCost > 0 ? " has-cost" : ""}" data-cost="${r.id}" aria-label="支払った金額を記録">💴 ${r.actualCost > 0 ? Number(r.actualCost).toLocaleString() + "円" : "金額"}</button>`;
    reactionsHtml = `<div class="req-row-reactions"><span class="react-label">ありがとう</span>${btns}<span style="flex:1;"></span>${costBtn}</div>`;
  }

  return `<div class="${rowClass}" style="--i:${i}">
    <div class="req-row-main">
      ${photoThumbHtml(r)}
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

// ===== チェックリスト表示（お買い物タブ） =====
// 1行1品の高密度リスト。左の◯タップで 買うよ→完了。
// メモ・コメント・⭐・編集・削除などの操作は行タップで展開する詳細に置き、
// ボタンが品名を圧迫しないようにする。
const expandedDetails = new Set();

function checkRow(r) {
  const isClaimed = r.status === "claimed";
  const mine = r.claimedBy === state.uid;
  const hasUnread = state.unreadComments.has(r.id);
  const detailOpen = expandedDetails.has(r.id);
  const commentCount = Object.keys(state.comments[r.id] || {}).length;

  let circleClass = "check-circle";
  let circleContent = "";
  let circleLabel = "タップで買うよ";
  if (isClaimed) {
    if (mine) { circleClass += " mine"; circleContent = "🛒"; circleLabel = "タップで「買うよ」を取り消す"; }
    else { circleClass += " other"; circleContent = memberEmoji(r.claimedBy); circleLabel = `${memberName(r.claimedBy)}さんが買いに行きます`; }
  } else if (r.assignedTo === state.uid) {
    circleClass += " assigned";
    circleLabel = "あなたに指名・タップで担当";
  }

  const badges = [];
  if (r.urgent) badges.push(`<span class="check-badge urgent">🔥</span>`);
  if (r.diff && r.diff !== "normal") badges.push(`<span class="check-badge">${r.diff === "hard" ? "💪" : "😅"}</span>`);
  if (r.assignedTo && r.status === "open") badges.push(`<span class="check-badge">📌${memberEmoji(r.assignedTo)}</span>`);
  if (commentCount > 0 || hasUnread) badges.push(`<span class="check-badge${hasUnread ? " unread" : ""}">💬${commentCount || ""}</span>`);
  const hasExtra = r.memo || r.budget > 0 || r.brand;
  if (hasExtra && !detailOpen) badges.push(`<span class="check-badge muted">📝</span>`);

  const claimerHtml = isClaimed
    ? `<span class="check-claimer">${mine ? "自分" : escapeHtml(memberName(r.claimedBy))}</span>`
    : "";

  // 「買うよ」の次の一手が分かるよう、宣言済みの行には明示的な「買ったよ」ボタンを出す。
  // ◯タップでも完了できるが、ボタンがある方が迷わない。
  const doneBtn = isClaimed
    ? `<button class="check-done-btn${mine ? "" : " other"}" data-complete="${r.id}">✅ 買ったよ</button>`
    : "";

  let html = `<div class="check-row${r.urgent ? " urgent" : ""}${isClaimed ? " claimed" : ""}${detailOpen ? " open" : ""}" data-row="${r.id}">
    <button class="${circleClass}" data-check="${r.id}" aria-label="${escapeHtml(circleLabel)}">${circleContent}</button>
    ${photoThumbHtml(r)}
    <div class="check-main" data-detail-toggle="${r.id}" role="button" aria-expanded="${detailOpen}">
      <span class="check-name">${escapeHtml(r.name)}</span>
      <span class="check-badges">${badges.join("")}${claimerHtml}</span>
    </div>
    ${doneBtn}
  </div>`;
  if (detailOpen) html += checkDetail(r);
  return html;
}

function checkDetail(r) {
  const mine = r.claimedBy === state.uid;
  const own = r.requestedBy === state.uid;
  const isClaimed = r.status === "claimed";
  const expanded = state.expandedItems.has(r.id);
  const commentList = Object.entries(state.comments[r.id] || {}).map(([cid, c]) => ({ id: cid, ...c }));
  const starred = isShortcutRegistered(r.name);

  const hintParts = [];
  if (r.category && CATEGORY[r.category]) hintParts.push(`${CATEGORY[r.category].emoji} ${CATEGORY[r.category].label}`);
  if (r.budget > 0) hintParts.push(`💰 ${Number(r.budget).toLocaleString()}円以下`);
  if (r.brand) hintParts.push(`🏷️ ${escapeHtml(r.brand)}`);
  if (r.memo) hintParts.push(`📝 ${escapeHtml(r.memo)}`);
  if (r.assignedTo) hintParts.push(`📌 ${memberEmoji(r.assignedTo)} ${escapeHtml(memberName(r.assignedTo))}に指名`);
  const meta = `${memberEmoji(r.requestedBy)} ${escapeHtml(memberName(r.requestedBy))}さんが追加 ・ ${timeAgo(r.requestedAt)}`;

  let actHtml = "";
  if (isClaimed) actHtml += `<button class="success rc-btn" data-complete="${r.id}">✅ 買ったよ</button>`;
  if (isClaimed && mine) actHtml += `<button class="ghost rc-btn" data-act="unclaim" data-id="${r.id}">↩️ やめる</button>`;
  actHtml += `<button class="rc-comment-btn${expanded ? " open" : ""}" data-toggle="${r.id}" aria-label="コメントを開く">💬</button>`;
  actHtml += `<button class="rc-comment-btn rc-star-btn${starred ? " starred" : ""}" data-star="${r.id}" aria-label="${starred ? "よく買うものに登録済み" : "よく買うものに登録"}">${starred ? "⭐" : "☆"}</button>`;
  if (own) {
    actHtml += `<button class="ghost rc-btn" data-edit-btn="${r.id}" aria-label="編集">✏️</button>`;
    actHtml += `<button class="danger rc-btn" data-act="delete" data-id="${r.id}" aria-label="削除">×</button>`;
  }

  return `<div class="check-detail">
    ${r.photoUrl ? `<img class="req-photo" src="${escapeHtml(r.photoUrl)}" alt="${escapeHtml(r.name)}の写真" data-photo="${escapeHtml(r.photoUrl)}" loading="lazy" />` : ""}
    ${hintParts.length ? `<div class="req-row-hints">${hintParts.map(p => `<span class="req-row-hint">${p}</span>`).join("")}</div>` : ""}
    <div class="check-detail-meta">${meta}</div>
    <div class="check-detail-actions">${actHtml}</div>
    ${expanded ? `<div class="req-row-comment-body">${commentThreadHtml(r, commentList)}</div>` : ""}
  </div>`;
}

// 「買ったよ」操作。他の人が「買うよ」と宣言した品も、確認のうえ完了にできる
// （子どもが宣言して親が持ち帰った、というよくある流れに対応）。
function completeFromUi(id) {
  const r = state.requests[id];
  if (!r || r.status !== "claimed") return;
  if (r.claimedBy && r.claimedBy !== state.uid) {
    if (!confirm(`「${r.name}」は ${memberName(r.claimedBy)}さんが買いに行く予定です。\n\n買ったことにしますか？`)) return;
  }
  completeRequest(id);
}

// 実際に支払った金額を記録（履歴カードの 💴 ボタン）。空入力で記録を消す。
async function recordActualCost(id) {
  const r = state.requests[id];
  if (!r) return;
  const cur = r.actualCost > 0 ? String(r.actualCost) : "";
  const input = prompt(`「${r.name}」は実際いくらでしたか？（円・空欄で記録を消す）`, cur);
  if (input === null) return;
  const trimmed = input.trim();
  if (trimmed === "") {
    await dbOp(familyRef().child(`requests/${id}/actualCost`).remove(), "記録できませんでした");
    return;
  }
  const val = parseInt(trimmed.replace(/[^\d]/g, ""), 10);
  if (!(val > 0)) { showToast("金額を数字で入力してください", { sound: false }); return; }
  if (!(await dbOp(familyRef().child(`requests/${id}/actualCost`).set(val), "記録できませんでした"))) return;
  showToast(`💴 ${val.toLocaleString()}円を記録しました`, { sound: false });
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

// チェックリストのセクション分け: 🔥急ぎを最上段に、以降はカテゴリ順
function sectionKeyOf(r) {
  if (r.urgent) return "urgent";
  return r.category && CATEGORY[r.category] ? r.category : "none";
}
const SECTION_DEFS = {
  urgent: { order: 0, label: "🔥 急ぎ" },
  food:   { order: 1, label: "🍎 食品" },
  daily:  { order: 2, label: "🧻 日用品" },
  other:  { order: 3, label: "📦 その他" },
  none:   { order: 4, label: "📎 未分類" },
};

function renderRequests() {
  const items = Object.entries(state.requests).map(([id, r]) => ({ id, ...r }));

  // Group 1: unclaimed open items（急ぎ → カテゴリ → 追加順）
  const openItems = items
    .filter(r => r.status === "open")
    .sort((a, b) =>
      SECTION_DEFS[sectionKeyOf(a)].order - SECTION_DEFS[sectionKeyOf(b)].order ||
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
    // 買い物リスト: セクション見出し付きチェックリスト
    let openBody;
    if (!openItems.length) {
      openBody = `<div class="empty" style="padding:12px 4px 8px;font-size:12px;">新しい依頼はありません</div>`;
    } else {
      // セクション見出しは、カテゴリ付き or 急ぎが1つでもあるときだけ出す
      const useSections = openItems.some(r => sectionKeyOf(r) !== "none");
      let cur = null;
      openBody = `<div class="check-list">` + openItems.map((r) => {
        let hdr = "";
        const key = sectionKeyOf(r);
        if (useSections && key !== cur) {
          cur = key;
          hdr = `<div class="check-section-hdr">${SECTION_DEFS[key].label}</div>`;
        }
        return hdr + checkRow(r);
      }).join("") + `</div>`;
    }
    html += groupHtml("group-open", "🛒 買い物リスト", openItems.length, openBody);
    if (claimedItems.length) {
      html += groupHtml("group-claimed", "🙋 宣言済みリスト", claimedItems.length,
        `<div class="check-list">` + claimedItems.map((r) => checkRow(r)).join("") + `</div>`);
    }
  }

  $("list-open").innerHTML = html;
  wireRequestButtons($("list-open"));
  wireChecklist($("list-open"));
  wireGroupToggles();
}

// チェックリスト特有の結線（◯ボタン・行タップ展開・✏️編集）
function wireChecklist(root) {
  root.querySelectorAll("[data-check]").forEach((b) => {
    b.addEventListener("click", () => {
      const r = state.requests[b.dataset.check];
      if (!r) return;
      // ◯は「買うよ」のオン/オフ。完了は「✅買ったよ」ボタンで行う。
      if (r.status === "open") {
        claimRequest(b.dataset.check);
      } else if (r.status === "claimed" && r.claimedBy === state.uid) {
        unclaimRequest(b.dataset.check);
        showToast("↩️ 「買うよ」を取り消しました", { sound: false });
      } else if (r.status === "claimed") {
        showToast(`🛒 ${memberName(r.claimedBy)}さんが買いに行きます`, { sound: false });
      }
    });
  });
  root.querySelectorAll("[data-complete]").forEach((b) => {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      completeFromUi(b.dataset.complete);
    });
  });
  root.querySelectorAll("[data-detail-toggle]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.dataset.detailToggle;
      if (expandedDetails.has(id)) expandedDetails.delete(id);
      else expandedDetails.add(id);
      renderRequests();
    });
  });
  root.querySelectorAll("[data-edit-btn]").forEach((b) => {
    b.addEventListener("click", () => {
      const raw = state.requests[b.dataset.editBtn];
      if (raw) openEditSheet({ id: b.dataset.editBtn, ...raw });
    });
  });
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
  root.querySelectorAll(".req-row [data-act], .check-detail [data-act]").forEach((b) => {
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
  root.querySelectorAll("[data-star]").forEach((b) => {
    b.addEventListener("click", () => addShortcutFromRequest(b.dataset.star));
  });
  root.querySelectorAll("[data-cost]").forEach((b) => {
    b.addEventListener("click", () => recordActualCost(b.dataset.cost));
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

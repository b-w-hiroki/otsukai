// おうちのおつかい — ⏳そろそろ切れるかも（定期購入の自動提案）
// 元 app.js の 2727〜3013行目。index.html の <script> 順で他の app-*.js と読み込み順が保証される
// （クラシックスクリプトなのでグローバルスコープを共有。type="module" にはしていない）。
// 店内モードは不要になったため削除し、このファイルはそろそろ切れるかも専用にした。

// ===== 定期購入の自動提案 =====
// 「そろそろ切れるかも」で × を押した品の記録（端末ローカル）。
// 値は消した時刻。ストックが動いた／次の周期に入ったら、また出す。
function dismissedSuggestKey() { return `suggestDismissed_${state.familyId}`; }
function getDismissedSuggests() {
  try { return JSON.parse(localStorage.getItem(dismissedSuggestKey()) || "{}"); } catch (e) { return {}; }
}
// 買い物履歴から、同じ品の「購入周期」と「次に切れそうな日」を推定する。
// 3回以上買っている品が対象（2回だと周期が1つしか取れず精度が出ないため）。
// ストックカードの描画ごとに呼ばれるので、requests が差し替わるまでは結果を使い回す。
// （残り日数は時間で変わるので、1時間で作り直す）
let cycleCache = { src: null, hour: -1, val: null };
function predictCycles() {
  const hour = Math.floor(now() / 36e5);
  if (cycleCache.src === state.requests && cycleCache.hour === hour) return cycleCache.val;
  const byName = {};
  Object.values(state.requests || {}).forEach((r) => {
    if (!r || r.status !== "done" || !r.completedAt) return;
    (byName[r.name] = byName[r.name] || []).push(r.completedAt);
  });
  const out = {};
  Object.entries(byName).forEach(([name, times]) => {
    if (times.length < 3) return;
    times.sort((a, b) => a - b);
    const gaps = [];
    for (let i = 1; i < times.length; i++) gaps.push(times[i] - times[i - 1]);
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    if (avg < 12 * 36e5) return; // 半日未満の周期はノイズ扱い
    const last = times[times.length - 1];
    out[name] = {
      avgMs: avg,
      last,
      avgDays: Math.max(1, Math.round(avg / 864e5)),
      // 残り日数（マイナスなら予測日を過ぎている）
      daysLeft: Math.round((last + avg - now()) / 864e5),
      count: times.length,
    };
  });
  cycleCache = { src: state.requests, hour, val: out };
  return out;
}

// 何日前から「そろそろ切れる」と知らせるか（家族共通・設定タブで変更）。
const LOW_LEAD_DEFAULT = 2;
const LOW_LEAD_MAX = 60;
function lowLeadDays() {
  const v = Number((state.familySettings || {}).lowLeadDays);
  return Number.isFinite(v) && v >= 0 && v <= LOW_LEAD_MAX ? Math.round(v) : LOW_LEAD_DEFAULT;
}

// 品目ごとの「次に切れそうな日」。
// ストックに買う間隔（cycleDays）が手入力されていれば、履歴からの学習値より優先する。
// 3回買うまで待たずに済み、学習値がずれているときも直せる。
function cycleInfo() {
  const learned = predictCycles();
  const out = {};
  Object.entries(learned).forEach(([name, c]) => { out[name] = { ...c, source: "learned" }; });
  Object.values(state.stocks || {}).forEach((s) => {
    if (!s || !s.name) return;
    const days = Number(s.cycleDays);
    if (!Number.isFinite(days) || days < 1) return;
    // 起点は「最後に買った日」。履歴が無ければ「🟢 たっぷりに戻した日」を使う。
    const last = Math.max(learned[s.name] ? learned[s.name].last : 0, s.lastFilledAt || 0);
    if (!last) return; // 起点が分からないと残り日数を出せない
    const avgMs = days * 864e5;
    out[s.name] = {
      avgMs, last,
      avgDays: Math.round(days),
      daysLeft: Math.round((last + avgMs - now()) / 864e5),
      count: learned[s.name] ? learned[s.name].count : 0,
      source: "manual",
    };
  });
  return out;
}

// ストック詳細の「買う間隔」欄の説明文。いま何を根拠に予測しているかを見せる。
function cycleHintHtml(s) {
  const learned = predictCycles()[s.name];
  if (s.cycleDays > 0) {
    const c = cycleInfo()[s.name];
    const when = c
      ? (c.daysLeft < 0 ? `<b>${-c.daysLeft}日超過</b>しています`
        : c.daysLeft === 0 ? "<b>今日が買い時</b>です"
        : `次は<b>あと${c.daysLeft}日</b>ごろ`)
      : "起点が決まると残り日数が出ます";
    return `🔄 ${Number(s.cycleDays)}日ごとに設定中 — ${when}。空にして保存すると解除できます。`;
  }
  if (learned) {
    return `買い物履歴から<b>約${learned.avgDays}日ごと</b>と学習しています。ここで指定すると、そちらを優先します。`;
  }
  return "同じ品を3回買うと自動で学習します。待たずにここで指定もできます。";
}

// 「そろそろ切れるかも」= ストックの残量警告 ＋ 購入周期からの予測 をまとめたもの。
// 買い忘れを防ぐのがこのアプリの主目的なので、両方を1か所に集めて目立たせる。
function computeRunningLow() {
  const active = new Set(
    Object.values(state.requests || {}).filter(r => r && r.status !== "done").map(r => r.name)
  );
  const dismissed = getDismissedSuggests();
  const cycles = cycleInfo();
  const lead = lowLeadDays();
  const items = [];

  // ① ストックで「切れた/少ない」と記録されているもの
  const already = new Set();
  Object.values(state.stocks || {}).forEach((s) => {
    if (!s || (s.level !== "out" && s.level !== "low")) return;
    if (active.has(s.name) || already.has(s.name)) return; // 同名のストックが複数あっても1行
    // × で消したものは、その品のストックが next に動くまで再表示しない
    if (dismissed[s.name] && dismissed[s.name] >= (s.updatedAt || 0)) return;
    already.add(s.name);
    items.push({
      name: s.name,
      kind: "stock",
      out: s.level === "out",
      urgent: s.level === "out",
      order: s.level === "out" ? 0 : 1,
      budget: s.budget, memo: s.memo,
    });
  });

  // ② 購入周期から「そろそろ」と推定されるもの（ストックで既に出ているものは除く）
  Object.entries(cycles).forEach(([name, c]) => {
    if (active.has(name) || already.has(name)) return;
    if (c.daysLeft > lead) return;                    // 設定した予告日数より先なら出さない
    if (dismissed[name] && dismissed[name] >= c.last) return; // この周期で案内済み
    items.push({
      name,
      kind: "cycle",
      overdue: c.daysLeft <= 0,
      urgent: c.daysLeft <= 0,
      order: c.daysLeft <= 0 ? 0.5 : 2,
    });
  });

  return items.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "ja")).slice(0, 6);
}

function renderSuggestions() {
  const el = $("suggest-section");
  if (!el) return;
  const list = computeRunningLow();
  if (!list.length) { el.innerHTML = ""; return; }
  // 「切れている」と「買い時を過ぎている」は別のことなので、まとめて数えない
  const outCount = list.filter((i) => i.out).length;
  const overdueCount = list.filter((i) => i.overdue).length;
  const leadParts = [];
  if (outCount) leadParts.push(`<b>${outCount}件</b>はもう切れています`);
  if (overdueCount) leadParts.push(`<b>${overdueCount}件</b>は買い時を過ぎています`);
  const leadText = leadParts.length
    ? `${leadParts.join("・")}。タップで買い物リストに追加できます。`
    : "タップすると買い物リストに追加できます。";
  el.innerHTML = `
    <div class="lowstock-card">
      <div class="lowstock-hdr">
        <span class="lowstock-title">⏳ そろそろ切れるかも</span>
        <span class="lowstock-count">${list.length}</span>
      </div>
      <p class="lowstock-lead">${leadText}</p>
      <div class="lowstock-items">
        ${list.map((i) => `
          <button class="lowstock-item${i.urgent ? " urgent" : ""}" data-suggest="${escapeHtml(i.name)}">
            <span class="lowstock-icon">${i.kind === "stock" ? (i.urgent ? "🔴" : "🟡") : "🔄"}</span>
            <span class="lowstock-name">${escapeHtml(i.name)}</span>
            <span class="lowstock-x" data-suggest-x="${escapeHtml(i.name)}" role="button" aria-label="このお知らせを消す">×</span>
          </button>`).join("")}
      </div>
    </div>`;
  el.querySelectorAll("[data-suggest]").forEach((b) => {
    b.addEventListener("click", (e) => {
      if (e.target.closest("[data-suggest-x]")) return;
      const name = b.dataset.suggest;
      const st = Object.values(state.stocks || {}).find((s) => s && s.name === name);
      addFromShortcut({
        name,
        diff: "normal",
        urgent: st && st.level === "out",
        budget: st && st.budget,
        brand: st && st.memo,
        photoUrl: st && st.photoUrl,
        category: st && st.category,
      });
    });
  });
  el.querySelectorAll("[data-suggest-x]").forEach((x) => {
    x.addEventListener("click", (e) => {
      e.stopPropagation();
      const d = getDismissedSuggests();
      d[x.dataset.suggestX] = now();
      localStorage.setItem(dismissedSuggestKey(), JSON.stringify(d));
      renderSuggestions();
    });
  });
}

/* 배터리아카데미 교육 수요조사 - 분석 대시보드 (기수·연도 분석 + 데이터관리 + 리포트) */
(function () {
  const SCHEMA = window.SURVEY_SCHEMA;
  const COHORTS = window.SURVEY_COHORTS || [];
  const root = document.getElementById("root");
  const KEY_STORE = "battery_admin_key";

  const QIDX = {};
  SCHEMA.forEach((sec) => sec.questions.forEach((q) => (QIDX[q.id] = q)));

  // 필터 정의 — 연도 > 기수 > 인구통계(성별·연령·지역·전공·경험) 순
  const FILTER_DEFS = [
    { id: "year", label: "연도" },
    { id: "cohort", label: "기수" },
    { id: "gender", label: "성별", q: "gender" },
    { id: "age", label: "연령", q: "age" },
    { id: "region", label: "지역", q: "region" },
    { id: "major", label: "전공", q: "major" },
    { id: "experience", label: "경험", q: "experience" },
  ].filter((d) => d.id === "year" || d.id === "cohort" || QIDX[d.q]);

  // state
  let ALL = [];
  let filters = {};
  FILTER_DEFS.forEach((d) => (filters[d.id] = "ALL"));
  let ovDim = QIDX["region"] ? "region" : "cohort";
  let ovMetric = "count";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  /* ---------------- auth + load ---------------- */
  function loginScreen(msg) {
    root.innerHTML =
      '<div class="block login"><h3>분석 대시보드 로그인</h3>' +
      '<p class="sub">관리자 비밀번호를 입력하세요.</p>' +
      (msg ? '<p style="color:var(--warn);font-size:13px">' + esc(msg) + "</p>" : "") +
      '<input type="password" id="pw" placeholder="비밀번호" autofocus>' +
      '<button class="btn btn-primary" style="width:100%" id="loginBtn">접속</button></div>';
    document.getElementById("loginBtn").onclick = doLogin;
    document.getElementById("pw").addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
  }
  async function doLogin() { await load(document.getElementById("pw").value); }
  async function load(key) {
    root.innerHTML = '<div class="block"><p class="muted">불러오는 중...</p></div>';
    try {
      const res = await fetch("api/responses", { headers: { "X-Admin-Key": key } });
      if (res.status === 401) { sessionStorage.removeItem(KEY_STORE); return loginScreen("비밀번호가 올바르지 않습니다."); }
      if (!res.ok) throw new Error("server " + res.status);
      const data = await res.json();
      sessionStorage.setItem(KEY_STORE, key);
      render(data.responses || []);
    } catch (e) { loginScreen("불러오기에 실패했습니다: " + e.message); }
  }
  // 관리자 보호 POST (삭제 등)
  async function apiPost(path, body) {
    const key = sessionStorage.getItem(KEY_STORE);
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", "X-Admin-Key": key }, body: JSON.stringify(body) });
    if (res.status === 401) throw new Error("인증 만료 — 다시 로그인하세요.");
    if (!res.ok) throw new Error("server " + res.status);
    return res.json();
  }

  /* ---------------- accessors ---------------- */
  const val = (r, qid) => (r.answers ? r.answers[qid] : undefined);
  const getCohort = (r) => (r.answers && r.answers.cohort) || "(미기재)";
  function getYear(r) {
    if (r.meta && r.meta.year) return r.meta.year;
    const t = (r.meta && (r.meta.submittedAt || r.meta.receivedAt)) || null;
    return t ? new Date(t).getFullYear() : "(연도미상)";
  }
  function cohortOrder(list) {
    const found = Array.from(new Set(list.map(getCohort)));
    const ordered = COHORTS.filter((c) => found.includes(c));
    found.forEach((c) => { if (!ordered.includes(c)) ordered.push(c); });
    return ordered;
  }
  function yearOrder(list) {
    return Array.from(new Set(list.map(getYear))).sort((a, b) => String(a).localeCompare(String(b)));
  }

  /* ---------------- aggregations ---------------- */
  function bar(label, value, max, suffix, hot) {
    const pct = max > 0 ? (value / max) * 100 : 0;
    return '<div class="bar' + (hot ? " hot" : "") + '"><span class="bl">' + esc(label) +
      '</span><span class="bt"><span class="bf" style="width:' + pct.toFixed(1) + '%"></span></span>' +
      '<span class="bv">' + esc(suffix) + "</span></div>";
  }
  function countSingle(q, responses) {
    const c = {}; q.options.forEach((o) => (c[o] = 0)); let answered = 0;
    responses.forEach((r) => { const v = val(r, q.id); if (v != null && v in c) { c[v]++; answered++; } });
    return { c, answered };
  }
  function countMulti(q, responses) {
    const c = {}; q.options.forEach((o) => (c[o] = 0)); let answered = 0;
    responses.forEach((r) => { const v = val(r, q.id); if (Array.isArray(v) && v.length) { answered++; v.forEach((x) => { if (x in c) c[x]++; }); } });
    return { c, answered };
  }
  function gridAverages(q, responses) {
    return q.items.map((it) => {
      let sum = 0, n = 0;
      responses.forEach((r) => { const v = val(r, q.id); if (v && v[it.id] != null) { sum += Number(v[it.id]); n++; } });
      return { id: it.id, label: it.label, avg: n ? sum / n : 0, n };
    });
  }
  function gridAvgAll(qid, responses) {
    const q = QIDX[qid]; if (!q) return 0; let sum = 0, n = 0;
    responses.forEach((r) => { const v = val(r, qid); if (v) q.items.forEach((it) => { if (v[it.id] != null) { sum += Number(v[it.id]); n++; } }); });
    return n ? sum / n : 0;
  }
  function rankScores(q, responses) {
    const score = {}, first = {}; q.options.forEach((o) => { score[o] = 0; first[o] = 0; }); let answered = 0;
    responses.forEach((r) => {
      const v = val(r, q.id);
      if (Array.isArray(v) && v.filter((x) => x).length) { answered++; v.forEach((opt, idx) => { if (opt && opt in score) { score[opt] += (q.slots - idx); if (idx === 0) first[opt]++; } }); }
    });
    return { score, first, answered };
  }
  function sliderStats(qid, responses) {
    let sum = 0, n = 0; const buckets = {};
    responses.forEach((r) => { const v = val(r, qid); if (v != null) { sum += Number(v); n++; buckets[v] = (buckets[v] || 0) + 1; } });
    return { avg: n ? sum / n : 0, n, buckets };
  }
  function texts(q, responses) { const out = []; responses.forEach((r) => { const v = val(r, q.id); if (v && String(v).trim()) out.push(String(v).trim()); }); return out; }
  function pct(n, d) { return d > 0 ? Math.round((n / d) * 100) + "%" : "0%"; }
  function wantRate(responses) {
    const q = QIDX["mentoring_need"]; if (!q) return 0;
    const { c } = countSingle(q, responses);
    const want = (c["매우 참여하고 싶다"] || 0) + (c["참여하고 싶다"] || 0);
    return responses.length ? (want / responses.length) * 100 : 0;
  }
  // 문항 응답 여부 (미응답률 계산용)
  function isAnswered(q, v) {
    if (v == null) return false;
    if (q.type === "multi" || q.type === "rank") return Array.isArray(v) && v.filter((x) => x).length > 0;
    if (q.type === "likert_grid") return v && typeof v === "object" && Object.keys(v).some((k) => v[k] != null);
    return String(v).trim().length > 0;
  }

  /* ---------------- block renderers ---------------- */
  function blockWrap(title, sub, inner) { return '<div class="block"><h3>' + esc(title) + "</h3><p class='sub'>" + esc(sub) + "</p>" + inner + "</div>"; }
  function blockSingle(q, responses) {
    const { c, answered } = countSingle(q, responses); const max = Math.max(1, ...Object.values(c));
    const top = Object.keys(c).reduce((a, b) => (c[a] >= c[b] ? a : b), q.options[0]);
    const bars = q.options.map((o) => bar(o, c[o], max, c[o] + "명 (" + pct(c[o], answered) + ")", o === top && c[o] > 0)).join("");
    return blockWrap(q.title, answered + "명 응답", bars);
  }
  function blockMulti(q, responses) {
    const { c, answered } = countMulti(q, responses); const max = Math.max(1, ...Object.values(c));
    const sorted = q.options.slice().sort((a, b) => c[b] - c[a]);
    return blockWrap(q.title, answered + "명 응답 · 복수선택", sorted.map((o) => bar(o, c[o], max, c[o] + "명 (" + pct(c[o], answered) + ")")).join(""));
  }
  function blockGrid(q, responses, radar) {
    const avgs = gridAverages(q, responses); const sorted = avgs.slice().sort((a, b) => b.avg - a.avg);
    const bars = sorted.map((a, i) => bar(a.label, a.avg, 5, a.avg.toFixed(2) + " / 5", i === 0)).join("");
    let inner = radar ? '<div class="grid2"><div class="radar-wrap">' + radarSVG(avgs, 5) + "</div><div>" + bars + "</div></div>" : bars;
    const n = Math.max(0, ...avgs.map((a) => a.n));
    return blockWrap(q.title, n + "명 응답 · 5점 평균(높을수록 강함/중요/필요)", inner);
  }
  function blockRank(q, responses) {
    const { score, first, answered } = rankScores(q, responses); const max = Math.max(1, ...Object.values(score));
    const sorted = q.options.slice().sort((a, b) => score[b] - score[a]);
    return blockWrap(q.title, answered + "명 응답 · 가중점수(1순위 3 / 2순위 2 / 3순위 1)",
      sorted.map((o, i) => bar(o, score[o], max, score[o] + "점 · 1순위 " + first[o] + "명", i === 0)).join(""));
  }
  function blockSlider(q, responses) {
    const s = sliderStats(q.id, responses); const order = [];
    for (let v = q.min; v <= q.max; v += q.step || 1) order.push(v);
    const max = Math.max(1, ...order.map((v) => s.buckets[v] || 0));
    const bars = order.map((v) => bar(v + (q.unit || ""), s.buckets[v] || 0, max, (s.buckets[v] || 0) + "명")).join("");
    const head = '<p style="font-size:15px;margin:0 0 12px">평균 <b style="color:var(--brand-dark);font-size:20px">' +
      s.avg.toFixed(1) + (q.unit || "") + "</b> <span class='seg'>(" + esc(q.minLabel) + " ↔ " + esc(q.maxLabel) + ")</span></p>";
    return blockWrap(q.title, s.n + "명 응답", head + bars);
  }
  function blockText(q, responses) {
    const arr = texts(q, responses);
    const list = arr.length ? '<div class="txtlist">' + arr.map((t) => "<div>" + esc(t) + "</div>").join("") + "</div>" : '<p class="muted">응답 없음</p>';
    return blockWrap(q.title, arr.length + "건의 서술 응답", list);
  }
  function radarSVG(items, maxVal) {
    const N = items.length, R = 110, cx = 150, cy = 140;
    const ang = (i) => (Math.PI * 2 * i) / N - Math.PI / 2;
    let grid = "";
    for (let g = 1; g <= 5; g++) { const rr = (R * g) / 5; grid += '<polygon points="' + items.map((_, i) => (cx + rr * Math.cos(ang(i))) + "," + (cy + rr * Math.sin(ang(i)))).join(" ") + '" fill="none" stroke="#e3e8f0"/>'; }
    let axes = "", labels = "";
    items.forEach((it, i) => {
      const x = cx + R * Math.cos(ang(i)), y = cy + R * Math.sin(ang(i));
      axes += '<line x1="' + cx + '" y1="' + cy + '" x2="' + x + '" y2="' + y + '" stroke="#e3e8f0"/>';
      const lx = cx + (R + 14) * Math.cos(ang(i)), ly = cy + (R + 14) * Math.sin(ang(i));
      const anchor = Math.abs(Math.cos(ang(i))) < 0.3 ? "middle" : Math.cos(ang(i)) > 0 ? "start" : "end";
      labels += '<text x="' + lx + '" y="' + ly + '" font-size="9" fill="#5e6b7e" text-anchor="' + anchor + '">' + esc(it.label.replace(/\(.*$/, "").slice(0, 11)) + "</text>";
    });
    const dpts = items.map((it, i) => { const rr = (R * it.avg) / maxVal; return (cx + rr * Math.cos(ang(i))) + "," + (cy + rr * Math.sin(ang(i))); }).join(" ");
    return '<svg width="300" height="290" viewBox="0 0 300 290">' + grid + axes +
      '<polygon points="' + dpts + '" fill="rgba(31,111,235,.22)" stroke="#1f6feb" stroke-width="2"/>' + labels + "</svg>";
  }

  /* ---------------- 응답 추세 / 소요시간·미응답 ---------------- */
  function trendHTML(subset) {
    const byDay = {};
    subset.forEach((r) => {
      const t = r.meta && (r.meta.submittedAt || r.meta.receivedAt); if (!t) return;
      const d = new Date(t);
      const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      byDay[k] = (byDay[k] || 0) + 1;
    });
    const days = Object.keys(byDay).sort();
    if (!days.length) return "";
    const max = Math.max(1, ...days.map((d) => byDay[d]));
    return blockWrap("📅 응답 추세 (일자별)", days.length + "일간 수집 · 총 " + subset.length + "명", days.map((d) => bar(d, byDay[d], max, byDay[d] + "명")).join(""));
  }
  function durationMissingHTML(subset) {
    const buckets = { "10분 미만": 0, "10~20분": 0, "20~30분": 0, "30~45분": 0, "45분 이상": 0 };
    let dn = 0;
    subset.forEach((r) => {
      const s = r.meta && r.meta.durationSec; if (s == null) return; dn++;
      const m = s / 60;
      if (m < 10) buckets["10분 미만"]++; else if (m < 20) buckets["10~20분"]++; else if (m < 30) buckets["20~30분"]++; else if (m < 45) buckets["30~45분"]++; else buckets["45분 이상"]++;
    });
    const order = Object.keys(buckets); const dmax = Math.max(1, ...order.map((k) => buckets[k]));
    const durBars = dn ? order.map((k) => bar(k, buckets[k], dmax, buckets[k] + "명")).join("") : '<p class="muted">소요시간 데이터 없음</p>';
    const rows = [];
    SCHEMA.forEach((sec) => sec.questions.forEach((q) => {
      if (q.id === "cohort") return;
      let answered = 0; subset.forEach((r) => { if (isAnswered(q, val(r, q.id))) answered++; });
      const missing = subset.length - answered;
      rows.push({ title: q.title.replace(/^\d+\.\s*/, ""), missing, pctMissing: subset.length ? (missing / subset.length) * 100 : 0 });
    }));
    rows.sort((a, b) => b.pctMissing - a.pctMissing);
    const top = rows.filter((r) => r.missing > 0).slice(0, 10);
    const mmax = Math.max(1, ...top.map((r) => r.pctMissing));
    const missBars = top.length ? top.map((r) => bar(r.title, r.pctMissing, mmax, r.missing + "명 (" + Math.round(r.pctMissing) + "%)")).join("") : '<p class="muted">미응답 문항 없음 — 모든 문항에 응답</p>';
    return blockWrap("⏱️ 소요시간 분포 · 미응답률", dn + "명 소요시간 측정", '<div class="grid2"><div><div class="qlabel">설문 소요시간 분포</div>' + durBars + "</div><div><div class=\"qlabel\">문항별 미응답률 (상위 10)</div>" + missBars + "</div></div>");
  }

  /* ---------------- 대시보드 개요 (필터 기반) ---------------- */
  // 세그먼트 탐색용 지표 — 존재하는 문항만 자동 포함
  const BASE_METRICS = [
    { id: "count", label: "응답 수", kind: "count" },
    { id: "comp", label: "사전 역량 평균(5점)", kind: "grid", max: 5 },
    { id: "topic_interest", label: "주제 관심도 평균(5점)", kind: "grid", max: 5 },
    { id: "mentoring_topics", label: "멘토링 필요도 평균(5점)", kind: "grid", max: 5 },
    { id: "jobservice_need", label: "취업연계 필요도 평균(5점)", kind: "grid", max: 5 },
    { id: "networking_need", label: "네트워킹 필요도 평균(5점)", kind: "grid", max: 5 },
    { id: "mentor_want", label: "멘토링 참여희망률(%)", kind: "rate", max: 100 },
    { id: "theory_practice", label: "실습 비중 평균(%)", kind: "slider", max: 100 },
  ];
  const METRICS = BASE_METRICS.filter((m) => m.id === "count" || (m.kind === "rate" ? QIDX["mentoring_need"] : QIDX[m.id]));
  // 비교 차원
  const DIMENSIONS = [
    { id: "year", label: "연도" },
    { id: "cohort", label: "기수" },
    { id: "gender", label: "성별", q: "gender" },
    { id: "age", label: "연령", q: "age" },
    { id: "region", label: "지역", q: "region" },
    { id: "edu", label: "학력", q: "edu" },
    { id: "major", label: "전공", q: "major" },
    { id: "status", label: "현재 상황", q: "status" },
    { id: "experience", label: "경험", q: "experience" },
  ].filter((d) => d.id === "year" || d.id === "cohort" || QIDX[d.q]);
  function dimValue(r, dim) { if (dim.id === "year") return getYear(r); if (dim.id === "cohort") return getCohort(r); return val(r, dim.q); }
  function groupKeys(subset, dim) { if (dim.id === "year") return yearOrder(subset); if (dim.id === "cohort") return cohortOrder(subset); const q = QIDX[dim.q]; return q ? q.options.slice() : []; }
  function groupMetric(subset, metric) {
    if (!subset.length) return { v: 0, txt: "0명" };
    if (metric.kind === "count") return { v: subset.length, txt: subset.length + "명" };
    if (metric.kind === "grid") { const a = gridAvgAll(metric.id, subset); return { v: a, txt: a.toFixed(2) + " / 5" }; }
    if (metric.kind === "rate") { const a = wantRate(subset); return { v: a, txt: Math.round(a) + "%" }; }
    if (metric.kind === "slider") { const a = sliderStats(metric.id, subset).avg; return { v: a, txt: a.toFixed(0) + "%" }; }
    return { v: 0, txt: "-" };
  }
  // 인구통계 미니 분포 (상위 6개 항목)
  function miniDist(qid, subset) {
    const q = QIDX[qid]; if (!q) return "";
    const { c } = countSingle(q, subset);
    const max = Math.max(1, ...Object.values(c));
    const sorted = q.options.slice().sort((a, b) => c[b] - c[a]).filter((o) => c[o] > 0).slice(0, 6);
    if (!sorted.length) return '<p class="muted">응답 없음</p>';
    return sorted.map((o) => bar(o, c[o], max, c[o] + "명")).join("");
  }
  // 세그먼트 탐색 (차원 × 지표 자유 비교)
  function overviewSegmentHTML() {
    const dsel = '<select id="ovDim">' + DIMENSIONS.map((d) => '<option value="' + d.id + '"' + (d.id === ovDim ? " selected" : "") + ">" + esc(d.label) + "</option>").join("") + "</select>";
    const msel = '<select id="ovMetric">' + METRICS.map((m) => '<option value="' + m.id + '"' + (m.id === ovMetric ? " selected" : "") + ">" + esc(m.label) + "</option>").join("") + "</select>";
    return '<div class="block"><h3>🧭 세그먼트 탐색</h3><p class="sub">기준(차원)과 지표를 자유롭게 골라 비교하세요. (현재 필터 적용)</p>' +
      '<div class="toolbar">차원: ' + dsel + " 지표: " + msel + "</div><div id=\"ovSegOut\" style=\"margin-top:12px\"></div></div>";
  }
  function ovSegRender(subset) {
    const dim = DIMENSIONS.find((d) => d.id === ovDim) || DIMENSIONS[0];
    const metric = METRICS.find((m) => m.id === ovMetric) || METRICS[0];
    const keys = groupKeys(subset, dim);
    const rows = keys.map((k) => { const rs = subset.filter((r) => String(dimValue(r, dim)) === String(k)); return { k, m: groupMetric(rs, metric), n: rs.length }; }).filter((x) => x.n > 0);
    if (!rows.length) return '<p class="muted">표시할 데이터가 없습니다.</p>';
    if (metric.kind !== "count") rows.sort((a, b) => b.m.v - a.m.v);
    const max = metric.kind === "count" ? Math.max(1, ...rows.map((x) => x.m.v)) : (metric.max || 5);
    return rows.map((x, i) => bar(x.k + " (" + x.n + "명)", x.m.v, max, x.m.txt, i === 0 && metric.kind !== "count")).join("");
  }
  function bindOvSeg(subset) {
    const d = document.getElementById("ovDim"), m = document.getElementById("ovMetric"); if (!d || !m) return;
    const run = () => { ovDim = d.value; ovMetric = m.value; document.getElementById("ovSegOut").innerHTML = ovSegRender(subset); };
    d.onchange = run; m.onchange = run; run();
  }
  function renderOverview(subset) {
    const elc = document.getElementById("overview"); if (!elc) return;
    const n = subset.length;
    if (n === 0) { elc.innerHTML = '<div class="block"><h3>📊 대시보드 개요</h3><p class="muted">선택한 필터에 해당하는 응답이 없습니다.</p></div>'; return; }
    const durs = subset.map((r) => r.meta && r.meta.durationSec).filter((x) => x);
    const avgDur = durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length / 60) : "—";
    const kpis = [kpi(n, "응답 수"), kpi(avgDur, "평균 소요(분)"), kpi(Math.round(wantRate(subset)) + "%", "멘토링 참여희망")];
    if (QIDX["theory_practice"]) kpis.push(kpi(Math.round(sliderStats("theory_practice", subset).avg) + "%", "실습 비중 평균"));
    if (QIDX["topic_interest"]) { const t = gridAverages(QIDX["topic_interest"], subset).slice().sort((a, b) => b.avg - a.avg)[0]; if (t && t.n) kpis.push(kpi(String(t.label || "").replace(/\(.*$/, "").slice(0, 10), "최다 관심 주제")); }
    let html = '<div class="block"><h3>📊 대시보드 개요</h3><p class="sub">' + esc(filterLabelText()) + " · 현재 " + n + "명 기준</p><div class=\"kpis\">" + kpis.join("") + "</div></div>";
    const demoCards = [["gender", "성별"], ["age", "연령"], ["region", "지역"], ["major", "전공"], ["experience", "경험"], ["status", "현재 상황"]]
      .filter(([id]) => QIDX[id]).map(([id, lab]) => '<div class="ov-card"><div class="qlabel">' + esc(lab) + "</div>" + miniDist(id, subset) + "</div>").join("");
    if (demoCards) html += '<div class="block"><h3>👥 응답자 구성</h3><p class="sub">현재 필터 기준 인구통계 분포 (상위 항목)</p><div class="ovgrid">' + demoCards + "</div></div>";
    const keyDefs = [["comp", "사전 역량"], ["topic_interest", "주제 관심도"], ["mentoring_topics", "멘토링 필요도"], ["jobservice_need", "취업연계 필요도"], ["networking_need", "네트워킹 필요도"]].filter(([id]) => QIDX[id]);
    if (keyDefs.length) { const kbars = keyDefs.map(([id, lab]) => { const a = gridAvgAll(id, subset); return bar(lab, a, 5, a.toFixed(2) + " / 5"); }).join(""); html += blockWrap("🎯 핵심 지표 (5점 평균)", "높을수록 강함/중요/필요", kbars); }
    html += trendHTML(subset);
    html += overviewSegmentHTML();
    elc.innerHTML = html;
    bindOvSeg(subset);
  }

  /* ---------------- 교차 분석 (그룹별 평균) ---------------- */
  function crossAnalysisHTML() {
    const groupQs = [];
    SCHEMA.forEach((sec) => sec.questions.forEach((q) => { if (q.type === "single") groupQs.push(q); }));
    const metrics = [
      { id: "comp", label: "사전 역량 평균(2번)" },
      { id: "topic_interest", label: "주제 관심도 평균(3번)" },
      { id: "mentoring_topics", label: "멘토링 필요도 평균(7번)" },
      { id: "jobservice_need", label: "취업연계 필요도 평균(8번)" },
    ];
    return '<div class="block"><h3>🔬 교차 분석 (그룹별 평균)</h3>' +
      '<p class="sub">그룹별로 평균을 비교합니다. (예: 전공 계열별 사전 역량 차이) — 현재 필터 적용됨</p>' +
      '<div class="toolbar">그룹 기준: <select id="cxGroup">' +
      groupQs.map((q) => '<option value="' + q.id + '">' + esc(q.title.replace(/^\d+\.\s*/, "")) + "</option>").join("") +
      "</select>지표: <select id='cxMetric'>" +
      metrics.map((m) => '<option value="' + m.id + '">' + esc(m.label) + "</option>").join("") +
      '</select></div><div id="cxOut" style="margin-top:16px"></div></div>';
  }
  function crossRender(responses, groupId, metricId) {
    const gq = QIDX[groupId], mq = QIDX[metricId];
    if (!gq || !gq.options || !mq || !mq.items) return "";
    const groups = {}; gq.options.forEach((o) => (groups[o] = { sum: 0, n: 0 }));
    responses.forEach((r) => {
      const g = val(r, groupId), mv = val(r, metricId);
      if (g == null || !(g in groups) || !mv) return;
      const vals = mq.items.map((it) => mv[it.id]).filter((x) => x != null).map(Number);
      if (!vals.length) return;
      groups[g].sum += vals.reduce((a, b) => a + b, 0) / vals.length; groups[g].n++;
    });
    return gq.options.map((o) => { const gr = groups[o]; const avg = gr.n ? gr.sum / gr.n : 0; return bar(o + " (" + gr.n + "명)", avg, 5, gr.n ? avg.toFixed(2) + " / 5" : "응답 없음"); }).join("");
  }
  function bindCross(subset) {
    const g = document.getElementById("cxGroup"), m = document.getElementById("cxMetric");
    if (!g || !m) return;
    const run = () => { document.getElementById("cxOut").innerHTML = crossRender(subset, g.value, m.value); };
    g.onchange = run; m.onchange = run; run();
  }

  /* ---------------- 교차 히트맵 (단일 × 단일 응답 수) ---------------- */
  function heatmapHTML() {
    const singles = [];
    SCHEMA.forEach((sec) => sec.questions.forEach((q) => { if (q.type === "single") singles.push(q); }));
    if (singles.length < 2) return "";
    const opt = (selId, def) => '<select id="' + selId + '">' + singles.map((q) => '<option value="' + q.id + '"' + (q.id === def ? " selected" : "") + ">" + esc(q.title.replace(/^\d+\.\s*/, "")) + "</option>").join("") + "</select>";
    const def1 = QIDX["major"] ? "major" : singles[0].id;
    const def2 = QIDX["region"] ? "region" : (singles[1] ? singles[1].id : singles[0].id);
    return '<div class="block"><h3>🗺️ 교차 히트맵</h3><p class="sub">두 문항을 교차해 응답 수를 봅니다. 색이 진할수록 많음. (현재 필터 적용)</p>' +
      '<div class="toolbar">행: ' + opt("hmRow", def1) + " 열: " + opt("hmCol", def2) + "</div>" +
      '<div id="hmOut" style="overflow:auto;margin-top:12px"></div></div>';
  }
  function heatRender(subset, rowId, colId) {
    const rq = QIDX[rowId], cq = QIDX[colId];
    if (!rq || !rq.options || !cq || !cq.options) return "";
    const counts = {}; let mx = 0;
    rq.options.forEach((ro) => { counts[ro] = {}; cq.options.forEach((co) => (counts[ro][co] = 0)); });
    subset.forEach((r) => { const rv = val(r, rowId), cv = val(r, colId); if (rv in counts && cv in counts[rv]) { counts[rv][cv]++; if (counts[rv][cv] > mx) mx = counts[rv][cv]; } });
    let html = '<table class="hm"><tr><th></th>' + cq.options.map((co) => "<th>" + esc(co) + "</th>").join("") + "<th>합계</th></tr>";
    rq.options.forEach((ro) => {
      let rowSum = 0;
      html += '<tr><td class="rowh">' + esc(ro) + "</td>" + cq.options.map((co) => {
        const n = counts[ro][co]; rowSum += n; const a = mx ? n / mx : 0;
        const bg = n ? "background:rgba(31,111,235," + (0.08 + a * 0.55).toFixed(2) + ")" : "";
        return '<td style="' + bg + '">' + (n || "") + "</td>";
      }).join("") + "<td><b>" + rowSum + "</b></td></tr>";
    });
    html += '<tr><td class="rowh">합계</td>' + cq.options.map((co) => { let s = 0; rq.options.forEach((ro) => (s += counts[ro][co])); return "<td><b>" + s + "</b></td>"; }).join("") + "<td><b>" + subset.length + "</b></td></tr>";
    return html + "</table>";
  }
  function bindHeat(subset) {
    const rr = document.getElementById("hmRow"), cc = document.getElementById("hmCol"); if (!rr || !cc) return;
    const run = () => { document.getElementById("hmOut").innerHTML = heatRender(subset, rr.value, cc.value); };
    rr.onchange = run; cc.onchange = run; run();
  }

  /* ---------------- 서술형 키워드 빈도 ---------------- */
  const STOPWORDS = new Set("그리고 그래서 하지만 그러나 또한 너무 정말 진짜 매우 조금 그냥 같아요 같습니다 합니다 했으면 좋겠 좋겠습니다 좋겠어요 있으면 있는 있다 없다 한다 해요 거의 통해 위해 위한 대한 대해 관련 등등 라고 라는 으로 에서 에게 부분 생각 같다 많이 많은 우리 저희 그것 이것 저것".split(/\s+/));
  function keywordsHTML(subset) {
    const freq = {};
    SCHEMA.forEach((sec) => sec.questions.forEach((q) => {
      if (q.type !== "text" && q.type !== "textarea") return;
      subset.forEach((r) => {
        const v = val(r, q.id); if (!v) return;
        String(v).toLowerCase().split(/[^0-9a-z가-힣]+/).forEach((tok) => {
          tok = tok.trim(); if (tok.length < 2) return; if (STOPWORDS.has(tok)) return;
          freq[tok] = (freq[tok] || 0) + 1;
        });
      });
    }));
    const items = Object.keys(freq).map((k) => ({ k, n: freq[k] })).sort((a, b) => b.n - a.n).slice(0, 30);
    if (!items.length) return "";
    const max = items[0].n, min = items[items.length - 1].n;
    const size = (n) => { const t = max === min ? 1 : (n - min) / (max - min); return (14 + t * 22).toFixed(0); };
    const cloud = items.map((it) => '<span class="kw" style="font-size:' + size(it.n) + 'px">' + esc(it.k) + " <small>" + it.n + "</small></span>").join("");
    return blockWrap("💬 서술형 키워드 빈도", "자유응답에서 자주 등장한 단어 상위 " + items.length + "개", '<div class="kwcloud">' + cloud + "</div>");
  }

  /* ---------------- 데이터 관리 (초기화 / 선택 삭제 / 뷰어) ---------------- */
  function snippet(r) {
    const parts = [];
    SCHEMA.forEach((sec) => sec.questions.forEach((q) => { if ((q.type === "text" || q.type === "textarea")) { const v = val(r, q.id); if (v && String(v).trim()) parts.push(String(v).trim()); } }));
    return parts.join(" / ").slice(0, 80);
  }
  function dataManageHTML(subset) {
    const cohorts = cohortOrder(ALL);
    const cohortSel = '<select id="dmCohort">' + cohorts.map((c) => '<option value="' + esc(c) + '">' + esc(c) + " (" + ALL.filter((r) => getCohort(r) === c).length + "명)</option>").join("") + "</select>";
    let rows = "";
    subset.forEach((r, i) => {
      const sub = [getCohort(r), getYear(r), val(r, "gender"), val(r, "region"), val(r, "major"), snippet(r)].map((x) => String(x == null ? "" : x).toLowerCase()).join(" ");
      const t = r.meta && r.meta.submittedAt ? new Date(r.meta.submittedAt).toLocaleString("ko-KR") : "";
      const dur = r.meta && r.meta.durationSec ? (r.meta.durationSec / 60).toFixed(1) : "";
      rows += '<tr data-search="' + esc(sub) + '">' +
        '<td><input type="checkbox" class="dmChk" value="' + esc(r.id) + '"></td>' +
        "<td>" + (i + 1) + "</td><td>" + esc(t) + "</td><td>" + esc(getCohort(r)) + "</td><td>" + esc(getYear(r)) + "</td><td>" + esc(dur) + "</td>" +
        "<td>" + esc(val(r, "gender") || "") + "</td><td>" + esc(val(r, "region") || "") + "</td><td>" + esc(val(r, "major") || "") + "</td>" +
        '<td class="wrapcell">' + esc(snippet(r)) + "</td></tr>";
    });
    return '<div class="block no-print"><h3>🗂️ 데이터 관리</h3>' +
      '<p class="sub">불량/중복/테스트 응답을 선택해 삭제하거나, 특정 기수 데이터를 한 번에 초기화합니다. <b style="color:#c92a2a">삭제는 되돌릴 수 없습니다.</b></p>' +
      '<div class="toolbar"><b>기수별 초기화:</b> ' + cohortSel + '<button class="btn-danger" id="dmResetBtn">이 기수 데이터 삭제</button></div>' +
      '<div class="toolbar" style="margin-top:12px"><input id="dmSearch" placeholder="응답 내용 검색(기수·지역·전공·서술형…)" style="flex:1;min-width:200px;padding:9px 12px;border:1.5px solid var(--line);border-radius:10px;font-size:14px">' +
      '<button class="btn-danger" id="dmDeleteBtn">선택 응답 삭제</button></div>' +
      '<div class="dwrap" style="margin-top:12px"><table class="dtable"><thead><tr>' +
      '<th><input type="checkbox" id="dmAll"></th><th>#</th><th>제출시각</th><th>기수</th><th>연도</th><th>소요(분)</th><th>성별</th><th>지역</th><th>전공</th><th>서술형 요약</th>' +
      '</tr></thead><tbody id="dmBody">' + (rows || '<tr><td colspan="10" class="muted" style="padding:14px">표시할 응답이 없습니다.</td></tr>') + "</tbody></table></div>" +
      '<p class="seg" id="dmCount" style="margin-top:8px"></p></div>';
  }
  function bindDataManage(subset) {
    const all = document.getElementById("dmAll");
    const body = document.getElementById("dmBody");
    const search = document.getElementById("dmSearch");
    const countEl = document.getElementById("dmCount");
    const chks = () => Array.from(document.querySelectorAll(".dmChk"));
    const updateCount = () => { const sel = chks().filter((c) => c.checked && c.closest("tr").style.display !== "none").length; if (countEl) countEl.textContent = "표시 " + Array.from(body.querySelectorAll("tr")).filter((tr) => tr.style.display !== "none" && tr.querySelector(".dmChk")).length + "건 · 선택 " + sel + "건"; };
    if (all) all.onchange = () => { chks().forEach((c) => { if (c.closest("tr").style.display !== "none") c.checked = all.checked; }); updateCount(); };
    if (body) body.addEventListener("change", (e) => { if (e.target.classList.contains("dmChk")) updateCount(); });
    if (search) search.oninput = () => {
      const q = search.value.trim().toLowerCase();
      Array.from(body.querySelectorAll("tr")).forEach((tr) => { const s = tr.getAttribute("data-search") || ""; tr.style.display = (!q || s.indexOf(q) >= 0) ? "" : "none"; });
      updateCount();
    };
    updateCount();

    const resetBtn = document.getElementById("dmResetBtn");
    if (resetBtn) resetBtn.onclick = async () => {
      const cohort = document.getElementById("dmCohort").value;
      const n = ALL.filter((r) => getCohort(r) === cohort).length;
      if (!n) return alert(cohort + " 데이터가 없습니다.");
      if (!confirm(cohort + " 응답 " + n + "건을 모두 삭제합니다. 되돌릴 수 없습니다. 계속할까요?")) return;
      try { const res = await apiPost("api/responses/delete-cohort", { cohort }); alert(res.deleted + "건을 삭제했습니다."); await load(sessionStorage.getItem(KEY_STORE)); }
      catch (e) { alert("삭제 실패: " + e.message); }
    };
    const delBtn = document.getElementById("dmDeleteBtn");
    if (delBtn) delBtn.onclick = async () => {
      const ids = chks().filter((c) => c.checked).map((c) => c.value);
      if (!ids.length) return alert("삭제할 응답을 먼저 선택하세요.");
      if (!confirm("선택한 응답 " + ids.length + "건을 삭제합니다. 되돌릴 수 없습니다. 계속할까요?")) return;
      try { const res = await apiPost("api/responses/delete", { ids }); alert(res.deleted + "건을 삭제했습니다."); await load(sessionStorage.getItem(KEY_STORE)); }
      catch (e) { alert("삭제 실패: " + e.message); }
    };
  }

  /* ---------------- 내보내기 (원본 CSV / 집계표 CSV / Excel / 인쇄) ---------------- */
  // 척도/값 사람이 읽을 수 있게 변환 (AI 분석용)
  function scaleText(scale) { if (!scale) return ""; return Object.keys(scale).sort((a, b) => a - b).map((k) => k + "=" + scale[k]).join(", "); }
  function gridCell(q, num) { if (num == null || num === "") return ""; return num + (q.scale && q.scale[num] ? " (" + q.scale[num] + ")" : ""); }
  // 넓은(wide) 표 — 문항 전문 헤더 + 답변 전문(척도값은 라벨 동반)
  function rawTableRows(responses) {
    const cols = ["응답ID", "기수", "연도", "제출시각", "소요(분)"];
    const getters = [
      (r) => r.id || "",
      (r) => getCohort(r),
      (r) => getYear(r),
      (r) => (r.meta && r.meta.submittedAt ? new Date(r.meta.submittedAt).toLocaleString("ko-KR") : ""),
      (r) => (r.meta && r.meta.durationSec ? (r.meta.durationSec / 60).toFixed(1) : ""),
    ];
    SCHEMA.forEach((sec) => sec.questions.forEach((q) => {
      if (q.id === "cohort") return;
      if (q.type === "likert_grid") q.items.forEach((it) => { cols.push(q.title + " — " + it.label); getters.push((r) => { const v = val(r, q.id); return v && v[it.id] != null ? gridCell(q, v[it.id]) : ""; }); });
      else if (q.type === "rank") { for (let s = 0; s < q.slots; s++) { cols.push(q.title + " (" + (s + 1) + "순위)"); getters.push((r) => { const v = val(r, q.id); return Array.isArray(v) ? (v[s] || "") : ""; }); } }
      else if (q.type === "multi") { cols.push(q.title); getters.push((r) => { const v = val(r, q.id); return Array.isArray(v) ? v.join(" | ") : ""; }); }
      else if (q.type === "slider") { cols.push(q.title); getters.push((r) => { const v = val(r, q.id); return v == null ? "" : v + (q.unit || ""); }); }
      else { cols.push(q.title); getters.push((r) => { const v = val(r, q.id); return v == null ? "" : v; }); }
    }));
    const rows = [cols];
    responses.forEach((r) => rows.push(getters.map((g) => g(r))));
    return rows;
  }
  // 롱(tidy) 표 — 한 행 = 하나의 (응답 × 문항 × 답변). AI가 바로 집계·분석 가능
  function longTableRows(responses) {
    const rows = [["응답ID", "기수", "연도", "제출시각", "소요(분)", "섹션", "문항ID", "문항", "하위항목", "답변", "척도설명"]];
    responses.forEach((r) => {
      const base = [
        r.id || "", getCohort(r), getYear(r),
        (r.meta && r.meta.submittedAt ? new Date(r.meta.submittedAt).toLocaleString("ko-KR") : ""),
        (r.meta && r.meta.durationSec ? (r.meta.durationSec / 60).toFixed(1) : ""),
      ];
      const push = (secT, q, sub, ans, scale) => rows.push(base.concat([secT, q.id, q.title, sub, ans, scale || ""]));
      SCHEMA.forEach((sec) => sec.questions.forEach((q) => {
        if (q.id === "cohort") return;
        const v = val(r, q.id);
        if (q.type === "likert_grid") { const sc = scaleText(q.scale); q.items.forEach((it) => { const num = v && v[it.id] != null ? v[it.id] : null; push(sec.title, q, it.label, num != null ? gridCell(q, num) : "(무응답)", sc); }); }
        else if (q.type === "rank") { for (let s = 0; s < q.slots; s++) { const opt = Array.isArray(v) ? (v[s] || "") : ""; push(sec.title, q, (s + 1) + "순위", opt || "(무응답)", ""); } }
        else if (q.type === "multi") { if (Array.isArray(v) && v.filter((x) => x).length) v.forEach((opt) => push(sec.title, q, "", opt, "")); else push(sec.title, q, "", "(무응답)", ""); }
        else if (q.type === "slider") { push(sec.title, q, "", v != null ? v + (q.unit || "") : "(무응답)", (q.minLabel || "") + " ↔ " + (q.maxLabel || "")); }
        else if (q.type === "text" || q.type === "textarea") { push(sec.title, q, "", v && String(v).trim() ? String(v).trim() : "(무응답)", ""); }
        else { push(sec.title, q, "", v != null && String(v) !== "" ? v : "(무응답)", ""); }
      }));
    });
    return rows;
  }
  function summaryRows(subset) {
    const rows = [["섹션", "문항", "항목", "값", "비율/비고"]];
    SCHEMA.forEach((sec) => sec.questions.forEach((q) => {
      if (q.id === "cohort") return;
      if (q.type === "single") { const { c, answered } = countSingle(q, subset); q.options.forEach((o) => rows.push([sec.title, q.title, o, c[o] + "명", pct(c[o], answered)])); }
      else if (q.type === "multi") { const { c, answered } = countMulti(q, subset); q.options.forEach((o) => rows.push([sec.title, q.title, o, c[o] + "명", pct(c[o], answered)])); }
      else if (q.type === "likert_grid") { gridAverages(q, subset).forEach((a) => rows.push([sec.title, q.title, a.label, a.avg.toFixed(2) + " / 5", a.n + "명"])); }
      else if (q.type === "rank") { const { score, first } = rankScores(q, subset); q.options.forEach((o) => rows.push([sec.title, q.title, o, score[o] + "점", "1순위 " + first[o] + "명"])); }
      else if (q.type === "slider") { const s = sliderStats(q.id, subset); rows.push([sec.title, q.title, "평균", s.avg.toFixed(1) + (q.unit || ""), s.n + "명"]); }
      else if (q.type === "text" || q.type === "textarea") { rows.push([sec.title, q.title, "응답 수", texts(q, subset).length + "건", ""]); }
    }));
    return rows;
  }
  function csvFromRows(rows) { const qq = (s) => '"' + String(s).replace(/"/g, '""') + '"'; return "﻿" + rows.map((r) => r.map(qq).join(",")).join("\r\n"); }
  function downloadBlob(content, mime, baseName, ext) {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "배터리아카데미_" + baseName + "_" + new Date().toISOString().slice(0, 10) + ext;
    a.click();
  }
  function downloadRawCSV(responses) { downloadBlob(csvFromRows(rawTableRows(responses)), "text/csv;charset=utf-8;", "수요조사_원본", ".csv"); }
  function downloadSummaryCSV(subset) { downloadBlob(csvFromRows(summaryRows(subset)), "text/csv;charset=utf-8;", "수요조사_집계표", ".csv"); }
  function downloadLongCSV(subset) { downloadBlob(csvFromRows(longTableRows(subset)), "text/csv;charset=utf-8;", "수요조사_AI분석용", ".csv"); }
  function xmlEsc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function sheetXML(name, rows) {
    const body = rows.map((row) => "<Row>" + row.map((cell) => {
      const num = typeof cell === "number" && isFinite(cell);
      return '<Cell><Data ss:Type="' + (num ? "Number" : "String") + '">' + xmlEsc(cell) + "</Data></Cell>";
    }).join("") + "</Row>").join("");
    return '<Worksheet ss:Name="' + xmlEsc(name) + '"><Table>' + body + "</Table></Worksheet>";
  }
  function downloadXLS(subset) {
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<?mso-application progid="Excel.Sheet"?>\n' +
      '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
      sheetXML("집계표", summaryRows(subset)) + sheetXML("원본", rawTableRows(subset)) + "</Workbook>";
    downloadBlob("﻿" + xml, "application/vnd.ms-excel", "수요조사", ".xls");
  }

  /* ---------------- 상세 통계 (필터 적용) ---------------- */
  function currentSubset() {
    return ALL.filter((r) => FILTER_DEFS.every((d) => {
      const f = filters[d.id]; if (f === "ALL") return true;
      if (d.id === "cohort") return getCohort(r) === f;
      if (d.id === "year") return String(getYear(r)) === String(f);
      const v = val(r, d.q || d.id); return String(v == null ? "" : v) === f;
    }));
  }
  function filterLabelText() {
    const parts = [];
    FILTER_DEFS.forEach((d) => { if (filters[d.id] !== "ALL") parts.push(d.label + ": " + filters[d.id]); });
    return parts.length ? parts.join(" · ") : "전체 응답";
  }
  function kpi(num, lab) { return '<div class="kpi"><div class="num">' + esc(num) + '</div><div class="lab">' + esc(lab) + "</div></div>"; }
  function renderDetail(subset) {
    const n = subset.length;
    const filterLabel = filterLabelText();
    if (n === 0) {
      document.getElementById("detail").innerHTML = '<div class="block center"><p class="muted">선택한 조건(' + esc(filterLabel) + ')에 해당하는 응답이 없습니다.</p></div>' + dataManageHTML(subset);
      bindDataManage(subset);
      return;
    }
    const durs = subset.map((r) => r.meta && r.meta.durationSec).filter((x) => x);
    const avgDur = durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length / 60) : "—";
    let html = '<div class="block" style="background:var(--brand-soft);border-color:#cfe0ff"><b>상세 통계 기준:</b> ' + esc(filterLabel) + "</div>";
    html += '<div class="kpis">' + kpi(n, "응답 수") + kpi(avgDur, "평균 소요(분)") + kpi(Math.round(wantRate(subset)) + "%", "멘토링 참여희망") + "</div>";
    html += durationMissingHTML(subset);
    SCHEMA.forEach((sec) => {
      html += '<div class="block" style="background:transparent;border:0;box-shadow:none;padding:8px 2px 0"><h3 style="font-size:18px">' + esc(sec.title) + "</h3></div>";
      sec.questions.forEach((q) => {
        if (q.id === "cohort") return;
        if (q.type === "single") html += blockSingle(q, subset);
        else if (q.type === "multi") html += blockMulti(q, subset);
        else if (q.type === "likert_grid") html += blockGrid(q, subset, q.id === "comp");
        else if (q.type === "slider") html += blockSlider(q, subset);
        else if (q.type === "rank") html += blockRank(q, subset);
        else if (q.type === "text" || q.type === "textarea") html += blockText(q, subset);
      });
    });
    html += heatmapHTML();
    html += keywordsHTML(subset);
    html += dataManageHTML(subset);
    document.getElementById("detail").innerHTML = html;
    bindHeat(subset);
    bindDataManage(subset);
  }

  /* ---------------- main ---------------- */
  function render(all) {
    ALL = all;
    FILTER_DEFS.forEach((d) => (filters[d.id] = "ALL"));
    let html = '<div class="toolbar no-print" style="justify-content:flex-end;margin-bottom:14px">' +
      '<button id="reloadBtn">↻ 새로고침</button>' +
      '<button id="aiCsvBtn">🤖 AI 분석용 CSV</button>' +
      '<button id="csvBtn">⬇ 원본 CSV</button>' +
      '<button id="sumCsvBtn">⬇ 집계표 CSV</button>' +
      '<button id="xlsBtn">⬇ Excel(.xls)</button>' +
      '<button id="printBtn">🖨 인쇄/PDF</button>' +
      '<button id="logoutBtn">로그아웃</button></div>';
    if (all.length === 0) {
      html += '<div class="block center"><div class="big-emoji">🗂️</div><h3>아직 제출된 응답이 없습니다</h3>' +
        '<p class="muted">설문(또는 기수별 링크)을 공유한 뒤 응답이 들어오면 이곳에 통계가 표시됩니다.</p></div>';
      root.innerHTML = html; bindTop(); return;
    }
    // 필터 UI (연도 > 기수 > 인구통계 순, 라벨+셀렉트 카드형)
    let filtUI = "";
    FILTER_DEFS.forEach((d) => {
      let opts;
      if (d.id === "cohort") opts = cohortOrder(all);
      else if (d.id === "year") opts = yearOrder(all);
      else { const q = QIDX[d.q || d.id]; if (!q) return; opts = q.options; }
      filtUI += '<div class="fitem"><label>' + esc(d.label) + '</label><select data-filter="' + d.id + '"><option value="ALL">전체</option>' +
        opts.map((o) => '<option value="' + esc(o) + '">' + esc(o) + "</option>").join("") + "</select></div>";
    });
    html += '<div class="block no-print"><div class="filterhead"><b>🔎 필터</b><span class="seg" id="filtSummary"></span><button id="clearFilters" style="margin-left:auto">필터 초기화</button></div>' +
      '<div class="fgrid">' + filtUI + "</div></div>";
    html += '<div id="overview"></div><div id="detail"></div>';
    root.innerHTML = html;
    bindTop();
    const refresh = () => { const s = currentSubset(); updateFilterSummary(); renderOverview(s); renderDetail(s); };
    document.querySelectorAll("select[data-filter]").forEach((sel) => {
      sel.onchange = () => { filters[sel.getAttribute("data-filter")] = sel.value; refresh(); };
    });
    const cf = document.getElementById("clearFilters");
    if (cf) cf.onclick = () => { FILTER_DEFS.forEach((d) => (filters[d.id] = "ALL")); document.querySelectorAll("select[data-filter]").forEach((s) => (s.value = "ALL")); refresh(); };
    refresh();
  }
  function updateFilterSummary() {
    const el = document.getElementById("filtSummary"); if (!el) return;
    const active = []; FILTER_DEFS.forEach((d) => { if (filters[d.id] !== "ALL") active.push(d.label + "=" + filters[d.id]); });
    el.textContent = (active.length ? active.join(" · ") + " · " : "") + currentSubset().length + "명 / 전체 " + ALL.length + "명";
  }
  function bindTop() {
    const rb = document.getElementById("reloadBtn"); if (rb) rb.onclick = () => load(sessionStorage.getItem(KEY_STORE));
    const ab = document.getElementById("aiCsvBtn"); if (ab) ab.onclick = () => downloadLongCSV(currentSubset());
    const cb = document.getElementById("csvBtn"); if (cb) cb.onclick = () => downloadRawCSV(ALL);
    const sb = document.getElementById("sumCsvBtn"); if (sb) sb.onclick = () => downloadSummaryCSV(currentSubset());
    const xb = document.getElementById("xlsBtn"); if (xb) xb.onclick = () => downloadXLS(currentSubset());
    const pb = document.getElementById("printBtn"); if (pb) pb.onclick = () => window.print();
    const lo = document.getElementById("logoutBtn"); if (lo) lo.onclick = () => { sessionStorage.removeItem(KEY_STORE); loginScreen(); };
  }

  const saved = sessionStorage.getItem(KEY_STORE);
  if (saved) load(saved); else loginScreen();
})();

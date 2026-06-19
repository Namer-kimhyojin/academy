/* 배터리아카데미 교육 수요조사 - 분석 대시보드 (기수·연도 분석 포함) */
(function () {
  const SCHEMA = window.SURVEY_SCHEMA;
  const COHORTS = window.SURVEY_COHORTS || [];
  const root = document.getElementById("root");
  const KEY_STORE = "battery_admin_key";

  const QIDX = {};
  SCHEMA.forEach((sec) => sec.questions.forEach((q) => (QIDX[q.id] = q)));

  // state
  let ALL = [];
  let fCohort = "ALL";
  let fYear = "ALL";
  let cmpMetric = "count";

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

  /* ---------------- 기수·연도 비교 ---------------- */
  const CMP_METRICS = [
    { id: "count", label: "응답 수", kind: "count" },
    { id: "comp", label: "사전 역량 평균(2번)", kind: "grid", max: 5 },
    { id: "topic_interest", label: "주제 관심도 평균(3번)", kind: "grid", max: 5 },
    { id: "mentoring_topics", label: "멘토링 필요도 평균(7번)", kind: "grid", max: 5 },
    { id: "jobservice_need", label: "취업연계 필요도 평균(8번)", kind: "grid", max: 5 },
    { id: "networking_need", label: "네트워킹 필요도 평균(9번)", kind: "grid", max: 5 },
    { id: "mentor_want", label: "멘토링 참여희망률(%)", kind: "rate", max: 100 },
    { id: "theory_practice", label: "실습 비중 평균(%)", kind: "slider", max: 100 },
  ];
  function groupMetric(subset, metric) {
    if (!subset.length) return { v: 0, txt: "0명" };
    if (metric.kind === "count") return { v: subset.length, txt: subset.length + "명" };
    if (metric.kind === "grid") { const a = gridAvgAll(metric.id, subset); return { v: a, txt: a.toFixed(2) + " / 5" }; }
    if (metric.kind === "rate") { const a = wantRate(subset); return { v: a, txt: Math.round(a) + "%" }; }
    if (metric.kind === "slider") { const a = sliderStats(metric.id, subset).avg; return { v: a, txt: a.toFixed(0) + "%" }; }
    return { v: 0, txt: "-" };
  }
  function renderCompare() {
    const metric = CMP_METRICS.find((m) => m.id === cmpMetric) || CMP_METRICS[0];
    const cohorts = cohortOrder(ALL);
    const years = yearOrder(ALL);

    // 응답 수 by cohort & year (always shown)
    const cohortCounts = cohorts.map((c) => ({ k: c, n: ALL.filter((r) => getCohort(r) === c).length }));
    const yearCounts = years.map((y) => ({ k: y, n: ALL.filter((r) => getYear(r) === y).length }));
    const ccMax = Math.max(1, ...cohortCounts.map((x) => x.n));
    const ycMax = Math.max(1, ...yearCounts.map((x) => x.n));

    // selected metric by cohort & year
    const cohortMetric = cohorts.map((c) => ({ k: c, m: groupMetric(ALL.filter((r) => getCohort(r) === c), metric), n: ALL.filter((r) => getCohort(r) === c).length }));
    const yearMetric = years.map((y) => ({ k: y, m: groupMetric(ALL.filter((r) => getYear(r) === y), metric), n: ALL.filter((r) => getYear(r) === y).length }));
    const metMax = metric.kind === "count" ? Math.max(1, ...cohortMetric.map((x) => x.m.v), ...yearMetric.map((x) => x.m.v)) : (metric.max || 5);

    const sel = '<select id="cmpMetric">' + CMP_METRICS.map((m) => '<option value="' + m.id + '"' + (m.id === cmpMetric ? " selected" : "") + ">" + esc(m.label) + "</option>").join("") + "</select>";

    const html =
      '<div class="block"><h3>📈 기수별 · 연도별 비교</h3>' +
      '<p class="sub">전체 데이터를 기수와 연도로 나누어 비교합니다. (아래 상세 통계는 필터에 따라 달라집니다)</p>' +
      '<div class="grid2">' +
        '<div><div class="qlabel">기수별 응답 수</div>' + cohortCounts.map((x) => bar(x.k, x.n, ccMax, x.n + "명")).join("") + "</div>" +
        '<div><div class="qlabel">연도별 응답 수</div>' + (yearCounts.length ? yearCounts.map((x) => bar(x.k, x.n, ycMax, x.n + "명")).join("") : '<p class="muted">데이터 없음</p>') + "</div>" +
      "</div>" +
      '<div class="toolbar" style="margin-top:18px">비교 지표: ' + sel + "</div>" +
      '<div class="grid2" style="margin-top:8px">' +
        '<div><div class="qlabel">기수별 ' + esc(metric.label) + "</div>" + cohortMetric.map((x, i) => bar(x.k + " (" + x.n + "명)", x.m.v, metMax, x.m.txt, i === 0 && metric.kind !== "count")).join("") + "</div>" +
        '<div><div class="qlabel">연도별 ' + esc(metric.label) + "</div>" + (yearMetric.length ? yearMetric.map((x) => bar(x.k + " (" + x.n + "명)", x.m.v, metMax, x.m.txt)).join("") : '<p class="muted">데이터 없음</p>') + "</div>" +
      "</div></div>";

    document.getElementById("compare").innerHTML = html;
    const ms = document.getElementById("cmpMetric");
    if (ms) ms.onchange = () => { cmpMetric = ms.value; renderCompare(); };
  }

  /* ---------------- 교차 분석 ---------------- */
  function crossAnalysisHTML() {
    const groupQs = [];
    SCHEMA.forEach((sec) => sec.questions.forEach((q) => { if (q.type === "single") groupQs.push(q); }));
    const metrics = [
      { id: "comp", label: "사전 역량 평균(2번)" },
      { id: "topic_interest", label: "주제 관심도 평균(3번)" },
      { id: "mentoring_topics", label: "멘토링 필요도 평균(7번)" },
      { id: "jobservice_need", label: "취업연계 필요도 평균(8번)" },
    ];
    return '<div class="block"><h3>🔬 교차 분석</h3>' +
      '<p class="sub">그룹별로 평균을 비교합니다. (예: 전공 계열별 사전 역량 차이) — 현재 필터 적용됨</p>' +
      '<div class="toolbar">그룹 기준: <select id="cxGroup">' +
      groupQs.map((q) => '<option value="' + q.id + '">' + esc(q.title.replace(/^\d+\.\s*/, "")) + "</option>").join("") +
      "</select>지표: <select id='cxMetric'>" +
      metrics.map((m) => '<option value="' + m.id + '">' + esc(m.label) + "</option>").join("") +
      '</select></div><div id="cxOut" style="margin-top:16px"></div></div>';
  }
  function crossRender(responses, groupId, metricId) {
    const gq = QIDX[groupId], mq = QIDX[metricId];
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

  /* ---------------- CSV ---------------- */
  function toCSV(responses) {
    const cols = ["응답번호", "기수", "연도", "제출시각", "소요(분)"];
    const getters = [
      (r, i) => i + 1,
      (r) => getCohort(r),
      (r) => getYear(r),
      (r) => (r.meta && r.meta.submittedAt ? new Date(r.meta.submittedAt).toLocaleString("ko-KR") : ""),
      (r) => (r.meta && r.meta.durationSec ? (r.meta.durationSec / 60).toFixed(1) : ""),
    ];
    SCHEMA.forEach((sec) => sec.questions.forEach((q) => {
      if (q.id === "cohort") return; // already covered
      if (q.type === "likert_grid") q.items.forEach((it) => { cols.push(q.id + ":" + it.label); getters.push((r) => { const v = val(r, q.id); return v && v[it.id] != null ? v[it.id] : ""; }); });
      else if (q.type === "rank") { for (let s = 0; s < q.slots; s++) { cols.push(q.title + " " + (s + 1) + "순위"); getters.push((r) => { const v = val(r, q.id); return Array.isArray(v) ? (v[s] || "") : ""; }); } }
      else if (q.type === "multi") { cols.push(q.title); getters.push((r) => { const v = val(r, q.id); return Array.isArray(v) ? v.join(" | ") : ""; }); }
      else { cols.push(q.title); getters.push((r) => { const v = val(r, q.id); return v == null ? "" : v; }); }
    }));
    const qq = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const lines = [cols.map(qq).join(",")];
    responses.forEach((r, i) => lines.push(getters.map((g) => qq(g(r, i))).join(",")));
    return "﻿" + lines.join("\r\n");
  }
  function downloadCSV(responses) {
    const blob = new Blob([toCSV(responses)], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "배터리아카데미_수요조사_" + new Date().toISOString().slice(0, 10) + ".csv";
    a.click();
  }

  /* ---------------- 상세 통계 (필터 적용) ---------------- */
  function currentSubset() {
    return ALL.filter((r) => (fCohort === "ALL" || getCohort(r) === fCohort) && (fYear === "ALL" || String(getYear(r)) === String(fYear)));
  }
  function kpi(num, lab) { return '<div class="kpi"><div class="num">' + esc(num) + '</div><div class="lab">' + esc(lab) + "</div></div>"; }
  function renderDetail(subset) {
    const n = subset.length;
    const filterLabel = (fCohort === "ALL" ? "전체 기수" : fCohort) + " · " + (fYear === "ALL" ? "전체 연도" : fYear + "년");
    if (n === 0) {
      document.getElementById("detail").innerHTML = '<div class="block center"><p class="muted">선택한 조건(' + esc(filterLabel) + ')에 해당하는 응답이 없습니다.</p></div>';
      return;
    }
    const durs = subset.map((r) => r.meta && r.meta.durationSec).filter((x) => x);
    const avgDur = durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length / 60) : "—";
    let html = '<div class="block" style="background:var(--brand-soft);border-color:#cfe0ff"><b>상세 통계 기준:</b> ' + esc(filterLabel) + "</div>";
    html += '<div class="kpis">' + kpi(n, "응답 수") + kpi(avgDur, "평균 소요(분)") + kpi(Math.round(wantRate(subset)) + "%", "멘토링 참여희망") + "</div>";
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
    html += crossAnalysisHTML();
    document.getElementById("detail").innerHTML = html;
    bindCross(subset);
  }

  /* ---------------- main ---------------- */
  function render(all) {
    ALL = all;
    let html = '<div class="toolbar" style="justify-content:flex-end;margin-bottom:14px">' +
      '<button id="reloadBtn">↻ 새로고침</button><button id="csvBtn">⬇ 전체 CSV 내보내기</button><button id="logoutBtn">로그아웃</button></div>';
    if (all.length === 0) {
      html += '<div class="block center"><div class="big-emoji">🗂️</div><h3>아직 제출된 응답이 없습니다</h3>' +
        '<p class="muted">설문(또는 기수별 링크)을 공유한 뒤 응답이 들어오면 이곳에 통계가 표시됩니다.</p></div>';
      root.innerHTML = html; bindTop(); return;
    }
    const cohorts = cohortOrder(all), years = yearOrder(all);
    html += '<div class="block"><div class="toolbar">' +
      '<b>필터</b> 기수: <select id="fCohort"><option value="ALL">전체</option>' +
      cohorts.map((c) => '<option value="' + esc(c) + '">' + esc(c) + "</option>").join("") + "</select>" +
      ' 연도: <select id="fYear"><option value="ALL">전체</option>' +
      years.map((y) => '<option value="' + esc(y) + '">' + esc(y) + "</option>").join("") + "</select>" +
      '<span class="seg">총 ' + all.length + "명 응답</span></div></div>";
    html += '<div id="compare"></div><div id="detail"></div>';
    root.innerHTML = html;
    bindTop();
    const fc = document.getElementById("fCohort"), fy = document.getElementById("fYear");
    fc.onchange = () => { fCohort = fc.value; renderDetail(currentSubset()); };
    fy.onchange = () => { fYear = fy.value; renderDetail(currentSubset()); };
    renderCompare();
    renderDetail(currentSubset());
  }
  function bindTop() {
    const rb = document.getElementById("reloadBtn"); if (rb) rb.onclick = () => load(sessionStorage.getItem(KEY_STORE));
    const cb = document.getElementById("csvBtn"); if (cb) cb.onclick = () => downloadCSV(ALL);
    const lo = document.getElementById("logoutBtn"); if (lo) lo.onclick = () => { sessionStorage.removeItem(KEY_STORE); loginScreen(); };
  }

  const saved = sessionStorage.getItem(KEY_STORE);
  if (saved) load(saved); else loginScreen();
})();

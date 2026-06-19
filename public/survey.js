/* 배터리아카데미 교육 수요조사 - 설문 진행 로직 */
(function () {
  const SCHEMA = window.SURVEY_SCHEMA;
  const META = window.SURVEY_META;
  const DRAFT_KEY = "battery_survey_draft_v1";

  const screen = document.getElementById("screen");
  const savedTag = document.getElementById("savedTag");
  const progBar = document.getElementById("progBar");
  const progText = document.getElementById("progText");
  const progFill = document.getElementById("progFill");
  const progLabel = document.getElementById("progLabel");
  const progPct = document.getElementById("progPct");
  document.getElementById("subtitle").textContent = META.subtitle;

  // step: -1 intro, 0..n-1 sections, n done
  let step = -1;
  let answers = {};
  let startedAt = null;
  let chosenYear = null; // 링크 미지정 시 시작화면에서 고른 연도

  // restore draft
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    if (d && d.answers) {
      answers = d.answers;
      startedAt = d.startedAt || null;
      chosenYear = d.chosenYear || null;
      if (typeof d.step === "number") step = d.step;
    }
  } catch (e) {}

  // 기수별 접근 주소: ?cohort=3기  또는  ?c=3  (지정 시 해당 기수로 자동 고정)
  // 연도(연차)도 함께 지정 가능: ?c=3기&y=2026
  let lockedCohort = null;
  let lockedYear = null;
  (function () {
    const params = new URLSearchParams(location.search);
    let raw = params.get("cohort") || params.get("c");
    if (raw) {
      raw = decodeURIComponent(raw).trim();
      const list = window.SURVEY_COHORTS || [];
      const match = list.find((c) => c === raw || c === raw + "기" || c.replace(/기$/, "") === raw);
      if (match) { lockedCohort = match; answers.cohort = match; }
    }
    const y = params.get("year") || params.get("y");
    if (y && /^\d{4}$/.test(y.trim())) lockedYear = parseInt(y.trim(), 10);
  })();

  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ answers, step, startedAt, chosenYear }));
      flashSaved();
    } catch (e) {}
  }
  let savedTimer;
  function flashSaved() {
    savedTag.textContent = "✓ 자동 저장됨";
    savedTag.style.opacity = "1";
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => (savedTag.style.opacity = "0"), 1500);
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  /* ---------- progress ---------- */
  function updateProgress() {
    if (step < 0 || step >= SCHEMA.length) {
      progBar.style.display = "none";
      progText.style.display = "none";
      return;
    }
    progBar.style.display = "block";
    progText.style.display = "flex";
    const pct = Math.round(((step) / SCHEMA.length) * 100);
    progFill.style.width = pct + "%";
    progLabel.textContent = "섹션 " + (step + 1) + " / " + SCHEMA.length + " · " + SCHEMA[step].title.replace(/^\d+\.\s*/, "");
    progPct.textContent = pct + "%";
  }

  /* ---------- renderers ---------- */
  function qHeader(q) {
    return (
      '<p class="q-title">' + esc(q.title) + (q.required ? '<span class="req">*</span>' : "") + "</p>" +
      (q.help ? '<p class="q-help">' + esc(q.help) + "</p>" : "")
    );
  }

  function renderSingle(q) {
    const cur = answers[q.id];
    return (
      '<div class="opts">' +
      q.options
        .map((o, i) => {
          const sel = cur === o;
          return (
            '<label class="opt' + (sel ? " sel" : "") + '">' +
            '<input type="radio" name="' + q.id + '" value="' + esc(o) + '"' + (sel ? " checked" : "") + ">" +
            '<span class="ox">' + esc(o) + "</span></label>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function renderMulti(q) {
    const cur = answers[q.id] || [];
    const maxNote = q.max ? '<p class="q-help">최대 ' + q.max + "개까지 선택할 수 있습니다.</p>" : "";
    return (
      maxNote +
      '<div class="opts">' +
      q.options
        .map((o) => {
          const sel = cur.includes(o);
          return (
            '<label class="opt' + (sel ? " sel" : "") + '">' +
            '<input type="checkbox" name="' + q.id + '" value="' + esc(o) + '"' + (sel ? " checked" : "") + ">" +
            '<span class="ox">' + esc(o) + "</span></label>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function renderGrid(q) {
    const cur = answers[q.id] || {};
    const scaleKeys = Object.keys(q.scale);
    const minK = scaleKeys[0], maxK = scaleKeys[scaleKeys.length - 1];
    const legend = '<p class="grid-legend">📊 ' + minK + " = " + esc(q.scale[minK]) + "  ~  " + maxK + " = " + esc(q.scale[maxK]) + "<br>숫자를 눌러 선택하세요. (가운데로 갈수록 중간 정도)</p>";
    return (
      legend +
      q.items
        .map((it) => {
          const v = cur[it.id];
          return (
            '<div class="grid-row" data-item="' + it.id + '">' +
            '<div class="grid-label">' + esc(it.label) + "</div>" +
            '<div class="scale">' +
            scaleKeys
              .map((k) => {
                const sel = String(v) === String(k);
                return (
                  '<label class="' + (sel ? "sel" : "") + '">' +
                  '<input type="radio" name="' + q.id + "_" + it.id + '" value="' + k + '"' + (sel ? " checked" : "") + ">" +
                  '<span class="num">' + k + "</span>" +
                  '<span class="lab">' + esc(q.scale[k]) + "</span></label>"
                );
              })
              .join("") +
            "</div></div>"
          );
        })
        .join("")
    );
  }

  function renderSlider(q) {
    const v = q.id in answers ? answers[q.id] : q.default;
    return (
      '<div class="slider-wrap">' +
      '<div class="slider-val"><span id="sv_' + q.id + '">' + v + "</span> " + esc(q.unit || "") + "</div>" +
      '<input type="range" min="' + q.min + '" max="' + q.max + '" step="' + (q.step || 1) + '" value="' + v + '" name="' + q.id + '">' +
      '<div class="slider-ends"><span>' + esc(q.minLabel || q.min) + "</span><span>" + esc(q.maxLabel || q.max) + "</span></div>" +
      "</div>"
    );
  }

  function renderRank(q) {
    const cur = answers[q.id] || [];
    const labels = ["1순위", "2순위", "3순위", "4순위", "5순위"];
    let html = "";
    for (let s = 0; s < q.slots; s++) {
      const v = cur[s] || "";
      html +=
        '<div class="rank-row"><span class="rank-badge">' + labels[s] + "</span>" +
        '<select name="' + q.id + '_' + s + '" data-slot="' + s + '">' +
        '<option value="">— 선택 —</option>' +
        q.options.map((o) => '<option value="' + esc(o) + '"' + (v === o ? " selected" : "") + ">" + esc(o) + "</option>").join("") +
        "</select></div>";
    }
    return html;
  }

  function renderText(q) {
    const v = answers[q.id] || "";
    if (q.type === "textarea")
      return '<textarea name="' + q.id + '" placeholder="' + esc(q.placeholder || "") + '">' + esc(v) + "</textarea>";
    return '<input type="text" name="' + q.id + '" value="' + esc(v) + '" placeholder="' + esc(q.placeholder || "") + '">';
  }

  function renderQuestion(q) {
    let body = "";
    switch (q.type) {
      case "single": body = renderSingle(q); break;
      case "multi": body = renderMulti(q); break;
      case "likert_grid": body = renderGrid(q); break;
      case "slider": body = renderSlider(q); break;
      case "rank": body = renderRank(q); break;
      case "text":
      case "textarea": body = renderText(q); break;
    }
    return '<div class="q" id="q_' + q.id + '" data-qid="' + q.id + '" data-type="' + q.type + '">' + qHeader(q) + body + "</div>";
  }

  /* ---------- screens ---------- */
  function renderIntro() {
    const secList = SCHEMA.map((s) => '<div>· <b>' + esc(s.title) + "</b></div>").join("");
    let headBlock, selBlock = "";
    if (lockedCohort) {
      headBlock = '<p style="font-size:15px;color:var(--brand-dark);font-weight:700;margin:6px 0">📌 ' +
        esc(lockedCohort) + (lockedYear ? " · " + lockedYear + "년" : "") + " 교육생 전용</p>";
    } else {
      headBlock = '<p style="font-size:13.5px;color:var(--muted);margin:6px 0">아래에서 본인의 기수와 연도를 선택한 뒤 시작해 주세요.</p>';
      const nowY = new Date().getFullYear();
      const yrs = [nowY - 1, nowY, nowY + 1];
      const cohortOpts = (window.SURVEY_COHORTS || []).map((c) => '<option value="' + esc(c) + '"' + (answers.cohort === c ? " selected" : "") + ">" + esc(c) + "</option>").join("");
      const yearOpts = yrs.map((y) => '<option value="' + y + '"' + ((chosenYear || nowY) === y ? " selected" : "") + ">" + y + "년</option>").join("");
      selBlock =
        '<div style="text-align:left;background:var(--brand-soft);border-radius:12px;padding:14px 16px;margin:12px 0">' +
        '<p style="font-weight:700;margin:0 0 8px">기수 · 연도 선택 <span style="color:var(--brand)">*</span></p>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
        '<select id="introCohort" style="flex:1;min-width:130px;padding:12px;border:1.5px solid var(--line);border-radius:10px;font-size:16px;background:#fff"><option value="">기수 선택</option>' + cohortOpts + "</select>" +
        '<select id="introYear" style="flex:1;min-width:130px;padding:12px;border:1.5px solid var(--line);border-radius:10px;font-size:16px;background:#fff">' + yearOpts + "</select>" +
        "</div>" +
        '<p id="introSelErr" style="color:var(--warn);font-size:13px;margin:8px 0 0;display:none">⚠ 기수를 선택해 주세요.</p></div>';
    }
    screen.innerHTML =
      '<div class="card center">' +
      '<div class="big-emoji">🔋</div>' +
      '<h2 class="sec-title">' + esc(META.title) + "</h2>" +
      headBlock +
      '<div><span class="pill">⏱ 약 45~60분</span><span class="pill">🔒 익명 응답</span><span class="pill">💾 자동 임시저장</span></div>' +
      '<p class="lead">' + esc(META.intro) + "</p>" +
      selBlock +
      '<div class="toc">' + secList + "</div>" +
      '<div class="nav"><button class="btn btn-primary" id="startBtn">설문 시작하기</button></div>' +
      (hasDraftProgress() ? '<p class="hint">이전에 작성하던 내용이 저장되어 있어 이어서 진행됩니다.</p>' : "") +
      "</div>";
    document.getElementById("startBtn").onclick = () => {
      if (!lockedCohort) {
        const cs = document.getElementById("introCohort");
        const ys = document.getElementById("introYear");
        if (!cs.value) { document.getElementById("introSelErr").style.display = "block"; cs.focus(); return; }
        answers.cohort = cs.value;
        chosenYear = parseInt(ys.value, 10);
      }
      if (!startedAt) startedAt = Date.now();
      if (step < 0) step = 0;
      saveDraft();
      go(Math.max(step, 0));
    };
    updateProgress();
  }

  function hasDraftProgress() {
    return Object.keys(answers).length > 0;
  }

  function renderSection(i) {
    const sec = SCHEMA[i];
    const qhtml = sec.questions.map(renderQuestion).join("");
    const isLast = i === SCHEMA.length - 1;
    screen.innerHTML =
      '<div class="card">' +
      '<h2 class="sec-title">' + esc(sec.title) + "</h2>" +
      (sec.desc ? '<p class="sec-desc">' + esc(sec.desc) + "</p>" : "") +
      qhtml +
      '<div class="nav">' +
      '<button class="btn btn-ghost" id="prevBtn">' + (i === 0 ? "처음으로" : "이전") + "</button>" +
      '<button class="btn btn-primary" id="nextBtn">' + (isLast ? "제출하기" : "다음") + "</button>" +
      "</div>" +
      '<p class="hint">답을 선택하면 자동으로 저장됩니다.</p>' +
      "</div>";

    bindSectionEvents(sec);
    document.getElementById("prevBtn").onclick = () => go(i === 0 ? -1 : i - 1);
    document.getElementById("nextBtn").onclick = () => {
      if (!validateSection(sec)) return;
      if (isLast) submit();
      else go(i + 1);
    };
    updateProgress();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function bindSectionEvents(sec) {
    sec.questions.forEach((q) => {
      const el = document.getElementById("q_" + q.id);
      if (q.type === "single") {
        el.querySelectorAll('input[type=radio]').forEach((inp) =>
          inp.addEventListener("change", () => {
            answers[q.id] = inp.value;
            refreshOptStyles(el);
            saveDraft();
          })
        );
      } else if (q.type === "multi") {
        el.querySelectorAll('input[type=checkbox]').forEach((inp) =>
          inp.addEventListener("change", () => {
            let arr = answers[q.id] || [];
            if (inp.checked) {
              if (q.max && arr.length >= q.max) {
                inp.checked = false;
                alert("최대 " + q.max + "개까지 선택할 수 있습니다.");
                return;
              }
              arr = arr.concat([inp.value]);
            } else {
              arr = arr.filter((x) => x !== inp.value);
            }
            answers[q.id] = arr;
            refreshOptStyles(el);
            saveDraft();
          })
        );
      } else if (q.type === "likert_grid") {
        el.querySelectorAll(".grid-row").forEach((row) => {
          const itemId = row.getAttribute("data-item");
          row.querySelectorAll('input[type=radio]').forEach((inp) =>
            inp.addEventListener("change", () => {
              answers[q.id] = answers[q.id] || {};
              answers[q.id][itemId] = Number(inp.value);
              row.querySelectorAll(".scale label").forEach((l) => l.classList.remove("sel"));
              inp.closest("label").classList.add("sel");
              saveDraft();
            })
          );
        });
      } else if (q.type === "slider") {
        const inp = el.querySelector('input[type=range]');
        const out = document.getElementById("sv_" + q.id);
        if (!(q.id in answers)) answers[q.id] = Number(inp.value);
        inp.addEventListener("input", () => {
          out.textContent = inp.value;
          answers[q.id] = Number(inp.value);
        });
        inp.addEventListener("change", saveDraft);
      } else if (q.type === "rank") {
        const rankSelects = el.querySelectorAll("select");
        // 이미 다른 순위에서 고른 항목은 나머지 드롭다운에서 선택 불가(비활성)로 만들어 중복 방지
        const refreshRankOptions = () => {
          const chosen = Array.from(rankSelects).map((s) => s.value).filter((v) => v);
          rankSelects.forEach((s) => {
            Array.from(s.options).forEach((opt) => {
              if (opt.value === "") return; // "— 선택 —" placeholder는 유지
              opt.disabled = chosen.includes(opt.value) && opt.value !== s.value;
            });
          });
        };
        rankSelects.forEach((sel2) =>
          sel2.addEventListener("change", () => {
            const arr = [];
            rankSelects.forEach((s) => arr.push(s.value));
            answers[q.id] = arr;
            refreshRankOptions();
            saveDraft();
          })
        );
        refreshRankOptions(); // 초안 복원 등 초기 상태에도 즉시 적용
      } else if (q.type === "text" || q.type === "textarea") {
        const inp = el.querySelector("textarea,input");
        inp.addEventListener("input", () => {
          answers[q.id] = inp.value;
        });
        inp.addEventListener("blur", saveDraft);
      }
    });
  }

  function refreshOptStyles(el) {
    el.querySelectorAll(".opt").forEach((o) => {
      const inp = o.querySelector("input");
      o.classList.toggle("sel", inp.checked);
    });
  }

  /* ---------- validation ---------- */
  function isAnswered(q) {
    const a = answers[q.id];
    switch (q.type) {
      case "single": return !!a;
      case "multi": return Array.isArray(a) && a.length > 0;
      case "slider": return a !== undefined && a !== null;
      case "likert_grid":
        return a && q.items.every((it) => a[it.id] !== undefined);
      case "rank": {
        if (!Array.isArray(a)) return false;
        const filled = a.filter((x) => x);
        return filled.length === q.slots && new Set(filled).size === filled.length;
      }
      case "text":
      case "textarea": return !!(a && a.trim());
      default: return true;
    }
  }

  function validateSection(sec) {
    let firstBad = null;
    sec.questions.forEach((q) => {
      const el = document.getElementById("q_" + q.id);
      el.classList.remove("invalid");
      if (q.required && !isAnswered(q)) {
        el.classList.add("invalid");
        if (!firstBad) firstBad = el;
      }
      // rank duplicate special msg
      if (q.type === "rank" && q.required) {
        const a = answers[q.id] || [];
        const filled = a.filter((x) => x);
        if (filled.length && new Set(filled).size !== filled.length) {
          el.classList.add("invalid");
          if (!firstBad) firstBad = el;
        }
      }
    });
    if (firstBad) {
      firstBad.scrollIntoView({ behavior: "smooth", block: "center" });
      const t = firstBad.querySelector(".q-title");
      const note = firstBad.getAttribute("data-type") === "rank"
        ? "1~3순위를 서로 다른 주제로 모두 선택해 주세요."
        : "필수 문항입니다. 답을 선택해 주세요.";
      let warn = firstBad.querySelector(".inline-warn");
      if (!warn) {
        warn = document.createElement("p");
        warn.className = "q-help inline-warn";
        warn.style.color = "var(--warn)";
        t.after(warn);
      }
      warn.textContent = "⚠ " + note;
      return false;
    }
    return true;
  }

  /* ---------- submit ---------- */
  function go(s) {
    step = s;
    saveDraft();
    if (s < 0) renderIntro();
    else if (s >= SCHEMA.length) renderDone();
    else renderSection(s);
  }

  async function submit() {
    const payload = {
      answers,
      meta: {
        startedAt,
        submittedAt: Date.now(),
        durationSec: startedAt ? Math.round((Date.now() - startedAt) / 1000) : null,
        year: lockedYear || chosenYear || new Date().getFullYear(), // 연차(연도) 구분 기준
        userAgent: navigator.userAgent,
      },
    };
    screen.innerHTML = '<div class="card center"><div class="big-emoji">⏳</div><p class="lead">제출 중입니다...</p></div>';
    try {
      const res = await fetch("api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("server " + res.status);
      localStorage.removeItem(DRAFT_KEY);
      step = SCHEMA.length;
      renderDone();
    } catch (e) {
      screen.innerHTML =
        '<div class="card center"><div class="big-emoji">⚠️</div>' +
        '<h2 class="sec-title">제출에 실패했습니다</h2>' +
        '<p class="lead">네트워크 연결을 확인한 뒤 다시 시도해 주세요. 작성한 내용은 저장되어 있습니다.</p>' +
        '<div class="nav"><button class="btn btn-primary" id="retry">다시 제출</button></div></div>';
      document.getElementById("retry").onclick = submit;
    }
  }

  function renderDone() {
    progBar.style.display = "none";
    progText.style.display = "none";
    screen.innerHTML =
      '<div class="card center"><div class="big-emoji">🎉</div>' +
      '<h2 class="sec-title">응답이 제출되었습니다. 감사합니다!</h2>' +
      '<p class="lead">소중한 의견은 교육과정과 멘토링 프로그램을 설계하는 데 그대로 반영됩니다.\n이 창은 닫으셔도 됩니다.</p></div>';
  }

  /* ---------- start ---------- */
  if (step >= 0 && step < SCHEMA.length) renderSection(step);
  else if (step >= SCHEMA.length) renderIntro();
  else renderIntro();
})();

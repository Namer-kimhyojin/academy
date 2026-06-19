/* ============================================================
 * 배터리아카데미 교육 수요조사 - 백엔드 서버
 *  - 정적 페이지 제공 + 설문 응답 수집 API
 *  - 데이터 저장은 storage.js 가 담당:
 *      DATABASE_URL 있으면 PostgreSQL(Neon 등), 없으면 파일(data/responses.ndjson)
 *  - Render 무료 호스팅 + Neon 무료 DB 조합으로 데이터가 영구 보존됩니다.
 *  - NAS/로컬에서는 DATABASE_URL 없이 그대로 두면 파일 저장(무설치) 모드로 동작합니다.
 * ============================================================ */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const store = require("./storage");

const PORT = parseInt(process.env.PORT || "3000", 10);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "1234";
const PUBLIC_DIR = path.join(__dirname, "public");
const MAX_BODY = 1024 * 1024; // 1MB

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
};

function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({ "Cache-Control": "no-store" }, headers || {}));
  res.end(body);
}
function sendJSON(res, status, obj) {
  send(res, status, JSON.stringify(obj), { "Content-Type": "application/json; charset=utf-8" });
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/" || urlPath === "") urlPath = "/index.html";
  // prevent path traversal
  const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safe);
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, "Forbidden");
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, "Not found");
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, data, { "Content-Type": MIME[ext] || "application/octet-stream" });
  });
}

const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];

  // --- submit a response ---
  if (req.method === "POST" && url === "/api/submit") {
    let body = "";
    let tooBig = false;
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY) { tooBig = true; req.destroy(); }
    });
    req.on("end", async () => {
      if (tooBig) return sendJSON(res, 413, { ok: false, error: "payload too large" });
      let parsed;
      try { parsed = JSON.parse(body); } catch (e) { return sendJSON(res, 400, { ok: false, error: "invalid json" }); }
      if (!parsed || typeof parsed.answers !== "object") return sendJSON(res, 400, { ok: false, error: "missing answers" });
      const record = {
        id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex"),
        answers: parsed.answers,
        meta: Object.assign({}, parsed.meta, { receivedAt: Date.now() }),
      };
      try {
        await store.insert(record);
        sendJSON(res, 200, { ok: true });
      } catch (err) {
        console.error("write error", err);
        sendJSON(res, 500, { ok: false, error: "write failed" });
      }
    });
    return;
  }

  // --- public count ---
  if (req.method === "GET" && url === "/api/count") {
    store.count()
      .then((count) => sendJSON(res, 200, { count }))
      .catch((e) => { console.error("count error", e); sendJSON(res, 500, { error: "read failed" }); });
    return;
  }

  // --- admin: all responses (password protected) ---
  if (req.method === "GET" && url === "/api/responses") {
    const key = req.headers["x-admin-key"] || "";
    if (key !== ADMIN_PASSWORD) return sendJSON(res, 401, { error: "unauthorized" });
    store.all()
      .then((responses) => sendJSON(res, 200, { responses }))
      .catch((e) => { console.error("read error", e); sendJSON(res, 500, { error: "read failed" }); });
    return;
  }

  // --- health check ---
  if (req.method === "GET" && url === "/healthz") return send(res, 200, "ok");

  // --- static files ---
  if (req.method === "GET") return serveStatic(req, res);

  send(res, 405, "Method Not Allowed");
});

// 스토리지 초기화(테이블 생성 등) 후 서버 시작
store.init()
  .then(() => {
    server.listen(PORT, () => {
      console.log("====================================================");
      console.log(" 배터리아카데미 교육 수요조사 서버 실행 중");
      console.log(" 설문 페이지   : http://localhost:" + PORT + "/");
      console.log(" 분석 대시보드 : http://localhost:" + PORT + "/admin.html");
      console.log(" 관리자 비밀번호: " + (process.env.ADMIN_PASSWORD ? "(환경변수로 설정됨)" : "1234 (기본값 — 운영 시 꼭 변경하세요)"));
      console.log(" 저장 방식     : " + store.kind + " → " + store.label);
      console.log("====================================================");
    });
  })
  .catch((err) => {
    console.error("스토리지 초기화 실패:", err);
    process.exit(1);
  });

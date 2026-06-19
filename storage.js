/* ============================================================
 * 스토리지 추상화 계층
 *  - DATABASE_URL 환경변수가 있으면 → PostgreSQL(Neon 등)에 저장
 *  - 없으면                         → 기존처럼 파일(data/responses.ndjson)에 저장
 *
 * 덕분에 Render(무료 DB) 배포와 NAS/로컬 파일 구동을 코드 변경 없이 모두 지원합니다.
 * 파일 모드에서는 외부 패키지(pg)를 전혀 불러오지 않으므로 npm install 없이도 동작합니다.
 * ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");

const DATABASE_URL = process.env.DATABASE_URL || "";

/* ---------- 파일 백엔드 ---------- */
function createFileStore() {
  const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
  const DATA_FILE = path.join(DATA_DIR, "responses.ndjson");

  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "");

  function readAll() {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const out = [];
    raw.split("\n").forEach((line) => {
      line = line.trim();
      if (!line) return;
      try { out.push(JSON.parse(line)); } catch (e) { /* skip corrupt line */ }
    });
    return out;
  }

  function cohortOf(r) { return (r.answers && r.answers.cohort) || "(미기재)"; }
  async function writeAll(list) {
    await fs.promises.writeFile(DATA_FILE, list.map((r) => JSON.stringify(r)).join("\n") + (list.length ? "\n" : ""));
  }

  return {
    kind: "file",
    label: DATA_FILE,
    async init() { /* nothing to do */ },
    async insert(record) {
      await fs.promises.appendFile(DATA_FILE, JSON.stringify(record) + "\n");
    },
    async all() { return readAll(); },
    async count() { return readAll().length; },
    async deleteByIds(ids) {
      const set = new Set(ids || []);
      const all = readAll();
      const kept = all.filter((r) => !set.has(r.id));
      await writeAll(kept);
      return all.length - kept.length;
    },
    async deleteByCohort(cohort) {
      const all = readAll();
      const kept = all.filter((r) => cohortOf(r) !== cohort);
      await writeAll(kept);
      return all.length - kept.length;
    },
  };
}

/* ---------- PostgreSQL 백엔드 ---------- */
function createPgStore() {
  // pg는 DB 모드에서만 lazy-require (파일 모드에서는 설치 불필요)
  const { Pool } = require("pg");
  const pool = new Pool({
    connectionString: DATABASE_URL,
    // Neon/Render 등 관리형 Postgres는 SSL 필요
    ssl: { rejectUnauthorized: false },
  });

  return {
    kind: "postgres",
    label: "PostgreSQL (DATABASE_URL)",
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS responses (
          id           TEXT PRIMARY KEY,
          answers      JSONB NOT NULL,
          meta         JSONB NOT NULL DEFAULT '{}'::jsonb,
          received_at  BIGINT NOT NULL
        );
      `);
      await pool.query(
        "CREATE INDEX IF NOT EXISTS idx_responses_received_at ON responses (received_at);"
      );
    },
    async insert(record) {
      await pool.query(
        "INSERT INTO responses (id, answers, meta, received_at) VALUES ($1, $2, $3, $4)",
        [
          record.id,
          JSON.stringify(record.answers),
          JSON.stringify(record.meta),
          record.meta.receivedAt,
        ]
      );
    },
    async all() {
      const r = await pool.query(
        "SELECT id, answers, meta FROM responses ORDER BY received_at ASC"
      );
      // pg는 jsonb를 자동으로 객체로 파싱하므로 파일 모드와 동일한 형태가 됩니다.
      return r.rows.map((row) => ({ id: row.id, answers: row.answers, meta: row.meta }));
    },
    async count() {
      const r = await pool.query("SELECT COUNT(*)::int AS c FROM responses");
      return r.rows[0].c;
    },
    async deleteByIds(ids) {
      if (!ids || !ids.length) return 0;
      const r = await pool.query("DELETE FROM responses WHERE id = ANY($1)", [ids]);
      return r.rowCount;
    },
    async deleteByCohort(cohort) {
      let r;
      if (cohort === "(미기재)") {
        r = await pool.query("DELETE FROM responses WHERE (answers->>'cohort') IS NULL OR (answers->>'cohort') = ''");
      } else {
        r = await pool.query("DELETE FROM responses WHERE answers->>'cohort' = $1", [cohort]);
      }
      return r.rowCount;
    },
  };
}

const store = DATABASE_URL ? createPgStore() : createFileStore();
module.exports = store;

import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import { logger } from "./logger";

const SALT_ROUNDS = 10;

export interface SimUser {
  id: number;
  username: string;
  passwordPlain: string;
  passwordHash: string;
  role: string;
}

export interface AttemptLog {
  id: number;
  endpoint: string;
  username: string;
  password: string;
  success: boolean;
  timestamp: string;
  attackType: string | null;
  sqlQuery: string;
  explanation: string;
}

const SEED_USERS = [
  { username: "admin", password: "admin123", role: "admin" },
  { username: "alice", password: "letmein", role: "user" },
  { username: "bob", password: "password", role: "user" },
  { username: "carol", password: "qwerty456", role: "moderator" },
];

function detectAttackType(username: string, password: string): string | null {
  const combined = username + " " + password;
  const sqliPatterns = [
    /'\s*(or|and)\s*'?1'?\s*=\s*'?1/i,
    /'\s*--/i,
    /'\s*;\s*(drop|select|insert|update|delete)/i,
    /'\s*(or|and)\s+\d+\s*=\s*\d+/i,
    /union\s+select/i,
    /'\s*or\s*'.*'.*='/i,
    /or\s+1\s*=\s*1/i,
    /--\s*$/,
  ];
  for (const pattern of sqliPatterns) {
    if (pattern.test(combined)) return "sql_injection";
  }
  const brutePatterns = [/^(password|123456|admin|letmein|qwerty|abc123)$/i];
  for (const pattern of brutePatterns) {
    if (pattern.test(password)) return "common_password";
  }
  return null;
}

class SimulatorDB {
  private db: DatabaseSync;
  private rateLimitStore: Map<string, { count: number; resetAt: number }> =
    new Map();
  private readonly RATE_LIMIT = 5;
  private readonly RATE_WINDOW_MS = 60_000;

  constructor() {
    this.db = new DatabaseSync(":memory:");
    this.initialize();
  }

  private initialize() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sim_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_plain TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user'
      );

      CREATE TABLE IF NOT EXISTS attempt_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        endpoint TEXT NOT NULL,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        success INTEGER NOT NULL DEFAULT 0,
        timestamp TEXT NOT NULL,
        attack_type TEXT,
        sql_query TEXT NOT NULL,
        explanation TEXT NOT NULL
      );
    `);

    this.seedUsers();
    logger.info("Simulator DB initialized with seed users");
  }

  private seedUsers() {
    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO sim_users (username, password_plain, password_hash, role)
      VALUES (?, ?, ?, ?)
    `);

    for (const u of SEED_USERS) {
      const hash = bcrypt.hashSync(u.password, SALT_ROUNDS);
      insert.run(u.username, u.password, hash, u.role);
    }
  }

  getUsers(): SimUser[] {
    const rows = this.db
      .prepare(
        "SELECT id, username, password_plain, password_hash, role FROM sim_users"
      )
      .all() as {
      id: number;
      username: string;
      password_plain: string;
      password_hash: string;
      role: string;
    }[];
    return rows.map((r) => ({
      id: r.id,
      username: r.username,
      passwordPlain: r.password_plain,
      passwordHash: r.password_hash,
      role: r.role,
    }));
  }

  getLogs(): AttemptLog[] {
    const rows = this.db
      .prepare(
        `SELECT id, endpoint, username, password, success, timestamp,
          attack_type, sql_query, explanation
         FROM attempt_logs ORDER BY id DESC LIMIT 200`
      )
      .all() as {
      id: number;
      endpoint: string;
      username: string;
      password: string;
      success: number;
      timestamp: string;
      attack_type: string | null;
      sql_query: string;
      explanation: string;
    }[];
    return rows.map((r) => ({
      id: r.id,
      endpoint: r.endpoint,
      username: r.username,
      password: r.password,
      success: r.success === 1,
      timestamp: r.timestamp,
      attackType: r.attack_type,
      sqlQuery: r.sql_query,
      explanation: r.explanation,
    }));
  }

  private logAttempt(
    endpoint: string,
    username: string,
    password: string,
    success: boolean,
    sqlQuery: string,
    explanation: string,
    attackType: string | null
  ) {
    this.db
      .prepare(
        `INSERT INTO attempt_logs (endpoint, username, password, success, timestamp, attack_type, sql_query, explanation)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        endpoint,
        username,
        password,
        success ? 1 : 0,
        new Date().toISOString(),
        attackType ?? null,
        sqlQuery,
        explanation
      );
  }

  vulnerableLogin(
    username: string,
    password: string
  ): {
    success: boolean;
    message: string;
    sqlQuery: string;
    explanation: string;
    attackType: string | null;
  } {
    const sqlQuery = `SELECT * FROM sim_users WHERE username = '${username}' AND password_plain = '${password}'`;
    const attackType = detectAttackType(username, password);

    let rows: unknown[] = [];
    let errorOccurred = false;
    let errorMsg = "";

    try {
      rows = this.db.prepare(sqlQuery).all();
    } catch (err: unknown) {
      errorOccurred = true;
      errorMsg = err instanceof Error ? err.message : String(err);
    }

    const success = !errorOccurred && rows.length > 0;

    let explanation: string;
    if (errorOccurred) {
      explanation = `SQL ERROR: ${errorMsg}\n\nThe query failed due to malformed SQL syntax caused by the injected input. Even a syntax error leaks information — it confirms the database structure and that string concatenation is being used.`;
    } else if (attackType === "sql_injection" && success) {
      explanation = `ATTACK SUCCEEDED: SQL Injection bypassed authentication entirely.\n\nThe query was built by concatenating raw user input:\n\n  "SELECT * FROM sim_users WHERE username = '" + username + "' AND password_plain = '" + password + "'"\n\nThe injected payload broke out of the string literal and rewrote the WHERE clause logic, making the condition always TRUE. This returned ALL rows — the first row was treated as a successful login regardless of the actual password.\n\nCritical: Because passwords are stored as plain text, a database breach would expose every user's real password instantly — no cracking required.`;
    } else if (attackType === "sql_injection" && !success) {
      explanation = `ATTACK ATTEMPTED: The injected SQL was executed verbatim but this specific payload didn't return rows.\n\nThe query was still run unsanitised against the database. Try ' OR '1'='1 as the password to achieve a full authentication bypass.`;
    } else if (success) {
      explanation = `Login succeeded. A matching username/password row was found.\n\nWARNING: The password was stored and compared as PLAIN TEXT. If this database were breached, every user's real password would be immediately exposed — no cracking required.\n\nThe query was built by string concatenation. Any SQL characters in the inputs could rewrite this query entirely.`;
    } else {
      explanation = `Login failed — no matching row found.\n\nWARNING: The query was still built by unsafe string concatenation. Try entering\n  ' OR '1'='1\nas the password to bypass authentication entirely via SQL injection.`;
    }

    this.logAttempt(
      "vulnerable",
      username,
      password,
      success,
      sqlQuery,
      explanation,
      attackType
    );
    return {
      success,
      message: success ? "Login successful" : "Invalid credentials",
      sqlQuery,
      explanation,
      attackType,
    };
  }

  secureLogin(
    ip: string,
    username: string,
    password: string
  ): {
    success: boolean;
    message: string;
    sqlQuery: string;
    explanation: string;
    attackType: string | null;
    rateLimited: boolean;
    attemptsRemaining: number;
  } {
    const now = Date.now();
    let rateInfo = this.rateLimitStore.get(ip);
    if (!rateInfo || now > rateInfo.resetAt) {
      rateInfo = { count: 0, resetAt: now + this.RATE_WINDOW_MS };
      this.rateLimitStore.set(ip, rateInfo);
    }

    const attackType = detectAttackType(username, password);

    if (rateInfo.count >= this.RATE_LIMIT) {
      const secsUntilReset = Math.ceil((rateInfo.resetAt - now) / 1000);
      const sqlQuery = `-- Request BLOCKED by rate limiter before any DB query\n-- Source IP: ${ip}\n-- Attempts this window: ${rateInfo.count}/${this.RATE_LIMIT}\n-- Window resets in: ${secsUntilReset}s`;
      const explanation = `RATE LIMIT EXCEEDED: This IP has made ${rateInfo.count} login attempts in the past 60 seconds (limit: ${this.RATE_LIMIT}).\n\nThe database was never queried. Rate limiting stops brute-force attacks before they reach the database — an attacker trying thousands of passwords per second will be blocked after ${this.RATE_LIMIT} attempts.\n\nThe window resets in ${secsUntilReset} seconds. Real systems often add exponential backoff, CAPTCHA challenges, or account lockouts after this point.`;
      this.logAttempt(
        "secure",
        username,
        password,
        false,
        sqlQuery,
        explanation,
        attackType ?? "brute_force"
      );
      return {
        success: false,
        message: "Too many attempts. Try again later.",
        sqlQuery,
        explanation,
        attackType: attackType ?? "brute_force",
        rateLimited: true,
        attemptsRemaining: 0,
      };
    }

    rateInfo.count++;
    const attemptsRemaining = this.RATE_LIMIT - rateInfo.count;

    const safeUsername = username.replace(/'/g, "''");
    const parameterizedSql = `SELECT id, username, password_hash, role\nFROM sim_users\nWHERE username = ?1\n\n-- Bound parameter: ?1 = '${safeUsername}'\n-- The value is passed separately from the SQL structure.\n-- No amount of SQL in the value can alter the query.`;

    const row = this.db
      .prepare(
        "SELECT id, username, password_hash, role FROM sim_users WHERE username = ?"
      )
      .get(username) as
      | { id: number; username: string; password_hash: string; role: string }
      | undefined;

    let success = false;
    let explanation: string;

    if (!row) {
      explanation = `Authentication failed — no user found with that username.\n\nSQL INJECTION BLOCKED: The query used a bound parameter (?) instead of concatenating the username. No matter what SQL characters appear in the username — quotes, dashes, semicolons, UNION statements — they are treated as a literal string value, not SQL syntax.\n\nThe database driver passes the value separately from the query structure. The SQL engine never sees '${safeUsername}' as code.`;
    } else {
      const passwordMatch = bcrypt.compareSync(password, row.password_hash);
      success = passwordMatch;

      if (attackType === "sql_injection") {
        explanation = `SQL INJECTION BLOCKED by parameterized query.\n\nThe payload was passed as a bound parameter — the database driver escapes it before the SQL engine processes it. The injection string was treated as a literal value, not executable SQL.\n\nQuery structure:  SELECT ... WHERE username = ?\nBound value:      '${safeUsername}'\n\nNo matter what is in the bound value, the query shape cannot change.\n\nPassword result: bcrypt.compareSync(input, hash) → ${passwordMatch}`;
      } else if (success) {
        explanation = `Login succeeded.\n\nAll three security layers active:\n1. PARAMETERIZED QUERY: Username bound as ? — SQL injection is structurally impossible\n2. BCRYPT VERIFICATION: Input compared against stored hash (cost 10). The hash cannot be reversed.\n3. RATE LIMITING: ${attemptsRemaining} attempt(s) remaining in this 60s window\n\nStored hash (first 30 chars): ${row.password_hash.slice(0, 30)}...`;
      } else {
        explanation = `Login failed — incorrect password.\n\nSecurity layers active:\n1. PARAMETERIZED QUERY: '${safeUsername}' is a bound literal — it cannot alter query structure\n2. BCRYPT: bcrypt.compareSync() compared input against the stored hash without ever decrypting it. Bcrypt is one-way.\n3. RATE LIMITING: ${attemptsRemaining} attempt(s) remaining before lockout\n\nNote: bcrypt comparison takes ~100ms by design. This constant-time check mitigates timing-based user enumeration attacks.`;
      }
    }

    this.logAttempt(
      "secure",
      username,
      password,
      success,
      parameterizedSql,
      explanation,
      attackType
    );
    return {
      success,
      message: success ? "Login successful" : "Invalid credentials",
      sqlQuery: parameterizedSql,
      explanation,
      attackType,
      rateLimited: false,
      attemptsRemaining,
    };
  }

  reset() {
    this.db.exec("DELETE FROM attempt_logs");
    this.rateLimitStore.clear();
    logger.info("Simulator reset: logs cleared, rate limits reset");
  }
}

export const simulatorDb = new SimulatorDB();

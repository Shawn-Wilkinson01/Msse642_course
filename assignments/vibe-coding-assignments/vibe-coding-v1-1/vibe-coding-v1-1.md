# Vibe Coding Assignment #1 (v1.1): Authentication Failures — Auth-Explorer

**Course:** MSSE 642 – Software Assurance  
**Authors:** Abdullah Bahir, Emad Fattah, Shawn Wilkinson  
**Date:** May 2026  
**OWASP Category:** A07:2025 — Authentication Failures (with A03:2025 Injection)

---

## Table of Contents

1. [Vibe Coding Tool](#1-vibe-coding-tool)
2. [Program Description](#2-program-description)
3. [The Vulnerability: A07:2025 Authentication Failures](#3-the-vulnerability-a072025-authentication-failures)
4. [Problems and Solutions](#4-problems-and-solutions)
5. [How to Run the App](#5-how-to-run-the-app)

---

## 1. Vibe Coding Tool

**Tool chosen:** [Claude Code](https://claude.ai/code) — Anthropic's AI coding assistant available as a CLI and IDE extension.

I used Claude Code again for v1.1, but with a significantly different scope: instead of generating a single self-contained HTML file, I described a full-stack TypeScript application and let Claude Code scaffold the entire monorepo from scratch. The contrast between what I produced in v1 versus v1.1 with the same tool illustrates just how large the ceiling is.

Key reasons I stayed with Claude Code for this iteration:

- **Workspace-aware generation:** Claude Code reads the existing repo structure and follows established conventions. When I described wanting a pnpm workspace with shared libraries, it generated a `pnpm-workspace.yaml`, proper `tsconfig` project references, and inter-package `workspace:*` dependencies without being told to — it inferred those patterns from context.
- **OpenAPI-first architecture:** I asked for type-safe API contracts and Claude Code built the full code-generation pipeline: an OpenAPI YAML spec → Orval generates React Query hooks and Zod schemas → both the frontend and backend share the same types. This is an industry-standard pattern I would not have set up manually in the time available.
- **Iterative backend refinement:** I described what the vulnerable and secure login endpoints should demonstrate, and Claude Code wrote the `simulator-db.ts` logic — including the intentionally unsafe SQL string concatenation on the vulnerable side, bcrypt comparison on the secure side, and an in-memory rate limiter — then wired it to the route handlers and validated request/response shapes with Zod.
- **Real-time UI without boilerplate:** I described a live log table that auto-refreshes and Claude Code added TanStack Query with a 2-second `refetchInterval`, properly keyed so that login mutations invalidate the log and user queries. Zero manual cache management.

The experience of describing what I wanted the app to *show* — "a side-by-side comparison where the left panel executes raw SQL injection and the right panel blocks it, with the actual SQL query displayed below each form" — and receiving a working implementation demonstrates vibe coding at full resolution. The hard part shifted from knowing how to type things to knowing what to ask for.

---

## 2. Program Description

The deliverable is **Auth-Explorer** — a full-stack interactive security lab that lets a student observe SQL injection in an authentication context in real time, with the actual database query displayed after every login attempt.

### Architecture

| Layer | Technology |
|-------|------------|
| Package manager | pnpm workspaces |
| Language | TypeScript 5.9, Node.js 24 |
| API server | Express 5, port 5000 |
| Database | Node.js `DatabaseSync` (SQLite, in-memory) |
| Password hashing | bcryptjs (cost factor 10) |
| API contract | OpenAPI 3.1 → Orval codegen |
| Frontend | React 18 + Vite, TanStack Query |
| Styling | Tailwind CSS, shadcn/ui |
| Validation | Zod (shared between server and client) |

### What it looks like

The app has a dark terminal aesthetic. The main view has three sections:

**1. Side-by-side login panels**

| Left — VULNERABLE_ENDPOINT | Right — SECURE_ENDPOINT |
|---|---|
| Plaintext password storage | bcrypt hashed passwords |
| Direct SQL string concatenation | Parameterized queries (bound `?`) |
| No rate limiting | 5 attempts per 60-second window |
| SQL injection trivially possible | SQL injection structurally impossible |

Both panels show one-click attack payload buttons (`' OR '1'='1`, `admin'--`, `' OR 1=1--`). After each attempt, the panel displays:

- The exact SQL query that ran against the database (or was blocked)
- A multi-line explanation of why it succeeded or failed
- A detected attack type badge when a known injection signature is found

**2. System Logs (live, polls every 2 seconds)**

A table showing every login attempt across both endpoints: timestamp, endpoint, username, password attempted, result badge (SUCCESS / FAILED / RATE_LIMITED), and detected attack signature.

**3. Database State**

A side-by-side table showing all four seed users with their plaintext passwords in the left column and their bcrypt hashes in the right column. This makes the password storage difference visceral — a student can see `letmein` directly next to `$2b$10$...` and immediately understand what a database breach would expose in each case.

### Seed users

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | admin |
| alice | letmein | user |
| bob | password | user |
| carol | qwerty456 | moderator |

All passwords are pre-loaded into both a plain-text column (used by the vulnerable endpoint) and a bcrypt hash column (used by the secure endpoint), so the Database State table always reflects the difference.

### Why this program

The v1.1 upgrade was motivated by a limitation in v1: everything was client-side JavaScript, so there was no real database, no real SQL, and no real network. The educational payoff was visual but not structural. A student could watch a simulation of SQL injection without ever seeing an actual malformed query executed against an actual database.

Auth-Explorer fixes that. When a student types `' OR '1'='1` into the vulnerable panel and clicks **EXECUTE_PAYLOAD**, the server runs:

```sql
SELECT * FROM sim_users WHERE username = '' OR '1'='1' AND password_plain = '' OR '1'='1'
```

That query executes against a real SQLite database and returns every row. The server logs the exact query string and sends it back to the frontend, where it appears verbatim in a monospace code block. The connection from "I typed a single quote" to "the WHERE clause now matches everyone" is no longer abstract.

---

## 3. The Vulnerability: A07:2025 Authentication Failures

### What Is It?

Auth-Explorer demonstrates two overlapping failure modes that together describe the worst-case authentication implementation:

**1. SQL Injection in authentication (A03:2025 Injection)**

When an application builds a login query by concatenating raw user input, the user controls the SQL syntax. The query:

```sql
SELECT * FROM users WHERE username = '<input>' AND password = '<input>'
```

becomes, with `' OR '1'='1` as the password:

```sql
SELECT * FROM users WHERE username = 'alice' AND password = '' OR '1'='1'
```

The `OR '1'='1'` condition is always true. The WHERE clause now evaluates to true for every row, the query returns the full user table, and the application logs in the first user it finds — often `admin`. No valid password is needed. This is not a theoretical risk: it requires nothing beyond a text field and a browser.

**2. Plaintext password storage (A07:2025 Authentication Failures)**

The vulnerable endpoint's query compares the submitted password against a `password_plain` column — a column that stores the actual password in plain text. This means:

- A successful SQL injection attack immediately reveals every user's real password
- A database backup, a misconfigured S3 bucket, or a single SQL error that leaks query output exposes all credentials instantly — no cracking required
- The stolen passwords work at every other site where the user reused them

The combination makes each failure mode worse. SQL injection provides database read access; plaintext storage makes that read access permanently catastrophic.

### The Secure Countermeasures

The secure endpoint blocks both failure modes at the architecture level:

**Parameterized queries** pass the username as a bound parameter `?` rather than concatenating it into the SQL string. The database driver sends the query structure and the value separately. No matter what characters appear in the value — quotes, semicolons, `UNION SELECT` — they are treated as a literal string by the SQL engine, not syntax. The query shape cannot change.

**bcrypt** is a one-way password hashing function with a tunable cost factor. The server never stores or compares plaintext passwords. At cost 10, each comparison takes ~100ms by design. A database breach exposes only hashes; cracking them requires per-hash GPU time measured in hours to years, not seconds.

**Rate limiting** (5 attempts per 60-second window, tracked per IP) stops brute-force attacks before they reach the database. After the limit, the database is never queried — the request is rejected at the middleware layer.

### Real-World Incidents

**1. Heartland Payment Systems — 2008 (127 million cards)**

SQL injection against Heartland's login page gave attackers initial access to the internal network, where they installed packet sniffers that captured card data in transit. Heartland was PCI-compliant at the time of the breach; SQL injection in the authentication path was the entry point. The breach cost Heartland over $140 million in settlements and fines and remains one of the largest payment card breaches on record.

**2. RockYou — 2009 (32 million passwords in plaintext)**

RockYou, a social gaming platform, stored all 32 million user passwords in a plaintext database column. A SQL injection vulnerability exposed the database, and all passwords were immediately readable with no cracking required. The leaked dataset — known as `rockyou.txt` — became the de facto standard wordlist for password attacks and is included in Kali Linux to this day. It directly enables credential stuffing attacks against any site where users reused their passwords. The combination of SQL injection + plaintext storage is precisely what Auth-Explorer's vulnerable endpoint demonstrates.

**3. LinkedIn — 2012 / 2016 (117 million hashed passwords cracked)**

LinkedIn's 2012 breach exposed 6.5 million password hashes. In 2016, the full 117 million records surfaced. LinkedIn had used SHA-1 without salting — a fast, unsalted hash that could be cracked en masse using precomputed rainbow tables and GPU rigs. The majority of hashes were reversed within days. This illustrates why bcrypt (slow, salted by design) is specifically required — a fast hash is only marginally better than plaintext against an attacker with a modern GPU cluster.

### What These Incidents Share

All three breaches began with a failure to treat authentication as a security boundary. SQL injection provided the opening; weak or absent password hashing converted database access into long-term credential compromise. The fixes are not novel: parameterized queries have been standard practice since the 1990s, and bcrypt has been the recommended password hashing algorithm since 1999. The cost of applying them is negligible. The cost of not applying them, as these three incidents show, is measured in hundreds of millions of dollars and hundreds of millions of affected users.

---

## 4. Problems and Solutions

### Problem 1: Making the SQL query visible without over-engineering the backend

**Issue:** The core educational moment is seeing the exact SQL string that ran. But returning the raw query in an API response raises an obvious question: isn't displaying SQL queries a security anti-pattern? In a real app, query details in API responses could help an attacker fingerprint the database schema.

**Solution:** The simulator is an intentional educational sandbox. The `simulatorDb` module builds both the query string for display and the actual prepared statement separately — the vulnerable endpoint runs the interpolated string through `DatabaseSync.prepare()` directly, while the secure endpoint uses `?` bound parameters for the real query and generates a display-only annotated version (`-- Bound parameter: ?1 = '...'`) for the UI. This distinction makes the "what was actually executed" vs "what an equivalent vulnerable query would look like" contrast explicit and pedagogically accurate.

### Problem 2: The in-memory database resets on server restart

**Issue:** Using `DatabaseSync(":memory:")` means all logs and rate-limit state are lost when the server process restarts. For a persistent demo, this is a limitation.

**Solution:** For an educational simulator, this is actually a feature. The **RESET_ENV** button in the UI calls `DELETE FROM attempt_logs` and clears the rate-limit `Map` explicitly, giving a student a clean slate between experiments without a restart. The fact that a server restart also resets state is consistent with the "this is a sandbox" framing and avoids any disk I/O or database provisioning requirement.

### Problem 3: Getting the rate limiter to show meaningful feedback

**Issue:** A 429 response with no information is correct security behavior on a real site (don't tell an attacker how the limit works), but it's the opposite of educational.

**Solution:** The rate-limited response from the secure endpoint includes the blocked query as an annotated SQL comment (`-- Request BLOCKED by rate limiter before any DB query`) and a detailed explanation of what the rate limiter did, how many attempts have been counted in the current window, and how many seconds remain until the window resets. The response is verbose *by design* — the API is labeled secure not because it hides its behavior but because the behavior itself (rate limiting + parameterized queries + bcrypt) is secure.

### Problem 4: Attack detection false negatives and false positives

**Issue:** The `detectAttackType` function uses regex patterns to label attempts as `sql_injection` or `common_password`. Simple patterns will miss unusual payloads; aggressive patterns will label legitimate typos as attacks.

**Solution:** The detection is explicitly framed as a *signature detector*, not an exhaustive classifier. The UI labels it **Detected signature** rather than "blocked attack." The educational purpose is to show that pattern detection exists — and that the vulnerable endpoint executes the injection whether or not it was detected. The secure endpoint blocks injection whether or not it was detected. Detection is informational; prevention is architectural. This distinction is stated explicitly in the explanation text returned by the secure endpoint.

---

## 5. How to Run the App

### Prerequisites

- Node.js 24+
- pnpm 9+ (`npm install -g pnpm`)

### Setup

```bash
cd auth-explorer-contents/Auth-Explorer

# Install all workspace dependencies
pnpm install

# Build shared libraries (api-zod, api-client-react, db)
pnpm run build
```

### Start the API server

```bash
pnpm --filter @workspace/api-server run dev
# Runs on http://localhost:5000
```

### Start the frontend (separate terminal)

```bash
pnpm --filter @workspace/login-simulator run dev
# Runs on http://localhost:5173
```

Open `http://localhost:5173` in a browser.

### Using the simulator

1. **Vulnerable panel (left):** Type any username and password, or click one of the three attack payload buttons to auto-fill a SQL injection string. Click **EXECUTE_PAYLOAD** and read the SQL query and explanation that appear below.
2. **Secure panel (right):** Try the same payloads. Observe the parameterized query display showing the bound `?1` parameter and the explanation of why the injection was blocked. Click the payload buttons 5 times in a row to trigger the rate limiter.
3. **System Logs:** Watch the live table update in real time as attempts arrive from both panels. The DETECTED_ATTACK column shows the signature label when a known injection pattern is identified.
4. **Database State:** Compare the VULNERABLE DB (PLAINTEXT) column against the SECURE DB (BCRYPT) column for each user to see what a database breach would expose in each implementation.
5. **RESET_ENV:** Click to clear all logs and reset rate limits without restarting the server.

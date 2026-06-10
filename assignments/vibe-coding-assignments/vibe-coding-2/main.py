"""
SQL Injection Demo — OWASP A05:2025 Injection
MSSE 642 — Software Assurance

Educational purposes only. All data is fake.
The vulnerable endpoint is intentionally insecure to demonstrate SQL injection.
"""

import sqlite3
import os
from flask import Flask, request, jsonify, render_template

app = Flask(__name__)
DB_PATH = os.path.join(os.path.dirname(__file__), "demo.db")


# ── Database ──────────────────────────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
        DROP TABLE IF EXISTS users;
        CREATE TABLE users (
            id        INTEGER PRIMARY KEY,
            username  TEXT,
            password  TEXT,
            email     TEXT,
            is_admin  INTEGER
        );
        INSERT INTO users (id, username, password, email, is_admin) VALUES
            (1, 'alice',   'hunter2',      'alice@demo.local',  0),
            (2, 'bob',     'password123',  'bob@demo.local',    0),
            (3, 'carol',   'qwerty456',    'carol@demo.local',  0),
            (4, 'dave',    'letmein99',    'dave@demo.local',   0),
            (5, 'admin',   'S3cr3tAdm!n',  'admin@demo.local',  1);
    """)
    conn.commit()
    conn.close()


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/search/vulnerable")
def search_vulnerable():
    """
    DELIBERATELY VULNERABLE endpoint — string interpolation into SQL.
    DO NOT replicate this pattern in production code.
    """
    q = request.args.get("q", "")
    # ⚠ VULNERABLE: user input concatenated directly into SQL string
    sql = f"SELECT id, username, email, is_admin FROM users WHERE username = '{q}'"
    conn = get_db()
    try:
        rows = conn.execute(sql).fetchall()
        results = [dict(r) for r in rows]
        return jsonify({"sql": sql, "results": results, "error": None})
    except Exception as exc:
        return jsonify({"sql": sql, "results": [], "error": str(exc)})
    finally:
        conn.close()


@app.route("/api/search/secure")
def search_secure():
    """Secure endpoint using a parameterized query."""
    q = request.args.get("q", "")
    # ✅ SECURE: user input passed as a bound parameter, never concatenated
    sql = "SELECT id, username, email, is_admin FROM users WHERE username = ?"
    conn = get_db()
    rows = conn.execute(sql, (q,)).fetchall()
    results = [dict(r) for r in rows]
    conn.close()
    return jsonify({"sql": sql, "parameter": q, "results": results, "error": None})


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    init_db()
    print("Demo DB initialised. Users: alice, bob, carol, dave, admin")
    app.run(host="0.0.0.0", port=8080, debug=True)

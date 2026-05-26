# Vibe Coding Assignment #1: Authentication Failures

**Course:** MSSE 642 – Software Assurance  
**Author:** Shawn Wilkinson  
**Date:** May 2026  
**OWASP Category:** A07:2025 — Authentication Failures

---

## Table of Contents

1. [Vibe Coding Tool](#1-vibe-coding-tool)
2. [Program Description](#2-program-description)
3. [The Vulnerability: A07:2025 Authentication Failures](#3-the-vulnerability-a072025-authentication-failures)
4. [Problems and Solutions](#4-problems-and-solutions)
5. [How to Run the App](#how-to-run-the-app)

---

## 1. Vibe Coding Tool

**Tool chosen:** [Claude Code](https://claude.ai/code) — Anthropic's AI coding assistant available as a CLI and IDE extension.

I chose Claude Code for this assignment for several reasons:

- **Integrated workflow:** Claude Code runs directly in the terminal alongside the project repository, so there is no context-switching between a browser IDE and the local codebase. It sees the existing project structure and follows the same file conventions already established in this repo.
- **Full-stack generation from natural language:** I described the app I wanted—an interactive, split-panel educational tool with four attack simulations, a side-by-side vulnerable/secure comparison, and an in-app explanation panel—and Claude Code generated the complete HTML, CSS, and JavaScript in a single pass. No boilerplate setup, no dependency installation, no deployment pipeline.
- **Iterative refinement:** Claude Code can explain its own output, accept follow-up instructions ("make the attack log auto-scroll," "add session token display for the prediction attack"), and revise specific sections without touching unrelated code. This tight loop closely mirrors the "vibe coding" workflow described in the assignment.
- **Zero infrastructure:** The output is a single self-contained `.html` file. Any grader can open it in a browser with no server, no account, and no API key required.

The experience of describing the desired behavior in plain English and receiving a working, styled, interactive web application in response is a clear demonstration of how modern AI tools have shifted the floor of what a solo developer can produce in a short time.

---

## 2. Program Description

The deliverable is **`app.html`** — a single-file interactive educational web application that teaches four distinct authentication failure attack patterns side-by-side.

### What it looks like

The app has a dark security-tool aesthetic inspired by GitHub's dark mode and terminal environments. At the top is an attack selector with four tabs:

| Tab | Attack Simulated |
|-----|-----------------|
| 🔁 Brute Force | Automated password guessing from a wordlist |
| 👤 Default Credentials | Trying vendor-default login pairs (admin/admin) |
| 🔮 Session Prediction | Exploiting sequential/predictable session tokens |
| 📋 Credential Stuffing | Replaying leaked username/password pairs from breach databases |

The main area is split into two panels:

- **Left panel (red border):** The VULNERABLE implementation — no rate limiting, no lockout, specific error messages that reveal whether a username exists, sequential session tokens, no MFA.
- **Right panel (green border):** The SECURE implementation — rate limiting, account lockout with a live countdown timer, CAPTCHA after 2 failures, MFA prompt on correct password, generic error messages, and cryptographically random session tokens.

Below the panels is an **attack controls section** with a speed slider, a "Run Attack" button, and a live scrolling attack log styled like a terminal. At the bottom is a tabbed **information panel** with four sections per attack type: *What Is It?*, *How It Works*, *Real-World Breach*, and *Prevention*.

### Why this program

The SQL injection demo referenced in the assignment prompted me to build something structurally similar but for authentication. Authentication failures are the highest-traffic vulnerability category in real-world incidents because they directly gate access to everything else in an application. An interactive demo that lets a student *watch* a brute force attack succeed against an unprotected login while simultaneously watching it get stopped cold by lockout and CAPTCHA teaches the same lesson as a paragraph of text — but in a way that sticks.

I also chose this format because it makes the tradeoffs visible. The vulnerable and secure panels are not theoretical — both are live, functional simulations backed by the same in-memory user database. You can manually type `admin` / `admin` into the vulnerable panel and watch it grant access, then try the same credentials in the secure panel and watch them get rejected for failing the 12-character password policy.

---

## 3. The Vulnerability: A07:2025 Authentication Failures

### What Is It?

OWASP A07:2025 — Authentication Failures covers weaknesses in the mechanisms that verify *who* a user is. This includes:

- **Brute force and password spray attacks** — no rate limiting or lockout allows unlimited login attempts
- **Default or weak credentials** — systems that accept `admin/admin` or other factory defaults
- **Session management failures** — predictable session tokens that can be guessed or enumerated
- **Credential stuffing** — replaying real leaked username/password pairs from past breaches
- **Missing multi-factor authentication (MFA)** — single-factor systems that fall entirely if a password is compromised
- **Insecure session handling** — tokens sent over HTTP, stored in `localStorage`, or never expired

### Why It Matters

Authentication is the first line of defense for any application. If an attacker can bypass or subvert authentication, every access control, authorization check, and data protection measure downstream is irrelevant. A07 sits near the top of the OWASP list precisely because authentication failures are both common and catastrophic.

### Recent Real-World Hacks

**1. Snowflake / Ticketmaster / Santander — May–June 2024**

This is the most significant authentication failure incident of 2024. Attackers used **credential stuffing** — replaying username/password pairs stolen from earlier unrelated breaches — against cloud data warehouse accounts at Snowflake. None of the compromised accounts had MFA enabled. The breach affected **165 organizations** that stored data in Snowflake, with Ticketmaster losing 560 million customer records (names, addresses, phone numbers, partial payment data) and Santander Bank exposing employee and customer account information. The entire campaign was preventable: every compromised account lacked a second factor, and the credentials had been available in breach databases for months before the attack.

**2. Microsoft Corporate Email — January 2024**

The Russian state-sponsored group Midnight Blizzard (APT29/Cozy Bear) used a **password spray** attack — a low-volume brute force variant that tries a small number of common passwords across many accounts to avoid lockout detection. They successfully compromised email accounts belonging to Microsoft's senior leadership team, members of the cybersecurity team, and legal staff, and maintained access for months before detection. The attack exploited the absence of MFA on some accounts combined with the use of a legacy authentication protocol that bypassed modern conditional access policies.

**3. Change Healthcare — February 2024**

Attackers gained initial access to Change Healthcare (a UnitedHealth subsidiary) through a Citrix remote access portal using **stolen credentials on an account with no MFA**. This single authentication failure cascaded into the largest healthcare data breach in U.S. history, affecting an estimated 190 million people. Prescription processing for pharmacies nationwide was disrupted for weeks, and the breach exposed sensitive health records including diagnoses, treatment histories, and Social Security numbers.

### What These Incidents Share

All three breaches share a common thread: **valid credentials + no MFA = complete access**. In no case did the attacker need to exploit a complex zero-day vulnerability. They walked through an unlocked door. The RockYou2024 leak (published July 2024, containing 9.9 billion unique plaintext passwords) means attackers have an enormous inventory of credentials to test — making MFA not an optional hardening step but a fundamental requirement for any internet-facing login.

---

## 4. Problems and Solutions

### Problem 1: Balancing realism with safety

**Issue:** An educational tool about authentication attacks could easily be mistaken for or misused as an actual attack tool. I needed the demo to be realistic enough to teach the concepts clearly, but obviously sandboxed.

**Solution:** All "authentication" logic is entirely client-side JavaScript with a hardcoded in-memory user array. There is no server, no network requests, and no real credentials. The app makes this explicit with the "Educational purposes only" footer and the framing that clearly labels everything as a simulation. The app cannot be repurposed to attack a real target because it has no mechanism to direct requests anywhere.

### Problem 2: Making four different attacks feel distinct

**Issue:** Brute force, credential stuffing, and default credentials all involve trying username/password pairs — the visual difference needed to be clear.

**Solution:** Each attack uses a different credential source (wordlist, vendor defaults, breach dump) and a different animation pattern. The credential stuffing simulation shows the breach dump list explicitly so students can see it contains real-looking pairs with one that happens to match. The default credentials simulation pre-fills the form fields so the act of "trying admin/admin" is visually explicit. Session prediction is visually the most different — it focuses on the token display rather than the login form.

### Problem 3: The session prediction attack is abstract

**Issue:** Session hijacking is harder to make visceral than a login attempt, because the "attack" is predicting a number — there's no login involved.

**Solution:** The simulation logs in three times in sequence, displaying the incrementing `session_XXXX` tokens each time, then highlights the pattern and shows the attacker computing and replaying the next token. Showing the secure side's UUID alongside each vulnerable token makes the contrast immediate — a student can see at a glance that `session_1003` is trivially guessable while `a3f8b2c1-4d9e-4f2a-8b3c-1d4e5f6a7b8c` is not.

### Problem 4: Getting the lockout timer right

**Issue:** A lockout that counts down in real time is a meaningful demonstration, but if it's too long (30 real seconds) it interrupts the lesson flow. Too short and it trivializes the protection.

**Solution:** The timer is visible and real (30 seconds) to make the point that the account is genuinely inaccessible — the attacker cannot simply wait a moment and retry. The speed slider lets the student run the attack fast to trigger the lockout quickly, then observe it naturally without speeding anything up.

---

## How to Run the App

Open `app.html` in any modern web browser. No server, installation, or internet connection required.

```
assignments/vibe-coding-assignments/vibe-coding-1/app.html
```

1. Select an attack type from the tabs at the top.
2. Click **Run Attack** to watch the simulation play out in both panels simultaneously.
3. Use the **Speed** slider to control how fast the attack progresses.
4. Read the **Information Panel** tabs at the bottom for context on each attack type.
5. Click **Reset Demo** to start over, then try a different attack type.

You can also interact with both login forms manually — type your own credentials and observe the difference in behavior between the vulnerable and secure implementations.

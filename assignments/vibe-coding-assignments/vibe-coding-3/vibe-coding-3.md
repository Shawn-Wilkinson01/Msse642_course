# Vibe Coding Assignment #3: Security Misconfiguration

**Course:** MSSE 642 – Software Assurance  
**Author:** Shawn Wilkinson  
**Date:** June 2026  
**OWASP Category:** A02:2025 — Security Misconfiguration

---

## Table of Contents

1. [Vibe Coding Tool](#1-vibe-coding-tool)
2. [Program Description](#2-program-description)
3. [The Vulnerability: A02:2025 Security Misconfiguration](#3-the-vulnerability-a022025-security-misconfiguration)
4. [Problems and Solutions](#4-problems-and-solutions)
5. [How to Run the App](#5-how-to-run-the-app)

---

## 1. Vibe Coding Tool

**Tool chosen:** [Claude Code](https://claude.ai/code) — Anthropic's AI coding assistant, available as a CLI and IDE extension.

I chose Claude Code again for this third assignment for the same reasons it worked well in Assignment 1: it operates directly in the terminal alongside the existing repository, produces complete working output from plain-English descriptions, and requires no deployment infrastructure. The deliverable is a single self-contained `.html` file a grader can open in any browser with no setup.

What made Claude Code the right choice specifically for this topic is that Security Misconfiguration is inherently about *configuration* rather than *code logic*. The most effective way to teach it is to show the HTTP response headers, the exposed file contents, and the error pages side by side — and Claude Code generated the full interactive split-panel simulation in a single pass, including five distinct misconfiguration scenarios, all interactive controls, and a four-tab information panel at the bottom with real breach examples and a prevention checklist.

The interaction felt genuinely like vibe coding: I described the layout (tabs across the top, split red/green panels, info section at the bottom), named the five scenarios I wanted to cover, and the tool produced the complete implementation. I then refined specific interactions — the lockout countdown timer on the admin panel, the color-coded scan results for headers, the directory listing file explorer — through follow-up prompts. The back-and-forth felt less like writing code and more like describing a web app to a colleague who then built it.

---

## 2. Program Description

The deliverable is **`app.html`** — a single-file interactive educational tool called **SecMisconfig Inspector**.

The app has five tabs across the top, each demonstrating a different real-world category of Security Misconfiguration. Every tab shows a split panel: the left panel (red border) shows the vulnerable configuration, and the right panel (green border) shows the correct configuration. Interactions are live — clicking a button or entering a URL shows exactly what an attacker would see on each server.

### The Five Scenarios

| Tab | What It Demonstrates |
|-----|---------------------|
| **Security Headers** | Missing HTTP security headers vs. a fully hardened response |
| **Debug Mode** | A production server with `APP_DEBUG=true` exposing credentials in a stack trace vs. a generic 500 page |
| **Directory Listing** | A web server exposing its file structure vs. a 403 Forbidden response |
| **Config Files** | Sensitive files (`.env`, `config.php`, `.git/config`, `phpinfo.php`, `backup.sql`) accessible at predictable URLs vs. 404 for all |
| **Admin Panel** | Default credentials (`admin/admin`) with no lockout vs. rate limiting, CAPTCHA after 3 failures, and a 30-second lockout after 5 |

Below the panels is a tabbed information section covering: *What Is It?*, *How It Works*, *Real-World Breaches*, and *Prevention*.

### Why This Program

Security Misconfiguration is a difficult vulnerability to teach in the abstract because it is not a code pattern — it is the *absence* of correct settings. The typical explanation is a list of things to configure, and that list does not convey the consequences.

The interactive format makes the stakes visible. When a student clicks "Trigger Server Error" on the debug tab, they see a real-looking stack trace with a database password and AWS keys appearing in the browser — the kind of output a misconfigured Laravel application actually generates. When they click "/.env" on the config files tab, they see the entire file served as plain text. The impact is immediate in a way a bullet list never is.

I also wanted the tool to reflect how misconfigurations are actually discovered — not through code review but through automated scanning. The header scanner tab simulates what a tool like OWASP ZAP or securityheaders.com would report. The config files tab simulates a directory buster probing for predictable filenames. The admin panel tab simulates credential stuffing against a default-credential login. The tool teaches the attacker's workflow, not just the defender's checklist.

### Landing Page

![Landing Page — Security Headers Tab](images/01-landing-page.png)

### Security Headers Scan

![Security Headers — Vulnerable vs. Secure](images/02-security-headers.png)

### Debug Mode Error

![Debug Mode — Stack Trace Exposed](images/03-debug-mode.png)

### Directory Listing

![Directory Listing — Files Exposed](images/04-directory-listing.png)

### Config Files Probe

![Config Files — .env Contents Exposed](images/05-config-files.png)

### Admin Panel with Lockout

![Admin Panel — Default Credentials and Lockout](images/06-admin-panel.png)

---

## 3. The Vulnerability: A02:2025 Security Misconfiguration

### What Is It?

OWASP A02:2025 — Security Misconfiguration covers weaknesses that arise not from writing buggy code but from failing to configure software, infrastructure, and services correctly. It ranked #2 in the 2025 OWASP Top 10, moving up from #5 in the 2021 edition, reflecting how dramatically the attack surface has grown with cloud infrastructure, containerization, and software-as-a-service platforms.

Common forms include:

- **Missing HTTP security headers** — no Content-Security-Policy, no HSTS, no X-Frame-Options, allowing clickjacking, protocol downgrade, and MIME-sniffing attacks
- **Debug mode in production** — stack traces, file paths, database credentials, and environment variables exposed in error responses
- **Directory listing enabled** — web server serves a file index for any directory without an index file, exposing database dumps, config files, and backups
- **Sensitive files in the web root** — `.env`, `config.php`, `.git/`, `phpinfo.php`, `*.sql`, `*.bak` files accessible at predictable URLs
- **Default credentials not changed** — admin panels with vendor-default usernames and passwords (`admin/admin`, `root/root`)
- **Unnecessary features enabled** — debug endpoints, phpinfo pages, unused services, open S3 buckets, publicly readable databases
- **Outdated software** — running framework or server versions with known CVEs

### Why It Matters

Security Misconfiguration is unique among the OWASP Top 10 because it does not require a vulnerability in the code itself. A perfectly written application deployed with a misconfigured server, missing security headers, or a world-readable S3 bucket is just as exposed as an application full of SQL injection bugs. Misconfigurations also tend to affect entire environments rather than individual features — a missing security header is missing on every page, not just one.

The growth of cloud infrastructure has made misconfiguration more common, not less. Every cloud provider has dozens of security settings with defaults that prioritize convenience over security. Every new service, container, or database spun up is a potential misconfiguration.

### Recent Real-World Hacks

**1. Toyota Connected — 2013–2023 (Disclosed May 2023)**

Toyota's Connected subsidiary exposed location data, vehicle identification numbers, and GPS tracking history of **2.15 million customers for ten years** due to a cloud storage misconfiguration. A data management system launched in Japan in 2013 had an AWS S3 bucket configured as public instead of private. Anyone who discovered the bucket URL could read the data freely — no authentication, no credentials, no exploit required. Toyota discovered the issue in May 2023 during an internal audit. The data had been publicly accessible since 2013.

This case illustrates how Security Misconfiguration can be silent for years. No alarm fires when an S3 bucket is set to public. The misconfiguration was a single checkbox, and its consequence was a decade of exposure.

**2. Microsoft Power Apps Portals — 2021**

Microsoft Power Apps portals have a setting that controls whether the data they serve is publicly accessible or requires authentication. The default was *public*. Developers at 47 organizations — including American Airlines, Ford Motor Company, Indiana Department of Health, and the New York City Metropolitan Transportation Authority — used the platform to build portals without realizing their data was public by default.

The result: **38 million records** exposed, including COVID-19 vaccination and testing status, Social Security numbers, employee home addresses, and contract details. The breach was discovered by security researcher Evan Andersen, who reported it to Microsoft. Microsoft subsequently changed the default to private and notified affected customers.

The core issue was a *default-open* configuration in a widely used platform — a pattern OWASP A02 specifically calls out.

**3. Twitch Source Code Leak — October 2021**

An anonymous attacker published **125 GB of Twitch's internal data** on 4chan, including the complete platform source code, internal security tooling, and streamer payout records dating back to 2019. The attacker described the motivation as wanting to "foster more disruption and competition in the online video streaming space."

The breach exploited a server misconfiguration that left internal Git repositories accessible to unauthorized users. The leaked repositories themselves contained credentials and API keys committed directly to version control — a second layer of misconfiguration on top of the first. The combination of an exposed Git server and credentials in the repository gave the attacker both the source code and the keys to the infrastructure.

### What These Incidents Share

None of these breaches required a zero-day exploit or a sophisticated attack chain. In all three cases, the data was accessible with no credentials or with credentials that were never changed from their defaults. The Toyota and Power Apps breaches required no hacking at all — the data was simply sitting at a public URL. Twitch required finding a misconfigured server, which automated scanners do in minutes.

---

## 4. Problems and Solutions

### Problem 1: Making five scenarios feel distinct without becoming repetitive

**Issue:** All five scenarios involve a "vulnerable" and "secure" configuration side by side. Without careful design, they could feel like the same page with different text, causing students to stop engaging after the first or second tab.

**Solution:** Each scenario has a different interaction model. The headers tab runs a passive scan and shows a scored report. The debug tab simulates triggering an error and shows the crash output. The directory listing tab lets students browse a file tree. The config files tab has a URL bar where they can type any path or use quick-access buttons. The admin panel is an interactive login form with stateful lockout behavior. The interaction type matches the attack type — passive reconnaissance for headers, active probing for config files, authentication attack for the admin panel.

### Problem 2: The lockout timer needed to be real without being annoying

**Issue:** A lockout countdown that runs in real time is a meaningful demonstration — the student can see that the account is genuinely inaccessible and can watch the timer. But if it runs for a realistic 15–30 minutes, it kills the lesson flow.

**Solution:** The timer runs for 30 seconds — long enough to be real and to make the point, short enough to watch happen during a class exercise. The counter is visible in the message text and updates every second. I also added a message noting that "further attempts are logged," which communicates that real lockouts are not just about denying access but about detection.

### Problem 3: Balancing realistic-looking output with responsible content

**Issue:** The debug mode and config file tabs show what look like real credentials and API keys to make the demonstration impactful. This content could cause confusion about whether the keys are real or could be mistaken for actual secrets.

**Solution:** Every credential-looking value in the app is either explicitly documented as an example (AWS uses `AKIAIOSFODNN7EXAMPLE` in their own documentation), uses an obviously fictional domain (`db-prod-01.internal`, `example.com`), or is structured to be clearly illustrative (a Stripe live key starting with `sk_live_51ABCDEexample`). The app also displays a persistent banner at the top — "Educational purposes only — all simulations run entirely in the browser" — and all connections go nowhere (the app has no network functionality).

### Problem 4: Communicating the attacker's workflow, not just the defender's checklist

**Issue:** Security Misconfiguration is often taught as a list of things to fix. That framing puts students in a purely defensive mindset, which makes it harder to understand why these misconfigurations matter — the consequence feels abstract.

**Solution:** The "How It Works" tab in the information panel describes the attacker's workflow: discover, probe, extract, escalate. It names the actual tools attackers use (gobuster, ffuf, Shodan, OWASP ZAP) and describes what they find. The directory listing and config file tabs simulate the probing phase directly — a student using the tool is doing approximately what a directory buster does. The admin panel tab simulates what happens after an automated credential sprayer finds the login form. Framing the simulation around the attack chain makes the defensive measures feel like responses to real threats rather than a compliance checklist.

---

## 5. How to Run the App

Open `app.html` in any modern web browser. No server, no installation, no internet connection required.

```
assignments/vibe-coding-assignments/vibe-coding-3/app.html
```

1. **Security Headers tab:** Click "Scan Headers" to see a side-by-side comparison of a server with no security headers vs. a properly configured one.
2. **Debug Mode tab:** Click "Trigger Server Error" to see the difference between a stack trace with credentials and a generic error page.
3. **Directory Listing tab:** Click "Browse /", "/uploads", or "/admin" to explore what an attacker finds when directory listing is on.
4. **Config Files tab:** Use the quick-target buttons or type a path and click GET to see sensitive files served on the vulnerable server vs. 404 on the secure server.
5. **Admin Panel tab:** Type `admin` / `admin` in both panels. The vulnerable panel grants access immediately. The secure panel enforces complexity requirements, shows a CAPTCHA after 3 attempts, and locks for 30 seconds after 5 attempts.

Use the information panel tabs at the bottom for context on the vulnerability, the attack workflow, real breaches, and the prevention checklist.

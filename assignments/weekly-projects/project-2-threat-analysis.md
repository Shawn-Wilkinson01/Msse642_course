# Assignment #2: Vulnerability Analysis — Hiking Club Threat Model

**Course:** MSSE 642 – Software Assurance  
**Authors:** Abdullah Bahir, Emad Fattah, Shawn Wilkinson  
**Date:** May 2026

---

## Table of Contents

1. [Part 1 — Secure Design Document](#part-1--secure-design-document)
   - [Project Description](#1-project-description)
   - [Organization Description](#2-organization-description)
   - [Deployment Environment](#3-deployment-environment)
   - [Security Concepts Overview](#4-security-concepts-overview)
2. [Part 2A — Architecture Diagram](#part-2a--architecture-diagram)
3. [Part 2B — STRIDE Threat Model](#part-2b--stride-threat-model)
4. [Part 2C — OWASP Threat Model](#part-2c--owasp-threat-model)

---

## Part 1 — Secure Design Document

### 1. Project Description

The Hiking Club Application is a browser-based platform that enables a recreational hiking club to manage its membership, coordinate trip events, and process financial transactions for paid outings. Unauthenticated guests can browse the public trip calendar, while registered members can log in to enroll in events and maintain their own profiles. Trip leaders hold elevated privileges to create and manage events, track participant completion status, and view sensitive member health information relevant to safety decisions in the field. A system administrator oversees account lifecycle management, database integrity verification, and a treasury portal used to collect and disburse trip fees. The application stores three broad categories of sensitive data—personal and medical member information, role-based authentication credentials, and financial transaction records—each of which demands dedicated security controls.

---

### 2. Organization Description

The organization is a community-based recreational hiking club with a volunteer leadership structure. Club officers act as system administrators, and experienced members volunteer as trip leaders who organize and supervise outings. The club collects annual membership dues and per-trip fees through the application's treasury portal, making financial accountability a core operational concern. Because trip leaders have access to members' medical notes and private behavioral records (e.g., no-show history), the club is also a steward of sensitive personal information. The membership base may range from dozens to several hundred active members, and the club's reputation depends on both operational reliability and member privacy protection.

---

### 3. Deployment Environment

The application will be deployed on a cloud Infrastructure-as-a-Service (IaaS) platform such as Amazon Web Services (AWS) or Microsoft Azure. The frontend web server will reside in a public-facing subnet (DMZ) and terminate all HTTPS connections from clients. The backend database server will be isolated in a private subnet with no direct internet route; all database traffic will originate exclusively from the web server. A layered firewall strategy—cloud-managed security groups at the perimeter and a network ACL between the DMZ and private subnet—will enforce traffic restrictions. Database credentials and API keys will be stored in a managed secrets service (e.g., AWS Secrets Manager) rather than in configuration files. Automated daily encrypted backups, centralized structured logging, and cloud-native intrusion detection round out the deployment.

---

### 4. Security Concepts Overview

Several functional areas in the Hiking Club Application introduce security requirements that must be addressed in the threat model:

- **Authentication & Session Management** — Three user roles (Guest, Member, Admin) require verified identity at login, and session tokens must be issued, validated, and expired securely. The treasury portal warrants multi-factor authentication for admin logins.
- **Authorization & Access Control** — Members must access only their own profile data; trip leaders may access sensitive member records only for their own events; system admins control the treasury. Improper role enforcement is the highest-probability failure mode for this application.
- **Sensitive Data Protection** — Medical notes, private behavioral records, and financial transaction history are all personally sensitive. Encryption in transit (TLS 1.3) and at rest (AES-256) are baseline requirements for these fields.
- **Input Validation & Injection Prevention** — The application is a classic web-to-relational-database stack. All user-supplied inputs—search terms, registration fields, profile edits, payment data—are potential injection vectors and must be sanitized server-side.
- **Financial Transaction Security** — The treasury portal collects and disburses real money. PCI-DSS considerations, tamper-evident transaction logs, and strict admin-only access to disbursement functions apply.
- **Network Segmentation** — The database server must not be reachable from the public internet under any configuration. Firewall rules and network architecture enforce this boundary.
- **Audit Logging & Monitoring** — Administrative actions on member records, wait-list selections, account creation/disabling, and all financial operations require immutable, timestamped audit trails to support accountability and forensic investigation.

---

## Part 2A — Architecture Diagram

The diagram below shows the full system architecture, data flows, IP addressing, and trust boundaries. Dashed boundaries indicate the edges of trust zones.

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║  UNTRUSTED ZONE (Public Internet)                                                ║
║                                                                                  ║
║   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                        ║
║   │ Guest Client │   │Member Client │   │ Admin Client │                        ║
║   │  (Browser)   │   │  (Browser)   │   │  (Browser)   │                        ║
║   │ Dynamic IP   │   │ Dynamic IP   │   │ Dynamic IP   │                        ║
║   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘                        ║
║          │ HTTPS             │ HTTPS             │ HTTPS                         ║
║          └───────────────────┴─────────────┬─────┘                              ║
╚════════════════════════════════════════════│════════════════════════════════════╝
                                             │
                              ╔══════════════▼═══════════════╗
                              ║   FIREWALL 1 (Perimeter)     ║
                              ║  External IP: 203.0.113.1    ║
                              ║  Rule: Allow TCP/443 inbound ║
                              ║  Rule: Deny all else inbound ║
                              ╚══════════════╤═══════════════╝
                                             │
╔════════════════════════════════════════════▼═════════════════════════════════════╗
║  SEMI-TRUSTED ZONE — DMZ / Public Subnet (10.0.1.0/24)                          ║
║ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ Trust Boundary ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ║
║                                                                                  ║
║        ┌───────────────────────────────────────────────────────┐                ║
║        │           FRONTEND WEB SERVER                         │                ║
║        │   Public IP  : 203.0.113.10                           │                ║
║        │   Private IP : 10.0.1.10                              │                ║
║        │                                                       │                ║
║        │   • Terminates TLS / HTTPS                           │                ║
║        │   • Handles Authentication & Session Tokens          │                ║
║        │   • Enforces Role-Based Authorization (RBAC)         │                ║
║        │   • Serves Guest / Member / Admin views              │                ║
║        │   • Hosts Treasury Portal (Admin-only endpoint)      │                ║
║        └───────────────────────────────────────────────────────┘                ║
║                                                                                  ║
╚════════════════════════════════════════════╤═════════════════════════════════════╝
                                             │  TCP/5432 (DB port)
                              ╔══════════════▼═══════════════════╗
                              ║   FIREWALL 2 (Internal)          ║
                              ║  DMZ-side IP  : 10.0.1.2         ║
                              ║  DB-side  IP  : 10.0.2.1         ║
                              ║  Rule: Allow TCP/5432 from       ║
                              ║        10.0.1.10 only            ║
                              ║  Rule: Deny all else             ║
                              ╚══════════════╤═══════════════════╝
                                             │
╔════════════════════════════════════════════▼═════════════════════════════════════╗
║  TRUSTED ZONE — Private Subnet (10.0.2.0/24)                                    ║
║ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ Trust Boundary ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ║
║                                                                                  ║
║        ┌───────────────────────────────────────────────────────┐                ║
║        │           BACKEND DATABASE SERVER                     │                ║
║        │   Private IP : 10.0.2.20   (no public IP)            │                ║
║        │                                                       │                ║
║        │   • Stores: Member PII, medical notes, credentials   │                ║
║        │   • Stores: Event data, registration records         │                ║
║        │   • Stores: Financial transaction history            │                ║
║        │   • Accessible ONLY from Web Server (10.0.1.10)     │                ║
║        └───────────────────────────────────────────────────────┘                ║
║                                                                                  ║
╚══════════════════════════════════════════════════════════════════════════════════╝
```

**Data Flow Summary**

| Flow | Source | Destination | Protocol | Port |
|------|--------|-------------|----------|------|
| 1 | Guest / Member / Admin Browsers | Firewall 1 | HTTPS | 443 |
| 2 | Firewall 1 | Web Server (203.0.113.10) | HTTPS | 443 |
| 3 | Web Server (10.0.1.10) | Firewall 2 | PostgreSQL/MySQL | 5432 |
| 4 | Firewall 2 | Database Server (10.0.2.20) | PostgreSQL/MySQL | 5432 |

All flows are bidirectional (request/response); all inter-zone traffic not explicitly permitted above is denied by default.

---

## Part 2B — STRIDE Threat Model

The following paragraphs describe the STRIDE threats most relevant to the Hiking Club Application.

### 1. Spoofing — Identity Theft via Session Hijacking

An attacker who intercepts or steals a member's session token can impersonate that member and act on their behalf, registering for events or accessing their profile data. A more severe version of this threat targets admin session tokens: an attacker who spoofs a system administrator's identity gains access to the treasury portal, where they could initiate unauthorized fund disbursements. This threat is particularly relevant because the application supports three distinct roles; spoofing a lower-privileged identity is bad, but spoofing a higher-privileged identity is catastrophic. Countermeasures include short-lived, cryptographically signed session tokens (JWTs or server-side sessions), HttpOnly and Secure cookie flags, mandatory HTTPS, and multi-factor authentication (MFA) for all admin logins to the treasury portal. Re-authentication should be required before any financial transaction is executed.

### 2. Tampering — Unauthorized Data Modification via Insecure Direct Object References (IDOR)

The application allows members to edit their own profiles. If the server does not verify on every request that the authenticated user owns the record being modified, a member could alter the URL or POST body parameters to modify another member's profile—or, more dangerously, tamper with event registration records or wait-list ordering. Trip leaders can modify completion status ("Completed," "Did Not Complete," "No Show") for their own events; without proper checks, a malicious trip leader could falsify completion records for events they did not create. Countermeasures include server-side ownership validation on every data-modification endpoint, binding records to the authenticated user's ID rather than accepting resource IDs unchecked, and write-audit logging for all profile, event, and registration changes.

### 3. Repudiation — Denial of Administrative Actions

Trip leaders handle sensitive functions: selecting members from wait lists, dropping registered members, and writing private medical or behavioral notes about members. Without a comprehensive audit trail, a trip leader could deny having made a specific decision—such as choosing to drop a member for discriminatory reasons or writing a false medical note. Similarly, the system administrator has the ability to withdraw money from the treasury portal; without a tamper-evident log, fraudulent withdrawals could go unattributed. Countermeasures include immutable, timestamped audit logs for every administrative action, stored in a write-once log store separate from the primary database, and associating every log entry with the authenticated user's session ID and the originating IP address. Logs should capture before and after values for all data edits.

### 4. Information Disclosure — Exposure of Confidential Member Data

The application stores medical information and private notes about members, accessible only to trip leaders and admins. If an attacker successfully injects a SQL query through a vulnerable search or filter input—such as the event listing search—they could extract the entire member table including confidential fields. Separately, verbose error messages returned to the client during exceptions could expose database schema details, table names, or stack traces that assist an attacker in crafting further attacks. Even a misconfigured authorization check could allow a regular member to call an API endpoint intended for admins and receive confidential data. Countermeasures include parameterized queries or an ORM for all database interactions, a production error handler that returns only generic error messages to clients, strict RBAC enforced server-side on every API endpoint regardless of UI visibility, and encryption of sensitive columns (medical notes, payment data) at rest using AES-256.

### 5. Denial of Service — Brute-Force and Automated Flooding

The public-facing authentication endpoint is accessible to any internet client. An attacker could launch a credential-stuffing attack—testing username/password pairs from previously breached databases—against member accounts, or simply flood the login endpoint to make the application unavailable. Because the web server is also publicly reachable, an attacker could attempt to exhaust application resources by sending a high volume of registration requests or event listing queries. Countermeasures include rate limiting on the authentication endpoint (e.g., lock account after five failed attempts within ten minutes), CAPTCHA on the login and registration forms, account lockout with administrative notification, and a Web Application Firewall (WAF) deployed in front of the web server to detect and block abnormal request volumes. Cloud-native DDoS protection (e.g., AWS Shield) should be enabled at the perimeter.

### 6. Elevation of Privilege — Role Escalation to Admin or Treasury Access

The application's three-tier role model (Guest → Member → Admin) creates a clear escalation target. A regular member could attempt to escalate privileges by manipulating a session token, a JWT role claim, a hidden form field, or a URL parameter to gain trip leader or system admin access. Even a trip leader might attempt to access system admin functions—such as the treasury portal or account creation endpoints—that are outside their role. If the frontend enforces role checks via client-side JavaScript but the backend API does not, any attacker who can call the API directly (via a tool like Burp Suite or curl) can bypass the frontend gate entirely. Countermeasures include server-side role validation on every backend API endpoint (never trust client-supplied role values), cryptographically signed and server-validated session tokens, a dedicated admin access route that requires a separate login step with MFA, and periodic penetration tests specifically targeting the authorization layer.

---

## Part 2C — OWASP Threat Model

### 1. Assessment Scope — What's on the Line?

The scope of this threat assessment covers the full Hiking Club web application stack and its data assets:

**In-scope systems:**
- Frontend Web Server (public-facing, 203.0.113.10) — all three client views (Guest, Member, Admin)
- Backend Database Server (private, 10.0.2.20)
- Both perimeter firewalls
- The treasury payment portal (hosted on the web server, admin-only)

**Critical assets at risk:**

| Asset | Sensitivity | Impact if Compromised |
|-------|-------------|----------------------|
| Member PII (name, address, email) | High | Privacy violation, regulatory liability |
| Medical notes & private member records | High | HIPAA-adjacent exposure, discrimination, member harm |
| Authentication credentials (hashed passwords) | High | Account takeover, identity spoofing |
| Financial transaction records | Critical | Fraud, direct monetary loss, regulatory penalty |
| Treasury portal (disbursement capability) | Critical | Direct financial theft |
| Event and registration data | Medium | Loss of club operations, trust damage |

The trust boundary separates three zones: the untrusted public internet, the semi-trusted DMZ containing the web server, and the trusted private subnet containing the database. Any breach of the boundary between the DMZ and the private subnet represents the highest-severity possible incident.

---

### 2. Vulnerabilities — What Are They?

The following vulnerabilities are mapped to the **OWASP Top Ten (2021)**:

**A01:2021 — Broken Access Control**
The most likely and highest-impact vulnerability class for this application. Insufficient server-side authorization checks could allow a member to read another member's confidential profile data, modify another member's registration, or access admin endpoints. An IDOR vulnerability in the profile editing or event management endpoints would fall here. The treasury portal is the highest-risk endpoint in this category.

**A02:2021 — Cryptographic Failures**
If sensitive database fields (medical notes, treasury records) are stored in plaintext or with weak encryption, a database breach exposes everything. If TLS is misconfigured or optional rather than enforced, credentials and session tokens are exposed in transit.

**A03:2021 — Injection**
The event listing page, member search, and profile editing forms all accept user input that reaches the database. Without parameterized queries, a SQL injection attack could dump the entire database, modify records, or in the worst case (with appropriate DB permissions) execute operating system commands on the database server.

**A04:2021 — Insecure Design**
The design specification describes a treasury portal that handles real monetary transactions. If MFA is not a design requirement from the outset, the system admin account becomes a single point of complete financial compromise. Similarly, designing wait-list selection as a purely manual process with no audit trail is an insecure design choice.

**A07:2021 — Identification and Authentication Failures**
Weak password policies (no minimum length/complexity), absence of MFA for privileged accounts, session tokens that do not expire, and tokens stored in localStorage (vulnerable to XSS) all fall into this category. Default or shared admin credentials are a related risk.

**A08:2021 — Software and Data Integrity Failures**
The assignment specification requires that system admins can "run sanity checks to ensure that the database has not been tampered with." This implies a recognized tamper risk. Without integrity verification (e.g., checksums, write-once audit tables), unauthorized changes to member records or financial data could go undetected.

**A09:2021 — Security Logging and Monitoring Failures**
Without comprehensive audit logs covering all admin actions, authentication events, and financial transactions, incident detection and forensic response are impossible. Failure to alert on anomalous login patterns (multiple failed attempts, logins from new geographies) leaves brute-force and account takeover attacks undetected.

---

### 3. Countermeasures — What Can You Do About It?

**Access Control**
- Implement Role-Based Access Control (RBAC) with roles: `GUEST`, `MEMBER`, `TRIP_LEADER`, `SYSTEM_ADMIN`.
- Validate the authenticated user's role on every backend API call—never rely on client-side role flags.
- Bind data-modification endpoints to the authenticated user's record ID; reject requests that reference records owned by other users.
- Require re-authentication (and MFA confirmation) before executing any treasury disbursement.

**Cryptography and Data Protection**
- Enforce TLS 1.3 for all client-server connections; redirect HTTP to HTTPS and set HSTS headers.
- Store passwords using bcrypt, scrypt, or Argon2 (never MD5 or SHA-1 alone).
- Encrypt sensitive database columns (medical notes, financial records) at rest using AES-256.
- Store secrets (DB credentials, API keys) in a managed secrets service, not in code or config files.

**Injection Prevention**
- Use parameterized queries or a well-maintained ORM for all database interactions; never construct SQL strings from user input.
- Validate and sanitize all inputs server-side: type, length, format, and allowed character set.
- Apply output encoding when rendering user-supplied data in HTML to prevent XSS.

**Authentication Hardening**
- Enforce a minimum password length of 12 characters with complexity requirements.
- Implement account lockout (5 failed attempts → 15-minute lockout) with admin notification.
- Require MFA (TOTP or hardware key) for all `TRIP_LEADER` and `SYSTEM_ADMIN` accounts.
- Issue session tokens as HttpOnly, Secure, SameSite=Strict cookies with a 30-minute inactivity timeout.

**Network and Infrastructure**
- Configure Firewall 2 to allow TCP/5432 from 10.0.1.10 only and deny all other inbound traffic to the private subnet.
- Deploy a Web Application Firewall (WAF) in front of the web server.
- Enable rate limiting on the `/login` and `/register` endpoints.
- Enable cloud-native DDoS protection at the perimeter.

**Logging and Monitoring**
- Log all authentication events (success and failure), all role-based access denials, all admin data modifications, and all financial transactions.
- Store logs in a write-once, append-only store separate from the primary database.
- Configure automated alerts for: more than five failed login attempts from the same IP in one minute, admin login from a new IP address, any treasury withdrawal, and any database sanity check failure.

---

### 4. Prioritized Risks — List in Order

| Priority | Risk | OWASP Category | Likelihood | Impact | Rationale |
|----------|------|---------------|------------|--------|-----------|
| 1 | Broken Access Control — Treasury Portal | A01 | Medium | Critical | Direct financial loss; admin account is single point of monetary control |
| 2 | SQL Injection via Event/Member Search | A03 | Medium | Critical | Public-facing inputs; full database dump exposes all sensitive data |
| 3 | Exposure of Medical Notes / PII via IDOR | A01 | High | High | Common vulnerability in web apps; confidential data causes member harm |
| 4 | Authentication Weakness / Account Takeover | A07 | High | High | Credential stuffing is automated and widespread; admin takeover = escalation |
| 5 | Elevation of Privilege — Role Escalation | A01 | Medium | High | Member → Admin escalation bypasses all role-based protections |
| 6 | Unencrypted Sensitive Data at Rest | A02 | Low | High | Risk realized only on DB breach, but consequence is severe |
| 7 | Insufficient Audit Logging | A09 | High | Medium | Does not cause direct harm, but prevents detection and attribution |
| 8 | Denial of Service on Login Endpoint | N/A | Medium | Medium | Disrupts operations; mitigated by WAF and rate limiting |
| 9 | Software Integrity — Undetected DB Tampering | A08 | Low | Medium | Insider threat or post-breach manipulation; detected by sanity checks |

---

*References:*
- [OWASP Top Ten 2021](https://owasp.org/www-project-top-ten/)
- [OWASP Application Threat Modeling](https://owasp.org/www-community/Application_Threat_Modeling)
- [OWASP Threat Modeling Category](https://wiki.owasp.org/index.php/Category:Threat_Modeling)
- [STRIDE Threat Model — Microsoft](https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats)

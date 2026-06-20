# Project 2 - Threat Model Assessment (Hiking Club)

**Course:** MSSE 642 – Software Assurance  
**Project:** Project 2 - Threat Model Assessment (Hiking Club)  
**Group Members:** Abdullah Bahir, Emad Fattah, Shawn Wilkinson  
**Date:** May 31, 2026  

---

## Part 1: Secure Design Document Overview

### 1) High-Level Project Description
World Hiking Club runs almost everything through its web app: members discover trips, register for events, and pay dues or excursion fees. Trip leaders and system admins use the same platform to post events, manage attendance outcomes, and run operational reports. The system also stores sensitive profile details such as medical conditions, performance notes, and payment history. If the app is down or compromised, club operations, member safety, and revenue are all affected. For that reason, security has to be treated as a core design requirement, not an add-on.

### 2) Organization Description
The World Hiking Club (WHC) is a nonprofit, volunteer-run organization based in Plano, Texas. It does not maintain a physical office or full-time paid staff, but officers (including a CTO) keep the platform running. The club serves members with different fitness levels and offers both local free hikes and paid travel excursions. Because nearly all business happens online, WHC depends on reliable and secure identity, scheduling, and payment workflows.

### 3) Deployment Environment
This threat model assumes a cloud-hosted deployment in AWS using a segmented virtual private cloud (VPC):
- Public subnet for a reverse proxy / web tier that accepts HTTPS traffic.
- Private application subnet for internal app services.
- Private data subnet for a managed relational database server.
- Managed WAF and network firewalls at ingress and between tiers.
- Centralized logging, monitoring, and secrets management.

This environment supports least-privilege network paths, encryption in transit, and better operational resilience than hosting in an office or server closet.

### 4) Secure Concepts Applicable to the Hiking Club Application
Key secure design concepts for this system include:
- **Strong authentication and session security** for members, trip leaders, and administrators (MFA for admin roles, lockout/rate limiting, secure password hashing).
- **Role-based access control (RBAC)** and object-level authorization to enforce who can read or change member profiles, events, and treasury data.
- **Confidentiality protections** for medical data, trip leader notes, and payment information through encryption, strict access controls, and audit trails.
- **Data integrity controls** so event status, no-show history, waitlist moves, and payment records cannot be silently tampered with.
- **Availability protections** (DDoS resistance, backups, recovery plans, and monitoring) because the organization cannot function without the web application.
- **Secure payment integration** to reduce PCI scope and prevent fraud, unauthorized refunds, and transaction manipulation.
- **Account governance controls** for banning abusive users, detecting brute-force attacks, and reducing insider misuse.

---

## Part 2: Threat Model Assessment

### Part 2A: Architectural Description and Data-Flow Diagram

### Assumed Components and Network Zones
- **Guest Web Client (browser-based)**
  - Public internet users with dynamic public IPs.
- **Member Web Client (browser-based)**
  - Public internet users with dynamic public IPs.
- **Admin Web Client (browser-based)**
  - Public internet users with dynamic public IPs.
- **Front End Web Server (public-facing reverse proxy + web app entry point)**
  - Public IP: `34.201.10.20`
  - Private IP (App VPC): `10.10.1.10`
- **Backend Application Service (internal app API/business logic)**
  - Private IP (App VPC): `10.10.2.20`
- **Backend Database Server (RDBMS)**
  - Private IP (Data VPC): `10.10.3.30`
- **Payment Gateway (external third-party provider)**
  - Public endpoint over HTTPS (no inbound trust to club network)

### Firewalls and Trust Boundaries
- **Firewall/WAF #1 (Internet edge):** allows inbound `443/TLS` only to Front End Web Server.
- **Firewall #2 (east-west segmentation):** allows App Service to DB on `5432` only (or equivalent RDBMS port).
- **Trust Boundary A (Public Internet → Club Cloud Edge):** untrusted to trusted ingress.
- **Trust Boundary B (Web Tier → App Tier):** controlled internal trust transition.
- **Trust Boundary C (App Tier → Data Tier):** high-sensitivity zone containing regulated/confidential data.

### Network Segments (minimum two internal trusted networks)
- **Trusted Network 1: App Subnet (`10.10.2.0/24`)**
- **Trusted Network 2: Data Subnet (`10.10.3.0/24`)**

### Data Flows
1. Guest/Member/Admin browser → Front End Web Server over HTTPS (`443`).
2. Front End Web Server → Backend Application Service over mTLS/internal TLS (`8443` or service mesh).
3. Backend Application Service → Database Server over TLS (`5432`).
4. Backend Application Service → External Payment Gateway over HTTPS (`443`) for payment tokenization, charges, and refunds.
5. Admin actions (reports, account disable, treasury operations) follow the same path but require elevated authorization checks and auditing.

### Diagram

![Project 2 Threat Model Diagram](../images/weekly%20projects/project2/threatmodel-diagram.png)

**Figure 1.** Architecture and data-flow diagram for the World Hiking Club application showing trust boundaries, network zones (Public Internet, Public Subnet/Web Tier, App Subnet, Data Subnet), component IPs, and labeled data flows. Red dashed lines indicate trust boundaries (A, B, C); colored arrows indicate protocol and direction of each data flow.

---

### Part 2B: STRIDE Threat Model

### Spoofing
A primary spoofing risk is account takeover through credential stuffing and brute-force login attempts, which the project history indicates has already occurred. Attackers who impersonate members can register for events or alter profile data, while attackers who spoof trip leaders or admins can access confidential medical notes and treasury functions. Session hijacking is also possible if session tokens are not strongly protected with secure cookie flags, short expiry, and token rotation.

### Tampering
Tampering threats include unauthorized changes to event attendance statuses (for example, changing "No Show" to "Completed"), trip capacity limits, waitlist order, and payment/refund records. If input validation and server-side authorization checks are weak, attackers can alter hidden form fields or API payloads to manipulate business outcomes. Database tampering by compromised privileged accounts could also hide abuse or financial irregularities unless immutable audit logs and reconciliation checks are enforced.

### Repudiation
Repudiation risk is significant because the platform supports actions with legal/financial impact (disabling accounts, dropping members from paid excursions, refunds, withdrawals). Without tamper-evident logs tied to unique user identities and timestamps, administrators or leaders could deny having made a sensitive change. A complete audit strategy should capture who performed each action, from which source IP/device, what changed, and why (reason code), with protected retention.

### Information Disclosure
The system stores highly sensitive data, especially medical conditions and private performance notes, and exposes payment history to users and admins. Broken access control, overly broad API responses, weak encryption, or insecure backups could leak confidential data to unauthorized members or external attackers. Disclosure could also occur through logs if sensitive fields are recorded in plain text or through misconfigured cloud storage snapshots.

### Denial of Service
Since the club depends on the web app to operate, denial-of-service attacks against login, event listing, or payment workflows can halt core business operations. Volumetric traffic, abusive scraping, and expensive query abuse can degrade system performance and lock out legitimate users during registration windows. Resource exhaustion can also come from internal misuse (for example, unbounded report generation) if quotas, caching, and rate limits are missing.

### Elevation of Privilege
Elevation of privilege can occur when members exploit insecure direct object references (IDOR) or flawed role checks to execute leader/admin-only functions. Examples include viewing private medical notes, editing another member's profile, or accessing treasury reports and refund operations. Over-privileged service accounts between web, app, and database tiers can further amplify impact if one component is compromised.

---

### Part 2C: OWASP Threat Model

### 1) Assessment Scope - What's on the line?
In scope are all browser-facing features (guest browsing, authentication, registration, profile management), privileged admin/leader workflows, payment processing integration, and backend data stores containing confidential member and financial records. The highest-value assets are account credentials, medical information, leader notes, attendance history, event management integrity, and treasury/payment transactions. The business impact includes member safety concerns, loss of trust, regulatory exposure, and inability to run hikes or collect required funds.

### 2) Vulnerabilities - What are they?
The most likely weaknesses in this application start with identity and access controls. If privileged users are not required to use MFA, and if login protection is weak, attackers can take over accounts through brute-force or reused credentials. Access control is another major risk, especially IDOR-style issues where a user can request data that belongs to someone else. Input handling also matters because weak validation can open the door to SQL injection in search, reporting, or admin functions.

There is also a high risk of data exposure if logs, backups, or cloud storage are misconfigured. Medical notes and payment history are sensitive, so even one overly permissive setting could cause a serious privacy incident. Insecure session handling (long-lived tokens, weak cookie settings) can make account hijacking easier. Finally, weak monitoring, overly broad cloud permissions, and unpatched dependencies can give attackers multiple paths to move through the environment.

### 3) Countermeasures - What can you do about it?
To reduce the biggest risks in this system, I would apply layered controls based on OWASP guidance:
- Require MFA for trip leaders and system admins, and enforce stronger password rules for all accounts.
- Add brute-force protection at login (rate limiting, short lockouts, and alerts for repeated failures).
- Enforce RBAC and object-level authorization on every protected API route so users can only access their allowed data.
- Encrypt sensitive data in transit and at rest, and store secrets/keys in a managed secrets service instead of code or config files.
- Use parameterized queries and strict input validation to prevent SQL injection and other input-based attacks.
- Harden session handling with `HttpOnly`, `Secure`, and `SameSite` cookies, plus short session lifetimes and token rotation.
- Keep tamper-resistant audit logs for account changes, payment actions, and admin operations; monitor these logs for anomalies.
- Segment the network so only required traffic is allowed (for example, app tier to DB tier on approved ports only).
- Keep payment card data out of the club database by using tokenization through a PCI-compliant third-party payment provider.
- Add ongoing security hygiene: patching, dependency/CVE checks, and regular application security testing (SAST/DAST).

### 4) Prioritized Risks (highest to lowest)
1. **Broken access control / privilege escalation** - highest risk because it can expose private medical data and treasury functions in one step.
2. **Account compromise (brute force or credential stuffing)** - likely attack path given the prior brute-force history.
3. **Sensitive data disclosure** - leaks of medical notes, payment history, or private member records would have major trust and privacy impact.
4. **Transaction tampering/fraud** - manipulation of refunds, dues, or paid-trip accounting directly affects finances.
5. **Availability disruption (DoS)** - outages can block registrations and day-to-day club operations.
6. **Weak logging/repudiation controls** - lowers visibility during incidents and makes investigations harder.

---

## Practical Assumptions Used in This Model
- The application is a traditional web app with a relational database.
- All clients access the platform through modern web browsers.
- Payment card processing is outsourced to a trusted third-party gateway.
- The club uses cloud-managed infrastructure and can configure firewalls, IAM, and logging.
- Regulatory/privacy obligations apply to medical and payment-adjacent data.


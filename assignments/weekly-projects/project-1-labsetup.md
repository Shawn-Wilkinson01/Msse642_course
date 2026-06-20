# Hands-On Assignment #1: Penetration Testing Lab Setup

**Course:** MSSE 642 – Software Assurance  
**Group Members:** Abdullah Bahir, Emad Fattah, Shawn Wilkinson  
**Date:** May 2026  
**Version:** 3.0  

---

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Architectural Diagram](#architectural-diagram)
4. [Virtualization Environment](#virtualization-environment)
5. [Kali Linux Setup](#kali-linux-setup)
6. [Nessus Installation](#nessus-installation)
7. [Metasploitable 2 Setup](#metasploitable-2-setup)
8. [Network Connectivity Test](#network-connectivity-test)
9. [Problems & Solutions](#problems--solutions)

---

## Overview

This write-up documents the setup of a local Penetration Testing lab environment for MSSE 642. The goal was to create a minimal but functional pentest lab running on a local machine using virtualization. The lab consists of two virtual machines:

- **Kali Linux** – the attacker machine, used for penetration testing.
- **Metasploitable 2** – the intentionally vulnerable target machine used as the attack surface.

This environment mirrors industry-standard pen testing setups and will be used for upcoming assignments in Weeks 6 and 8.

---

## Technology Stack

| Component | Details |
|---|---|
| **Host Machine** | Windows PC |
| **Host OS** | Windows 11 |
| **Hypervisor Type** | Type 2 – Oracle VirtualBox 7.x |
| **Attacker VM** | Kali Linux 2024.x (x86_64) |
| **Target VM** | Metasploitable 2 (x86_64) |
| **VM Network Mode** | Host-Only Network (isolated lab network) |

> **Note on Hypervisor Choice:** Oracle VirtualBox was chosen because it is free, open-source, and well-supported on Windows. Both VMs run natively on x86_64, so there are no architecture compatibility issues.

---

## Architectural Diagram

Below is the architectural diagram of the lab environment:

**Lab Network Summary:**

```
┌─────────────────────────────────────────────┐
│           Host Machine (Windows 11)         │
│                                             │
│  ┌──────────────────┐  ┌─────────────────┐  │
│  │   Kali Linux     │  │ Metasploitable 2│  │
│  │  (Attacker VM)   │  │  (Target VM)    │  │
│  │  192.168.56.101  │◄─►│ 192.168.56.102 │  │
│  └──────────────────┘  └─────────────────┘  │
│           │                   │             │
│           └───────┬───────────┘             │
│              Host-Only Network              │
│         (VirtualBox Host-Only Adapter)      │
└─────────────────────────────────────────────┘
```

---

## Virtualization Environment

Oracle VirtualBox was downloaded and installed from the [VirtualBox website](https://www.virtualbox.org/wiki/Downloads). It is free and open-source.

**Steps taken:**
1. Downloaded the VirtualBox installer for Windows from `virtualbox.org`.
2. Ran the installer and completed the setup wizard with default options.
3. Created a Host-Only Network adapter via *File → Host Network Manager* (`192.168.56.0/24`).

**Screenshot – VirtualBox running with both VMs:**

![VirtualBox Running](../images/weekly%20projects/project1/vmRunning.png)

> *The screenshot above shows VirtualBox Manager with both the Kali Linux VM and Metasploitable 2 VM listed and powered on.*

---

## Kali Linux Setup

Kali Linux was downloaded from the [official Kali website](https://www.kali.org/get-kali/#kali-virtual-machines) as a pre-built VirtualBox image (64-bit).

**Steps taken:**
1. Downloaded the Kali Linux VirtualBox image (`.ova` or `.vbox`) from `kali.org`.
2. In VirtualBox, went to *File → Import Appliance* and selected the downloaded `.ova` file.
3. Completed the import wizard with default settings.
4. Assigned the Host-Only network adapter to the VM under *Settings → Network*.
5. Booted the VM and logged in with default credentials (`kali` / `kali`).
6. Updated the system:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```
7. Changed the default password for security.

**Screenshot – Kali Linux logged in and running:**

![Kali Linux Running](../images/weekly%20projects/project1/kali_linux_running.png)

> *The screenshot shows the Kali Linux desktop environment with the terminal open, confirming a successful login.*

---

## Nessus Installation

Nessus Essentials (free tier) was installed on the Kali Linux VM for vulnerability scanning.

**Steps taken:**
1. Registered for a free Nessus Essentials activation code at [tenable.com/products/nessus/nessus-essentials](https://www.tenable.com/products/nessus/nessus-essentials).
2. Downloaded the Nessus `.deb` package for Debian/Kali (AMD64) from the Tenable downloads page:
   ```bash
   curl --request GET \
     --url 'https://www.tenable.com/downloads/api/v2/pages/nessus' \
     -o Nessus-latest-debian10_amd64.deb
   ```
3. Installed the package:
   ```bash
   sudo dpkg -i Nessus-latest-debian10_amd64.deb
   ```
4. Started the Nessus service:
   ```bash
   sudo systemctl start nessusd
   sudo systemctl enable nessusd
   ```
5. Navigated to `https://localhost:8834` in the Kali browser to complete the setup wizard and enter the activation code.
6. Waited for the initial plugin compilation to complete (~15–30 minutes).

**Screenshot – Nessus running and accessible in browser:**

![Nessus Installed](../images/weekly%20projects/project1/nessus.png)

> *The screenshot shows the Nessus Essentials web UI at `https://localhost:8834`, confirming successful installation and login.*

---

## Metasploitable 2 Setup

Metasploitable 2 is an intentionally vulnerable Linux VM designed as a penetration testing target (referenced on page 41 of the course textbook).

**Steps taken:**
1. Downloaded Metasploitable 2 from [SourceForge](https://sourceforge.net/projects/metasploitable/).
2. Extracted the `.zip` archive using Windows Explorer or 7-Zip.
3. In VirtualBox, created a new VM (*New → Linux → Ubuntu 32-bit*) and attached the extracted `.vmdk` as the existing virtual hard disk.
4. Assigned the Host-Only network adapter under *Settings → Network*.
5. Booted the VM; logged in with default credentials (`msfadmin` / `msfadmin`).
6. Noted the IP address assigned by the Host-Only network:
   ```bash
   ifconfig
   ```

**Screenshot – Metasploitable 2 running:**

![Metasploitable 2 Running](../images/weekly%20projects/project1/Metasploitable2Running.png)

> *The screenshot shows the Metasploitable 2 terminal login prompt confirming that the VM is up and running.*

---

## Network Connectivity Test

To verify that the Kali Linux attacker machine can reach the Metasploitable 2 target, a `ping` test was performed from within the Kali Linux VM.

**Steps taken:**
1. Identified the Metasploitable 2 IP from its terminal (`ifconfig`).
2. From the Kali Linux terminal, ran:
   ```bash
   ping -c 4 <metasploitable-ip>
   ```
   *(Replace `<metasploitable-ip>` with the actual IP, e.g., `192.168.56.102`)*

**Screenshot – Ping from Kali to Metasploitable 2:**

![Ping Test](../images/weekly%20projects/project1/pingTest.png)

> *The screenshot shows a successful `ping` from the Kali Linux VM to the Metasploitable 2 VM with 0% packet loss, confirming that the two VMs can communicate over the Host-Only network.*

---

## Problems & Solutions

| # | Problem | Solution |
|---|---------|----------|
| 1 | **VMs could not reach each other on NAT** | Both VMs defaulted to NAT mode. Created a Host-Only adapter via *File → Host Network Manager* (`192.168.56.0/24`) and assigned it to both VMs. |
| 2 | **Nessus web UI unreachable right after start** | `nessusd` needs ~2 minutes to initialize. Waited before navigating to `https://localhost:8834`. |
| 3 | **Kali Linux small screen resolution** | Installed VirtualBox Guest Additions (`sudo apt install virtualbox-guest-x11`) and rebooted; resolution could then be changed to 1920×1080. |
| 4 | **Nessus download failed on Kali Linux** | Nessus failed to download directly from the Kali Linux VM (possible network or permissions issue). Downloaded the Nessus `.deb` package (64-bit AMD64 version) on the host machine, then shared the file with the Kali VM via a shared folder. Initial installation failed due to version mismatch; the 32-bit version was accidentally downloaded first. Re-downloaded and installed the correct 64-bit version on the x86_64 Kali Linux VM, and the installation completed successfully. |

---

## References

- Kali Linux Official Site: [https://www.kali.org](https://www.kali.org)
- Oracle VirtualBox: [https://www.virtualbox.org](https://www.virtualbox.org)
- Tenable Nessus Essentials: [https://www.tenable.com/products/nessus/nessus-essentials](https://www.tenable.com/products/nessus/nessus-essentials)
- Metasploitable 2 Download: [https://sourceforge.net/projects/metasploitable/](https://sourceforge.net/projects/metasploitable/)

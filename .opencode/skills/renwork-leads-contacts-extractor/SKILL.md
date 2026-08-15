---
name: renwork-leads-contacts-extractor
description: >-
  Extracts B2B leads contact lists, verified emails, and phone numbers from RenWork (OKKI CRM) via Pyppeteer RPA, and runs a real-time Streamlit monitoring dashboard.
---

# RenWork Leads Contacts Extractor

## Overview
This skill automates B2B client lead enrichment by interfacing with a running RenWork (OKKI Desktop CRM) instance over Chrome DevTools Protocol (CDP). It searches RenWork Discovery Mining for target companies, scrapes contact details, paginates through multiple contact results, and registers the data in an Excel file. It also includes an integrated Streamlit dashboard for real-time progress tracking.

---

## Dependencies
* Python libraries: `pandas`, `openpyxl`, `pyppeteer`, `streamlit`
* System packages: RenWork (OKKI) client app installed on macOS, with remote debugging enabled on port `9222`.

---

## Quick Start

### 1. Extract Contacts from Excel Leads List
To extract contacts for pending companies in the default Excel file:
```bash
uv run .agents/skills/renwork-leads-contacts-extractor/scripts/extractor.py
```

To extract contacts for an arbitrary Excel file with a custom pagination limit:
```bash
uv run .agents/skills/renwork-leads-contacts-extractor/scripts/extractor.py --excel /path/to/leads.xlsx --pages 5
```

### 2. Launch the Real-Time Progress Dashboard
To view progress, success rate, and unique email counts, run the dashboard:
```bash
uv run streamlit run .agents/skills/renwork-leads-contacts-extractor/scripts/dashboard.py
```

To run it headlessly pointing to a custom Excel file:
```bash
uv run streamlit run .agents/skills/renwork-leads-contacts-extractor/scripts/dashboard.py --server.headless true -- --excel /path/to/leads.xlsx
```

---

## Utility Scripts

### `extractor.py` CLI Arguments
* `--excel`, `-e`: Path to the input/output Excel spreadsheet.
* `--sheet`, `-s`: Sheet name containing company list (default: auto-detected).
* `--col`, `-c`: Column name containing company names (default: auto-detected).
* `--pages`, `-p`: Maximum pages of contacts to extract per company. Each page contains 20 contacts (default: `3`).

---

## Self-Healing & Captcha Strategy
1. **CDP Port Session Reuse**: If the client is already running on port `9222`, the script connects silently in the background.
2. **First-Iteration database sync**: Added a 15-second wait on cold startup to allow client to synchronize local databases and WebSocket sessions.
3. **Verification Timeout Detection**: Programmatically clicks the "验证超时，请点击重试" button if visible.
4. **Focused Captcha Solving**: Automatically runs AppleScript to bring the client window to the front *only* when a slider captcha is detected (enabling OS mouse drag inputs), and goes back to the background once solved.
5. **Robust Non-Blocking Skip**: If a captcha is not resolved within 20 seconds, the company is skipped and saved as skipped to prevent script deadlocks.

---

## Common Mistakes
* **Port Conflict**: Make sure no other headless Chrome process is running on port `9222`.
* **Client Closed**: Ensure the client application is launched. If it is closed, the script will attempt to cold start it.
* **Active Window Focus**: When the script brings the client to the front to solve a slide captcha, do not move the mouse or switch workspaces manually to avoid interfering with Pyppeteer's drag trajectory.

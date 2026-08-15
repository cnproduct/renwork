---
name: zoho-outreach-manager
description: >-
  Prepares personalized customer outreach templates from Excel leads, uploads drafts to Zoho accounts via IMAP, and runs the rotating SMTP mailing loop with randomized delays.
---

# Zoho Outreach Manager

## Overview
This skill manages B2B customer email outreach campaigns specifically optimized for Zoho Mail. It automates:
1.  **Lead parsing & personalization** (`prepare`): Reads lead details from Excel sheets, performs validation, removes duplicates, applies custom email templates, and appends the signature for Sales Director Philip Chan (with website `www.cosine-ic.com`).
2.  **IMAP Draft Synchronisation** (`upload`): Uploads generated outreach templates as drafts to multiple Zoho accounts in round-robin blocks of 3. Fixes UTF-8 display bugs in From/To headers.
3.  **SMTP Rotating Loop** (`send`): Fetches the drafts (preserving manual edits) and transmits them via SMTP with random 1-5 minutes delays, rotating accounts after every 3 sends.

## Quick Start

### 1. File Requirements
Ensure you have the configuration file `outreach_config.json` inside your working directory:
```json
{
  "smtp_server": "smtp.zoho.com",
  "smtp_port": 465,
  "use_ssl": true,
  "accounts": [
    "philip@cosinechips.com",
    "philip1@cosinechips.com",
    "philip2@cosinechips.com",
    "philip3@cosinechips.com",
    "philip4@cosinechips.com",
    "philip5@cosinechips.com",
    "sales5@cosinechips.com",
    "sales10@cosinechips.com"
  ],
  "password": "YOUR_ZOHO_PASSWORD",
  "is_sending": false
}
```

### 2. Execute Outreach Workflow
Run the python script provided in this skill's `scripts/` folder using:
```bash
# 1. Prepare data from Excel leads sheet
python3 {skill_path}/scripts/outreach_tool.py prepare --excel "小满发现 - 全部公司联系人信息合并.xlsx" --db "outreach_data.json"

# 2. Upload drafts to Zoho accounts
python3 {skill_path}/scripts/outreach_tool.py upload --db "outreach_data.json" --config "outreach_config.json"

# 3. Start the sending loop
python3 {skill_path}/scripts/outreach_tool.py send --db "outreach_data.json" --config "outreach_config.json"
```

## Utility Scripts

### Subcommands of `outreach_tool.py`

#### `prepare`
Processes the Excel spreadsheet of leads to generate customized email bodies. It runs validation rules to filter duplicates and format issues.
*   `--excel`: Path to input Excel sheet.
*   `--db`: Path to output JSON database (`outreach_data.json` by default).

#### `upload`
Connects to Zoho's IMAP server using the accounts listed in `outreach_config.json` and uploads "Pending" emails to the accounts' Drafts folder in batches of 3. Marks uploaded records as `"Draft"`.
*   `--db`: Path to JSON database.
*   `--config`: Path to config file.

#### `send`
Reads `"Draft"` or `"Pending"` records and sends them through SMTP. For `"Draft"` status, it retrieves the draft first to preserve manual edits/attachments from the Zoho web client, then sends it, and deletes the draft from the folder. Rotates accounts (3 sends each) and pauses for a random 1-5 minutes (60-300s) delay between transmissions.
*   `--db`: Path to JSON database.
*   `--config`: Path to config file.

## Error Handling & Resiliency
*   **Auto-Retry**: All network calls (IMAP connect, fetch, SMTP login, and send) implement a 3-attempt exponential backoff retry logic.
*   **Format Filters**: Invalid email formats (non-matching standard regex) and duplicate emails are automatically logged and skipped to maintain sender reputation.

## Common Mistakes
*   **Closing the Session**: The `send` command runs as a continuous loop. Do not terminate the session unless you wish to pause the mailing engine.
*   **Password Updates**: Ensure your Zoho App Passwords or login passwords are correct and IMAP access is enabled on the Zoho accounts.

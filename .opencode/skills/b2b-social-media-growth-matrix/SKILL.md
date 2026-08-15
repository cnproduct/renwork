---
name: b2b-social-media-growth-matrix
description: >-
  Enterprise B2B dual-engine social media automation framework for Facebook Page
  and LinkedIn Company Page operations. Features automated high-res infographic
  photo attachment, 6-language matrix campaign scheduling (EN, DE, JA, CN, VI, TH),
  LinkedIn Company Admin publishing (ID: 35934326), B2B client feed monitoring &
  AI technical commenting, anti-detection Playwright automation, and automated
  live screenshot verification.
---

# B2B Social Media Growth Matrix & Multilingual Auto-Publisher

A production-grade social media growth and automation framework designed for B2B semiconductor and hardware manufacturers. Combines **Facebook Page Management**, **LinkedIn Company Admin Operations**, **Multi-Language Campaign Matrixes**, and **B2B AI Technical Engagement**.

---

## Overview & Dual-Engine Architecture

This skill automates the entire lifecycle of B2B social media content operations:

```
                                  ┌────────────────────────────────────────┐
                                  │   b2b-social-media-growth-matrix       │
                                  └──────────────────┬─────────────────────┘
                                                     │
                 ┌───────────────────────────────────┼──────────────────────────────────┐
                 ▼                                   ▼                                  ▼
      ┌──────────────────────┐           ┌──────────────────────┐           ┌──────────────────────┐
      │   Facebook Engine    │           │   LinkedIn Engine    │           │    Visual Engine     │
      ├──────────────────────┤           ├──────────────────────┤           ├──────────────────────┤
      │ • Page Identity Mgmt │           │ • Company Admin Post │           │ • HTML->PNG Renderer │
      │ • Cover Banner Clear │           │   (ID: 35934326)     │           │   (1200x1000 High-Res│
      │ • Photo Dropzone RPA │           │ • Poster / PDF Upload│           │ • Multilingual Spec  │
      │ • 6-Language Matrix  │           │ • AI Tech Commenter  │           │   Layouts (EN/DE/JA/ │
      │ • Live Screenshot QA │           │ • Lead Feed Monitor  │           │   CN/VI/TH)          │
      └──────────────────────┘           └──────────────────────┘           └──────────────────────┘
                 │                                   │                                  │
                 └───────────────────────────────────┼──────────────────────────────────┘
                                                     ▼
                                 ┌──────────────────────────────────────┐
                                 │   Anti-Detection Playwright Core     │
                                 │ • Headless Background Execution      │
                                 │ • Persistent Session (.playwright)   │
                                 │ • 120-300s Safe Interval Scheduler   │
                                 └──────────────────────────────────────┘
```

---

## Key Capabilities

1. **Facebook Page Operations**:
   - Automatic Page Identity switching (`立即切换`) from personal profile to brand manager.
   - Cover photo drag/edit overlay clearance (`保存更改` / `取消` auto-dismissal).
   - High-res infographic photo attachment with mandatory 12s thumbnail DOM rendering wait.
   - Pure-domain text formatting (prevents OpenGraph link cards from overriding photo attachments).
   - Two-step publishing flow (`下一页` ➜ `发帖`) with modal hidden listener.

2. **LinkedIn Company Page Operations (ID: 35934326)**:
   - Direct navigation to Admin Suite (`https://www.linkedin.com/company/35934326/admin/`).
   - Triggering `+ 创建` ➜ `发动态` modal.
   - Attaching high-res single posters, multi-photo sets, or multi-page technical whitepaper PDF carousels.
   - Injecting technical copy with component pin-to-pin drop-in replacement data and industry hashtags.
   - Verification and archiving via `admin/feed/posts/`.

3. **Multilingual Campaign Matrix (6 Target Markets)**:
   - Supported languages: **English (EN)**, **German (DE)**, **Japanese (JA)**, **Chinese (CN)**, **Vietnamese (VI)**, **Thai (TH)**.
   - Automated 2~5 minute safe delays between language posts to prevent platform rate-limiting and bot flags.

4. **LinkedIn B2B Lead AI Commenter & Engagement Bot**:
   - Extracting decision-makers (CEOs, Hardware Engineers, Procurement Directors) from Excel/CRM.
   - Monitoring live feeds and auto-generating insightful, domain-specific technical comments.

---

## Directory Structure

```bash
.agents/skills/b2b-social-media-growth-matrix/
├── SKILL.md                               # Framework specifications and operating instructions
├── scripts/                               # Production CLI automation scripts
│   ├── fb_multilingual_photo_publisher.py # Facebook 6-language photo campaign publisher
│   ├── fb_single_photo_publisher.py       # Facebook single high-res photo post publisher
│   ├── li_company_page_publisher.py       # LinkedIn Company Page (35934326) photo/PDF publisher
│   ├── li_b2b_auto_commenter.py           # LinkedIn B2B feed monitoring & AI technical commenter
│   ├── render_panoramic_infographic.py    # HTML to 1200x1000 PNG infographic poster renderer
│   └── verify_social_live_feed.py         # Multi-platform live screenshot verification & archiving
├── references/                            # Knowledge base and configuration catalogs
│   ├── post_templates_6lang.json          # 6-language technical copy library and hashtags
│   ├── dom_selector_catalog.md            # Facebook & LinkedIn DOM selector reference
│   └── anti_detection_guidelines.md       # Anti-detection session, pacing, and rate limit rules
└── examples/                              # Checklists and validation standards
    └── verification_checklist.md          # 5-point post-publish verification checklist
```

---

## Quick Start & CLI Usage

All scripts run fully headless by default (`headless=True`) and utilize the persistent session directory.

### 1. Publish 6-Language Campaign to Facebook Page
```bash
python3 scripts/fb_multilingual_photo_publisher.py --model COS358 --interval 120
```

### 2. Publish Single High-Res Post to Facebook Page
```bash
python3 scripts/fb_single_photo_publisher.py \
  --image "/path/to/poster_panoramic_day5_COS358_EN.png" \
  --text "Cosine Nanoelectronics COS358 Series General Purpose Dual Op-Amp IC..." \
  --output "/path/to/screenshot.png"
```

### 3. Publish to LinkedIn Company Page (ID: 35934326)
```bash
python3 scripts/li_company_page_publisher.py \
  --file "/path/to/poster_COS3485ESA_RS485.png" \
  --text "Industrial Precision Meets Zero-Defect Manufacturing: Cosine COS3485ESA..." \
  --type photo
```

### 4. Run LinkedIn B2B AI Technical Engagement Bot
```bash
python3 scripts/li_b2b_auto_commenter.py --max-comments 5 --target-industry "semiconductor"
```

### 5. Render Multilingual HTML Infographics to PNG
```bash
python3 scripts/render_panoramic_infographic.py --template "templates/poster.html" --lang "DE"
```

### 6. Verify Live Feeds and Capture Screenshots
```bash
python3 scripts/verify_social_live_feed.py --platform facebook --scroll 500 --output "fb_feed.png"
python3 scripts/verify_social_live_feed.py --platform linkedin --scroll 400 --output "li_feed.png"
```

---

## Critical Rules & Pitfall Solutions

| Pitfall / Issue | Root Cause | Built-in Auto-Remediation |
| :--- | :--- | :--- |
| **Facebook post has text but NO image** | Cover photo overlay intercepted dropzone / Submitting before blob upload finishes / Plain text URL triggered OpenGraph link preview card override | 1. Clear cover overlay by clicking `保存更改`.<br>2. Wait 12s for DOM thumbnail rendering.<br>3. Remove `https://` / `www.` from text; use bare domains like `cosinechips.com`. |
| **Publish button not clickable** | Modal bottom controls are offscreen | Injected JS executes `dialog.scrollTop += 300` before locating button. |
| **LinkedIn Company Page posting as personal identity** | Navigating to `/feed/` instead of `/company/admin/` | Script strictly routes to `/company/35934326/admin/` and triggers `+ 创建` menu. |
| **Account bot detection / Challenge** | Frequent bursts without delay / Headed window popup disruptions | 1. Persistent session `.playwright_session` reuse.<br>2. Fixed 120-300s randomized delay between multi-posts.<br>3. 100% headless silent execution. |
| **Feed screenshot only shows Pinned Post** | Pinned posts stick to the top of the feed | Verification script automatically scrolls 450-800px past pinned cards. |

---

## Verification & Acceptance Standard

Every automated social media operation MUST satisfy the **5-Point Verification Standard**:
1. **Asset Integrity**: High-res infographic image (1200x1000) or PDF is rendered without distortion.
2. **Text Accuracy**: Localized technical specifications (voltage, quiescent current, GBW, pin compatibility) are error-free.
3. **DOM Attachment**: Image thumbnail is confirmed present inside the composer dialog prior to submission.
4. **Modal Dismissal**: `div[role='dialog']` transition to hidden state is confirmed.
5. **Live Feed Screenshot**: High-resolution screenshot captured from the public live feed and saved to the project directory.

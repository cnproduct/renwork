# Anti-Detection, Session Persistence & Rate Limiting Guidelines

This document defines the production anti-detection standards for automating B2B social media interactions across Facebook and LinkedIn.

---

## 1. Browser Environment & Session Management

- **Persistent Context**: Always use `chromium.launch_persistent_context` with a fixed `user_data_dir` pointing to `.playwright_session`.
- **Headless Background Execution**: Always run with `headless=True` in production tasks to avoid popping up browser windows that disrupt user desktop activity.
- **Viewport Consistency**: Standardize viewport size to `1280x900` or `1280x1000` to ensure consistent DOM layout calculation across runs.
- **Single-Threaded Session Access**: Do NOT run concurrent Playwright scripts against the same `.playwright_session` folder to prevent Chromium lock collisions (`SingletonLock`).

---

## 2. Pacing, Delay & Rate Limiting Rules

- **Typing Simulation**: Use `page.keyboard.type(text, delay=10)` or `delay=15` rather than instantaneous `fill()`.
- **Media Upload Render Delay**: After attaching files via `set_input_files()`, always wait **10~15 seconds** for DOM blob processing and client-side thumbnail rendering.
- **Post-Submission Server Settle Time**: Wait at least **35~45 seconds** (or listen for `div[role='dialog']` transition to `hidden`) after clicking publish before navigating or closing context.
- **Multilingual Batch Interval**: Enforce a mandatory **120~300 seconds (2~5 minutes)** pause between consecutive posts.
- **B2B Commenting Throttling**: Limit automated feed comments to **3~5 comments per session**, with **15~30 seconds** randomized sleep between comments.

---

## 3. Link Handling & OpenGraph Overrides

- **Never use bare `https://` URLs in Facebook image posts**: Facebook's parser detects URLs and automatically replaces the uploaded image attachment with an OpenGraph website preview thumbnail card.
- **Best Practice**: Write plain domain references such as `cosinechips.com` or `sales@cosinechips.com` in the copy body.

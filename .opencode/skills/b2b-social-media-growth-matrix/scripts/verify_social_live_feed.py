#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Social Media Live Feed Verification & Screenshot Archiver (Facebook & LinkedIn)
Part of b2b-social-media-growth-matrix skill.
"""

import time
import os
import sys
import argparse
from playwright.sync_api import sync_playwright

DEFAULT_SESSION = os.path.expanduser(
    "~/Library/CloudStorage/GoogleDrive-cnproduct@gmail.com/我的云端硬盘/WPS同步盘/贸启航/客户贸启航/mqh客户/科山芯创/产品信息图/.playwright_session"
)
PLATFORM_URLS = {
    "facebook": "https://www.facebook.com/profile.php?id=100072476777778",
    "linkedin_company": "https://www.linkedin.com/company/35934326/admin/feed/posts/",
    "linkedin_personal": "https://www.linkedin.com/feed/"
}

def log(msg):
    print(msg, flush=True)

def verify_live_feed(platform="facebook", scroll_y=500, output_png="live_feed_verified.png", session_dir=DEFAULT_SESSION):
    target_url = PLATFORM_URLS.get(platform, PLATFORM_URLS["facebook"])
    abs_output = os.path.abspath(output_png)

    log("==================================================")
    log(f"📸 SOCIAL MEDIA LIVE FEED VERIFIER")
    log(f"   Platform: {platform.upper()}")
    log(f"   Target URL: {target_url}")
    log("==================================================")

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=session_dir,
            headless=True,
            viewport={'width': 1280, 'height': 1000}
        )
        page = context.new_page()
        page.set_default_timeout(60000)

        log("  ➜ Navigating to feed...")
        page.goto(target_url, wait_until="domcontentloaded")
        time.sleep(6)

        # Clear Facebook cover banner if present
        if platform == "facebook":
            cancel_cover = page.locator("div[role='button']:has-text('取消'), button:has-text('取消')").first
            if cancel_cover and cancel_cover.is_visible():
                try:
                    cancel_cover.click(force=True)
                except Exception:
                    pass
                time.sleep(2)

        if scroll_y > 0:
            log(f"  ➜ Scrolling down {scroll_y}px to reveal recent feed posts...")
            page.evaluate(f"window.scrollBy(0, {scroll_y})")
            time.sleep(3)

        page.screenshot(path=abs_output)
        log(f"🎉 Live feed screenshot saved: {abs_output}")
        context.close()

    return abs_output

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Live Feed Verifier and Screenshot Tool")
    parser.add_argument("--platform", type=str, default="facebook", choices=["facebook", "linkedin_company", "linkedin_personal"], help="Target platform")
    parser.add_argument("--scroll", type=int, default=500, help="Scroll offset in pixels")
    parser.add_argument("--output", type=str, default="live_feed_verified.png", help="Output PNG path")
    args = parser.parse_args()

    verify_live_feed(platform=args.platform, scroll_y=args.scroll, output_png=args.output)

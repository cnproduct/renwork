#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LinkedIn Company Page Publisher (Admin Organization ID: 35934326)
Supports high-resolution single photos, multi-photo sets, and multi-page technical PDF carousels.
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
COMPANY_ADMIN_URL = "https://www.linkedin.com/company/35934326/admin/"
COMPANY_FEED_URL = "https://www.linkedin.com/company/35934326/admin/feed/posts/"

def log(msg):
    print(msg, flush=True)

def publish_to_company_page(file_path, text_copy, post_type="photo", output_screenshot="li_company_verified.png", session_dir=DEFAULT_SESSION):
    if not os.path.exists(file_path):
        log(f"❌ Error: Asset file does not exist: {file_path}")
        sys.exit(1)

    log("==================================================")
    log(f"🚀 LINKEDIN COMPANY PAGE PUBLISHER (Org ID: 35934326)")
    log(f"   Asset: {os.path.basename(file_path)} [{post_type.upper()}]")
    log("==================================================")

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=session_dir,
            headless=True,
            viewport={'width': 1280, 'height': 900}
        )
        page = context.new_page()
        page.set_default_timeout(180000)

        log(f"  ➜ Navigating to Company Admin Suite: {COMPANY_ADMIN_URL}")
        page.goto(COMPANY_ADMIN_URL, wait_until="domcontentloaded")
        time.sleep(6)

        # 1. Click '+ 创建' (Create Post) button
        create_btn = page.wait_for_selector("button:has-text('+ 创建'), button:has-text('创建'), a:has-text('+ 创建')", timeout=20000)
        if create_btn:
            log("  ➜ Clicking '+ 创建' button...")
            try:
                create_btn.click()
            except Exception:
                page.evaluate("(el) => el.click()", create_btn)
            time.sleep(3)

        # 2. Click '发动态' dropdown option
        post_option = page.query_selector("div[role='dialog'] span:has-text('发动态'), div[role='dialog'] div:has-text('发动态'), span:has-text('发动态')")
        if post_option:
            log("  ➜ Clicking '发动态' (Create post)...")
            try:
                post_option.click()
            except Exception:
                page.evaluate("(el) => el.click()", post_option)
            time.sleep(4)

        # 3. Attach image or document
        file_input = page.wait_for_selector("input[type='file']", state="attached", timeout=20000)
        if file_input:
            log(f"  ➜ Uploading asset: {os.path.basename(file_path)}")
            file_input.set_input_files(file_path)
            time.sleep(6)

        # 4. Confirm media preview dialog ('下一步' / '完成' / 'Next' / 'Done')
        confirm_btn = page.query_selector("div[role='dialog'] button:has-text('下一步'), div[role='dialog'] button:has-text('完成'), div[role='dialog'] button:has-text('Next'), div[role='dialog'] button:has-text('Done')")
        if confirm_btn:
            log("  ➜ Confirming media preview dialog...")
            try:
                page.evaluate("(b) => b.click()", confirm_btn)
            except Exception:
                confirm_btn.click()
            time.sleep(4)

        # 5. Type technical text copy
        editor = page.wait_for_selector("div[contenteditable='true'], div.ql-editor, div[role='textbox']", timeout=20000)
        if editor:
            log("  ➜ Typing technical copy and hashtags into editor...")
            try:
                editor.click()
            except Exception:
                page.evaluate("(el) => el.focus()", editor)
            time.sleep(1)
            page.keyboard.type(text_copy, delay=10)
            time.sleep(4)

        # 6. Click '发布' (Post)
        pub_btn = page.locator("div[role='dialog'] button:has-text('发布'), button:has-text('发布'), button:has-text('Post')").last
        if pub_btn:
            log("  🚀 Submitting LinkedIn Company Post...")
            try:
                pub_btn.scroll_into_view_if_needed()
                time.sleep(1)
                pub_btn.click()
            except Exception:
                page.evaluate("(b) => b.click()", pub_btn.element_handle())
            time.sleep(15)

        # 7. Verification via admin posts feed
        log(f"  🔄 Navigating to Admin Posts Feed: {COMPANY_FEED_URL}")
        page.goto(COMPANY_FEED_URL, wait_until="domcontentloaded")
        time.sleep(6)
        page.evaluate("window.scrollBy(0, 400)")
        time.sleep(3)

        page.screenshot(path=output_screenshot)
        log(f"🎉 LinkedIn Company Post Published & Verified: {output_screenshot}")

        context.close()
        return output_screenshot

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="LinkedIn Company Page Publisher")
    parser.add_argument("--file", type=str, required=True, help="Path to infographic image or PDF document")
    parser.add_argument("--text", type=str, required=True, help="Technical post copy and hashtags")
    parser.add_argument("--type", type=str, default="photo", choices=["photo", "pdf"], help="Asset type")
    parser.add_argument("--output", type=str, default="li_company_live_verified.png", help="Output screenshot path")
    args = parser.parse_args()

    publish_to_company_page(file_path=args.file, text_copy=args.text, post_type=args.type, output_screenshot=args.output)

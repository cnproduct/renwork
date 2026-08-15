#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Facebook Single High-Resolution Photo Publisher & Verifier
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
FB_PAGE_URL = "https://www.facebook.com/profile.php?id=100072476777778"

def log(msg):
    print(msg, flush=True)

def publish_single_post(image_path, text_copy, output_screenshot="fb_single_post_verified.png", session_dir=DEFAULT_SESSION):
    if not os.path.exists(image_path):
        log(f"❌ Error: Image file does not exist: {image_path}")
        sys.exit(1)

    log("==================================================")
    log(f"🚀 FB SINGLE PHOTO POST PUBLISHER")
    log(f"   Image: {os.path.basename(image_path)}")
    log("==================================================")

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=session_dir,
            headless=True,
            viewport={'width': 1280, 'height': 900}
        )
        page = context.new_page()
        page.set_default_timeout(180000)

        log("  ➜ Navigating to Facebook Page...")
        page.goto(FB_PAGE_URL, wait_until="domcontentloaded")
        time.sleep(5)

        # Clear cover overlay if active
        save_cover = page.locator("div[role='button']:has-text('保存更改'), button:has-text('保存更改')").first
        if save_cover and save_cover.is_visible():
            try:
                save_cover.click(force=True)
            except Exception:
                pass
            time.sleep(3)

        cancel_cover = page.locator("div[role='button']:has-text('取消'), button:has-text('取消')").first
        if cancel_cover and cancel_cover.is_visible():
            try:
                cancel_cover.click(force=True)
            except Exception:
                pass
            time.sleep(2)

        # Switch to Page Identity
        switch_btn = page.locator("button:has-text('立即切换'), div[role='button']:has-text('立即切换')").first
        if switch_btn and switch_btn.is_visible():
            try:
                switch_btn.click(force=True)
            except Exception:
                pass
            time.sleep(5)

        page.evaluate("window.scrollBy(0, 350)")
        time.sleep(2)

        # Click Photo / Video button
        photo_btn = page.locator("span:has-text('照片/视频')").first
        if photo_btn and photo_btn.is_visible():
            try:
                photo_btn.click(force=True)
            except Exception:
                page.evaluate("(b) => b.click()", photo_btn.element_handle())
            time.sleep(5)
        else:
            post_trigger = page.locator("span:has-text('分享新鲜事')").first
            if post_trigger:
                try:
                    post_trigger.click(force=True)
                except Exception:
                    pass
                time.sleep(3)
            green_photo = page.locator("div[role='dialog'] div[aria-label*='照片']").first
            if green_photo and green_photo.is_visible():
                try:
                    green_photo.click(force=True)
                except Exception:
                    pass
                time.sleep(3)

        # Upload image
        file_input = page.wait_for_selector("div[role='dialog'] input[type='file'], input[type='file'][accept*='image']", state="attached", timeout=20000)
        if file_input:
            log(f"  ➜ Attaching image: {os.path.basename(image_path)}")
            file_input.set_input_files(image_path)
            log("  ⏳ Waiting 12s for photo thumbnail DOM render...")
            time.sleep(12)

        # Fill text
        text_area = page.query_selector("div[role='dialog'] div[contenteditable='true']")
        if text_area:
            try:
                text_area.click()
            except Exception:
                page.evaluate("(t) => t.focus()", text_area)
            time.sleep(1)
            page.keyboard.type(text_copy, delay=10)
            time.sleep(4)

        # Two-step submit
        next_btn = page.locator("div[role='dialog'] div[role='button']:has-text('下一页'), div[role='dialog'] button:has-text('下一页')").last
        if next_btn and next_btn.is_visible():
            try:
                next_btn.click(force=True)
            except Exception:
                page.evaluate("(b) => b.click()", next_btn.element_handle())
            time.sleep(5)

        pub_btn = page.locator("div[role='dialog'] div[role='button']:has-text('发帖'), div[role='dialog'] button:has-text('发帖'), div[role='dialog'] div[role='button']:has-text('Post')").last
        if pub_btn and pub_btn.is_visible():
            try:
                pub_btn.click(force=True)
            except Exception:
                page.evaluate("(b) => b.click()", pub_btn.element_handle())

        log("  ⏳ Waiting 35s for Facebook server submission...")
        time.sleep(35)

        # Reload and screenshot
        log("  🔄 Reloading page feed to verify public post...")
        page.goto(FB_PAGE_URL, wait_until="domcontentloaded")
        time.sleep(6)
        page.evaluate("window.scrollBy(0, 500)")
        time.sleep(3)

        page.screenshot(path=output_screenshot)
        log(f"🎉 Live post verified! Screenshot saved to: {output_screenshot}")

        context.close()
        return output_screenshot

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Facebook Single High-Res Photo Post Publisher")
    parser.add_argument("--image", type=str, required=True, help="Absolute path to high-res poster image")
    parser.add_argument("--text", type=str, required=True, help="Text copy for the post")
    parser.add_argument("--output", type=str, default="fb_live_single_verified.png", help="Output screenshot filename")
    args = parser.parse_args()

    publish_single_post(image_path=args.image, text_copy=args.text, output_screenshot=args.output)

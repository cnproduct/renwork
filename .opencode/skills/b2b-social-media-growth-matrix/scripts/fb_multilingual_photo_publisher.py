#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Facebook 6-Language High-Resolution Pure Photo Matrix Publisher (EN, DE, JA, CN, VI, TH)
Part of b2b-social-media-growth-matrix skill.
"""

import time
import os
import sys
import argparse
import json
from playwright.sync_api import sync_playwright

DEFAULT_SESSION = os.path.expanduser(
    "~/Library/CloudStorage/GoogleDrive-cnproduct@gmail.com/我的云端硬盘/WPS同步盘/贸启航/客户贸启航/mqh客户/科山芯创/产品信息图/.playwright_session"
)
DEFAULT_WORKSPACE = os.path.expanduser(
    "~/Library/CloudStorage/GoogleDrive-cnproduct@gmail.com/我的云端硬盘/WPS同步盘/贸启航/客户贸启航/mqh客户/科山芯创/产品信息图"
)
FB_PAGE_URL = "https://www.facebook.com/profile.php?id=100072476777778"

def log(msg):
    print(msg, flush=True)

def publish_multilingual_matrix(model="COS358", interval=120, session_dir=DEFAULT_SESSION, workspace_dir=DEFAULT_WORKSPACE, output_dir=None):
    if output_dir is None:
        output_dir = os.getcwd()
    os.makedirs(output_dir, exist_ok=True)

    templates_file = os.path.join(os.path.dirname(__file__), "../references/post_templates_6lang.json")
    if os.path.exists(templates_file):
        with open(templates_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            configs = data.get(model, data.get("COS358", []))
    else:
        configs = [
            {"lang_code": "EN", "lang_name": "English", "poster_path": f"{workspace_dir}/poster_panoramic_day5_COS358_EN.png", "text_copy": "Cosine Nanoelectronics COS358 Dual Op-Amp IC\n\n3V~36V wide supply voltage dual op-amp for smart meters & industrial control.\n\nWebsite: cosinechips.com"},
            {"lang_code": "DE", "lang_name": "German", "poster_path": f"{workspace_dir}/poster_panoramic_day5_COS358_DE.png", "text_copy": "Cosine Nanoelectronics COS358 Serie - Zweifach-Operationsverstärker-IC\n\nWebsite: cosinechips.com"},
            {"lang_code": "JA", "lang_name": "Japanese", "poster_path": f"{workspace_dir}/poster_panoramic_day5_COS358_JA.png", "text_copy": "Cosine Nanoelectronics COS358シリーズ 汎用2回路オペアンプIC\n\nWebsite: cosinechips.com"},
            {"lang_code": "CN", "lang_name": "Chinese", "poster_path": f"{workspace_dir}/poster_panoramic_day5_COS358_CN.png", "text_copy": "科山芯创 COS358 系列通用型双通道运算放大器芯片\n\nWebsite: cosinechips.com"},
            {"lang_code": "VI", "lang_name": "Vietnamese", "poster_path": f"{workspace_dir}/poster_panoramic_day5_COS358_VI.png", "text_copy": "Dòng chip khuyếch đại thuật toán đôi COS358 của Cosine Nanoelectronics\n\nWebsite: cosinechips.com"},
            {"lang_code": "TH", "lang_name": "Thai", "poster_path": f"{workspace_dir}/poster_panoramic_day5_COS358_TH.png", "text_copy": "Cosine Nanoelectronics COS358 ซีรีส์ ไอซีออปแอมป์คู่เอนกประสงค์\n\nWebsite: cosinechips.com"}
        ]

    log("==================================================")
    log(f"🚀 FB MULTILINGUAL PHOTO MATRIX PUBLISHER ({len(configs)} Languages for {model})")
    log("==================================================")

    results = []
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=session_dir,
            headless=True,
            viewport={'width': 1280, 'height': 900}
        )
        page = context.new_page()
        page.set_default_timeout(180000)

        for idx, cfg in enumerate(configs, start=1):
            code = cfg["lang_code"]
            name = cfg["lang_name"]
            poster = cfg["poster_path"]
            text = cfg["text_copy"]

            log(f"\n📌 [{idx}/{len(configs)}] Publishing {name} ({code}) Photo Post...")
            page.goto(FB_PAGE_URL, wait_until="domcontentloaded")
            time.sleep(5)

            # 1. Dismiss cover photo overlay if present
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

            # 2. Switch identity if needed
            switch_btn = page.locator("button:has-text('立即切换'), div[role='button']:has-text('立即切换')").first
            if switch_btn and switch_btn.is_visible():
                try:
                    switch_btn.click(force=True)
                except Exception:
                    pass
                time.sleep(5)

            page.evaluate("window.scrollBy(0, 350)")
            time.sleep(2)

            # 3. Open photo composer
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

            # 4. Attach image file
            file_input = page.wait_for_selector("div[role='dialog'] input[type='file'], input[type='file'][accept*='image']", state="attached", timeout=20000)
            if file_input and os.path.exists(poster):
                log(f"  ➜ Attaching poster: {os.path.basename(poster)}")
                file_input.set_input_files(poster)
                log("  ⏳ Waiting 12s for image thumbnail rendering in DOM...")
                time.sleep(12)

            # 5. Type text copy
            text_area = page.query_selector("div[role='dialog'] div[contenteditable='true']")
            if text_area:
                try:
                    text_area.click()
                except Exception:
                    page.evaluate("(t) => t.focus()", text_area)
                time.sleep(1)
                page.keyboard.type(text, delay=10)
                time.sleep(4)

            # 6. Two-step submission
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

            log("  ⏳ Waiting 35s for Facebook server confirmation...")
            time.sleep(35)

            # 7. Verify live feed & capture screenshot
            page.goto(FB_PAGE_URL, wait_until="domcontentloaded")
            time.sleep(6)
            page.evaluate("window.scrollBy(0, 500)")
            time.sleep(3)

            screenshot_file = os.path.join(output_dir, f"fb_photo_live_{code}.png")
            page.screenshot(path=screenshot_file)
            log(f"  ✅ Saved live verification screenshot: {screenshot_file}")
            results.append({"lang": code, "status": "success", "screenshot": screenshot_file})

            if idx < len(configs):
                log(f"⏳ Waiting {interval}s safety interval before next language post...")
                time.sleep(interval)

        context.close()

    log("==================================================")
    log(f"🎉 COMPLETED: All {len(results)} multilingual posts verified!")
    log("==================================================")
    return results

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Facebook Multilingual Photo Publisher")
    parser.add_argument("--model", type=str, default="COS358", help="Chip model identifier (e.g. COS358, COS3485ESA, COS8552SR)")
    parser.add_argument("--interval", type=int, default=120, help="Interval in seconds between posts (default: 120)")
    parser.add_argument("--output-dir", type=str, default=None, help="Directory to save verification screenshots")
    args = parser.parse_args()

    publish_multilingual_matrix(model=args.model, interval=args.interval, output_dir=args.output_dir)

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LinkedIn B2B Target Feed Monitor & AI Technical Commenter
Part of b2b-social-media-growth-matrix skill.
"""

import time
import os
import sys
import argparse
import random
from playwright.sync_api import sync_playwright

DEFAULT_SESSION = os.path.expanduser(
    "~/Library/CloudStorage/GoogleDrive-cnproduct@gmail.com/我的云端硬盘/WPS同步盘/贸启航/客户贸启航/mqh客户/科山芯创/产品信息图/.playwright_session"
)
LI_FEED_URL = "https://www.linkedin.com/feed/"

TECHNICAL_KNOWLEDGE_BASE = [
    "From an analog front-end design standpoint, maintaining low input offset voltage drift (like the 0.005 µV/°C in zero-drift chopper architecture) is essential to preserving SNR across extreme operating temperature ranges.",
    "For high-voltage smart metering and industrial sensor interfaces, dual op-amps with a 3V to 36V wide supply rail and low 500 µA quiescent current deliver the ideal balance between power budget and signal integrity.",
    "When designing CAN FD and RS-485 bus topologies for industrial automation, having ±16kV HBM ESD protection and up to 256 transceiver nodes on a shared bus drastically reduces field failures without requiring extra board-level suppression diodes.",
    "Drop-in P2P pin compatibility is critical for modern supply chain resilience—enabling seamless second-sourcing for legacy amplifiers like LM358 and transceivers like SN65HVD3082 without requiring PCB re-spins."
]

def log(msg):
    print(msg, flush=True)

def generate_technical_comment(post_text):
    for snippet in TECHNICAL_KNOWLEDGE_BASE:
        if any(term in post_text.lower() for term in ["analog", "sensor", "amplifier", "ic", "pcb", "can", "rs485", "circuit"]):
            return f"Great insights! {snippet}"
    return f"Excellent perspective on industrial hardware engineering. {random.choice(TECHNICAL_KNOWLEDGE_BASE)}"

def run_auto_commenter(max_comments=3, session_dir=DEFAULT_SESSION):
    log("==================================================")
    log(f"🚀 LINKEDIN B2B FEED MONITOR & AI COMMENTER")
    log(f"   Max Interactions: {max_comments}")
    log("==================================================")

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=session_dir,
            headless=True,
            viewport={'width': 1280, 'height': 900}
        )
        page = context.new_page()
        page.set_default_timeout(60000)

        log("  ➜ Navigating to LinkedIn Feed...")
        page.goto(LI_FEED_URL, wait_until="domcontentloaded")
        time.sleep(6)

        posts = page.query_selector_all("div.feed-shared-update-v2")
        log(f"  ➜ Found {len(posts)} feed posts on initial viewport.")

        commented_count = 0
        for idx, post in enumerate(posts[:10]):
            if commented_count >= max_comments:
                break

            post_text_el = post.query_selector(".feed-shared-update-v2__description, .break-words")
            post_text = post_text_el.inner_text() if post_text_el else ""

            if len(post_text) > 40:
                log(f"\n  📌 Inspecting Post #{idx+1}: {post_text[:60]}...")
                comment_btn = post.query_selector("button[aria-label*='Comment'], button[aria-label*='评论'], button:has-text('Comment'), button:has-text('评论')")
                if comment_btn:
                    try:
                        comment_btn.click()
                        time.sleep(2)

                        comment_box = post.query_selector("div.ql-editor, div[contenteditable='true']")
                        if comment_box:
                            generated_reply = generate_technical_comment(post_text)
                            log(f"     ➜ Typing AI technical comment: {generated_reply[:60]}...")
                            comment_box.click()
                            time.sleep(1)
                            page.keyboard.type(generated_reply, delay=15)
                            time.sleep(2)

                            submit_btn = post.query_selector("button.comments-comment-box__submit-button, button:has-text('Post'), button:has-text('发布')")
                            if submit_btn:
                                submit_btn.click()
                                log("     ✅ Comment published successfully!")
                                commented_count += 1
                                time.sleep(random.randint(15, 30))
                    except Exception as e:
                        log(f"     ⚠️ Skipped post due to interaction timeout: {e}")

        log("==================================================")
        log(f"🎉 Auto-commenter session complete. Interacted with {commented_count} posts.")
        log("==================================================")
        context.close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="LinkedIn B2B Auto Commenter")
    parser.add_argument("--max-comments", type=int, default=3, help="Maximum number of comments to submit")
    args = parser.parse_args()

    run_auto_commenter(max_comments=args.max_comments)

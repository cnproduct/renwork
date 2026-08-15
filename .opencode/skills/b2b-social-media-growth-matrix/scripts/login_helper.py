#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
One-Time Social Media Authentication Helper for New Computers
Opens a visible browser window allowing you to log into Facebook and LinkedIn.
The session cookies & tokens will be saved to .playwright_session for subsequent headless automation.
"""

import time
import os
import sys
from playwright.sync_api import sync_playwright

DEFAULT_SESSION = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".playwright_session")

def run_login_helper(session_dir=DEFAULT_SESSION):
    os.makedirs(session_dir, exist_ok=True)
    print("==================================================")
    print("🔑 SOCIAL MEDIA ONE-TIME LOGIN HELPER")
    print(f"   Session Storage: {session_dir}")
    print("==================================================")
    print("A browser window will open.")
    print("1. Log into your Facebook account (with Page admin rights)")
    print("2. Open a new tab and log into your LinkedIn account (with Company admin rights)")
    print("3. When you are finished logging in, simply CLOSE the browser window.")
    print("==================================================")

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=session_dir,
            headless=False,
            viewport={'width': 1280, 'height': 850}
        )
        page = context.new_page()
        page.goto("https://www.facebook.com/")

        print("\n⏳ Browser is ready. Please complete your logins in the open window...")
        try:
            while len(context.pages) > 0:
                time.sleep(1)
        except Exception:
            pass

        print("\n✅ Session successfully saved! You can now run all headless automation scripts.")
        context.close()

if __name__ == '__main__':
    run_login_helper()

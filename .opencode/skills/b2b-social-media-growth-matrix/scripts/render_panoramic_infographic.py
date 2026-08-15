#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Panoramic Infographic & System Map HTML->PNG Renderer (1200x1000 High-Res)
Part of b2b-social-media-growth-matrix skill.
"""

import time
import os
import sys
import argparse
from playwright.sync_api import sync_playwright

def log(msg):
    print(msg, flush=True)

def render_html_to_poster(html_file, output_png, width=1200, height=1000):
    if not os.path.exists(html_file):
        log(f"❌ Error: HTML file does not exist: {html_file}")
        sys.exit(1)

    abs_html = os.path.abspath(html_file)
    abs_output = os.path.abspath(output_png)
    os.makedirs(os.path.dirname(abs_output), exist_ok=True)

    log("==================================================")
    log(f"🎨 RENDERING HIGH-RES INFOGRAPHIC POSTER")
    log(f"   Source: {abs_html}")
    log(f"   Target: {abs_output} ({width}x{height})")
    log("==================================================")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': width, 'height': height}, device_scale_factor=2)

        page.goto(f"file://{abs_html}", wait_until="networkidle")
        time.sleep(2)

        page.screenshot(path=abs_output, full_page=False)
        browser.close()

    log(f"🎉 Successfully rendered high-res poster: {abs_output}")
    return abs_output

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="HTML Infographic Poster Renderer")
    parser.add_argument("--html", type=str, required=True, help="Path to source HTML template file")
    parser.add_argument("--output", type=str, required=True, help="Path to output PNG image")
    parser.add_argument("--width", type=int, default=1200, help="Viewport width (default: 1200)")
    parser.add_argument("--height", type=int, default=1000, help="Viewport height (default: 1000)")
    args = parser.parse_args()

    render_html_to_poster(html_file=args.html, output_png=args.output, width=args.width, height=args.height)

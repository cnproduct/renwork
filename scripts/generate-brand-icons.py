import os
import subprocess
import base64
from PIL import Image, ImageDraw, ImageFilter

SOURCE_IMG = "/Users/happy/.gemini/antigravity/brain/14113911-18cc-484e-bccf-707435a548e5/.user_uploaded/media_1787062976469.png"
REPO_ROOT = "/Users/happy/Library/CloudStorage/GoogleDrive-cnproduct@gmail.com/我的云端硬盘/WPS同步盘/人人易 AI/renwork"
DESKTOP_ICONS_DIR = os.path.join(REPO_ROOT, "apps/desktop/resources/icons")
APP_PUBLIC_DIR = os.path.join(REPO_ROOT, "apps/app/public")

img = Image.open(SOURCE_IMG).convert("RGBA")
bbox = img.getbbox()
cropped_glyph = img.crop(bbox)
print(f"Loaded source image: {img.size}, bbox: {bbox}, cropped_glyph: {cropped_glyph.size}")

# Create macOS / Windows Pure-Shaped Standalone App Icon (1024x1024)
# Apple HIG for Custom-Shaped / Silhouette Icons:
# The glyph itself is the icon, filling the canvas with optimal optical balance (~940px height)
# plus a subtle soft ambient depth shadow so it floats cleanly over any background.
def create_pure_shaped_app_icon():
    size = 1024
    icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    
    glyph_w, glyph_h = cropped_glyph.size
    aspect = glyph_w / glyph_h
    
    # Scale glyph to 930px height (leaving 47px padding top/bottom for shadow & breathing room)
    target_h = 930
    target_w = int(target_h * aspect)
    scaled_glyph = cropped_glyph.resize((target_w, target_h), Image.Resampling.LANCZOS)
    
    # Position: centered horizontally and vertically
    gx = (size - target_w) // 2
    gy = (size - target_h) // 2
    
    # Generate Apple-style soft drop shadow from the alpha mask
    alpha_mask = scaled_glyph.split()[3]
    
    # Shadow layer 1: Soft broad ambient shadow
    shadow1 = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    shadow1_mask = Image.new("L", (size, size), 0)
    shadow1_mask.paste(alpha_mask, (gx, gy + 14))
    shadow1_color = Image.new("RGBA", (size, size), (0, 0, 0, 95))
    shadow1 = Image.composite(shadow1_color, shadow1, shadow1_mask)
    shadow1 = shadow1.filter(ImageFilter.GaussianBlur(22))
    
    # Shadow layer 2: Crisper contact shadow
    shadow2 = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    shadow2_mask = Image.new("L", (size, size), 0)
    shadow2_mask.paste(alpha_mask, (gx, gy + 6))
    shadow2_color = Image.new("RGBA", (size, size), (0, 0, 0, 60))
    shadow2 = Image.composite(shadow2_color, shadow2, shadow2_mask)
    shadow2 = shadow2.filter(ImageFilter.GaussianBlur(8))
    
    # Composite: background transparent -> shadow1 -> shadow2 -> scaled_glyph
    icon = Image.alpha_composite(icon, shadow1)
    icon = Image.alpha_composite(icon, shadow2)
    icon.paste(scaled_glyph, (gx, gy), scaled_glyph)
    
    return icon

app_icon_1024 = create_pure_shaped_app_icon()

# 1. Save Desktop icon.png
app_icon_1024.save(os.path.join(DESKTOP_ICONS_DIR, "icon.png"), "PNG")
app_icon_1024.save(os.path.join(DESKTOP_ICONS_DIR, "dev/icon.png"), "PNG")

# 2. Save Linux icon sizes
linux_dir = os.path.join(DESKTOP_ICONS_DIR, "linux")
sizes = [16, 24, 32, 48, 64, 96, 128, 256, 512, 1024]
for s in sizes:
    resized = app_icon_1024.resize((s, s), Image.Resampling.LANCZOS)
    target_png = os.path.join(linux_dir, f"{s}x{s}.png")
    resized.save(target_png, "PNG")
    sub_dir = os.path.join(linux_dir, f"{s}x{s}")
    if os.path.exists(sub_dir):
        resized.save(os.path.join(sub_dir, "icon.png"), "PNG")

# 3. Generate Windows icon.ico
ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
app_icon_1024.save(os.path.join(DESKTOP_ICONS_DIR, "icon.ico"), format="ICO", sizes=ico_sizes)
print("Saved Windows icon.ico with maximum glyph scale")

# 4. Generate macOS icon.icns using iconutil
iconset_dir = "/tmp/RenWork.iconset"
os.makedirs(iconset_dir, exist_ok=True)
icns_map = {
    "icon_16x16.png": 16,
    "icon_16x16@2x.png": 32,
    "icon_32x32.png": 32,
    "icon_32x32@2x.png": 64,
    "icon_128x128.png": 128,
    "icon_128x128@2x.png": 256,
    "icon_256x256.png": 256,
    "icon_256x256@2x.png": 512,
    "icon_512x512.png": 512,
    "icon_512x512@2x.png": 1024,
}
for name, s in icns_map.items():
    app_icon_1024.resize((s, s), Image.Resampling.LANCZOS).save(os.path.join(iconset_dir, name), "PNG")

subprocess.run(["iconutil", "-c", "icns", iconset_dir, "-o", os.path.join(DESKTOP_ICONS_DIR, "icon.icns")], check=True)
subprocess.run(["iconutil", "-c", "icns", iconset_dir, "-o", os.path.join(DESKTOP_ICONS_DIR, "dev/icon-dev.icns")], check=True)

# Also update Computer Use helper app icon if exists
helper_icns = os.path.join(REPO_ROOT, "apps/desktop/resources/helpers/RenWork Computer Use.app/Contents/Resources/AppIcon.icns")
if os.path.exists(helper_icns):
    subprocess.run(["iconutil", "-c", "icns", iconset_dir, "-o", helper_icns], check=True)

print("Generated macOS icon.icns successfully")

# 5. Generate Web App Public Assets
app_icon_1024.resize((16, 16), Image.Resampling.LANCZOS).save(os.path.join(APP_PUBLIC_DIR, "favicon-16x16.png"), "PNG")
app_icon_1024.resize((32, 32), Image.Resampling.LANCZOS).save(os.path.join(APP_PUBLIC_DIR, "favicon-32x32.png"), "PNG")
app_icon_1024.resize((180, 180), Image.Resampling.LANCZOS).save(os.path.join(APP_PUBLIC_DIR, "apple-touch-icon.png"), "PNG")
app_icon_1024.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(APP_PUBLIC_DIR, "renwork-mark.png"), "PNG")
app_icon_1024.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(APP_PUBLIC_DIR, "openwork-mark.png"), "PNG")

# 6. Generate crisp standalone SVGs
with open(SOURCE_IMG, "rb") as f:
    b64_data = base64.b64encode(f.read()).decode("utf-8")

svg_square = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <image width="1024" height="1024" href="data:image/png;base64,{b64_data}"/>
</svg>'''

with open(os.path.join(APP_PUBLIC_DIR, "renwork-mark.svg"), "w") as f:
    f.write(svg_square)
with open(os.path.join(APP_PUBLIC_DIR, "openwork-mark.svg"), "w") as f:
    f.write(svg_square)
with open(os.path.join(APP_PUBLIC_DIR, "openwork-logo-square.svg"), "w") as f:
    f.write(svg_square)

print("Generated all app & public images successfully with pure-shaped logo format!")

import os
import subprocess
from PIL import Image, ImageDraw, ImageFilter

SOURCE_IMG = "/Users/happy/.gemini/antigravity/brain/14113911-18cc-484e-bccf-707435a548e5/.user_uploaded/media_1787050589043.png"
REPO_ROOT = "/Users/happy/Library/CloudStorage/GoogleDrive-cnproduct@gmail.com/我的云端硬盘/WPS同步盘/人人易 AI/renwork"
DESKTOP_ICONS_DIR = os.path.join(REPO_ROOT, "apps/desktop/resources/icons")
APP_PUBLIC_DIR = os.path.join(REPO_ROOT, "apps/app/public")

img = Image.open(SOURCE_IMG).convert("RGBA")
bbox = img.getbbox()
cropped_glyph = img.crop(bbox)
print(f"Original size: {img.size}, bbox: {bbox}, cropped_glyph: {cropped_glyph.size}")

# Master 1024x1024 transparent icon with 94% coverage for favicons & raw icon usages
master_logo_transparent = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
glyph_w, glyph_h = cropped_glyph.size
aspect = glyph_w / glyph_h

target_h = 960
target_w = int(target_h * aspect)
resized_for_master = cropped_glyph.resize((target_w, target_h), Image.Resampling.LANCZOS)
off_x = (1024 - target_w) // 2
off_y = (1024 - target_h) // 2
master_logo_transparent.paste(resized_for_master, (off_x, off_y), resized_for_master)

def create_app_icon_1024():
    size = 1024
    icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    
    # Official Apple macOS Icon Grid standard:
    # 824x824 squircle centered in 1024x1024 canvas (margin = 100 on all 4 sides)
    margin = 100
    rect_box = [margin, margin, size - margin, size - margin]
    radius = 185
    
    # Background: Premium deep dark space slate (#0B0F19 -> #151C28)
    bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg)
    bg_draw.rounded_rectangle(rect_box, radius=radius, fill=(15, 20, 28, 255))
    
    # Subtle inner border / rim light
    bg_draw.rounded_rectangle(rect_box, radius=radius, outline=(255, 255, 255, 25), width=3)
    
    # Soft drop shadow under the squircle
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_box = [margin + 2, margin + 14, size - margin - 2, size - margin + 14]
    shadow_draw.rounded_rectangle(shadow_box, radius=radius, fill=(0, 0, 0, 110))
    shadow = shadow.filter(ImageFilter.GaussianBlur(26))
    
    # Composite background
    icon = Image.alpha_composite(icon, shadow)
    icon = Image.alpha_composite(icon, bg)
    
    # Scale glyph to match Apple App Store / system standard optical weight
    # Squircle is 824x824. We scale glyph height to 720px (~87.4% of squircle height).
    target_glyph_h = 720
    target_glyph_w = int(target_glyph_h * aspect)
    logo_resized = cropped_glyph.resize((target_glyph_w, target_glyph_h), Image.Resampling.LANCZOS)
    
    lx = (size - target_glyph_w) // 2
    # Vertically center with optical correction (-2px)
    ly = (size - target_glyph_h) // 2 - 2
    
    icon.paste(logo_resized, (lx, ly), logo_resized)
    return icon

app_icon_1024 = create_app_icon_1024()

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
print("Saved Windows icon.ico")

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
master_logo_transparent.resize((16, 16), Image.Resampling.LANCZOS).save(os.path.join(APP_PUBLIC_DIR, "favicon-16x16.png"), "PNG")
master_logo_transparent.resize((32, 32), Image.Resampling.LANCZOS).save(os.path.join(APP_PUBLIC_DIR, "favicon-32x32.png"), "PNG")
app_icon_1024.resize((180, 180), Image.Resampling.LANCZOS).save(os.path.join(APP_PUBLIC_DIR, "apple-touch-icon.png"), "PNG")
master_logo_transparent.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(APP_PUBLIC_DIR, "renwork-mark.png"), "PNG")
master_logo_transparent.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(APP_PUBLIC_DIR, "openwork-mark.png"), "PNG")

print("Generated all app & public images successfully with optimized optical scaling!")

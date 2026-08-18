import os
import subprocess
from PIL import Image, ImageDraw, ImageFilter

SOURCE_IMG = "/Users/happy/.gemini/antigravity/brain/14113911-18cc-484e-bccf-707435a548e5/.user_uploaded/media_1787050589043.png"
REPO_ROOT = "/Users/happy/Library/CloudStorage/GoogleDrive-cnproduct@gmail.com/我的云端硬盘/WPS同步盘/人人易 AI/renwork"
DESKTOP_ICONS_DIR = os.path.join(REPO_ROOT, "apps/desktop/resources/icons")
APP_PUBLIC_DIR = os.path.join(REPO_ROOT, "apps/app/public")

img = Image.open(SOURCE_IMG).convert("RGBA")

# Ensure transparent or trim bounding box if needed
bbox = img.getbbox()
print(f"Original size: {img.size}, bbox: {bbox}")

# Create a master 1024x1024 transparent logo
master_logo_transparent = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
# Center and pad slightly for perfect balance
pad_size = 920
resized_raw = img.resize((pad_size, pad_size), Image.Resampling.LANCZOS)
offset_x = (1024 - pad_size) // 2
offset_y = (1024 - pad_size) // 2
master_logo_transparent.paste(resized_raw, (offset_x, offset_y), resized_raw)

# Create macOS Squircle App Icon (1024x1024) with sleek modern dark theme background
def create_app_icon_1024():
    size = 1024
    icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    
    # macOS squircle rounded rect bounds (approx 824x824 inside 1024 canvas for shadow room)
    margin = 80
    rect_box = [margin, margin, size - margin, size - margin]
    radius = 185
    
    # Background gradient: Deep space dark blue/slate (#0B0F19 -> #161F30)
    bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg)
    # Draw rounded rect mask
    bg_draw.rounded_rectangle(rect_box, radius=radius, fill=(15, 20, 30, 255))
    
    # Subtle inner border / rim light
    bg_draw.rounded_rectangle(rect_box, radius=radius, outline=(255, 255, 255, 30), width=3)
    
    # Add subtle soft shadow behind container
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_box = [margin + 4, margin + 12, size - margin - 4, size - margin + 12]
    shadow_draw.rounded_rectangle(shadow_box, radius=radius, fill=(0, 0, 0, 100))
    shadow = shadow.filter(ImageFilter.GaussianBlur(24))
    
    # Composite
    icon = Image.alpha_composite(icon, shadow)
    icon = Image.alpha_composite(icon, bg)
    
    # Place logo inside
    logo_inner_size = 640
    logo_resized = img.resize((logo_inner_size, logo_inner_size), Image.Resampling.LANCZOS)
    lx = (size - logo_inner_size) // 2
    ly = (size - logo_inner_size) // 2 - 4
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
    # Direct size file if exists
    target_png = os.path.join(linux_dir, f"{s}x{s}.png")
    resized.save(target_png, "PNG")
    # Also subfolder
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
# Favicons (transparent master logo looks stunning in tabs)
master_logo_transparent.resize((16, 16), Image.Resampling.LANCZOS).save(os.path.join(APP_PUBLIC_DIR, "favicon-16x16.png"), "PNG")
master_logo_transparent.resize((32, 32), Image.Resampling.LANCZOS).save(os.path.join(APP_PUBLIC_DIR, "favicon-32x32.png"), "PNG")
# Apple touch icon (180x180)
app_icon_1024.resize((180, 180), Image.Resampling.LANCZOS).save(os.path.join(APP_PUBLIC_DIR, "apple-touch-icon.png"), "PNG")
master_logo_transparent.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(APP_PUBLIC_DIR, "renwork-mark.png"), "PNG")
master_logo_transparent.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(APP_PUBLIC_DIR, "openwork-mark.png"), "PNG")

print("Generated all app & public images successfully!")

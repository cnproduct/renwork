# B2B Social Media Growth Matrix & Multilingual Auto-Publisher

跨电脑独立便携部署包（包含 Facebook 官方主页发布、LinkedIn 企业主页运营、6 国语言海报矩阵排期发布与 B2B 获客互动）。

---

## 🚀 新电脑快速上手指南（3 步启动）

### 第一步：安装运行依赖
确保新电脑已安装 Python 3.8+，在终端执行：
```bash
pip install playwright
playwright install chromium
```

### 第二步：首次登录授权（仅需一次）
运行一次性登录助手脚本：
```bash
python3 scripts/login_helper.py
```
- 弹窗浏览器打开后，分别登录 **Facebook**（具有官方主页管理权限的账号）和 **LinkedIn**（具有企业主页 ID: 35934326 管理权限的账号）。
- 登录完成后直接关闭浏览器窗口，登录状态会自动持久化保存到 `.playwright_session` 目录中。
- **免登录技巧**：如果您将原电脑的 `.playwright_session` 文件夹直接复制过来，则连登录都不需要，直接免密使用！

### 第三步：开始全自动静默发布与获客

#### 1. Facebook 6 国语言（英/德/日/中/越/泰）高精度海报矩阵发布
```bash
python3 scripts/fb_multilingual_photo_publisher.py --model COS358 --interval 120
```

#### 2. LinkedIn 企业官方主页（ID: 35934326）发布图文或 PDF 白皮书
```bash
python3 scripts/li_company_page_publisher.py \
  --file "/path/to/poster_COS3485ESA_RS485.png" \
  --text "Industrial Precision Meets Zero-Defect Manufacturing: Cosine COS3485ESA... #CosineNanoelectronics" \
  --type photo
```

#### 3. LinkedIn B2B 客户动态监控与 AI 技术评论互动
```bash
python3 scripts/li_b2b_auto_commenter.py --max-comments 5
```

#### 4. 双平台主页实况截屏自检与归档
```bash
python3 scripts/verify_social_live_feed.py --platform facebook --scroll 500
python3 scripts/verify_social_live_feed.py --platform linkedin_company --scroll 400
```

---

## 📂 完整目录结构

```bash
b2b-social-media-growth-matrix/
├── README.md                              # 新电脑部署与使用说明书
├── SKILL.md                               # AI Agent 技能规范与指令集
├── scripts/                               # 7 套核心 CLI 自动化执行脚本
│   ├── login_helper.py                    # 新电脑首次登录授权助手
│   ├── fb_multilingual_photo_publisher.py # Facebook 6 国语言高精度海报批量排期发布
│   ├── fb_single_photo_publisher.py       # Facebook 单篇高精度海报即时发布与核验
│   ├── li_company_page_publisher.py       # LinkedIn 企业主页（35934326）图文/PDF发布
│   ├── li_b2b_auto_commenter.py           # LinkedIn B2B 客户动态监控与 AI 技术评论
│   ├── render_panoramic_infographic.py    # 1200x1000 高清全景芯片海报 HTML 渲染导出
│   └── verify_social_live_feed.py         # 社媒主页实况截屏自检与归档工具
├── references/                            # 知识库与配置
│   ├── post_templates_6lang.json          # 6 国语言芯片文案库、Hashtag 与 P2P 对照表
│   ├── dom_selector_catalog.md            # Facebook / LinkedIn 核心 DOM 选择器清单
│   └── anti_detection_guidelines.md       # 账号持久化 Session、静默防检测与风控规范
└── examples/                              # 验收标准
    └── verification_checklist.md          # 5-Point 终审自检清单
```

---

## 🤖 导入到其他 AI 客户端 (Antigravity / Claude Code / Gemini CLI)

- **Antigravity / Gemini CLI**：解压至全局目录 `~/.gemini/config/skills/b2b-social-media-growth-matrix`
- **Claude Code**：解压至 `~/.claude/skills/b2b-social-media-growth-matrix`
- **当前项目局部**：解压至项目根目录 `.agents/skills/b2b-social-media-growth-matrix`

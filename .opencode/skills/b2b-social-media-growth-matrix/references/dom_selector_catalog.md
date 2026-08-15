# Social Media Platform DOM Selector Catalog

This catalog documents validated CSS/XPath selectors and DOM structures for Facebook Pages and LinkedIn Company/Personal Pages.

---

## 1. Facebook Page (Desktop Web SPA)

| UI Element | Validated Selector(s) | Fallback / Behavior |
| :--- | :--- | :--- |
| **Page Switch Banner** | `button:has-text('立即切换')`, `div[role='button']:has-text('立即切换')` | Switches from Philip Chan Personal ID to Cosinenanoelectronics Page Manager |
| **Cover Photo Save Button** | `div[role='button']:has-text('保存更改')`, `button:has-text('保存更改')` | Coords: `(932, 92)` |
| **Cover Photo Cancel Button** | `div[role='button']:has-text('取消')`, `button:has-text('取消')` | Coords: `(840, 92)` |
| **Photo Dropzone Launch Button** | `span:has-text('照片/视频')` | Opens post composer directly in media upload mode |
| **Feed Post Trigger** | `span:has-text('分享新鲜事')`, `div[role='button']:has-text('分享新鲜事')` | Secondary trigger to open composer |
| **Green Photo Icon in Modal** | `div[role='dialog'] div[aria-label*='照片']`, `div[role='dialog'] div[aria-label*='Photo']` | Inserts file dropzone into open dialog |
| **File Input Element** | `div[role='dialog'] input[type='file']`, `input[type='file'][accept*='image']` | Set files via `set_input_files(...)` |
| **Post Text Editor** | `div[role='dialog'] div[contenteditable='true'][role='textbox']` | Type copy using `page.keyboard.type` |
| **Next Step Button (Step 1)** | `div[role='dialog'] div[role='button']:has-text('下一页')` | Advances from media edit to privacy/publish settings |
| **Final Publish Button (Step 2)** | `div[role='dialog'] div[role='button']:has-text('发帖')`, `div[role='dialog'] div[role='button']:has-text('发布')` | Final submission to Facebook servers |
| **Post Modal Container** | `div[role='dialog']` | Wait for `state='hidden'` to ensure write completion |

---

## 2. LinkedIn Company Admin (ID: 35934326)

| UI Element | Validated Selector(s) | Fallback / Behavior |
| :--- | :--- | :--- |
| **Admin Create Button** | `button:has-text('+ 创建')`, `button:has-text('创建')` | Header / Sidebar create action |
| **Create Post Dropdown Option** | `span:has-text('发动态')`, `div[role='dialog'] span:has-text('发动态')` | Opens composer modal |
| **Media Input** | `input[type='file']` | Accepts PNG, JPG, or multi-page PDF |
| **Media Confirm Button** | `div[role='dialog'] button:has-text('下一步')`, `button:has-text('完成')`, `button:has-text('Next')` | Confirms image crop / PDF title |
| **Post Editor** | `div.ql-editor`, `div[role='textbox']`, `div[contenteditable='true']` | Injects technical text and tags |
| **Publish Button** | `div[role='dialog'] button:has-text('发布')`, `button:has-text('Post')` | Submits post live |
| **Admin Posts Feed** | `https://www.linkedin.com/company/35934326/admin/feed/posts/` | Target URL for post verification |

---

## 3. LinkedIn Personal & B2B Feed Engagement

| UI Element | Validated Selector(s) | Fallback / Behavior |
| :--- | :--- | :--- |
| **Feed Post Container** | `div.feed-shared-update-v2` | Individual post card |
| **Post Text Content** | `.feed-shared-update-v2__description`, `.break-words` | Extracts post context for AI commenting |
| **Comment Trigger** | `button[aria-label*='Comment']`, `button:has-text('评论')` | Expands comment editor |
| **Comment Editor** | `div.ql-editor`, `div[contenteditable='true']` | Types AI generated response |
| **Comment Submit** | `button.comments-comment-box__submit-button`, `button:has-text('Post')` | Submits technical response |

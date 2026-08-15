#!/usr/bin/env bash
set -e

VERSION="$1"

if [ -z "$VERSION" ]; then
  echo "❌ 请指定发布版本号，例如: ./scripts/publish-release.sh 0.18.24"
  exit 1
fi

export PATH="/opt/homebrew/bin:$PATH"

echo "🚀 [1/5] 升级版本号至 v$VERSION ..."
node -e "
const fs = require('fs');
['./package.json', './apps/desktop/package.json', './apps/app/package.json'].forEach(p => {
  if (fs.existsSync(p)) {
    const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
    pkg.version = '$VERSION';
    fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    console.log('  Updated ' + p);
  }
});
"

echo "📦 [2/5] 编译前端与 Electron 核心..."
pnpm --filter @openwork/app run build
pnpm --filter @openwork/desktop run build:electron

echo "🔨 [3/5] 打包 macOS DMG 与 ZIP 自动更新增量包..."
pnpm --dir apps/desktop exec electron-builder --config electron-builder.yml --mac dmg zip --publish never

echo "🌐 [4/5] 发布到 GitHub Releases (cnproduct/renwork) ..."
gh release delete "v$VERSION" --repo cnproduct/renwork --yes 2>/dev/null || true
gh release create "v$VERSION" \
  "apps/desktop/dist-electron/renwork-mac-arm64-$VERSION.dmg" \
  "apps/desktop/dist-electron/renwork-mac-arm64-$VERSION.zip" \
  "apps/desktop/dist-electron/latest-mac.yml" \
  --repo cnproduct/renwork \
  --title "RenWork v$VERSION" \
  --notes "RenWork 人人易 AI 官方升级版本 v$VERSION"

echo "💾 [5/5] 提交版本变更并推送到 GitHub 仓库..."
git add .
git commit -m "chore(release): bump version to v$VERSION" || true
git push origin dev
git push origin dev:main

echo ""
echo "🎉 恭喜！版本 v$VERSION 发布成功！"
echo "🔗 访问: https://github.com/cnproduct/renwork/releases/tag/v$VERSION"
echo "💡 所有已安装 RenWork 的用户客户端将自动收到更新推送与一键安装提示！"

export interface ReleaseArtifact {
  platform: "windows" | "macos_arm64" | "macos_x64" | "linux_x64";
  platformName: string;
  arch: string;
  format: string;
  fileName: string;
  sizeMb: string;
  sha256: string;
  cosUrl: string;
  githubUrl: string;
}

export interface ReleaseInfo {
  version: string;
  releaseDate: string;
  channel: "stable" | "beta";
  highlights: string[];
  artifacts: ReleaseArtifact[];
}

export const LATEST_RELEASE: ReleaseInfo = {
  version: "0.18.43",
  releaseDate: "2026-08-22",
  channel: "stable",
  highlights: [
    "海关真实提单 Intent Score 意图评分引擎升级，支持 180 天供应链供货份额穿透",
    "OKKI 本地可见浏览器适配器 (Local Adapter) 增强，支持多维采购委员会职位自动映射",
    "LinkedIn 360 多维实体消歧与动态时间线深度联动",
    "高转化外联序列 (Outreach Sequences) 支持审批流预览与退信/退订自动熔断",
    "TeamAI 团队知识治理体系上线：支持 Recall Inspector 与自进化经验 Learning PR"
  ],
  artifacts: [
    {
      platform: "windows",
      platformName: "Windows (64位)",
      arch: "x64",
      format: "exe",
      fileName: "RenWork-Setup-0.18.43.exe",
      sizeMb: "89.4 MB",
      sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      cosUrl: "https://rrenn-cos-1250000000.cos.ap-guangzhou.myqcloud.com/releases/v0.18.43/RenWork-Setup-0.18.43.exe",
      githubUrl: "https://github.com/davidlai0902-code/renwork/releases/download/v0.18.43/RenWork-Setup-0.18.43.exe"
    },
    {
      platform: "macos_arm64",
      platformName: "macOS (Apple Silicon M1/M2/M3/M4)",
      arch: "arm64",
      format: "dmg",
      fileName: "RenWork-0.18.43-arm64.dmg",
      sizeMb: "94.2 MB",
      sha256: "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b",
      cosUrl: "https://rrenn-cos-1250000000.cos.ap-guangzhou.myqcloud.com/releases/v0.18.43/RenWork-0.18.43-arm64.dmg",
      githubUrl: "https://github.com/davidlai0902-code/renwork/releases/download/v0.18.43/RenWork-0.18.43-arm64.dmg"
    },
    {
      platform: "macos_x64",
      platformName: "macOS (Intel 芯片)",
      arch: "x64",
      format: "dmg",
      fileName: "RenWork-0.18.43-x64.dmg",
      sizeMb: "98.1 MB",
      sha256: "8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4",
      cosUrl: "https://rrenn-cos-1250000000.cos.ap-guangzhou.myqcloud.com/releases/v0.18.43/RenWork-0.18.43-x64.dmg",
      githubUrl: "https://github.com/davidlai0902-code/renwork/releases/download/v0.18.43/RenWork-0.18.43-x64.dmg"
    },
    {
      platform: "linux_x64",
      platformName: "Linux (AppImage / deb)",
      arch: "x64",
      format: "AppImage",
      fileName: "RenWork-0.18.43.AppImage",
      sizeMb: "102.6 MB",
      sha256: "17acba9e9f6580f4f9f4a13d789069df8b1d9bc4410b001a1c97a4773820a17a",
      cosUrl: "https://rrenn-cos-1250000000.cos.ap-guangzhou.myqcloud.com/releases/v0.18.43/RenWork-0.18.43.AppImage",
      githubUrl: "https://github.com/davidlai0902-code/renwork/releases/download/v0.18.43/RenWork-0.18.43.AppImage"
    }
  ]
};

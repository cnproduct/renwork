import React, { useState, useEffect } from 'react';
import { SEO } from '../components/SEO';
import { LATEST_RELEASE } from '../data/releases';

export const DownloadsPage: React.FC = () => {
  const [detectedPlatform, setDetectedPlatform] = useState<string>('windows');
  const [downloadMirror, setDownloadMirror] = useState<'cos' | 'github'>('cos');

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (userAgent.includes('mac')) {
      // detect apple silicon vs intel if possible, default to arm64 on modern macs
      setDetectedPlatform('macos_arm64');
    } else if (userAgent.includes('linux')) {
      setDetectedPlatform('linux_x64');
    } else {
      setDetectedPlatform('windows');
    }
  }, []);

  const recommendedArtifact = LATEST_RELEASE.artifacts.find(a => a.platform === detectedPlatform) || LATEST_RELEASE.artifacts[0];

  return (
    <>
      <SEO
        title="下载中心 - RenWork 桌面客户端 (v0.18.43) - 人人易 AI"
        description="下载 RenWork 官方桌面客户端：支持 Windows、macOS (Apple Silicon & Intel)、Linux。本地优先、人在回路的外贸 AI 数字员工系统。"
        canonical="/downloads"
      />

      <section className="hero-section">
        <div className="container" style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
          <span className="badge badge-orange" style={{ marginBottom: '12px' }}>
            最新稳定版 v{LATEST_RELEASE.version} ({LATEST_RELEASE.releaseDate})
          </span>
          <h1 style={{ fontSize: '2.8rem', fontWeight: 800, color: 'var(--brand-ink)', margin: '12px 0 16px' }}>
            下载 RenWork 桌面客户端
          </h1>
          <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            本地优先架构，所有 Cookie 与会话数据保留在您本地设备，不上传云端，保障外贸账号与资产安全。
          </p>

          {/* Mirror Selector */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: 'var(--surface-subtle)', padding: '6px 16px', borderRadius: '9999px', margin: '24px auto', border: '1px solid var(--border-default)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--brand-ink)' }}>下载通道：</span>
            <label style={{ fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="radio"
                name="mirror"
                checked={downloadMirror === 'cos'}
                onChange={() => setDownloadMirror('cos')}
              />
              腾讯云高速镜像 (中国大陆推荐)
            </label>
            <label style={{ fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '12px' }}>
              <input
                type="radio"
                name="mirror"
                checked={downloadMirror === 'github'}
                onChange={() => setDownloadMirror('github')}
              />
              GitHub Releases (海外推荐)
            </label>
          </div>

          {/* Primary Recommended Download Button */}
          <div style={{ marginTop: '16px' }}>
            <a
              href={downloadMirror === 'cos' ? recommendedArtifact.cosUrl : recommendedArtifact.githubUrl}
              className="btn btn-primary btn-lg"
              style={{ fontSize: '1.15rem', padding: '16px 36px' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              立即下载 {recommendedArtifact.platformName} ({recommendedArtifact.sizeMb})
            </a>
            <div style={{ marginTop: '10px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              已自动识别您的操作系统 · 文件名: <code>{recommendedArtifact.fileName}</code>
            </div>
          </div>
        </div>
      </section>

      {/* All Platforms Table & Hashes */}
      <section className="section-padding" style={{ background: '#ffffff', borderTop: '1px solid var(--border-subtle)' }}>
        <div className="container" style={{ maxWidth: '960px' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--brand-ink)', marginBottom: '24px' }}>
            全平台客户端安装包与校验值 (SHA-256)
          </h2>

          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>操作系统与架构</th>
                  <th>安装包格式</th>
                  <th>文件大小</th>
                  <th>SHA-256 校验码</th>
                  <th>下载链接</th>
                </tr>
              </thead>
              <tbody>
                {LATEST_RELEASE.artifacts.map((art, idx) => (
                  <tr key={idx}>
                    <td>
                      <strong style={{ color: 'var(--brand-ink)' }}>{art.platformName}</strong>
                    </td>
                    <td><span className="badge badge-teal">{art.format.toUpperCase()}</span></td>
                    <td>{art.sizeMb}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                      {art.sha256.substring(0, 16)}...
                    </td>
                    <td>
                      <a
                        href={downloadMirror === 'cos' ? art.cosUrl : art.githubUrl}
                        className="btn btn-secondary btn-sm"
                      >
                        下载
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Release Highlights */}
          <div style={{ marginTop: '48px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-lg)', padding: '28px', border: '1px solid var(--border-default)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--brand-ink)', marginBottom: '16px' }}>
              📋 v{LATEST_RELEASE.version} 版本更新日志 (Changelog)
            </h3>
            <ul style={{ listStylePosition: 'inside', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
              {LATEST_RELEASE.highlights.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
};

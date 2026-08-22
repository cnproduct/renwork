import React from 'react';
import { SEO } from '../components/SEO';
import { CTASection } from '../components/CTASection';

interface CapabilityPageProps {
  onNavigate: (path: string) => void;
}

export const SocialMatrix: React.FC<CapabilityPageProps> = ({ onNavigate }) => {
  return (
    <>
      <SEO
        title="Social Matrix 6 语种全媒体社媒矩阵营销 - 人人易 AI"
        description="基于统一产品事实库，一键派生英、德、日、西、越、泰等 6 语种本地化社媒营销内容与高转化短视频，覆盖 LinkedIn、Facebook 与海外全媒体。"
        canonical="/product/social-matrix"
      />

      <section className="hero-section">
        <div className="container" style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
          <span className="badge badge-orange" style={{ marginBottom: '12px' }}>能力模块 05</span>
          <h1 style={{ fontSize: '2.8rem', fontWeight: 800, color: 'var(--brand-ink)', margin: '12px 0 16px' }}>
            Social Matrix<br />6 语种社媒矩阵营销引擎
          </h1>
          <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            一个产品事实包，派生全球主流渠道矩阵。深度本地化表达，彻底告别机器直译生硬感，打造出海品牌声量。
          </p>
        </div>
      </section>

      <section className="section-padding" style={{ background: '#ffffff', borderTop: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px', marginBottom: '60px' }}>
            <div className="card">
              <h3 className="card-title">🌐 6 语种深度本地化重构</h3>
              <p className="card-desc">
                覆盖英语 (EN)、德语 (DE)、日语 (JA)、西班牙语 (ES)、越南语 (VI)、泰语 (TH)。根据各区域商务语调、度量衡与文化习惯进行地道重写。
              </p>
            </div>

            <div className="card">
              <h3 className="card-title">📅 全媒体营销排期日历</h3>
              <p className="card-desc">
                月度与周度排期可视化管理。按主题规划 LinkedIn Company Page 权威动态、Facebook 案例图文与短视频营销脚本，支持一键审批发布。
              </p>
            </div>

            <div className="card">
              <h3 className="card-title">🎬 多模态物料与安全区适配</h3>
              <p className="card-desc">
                严格遵循各社交平台图片宽高比、Logo 安全边距与字符上限。未接入直接发布 API 的平台提供 <code>export_ready</code> 导出，透明可控。
              </p>
            </div>
          </div>
        </div>
      </section>

      <CTASection onNavigate={onNavigate} />
    </>
  );
};

import React from 'react';
import { SEO } from '../components/SEO';
import { CTASection } from '../components/CTASection';

interface CapabilityPageProps {
  onNavigate: (path: string) => void;
}

export const Outreach: React.FC<CapabilityPageProps> = ({ onNavigate }) => {
  return (
    <>
      <SEO
        title="Outreach 高转化外联序列与合规发信 - 人人易 AI"
        description="支持 Zoho Mail 与企业 SMTP 465/587 协议。融合 10 维背调原子证据与风险逆转 Offer，内置发信频率控制、退信熔断与退订合规保护。"
        canonical="/product/outreach"
      />

      <section className="hero-section">
        <div className="container" style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
          <span className="badge badge-teal" style={{ marginBottom: '12px' }}>能力模块 04</span>
          <h1 style={{ fontSize: '2.8rem', fontWeight: 800, color: 'var(--brand-ink)', margin: '12px 0 16px' }}>
            Outreach<br />高转化外联序列与合规发信
          </h1>
          <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            拒绝模板群发！用 10 维背调原子证据与 3 轮风险逆转 CTA 打造 30%+ 高回复率序列，全面保护企业发信域名声誉。
          </p>
        </div>
      </section>

      <section className="section-padding" style={{ background: '#ffffff', borderTop: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px', marginBottom: '60px' }}>
            <div className="card">
              <h3 className="card-title">💡 10 维背调原子证据注入</h3>
              <p className="card-desc">
                自动引用买家提单货描、官网痛点、行业认证缺口与竞争对手交付异动，每一句赞赏与推介都有具体事实支撑，绝非泛泛而谈。
              </p>
            </div>

            <div className="card">
              <h3 className="card-title">🔄 3 轮带风险逆转的序列编排</h3>
              <p className="card-desc">
                Step 1 价值切入 → Step 2 测试数据对比与样品 Offer → Step 3 破冰确认。客户一旦回复或退订，后续自动化序列立即智能停止 (Auto-Stop)。
              </p>
            </div>

            <div className="card">
              <h3 className="card-title">🛡️ 域名声誉防护与退信熔断</h3>
              <p className="card-desc">
                严格遵循全球反垃圾邮件法案 (CAN-SPAM / GDPR)：自动注入退订链接、单日发信平滑限频、时区智能对齐与硬退信自动拉黑。
              </p>
            </div>
          </div>
        </div>
      </section>

      <CTASection onNavigate={onNavigate} />
    </>
  );
};

import React from 'react';
import { SEO } from '../components/SEO';
import { CTASection } from '../components/CTASection';

interface CapabilityPageProps {
  onNavigate: (path: string) => void;
}

export const ContactIntelligence: React.FC<CapabilityPageProps> = ({ onNavigate }) => {
  return (
    <>
      <SEO
        title="Contact Intelligence 采购委员会穿透与 OKKI 本地回路 - 人人易 AI"
        description="海关数据锁定买家企业，OKKI 本地可见浏览器适配器穿透采购委员会 (Buying Committee)，精准定位采购 VP、物料工程师与可信联系方式。"
        canonical="/product/contact-intelligence"
      />

      <section className="hero-section">
        <div className="container" style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
          <span className="badge badge-teal" style={{ marginBottom: '12px' }}>能力模块 02</span>
          <h1 style={{ fontSize: '2.8rem', fontWeight: 800, color: 'var(--brand-ink)', margin: '12px 0 16px' }}>
            Contact Intelligence<br />采购委员会穿透与 OKKI 本地回路
          </h1>
          <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            海关提单决定“联系哪家公司”，OKKI 与权威多源渠道决定“联系谁”。在业务员本地沙箱安全运行，保护企业客户资产。
          </p>
        </div>
      </section>

      <section className="section-padding" style={{ background: '#ffffff', borderTop: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px', marginBottom: '60px' }}>
            <div className="card">
              <h3 className="card-title">👥 采购委员会 (Buying Committee) 识别</h3>
              <p className="card-desc">
                B2B 采购从非单人拍板！系统智能解构海外企业决策链：<strong>决策者 (Decision Maker)</strong>、<strong>评估工程师 (Influencer)</strong>、<strong>使用人员 (User)</strong> 与 <strong>合规把关人 (Gatekeeper)</strong>，实现多触点协同破冰。
              </p>
            </div>

            <div className="card">
              <h3 className="card-title">🛡️ OKKI 本地可见浏览器适配器</h3>
              <p className="card-desc">
                遵循本地优先架构：业务员在本地打开可见浏览器，完成正常验证。Session 与 Cookie 严格保存在本地 Keychain，绝不上传云端，符合平台条款且杜绝账号异地封禁。
              </p>
            </div>

            <div className="card">
              <h3 className="card-title">✨ C1/C2/C0 级别联系人核验</h3>
              <p className="card-desc">
                多源交叉验证邮箱 MX 记录、SMTP 握手状态与活跃度，标明 <code>Verified</code> / <code>Probable</code> / <code>Unverified</code> / <code>Suppressed</code> 状态，杜绝无效邮箱损耗外联额度。
              </p>
            </div>
          </div>
        </div>
      </section>

      <CTASection onNavigate={onNavigate} />
    </>
  );
};

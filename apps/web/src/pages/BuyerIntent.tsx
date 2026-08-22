import React from 'react';
import { SEO } from '../components/SEO';
import { CTASection } from '../components/CTASection';

interface CapabilityPageProps {
  onNavigate: (path: string) => void;
}

export const BuyerIntent: React.FC<CapabilityPageProps> = ({ onNavigate }) => {
  return (
    <>
      <SEO
        title="Buyer Intent 海关买家穿透与意图评分 - 人人易 AI"
        description="直连全球真实海关提单，自动过滤 95% 国际货代与报关行。基于产品图谱、采购频次与供应链异动信号，计算确定性 Intent Score (A+/A/B/C)。"
        canonical="/product/buyer-intent"
      />

      <section className="hero-section">
        <div className="container" style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
          <span className="badge badge-orange" style={{ marginBottom: '12px' }}>能力模块 01</span>
          <h1 style={{ fontSize: '2.8rem', fontWeight: 800, color: 'var(--brand-ink)', margin: '12px 0 16px' }}>
            Buyer Intent<br />海关真实买家穿透与意图评分
          </h1>
          <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            穿透全球官方真实海关提单 (Bill of Lading)，剔除货代干扰，锁定真实采购商 (Consignee)，捕捉供应链异动与采购激增信号。
          </p>
        </div>
      </section>

      {/* Feature Deep Dive */}
      <section className="section-padding" style={{ background: '#ffffff', borderTop: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px', marginBottom: '60px' }}>
            <div className="card">
              <h3 className="card-title">🚢 NVOCC 国际货代精准剔除</h3>
              <p className="card-desc">
                集成行业领先的货代名称特征库与模式识别算法，自动识破并过滤无船承运人 (NVOCC)、拼箱代理与清关报关行，确保输出的每一个名单都是真正的终端买家或实质分销商。
              </p>
            </div>

            <div className="card">
              <h3 className="card-title">📊 采购意图评分 (Intent Score)</h3>
              <p className="card-desc">
                非黑盒神秘数字！评分深度结合四大维度：产品规格重合度 (40%)、近 180 天提单活跃度 (30%)、原供货商断供/交期延误异动 (20%) 与企业存续实体真实度 (10%)。
              </p>
            </div>

            <div className="card">
              <h3 className="card-title">🔍 提单证据链条全面留痕</h3>
              <p className="card-desc">
                每一家推荐的买家均附带具体到港日期、起运港/目的港、集装箱柜量 (TEU)、货描摘要与观测到的历史供应商份额，为后续破冰开发信提供不可动摇的“事实锚点”。
              </p>
            </div>
          </div>

          {/* Technical Contract / Specs */}
          <div style={{ background: 'var(--surface-subtle)', borderRadius: 'var(--radius-lg)', padding: '32px', border: '1px solid var(--border-default)' }}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--brand-ink)', marginBottom: '16px' }}>
              🛠️ 输入输出技术契约 (Schema & Bounds)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <h4 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '8px' }}>输入参数 (Inputs)</h4>
                <ul style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.8', listStylePosition: 'inside' }}>
                  <li>企业官网与产品 DNA 规范图谱</li>
                  <li>目标国家 / 港口 (ISO 3166-1)</li>
                  <li>HS Code 编码矩阵与物料关键词</li>
                  <li>强制排除的竞争对手与货代黑名单</li>
                </ul>
              </div>
              <div>
                <h4 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '8px' }}>输出结构 (Outputs)</h4>
                <ul style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.8', listStylePosition: 'inside' }}>
                  <li>标准化 <code>CompanyProfile</code> 实体对象</li>
                  <li>A+/A/B/C 分级与可解释 <code>ScoreFactor[]</code></li>
                  <li>包含 B/L 号与 TEU 的 <code>EvidenceRef[]</code> 证据链</li>
                  <li>下一步行动建议 (Next Best Action)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <CTASection onNavigate={onNavigate} />
    </>
  );
};

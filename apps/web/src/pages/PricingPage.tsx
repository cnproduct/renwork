import React from 'react';
import { SEO } from '../components/SEO';
import { PricingSection } from '../components/PricingSection';
import { FAQSection } from '../components/FAQSection';
import { CTASection } from '../components/CTASection';

interface PricingPageProps {
  onNavigate: (path: string) => void;
}

export const PricingPage: React.FC<PricingPageProps> = ({ onNavigate }) => {
  return (
    <>
      <SEO
        title="价格方案与套餐对比 - 人人易 AI"
        description="人人易 AI (rrenn.com) 官方透明定价：起步版 ¥19,800/年，增长版 ¥29,800/年，规模版 ¥59,800/年，旗舰企业版 ¥128,000/年，集团定制版 ¥380,000起。"
        canonical="/pricing"
      />

      <section className="hero-section" style={{ paddingBottom: '32px' }}>
        <div className="container" style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
          <span className="badge badge-orange" style={{ marginBottom: '12px' }}>透明投资回报</span>
          <h1 style={{ fontSize: '2.8rem', fontWeight: 800, color: 'var(--brand-ink)', margin: '12px 0 16px' }}>
            选择最契合您外贸规模的增长方案
          </h1>
          <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            所有套餐均包含海关真实提单穿透、OKKI 本地采购委员会解析、LinkedIn 360 与高转化邮件序列。
          </p>
        </div>
      </section>

      {/* Full Comparison Pricing Table */}
      <PricingSection onNavigate={onNavigate} showFullComparison={true} />

      {/* Service Commitments */}
      <section className="section-padding" style={{ background: 'var(--surface-subtle)', borderTop: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 40px' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--brand-ink)' }}>
              人人易专属实施与服务保障
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            <div className="card">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '8px' }}>🎓 1v1 顾问式实战陪跑</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                资深出海专家协助梳理企业产品 DNA、调试 HS 编码矩阵，3 个工作日内完成首期真实买家穿透。
              </p>
            </div>

            <div className="card">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '8px' }}>🔒 本地数据主权协议</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                签订具备法律效力的保密与数据主权协议，企业私有客户信息绝不上传公网或用于公共模型训练。
              </p>
            </div>

            <div className="card">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '8px' }}>🔄 持续算法与规则升级</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                服务期内持续享受全球海关数据源扩充、OKKI 适配器优化与全新外贸 AI 技能无缝热更新。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing FAQs */}
      <FAQSection />

      {/* CTA */}
      <CTASection onNavigate={onNavigate} />
    </>
  );
};

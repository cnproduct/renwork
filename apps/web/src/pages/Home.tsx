import React from 'react';
import { SEO } from '../components/SEO';
import { Hero } from '../components/Hero';
import { WorkflowSection } from '../components/WorkflowSection';
import { CapabilitiesSection } from '../components/CapabilitiesSection';
import { ArchitectureSection } from '../components/ArchitectureSection';
import { PricingSection } from '../components/PricingSection';
import { FAQSection } from '../components/FAQSection';
import { CTASection } from '../components/CTASection';
import { INDUSTRY_SOLUTIONS } from '../data/solutions';
import { CASE_STUDIES } from '../data/cases';

interface HomeProps {
  onNavigate: (path: string) => void;
}

export const Home: React.FC<HomeProps> = ({ onNavigate }) => {
  return (
    <>
      <SEO
        title="首页 - 企业级外贸 B2B 增长操作系统与 AI 数字员工"
        description="人人易 AI (rrenn.com) 融合海关提单真实穿透、OKKI 联系人解析、LinkedIn 360 与高转化邮件序列，为外贸企业提供本地优先、人在回路的获客增长闭环。"
        canonical="/"
      />

      {/* 1. Hero Section */}
      <Hero onNavigate={onNavigate} />

      {/* 2. Pain Points vs Value Metric Section */}
      <section className="section-padding" style={{ background: '#ffffff', borderTop: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 40px' }}>
            <span className="badge badge-orange">直面外贸获客痛点</span>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--brand-ink)', margin: '12px 0 16px' }}>
              为什么传统外贸获客越来越难？
            </h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              传统开发信群发、低质海关数据与展会坐等客户的模式正在全面失效。RenWork 为您带来量化破局解法。
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            <div style={{ background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', padding: '24px', borderLeft: '4px solid var(--status-danger)' }}>
              <div style={{ color: 'var(--status-danger)', fontWeight: 800, fontSize: '0.9rem', marginBottom: '8px' }}>
                ❌ 传统海关数据痛点
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '8px' }}>90% 都是货代与拼箱公司</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                提单全被中转货代覆盖，找不到真实采购商；没有意图评分，业务员每天花 4 小时手工去重清洗。
              </p>
              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px dashed var(--border-default)', color: 'var(--status-success)', fontWeight: 600, fontSize: '0.9rem' }}>
                ✓ RenWork 解法：NVOCC 货代自动剔除率 95%+，直达真实 Consignee。
              </div>
            </div>

            <div style={{ background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', padding: '24px', borderLeft: '4px solid var(--status-danger)' }}>
              <div style={{ color: 'var(--status-danger)', fontWeight: 800, fontSize: '0.9rem', marginBottom: '8px' }}>
                ❌ 传统开发信痛点
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '8px' }}>模板群发回复率不足 2%</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                内容空洞无证据，易被海外企业安全网关识别为垃圾邮件，导致企业发件域名声誉永久受损。
              </p>
              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px dashed var(--border-default)', color: 'var(--status-success)', fontWeight: 600, fontSize: '0.9rem' }}>
                ✓ RenWork 解法：10 维背调原子证据 + 风险逆转 CTA，回复率提升至 28%+。
              </div>
            </div>

            <div style={{ background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', padding: '24px', borderLeft: '4px solid var(--status-danger)' }}>
              <div style={{ color: 'var(--status-danger)', fontWeight: 800, fontSize: '0.9rem', marginBottom: '8px' }}>
                ❌ 团队管理痛点
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '8px' }}>销冠离职，经验无法传承</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                新业务员培训周期长达 6 个月，优秀话术与谈判让步策略全留在个人电脑，团队难以规模化复制。
              </p>
              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px dashed var(--border-default)', color: 'var(--status-success)', fontWeight: 600, fontSize: '0.9rem' }}>
                ✓ RenWork 解法：TeamAI 知识自进化与 Recall 机制，新人入职即享销冠级话术库。
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. 7-Step Workflow Closed-Loop */}
      <WorkflowSection onNavigate={onNavigate} />

      {/* 4. 6 Core Capabilities */}
      <CapabilitiesSection onNavigate={onNavigate} />

      {/* 5. Architecture & Security */}
      <ArchitectureSection />

      {/* 6. Industry Solutions Preview */}
      <section className="section-padding" style={{ background: '#ffffff' }}>
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '36px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <span className="badge badge-orange" style={{ marginBottom: '8px' }}>行业实战沉淀</span>
              <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--brand-ink)' }}>垂直行业外贸拓客知识包</h2>
            </div>
            <button onClick={() => onNavigate('/solutions')} className="btn btn-secondary btn-sm">
              查看全部 6 大行业方案 →
            </button>
          </div>

          <div className="grid-cards">
            {INDUSTRY_SOLUTIONS.slice(0, 3).map((sol) => (
              <div
                key={sol.slug}
                className="card"
                onClick={() => onNavigate(`/solutions/${sol.slug}`)}
                style={{ cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span className="badge badge-teal">{sol.nameEn}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>HS: {sol.hsCodesSample[0]} 等</span>
                </div>
                <h3 className="card-title">{sol.name}</h3>
                <p className="card-desc">{sol.tagline}</p>
                <div style={{ background: 'var(--surface-subtle)', padding: '12px', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', marginBottom: '16px' }}>
                  <strong>🏆 落地成效：</strong>{sol.metricResult}
                </div>
                <div style={{ color: 'var(--brand-orange-action)', fontWeight: 600, fontSize: '0.9rem' }}>
                  查看完整行业破冰策略 →
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Case Studies Preview */}
      <section className="section-padding" style={{ background: 'var(--surface-subtle)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 40px' }}>
            <span className="badge badge-teal">真实客户案例</span>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--brand-ink)', margin: '12px 0 16px' }}>
              出海领军企业的高转化增长证据
            </h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              每一份成果均有真实提单到港记录、采购委员会核验与订单合同支撑。
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
            {CASE_STUDIES.map((c) => (
              <div key={c.id} className="card" onClick={() => onNavigate('/cases')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span className="badge badge-orange">{c.industry}</span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{c.region}</span>
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--brand-ink)', marginBottom: '10px' }}>
                  {c.title}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: 'var(--surface-subtle)', padding: '12px', borderRadius: 'var(--radius-sm)', margin: '12px 0' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>回复率</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--status-success)' }}>{c.results.responseRate}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>首期成交额</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--brand-orange-action)' }}>{c.results.closedDeals}</div>
                  </div>
                </div>
                <p style={{ fontStyle: 'italic', fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  {c.quote}
                </p>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 'auto' }}>
                  —— {c.authorTitle} · {c.clientType}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Pricing Section */}
      <PricingSection onNavigate={onNavigate} />

      {/* 9. FAQ Section */}
      <FAQSection />

      {/* 10. Final CTA Banner */}
      <CTASection onNavigate={onNavigate} />
    </>
  );
};

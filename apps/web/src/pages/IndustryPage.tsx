import React from 'react';
import { SEO } from '../components/SEO';
import { INDUSTRY_SOLUTIONS } from '../data/solutions';
import { CTASection } from '../components/CTASection';

interface IndustryPageProps {
  slug: string;
  onNavigate: (path: string) => void;
}

export const IndustryPage: React.FC<IndustryPageProps> = ({ slug, onNavigate }) => {
  const solution = INDUSTRY_SOLUTIONS.find((s) => s.slug === slug) || INDUSTRY_SOLUTIONS[0];

  return (
    <>
      <SEO
        title={`${solution.name} 外贸出海获客解决方案 - 人人易 AI`}
        description={solution.tagline}
        canonical={`/solutions/${solution.slug}`}
      />

      <section className="hero-section">
        <div className="container" style={{ textAlign: 'center', maxWidth: '840px', margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', gap: '8px', marginBottom: '12px' }}>
            <span className="badge badge-orange">行业解决方案</span>
            <span className="badge badge-teal">{solution.nameEn}</span>
          </div>
          <h1 style={{ fontSize: '2.8rem', fontWeight: 800, color: 'var(--brand-ink)', margin: '12px 0 16px' }}>
            {solution.name}
          </h1>
          <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            {solution.tagline}
          </p>
        </div>
      </section>

      {/* Details Section */}
      <section className="section-padding" style={{ background: '#ffffff', borderTop: '1px solid var(--border-subtle)' }}>
        <div className="container" style={{ maxWidth: '900px' }}>
          {/* Pain Points */}
          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--brand-ink)', marginBottom: '16px' }}>
              ⚠️ 该行业出海核心痛点
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {solution.painPoints.map((p, i) => (
                <div key={i} style={{ background: 'var(--surface-subtle)', padding: '16px 20px', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--brand-orange-action)', fontSize: '0.95rem' }}>
                  {p}
                </div>
              ))}
            </div>
          </div>

          {/* HS Codes & Targeting */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '40px' }}>
            <div style={{ background: 'var(--surface-subtle)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '12px', color: 'var(--brand-ink)' }}>
                🚢 核心 HS 编码与海关覆盖
              </h3>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                <div><strong>示例 HS Codes：</strong>{solution.hsCodesSample.join(', ')}</div>
                <div style={{ marginTop: '8px' }}><strong>覆盖区域：</strong>{solution.customsCoverage}</div>
              </div>
            </div>

            <div style={{ background: 'var(--surface-subtle)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '12px', color: 'var(--brand-ink)' }}>
                👥 采购委员会关键决策角色
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                {solution.keyRoles.map((role, i) => (
                  <span key={i} className="badge badge-teal" style={{ fontSize: '0.82rem' }}>{role}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Outreach Strategy & Metric */}
          <div style={{ background: 'linear-gradient(135deg, rgba(224, 106, 20, 0.08) 0%, rgba(15, 118, 110, 0.08) 100%)', borderRadius: 'var(--radius-lg)', padding: '32px', border: '1px solid var(--border-default)', marginBottom: '40px' }}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--brand-ink)', marginBottom: '12px' }}>
              🎯 破冰策略与实战战法
            </h3>
            <p style={{ fontSize: '1rem', color: 'var(--text-primary)', lineHeight: '1.7', marginBottom: '20px' }}>
              {solution.outreachStrategy}
            </p>
            <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>实战数据表现：</span>
                <span style={{ fontWeight: 800, color: 'var(--brand-orange-action)', marginLeft: '6px' }}>{solution.metricResult}</span>
              </div>
              <button onClick={() => onNavigate('/diagnosis')} className="btn btn-primary btn-sm">
                申请该行业诊断报告 →
              </button>
            </div>
          </div>
        </div>
      </section>

      <CTASection onNavigate={onNavigate} />
    </>
  );
};

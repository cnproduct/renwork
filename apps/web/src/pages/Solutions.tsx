import React from 'react';
import { SEO } from '../components/SEO';
import { INDUSTRY_SOLUTIONS } from '../data/solutions';
import { CTASection } from '../components/CTASection';

interface SolutionsProps {
  onNavigate: (path: string) => void;
}

export const Solutions: React.FC<SolutionsProps> = ({ onNavigate }) => {
  return (
    <>
      <SEO
        title="行业解决方案 - 人人易 AI"
        description="专为芯片半导体、建筑文化石、卫浴五金阀门、婴童硅胶、工艺礼品、生物医药原料打造的垂直外贸海关拓客与开发解决方案。"
        canonical="/solutions"
      />

      <section className="hero-section">
        <div className="container" style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
          <span className="badge badge-orange" style={{ marginBottom: '12px' }}>专精行业知识包</span>
          <h1 style={{ fontSize: '2.8rem', fontWeight: 800, color: 'var(--brand-ink)', margin: '12px 0 16px' }}>
            垂直行业精准外贸开拓方案
          </h1>
          <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            不同行业具备完全不同的海关 HS 编码体系、采购链分工、强制认证与切入时机。人人易为您提供经过实战验证的行业拓客知识包。
          </p>
        </div>
      </section>

      <section className="section-padding" style={{ background: '#ffffff', borderTop: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div className="grid-cards">
            {INDUSTRY_SOLUTIONS.map((sol) => (
              <div
                key={sol.slug}
                className="card"
                onClick={() => onNavigate(`/solutions/${sol.slug}`)}
                style={{ cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span className="badge badge-teal">{sol.nameEn}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>HS: {sol.hsCodesSample.join(', ')}</span>
                </div>
                <h3 className="card-title">{sol.name}</h3>
                <p className="card-desc">{sol.tagline}</p>

                <div style={{ margin: '16px 0', fontSize: '0.85rem' }}>
                  <div style={{ fontWeight: 700, marginBottom: '4px', color: 'var(--brand-ink)' }}>🎯 关键决策人：</div>
                  <div style={{ color: 'var(--text-secondary)' }}>{sol.keyRoles.join(' · ')}</div>
                </div>

                <div style={{ background: 'var(--surface-subtle)', padding: '12px', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', marginBottom: '16px' }}>
                  <strong>🏆 实战成效：</strong>{sol.metricResult}
                </div>

                <div style={{ color: 'var(--brand-orange-action)', fontWeight: 600, fontSize: '0.9rem', marginTop: 'auto' }}>
                  查看该行业专属攻坚策略 →
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTASection onNavigate={onNavigate} />
    </>
  );
};

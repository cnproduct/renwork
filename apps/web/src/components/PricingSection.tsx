import React from 'react';
import { PRICING_TIERS, CREDITS_PACKAGES } from '../data/pricing';

interface PricingSectionProps {
  onNavigate: (path: string) => void;
  showFullComparison?: boolean;
}

export const PricingSection: React.FC<PricingSectionProps> = ({ onNavigate, showFullComparison = false }) => {
  return (
    <section className="section-padding" style={{ background: '#ffffff' }}>
      <div className="container">
        <div style={{ textAlign: 'center', maxWidth: '760px', margin: '0 auto 40px' }}>
          <span className="badge badge-orange" style={{ marginBottom: '12px' }}>
            透明梯队定价
          </span>
          <h2 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--brand-ink)', marginBottom: '16px' }}>
            投资高回报率的 AI 外贸增长引擎
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem' }}>
            从个人 SOHO 到跨国贸易集团，灵活的套餐匹配不同业务发展阶段，每分投入皆有真实提单与线索回报。
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="pricing-grid">
          {PRICING_TIERS.slice(0, showFullComparison ? 5 : 4).map((tier) => (
            <div
              key={tier.id}
              className={`pricing-card ${tier.isPopular ? 'featured' : ''}`}
            >
              {tier.isPopular && <div className="pricing-badge">最受欢迎 · 推荐</div>}
              
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--brand-ink)' }}>{tier.name}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '6px 0 16px', minHeight: '38px' }}>
                {tier.tagline}
              </p>

              <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span className="pricing-price">{tier.price}</span>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{tier.billingPeriod}</span>
                </div>
                {tier.originalPrice && (
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                    原价: {tier.originalPrice}
                  </span>
                )}
              </div>

              <div style={{ margin: '16px 0 8px', fontSize: '0.88rem', fontWeight: 600, color: 'var(--brand-orange-action)' }}>
                👤 {tier.seats} · ⚡ {tier.credits}
              </div>

              <ul className="pricing-features">
                {tier.features.map((feat, idx) => (
                  <li key={idx}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--status-success)" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}>
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => onNavigate(tier.ctaLink)}
                className={`btn ${tier.isPopular ? 'btn-primary' : 'btn-secondary'}`}
                style={{ width: '100%', marginTop: 'auto' }}
              >
                {tier.ctaText}
              </button>
            </div>
          ))}
        </div>

        {/* Credits Expansion */}
        {showFullComparison && (
          <div style={{ marginTop: '64px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-lg)', padding: '32px', border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--brand-ink)', marginBottom: '8px' }}>
              ⚡ Credits 算力充值包
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginBottom: '24px' }}>
              Credits 用于按需调用高阶海关深度解析与采购委员会消歧任务。套餐内年度算力用尽后，可随时加购：
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {CREDITS_PACKAGES.map((pkg, i) => (
                <div key={i} style={{ background: '#ffffff', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--brand-ink)' }}>{pkg.amount}</span>
                    <span style={{ fontWeight: 800, color: 'var(--brand-orange-action)', fontSize: '1.2rem' }}>{pkg.price}</span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{pkg.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

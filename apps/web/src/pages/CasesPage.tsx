import React from 'react';
import { SEO } from '../components/SEO';
import { CASE_STUDIES } from '../data/cases';
import { CTASection } from '../components/CTASection';

interface CasesPageProps {
  onNavigate: (path: string) => void;
}

export const CasesPage: React.FC<CasesPageProps> = ({ onNavigate }) => {
  return (
    <>
      <SEO
        title="客户成功案例与海关证据链 - 人人易 AI"
        description="真实外贸企业出海实战案例：半导体、建材、卫浴五金、母婴用品出海领军企业的高转化增长证据与提单佐证。"
        canonical="/cases"
      />

      <section className="hero-section">
        <div className="container" style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
          <span className="badge badge-teal" style={{ marginBottom: '12px' }}>真实商业验证</span>
          <h1 style={{ fontSize: '2.8rem', fontWeight: 800, color: 'var(--brand-ink)', margin: '12px 0 16px' }}>
            客户成功案例与证据链
          </h1>
          <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            拒绝空洞夸大！每一个案例均基于真实的海外到港提单穿透、采购委员会触达与可验证的成交业绩。
          </p>
        </div>
      </section>

      {/* Case Studies List */}
      <section className="section-padding" style={{ background: '#ffffff', borderTop: '1px solid var(--border-subtle)' }}>
        <div className="container" style={{ maxWidth: '1000px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
            {CASE_STUDIES.map((c) => (
              <div
                key={c.id}
                style={{
                  background: 'var(--surface-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '36px',
                  border: '1px solid var(--border-default)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span className="badge badge-orange">{c.industry}</span>
                    <span className="badge badge-teal">{c.region}</span>
                  </div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{c.clientType}</span>
                </div>

                <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--brand-ink)', marginBottom: '16px' }}>
                  {c.title}
                </h2>

                {/* Metrics Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', background: '#ffffff', padding: '20px', borderRadius: 'var(--radius-md)', margin: '20px 0', border: '1px solid var(--border-subtle)' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>穿透买家</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--brand-ink)' }}>{c.results.leadsDiscovered} 家</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>核验采购决策人</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--brand-ink)' }}>{c.results.contactsVerified} 人</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>外联回复率</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--status-success)' }}>{c.results.responseRate}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>样品送测</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--status-info)' }}>{c.results.sampleRequests} 批</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>首期成交额</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--brand-orange-action)' }}>{c.results.closedDeals}</div>
                  </div>
                </div>

                {/* Challenge & Workflow */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', margin: '20px 0' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--brand-ink)', marginBottom: '8px' }}>⚠️ 原始痛点挑战</h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{c.challenge}</p>
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--brand-ink)', marginBottom: '8px' }}>🛠️ RenWork 执行闭环</h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6', whiteSpace: 'pre-line' }}>{c.workflow}</p>
                  </div>
                </div>

                {/* Evidence & Quote */}
                <div style={{ background: '#ffffff', padding: '16px', borderRadius: 'var(--radius-sm)', borderLeft: '4px solid var(--status-success)', marginTop: '20px' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    <strong>🔍 提单真实证据：</strong>{c.evidenceSummary}
                  </div>
                  <div style={{ fontStyle: 'italic', fontSize: '0.92rem', color: 'var(--brand-ink)', fontWeight: 500 }}>
                    {c.quote}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                    —— {c.authorTitle}
                  </div>
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

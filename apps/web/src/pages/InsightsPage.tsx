import React from 'react';
import { SEO } from '../components/SEO';
import { INSIGHT_ARTICLES } from '../data/insights';

export const InsightsPage: React.FC = () => {
  return (
    <>
      <SEO
        title="外贸实战洞察与获客研报 - 人人易 AI"
        description="人人易出海研究院精选研报：海关提单穿透技巧、高转化外贸开发信策略与 TeamAI 团队知识飞轮沉淀方法论。"
        canonical="/insights"
      />

      <section className="hero-section">
        <div className="container" style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
          <span className="badge badge-orange" style={{ marginBottom: '12px' }}>出海前沿研报</span>
          <h1 style={{ fontSize: '2.8rem', fontWeight: 800, color: 'var(--brand-ink)', margin: '12px 0 16px' }}>
            外贸实战洞察与获客研报
          </h1>
          <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            汇聚外贸拓客一线实战经验与 AI 赋能方法论，助您洞察海外买家最新采购趋势。
          </p>
        </div>
      </section>

      <section className="section-padding" style={{ background: '#ffffff', borderTop: '1px solid var(--border-subtle)' }}>
        <div className="container" style={{ maxWidth: '880px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
            {INSIGHT_ARTICLES.map((art) => (
              <article
                key={art.slug}
                style={{
                  background: 'var(--surface-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '32px',
                  border: '1px solid var(--border-default)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span className="badge badge-teal">{art.category}</span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {art.publishedAt} · 阅读时间 {art.readTime}
                  </span>
                </div>

                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--brand-ink)', marginBottom: '12px' }}>
                  {art.title}
                </h2>

                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '20px' }}>
                  {art.summary}
                </p>

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', color: 'var(--text-primary)', lineHeight: '1.8', fontSize: '0.92rem' }}>
                  {art.content.split('\n\n').map((p, i) => (
                    <p key={i} style={{ marginBottom: '12px' }}>{p}</p>
                  ))}
                </div>

                <div style={{ marginTop: '16px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  ✍️ 作者：{art.author}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

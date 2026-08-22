import React, { useState } from 'react';
import { SEO } from '../components/SEO';
import { DOC_SECTIONS } from '../data/docs';

export const DocsPage: React.FC = () => {
  const [activeSlug, setActiveSlug] = useState<string>(DOC_SECTIONS[0].slug);

  const currentDoc = DOC_SECTIONS.find((d) => d.slug === activeSlug) || DOC_SECTIONS[0];

  return (
    <>
      <SEO
        title={`${currentDoc.title} - 使用文档 - 人人易 AI`}
        description={currentDoc.description}
        canonical={`/docs/${currentDoc.slug}`}
      />

      <div className="container" style={{ paddingTop: '40px', paddingBottom: '80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '36px' }}>
          {/* Left Sidebar Nav */}
          <aside style={{ borderRight: '1px solid var(--border-subtle)', paddingRight: '20px' }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--brand-ink)', marginBottom: '16px' }}>
              📖 文档目录 (Docs)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {DOC_SECTIONS.map((doc) => (
                <button
                  key={doc.slug}
                  onClick={() => {
                    setActiveSlug(doc.slug);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  style={{
                    textAlign: 'left',
                    background: activeSlug === doc.slug ? 'var(--surface-subtle)' : 'transparent',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                    fontSize: '0.9rem',
                    fontWeight: activeSlug === doc.slug ? 700 : 500,
                    color: activeSlug === doc.slug ? 'var(--brand-orange-action)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{doc.category}</div>
                  <div>{doc.title}</div>
                </button>
              ))}
            </div>
          </aside>

          {/* Right Content */}
          <main style={{ maxWidth: '800px' }}>
            <div style={{ marginBottom: '24px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
              <span className="badge badge-teal" style={{ marginBottom: '8px' }}>{currentDoc.category}</span>
              <h1 style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--brand-ink)', margin: '8px 0' }}>
                {currentDoc.title}
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
                {currentDoc.description}
              </p>
            </div>

            {/* Markdown rendered content */}
            <div style={{ color: 'var(--text-primary)', lineHeight: '1.8', fontSize: '0.95rem' }}>
              {currentDoc.content.split('\n\n').map((para, i) => {
                if (para.startsWith('## ')) {
                  return <h2 key={i} style={{ fontSize: '1.4rem', fontWeight: 700, margin: '28px 0 12px', color: 'var(--brand-ink)' }}>{para.replace('## ', '')}</h2>;
                }
                if (para.startsWith('### ')) {
                  return <h3 key={i} style={{ fontSize: '1.15rem', fontWeight: 700, margin: '20px 0 10px', color: 'var(--brand-ink)' }}>{para.replace('### ', '')}</h3>;
                }
                return <p key={i} style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>{para}</p>;
              })}
            </div>
          </main>
        </div>
      </div>
    </>
  );
};

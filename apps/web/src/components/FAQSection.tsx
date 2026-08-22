import React, { useState } from 'react';
import { FAQS } from '../data/faq';

export const FAQSection: React.FC = () => {
  const [openIds, setOpenIds] = useState<string[]>([FAQS[0].id, FAQS[1].id]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const toggleFAQ = (id: string) => {
    if (openIds.includes(id)) {
      setOpenIds(openIds.filter((item) => item !== id));
    } else {
      setOpenIds([...openIds, id]);
    }
  };

  const filteredFaqs = selectedCategory === 'all' 
    ? FAQS 
    : FAQS.filter(f => f.category === selectedCategory);

  return (
    <section className="section-padding" style={{ background: 'var(--surface-subtle)' }}>
      <div className="container">
        <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 32px' }}>
          <span className="badge badge-teal" style={{ marginBottom: '12px' }}>
            常见问题与解答
          </span>
          <h2 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--brand-ink)', marginBottom: '16px' }}>
            解答关于人人易 AI 与 RenWork 的一切疑问
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem' }}>
            为您厘清海关数据真伪、OKKI 协同安全、防封号机制与企业数据资产保护策略。
          </p>
        </div>

        {/* Category Filter */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '32px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setSelectedCategory('all')}
            className={`btn btn-sm ${selectedCategory === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          >
            全部问题 ({FAQS.length})
          </button>
          <button
            onClick={() => setSelectedCategory('customs')}
            className={`btn btn-sm ${selectedCategory === 'customs' ? 'btn-primary' : 'btn-secondary'}`}
          >
            海关提单与数据穿透
          </button>
          <button
            onClick={() => setSelectedCategory('security')}
            className={`btn btn-sm ${selectedCategory === 'security' ? 'btn-primary' : 'btn-secondary'}`}
          >
            安全、隐私与本地回路
          </button>
          <button
            onClick={() => setSelectedCategory('product')}
            className={`btn btn-sm ${selectedCategory === 'product' ? 'btn-primary' : 'btn-secondary'}`}
          >
            功能与客户端
          </button>
          <button
            onClick={() => setSelectedCategory('pricing')}
            className={`btn btn-sm ${selectedCategory === 'pricing' ? 'btn-primary' : 'btn-secondary'}`}
          >
            套餐与实施服务
          </button>
        </div>

        {/* FAQ Accordion List */}
        <div className="faq-list">
          {filteredFaqs.map((faq) => {
            const isOpen = openIds.includes(faq.id);
            return (
              <div key={faq.id} className="faq-item" onClick={() => toggleFAQ(faq.id)}>
                <div className="faq-question">
                  <span>{faq.question}</span>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                      flexShrink: 0,
                      marginLeft: '12px'
                    }}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>
                {isOpen && (
                  <div className="faq-answer">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

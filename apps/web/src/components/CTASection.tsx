import React from 'react';

interface CTASectionProps {
  onNavigate: (path: string) => void;
}

export const CTASection: React.FC<CTASectionProps> = ({ onNavigate }) => {
  return (
    <section className="section-padding" style={{ background: 'linear-gradient(135deg, var(--brand-ink) 0%, #3d231e 100%)', color: '#ffffff' }}>
      <div className="container" style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
        <span className="badge badge-orange" style={{ marginBottom: '16px', padding: '6px 14px' }}>
          开启外贸获客新范式
        </span>
        <h2 style={{ fontSize: '2.6rem', fontWeight: 800, marginBottom: '20px', lineHeight: '1.2' }}>
          准备好让 AI 数字员工为您的外贸业绩倍增了吗？
        </h2>
        <p style={{ fontSize: '1.15rem', color: '#d1c8c3', lineHeight: '1.6', marginBottom: '36px' }}>
          只需提交您的企业产品与目标市场，我们的专业出海顾问将在 24 小时内为您免费输出一份定制化的<strong>《海外真实海关买家挖掘与穿透诊断报告》</strong>。
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <button
            onClick={() => onNavigate('/diagnosis')}
            className="btn btn-primary btn-lg"
          >
            免费获取 20 家真实海关买家诊断 →
          </button>
          <button
            onClick={() => onNavigate('/downloads')}
            className="btn btn-secondary btn-lg"
          >
            下载客户端体验
          </button>
        </div>

        <div style={{ marginTop: '28px', fontSize: '0.85rem', color: '#8c827a' }}>
          🔒 承诺：严格遵守企业数据保密协议 · 绝不向任何第三方透露您的主营产品与客户隐私
        </div>
      </div>
    </section>
  );
};

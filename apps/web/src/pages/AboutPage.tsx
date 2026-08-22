import React from 'react';
import { SEO } from '../components/SEO';

interface AboutPageProps {
  onNavigate: (path: string) => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ onNavigate }) => {
  return (
    <>
      <SEO
        title="关于人人易 - 中国外贸 B2B 增长操作系统开创者"
        description="人人易智能科技有限公司 (rrenn.com) 专注研发本地优先、人在回路的外贸 AI 数字员工操作系统，助力中国优质制造扬帆全球。"
        canonical="/about"
      />

      <section className="hero-section">
        <div className="container" style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
          <span className="badge badge-orange" style={{ marginBottom: '12px' }}>关于我们</span>
          <h1 style={{ fontSize: '2.8rem', fontWeight: 800, color: 'var(--brand-ink)', margin: '12px 0 16px' }}>
            人人易智能科技有限公司
          </h1>
          <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            致力于以严谨的事实基底与本地优先的人工智能技术，重构中国外贸出海企业的全球客户开拓与转化飞轮。
          </p>
        </div>
      </section>

      <section className="section-padding" style={{ background: '#ffffff', borderTop: '1px solid var(--border-subtle)' }}>
        <div className="container" style={{ maxWidth: '880px' }}>
          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--brand-ink)', marginBottom: '16px' }}>
              我们的使命与价值观
            </h2>
            <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: '1.8', marginBottom: '16px' }}>
              在全球贸易格局深刻重塑的今天，中国外贸企业面临着从“低价代工”向“自主品牌与高质量直销”转型的历史关口。传统买家数据鱼龙混杂、泛 AI 概念工具幻觉频出，严重阻碍了出海企业的数字化进程。
            </p>
            <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
              人人易坚信：<strong>事实是一切商业沟通的基石</strong>。我们拒绝制造未经证实的虚假数据，坚持本地优先架构保护企业客户隐私，让每一位外贸业务员都能在 AI 数字员工的协同下，成为具备全球视野的商业谈判专家。
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '48px' }}>
            <div style={{ background: 'var(--surface-subtle)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--brand-ink)', marginBottom: '10px' }}>
                🏢 官方联络方式
              </h3>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
                <div><strong>企业名称：</strong>人人易智能科技有限公司</div>
                <div><strong>官方网站：</strong>www.rrenn.com</div>
                <div><strong>商务咨询：</strong>contact@rrenn.com</div>
                <div><strong>客户服务：</strong>support@rrenn.com</div>
                <div><strong>技术响应：</strong>周一至周五 09:00 - 18:00 (GMT+8)</div>
              </div>
            </div>

            <div style={{ background: 'var(--surface-subtle)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--brand-ink)', marginBottom: '10px' }}>
                🤝 战略合作通道
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '16px' }}>
                欢迎外贸产业带园区、进出口商会、跨境电商服务平台洽谈战略合作与联合赋能。
              </p>
              <button onClick={() => onNavigate('/diagnosis')} className="btn btn-primary btn-sm">
                预约合作洽谈 →
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

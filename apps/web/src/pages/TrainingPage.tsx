import React from 'react';
import { SEO } from '../components/SEO';
import { CTASection } from '../components/CTASection';

interface TrainingPageProps {
  onNavigate: (path: string) => void;
}

export const TrainingPage: React.FC<TrainingPageProps> = ({ onNavigate }) => {
  return (
    <>
      <SEO
        title="外贸 AI 增长实战训练营 - 人人易 AI"
        description="人人易外贸 AI 实战训练体系：从企业产品图谱构建、海关提单穿透到采购委员会多点触达的系统化实战课程。"
        canonical="/training"
      />

      <section className="hero-section">
        <div className="container" style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
          <span className="badge badge-orange" style={{ marginBottom: '12px' }}>赋能外贸业务军团</span>
          <h1 style={{ fontSize: '2.8rem', fontWeight: 800, color: 'var(--brand-ink)', margin: '12px 0 16px' }}>
            外贸 AI 实战赋能训练营
          </h1>
          <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            不仅交付强大的软件工具，更通过系统化实战培训帮助您的外贸团队全面掌握 AI 获客方法论。
          </p>
        </div>
      </section>

      <section className="section-padding" style={{ background: '#ffffff', borderTop: '1px solid var(--border-subtle)' }}>
        <div className="container" style={{ maxWidth: '900px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '40px' }}>
            <div className="card">
              <span className="badge badge-teal" style={{ marginBottom: '8px' }}>模块一</span>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '8px' }}>企业产品 DNA 建模实战</h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                如何将零散的产品目录、质检证书与报价政策沉淀为不可动摇的 ProductProfile 事实底座。
              </p>
            </div>

            <div className="card">
              <span className="badge badge-teal" style={{ marginBottom: '8px' }}>模块二</span>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '8px' }}>海关提单与异动捕捉实操</h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                手把手教学如何辨识真假买家、分析原供货商供货异动，并在黄金窗口期切入客户。
              </p>
            </div>

            <div className="card">
              <span className="badge badge-teal" style={{ marginBottom: '8px' }}>模块三</span>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '8px' }}>高转化开发信与风险逆转 Offer</h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                掌握 10 维原子证据开发信写作法与 3 轮序列设计，彻底摆脱群发进垃圾箱困境。
              </p>
            </div>
          </div>
        </div>
      </section>

      <CTASection onNavigate={onNavigate} />
    </>
  );
};

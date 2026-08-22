import React from 'react';
import { SEO } from '../components/SEO';
import { CTASection } from '../components/CTASection';

interface CapabilityPageProps {
  onNavigate: (path: string) => void;
}

export const TeamIntelligence: React.FC<CapabilityPageProps> = ({ onNavigate }) => {
  return (
    <>
      <SEO
        title="Team Intelligence 团队知识治理与自进化系统 - 人人易 AI"
        description="基于 Git 原生的外贸团队知识库治理体系。沉淀销冠实战经验，通过 Recall 知识召回与 Learning PR 审查机制，实现新人入职即销冠。"
        canonical="/product/team-intelligence"
      />

      <section className="hero-section">
        <div className="container" style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
          <span className="badge badge-teal" style={{ marginBottom: '12px' }}>能力模块 06</span>
          <h1 style={{ fontSize: '2.8rem', fontWeight: 800, color: 'var(--brand-ink)', margin: '12px 0 16px' }}>
            Team Intelligence<br />TeamAI 团队知识治理与自进化
          </h1>
          <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            将优秀业务员的拓客智慧、谈判让步与破冰策略固化为企业数字资产。Git 原生版本化，构建可持续进化的外贸知识飞轮。
          </p>
        </div>
      </section>

      <section className="section-padding" style={{ background: '#ffffff', borderTop: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px', marginBottom: '60px' }}>
            <div className="card">
              <h3 className="card-title">📚 团队专属技能库 (.teamai/skills/)</h3>
              <p className="card-desc">
                标准化封装企业产品参数、行业 HS 词典、买家分级模型与拒信应对策略，统一团队外贸作业标准，避免各自为政。
              </p>
            </div>

            <div className="card">
              <h3 className="card-title">🔄 经验自动提炼与 Learning PR</h3>
              <p className="card-desc">
                业务员对 AI 建议的改写被系统智能捕获并归纳为规则候选项。经外贸主管在 GitHub/TeamAI 平台审查批准后，一键合并为全员知识。
              </p>
            </div>

            <div className="card">
              <h3 className="card-title">⚡ Recall 知识即时召回</h3>
              <p className="card-desc">
                面对特定国家或产品时，工作台自动向业务员呈现过往团队在同类场景下的最佳话术与成功证据，真正实现“新人入职即销冠”。
              </p>
            </div>
          </div>
        </div>
      </section>

      <CTASection onNavigate={onNavigate} />
    </>
  );
};

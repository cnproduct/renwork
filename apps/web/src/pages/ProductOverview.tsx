import React from 'react';
import { SEO } from '../components/SEO';
import { CapabilitiesSection } from '../components/CapabilitiesSection';
import { CTASection } from '../components/CTASection';

interface ProductOverviewProps {
  onNavigate: (path: string) => void;
}

export const ProductOverview: React.FC<ProductOverviewProps> = ({ onNavigate }) => {
  return (
    <>
      <SEO
        title="产品能力总览 - 企业级外贸 B2B 增长操作系统"
        description="RenWork 三层能力架构：执行层 (Desktop/Local) + 能力层 (Skills/MCP/API) + 治理层 (TeamAI)，全面实现外贸客户开发与转化的工业级自动化。"
        canonical="/product"
      />

      <section className="hero-section" style={{ paddingBottom: '40px' }}>
        <div className="container" style={{ textAlign: 'center', maxWidth: '820px', margin: '0 auto' }}>
          <span className="badge badge-orange" style={{ marginBottom: '12px' }}>
            RenWork 三层能力架构体系
          </span>
          <h1 style={{ fontSize: '2.8rem', fontWeight: 800, color: 'var(--brand-ink)', margin: '12px 0 20px' }}>
            专为外贸实战设计的 AI 增长系统
          </h1>
          <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            不仅是聊天机器人，而是深度贯通海关数据、CRM、社交网络与邮件网关的端到端自动化业务底座。
          </p>
        </div>
      </section>

      {/* 3-Tier Architecture Breakdown */}
      <section className="section-padding" style={{ background: '#ffffff', borderTop: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '60px' }}>
            {/* Layer 1 */}
            <div className="card" style={{ borderTop: '4px solid var(--brand-orange)' }}>
              <div className="card-icon">💻</div>
              <h3 className="card-title">1. 执行层 (Execution Layer)</h3>
              <p className="card-desc">
                <strong>RenWork Desktop / Local</strong>：在业务员本地电脑运行的桌面工作台。承载可见浏览器自动化、本地文件解析、OS Keychain 安全加密及人工最终审批门禁。会话 Cookie 零上传，彻底杜绝云端托管封号风险。
              </p>
            </div>

            {/* Layer 2 */}
            <div className="card" style={{ borderTop: '4px solid var(--status-info)' }}>
              <div className="card-icon">⚡</div>
              <h3 className="card-title">2. 能力层 (Capability Layer)</h3>
              <p className="card-desc">
                <strong>Skills & MCP 网关</strong>：标准化封装海关意图评分、OKKI 采购委员会穿透、LinkedIn 实体消歧、Zoho/SMTP 发信网关与 6 语种社媒矩阵排期，提供确定性、高并发、可审计的微服务调用契约。
              </p>
            </div>

            {/* Layer 3 */}
            <div className="card" style={{ borderTop: '4px solid var(--status-success)' }}>
              <div className="card-icon">🧠</div>
              <h3 className="card-title">3. 治理层 (Governance Layer)</h3>
              <p className="card-desc">
                <strong>TeamAI 团队智能</strong>：Git 原生知识治理体系。包含团队专属技能库 (<code>.teamai/skills/</code>)、团队实战经验维基 (<code>teamwiki/</code>)、前置/后置合规门禁 Hook、Recall 知识即时召回与自进化 Learning PR 机制。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6 Capabilities Cards */}
      <CapabilitiesSection onNavigate={onNavigate} />

      {/* Final CTA */}
      <CTASection onNavigate={onNavigate} />
    </>
  );
};

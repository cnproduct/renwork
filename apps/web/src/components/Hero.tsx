import React from 'react';

interface HeroProps {
  onNavigate: (path: string) => void;
}

export const Hero: React.FC<HeroProps> = ({ onNavigate }) => {
  return (
    <section className="hero-section">
      <div className="container">
        <div className="hero-content">
          {/* Release Badge */}
          <div style={{ display: 'inline-block', marginBottom: '16px' }}>
            <span className="badge badge-orange" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
              ⚡ RenWork v0.18.43 稳定版上线：支持 180 天海关提单穿透与 OKKI 本地回路
            </span>
          </div>

          {/* Main Title */}
          <h1 className="hero-title">
            把真实买家，<br />
            变成可持续推进的客户关系
          </h1>

          {/* Subtitle */}
          <p className="hero-subtitle">
            人人易 AI (rrenn.com) 融合<strong>海关提单穿透</strong>、<strong>OKKI 采购委员会解析</strong>、<strong>LinkedIn 360</strong> 与<strong>高转化邮件序列</strong>，为中国出海企业打造本地优先、人在回路的 B2B AI 增长操作系统。
          </p>

          {/* Action CTAs */}
          <div className="hero-actions">
            <button
              onClick={() => onNavigate('/diagnosis')}
              className="btn btn-primary btn-lg"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              预约 AI 增长诊断 (免费评估)
            </button>
            <button
              onClick={() => onNavigate('/downloads')}
              className="btn btn-secondary btn-lg"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              下载 RenWork 客户端
            </button>
          </div>

          {/* Evidence Trust Badges */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', flexWrap: 'wrap', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '40px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--status-success)" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
              拒绝虚假群发
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--status-success)" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
              真实提单原子证据
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--status-success)" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
              本地 Cookie 零上传
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--status-success)" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
              人在回路人工审批
            </span>
          </div>
        </div>

        {/* Product UI Window Preview */}
        <div className="preview-window">
          <div className="preview-header">
            <div className="window-dots">
              <div className="window-dot red"></div>
              <div className="window-dot yellow"></div>
              <div className="window-dot green"></div>
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              RenWork Desktop — Buyer Intent & Procurement Committee Discovery (DEMO MODE)
            </div>
            <div className="badge badge-teal" style={{ fontSize: '0.75rem' }}>
              ● 本地沙箱已连接
            </div>
          </div>
          
          <div className="preview-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
              {/* Left Column: Discovered Real Buyer */}
              <div style={{ background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', padding: '16px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--brand-ink)' }}>NexTech Electronics Inc.</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>US / 加利福尼亚州 · EMS 制造终端</p>
                  </div>
                  <span className="badge badge-orange" style={{ fontWeight: 800 }}>Intent A+ (94分)</span>
                </div>

                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px', margin: '12px 0' }}>
                  <div><strong>🚢 海关提单：</strong>近 180 天 18 批次到港 (累计 42 TEU)</div>
                  <div><strong>⚠️ 供应链异动：</strong>原供应商交期由 4 周延至 12 周</div>
                  <div><strong>🎯 匹配产品：</strong>功率半导体 MOSFET / 替代物料 MPN</div>
                </div>

                <div style={{ borderTop: '1px dashed var(--border-default)', paddingTop: '10px', marginTop: '10px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px', color: 'var(--brand-ink)' }}>👥 采购委员会 (Buying Committee):</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.78rem' }}>
                    <div style={{ background: '#ffffff', padding: '6px 8px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>David Miller (VP Global Sourcing)</span>
                      <span style={{ color: 'var(--status-success)' }}>✓ 邮箱已核验</span>
                    </div>
                    <div style={{ background: '#ffffff', padding: '6px 8px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Sarah Chen (Lead Component Engineer)</span>
                      <span style={{ color: 'var(--status-info)' }}>● LinkedIn 匹配</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: AI Outreach Sequence & Approval Gate */}
              <div style={{ background: '#ffffff', borderRadius: 'var(--radius-md)', padding: '16px', border: '1px solid var(--border-default)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--brand-ink)' }}>
                    ✉️ 智能外联草稿与合规审批 (Approval Gate)
                  </span>
                  <span className="badge badge-teal">审批状态: 等待人工确认</span>
                </div>

                <div style={{ background: 'var(--surface-subtle)', padding: '12px', borderRadius: '6px', fontSize: '0.82rem', fontFamily: 'monospace', color: 'var(--text-primary)', marginBottom: '12px', lineHeight: '1.5' }}>
                  <strong>Subject:</strong> Quick question regarding MPN cross-reference & stock for NexTech EMS line<br /><br />
                  Hi David,<br /><br />
                  Noticed NexTech recently expanded the California SMT line with 18 shipments of power modules. In light of recent 12-week component lead time delays from EU suppliers, we've prepared a direct <strong>Pin-to-Pin Cross Reference matrix</strong> with full AEC-Q101 test reports.<br /><br />
                  Would you be open to receiving a <strong>free express sample pack (50 units)</strong> to test on your fixture this week?
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    🛡️ 安全门禁: 已注入退订链接 · 发信频率控制正常 · 时区已对齐美西 09:30
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-secondary btn-sm">修改文案</button>
                    <button className="btn btn-primary btn-sm">✓ 批准并加入发送队列</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

import React from 'react';

export const ArchitectureSection: React.FC = () => {
  return (
    <section className="section-padding" style={{ background: 'var(--brand-ink)', color: '#ffffff' }}>
      <div className="container">
        <div style={{ textAlign: 'center', maxWidth: '780px', margin: '0 auto 48px' }}>
          <span className="badge badge-orange" style={{ marginBottom: '12px' }}>
            架构与安全边界
          </span>
          <h2 style={{ fontSize: '2.4rem', fontWeight: 800, color: '#ffffff', marginBottom: '16px' }}>
            本地优先 (Local-First) × 腾讯云轻量微服务
          </h2>
          <p style={{ color: '#a89f99', fontSize: '1.05rem', lineHeight: '1.6' }}>
            我们深知外贸客户数据与海外账号的极度敏感性。人人易坚持严苛的技术物理隔离，彻底切断账号泄露与大模型数据污染风险。
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          {/* Security Pillar 1 */}
          <div style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 'var(--radius-lg)', padding: '28px' }}>
            <div style={{ fontSize: '2rem', marginBottom: '16px' }}>💻</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '12px', color: '#ffffff' }}>
              本地执行端：Cookie 零上传
            </h3>
            <p style={{ color: '#a89f99', fontSize: '0.92rem', lineHeight: '1.6' }}>
              OKKI / 小满 CRM 与 LinkedIn 的所有网页操作完全运行在业务员本地电脑的可见浏览器中。会话 Cookie 与账号密码只存本地系统 Keychain，绝不上传云端，杜绝批量封号风险。
            </p>
          </div>

          {/* Security Pillar 2 */}
          <div style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 'var(--radius-lg)', padding: '28px' }}>
            <div style={{ fontSize: '2rem', marginBottom: '16px' }}>🛡️</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '12px', color: '#ffffff' }}>
              人在回路：严格审批门禁
            </h3>
            <p style={{ color: '#a89f99', fontSize: '0.92rem', lineHeight: '1.6' }}>
              AI 仅承担海关数据深度背调、痛点挖掘与高转化草稿生成。所有对外发送的邮件、LinkedIn InMail 或社媒互动，必须经过业务员在客户端界面明确点击确认后方可执行。
            </p>
          </div>

          {/* Security Pillar 3 */}
          <div style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 'var(--radius-lg)', padding: '28px' }}>
            <div style={{ fontSize: '2rem', marginBottom: '16px' }}>☁️</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '12px', color: '#ffffff' }}>
              腾讯云空间：轻量合规与版本分发
            </h3>
            <p style={{ color: '#a89f99', fontSize: '0.92rem', lineHeight: '1.6' }}>
              云端服务器 (43.135.182.81) 仅承载官网展示、合规线索落库、版本签名清单与轻量 API，与本地企业数据完全物理隔离，各站点独立隔离运行。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

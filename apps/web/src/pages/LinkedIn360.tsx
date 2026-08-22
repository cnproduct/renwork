import React from 'react';
import { SEO } from '../components/SEO';
import { CTASection } from '../components/CTASection';

interface CapabilityPageProps {
  onNavigate: (path: string) => void;
}

export const LinkedIn360: React.FC<CapabilityPageProps> = ({ onNavigate }) => {
  return (
    <>
      <SEO
        title="LinkedIn 360 多维实体匹配与信号时间线 - 人人易 AI"
        description="精准匹配目标买家 LinkedIn 企业主页与采购委员会个人主页，监控业务动态与换岗信号。拟定专业互动与 InMail，坚持人在回路人工审批。"
        canonical="/product/linkedin-360"
      />

      <section className="hero-section">
        <div className="container" style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
          <span className="badge badge-orange" style={{ marginBottom: '12px' }}>能力模块 03</span>
          <h1 style={{ fontSize: '2.8rem', fontWeight: 800, color: 'var(--brand-ink)', margin: '12px 0 16px' }}>
            LinkedIn 360<br />多维实体匹配与动态监控
          </h1>
          <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            通过多维置信度算法锁定目标买家企业与关键决策人领英档案，AI 拟定专业互动与 InMail，业务员一键审批，合规建立海外商业互信。
          </p>
        </div>
      </section>

      <section className="section-padding" style={{ background: '#ffffff', borderTop: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px', marginBottom: '60px' }}>
            <div className="card">
              <h3 className="card-title">🎯 实体消歧与多维匹对</h3>
              <p className="card-desc">
                不仅比对公司名，更深度比对官方域名、母子公司关系、行业分支、地理位置与产品关键词，彻底解决同名混淆，给出明确的 Match Score 与理由。
              </p>
            </div>

            <div className="card">
              <h3 className="card-title">📡 买家动态与采购信号时间线</h3>
              <p className="card-desc">
                聚合目标企业的海外展会动向、招聘扩张、新品发布、决策人升职/跳槽等实时信号，为外贸业务员提供绝佳的破冰谈资与联系切入点 (Why-Now Trigger)。
              </p>
            </div>

            <div className="card">
              <h3 className="card-title">🛡️ 人在回路与审批工作流</h3>
              <p className="card-desc">
                所有点赞、专业技术评论、连接邀请附言与 InMail 草稿默认进入 <code>awaiting_approval</code> 队列，业务员确认后方可执行，坚决不进行违规自动群控。
              </p>
            </div>
          </div>
        </div>
      </section>

      <CTASection onNavigate={onNavigate} />
    </>
  );
};

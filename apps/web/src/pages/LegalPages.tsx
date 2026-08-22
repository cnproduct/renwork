import React from 'react';
import { SEO } from '../components/SEO';

interface LegalPageProps {
  type: 'privacy' | 'terms' | 'cookies' | 'anti-spam' | 'open-source' | 'status';
  onNavigate: (path: string) => void;
}

export const LegalPages: React.FC<LegalPageProps> = ({ type }) => {
  const titles = {
    privacy: '隐私保护政策 (Privacy Policy)',
    terms: '服务条款 (Terms of Service)',
    cookies: 'Cookie 政策与数据收集声明',
    'anti-spam': '反垃圾邮件政策 (Anti-Spam Policy)',
    'open-source': '开源与第三方许可证声明 (Open Source)',
    status: '人人易 AI 系统服务运行状态 (System Status)'
  };

  return (
    <>
      <SEO
        title={`${titles[type]} - 人人易 AI (rrenn.com)`}
        description={`人人易智能科技有限公司官方 ${titles[type]} 权威条款与合规声明。`}
        canonical={`/${type}`}
      />

      <div className="container" style={{ maxWidth: '840px', paddingTop: '60px', paddingBottom: '80px' }}>
        <span className="badge badge-orange" style={{ marginBottom: '12px' }}>法律合规与透明度</span>
        <h1 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--brand-ink)', marginBottom: '24px' }}>
          {titles[type]}
        </h1>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '32px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
          版本号：2026-08-22 V1.0 · 生效日期：2026-08-22 · 运营主体：人人易智能科技有限公司
        </div>

        {type === 'privacy' && (
          <div style={{ color: 'var(--text-secondary)', lineHeight: '1.8', fontSize: '0.95rem' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--brand-ink)', margin: '20px 0 10px' }}>1. 我们收集的信息与数据边界</h2>
            <p>人人易 AI 坚持“本地优先”与“最小必要”原则。在您使用 RenWork 客户端时，您的第三方账号密码（如 OKKI、LinkedIn）、会话 Cookie 仅保存在您本地受限沙箱中，绝不会被传输或保存在我们的云端服务器。官网表单收集的企业名称、工作邮箱与主营品类仅用于出具诊断报告与联系沟通。</p>

            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--brand-ink)', margin: '20px 0 10px' }}>2. 企业数据主权与禁止大模型训练承诺</h2>
            <p>我们承诺：您的企业产品手册、客户通讯录、报价单与沟通记录属于您企业的绝对核心机密。人人易绝不会将您的任何非公开企业数据用于公共基础大模型的二次训练或共享给任何第三方。</p>

            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--brand-ink)', margin: '20px 0 10px' }}>3. 数据更正、导出与注销删除权利</h2>
            <p>您有权随时联系 support@rrenn.com 要求查阅、导出或永久删除您提交给我们的所有企业信息。我们将在收到验证请求后的 3 个工作日内完成不可逆清除。</p>
          </div>
        )}

        {type === 'terms' && (
          <div style={{ color: 'var(--text-secondary)', lineHeight: '1.8', fontSize: '0.95rem' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--brand-ink)', margin: '20px 0 10px' }}>1. 服务范围与授权</h2>
            <p>人人易智能科技有限公司向您提供 RenWork 外贸 B2B AI 增长操作系统及相关云端微服务。用户应在合法合规的前提下使用本系统开展正当的跨境商业贸易沟通。</p>

            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--brand-ink)', margin: '20px 0 10px' }}>2. 人在回路 (Human-in-the-Loop) 责任约定</h2>
            <p>RenWork 客户端提供的海关数据分析、评分与文案草稿仅作为商业辅助建议。用户业务员在审批并对外发出任何邮件、InMail 或商务报价前，必须进行核对与最终确认，并对其商业决策独立承担责任。</p>
          </div>
        )}

        {type === 'cookies' && (
          <div style={{ color: 'var(--text-secondary)', lineHeight: '1.8', fontSize: '0.95rem' }}>
            <p>本网站 (rrenn.com) 仅使用维持网站基本运行与表单防重放所必需的技术性 Cookie 与安全令牌。我们不使用侵入式的第三方追踪 Cookie，亦不进行跨站身份追踪。</p>
          </div>
        )}

        {type === 'anti-spam' && (
          <div style={{ color: 'var(--text-secondary)', lineHeight: '1.8', fontSize: '0.95rem' }}>
            <p>人人易坚决反对任何形式的垃圾邮件与违规暴力群发。RenWork 系统内置强制性反垃圾邮件合规防护机制：</p>
            <ul style={{ listStylePosition: 'inside', margin: '16px 0' }}>
              <li>所有邮件草稿自动包含合规的退订 (Unsubscribe) 指引与发信人企业主体标识；</li>
              <li>严格执行单域名发信频率限额与随机延迟，避免对收件服务器造成冲击；</li>
              <li>接收到退信 (Bounce) 或退订信号时，系统将立即永久停止针对该联系人的后续序列。</li>
            </ul>
          </div>
        )}

        {type === 'open-source' && (
          <div style={{ color: 'var(--text-secondary)', lineHeight: '1.8', fontSize: '0.95rem' }}>
            <p>RenWork 遵循开源开放精神，桌面端部分核心组件基于 Apache-2.0 / MIT 开源协议构建，开源仓库地址为 <a href="https://github.com/davidlai0902-code/renwork" target="_blank" rel="noreferrer" style={{ color: 'var(--brand-orange-action)', textDecoration: 'underline' }}>github.com/davidlai0902-code/renwork</a>。我们向全球开源社区与模型贡献者致以崇高的敬意。</p>
          </div>
        )}

        {type === 'status' && (
          <div style={{ color: 'var(--text-secondary)', lineHeight: '1.8', fontSize: '0.95rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', margin: '24px 0' }}>
              <div style={{ background: 'var(--surface-subtle)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, color: 'var(--brand-ink)' }}>官网与内容服务</span>
                  <span className="badge badge-teal">● 正常运行</span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>可用性: 99.98% · 延迟: 28ms</div>
              </div>

              <div style={{ background: 'var(--surface-subtle)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, color: 'var(--brand-ink)' }}>海关提单穿透引擎</span>
                  <span className="badge badge-teal">● 正常运行</span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>数据更新: 今日 02:00 UTC</div>
              </div>

              <div style={{ background: 'var(--surface-subtle)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, color: 'var(--brand-ink)' }}>安装包 COS 镜像节点</span>
                  <span className="badge badge-teal">● 正常运行</span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>v0.18.43 SHA 验证通过</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

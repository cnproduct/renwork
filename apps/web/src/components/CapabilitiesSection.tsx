import React from 'react';

interface CapabilitiesSectionProps {
  onNavigate: (path: string) => void;
}

export const CapabilitiesSection: React.FC<CapabilitiesSectionProps> = ({ onNavigate }) => {
  const capabilities = [
    {
      id: "buyer-intent",
      title: "Buyer Intent (海关意图评分)",
      desc: "直连全球官方提单库，穿透近 180 天真实采购商 (Consignee)。自动剔除 NVOCC 货代，基于产品匹配度与供应异动输出可解释的 Intent Score (A+/A/B/C)。",
      icon: "🚢",
      badge: "海关直连",
      path: "/product/buyer-intent"
    },
    {
      id: "contact-intelligence",
      title: "Contact Intelligence (采购委员会穿透)",
      desc: "海关锁定‘哪家公司’，OKKI 本地适配器穿透‘联系谁’。深度解析采购总监、工程主管与合规专员，实现 C1/C2/C0 级别真实邮箱与电话多源核验。",
      icon: "👥",
      badge: "OKKI 本地回路",
      path: "/product/contact-intelligence"
    },
    {
      id: "linkedin-360",
      title: "LinkedIn 360 (多维实体匹配)",
      desc: "精准关联目标企业与个人领英主页，跟踪换岗、展会与业务动态。AI 拟定针对性破冰评论与 InMail 草稿，业务员人工审批后执行，合规防封。",
      icon: "💼",
      badge: "人在回路",
      path: "/product/linkedin-360"
    },
    {
      id: "outreach",
      title: "Outreach (高转化外联序列)",
      desc: "支持 Zoho Mail、企业 SMTP 465/587 专属发件网关。结合 10 维背调证据与风险逆转 Offer，内置发信频率控制、退订检测与域名声誉熔断机制。",
      icon: "✉️",
      badge: "退信熔断保护",
      path: "/product/outreach"
    },
    {
      id: "social-matrix",
      title: "Social Matrix (6 语种社媒营销)",
      desc: "基于统一产品事实包，一键派生英、德、日、西、越、泰等 6 语种本地化社媒营销内容，覆盖 LinkedIn、Facebook、官网博客与海外短视频矩阵。",
      icon: "🌐",
      badge: "6 语种本地化",
      path: "/product/social-matrix"
    },
    {
      id: "team-intelligence",
      title: "Team Intelligence (TeamAI 团队治理)",
      desc: "基于 Git 原生的外贸团队知识沉淀系统。自动捕获业务员优质改写，生成 Learning PR，通过 Recall 机制让新手业务员瞬间掌握金牌销冠的话术库。",
      icon: "🧠",
      badge: "团队自进化",
      path: "/product/team-intelligence"
    }
  ];

  return (
    <section className="section-padding">
      <div className="container">
        <div style={{ textAlign: 'center', maxWidth: '760px', margin: '0 auto 48px' }}>
          <span className="badge badge-teal" style={{ marginBottom: '12px' }}>
            六大核心专业模块
          </span>
          <h2 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--brand-ink)', marginBottom: '16px' }}>
            构建外贸企业的核心 AI 数字生产力
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem' }}>
            每一个功能模块均严格遵循行业真实数据源、隐私安全契约与可解释性原则，绝无虚假数据。
          </p>
        </div>

        <div className="grid-cards">
          {capabilities.map((cap) => (
            <div
              key={cap.id}
              className="card"
              onClick={() => onNavigate(cap.path)}
              style={{ cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="card-icon" style={{ fontSize: '1.5rem' }}>{cap.icon}</div>
                <span className="badge badge-orange">{cap.badge}</span>
              </div>
              <h3 className="card-title">{cap.title}</h3>
              <p className="card-desc">{cap.desc}</p>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--brand-orange-action)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                深入查看技术规范与参数 →
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

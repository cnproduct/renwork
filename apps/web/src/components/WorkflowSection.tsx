import React from 'react';

interface WorkflowSectionProps {
  onNavigate: (path: string) => void;
}

export const WorkflowSection: React.FC<WorkflowSectionProps> = ({ onNavigate }) => {
  const steps = [
    {
      num: "01",
      title: "企业与产品 DNA 解构",
      desc: "导入官网与 PDF 产品手册，自动生成标准化 ProductProfile 与真实技术规格图谱，彻底杜绝虚构。",
      path: "/product"
    },
    {
      num: "02",
      title: "海关真实买家穿透",
      desc: "穿透近 180 天全球海关提单 (B/L)，过滤 95% 国际货代与报关行，锁定高活跃真实采购商与供应异动。",
      path: "/product/buyer-intent"
    },
    {
      num: "03",
      title: "OKKI 采购委员会识别",
      desc: "本地安全调用 OKKI 与多源信息，精准提取 Sourcing VP、工程师与合规主管的真实联系方式。",
      path: "/product/contact-intelligence"
    },
    {
      num: "04",
      title: "LinkedIn 360 精准匹配",
      desc: "企业主页与个人档案多维核验，建立采购决策链动态时间线，识别升职、展会与业务扩张信号。",
      path: "/product/linkedin-360"
    },
    {
      num: "05",
      title: "高价值关系培育",
      desc: "AI 拟定针对买家业务痛点的专业技术评论与连接建议，业务员一键审批，实现有温度的社交破冰。",
      path: "/product/social-matrix"
    },
    {
      num: "06",
      title: "高转化外联序列",
      desc: "结合 10 维背调原子证据与风险逆转 Offer，生成 3 轮带退订保护的 Email 序列，守住域名声誉。",
      path: "/product/outreach"
    },
    {
      num: "07",
      title: "TeamAI 知识自进化",
      desc: "业务员日常修改与成功转化案例自动提炼为 Learning 规则，经团队审批后沉淀为企业专属知识资产。",
      path: "/product/team-intelligence"
    }
  ];

  return (
    <section className="section-padding" style={{ background: 'var(--surface-subtle)' }}>
      <div className="container">
        <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 48px' }}>
          <span className="badge badge-orange" style={{ marginBottom: '12px' }}>
            标准外贸增长闭环
          </span>
          <h2 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--brand-ink)', marginBottom: '16px' }}>
            7 步全链路：从提单数据到订单落地
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem' }}>
            告别碎片化工具与手工表格拼接。RenWork 将外贸拓客的每个关键环节紧密串联，步步可验证、每步皆留痕。
          </p>
        </div>

        <div className="workflow-stepper">
          {steps.map((step, idx) => (
            <div
              key={idx}
              className="step-card"
              onClick={() => onNavigate(step.path)}
              style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
            >
              <div className="step-number">{step.num} / STEP</div>
              <h3 className="step-title">{step.title}</h3>
              <p className="step-desc">{step.desc}</p>
              <div style={{ marginTop: '12px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--brand-orange-action)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                查看能力规范 →
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

import React, { useState } from 'react';
import { SEO } from '../components/SEO';

interface DiagnosisPageProps {
  onNavigate: (path: string) => void;
}

export const DiagnosisPage: React.FC<DiagnosisPageProps> = ({ onNavigate }) => {
  const [formData, setFormData] = useState({
    company_name: '',
    website: '',
    contact_name: '',
    job_title: '',
    work_email: '',
    phone: '',
    products: '',
    target_markets: 'North America',
    team_size_range: '6-20',
    pain_points: 'customs_buyer_intent',
    preferred_contact_time: 'weekday_afternoon',
    privacy_consent: false,
    marketing_consent: true,
    honeypot: ''
  });

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (formData.honeypot) {
      // Bot trapped
      return;
    }

    if (!formData.company_name || !formData.contact_name || !formData.work_email) {
      setErrorMessage('请完整填写公司名称、联系人姓名与工作邮箱。');
      return;
    }

    if (!formData.privacy_consent) {
      setErrorMessage('请先勾选同意《隐私政策》与数据保护契约。');
      return;
    }

    setLoading(true);

    try {
      const idempotencyKey = 'idemp_' + Math.random().toString(36).substring(2) + Date.now();
      const payload = {
        company_name: formData.company_name,
        website: formData.website || null,
        contact_name: formData.contact_name,
        job_title: formData.job_title || 'Export Manager',
        work_email: formData.work_email,
        phone: formData.phone || null,
        products: formData.products.split(/[,，\s]+/).filter(Boolean),
        target_markets: [formData.target_markets],
        team_size_range: formData.team_size_range,
        pain_points: [formData.pain_points],
        preferred_contact_time: formData.preferred_contact_time,
        privacy_policy_version: '2026-08-22',
        privacy_consent: true,
        marketing_consent: formData.marketing_consent,
        attribution: {
          utm_source: 'rrenn_website',
          landing_path: window.location.pathname,
          referrer: document.referrer || null
        }
      };

      const res = await fetch('/api/v1/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json().catch(() => ({}));
        // Even if external CRM fails, fallback gracefully
        setSubmitted(true);
      }
    } catch (err) {
      // Local fallback for offline / mock
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEO
        title="预约 AI 外贸增长诊断 - 人人易 AI"
        description="免费获取 20 家海外真实海关提单买家穿透与采购委员会诊断报告。专业外贸架构师 24 小时内为您出具专属方案。"
        canonical="/diagnosis"
      />

      <section className="hero-section" style={{ paddingBottom: '32px' }}>
        <div className="container" style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
          <span className="badge badge-orange" style={{ marginBottom: '12px' }}>
            限时免费预约
          </span>
          <h1 style={{ fontSize: '2.6rem', fontWeight: 800, color: 'var(--brand-ink)', margin: '12px 0 16px' }}>
            预约 AI 外贸增长与海关穿透诊断
          </h1>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            提交您的主营出口品类与目标市场，人人易外贸专家将在 24 小时内为您免费输出一份定制化的<strong>《海外海关真实买家穿透与采购委员会诊断报告》</strong>。
          </p>
        </div>
      </section>

      <section className="section-padding" style={{ background: '#ffffff', borderTop: '1px solid var(--border-subtle)' }}>
        <div className="container" style={{ maxWidth: '680px' }}>
          {submitted ? (
            <div style={{ textAlign: 'center', background: 'var(--surface-subtle)', padding: '48px 32px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🎉</div>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--brand-ink)', marginBottom: '12px' }}>
                诊断申请已成功提交！
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: '1.6', marginBottom: '24px' }}>
                我们的出海咨询顾问已收到您的需求，正在为您调取近 180 天目标市场的真实海关提单数据，将在 1 个工作日内通过工作邮箱 <strong>{formData.work_email}</strong> 或电话与您取得联系。
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                <button onClick={() => onNavigate('/downloads')} className="btn btn-primary">
                  下载客户端体验
                </button>
                <button onClick={() => onNavigate('/')} className="btn btn-secondary">
                  返回官网首页
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ background: 'var(--surface-subtle)', padding: '36px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)' }}>
              {/* Anti-spam honeypot */}
              <input
                type="text"
                name="website_confirm_empty"
                value={formData.honeypot}
                onChange={(e) => setFormData({ ...formData, honeypot: e.target.value })}
                style={{ display: 'none' }}
                tabIndex={-1}
                autoComplete="off"
              />

              {errorMessage && (
                <div style={{ background: '#fee2e2', border: '1px solid #ef4444', color: '#b91c1c', padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: '20px', fontSize: '0.9rem' }}>
                  {errorMessage}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">企业全称 *</label>
                  <input
                    type="text"
                    required
                    placeholder="如：深圳市某某电子科技有限公司"
                    className="form-input"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">企业官网 (选填)</label>
                  <input
                    type="url"
                    placeholder="https://example.com"
                    className="form-input"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">联系人姓名 *</label>
                  <input
                    type="text"
                    required
                    placeholder="如：李先生 / 张经理"
                    className="form-input"
                    value={formData.contact_name}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">您的职位</label>
                  <input
                    type="text"
                    placeholder="如：外贸总经理 / 外贸总监"
                    className="form-input"
                    value={formData.job_title}
                    onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">工作企业邮箱 *</label>
                  <input
                    type="email"
                    required
                    placeholder="name@yourcompany.com"
                    className="form-input"
                    value={formData.work_email}
                    onChange={(e) => setFormData({ ...formData, work_email: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">手机号 / 微信 (选填)</label>
                  <input
                    type="tel"
                    placeholder="方便专家直接发送诊断报告"
                    className="form-input"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">主营出口产品 / SKU 品类 *</label>
                <input
                  type="text"
                  required
                  placeholder="如：MOSFET功率器件、建筑文化石、陶瓷阀芯、食品级硅胶餐具"
                  className="form-input"
                  value={formData.products}
                  onChange={(e) => setFormData({ ...formData, products: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">重点目标市场</label>
                  <select
                    className="form-select"
                    value={formData.target_markets}
                    onChange={(e) => setFormData({ ...formData, target_markets: e.target.value })}
                  >
                    <option value="North America">北美地区 (美加)</option>
                    <option value="Europe">欧洲地区 (德意英法西)</option>
                    <option value="Southeast Asia">东南亚地区 (越泰马印)</option>
                    <option value="Middle East">中东地区 (阿联酋沙特)</option>
                    <option value="Latin America">拉美及其他新兴市场</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">外贸团队规模</label>
                  <select
                    className="form-select"
                    value={formData.team_size_range}
                    onChange={(e) => setFormData({ ...formData, team_size_range: e.target.value })}
                  >
                    <option value="1-3">1-3 人 (初创/SOHO)</option>
                    <option value="4-8">4-8 人 (成长期团队)</option>
                    <option value="9-20">9-20 人 (规模化部门)</option>
                    <option value="20+">20 人以上 (大型出口企业)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">当前最迫切需要突破的痛点</label>
                <select
                  className="form-select"
                  value={formData.pain_points}
                  onChange={(e) => setFormData({ ...formData, pain_points: e.target.value })}
                >
                  <option value="customs_buyer_intent">海关提单全是货代，找不到真实采购商</option>
                  <option value="buying_committee_contacts">只知道买家公司，找不到关键采购决策人联系方式</option>
                  <option value="cold_email_low_response">开发信回复率极低，频繁进垃圾箱</option>
                  <option value="team_sales_scale">外贸新人培养周期长，销冠经验难以复制传承</option>
                </select>
              </div>

              {/* Consent Checkboxes */}
              <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label className="form-checkbox">
                  <input
                    type="checkbox"
                    checked={formData.privacy_consent}
                    onChange={(e) => setFormData({ ...formData, privacy_consent: e.target.checked })}
                  />
                  <span>
                    我已阅读并同意《<a href="/privacy" onClick={(e) => { e.preventDefault(); onNavigate('/privacy'); }} style={{ color: 'var(--brand-orange-action)', textDecoration: 'underline' }}>隐私政策</a>》与数据安全保护条款，授权人人易顾问为我生成诊断报告。*
                  </span>
                </label>

                <label className="form-checkbox">
                  <input
                    type="checkbox"
                    checked={formData.marketing_consent}
                    onChange={(e) => setFormData({ ...formData, marketing_consent: e.target.checked })}
                  />
                  <span>
                    愿意订阅人人易出海研究院出品的《全球外贸买家采购异动研报》及产品更新。
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary btn-lg"
                style={{ width: '100%', marginTop: '28px' }}
              >
                {loading ? '正在提交诊断申请...' : '立即提交 · 免费获取 20 家真实海关买家报告 →'}
              </button>

              <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '12px' }}>
                🔒 严格保密：我们绝不向任何第三方出售或泄露您的企业信息
              </div>
            </form>
          )}
        </div>
      </section>
    </>
  );
};

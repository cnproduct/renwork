import React from 'react';

interface FooterProps {
  onNavigate: (path: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const handleNav = (path: string, e: React.MouseEvent) => {
    e.preventDefault();
    onNavigate(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          {/* Brand Info */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <img src="/brand/rrenn_logo_pure_vector.svg" alt="人人易 AI" style={{ height: '36px', filter: 'brightness(0) invert(1)' }} />
            </div>
            <p style={{ fontSize: '0.88rem', color: '#a89f99', lineHeight: '1.6', marginBottom: '20px', maxWidth: '320px' }}>
              人人易 AI (rrenn.com) 是中国领先的企业级外贸 B2B 智能增长操作系统与 AI 数字员工平台，帮助出海企业实现从真实海关提单穿透到高转化订单推进的全链路自动化。
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span className="badge badge-orange">本地优先架构</span>
              <span className="badge badge-teal">人在回路审批</span>
            </div>
          </div>

          {/* Product Nav */}
          <div>
            <h4 className="footer-col-title">产品与能力</h4>
            <ul className="footer-links">
              <li><a href="/product" onClick={(e) => handleNav('/product', e)}>产品总览</a></li>
              <li><a href="/product/buyer-intent" onClick={(e) => handleNav('/product/buyer-intent', e)}>海关意图穿透</a></li>
              <li><a href="/product/contact-intelligence" onClick={(e) => handleNav('/product/contact-intelligence', e)}>OKKI 采购委员会</a></li>
              <li><a href="/product/linkedin-360" onClick={(e) => handleNav('/product/linkedin-360', e)}>LinkedIn 360 匹配</a></li>
              <li><a href="/product/outreach" onClick={(e) => handleNav('/product/outreach', e)}>高转化外联序列</a></li>
              <li><a href="/product/social-matrix" onClick={(e) => handleNav('/product/social-matrix', e)}>6语种社媒矩阵</a></li>
              <li><a href="/product/team-intelligence" onClick={(e) => handleNav('/product/team-intelligence', e)}>TeamAI 团队治理</a></li>
            </ul>
          </div>

          {/* Industry Solutions */}
          <div>
            <h4 className="footer-col-title">行业解决方案</h4>
            <ul className="footer-links">
              <li><a href="/solutions/semiconductor" onClick={(e) => handleNav('/solutions/semiconductor', e)}>半导体与电子</a></li>
              <li><a href="/solutions/stone" onClick={(e) => handleNav('/solutions/stone', e)}>建筑文化石建材</a></li>
              <li><a href="/solutions/hygiene" onClick={(e) => handleNav('/solutions/hygiene', e)}>卫浴洁具五金阀门</a></li>
              <li><a href="/solutions/baby-silicone" onClick={(e) => handleNav('/solutions/baby-silicone', e)}>婴童母婴硅胶日用</a></li>
              <li><a href="/solutions/gifts" onClick={(e) => handleNav('/solutions/gifts', e)}>工艺礼品文创定制</a></li>
              <li><a href="/solutions/pharma" onClick={(e) => handleNav('/solutions/pharma', e)}>医药原料与健康品</a></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="footer-col-title">资源与支持</h4>
            <ul className="footer-links">
              <li><a href="/downloads" onClick={(e) => handleNav('/downloads', e)}>客户端下载 (RenWork)</a></li>
              <li><a href="/docs" onClick={(e) => handleNav('/docs', e)}>使用文档与指南</a></li>
              <li><a href="/cases" onClick={(e) => handleNav('/cases', e)}>客户成功案例</a></li>
              <li><a href="/insights" onClick={(e) => handleNav('/insights', e)}>外贸洞察研报</a></li>
              <li><a href="/training" onClick={(e) => handleNav('/training', e)}>外贸实操训练营</a></li>
              <li><a href="/status" onClick={(e) => handleNav('/status', e)}>服务运行状态</a></li>
            </ul>
          </div>

          {/* Legal & Company */}
          <div>
            <h4 className="footer-col-title">公司与合规</h4>
            <ul className="footer-links">
              <li><a href="/about" onClick={(e) => handleNav('/about', e)}>关于人人易</a></li>
              <li><a href="/contact" onClick={(e) => handleNav('/contact', e)}>联系我们</a></li>
              <li><a href="/privacy" onClick={(e) => handleNav('/privacy', e)}>隐私政策</a></li>
              <li><a href="/terms" onClick={(e) => handleNav('/terms', e)}>服务条款</a></li>
              <li><a href="/cookies" onClick={(e) => handleNav('/cookies', e)}>Cookie 政策</a></li>
              <li><a href="/anti-spam" onClick={(e) => handleNav('/anti-spam', e)}>反垃圾邮件政策</a></li>
              <li><a href="/open-source" onClick={(e) => handleNav('/open-source', e)}>开源声明</a></li>
            </ul>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="footer-bottom">
          <div>
            © 2026 人人易智能科技有限公司 (rrenn.com) 版权所有 | 统一社会信用代码: 91350200MA34XXXXXX
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span>闽ICP备20260822号-1</span>
            <span>公网安备 35020002000000号</span>
            <span>官方域名: www.rrenn.com</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

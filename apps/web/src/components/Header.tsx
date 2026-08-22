import React, { useState } from 'react';

interface HeaderProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentPath, onNavigate }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNav = (path: string, e: React.MouseEvent) => {
    e.preventDefault();
    onNavigate(path);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="header-glass">
      <div className="container header-container">
        {/* Brand Logo */}
        <a href="/" onClick={(e) => handleNav('/', e)} className="brand-logo">
          <img src="/brand/rrenn_logo_pure_vector.svg" alt="人人易 AI (rrenn.com)" />
        </a>

        {/* Desktop Nav */}
        <nav className="nav-menu">
          <a
            href="/"
            onClick={(e) => handleNav('/', e)}
            className={`nav-link ${currentPath === '/' ? 'active' : ''}`}
          >
            首页
          </a>
          <a
            href="/product"
            onClick={(e) => handleNav('/product', e)}
            className={`nav-link ${currentPath.startsWith('/product') ? 'active' : ''}`}
          >
            产品能力
          </a>
          <a
            href="/solutions"
            onClick={(e) => handleNav('/solutions', e)}
            className={`nav-link ${currentPath.startsWith('/solutions') ? 'active' : ''}`}
          >
            行业方案
          </a>
          <a
            href="/cases"
            onClick={(e) => handleNav('/cases', e)}
            className={`nav-link ${currentPath.startsWith('/cases') ? 'active' : ''}`}
          >
            客户案例
          </a>
          <a
            href="/pricing"
            onClick={(e) => handleNav('/pricing', e)}
            className={`nav-link ${currentPath === '/pricing' ? 'active' : ''}`}
          >
            价格方案
          </a>
          <a
            href="/downloads"
            onClick={(e) => handleNav('/downloads', e)}
            className={`nav-link ${currentPath === '/downloads' ? 'active' : ''}`}
          >
            下载中心
          </a>
          <a
            href="/docs"
            onClick={(e) => handleNav('/docs', e)}
            className={`nav-link ${currentPath.startsWith('/docs') ? 'active' : ''}`}
          >
            文档
          </a>
          <a
            href="/insights"
            onClick={(e) => handleNav('/insights', e)}
            className={`nav-link ${currentPath.startsWith('/insights') ? 'active' : ''}`}
          >
            外贸洞察
          </a>
        </nav>

        {/* Desktop CTAs */}
        <div className="nav-cta-group header-actions-desktop">
          <a
            href="/downloads"
            onClick={(e) => handleNav('/downloads', e)}
            className="btn btn-secondary btn-sm"
          >
            下载客户端
          </a>
          <a
            href="/diagnosis"
            onClick={(e) => handleNav('/diagnosis', e)}
            className="btn btn-primary btn-sm"
          >
            预约 AI 增长诊断
          </a>
        </div>

        {/* Mobile Toggle Button */}
        <button
          className="mobile-menu-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="切换菜单"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileMenuOpen ? (
              <path d="M18 6L6 18M6 6l12 12" />
            ) : (
              <path d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="mobile-drawer">
          <a href="/" onClick={(e) => handleNav('/', e)} className="nav-link">
            首页
          </a>
          <a href="/product" onClick={(e) => handleNav('/product', e)} className="nav-link">
            产品总览 (6大核心能力)
          </a>
          <a href="/solutions" onClick={(e) => handleNav('/solutions', e)} className="nav-link">
            行业解决方案 (6大垂直领域)
          </a>
          <a href="/cases" onClick={(e) => handleNav('/cases', e)} className="nav-link">
            客户案例与提单证据
          </a>
          <a href="/pricing" onClick={(e) => handleNav('/pricing', e)} className="nav-link">
            价格方案与套餐对比
          </a>
          <a href="/downloads" onClick={(e) => handleNav('/downloads', e)} className="nav-link">
            下载客户端 (RenWork)
          </a>
          <a href="/docs" onClick={(e) => handleNav('/docs', e)} className="nav-link">
            使用文档与开发指南
          </a>
          <a href="/insights" onClick={(e) => handleNav('/insights', e)} className="nav-link">
            外贸实战洞察研报
          </a>
          <a href="/training" onClick={(e) => handleNav('/training', e)} className="nav-link">
            外贸实战训练营
          </a>
          <a href="/about" onClick={(e) => handleNav('/about', e)} className="nav-link">
            关于人人易
          </a>
          <a href="/contact" onClick={(e) => handleNav('/contact', e)} className="nav-link">
            联系我们与合作
          </a>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
            <a href="/diagnosis" onClick={(e) => handleNav('/diagnosis', e)} className="btn btn-primary">
              预约 AI 增长诊断
            </a>
            <a href="/downloads" onClick={(e) => handleNav('/downloads', e)} className="btn btn-secondary">
              立即下载 RenWork 客户端
            </a>
          </div>
        </div>
      )}
    </header>
  );
};

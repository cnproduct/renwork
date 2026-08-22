import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Home } from './pages/Home';
import { ProductOverview } from './pages/ProductOverview';
import { BuyerIntent } from './pages/BuyerIntent';
import { ContactIntelligence } from './pages/ContactIntelligence';
import { LinkedIn360 } from './pages/LinkedIn360';
import { Outreach } from './pages/Outreach';
import { SocialMatrix } from './pages/SocialMatrix';
import { TeamIntelligence } from './pages/TeamIntelligence';
import { Solutions } from './pages/Solutions';
import { IndustryPage } from './pages/IndustryPage';
import { PricingPage } from './pages/PricingPage';
import { CasesPage } from './pages/CasesPage';
import { DownloadsPage } from './pages/DownloadsPage';
import { DocsPage } from './pages/DocsPage';
import { InsightsPage } from './pages/InsightsPage';
import { TrainingPage } from './pages/TrainingPage';
import { AboutPage } from './pages/AboutPage';
import { DiagnosisPage } from './pages/DiagnosisPage';
import { LegalPages } from './pages/LegalPages';

export const App: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname || '/');

  useEffect(() => {
    const onPopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (path: string) => {
    if (path !== currentPath) {
      window.history.pushState({}, '', path);
      setCurrentPath(path);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const renderContent = () => {
    const path = currentPath.replace(/\/$/, '') || '/';

    if (path === '/') return <Home onNavigate={navigate} />;
    if (path === '/product') return <ProductOverview onNavigate={navigate} />;
    if (path === '/product/buyer-intent') return <BuyerIntent onNavigate={navigate} />;
    if (path === '/product/contact-intelligence') return <ContactIntelligence onNavigate={navigate} />;
    if (path === '/product/linkedin-360') return <LinkedIn360 onNavigate={navigate} />;
    if (path === '/product/outreach') return <Outreach onNavigate={navigate} />;
    if (path === '/product/social-matrix') return <SocialMatrix onNavigate={navigate} />;
    if (path === '/product/team-intelligence') return <TeamIntelligence onNavigate={navigate} />;
    
    if (path === '/solutions') return <Solutions onNavigate={navigate} />;
    if (path.startsWith('/solutions/')) {
      const slug = path.replace('/solutions/', '');
      return <IndustryPage slug={slug} onNavigate={navigate} />;
    }

    if (path === '/pricing') return <PricingPage onNavigate={navigate} />;
    if (path === '/cases' || path.startsWith('/cases/')) return <CasesPage onNavigate={navigate} />;
    if (path === '/downloads') return <DownloadsPage />;
    if (path === '/docs' || path.startsWith('/docs/')) return <DocsPage />;
    if (path === '/insights' || path.startsWith('/insights/')) return <InsightsPage />;
    if (path === '/training') return <TrainingPage onNavigate={navigate} />;
    if (path === '/about' || path === '/contact') return <AboutPage onNavigate={navigate} />;
    if (path === '/diagnosis') return <DiagnosisPage onNavigate={navigate} />;

    if (path === '/privacy') return <LegalPages type="privacy" onNavigate={navigate} />;
    if (path === '/terms') return <LegalPages type="terms" onNavigate={navigate} />;
    if (path === '/cookies') return <LegalPages type="cookies" onNavigate={navigate} />;
    if (path === '/anti-spam') return <LegalPages type="anti-spam" onNavigate={navigate} />;
    if (path === '/open-source') return <LegalPages type="open-source" onNavigate={navigate} />;
    if (path === '/status') return <LegalPages type="status" onNavigate={navigate} />;

    // Fallback 404 to Home
    return <Home onNavigate={navigate} />;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header currentPath={currentPath} onNavigate={navigate} />
      <main style={{ flex: 1 }}>{renderContent()}</main>
      <Footer onNavigate={navigate} />
    </div>
  );
};

import { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="app-layout flex h-screen overflow-hidden bg-background">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((c) => !c)} />

      <div className="app-cadre flex flex-1 flex-col overflow-hidden">
        <Header onMenuToggle={() => setSidebarCollapsed((c) => !c)} />

        <main className="app-contenu flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

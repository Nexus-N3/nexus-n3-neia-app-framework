import React from 'react';

interface ScreenLayoutProps {
  className?: string;
  children: React.ReactNode;
}

export const ScreenLayout: React.FC<ScreenLayoutProps> = ({ className, children }) => {
  return (
    <main className={`nexus-content ${className || ''}`} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {children}
    </main>
  );
};

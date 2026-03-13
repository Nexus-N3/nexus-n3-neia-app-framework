import React from 'react';

interface ScreenLayoutProps {
  className?: string;
  children: React.ReactNode;
}

export const ScreenLayout: React.FC<ScreenLayoutProps> = ({ className, children }) => {
  return (
    <main className={`nexus-content ${className || ''}`}>
      {children}
    </main>
  );
};

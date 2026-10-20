import React from 'react';

interface ScreenLayoutProps {
  className?: string;
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  bodyClassName?: string;
  centerBody?: boolean;
}

export const ScreenLayout: React.FC<ScreenLayoutProps> = ({
  className,
  children,
  header,
  footer,
  bodyClassName,
  centerBody = false,
}) => {
  if (!header && !footer && !bodyClassName && !centerBody) {
    return (
      <main className={`nexus-content ${className || ''}`}>
        {children}
      </main>
    );
  }

  return (
    <main className={`nexus-content screen-layout-shell ${className || ''}`}>
      {header ? <div className="screen-layout-header">{header}</div> : null}
      <div className={`screen-layout-body ${centerBody ? 'centered' : ''} ${bodyClassName || ''}`.trim()}>
        {children}
      </div>
      {footer ? <div className="screen-layout-footer">{footer}</div> : null}
    </main>
  );
};

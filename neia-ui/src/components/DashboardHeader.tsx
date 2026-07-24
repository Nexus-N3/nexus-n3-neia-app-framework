import type { ReactNode } from "react";

type DashboardHeaderProps = {
  children?: ReactNode;
  description: ReactNode;
  logoSrc?: string;
  title: string;
};

export function DashboardHeader({
  children,
  description,
  logoSrc = "/neia_logo.png",
  title,
}: DashboardHeaderProps) {
  return (
    <header className="shell-header">
      <div className="shell-brand">
        <h1>{title}</h1>
        {description}
        {children}
      </div>
      <img className="shell-logo" src={logoSrc} alt="NEIA logo" />
    </header>
  );
}

import type { ReactNode } from "react";

import type { CoreConnection } from "../types";
import { CoreStateBadge } from "./CoreStateBadge";

type MainLayoutProps = {
  children: ReactNode;
  connection: CoreConnection | null;
  route: string;
  onNavigate: (route: string) => void;
};

const MENU_ITEMS = [
  { route: "/dashboard", label: "Dashboard" },
  { route: "/connection", label: "Connection" },
  { route: "/capabilities", label: "Capabilities" },
  { route: "/status", label: "Status" },
  { route: "/catalog", label: "App Catalog" },
  { route: "/workflows", label: "Workflows" },
  { route: "/archives", label: "Archives" },
];

export function MainLayout({ children, connection, route, onNavigate }: MainLayoutProps) {
  const connectionState = connection?.state ?? "disconnected";
  const endpoint = connection?.target_host ?? "Not configured";

  return (
    <div className="neia-shell-v2">
      <header className="neia-header-v2">
          <img className="neia-header-logo" src="/logo.svg" alt="" />
        {/*<button
          className="neia-brand-v2"
          onClick={() => onNavigate("/dashboard")}
          type="button"
          aria-label="Open NEIA dashboard"
        >
          <img src="/logo.svg" alt="" />
        </button>*/}
        <div className="neia-endpoint-v2">
          <div>
            <span className="eyebrow">Nexus N3 Core</span>
            <strong>{endpoint}</strong>
          </div>
          <CoreStateBadge state={connectionState} compact />
        </div>
      </header>

      <nav className="neia-menu-v2" aria-label="Main navigation">
        {MENU_ITEMS.map((item) => (
          <button
            className={
              route === item.route || (route === "/session" && item.route === "/dashboard")
                ? "active"
                : ""
            }
            key={item.route}
            onClick={() => onNavigate(item.route)}
            type="button"
            aria-current={
              route === item.route || (route === "/session" && item.route === "/dashboard")
                ? "page"
                : undefined
            }
          >
            {item.label}
          </button>
        ))}
        {/*<button
          className="planned"
          type="button"
          disabled
          title="NEIA AI is planned but not yet available"
        >
          <span>NEIA AI</span>
          <small>Planned</small>
        </button>*/}
      </nav>

      <main className="neia-view-v2">{children}</main>
    </div>
  );
}

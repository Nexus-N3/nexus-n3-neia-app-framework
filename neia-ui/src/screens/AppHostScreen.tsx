import type { AppInfo } from "../types";
import { getLayoutMode } from "../utils/appRuntime";

type AppHostScreenProps = {
  appView: AppInfo | null;
  appViewError: string | null;
  launchError: string | null;
  serverReady: boolean;
  siteName: string;
  retrying: boolean;
  usbPresent: boolean;
  usbBusy: boolean;
  usbError: string | null;
  onBack: () => void;
  onRetryServer: () => void;
  onUsbCommand: (action: "mount" | "unmount") => void;
};

export function AppHostScreen({
  appView,
  appViewError,
  launchError,
  serverReady,
  siteName,
  retrying,
  usbPresent,
  usbBusy,
  usbError,
  onBack,
  onRetryServer,
  onUsbCommand,
}: AppHostScreenProps) {
  const layoutMode = getLayoutMode(appView?.manifest);

  return (
    <div className={`app-shell takeover layout-${layoutMode}`}>
      <header className="app-topbar">
        <div className="app-topbar-left">
          <button className="app-back-button" onClick={onBack} type="button">
            Back to Dashboard
          </button>
          <button
            className={`app-usb-button${usbPresent ? " danger" : ""}`}
            onClick={() => onUsbCommand(usbPresent ? "unmount" : "mount")}
            disabled={usbBusy}
            title={usbPresent ? "Safely unmount the disk" : "Mount the disk"}
            type="button"
          >
            {usbBusy ? "Working..." : usbPresent ? "Safe Unmount" : "Mount Disk"}
          </button>
          {usbError ? <span className="app-usb-error">{usbError}</span> : null}
        </div>
        <div className="app-topbar-status">
          <div
            className="app-server-status-container"
            title={serverReady ? "System Ready" : "Connecting..."}
          >
            <div className={`app-status-indicator ${serverReady ? "online" : "offline"}`} />
          </div>
          <span className="app-site-name">{siteName}</span>
          {!serverReady ? (
            <button className="app-retry-btn" onClick={onRetryServer} disabled={retrying} type="button">
              {retrying ? "Retrying..." : "Retry server"}
            </button>
          ) : null}
        </div>
      </header>
      {appViewError ? <p className="error">{appViewError}</p> : null}
      {launchError ? <p className="error">{launchError}</p> : null}
      <div className={`app-mount takeover layout-${layoutMode}`}>
        <div id="app-mount" className={`app-stage layout-${layoutMode}`} />
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";

import { MainLayout } from "./components/MainLayout";
import { RemoteOperationOverlay } from "./components/RemoteOperationOverlay";
import { StartupSequence } from "./components/StartupSequence";
import { CoreProvider, useCore } from "./core/CoreProvider";
import { invalidateAppsSnapshot, useApps } from "./hooks/useApps";
import { useHashRoute } from "./hooks/useHashRoute";
import { NexusN3View } from "./nexusN3/NexusN3View";
import { AppCatalogScreen } from "./screens/AppCatalogScreen";
import { AppHostScreen } from "./screens/AppHostScreen";
import { CoreCapabilitiesScreen } from "./screens/CoreCapabilitiesScreen";
import { CoreConnectionScreen } from "./screens/CoreConnectionScreen";
import { CoreStatusScreen } from "./screens/CoreStatusScreen";
import { SystemDashboardScreen } from "./screens/SystemDashboardScreen";
import "./styles.css";
import type { AppInfo, RemoteOperationState, StartupStage } from "./types";
import {
  appendCacheBust,
  fetchApp,
  getViteDevStyleKeys,
  loadScript,
  loadStyle,
  removeNewViteDevStyles,
} from "./utils/appRuntime";
import {
  disableVoicePipeline,
  HOLD_ON_STARTUP_SCREEN_FOR_TESTING,
  isStartupSequenceDone,
  markStartupSequenceDone,
  sleep,
  speakStartupGreeting,
  STARTUP_API_MOUTH_DELAY_MS,
  STARTUP_BOOTING_MS,
  STARTUP_WAKING_MS,
  waitForApiSpeaking,
} from "./utils/startup";

function normalizeRoute(route: string) {
  if (!route || route === "/") return "/dashboard";
  return route;
}

function AppContent() {
  const route = normalizeRoute(useHashRoute());
  const isAppRoute = /^\/app\/[^/]+$/.test(route);
  const { installed, available, loading, refresh: refreshApps } = useApps();
  const {
    connection,
    retry,
    retrying,
    sendUsbCommand,
    status,
    subscribe,
  } = useCore();
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [appView, setAppView] = useState<AppInfo | null>(null);
  const [appViewError, setAppViewError] = useState<string | null>(null);
  const [remoteOperation, setRemoteOperation] = useState<RemoteOperationState>({ active: false });
  const [usbBusy, setUsbBusy] = useState(false);
  const [usbError, setUsbError] = useState<string | null>(null);
  const [startupStage, setStartupStage] = useState<StartupStage>(
    isStartupSequenceDone() || isAppRoute ? "done" : "booting",
  );
  const [showStartup, setShowStartup] = useState(!isStartupSequenceDone() && !isAppRoute);
  const [startupExiting, setStartupExiting] = useState(false);

  const navigate = (nextRoute: string) => {
    window.location.hash = nextRoute;
  };

  const install = async (appId: string) => {
    await fetch(`/api/v1/apps/install/${appId}`, { method: "POST" });
    invalidateAppsSnapshot();
    await refreshApps({ force: true });
  };

  const uninstall = async (appId: string) => {
    await fetch(`/api/v1/apps/uninstall/${appId}`, { method: "POST" });
    invalidateAppsSnapshot();
    await refreshApps({ force: true });
  };

  const launch = (appInfo: AppInfo) => {
    navigate(`/app/${appInfo.manifest.id}`);
  };

  const launchBuiltInSession = () => {
    navigate("/session");
  };

  const backToDashboard = async () => {
    if (appView?.manifest.id === "neia_voice_assistant") {
      await disableVoicePipeline();
    }
    navigate("/dashboard");
  };

  useEffect(() => {
    if (window.location.hash === "" || window.location.hash === "#/" || window.location.hash === "#") {
      navigate("/dashboard");
    }
  }, []);

  useEffect(() => {
    const match = route.match(/^\/app\/([^/]+)$/);
    if (!match) {
      setAppView(null);
      setAppViewError(null);
      setLaunchError(null);
      return;
    }
    if (match[1] === "nexus") {
      navigate("/session");
      return;
    }
    setAppViewError(null);
    setLaunchError(null);
    void fetchApp(match[1])
      .then((info) => setAppView(info))
      .catch(() => {
        setAppView(null);
        setAppViewError("App not found or not installed.");
      });
  }, [route]);

  useEffect(() => {
    if (isAppRoute || isStartupSequenceDone()) {
      setStartupStage("done");
      setShowStartup(false);
      setStartupExiting(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      setShowStartup(true);
      setStartupExiting(false);
      setStartupStage("booting");
      await sleep(STARTUP_BOOTING_MS);
      if (cancelled) return;

      setStartupStage("waking");
      await sleep(STARTUP_WAKING_MS);
      if (cancelled) return;

      setStartupStage("preSpeak");
      const speechMode = await speakStartupGreeting();
      if (cancelled) return;
      if (speechMode === "api") {
        if (STARTUP_API_MOUTH_DELAY_MS > 0) {
          await sleep(STARTUP_API_MOUTH_DELAY_MS);
          if (cancelled) return;
        }
        const started = await waitForApiSpeaking(true, 5000);
        if (cancelled) return;
        setStartupStage("speaking");
        if (started) {
          await waitForApiSpeaking(false, 18000);
        } else {
          await sleep(900);
        }
      } else if (speechMode === "browser") {
        setStartupStage("speaking");
        await sleep(300);
      } else {
        setStartupStage("speaking");
        await sleep(900);
      }
      if (cancelled) return;

      setStartupStage("postSpeak");
      await sleep(1200);
      if (cancelled || HOLD_ON_STARTUP_SCREEN_FOR_TESTING) return;

      markStartupSequenceDone();
      setStartupStage("done");
      setStartupExiting(true);
      await sleep(680);
      if (cancelled) return;
      setShowStartup(false);
      setStartupExiting(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [isAppRoute]);

  useEffect(() => {
    if (!appView) return;
    const entry = appView.resolved_entry_ui || appView.manifest.entry_ui;
    const style = appView.manifest.style;
    if (!entry) {
      setLaunchError("No entry UI configured for this app.");
      return;
    }

    let disposed = false;
    let mountedScript: HTMLScriptElement | null = null;
    let mountedStyle: HTMLLinkElement | null = null;
    const assetToken = `${appView.manifest.id}:${Date.now()}`;
    const viteDevStyleKeys = entry.startsWith("http") ? getViteDevStyleKeys() : null;

    if (style) {
      const styleUrl = entry.startsWith("http")
        ? style
        : appendCacheBust(`/api/v1/apps/${appView.manifest.id}/asset/${style}`, assetToken);
      mountedStyle = loadStyle(styleUrl);
    }

    void (async () => {
      try {
        const scriptUrl = entry.startsWith("http")
          ? entry
          : appendCacheBust(`/api/v1/apps/${appView.manifest.id}/asset/${entry}`, assetToken);
        mountedScript = await loadScript(scriptUrl);
        if (disposed) return;

        const mountName = appView.resolved_mount || appView.manifest.mount;
        const mountFn = mountName
          ? (window as unknown as Window & Record<string, unknown>)[mountName]
          : null;
        const mountEl = document.getElementById("app-mount");
        if (typeof mountFn === "function" && mountEl) {
          (mountFn as (element: HTMLElement, options: { appId: string }) => void)(mountEl, {
            appId: appView.manifest.id,
          });
        } else {
          setLaunchError("Mount function not found.");
        }
      } catch {
        setLaunchError("Failed to load app UI.");
      }
    })();

    return () => {
      disposed = true;
      document.getElementById("app-mount")?.replaceChildren();
      if (viteDevStyleKeys) removeNewViteDevStyles(viteDevStyleKeys);
      mountedStyle?.remove();
      mountedScript?.remove();
    };
  }, [appView]);

  useEffect(
    () =>
      subscribe((message) => {
        if (
          message.type !== "control_center_message" ||
          typeof message.payload !== "object" ||
          message.payload === null
        ) {
          return;
        }
        const forwarded = message.payload as {
          type?: unknown;
          payload?: {
            active?: unknown;
            device_name?: unknown;
            site_name?: unknown;
            operator_username?: unknown;
          };
        };
        if (forwarded.type !== "remote_operation_update") return;
        const active = Boolean(forwarded.payload?.active);
        if (active) navigate("/dashboard");
        setRemoteOperation({
          active,
          device_name:
            typeof forwarded.payload?.device_name === "string" ? forwarded.payload.device_name : null,
          site_name:
            typeof forwarded.payload?.site_name === "string" ? forwarded.payload.site_name : null,
          operator_username:
            typeof forwarded.payload?.operator_username === "string"
              ? forwarded.payload.operator_username
              : null,
        });
      }),
    [subscribe],
  );

  const handleUsbCommand = async (action: "mount" | "unmount") => {
    setUsbBusy(true);
    setUsbError(null);
    try {
      await sendUsbCommand(action);
    } catch {
      setUsbError("Failed to send USB command.");
    } finally {
      setUsbBusy(false);
    }
  };

  if (remoteOperation.active) {
    return <RemoteOperationOverlay state={remoteOperation} />;
  }

  if (appView || appViewError) {
    return (
      <AppHostScreen
        appView={appView}
        appViewError={appViewError}
        launchError={launchError}
        serverReady={connection?.state === "connected"}
        siteName={connection?.site || "Nexus N3 Core"}
        retrying={retrying}
        usbPresent={status?.usb.present === true}
        usbBusy={usbBusy}
        usbError={usbError || status?.usb.error || null}
        onBack={() => void backToDashboard()}
        onRetryServer={() => void retry()}
        onUsbCommand={(action) => void handleUsbCommand(action)}
      />
    );
  }

  let view;
  switch (route) {
    case "/connection":
      view = <CoreConnectionScreen />;
      break;
    case "/capabilities":
      view = <CoreCapabilitiesScreen />;
      break;
    case "/status":
      view = <CoreStatusScreen />;
      break;
    case "/catalog":
      view = (
        <AppCatalogScreen
          available={available}
          installed={installed}
          loading={loading}
          onInstall={(appId) => void install(appId)}
          onLaunch={launch}
          onUninstall={(appId) => void uninstall(appId)}
        />
      );
      break;
    case "/session":
      view = <NexusN3View />;
      break;
    case "/dashboard":
    default:
      view = (
        <SystemDashboardScreen
          onLaunchSession={launchBuiltInSession}
          onOpenConnection={() => navigate("/connection")}
          onOpenStatus={() => navigate("/status")}
        />
      );
      break;
  }

  return (
    <>
      <MainLayout connection={connection} route={route} onNavigate={navigate}>
        {view}
      </MainLayout>
      {showStartup ? <StartupSequence stage={startupStage} exiting={startupExiting} /> : null}
    </>
  );
}

export default function App() {
  return (
    <CoreProvider>
      <AppContent />
    </CoreProvider>
  );
}

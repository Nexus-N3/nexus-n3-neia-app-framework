import type { AppInfo, AppManifest } from "../types";

export function getAssetUrl(appId: string, assetPath?: string | null) {
  if (!assetPath) return null;
  if (assetPath.startsWith("http")) return assetPath;
  return `/api/v1/apps/${appId}/asset/${assetPath}`;
}

export function appendCacheBust(url: string, token: string) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}_neia=${encodeURIComponent(token)}`;
}

export function getViteDevStyleKeys() {
  return new Set(
    Array.from(document.querySelectorAll<HTMLElement>("style[data-vite-dev-id], link[data-vite-dev-id]"))
      .map((node) => node.dataset.viteDevId)
      .filter((value): value is string => Boolean(value)),
  );
}

export function removeNewViteDevStyles(previousKeys: Set<string>) {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>("style[data-vite-dev-id], link[data-vite-dev-id]"));
  for (const node of nodes) {
    const key = node.dataset.viteDevId;
    if (key && !previousKeys.has(key)) {
      node.remove();
    }
  }
}

export function getAppType(manifest: AppManifest) {
  const type = manifest.app_type ? manifest.app_type.toLowerCase() : "";
  if (type === "demo") return "demo";
  if (type === "workflow") return "workflow";
  return "app";
}

export function getDeveloper(manifest: AppManifest) {
  return manifest.developer || "Unknown developer";
}

export function getLayoutMode(manifest?: AppManifest | null) {
  return manifest?.layout_mode === "framed" ? "framed" : "takeover";
}

export function loadScript(src: string): Promise<HTMLScriptElement> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.type = "module";
    script.dataset.neiaAppAsset = "script";
    script.onload = () => resolve(script);
    script.onerror = () => reject(new Error("Failed to load script"));
    document.head.appendChild(script);
  });
}

export function loadStyle(href: string): HTMLLinkElement {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.neiaAppAsset = "style";
  document.head.appendChild(link);
  return link;
}

export async function fetchApp(appId: string): Promise<AppInfo> {
  const resp = await fetch(`/api/v1/apps/${appId}`);
  if (!resp.ok) {
    throw new Error("App not found");
  }
  return resp.json();
}

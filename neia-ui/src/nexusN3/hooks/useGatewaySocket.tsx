import type { ReactNode } from "react";

import { useCore } from "../../core/CoreProvider";

type GatewayListener = (message: Record<string, unknown>) => void;

export interface GatewaySocketContext {
  connected: boolean;
  subscribe: (listener: GatewayListener) => () => void;
  sendCommand: (command: object) => Promise<void>;
}

export function GatewaySocketProvider({ children }: { children: ReactNode }) {
  return children;
}

export function useGatewaySocket(): GatewaySocketContext {
  const { eventConnected, sendCommand, subscribe } = useCore();
  return {
    connected: eventConnected,
    sendCommand,
    subscribe,
  };
}

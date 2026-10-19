import { createContext, useCallback, useContext, useRef, type ReactNode } from "react";

import { useCore } from "../../core/CoreProvider";

type GatewayListener = (message: Record<string, unknown>) => void;

export interface GatewaySocketContext {
  connected: boolean;
  subscribe: (listener: GatewayListener) => () => void;
  sendCommand: (command: object) => Promise<void>;
}

const CommandsPausedContext = createContext(false);

export function GatewaySocketProvider({ children, commandsPaused = false }: { children: ReactNode; commandsPaused?: boolean }) {
  return <CommandsPausedContext.Provider value={commandsPaused}>{children}</CommandsPausedContext.Provider>;
}

export function useGatewaySocket(): GatewaySocketContext {
  const { eventConnected, sendCommand, subscribe } = useCore();
  const commandsPaused = useContext(CommandsPausedContext);
  const pausedRef = useRef(commandsPaused);
  pausedRef.current = commandsPaused;
  const sendWorkflowCommand = useCallback(async (command: object) => {
    if (pausedRef.current) throw new Error('Session exit is in progress.');
    await sendCommand(command);
  }, [sendCommand]);
  return {
    connected: eventConnected,
    sendCommand: sendWorkflowCommand,
    subscribe,
  };
}

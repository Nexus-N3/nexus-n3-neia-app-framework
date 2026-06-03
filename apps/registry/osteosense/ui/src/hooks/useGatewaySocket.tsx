import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

type GatewayListener = (msg: Record<string, unknown>) => void;

interface GatewaySocketContext {
  /** True once the WebSocket is open and ready */
  connected: boolean;
  /** Subscribe to all incoming gateway events. Returns an unsubscribe function. */
  subscribe: (listener: GatewayListener) => () => void;
  /** Send a command via the REST endpoint (not WS) */
  sendCommand: (command: object) => Promise<void>;
}

const Ctx = createContext<GatewaySocketContext | null>(null);

export const GatewaySocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connected, setConnected] = useState(false);
  const listenersRef = useRef<Set<GatewayListener>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${window.location.host}/api/v1/gateway/events`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[GatewaySocket] Connected');
      setConnected(true);
    };

    ws.onclose = () => {
      console.log('[GatewaySocket] Disconnected');
      setConnected(false);
    };

    ws.onerror = (err) => {
      console.error('[GatewaySocket] Error:', err);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        listenersRef.current.forEach((fn) => {
          try {
            fn(msg);
          } catch (e) {
            console.error('[GatewaySocket] Listener error:', e);
          }
        });
      } catch (err) {
        console.error('[GatewaySocket] Failed to parse message:', err);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const subscribe = useCallback((listener: GatewayListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const sendCommand = useCallback(async (command: object) => {
    await fetch('/api/v1/gateway/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    });
  }, []);

  return <Ctx.Provider value={{ connected, subscribe, sendCommand }}>{children}</Ctx.Provider>;
};

/** Access the shared gateway socket. Must be used inside GatewaySocketProvider. */
export const useGatewaySocket = (): GatewaySocketContext => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useGatewaySocket must be used within GatewaySocketProvider');
  return ctx;
};

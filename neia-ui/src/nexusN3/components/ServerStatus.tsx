import React from 'react';
import { useAtom } from 'jotai';
import { serverReadyAtom } from '../store/atoms';

export const ServerStatus: React.FC = () => {
  const [isReady] = useAtom(serverReadyAtom);

  return (
    <div className="server-status-container" title={isReady ? "System Ready" : "Connecting..."}>
      <div className={`status-indicator ${isReady ? 'online' : 'offline'}`} />
    </div>
  );
};

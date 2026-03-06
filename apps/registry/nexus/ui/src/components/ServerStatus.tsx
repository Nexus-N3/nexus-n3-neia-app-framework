import React from 'react';
import { useAtom } from 'jotai';
import { serverReadyAtom } from '../store/atoms';

export const ServerStatus: React.FC = () => {
  const [isReady] = useAtom(serverReadyAtom);

  return (
    <div 
      className="server-status-container" 
      title={isReady ? "System Ready" : "Connecting..."}
      style={{ display: 'flex', alignItems: 'center', marginRight: '20px' }}
    >
      <div 
        className={`status-indicator ${isReady ? 'online' : 'offline'}`}
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: isReady ? '#4CAF50' : '#FF5722',
          boxShadow: isReady ? '0 0 8px #4CAF50' : 'none',
          transition: 'all 0.3s ease'
        }}
      />
    </div>
  );
};

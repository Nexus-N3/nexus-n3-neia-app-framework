import React from 'react';
import { useAtom } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { serverReadyAtom } from '../store/atoms';

export const HomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const [serverReady] = useAtom(serverReadyAtom);

  const handleStartSession = () => {
    if (!serverReady) {
      return;
    }
    navigate('/new-session');
  };

  return (
    <main className="nexus-content">
      <div className="sub-header-row centered">
        <h1 className="welcome-text">WELCOME TO NEXUS</h1>
      </div>
      <div className="content-spacer"></div>
      <div className="screen-footer">
        <button className="nexus-btn" onClick={handleStartSession} disabled={!serverReady}>
          {serverReady ? 'Start new session' : 'Server unavailable'}
        </button>
      </div>
    </main>
  );
};

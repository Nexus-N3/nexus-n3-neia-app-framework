import React from 'react';
import { useAtom } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { ScreenLayout } from '../components/ScreenLayout';
import { selectedSubjectAtom, serverReadyAtom, sessionNameAtom, siteNameAtom } from '../store/atoms';

export const HomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const [serverReady] = useAtom(serverReadyAtom);
  const [siteName] = useAtom(siteNameAtom);
  const [selectedSubject] = useAtom(selectedSubjectAtom);
  const [, setSessionName] = useAtom(sessionNameAtom);

  const handleStartSession = () => {
    if (!serverReady) {
      return;
    }

    const date = new Date();
    const defaultSessionName = `${siteName} / Session [${date.toLocaleDateString()}]`;
    setSessionName(defaultSessionName);
    navigate(selectedSubject ? '/sensor-setup' : '/subjects');
  };

  return (
    <ScreenLayout
      className="home-screen"
      header={
        <div className="sub-header-row centered home-screen-header">
          <h1 className="welcome-text">WELCOME</h1>
        </div>
      }
      bodyClassName="home-screen-body"
      centerBody
    >
      <div className="home-screen-actions">
        <button className="nexus-btn" onClick={handleStartSession} disabled={!serverReady}>
          {serverReady ? 'Start new session' : 'Server unavailable'}
        </button>
      </div>
    </ScreenLayout>
  );
};

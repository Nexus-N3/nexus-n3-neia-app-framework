import React from 'react';
import { useAtom } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { ScreenLayout } from '../components/ScreenLayout';
import { selectedSubjectAtom, serverReadyAtom, sessionEventsAtom, sessionNameAtom, sessionStageAtom, siteNameAtom, subjectSensorRowsAtom } from '../store/atoms';
import { isCompactFlowViewport } from '../utils/displayProfiles';

export const HomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const [serverReady] = useAtom(serverReadyAtom);
  const [siteName] = useAtom(siteNameAtom);
  const [selectedSubject] = useAtom(selectedSubjectAtom);
  const [, setSessionName] = useAtom(sessionNameAtom);
  const [, setSessionStage] = useAtom(sessionStageAtom);
  const [, setSubjectSensorRows] = useAtom(subjectSensorRowsAtom);
  const [, setSessionEvents] = useAtom(sessionEventsAtom);

  const handleStartSession = () => {
    if (!serverReady) {
      return;
    }

    const date = new Date();
    const defaultSessionName = `${siteName} / Session [${date.toLocaleDateString()}]`;
    setSessionName(defaultSessionName);
    setSubjectSensorRows({});
    setSessionEvents([]);
    setSessionStage('session_creation');
    const skipSessionNameScreen = isCompactFlowViewport();
    if (selectedSubject) {
      setSessionStage('sensor_configuration');
      navigate('/sensor-setup');
      return;
    }
    navigate(skipSessionNameScreen ? '/subjects' : '/new-session');
  };

  return (
    <ScreenLayout
      className="home-screen"
      header={
        <div className="sub-header-row centered home-screen-header">
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

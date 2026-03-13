import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { BackButton } from '../components/BackButton';
import { InfoButton } from '../components/InfoButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { sessionNameAtom, siteNameAtom } from '../store/atoms';

export const NewSessionScreen: React.FC = () => {
  const navigate = useNavigate();
  const [sessionName, setSessionName] = useAtom(sessionNameAtom);
  const [siteName] = useAtom(siteNameAtom);
  const [projectIdentifier, setProjectIdentifier] = useState(() => {
    if (sessionName.includes(' / ')) {
      return sessionName.split(' / ')[0];
    }
    return '';
  });

  const handleBack = () => {
    navigate('/');
  };

  const handleContinue = () => {
    const finalProject = projectIdentifier.trim() || siteName;
    let finalSession = sessionName;

    if (sessionName.includes(' / ')) {
      finalSession = sessionName.split(' / ')[1] || '';
    }

    finalSession = finalSession.trim();

    if (!finalSession) {
      const date = new Date();
      finalSession = `Session [${date.toLocaleDateString()}]`;
    }

    setSessionName(`${finalProject} / ${finalSession}`);
    navigate('/subjects');
  };

  return (
    <main className="nexus-content screen-layout new-session-screen">
      <ScreenHeader
        left={<BackButton onClick={handleBack} />}
        center={<h2 className="screen-title">SESSION NAME</h2>}
        right={<InfoButton />}
      />

      <div className="form-container">
        <div className="form-group">
          <label htmlFor="project-identifier">Project / User Identifier</label>
          <input
            id="project-identifier"
            type="text"
            placeholder={`(Default) ${siteName.toUpperCase()}`}
            className="nexus-input"
            value={projectIdentifier}
            onChange={(e) => setProjectIdentifier(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="session-identifier">Session Identifier</label>
          <input
            id="session-identifier"
            type="text"
            placeholder="(Default) Session"
            className="nexus-input"
            value={sessionName.includes(' / ') ? sessionName.split(' / ')[1] : sessionName}
            onChange={(e) => setSessionName(e.target.value)}
          />
        </div>
      </div>

      <div className="screen-footer">
        <button className="nexus-btn continue-btn" onClick={handleContinue}>
          Continue to session setup
        </button>
      </div>
    </main>
  );
};

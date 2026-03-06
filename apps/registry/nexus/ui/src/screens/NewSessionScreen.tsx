import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { BackButton } from '../components/BackButton';
import { InfoButton } from '../components/InfoButton';
import { sessionNameAtom, activeActivityAtom } from '../store/atoms';

export const NewSessionScreen: React.FC = () => {
  const navigate = useNavigate();
  const [sessionName, setSessionName] = useAtom(sessionNameAtom);
  const [activeActivity] = useAtom(activeActivityAtom);
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
    const finalProject = projectIdentifier.trim() || 'LUNAR FACILITY';
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
    <main className="nexus-content">
      <div className="sub-header-row">
        <BackButton onClick={handleBack} />

        <h2 className="screen-title">{(activeActivity || 'SESSION NAME').toUpperCase()}</h2>

        <InfoButton />
      </div>

      <div className="form-container">
        <div className="form-group">
          <label htmlFor="project-identifier">Project / User Identifier</label>
          <input
            id="project-identifier"
            type="text"
            placeholder="(Default) LUNAR FACILITY"
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
            placeholder="(Default) Session [X] [Date]"
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

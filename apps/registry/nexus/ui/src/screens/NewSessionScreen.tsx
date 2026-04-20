import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { BackButton } from '../components/BackButton';
import { InfoButton } from '../components/InfoButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { ScreenLayout } from '../components/ScreenLayout';
import { selectedSubjectAtom, sessionNameAtom, siteNameAtom } from '../store/atoms';
import { isCompactFlowViewport } from '../utils/displayProfiles';

export const NewSessionScreen: React.FC = () => {
  const navigate = useNavigate();
  const [sessionName, setSessionName] = useAtom(sessionNameAtom);
  const [siteName] = useAtom(siteNameAtom);
  const [selectedSubject] = useAtom(selectedSubjectAtom);
  const isCompactViewport = isCompactFlowViewport();
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
    navigate(selectedSubject ? '/sensor-setup' : '/subjects');
  };

  return (
    <ScreenLayout
      className="screen-layout new-session-screen"
      header={
        <ScreenHeader
          left={<BackButton onClick={handleBack} />}
          center={<h2 className="screen-title">{isCompactViewport ? 'SESSION' : 'SESSION NAME'}</h2>}
          right={<InfoButton />}
        />
      }
      footer={
        <div className="screen-footer">
          <button className="nexus-btn continue-btn" onClick={handleContinue}>
            Continue to session setup
          </button>
        </div>
      }
    >
      <div className="form-container">
        {!isCompactViewport && (
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
        )}

        <div className="form-group">
          <label htmlFor="session-identifier">
            {isCompactViewport ? 'Session name' : 'Session Identifier'}
          </label>
          <input
            id="session-identifier"
            type="text"
            placeholder={isCompactViewport ? '(Default) Session name' : '(Default) Session'}
            className="nexus-input"
            value={sessionName.includes(' / ') ? sessionName.split(' / ')[1] : sessionName}
            onChange={(e) => setSessionName(e.target.value)}
          />
        </div>
      </div>
    </ScreenLayout>
  );
};

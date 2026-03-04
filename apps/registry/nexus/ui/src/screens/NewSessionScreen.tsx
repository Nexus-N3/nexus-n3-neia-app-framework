import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { BackButton } from '../components/BackButton';
import { InfoButton } from '../components/InfoButton';
import { sessionNameAtom } from '../store/atoms';

export const NewSessionScreen: React.FC = () => {
  const navigate = useNavigate();
  const [sessionName, setSessionName] = useAtom(sessionNameAtom);
  const [projectIdentifier, setProjectIdentifier] = useState('');

  const handleBack = () => {
    navigate('/');
  };

  const handleContinue = () => {
    setSessionName(`${projectIdentifier} / ${sessionName}`);
    navigate('/subjects');
  };

  return (
    <main className="nexus-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="sub-header-row" style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <BackButton onClick={handleBack} />

        <h2 className="screen-title" style={{ margin: 0 }}>
          SESSION NAME
        </h2>

        <InfoButton />
      </div>

      <div className="session-form-container">
        <div className="form-group">
          <label>Project / User Identifier</label>
          <input
            type="text"
            placeholder="(Default) LUNAR FACILITY"
            className="nexus-input"
            value={projectIdentifier}
            onChange={(e) => setProjectIdentifier(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Session Identifier</label>
          <input
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

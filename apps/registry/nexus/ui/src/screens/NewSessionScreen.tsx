import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '../components/BackButton';
import { InfoButton } from '../components/InfoButton';

export const NewSessionScreen: React.FC = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/');
  };

  const handleContinue = () => {
    navigate('/subjects');
  };

  return (
    <main className="nexus-content new-session-content">
      <div className="sub-header-row">
        <BackButton onClick={handleBack} />

        <h2 className="screen-title">SESSION NAME</h2>

        <InfoButton />
      </div>

      <div className="session-form-container">
        <div className="form-group">
          <label>Project / User Identifier</label>
          <input type="text" placeholder="(Default) LUNAR FACILITY" className="nexus-input" />
        </div>

        <div className="form-group">
          <label>Session Identifier</label>
          <input type="text" placeholder="(Default) Session [X] [Date]" className="nexus-input" />
        </div>
      </div>

      <div className="content-spacer"></div>

      <button className="nexus-btn continue-btn" onClick={handleContinue}>
        Continue to session setup
      </button>
    </main>
  );
};

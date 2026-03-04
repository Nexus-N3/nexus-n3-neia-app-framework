import React from 'react';
import { useNavigate } from 'react-router-dom';

export const HomeScreen: React.FC = () => {
  const navigate = useNavigate();

  const handleStartSession = () => {
    navigate('/new-session');
  };

  return (
    <main className="nexus-content">
      <h1 className="welcome-text">WELCOME TO NEXUS</h1>
      <div className="screen-footer">
        <button className="nexus-btn" onClick={handleStartSession}>
          Start new session
        </button>
      </div>
    </main>
  );
};

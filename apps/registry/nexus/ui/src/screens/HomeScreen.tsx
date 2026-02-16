import React from 'react';
import { useNavigate } from 'react-router-dom';

export const HomeScreen: React.FC = () => {
  const navigate = useNavigate();

  const handleStartSession = () => {
    navigate('/new-session');
  };

  return (
    <main className="nexus-content home-content">
      <h1 className="welcome-text">WELCOME TO NEXUS</h1>
      <button className="nexus-btn start-session-btn" onClick={handleStartSession}>
        Start new session
      </button>
    </main>
  );
};

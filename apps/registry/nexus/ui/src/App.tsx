import React, { useState } from 'react';
import './App.css';

type Screen = 'home' | 'new_session';

const App = () => {
  const [screen, setScreen] = useState<Screen>('home');

  const handleStartSession = () => {
    setScreen('new_session');
  };

  const handleBack = () => {
    setScreen('home');
  };

  return (
    <div className="nexus-app">
      <header className="nexus-header">
        <div className="header-left">
          <span className="logo">Nexus</span>
        </div>
        <div className="header-center">
          <span className="facility-name">{screen === 'home' ? 'LUNAR FACILITY EDGE' : 'CREATE NEW SESSION'}</span>
        </div>
        <div className="header-right">
          <button className="burger-menu" aria-label="Menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12H21" />
              <path d="M3 6H21" />
              <path d="M3 18H21" />
            </svg>
          </button>
        </div>
      </header>

      <div className="header-line"></div>

      {screen === 'home' ? (
        <main className="nexus-content home-content">
          <h1 className="welcome-text">WELCOME TO NEXUS</h1>
          <button className="nexus-btn start-session-btn" onClick={handleStartSession}>
            Start new session
          </button>
        </main>
      ) : (
        <main className="nexus-content new-session-content">
          <div className="sub-header-row">
            <button className="icon-btn back-btn" onClick={handleBack} aria-label="Go back">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18L9 12L15 6" />
              </svg>
            </button>

            <h2 className="screen-title">SESSION NAME</h2>

            <button className="icon-btn info-btn" aria-label="Info">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16V12" />
                <path d="M12 8H12.01" />
              </svg>
            </button>
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

          <button className="nexus-btn continue-btn">Continue to session setup</button>
        </main>
      )}
    </div>
  );
};

export default App;

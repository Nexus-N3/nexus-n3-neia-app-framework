import React from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import './App.css';
import logo from './assets/logo.svg';
import { HomeScreen } from './screens/HomeScreen';
import { NewSessionScreen } from './screens/NewSessionScreen';
import { SubjectsRequiredScreen } from './screens/SubjectsRequiredScreen';
import { SensorSetupScreen } from './screens/SensorSetupScreen';
import { BurgerMenu } from './components/BurgerMenu';

const AppContent = () => {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const headerTitle = isHome ? 'LUNAR FACILITY EDGE' : 'CREATE NEW SESSION';

  return (
    <div className="nexus-app">
      <header className="nexus-header">
        <div className="header-left">
          <img src={logo} alt="Nexus Logo" className="logo-img" />
        </div>
        <div className="header-center">
          <span className="facility-name">{headerTitle}</span>
        </div>
        <div className="header-right">
          <BurgerMenu />
        </div>
      </header>

      <div className="header-line"></div>

      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/new-session" element={<NewSessionScreen />} />
        <Route path="/subjects" element={<SubjectsRequiredScreen />} />
        <Route path="/sensor-setup" element={<SensorSetupScreen />} />
      </Routes>
    </div>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
};

export default App;

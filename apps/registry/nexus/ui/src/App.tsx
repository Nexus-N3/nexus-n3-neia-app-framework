import React from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useAtom } from 'jotai';
import './App.css';
import logo from './assets/logo.svg';
import { HomeScreen } from './screens/HomeScreen';
import { NewSessionScreen } from './screens/NewSessionScreen';
import { SubjectsRequiredScreen } from './screens/SubjectsRequiredScreen';
import { SensorSetupScreen } from './screens/SensorSetupScreen';
import { AddSensorScreen } from './screens/AddSensorScreen';
import { SessionScreen } from './screens/SessionScreen';
import { AssignSensorsScreen } from './screens/AssignSensorsScreen';
import { ActiveSessionScreen } from './screens/ActiveSessionScreen';
import { NewActivityScreen } from './screens/NewActivityScreen';
import { SubjectActivityScreen } from './screens/SubjectActivityScreen';
import { BurgerMenu } from './components/BurgerMenu';
import { ServerStatus } from './components/ServerStatus';
import { sessionNameAtom, activeActivityAtom } from './store/atoms';
import { useServerReadiness } from './hooks/useServerReadiness';

const AppContent = () => {
  useServerReadiness(); // Request and listen for server readiness
  const location = useLocation();
  const [sessionName] = useAtom(sessionNameAtom);
  const [activeActivity] = useAtom(activeActivityAtom);
  const isHome = location.pathname === '/';
  const isSessionRelated =
    location.pathname === '/session' ||
    location.pathname === '/assign-sensors' ||
    location.pathname === '/active-session' ||
    location.pathname === '/new-activity' ||
    location.pathname.startsWith('/activity/subject/');

  const headerTitle = isHome
    ? 'LUNAR FACILITY EDGE'
    : activeActivity
    ? (activeActivity as string).toUpperCase()
    : isSessionRelated
    ? sessionName
    : 'CREATE NEW SESSION';

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
          <ServerStatus />
          <BurgerMenu />
        </div>
      </header>

      <div className="header-line"></div>

      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/new-session" element={<NewSessionScreen />} />
        <Route path="/subjects" element={<SubjectsRequiredScreen />} />
        <Route path="/sensor-setup" element={<SensorSetupScreen />} />
        <Route path="/add-sensor" element={<AddSensorScreen />} />
        <Route path="/session" element={<SessionScreen />} />
        <Route path="/assign-sensors" element={<AssignSensorsScreen />} />
        <Route path="/active-session" element={<ActiveSessionScreen />} />
        <Route path="/new-activity" element={<NewActivityScreen />} />
        {/* We need a route for individual subject view */}
        <Route path="/activity/subject/:id" element={<SubjectActivityScreen />} />
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

import React from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import './App.css';
import './styles/App.compact.css';
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
import { ResetButton } from './components/ResetButton';
import { ServerStatus } from './components/ServerStatus';
import { RetryServerButton } from './components/RetryServerButton';
import { activeActivityAtom, connectedSensorsAtom, sessionNameAtom, siteNameAtom, serverReadyAtom } from './store/atoms';
import { GatewaySocketProvider } from './hooks/useGatewaySocket';
import { useServerReadiness } from './hooks/useServerReadiness';
import { useBatteryUpdates } from './hooks/useBatteryUpdates';
import { useConnectedSensorUpdates } from './hooks/useConnectedSensorUpdates';
import { useDisconnectSensors } from './hooks/useDisconnectSensors';
import { useResetSessionState } from './hooks/useResetSessionState';

const AppContent = () => {
  useServerReadiness(); // Request and listen for server readiness
  useBatteryUpdates();
  useConnectedSensorUpdates();
  const location = useLocation();
  const navigate = useNavigate();
  const [title] = useAtom(siteNameAtom);
  const [sessionName] = useAtom(sessionNameAtom);
  const [activeActivity] = useAtom(activeActivityAtom);
  const [connectedSensors] = useAtom(connectedSensorsAtom);
  const [serverReady] = useAtom(serverReadyAtom);
  const { disconnectAll, isDisconnecting } = useDisconnectSensors();
  const { resetSessionState } = useResetSessionState();
  const isHome = location.pathname === '/';
  const isSessionRelated =
    location.pathname === '/session' ||
    location.pathname === '/assign-sensors' ||
    location.pathname === '/active-session' ||
    location.pathname === '/new-activity' ||
    location.pathname.startsWith('/activity/subject/');

  const headerTitle = isHome
    ? title
    : activeActivity
    ? (activeActivity as string).toUpperCase()
    : isSessionRelated
    ? sessionName
    : 'CREATE NEW SESSION';

  React.useEffect(() => {
    if (!serverReady && location.pathname !== '/') {
      navigate('/', { replace: true });
    }
  }, [location.pathname, navigate, serverReady]);

  const hasConnectedSensors = Object.values(connectedSensors).some((sensors) => sensors.length > 0);

  const handleReset = React.useCallback(async () => {
    if (hasConnectedSensors) {
      try {
        await disconnectAll();
      } catch {
        // Hook stores UI error state; continue resetting local UI state.
      }
    }

    resetSessionState();
    navigate('/', { replace: true });
  }, [disconnectAll, hasConnectedSensors, navigate, resetSessionState]);

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
          {!serverReady && <RetryServerButton />}
          <ResetButton onClick={handleReset} disabled={isDisconnecting} />
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
      <GatewaySocketProvider>
        <AppContent />
      </GatewaySocketProvider>
    </BrowserRouter>
  );
};

export default App;

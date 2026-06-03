import React from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useAtom, useSetAtom } from 'jotai';
import './App.css';
import './styles/App.compact.css';
import logo from './assets/logo.svg';
import appManifest from '../../app.json';
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
import { ConfigBootstrapScreen } from './screens/ConfigBootstrapScreen';
import { ResetButton } from './components/ResetButton';
import { activeActivityAtom, batteryStatusesAtom, configuredSubjectsAtom, connectedSensorsAtom, selectedSessionConfigAtom, selectedSubjectAtom, sessionNameAtom, serverReadyAtom, subjectCountAtom, subjectPrefixAtom } from './store/atoms';
import { GatewaySocketProvider } from './hooks/useGatewaySocket';
import { useServerReadiness } from './hooks/useServerReadiness';
import { useBatteryUpdatesCore } from './hooks/useBatteryUpdatesCore';
import { useConnectedSensorUpdatesCore } from './hooks/useConnectedSensorUpdatesCore';
import { useDisconnectSensorsCore } from './hooks/useDisconnectSensorsCore';
import { useResetSessionState } from './hooks/useResetSessionState';
import { useStreamLifecycleCore } from './hooks/useStreamLifecycleCore';
import { readSelectedSubjectContext } from './utils/subjectContext';
import { readSelectedSessionConfig } from './utils/sessionConfigContext';

const AppContent = () => {
  useServerReadiness(); // Request and listen for server readiness
  useStreamLifecycleCore();
  const location = useLocation();
  const navigate = useNavigate();
  const [sessionName] = useAtom(sessionNameAtom);
  const [activeActivity] = useAtom(activeActivityAtom);
  const [connectedSensors] = useAtom(connectedSensorsAtom);
  const [serverReady] = useAtom(serverReadyAtom);
  const setConfiguredSubjects = useSetAtom(configuredSubjectsAtom);
  const setSelectedSessionConfig = useSetAtom(selectedSessionConfigAtom);
  const setSelectedSubject = useSetAtom(selectedSubjectAtom);
  const setSessionName = useSetAtom(sessionNameAtom);
  const setSubjectCount = useSetAtom(subjectCountAtom);
  const setSubjectPrefix = useSetAtom(subjectPrefixAtom);
  const setConnectedSensors = useSetAtom(connectedSensorsAtom);
  const setBatteryStatuses = useSetAtom(batteryStatusesAtom);
  const { batteryStatuses } = useBatteryUpdatesCore();
  const { connectedSensors: liveConnectedSensors } = useConnectedSensorUpdatesCore();
  const { disconnectAll, isDisconnecting } = useDisconnectSensorsCore();
  const { resetSessionState } = useResetSessionState();
  const isHome = location.pathname === '/';
  const isSessionRelated =
    location.pathname === '/session' ||
    location.pathname === '/assign-sensors' ||
    location.pathname === '/active-session' ||
    location.pathname === '/new-activity' ||
    location.pathname.startsWith('/activity/subject/');

  const headerTitle = activeActivity
    ? (activeActivity as string).toUpperCase()
    : isSessionRelated
    ? sessionName
    : 'CREATE NEW SESSION';

  React.useEffect(() => {
    if (!serverReady && location.pathname !== '/') {
      navigate('/', { replace: true });
    }
  }, [location.pathname, navigate, serverReady]);

  React.useEffect(() => {
    const selectedSubject = readSelectedSubjectContext();
    if (!selectedSubject) {
      return;
    }
    setSelectedSubject(selectedSubject);
    setSubjectCount(1);
    setSubjectPrefix(selectedSubject.display_name);
  }, [setSelectedSubject, setSubjectCount, setSubjectPrefix]);

  React.useEffect(() => {
    const sessionConfig = readSelectedSessionConfig();
    if (!sessionConfig || sessionConfig.app_id !== appManifest.id) {
      return;
    }
    const configuredSubjects = Array.isArray(sessionConfig.subjects)
      ? sessionConfig.subjects
          .filter((subject) => typeof subject.subject_id === 'string')
          .map((subject) => ({
            subject_id: subject.subject_id,
            display_name: subject.display_name || subject.subject_id,
            subject_type: subject.subject_type ?? null,
          }))
      : [];
    if (configuredSubjects.length > 0) {
      setConfiguredSubjects(configuredSubjects);
      setSubjectCount(configuredSubjects.length);
      setSubjectPrefix('');
    }
    setSelectedSessionConfig({
      session_config_id: sessionConfig.session_config_id,
      name: sessionConfig.name,
      activity: sessionConfig.activity ?? null,
    });
    setSessionName(sessionConfig.name);
    if (location.pathname === '/') {
      navigate('/config-bootstrap', { replace: true });
    }
  }, [
    location.pathname,
    navigate,
    setConfiguredSubjects,
    setSelectedSessionConfig,
    setSessionName,
    setSubjectCount,
    setSubjectPrefix,
  ]);

  React.useEffect(() => {
    setBatteryStatuses(batteryStatuses);
  }, [batteryStatuses, setBatteryStatuses]);

  React.useEffect(() => {
    setConnectedSensors(liveConnectedSensors);
  }, [liveConnectedSensors, setConnectedSensors]);

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
    <div className="nexus-shell">
      <div className="nexus-app">
        <header className="nexus-header">
          <div className="header-left">
            <img src={logo} alt="Nexus Logo" className="logo-img" />
          </div>
          <div className="header-center">
            <div className="header-app-meta">
              <span className="facility-name">{isHome ? appManifest.name : headerTitle}</span>
            </div>
          </div>
          <div className="header-right">
            <ResetButton onClick={handleReset} disabled={isDisconnecting} />
          </div>
        </header>

        <div className="header-line"></div>

        <div className="route-stage">
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/new-session" element={<NewSessionScreen />} />
            <Route path="/subjects" element={<SubjectsRequiredScreen />} />
            <Route path="/config-bootstrap" element={<ConfigBootstrapScreen />} />
            <Route path="/sensor-setup" element={<SensorSetupScreen />} />
            <Route path="/add-sensor" element={<AddSensorScreen />} />
            <Route path="/session" element={<SessionScreen />} />
            <Route path="/assign-sensors" element={<AssignSensorsScreen />} />
            <Route path="/active-session" element={<ActiveSessionScreen />} />
            <Route path="/new-activity" element={<NewActivityScreen />} />
            <Route path="/activity/subject/:id" element={<SubjectActivityScreen />} />
          </Routes>
        </div>
      </div>
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
